import ClientPayment from "../../clients/models/clientPayment.model.js";
import ClientService, {
  CLIENT_SERVICE_CATEGORIES,
} from "../../clients/models/clientService.model.js";
import Expense, { EXPENSE_CATEGORIES } from "../model/expense.model.js";

// Builds the inclusive UTC month start and exclusive following-month boundary.
// Using UTC prevents server timezone settings from moving records between report periods.
export const buildProfitLossDateRange = ({ month, year }) => ({
  startDate: new Date(Date.UTC(year, month - 1, 1)),
  endDate: new Date(Date.UTC(year, month, 1)),
});

// Builds category and grand-total facets for one monthly Decimal128 amount source.
// A fallback date supports Expenses created before an explicit expenseDate was recorded.
export const buildCategoryAmountPipeline = ({
  startDate,
  endDate,
  dateField,
  fallbackDateField,
  categoryField,
  amountField,
}) => [
  {
    $set: {
      reportDate: fallbackDateField
        ? { $ifNull: [`$${dateField}`, `$${fallbackDateField}`] }
        : `$${dateField}`,
    },
  },
  {
    $match: {
      reportDate: { $gte: startDate, $lt: endDate },
    },
  },
  {
    $facet: {
      categories: [
        {
          $group: {
            _id: `$${categoryField}`,
            amount: { $sum: { $ifNull: [`$${amountField}`, 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            category: "$_id",
            amount: { $toString: { $round: ["$amount", 2] } },
          },
        },
      ],
      total: [
        {
          $group: {
            _id: null,
            amount: { $sum: { $ifNull: [`$${amountField}`, 0] } },
          },
        },
        {
          $project: {
            _id: 0,
            amount: { $toString: { $round: ["$amount", 2] } },
          },
        },
      ],
    },
  },
];

// Builds the monthly non-negative outstanding Payment balance aggregation.
// Each Payment contributes max(totalBilled minus amountReceived, zero).
export const buildAccountReceivablePipeline = ({ startDate, endDate }) => [
  { $match: { createdAt: { $gte: startDate, $lt: endDate } } },
  {
    $set: {
      outstandingAmount: {
        $subtract: [
          { $ifNull: ["$totalBilled", 0] },
          { $ifNull: ["$amountReceived", 0] },
        ],
      },
    },
  },
  {
    $group: {
      _id: null,
      amount: {
        $sum: {
          $cond: [
            { $gt: ["$outstandingAmount", 0] },
            "$outstandingAmount",
            0,
          ],
        },
      },
    },
  },
  {
    $project: {
      _id: 0,
      amount: { $toString: { $round: ["$amount", 2] } },
    },
  },
];

// Converts a database decimal string into integer cents with half-up rounding.
// Integer arithmetic keeps cross-collection profit calculations free of float errors.
const decimalStringToCents = (value) => {
  const decimalValue = value?.$numberDecimal ?? value?.toString?.() ?? "0";
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(decimalValue);

  if (!match) {
    throw new Error("A stored financial amount has an unsupported format.");
  }

  const [, sign, whole, suppliedFraction = ""] = match;
  const fraction = suppliedFraction.padEnd(3, "0");
  let cents = BigInt(whole) * 100n + BigInt(fraction.slice(0, 2));

  if (fraction[2] >= "5") {
    cents += 1n;
  }

  return sign === "-" ? -cents : cents;
};

// Formats integer cents as a stable two-decimal API string.
// Negative operating profit retains its sign while zero always returns 0.00.
const formatCents = (cents) => {
  const isNegative = cents < 0n;
  const absoluteCents = isNegative ? -cents : cents;
  const whole = absoluteCents / 100n;
  const fraction = (absoluteCents % 100n).toString().padStart(2, "0");

  return `${isNegative ? "-" : ""}${whole}.${fraction}`;
};

// Divides signed integers and rounds the result to the nearest whole unit.
// This produces a two-decimal percentage when the numerator is scaled by 10,000.
const divideAndRound = (numerator, denominator) => {
  const quotient = numerator / denominator;
  const remainder = numerator % denominator;
  const absoluteRemainder = remainder < 0n ? -remainder : remainder;
  const absoluteDenominator = denominator < 0n ? -denominator : denominator;

  if (absoluteRemainder * 2n < absoluteDenominator) {
    return quotient;
  }

  const hasNegativeResult = (numerator < 0n) !== (denominator < 0n);
  return quotient + (hasNegativeResult ? -1n : 1n);
};

// Fills every configured category with an exact amount, including zero-value categories.
// Stable category arrays let dashboards render without merging enum metadata separately.
const buildCategoryResponse = (configuredCategories, aggregateCategories) => {
  const amountByCategory = new Map(
    aggregateCategories.map(({ category, amount }) => [category, amount])
  );

  return configuredCategories.map((category) => ({
    category,
    amount: formatCents(
      decimalStringToCents(amountByCategory.get(category) ?? "0")
    ),
  }));
};

// Aggregates the requested monthly Profit and Loss KPIs, inflows, and outflows.
// Cross-collection subtraction uses integer cents while MongoDB performs Decimal128 sums.
export const getProfitLoss = async ({ month, year }) => {
  const { startDate, endDate } = buildProfitLossDateRange({ month, year });
  const [serviceResults, expenseResults, receivableResults] = await Promise.all([
    ClientService.aggregate(
      buildCategoryAmountPipeline({
        startDate,
        endDate,
        dateField: "createdAt",
        categoryField: "category",
        amountField: "packagePrice",
      })
    ).exec(),
    Expense.aggregate(
      buildCategoryAmountPipeline({
        startDate,
        endDate,
        dateField: "expenseDate",
        fallbackDateField: "createdAt",
        categoryField: "expenseCategory",
        amountField: "expenseAmount",
      })
    ).exec(),
    ClientPayment.aggregate(
      buildAccountReceivablePipeline({ startDate, endDate })
    ).exec(),
  ]);

  const serviceResult = serviceResults[0] ?? { categories: [], total: [] };
  const expenseResult = expenseResults[0] ?? { categories: [], total: [] };
  const collectedInflowCents = decimalStringToCents(
    serviceResult.total[0]?.amount ?? "0"
  );
  const totalOutflowCents = decimalStringToCents(
    expenseResult.total[0]?.amount ?? "0"
  );
  const accountReceivableCents = decimalStringToCents(
    receivableResults[0]?.amount ?? "0"
  );
  const netOperatingProfitCents =
    collectedInflowCents - totalOutflowCents;
  const marginBasisPoints =
    collectedInflowCents === 0n
      ? 0n
      : divideAndRound(
          netOperatingProfitCents * 10000n,
          collectedInflowCents
        );

  return {
    period: { month, year },
    kpi: {
      collectedInflow: formatCents(collectedInflowCents),
      totalOutflow: formatCents(totalOutflowCents),
      netOperatingProfit: formatCents(netOperatingProfitCents),
      netOperatingProfitMargin: Number(marginBasisPoints) / 100,
      accountReceivable: formatCents(accountReceivableCents),
    },
    inflows: {
      categories: buildCategoryResponse(
        CLIENT_SERVICE_CATEGORIES,
        serviceResult.categories
      ),
      totalGrossRevenue: formatCents(collectedInflowCents),
    },
    outflows: {
      categories: buildCategoryResponse(
        EXPENSE_CATEGORIES,
        expenseResult.categories
      ),
      totalOperatingExpense: formatCents(totalOutflowCents),
    },
  };
};
