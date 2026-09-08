# Client Renewals List API

GET /api/v1/client/renewals

Requires an authenticated, active ADMIN. This is a read-only expiry listing,
not a Policy renewal workflow. No request body is required.

## Query

| Field | Default | Validation |
| --- | --- | --- |
| page | 1 | Positive integer |
| limit | 20 | Integer from 1 to 100 |

Unknown query fields are rejected with 422 VALIDATION_FAILED. This endpoint
explicitly uses page/limit pagination like the Client Company list.

## Sources and categories

| Category | Sources | Source identifier | Expiry field |
| --- | --- | --- | --- |
| passport | Client, Client Member | passport.passportNumber | passport.passportExpiryDate |
| emirates | Client, Client Member | emirates.emiratesId | emirates.emiratesExpiryDate |
| visa | Client, Client Member | visa.visaUIDNumber | visa.visaExpiryDate |
| healthInsurance | Client, Client Member | healthInsurance.healthInsuranceCardNumber | healthInsurance.healthInsuranceExpiryDate |
| establishment | Client Company | establishment.establishmentCard | establishment.establishmentCardExpiry |
| tradeLicence | Client Company | tradeLicence.tradeLicenceNo | tradeLicence.tradeLicenceExpiry |
| document | Client Document | documentTitle | expiryDate |
| driverLicence | Client Driver | name | licenceExpiryDate |
| vehicleRegistration | Client Vehicle | registrationNumer | registrationExpiry |
| vehicleInsurance | Client Vehicle | policyNumber | insuranceExpiry |

Every valid expiry produces a separate row, including expired records. Records
with missing, malformed or impossible expiry dates are excluded. Rows sort by
parsed UTC expiry ascending, then source, recordId and category ascending.
Pagination applies after combining all sources. Dates retain the Client module's
dd-mm-yyyy format. Document records are separate rows even if they describe an
identity already present in Client or Member records.

## Response

~~~json
{
  "data": [{
    "id": "company:68ad00000000000000000002:tradeLicence",
    "source": "company",
    "recordId": "68ad00000000000000000002",
    "clientId": "68ad00000000000000000001",
    "item": "Trade Licence (Example Trading LLC)",
    "category": "tradeLicence",
    "entity": "Example Trading LLC - Example Trading LLC",
    "clientName": "Example Person",
    "expiryDate": "31-12-2030"
  }],
  "page": { "page": 1, "limit": 20, "total": 1, "totalPages": 1 },
  "meta": { "correlationId": "opaque-correlation-id" }
}
~~~

The item display format is category (entity name), for example Visa (Example Employee).
The entity display format is entity name - company name, for example
Example Employee - Example Trading LLC. The entity name is the Company name,
Client/Member/Driver name, or vehicle registration number; Documents use the
owning Client name. Missing entity names fall back to the Client name.

Company rows use their own company name. Other rows use the owning Client's
associated companies, sorted by company name and joined with commas if there
are multiple companies. Duplicate names are displayed once. Missing companies
omit the hyphen suffix; missing entity names omit the parentheses in item.
When neither name is available, entity is null. Orphaned records remain visible.

source is client, member, company, document, driver, or vehicle. id uniquely
identifies the source record and category, so multiple expiries from one record
remain distinguishable. No full identity/document objects or private upload
metadata are exposed. Empty results return 200 with data [] and totalPages 0.
Authentication failures return 401, forbidden roles return 403, and unexpected
failures use the standard 500 error envelope.

Item category labels are Passport, Emirates ID, Visa, Health Insurance,
Establishment Card, Trade Licence, Document, Driver Licence, Vehicle Registration,
and Vehicle Insurance. The category field retains its existing machine-readable value.
