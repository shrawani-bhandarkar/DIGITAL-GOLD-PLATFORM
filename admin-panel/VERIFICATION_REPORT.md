# Admin Panel Verification Report

## Scope

This review covers the existing React/Vite frontend and its in-memory mock data only. No backend, database persistence, authorization enforcement, real payment/refund, delivery, or metal transaction was tested or performed.

## Pages and routes tested

Automated route-rendering checks cover login and these 17 authenticated routes:

| Area | Route |
|---|---|
| Dashboard | `/` |
| Customers and customer details | `/customers`, `/customers/:customerId` |
| Metal products and rate management | `/products`, `/rates` |
| Orders and order details | `/orders`, `/orders/:orderId` |
| SIP management | `/sips` |
| Redemption and delivery | `/redemptions` |
| Gift management | `/gifts` |
| Payments and refunds | `/payments`, `/refunds` |
| Reconciliation and reports | `/reconciliation`, `/reports` |
| Roles and permissions | `/roles` |
| Settings and audit logs | `/settings`, `/audit-logs` |

Sidebar navigation was exercised, and logout was checked to return to the login screen. A browser smoke check also visited all 17 authenticated routes, including nested detail pages, without page exceptions or console errors. At a 390 × 844 viewport, the navigation opened and closed without horizontal overflow.

## Forms and actions exercised

- Login: incorrect and demo credentials.
- Customers: search, verification filter, pagination, sorting, required-field validation, creation, KYC decisions, and confirmed account suspension/restore.
- Products and rates: product form validation, create/edit, activation status confirmation, rate request, approval, rejection confirmation, and display of the approved rate on the dashboard.
- Products and rates: verified Gold, Silver, and Platinum entries in mock data; confirmed all three dashboard cards and current rate rows; edited Platinum-specific charge/tax and quantity limits, and verified those settings in a Platinum buy quote.
- Buy/sell: amount- and quantity-based buy previews, simulated order creation/status progression, sell creation, holdings-aware quantity checks, and Platinum order filtering.
- SIP: installment creation and confirmed pause/resume actions.
- Redemption: coin-delivery request, holding checks, confirmation, and details.
- Gifts: scheduled gift creation, cancellation, and simulated resend.
- Payments/refunds: read-only payment records, confirmed refund decisions, and reconciliation review annotation.
- Administration and reporting: settings edits and in-memory audit entries, permission-matrix edits and Super Admin protection, report dataset/status/date filtering, invalid date ranges, and filtered CSV export.
- Roles and access: exactly two role identifiers (`SUPER_ADMIN`, `ADMIN`); Super Admin full access; Admin permission save/cancel/confirmation; restricted sidebar and direct-route denial when permission is missing; Admin cannot reach role management or switch itself to Super Admin in the UI.
- Operational data tables: filtered sorting before pagination, search/filter, empty results, and pagination.

## Calculation formulas verified

The shared calculation and validation layer is [src/utils/financial.js](./src/utils/financial.js).

- **Money and quantity representation:** money uses integer paise; metal quantity uses integer milligrams (0.001 g precision). Decimal inputs are validated before conversion, calculated integer totals are checked for safe-integer overflow, and displayed currency/quantity uses explicit Indian currency and gram formatting.
- **Buy:** amount-based quantity is entered base amount ÷ selected buy rate; quantity-based base amount is grams × selected buy rate. Demo charges, demo tax, and total payable are separate quote values.
- **Per-product policy:** Buy, sell, and delivery charges/taxes use the selected product's separately configurable basis points/paise; optional quantity bounds are validated at milligram precision. Blank bounds are not treated as an invented business limit.
- **Sell:** gross proceeds are quantity × selected sell rate; net proceeds subtract configured demo charges and tax. The request is limited to available ledger-derived sellable quantity.
- **Portfolio:** ledger credits, debits, reservations, reservation releases, and consumed reservations produce available, reserved, and total holdings. Estimated values use displayed product sell rates and are labelled demo estimates.
- **SIP:** weekly and monthly dates are derived from the selected start date; monthly dates clip to the last valid day. Installments are limited to 2–60, planned totals use paise arithmetic, and no recurring payment is scheduled.
- **Redemption:** quantity is checked against eligible holdings and the product's configured bounds; the quote separates gross value, demo delivery charge, tax, and total. Platinum redemption and fulfillment modes remain explicitly unconfigured until the applicable rules are supplied.
- **Dashboard:** figures derive from mock records. Completed totals use unique completed order IDs within the fixed 30-day sample window (16 Sep–15 Oct 2026); failed, pending, and processing orders are excluded, and payment records are not added a second time. Pending payments include Pending and Processing records.
- **Reconciliation:** difference is actual/settled minus expected; matching and mismatch status follows the variance, with reviewed mismatches retained as annotations.

All fee and tax settings remain explicitly labelled demo configuration. No real platform fee, tax, rate, or provider policy was inferred.

## Automated test and build results

- `npm test` — **passed**: 4 test files, 63 tests.
- `npm run build` — **passed**: Vite 6.4.4 production build; 2,242 modules transformed.
- Coverage includes financial formulas and invalid-input boundaries, ledger actions, SIP schedules, reconciliation signs, dashboard duplicate/failed-order handling, routed screens, forms/actions listed above, API-client preparation boundaries, and CSV behavior.

## Bugs found and fixed

- Replaced static dashboard metrics with status-aware mock-record aggregations and excluded duplicate/failed/incomplete orders from completed totals.
- Centralized financial calculations and input validation using paise and milligram integers, including safe-total checks.
- Added ledger-derived portfolio valuations and available-balance checks for selling and redemption.
- Added calculated buy/sell/redemption breakdowns and validated SIP date/amount/frequency handling.
- Connected sortable table headers to filtered datasets before pagination.
- Derived reconciliation and report values from paise arithmetic and made reconciliation variance signs consistent.
- Connected dashboard indicative rates to the active sampled product rates.
- Confirmed Platinum already existed in product, rate-request, order, and ledger mock data; added its missing dashboard card and active-rate visibility in Rate Management.
- Routed order/redemption calculations through independently configurable per-product fee, tax, quantity, and redemption policies without assigning Platinum the Gold/Silver redemption defaults.
- Replaced obsolete admin roles with the fixed `SUPER_ADMIN` and `ADMIN` roles and updated historical mock audit actors.
- Added a Super-Admin-only Admin permission editor with draft, cancel, and confirmed-save interactions; prevented role creation and Super Admin permission changes.
- Added selected-demo-role route gates and permission-filtered sidebar navigation, including access-denied feedback for disallowed direct routes.

## Remaining limitations and untested areas

- The application is a synchronous mock-data frontend; it has no server-backed loading lifecycle. Network loading, backend failures, data consistency, and concurrent updates therefore remain untested.
- In-memory operational changes, selected demo role, and permission edits reset on reload. Demo login and client-side permission controls are not production authentication or authorization.
- The browser smoke check covers rendered routes and basic responsive navigation, not exhaustive device/browser combinations or every visual breakpoint.
- No real payment provider, refund, metal purchase/sale, recurring SIP debit, delivery, settlement, or financial statement was executed or verified.
- Demo fee/tax values are zero placeholders until the project coordinator provides approved rules. Platinum redemption remains unavailable until its product-specific fulfillment and quantity settings are configured.
- Frontend demo access checks are bypassable and do not replace backend authorization. The backend must enforce Super Admin configuration privileges and the Admin role's assigned operational permissions. Customer mobile-app authentication remains separate and is not implemented by this admin panel.
