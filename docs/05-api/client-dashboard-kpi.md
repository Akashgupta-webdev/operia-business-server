# Client Dashboard KPI API

## Endpoint

`GET /api/v1/client/dashboard/kpi`

The endpoint requires an authenticated, active `ADMIN` and returns a snapshot
of Client renewal and inventory KPIs.

## Query Filters

| Field | Required | Validation and behavior |
| --- | --- | --- |
| `type` | No | `Clients`, `Companies`, `Renewals`, or `High Priority` |
| `fromDate` | No | Inclusive expiry date in `dd-mm-yyyy`; defaults to `null` |
| `toDate` | No | Inclusive expiry date in `dd-mm-yyyy`; defaults to `null` |

When both dates are present, `fromDate` must be earlier than or equal to
`toDate`. Unknown query fields are rejected.

The `type` filter changes the renewal KPIs only:

- `Clients` includes Client and Client Member identity/insurance expiries.
- `Companies` includes Client Company licence expiries.
- `Renewals` or an omitted type includes all supported expiry fields.
- `High Priority` includes expired renewals and renewals due within seven days.

The inventory KPIs (`totalClients`, `activeCompanies`, identity, fleet, and
trade-license counts) remain global. A company is active when its owning Client
has status `Active`, because Client Company currently has no separate status.

## Renewal Fields

- Client and Client Member: Passport, Emirates ID, Visa, and health-insurance
  expiry dates.
- Client Company: licence expiry date.
- Client Vehicle: registration and insurance expiry dates.
- Client Driver: licence expiry date.

Expired means before the current UTC date. Due soon means today through 60
days, inclusive. Valid and compliant means more than 60 days away. Due-soon
breakdown values are cumulative.

## Success Response

```json
{
  "data": {
    "totalRenewalsTracked": 120,
    "totalExpired": 8,
    "totalDueSoon": 25,
    "dueSoonBreakdown": {
      "within7Days": 3,
      "within14Days": 7,
      "within30Days": 14,
      "within45Days": 20,
      "within60Days": 25
    },
    "validAndCompliant": 87,
    "totalClients": 50,
    "activeCompanies": 18,
    "vatDue": 0,
    "corporateTax": 0,
    "visaEidPassport": 96,
    "insuranceAndFleet": 22,
    "tradeLicense": 41
  },
  "meta": {
    "correlationId": "opaque-correlation-id"
  }
}
```

`visaEidPassport` counts populated Passport, Emirates ID, and Visa identifiers
across Clients and Client Members. `insuranceAndFleet` counts Client Vehicle
and Client Driver records. `tradeLicense` counts populated trade licence, VAT
registration, and corporate tax number fields. `vatDue` and `corporateTax` are
reserved and currently return zero.

Invalid filters return `422 VALIDATION_FAILED` using the standard error
envelope.
