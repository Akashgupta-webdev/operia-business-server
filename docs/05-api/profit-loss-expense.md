# Profit and Loss Expense Create API

## Endpoint

`POST /api/v1/profit-loss/expense`

The endpoint requires an authenticated, active `ADMIN`. It accepts an
`application/json` body, rejects unknown fields, and creates one Expense.

## Request Fields

| Field | Required | Validation |
| --- | --- | --- |
| `expenseTitle` | Yes | Trimmed string, 1-200 characters |
| `expenseCategory` | Yes | Exact value from the Expense category enum |
| `expenseAmount` | No | Non-negative decimal string with at most two decimal places |
| `expenseDate` | No | Valid date in `YYYY-MM-DD` format |
| `paymentMethod` | No | Exact value from the payment-method enum |
| `vendorName` | No | Trimmed string, 1-200 characters |
| `receiptReference` | No | Trimmed string, 1-200 characters |
| `notes` | No | Trimmed string, 1-2,000 characters |

Expense categories:

- `Government & Authority Fees`
- `Typing & Amer Centers`
- `PRO Processing & Courier`
- `Office Rent & Utilities`
- `Software & Cloud Tools`
- `Salaries & Professional Fees`
- `Miscellaneous Operations`

Payment methods:

- `Bank Transfer / Online`
- `Corporate Credit Card`
- `Cash / Petty Cash`
- `PRO Reimbursement`

## JavaScript Example

```js
const response = await fetch("/api/v1/profit-loss/expense", {
  method: "POST",
  credentials: "include",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    expenseTitle: "August office rent",
    expenseCategory: "Office Rent & Utilities",
    expenseAmount: "12500.00",
    expenseDate: "2026-08-30",
    paymentMethod: "Bank Transfer / Online",
    vendorName: "Example Properties LLC",
    receiptReference: "RENT-2026-08",
    notes: "Office rent for August 2026"
  })
});

const result = await response.json();
```

## Success Response

The endpoint returns `201 Created`, `Location` pointing to the created Expense,
and an `ETag` containing its version.

```json
{
  "data": {
    "id": "68ad00000000000000000001",
    "expenseTitle": "August office rent",
    "expenseCategory": "Office Rent & Utilities",
    "expenseAmount": { "$numberDecimal": "12500.00" },
    "expenseDate": "2026-08-30T00:00:00.000Z",
    "paymentMethod": "Bank Transfer / Online",
    "vendorName": "Example Properties LLC",
    "receiptReference": "RENT-2026-08",
    "notes": "Office rent for August 2026",
    "version": 0,
    "createdAt": "2026-08-30T10:00:00.000Z",
    "updatedAt": "2026-08-30T10:00:00.000Z"
  },
  "meta": {
    "correlationId": "opaque-correlation-id"
  }
}
```

Invalid input returns `422 VALIDATION_FAILED` using the standard error
envelope.
