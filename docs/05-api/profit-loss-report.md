# Monthly Profit and Loss API

## Endpoint

`GET /api/v1/profit-loss?month={month}&year={year}`

The endpoint requires an authenticated, active `ADMIN`. It returns a monthly
Profit and Loss snapshot using exact two-decimal strings for monetary values.

## Query

| Field | Required | Validation |
| --- | --- | --- |
| `month` | Yes | Integer from `1` through `12` |
| `year` | Yes | Integer from `2000` through `9999` |

Unknown query parameters are rejected. The UTC reporting interval includes
the first instant of the selected month and excludes the first instant of the
following month.

Services and Payments use `createdAt`. Expenses use `expenseDate`, falling
back to `createdAt` when no expense date was recorded.

## Accounting Definitions

- Collected inflow and gross revenue are the sum of Client Service
  `packagePrice`, as requested by the current reporting contract.
- Total outflow and operating expense are the sum of Expense `expenseAmount`.
- Net operating profit is collected inflow minus total outflow.
- Net operating profit margin is `(net operating profit / collected inflow) *
  100`; it is `0` when collected inflow is zero.
- Accounts receivable is the sum of each Payment's non-negative outstanding
  balance: `max(totalBilled - amountReceived, 0)`.

## Response

```json
{
  "data": {
    "period": { "month": 8, "year": 2026 },
    "kpi": {
      "collectedInflow": "50000.00",
      "totalOutflow": "20000.00",
      "netOperatingProfit": "30000.00",
      "netOperatingProfitMargin": 60,
      "accountReceivable": "7500.00"
    },
    "inflows": {
      "categories": [
        { "category": "Business Setup", "amount": "30000.00" }
      ],
      "totalGrossRevenue": "50000.00"
    },
    "outflows": {
      "categories": [
        { "category": "Office Rent & Utilities", "amount": "12500.00" }
      ],
      "totalOperatingExpense": "20000.00"
    }
  },
  "meta": {
    "correlationId": "opaque-correlation-id"
  }
}
```

Both category arrays contain every configured category, including categories
whose amount is `"0.00"`. Invalid query input returns `422
VALIDATION_FAILED` using the standard error envelope.
