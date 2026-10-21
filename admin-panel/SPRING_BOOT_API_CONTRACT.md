# Spring Boot integration contract: open decisions

This checklist describes decisions required only if replacing the current
Node.js API with a Spring Boot service. The admin panel currently uses the
Node.js API in `apps/api`, which reads and writes its operational records in
MySQL. The checklist below is not the contract for that existing API.

Before integration, the frontend and backend developers must agree on the
public API base URL, endpoint paths and methods, authentication, authorization,
error format, pagination convention, date/time format, and the exact fields
and status transitions. Do not expose credentials or secrets through Vite
`VITE_*` variables.

## UI capabilities that need a backend contract

| Capability | Required operations and request data | Response data the UI needs |
|---|---|---|
| Dashboard and activity | Read summary metrics, indicative metal prices, transaction volume, and recent activity; define the calculation period and as-of time. | Metrics, chart series, and recent events with explicit currency, unit, and timestamp semantics. |
| Customers and KYC | Search/list customers; read a customer profile; create/update permitted profile fields; submit KYC approve/reject and account status decisions with an actor and reason where required. | Customer ID, contact/profile data, KYC/account states, balances and activity with server-authoritative values and timestamps. Sensitive identity fields require an access policy. |
| Metal products and rates | List/read catalog; create/update products and order limits; submit rate proposals; approve/reject proposals. Define whether rates are versioned and how approval concurrency is detected. | Product IDs, metal/purity/unit, active state, limits, current approved rates, proposal status, reviewer, and audit timestamps. |
| Buy/sell orders | Read/search orders and detail/timeline. The current UI can create demo buy/sell records and update sample order status; backend must first define whether these operations are permitted, their lifecycle, preconditions, idempotency, and external financial/metal processing boundaries. | Server-owned order ID, accepted status, amount, quantity, quote/rate reference, timeline, and failures. Do not treat a frontend status transition as fulfillment. |
| SIP plans | Read plans and submit plan setup or pause/resume/cancel requests if those features are approved. Define mandate/consent and debit scheduling flows separately. | Plan state, schedule, next installment, and server-confirmed action result. A plan record is not proof of a debit. |
| Redemption and delivery | Read requests and timelines; submit redemption requests; approve/reject; request fulfillment status updates only under an agreed operations contract. | Eligibility and available quantity, accepted request, fulfillment state, tracking data, and authoritative timestamps. No address or payout destination should be accepted until privacy/security rules are defined. |
| Gifts | Read records; create a gift request; cancel or request resend only after defining delivery, consent, and idempotency rules. | Gift state, sender/recipient references, scheduled delivery, and message delivery result. Do not treat UI labels as sent messages or transferred assets. |
| Payments and refunds | The current payment UI is read-only. Define payment read access. Refund requests/decisions may be exposed only after the backend contract specifies authorization, review, idempotency, provider reconciliation, and a separate real-transaction confirmation boundary. | Provider-neutral payment/refund state, amount/currency, references, timestamps, and safe error details. Never use the frontend mock status as evidence of settlement or refund. |
| Reconciliation and reports | Read settlement/reconciliation records, support mismatch annotations if approved, and define report queries/exportable fields and access scope. | Server-generated settlement data and variance definitions; report metadata and a bounded result set or an approved export stream. |
| Roles and permissions | Read/manage roles only after a server authorization model is defined. The frontend permission matrix is a visual preview, not access control. | Server-authoritative roles/permissions and denied-operation responses. Every protected operation must be checked by the server. |
| Settings and audit | Read/update only settings approved for remote management; write security audit events server-side for protected actions. | Server-persisted settings with validation/versioning and durable, access-controlled audit records. The in-memory UI audit feed is not a compliance log. |

## Request/response rules to settle

- Choose endpoint paths and HTTP methods in the API design review; this
  document intentionally does not prescribe them.
- Define request and response schemas for each operation, including field
  optionality, identifiers, decimal precision, units, currency, and date/time
  zone.
- Define list filtering, sorting, cursor/page behavior, maximum page size, and
  date-boundary semantics consistently across list screens.
- Use a consistent error envelope for validation failures, authentication and
  authorization failures, conflicts, unavailable providers, and unexpected
  server errors. The UI must not infer success from an empty or malformed body.
- Define idempotency and concurrency handling before enabling create, approval,
  cancel, resend, or status-transition requests.
- Establish server-side authentication, authorization, audit, rate-limiting,
  privacy/retention, and CORS policies. The demo login and browser permission
  switches do not satisfy any of these requirements.
- Determine which financial or metal operations require a separate workflow,
  provider integration, human approval, and reconciliation. The admin frontend
  must not initiate them until those contracts are reviewed and implemented.

## Spring Boot migration boundary

The Node.js API integration is active; `src/services/apiClient.js` is used by
the admin panel for authentication, operational data, settings, audit events,
and report generation. A Spring Boot replacement remains blocked on the
decisions above and an agreed, reviewed migration specification.
