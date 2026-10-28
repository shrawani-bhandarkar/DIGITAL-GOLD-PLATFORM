# Digital Gold Platform — Admin Panel

A React admin console built with Vite. It includes a shared backend-authenticated login, responsive navigation, dashboard, customer management and detail views, metal product catalog, rate approval workflow, buy/sell order and detail views, SIP management, redemption and delivery, gift management, payment and refund review, settlement reconciliation, CSV reports, role/permission configuration, settings, and audit logs.

## Run locally

```bash
npm install
npm run dev
```

Create a production build with `npm run build`, or preview it with `npm run preview`.
For local development Vite proxies `/api` to the Node.js API. Production uses
`VITE_API_BASE_URL=/api` so browser requests reach the API service through the
same-origin Vercel rewrite; the API client avoids duplicating the `/api` prefix.

## Sign-in

Admin and Super Admin accounts are verified against MySQL. There is no role selector; the backend-derived session role controls access to the shared dashboard. Sign-in uses an HttpOnly session cookie rather than browser-stored credentials.

## Data and API readiness

Customer profiles, products, rate requests, orders, SIP plans, redemptions, gifts, payment/refund records, settlements, settings, role permissions, audit events, and report exports are read from and written to MySQL through the Node.js API. Existing database records remain the source of truth; the UI does not seed operational sample records.

### Metal catalog and financial calculations

Gold, Silver, and Platinum can be configured in the MySQL product catalog, rate requests, dashboard cards, orders, portfolio ledgers, and metal filters. Product entries hold buy/sell rates, charge and tax basis points, optional buy/sell quantity limits, and redemption eligibility, fulfillment methods, quantity bounds, delivery charge, and tax.

The Metal Products page also contains one independent making-charge setting per metal, persisted in MySQL. The selected product's purchase rate and metal-specific making charge are used in buy quotes. Charges are rounded to paise at the configured 0.001 g quantity precision. Super Admin can edit/disable them; an Admin can view and use them only when its assigned products/orders permissions allow. No extra tax is applied to making charges unless an approved tax policy is supplied; product tax configuration remains separate.

`src/utils/financial.js` is the shared calculation layer for order quotes, portfolio quantities, SIP date schedules, reconciliation differences, and dashboard totals. Money calculations use integer paise; metal quantities use integer milligrams (0.001 g precision), with half-up rounding at the paise/milligram boundary. Omitted per-product fee/tax values default to zero; configure approved rules before production use. Non-zero unit-test examples exercise fee/tax calculation and rounding only; they are not real tax rates or platform policies.

- Amount-based buys treat the entered amount as the base metal value; quantity is base value divided by the selected buy rate. Quantity-based buys compute base value from grams × buy rate.
- Sell quotes compute gross proceeds from quantity × sell rate and then subtract configured charges and tax. Sell and redemption requests are limited by available balances derived from persisted ledger entries, completed orders, and reservations.
- Per-product fee, tax, quantity, and redemption values are configurable; blank quantity bounds mean no product-specific bound was supplied. Redemption creation requires that the product and requested fulfillment method be configured.
- Portfolio values include available and reserved quantity and are estimates at each product's displayed sell rate.
- Customer-list and customer-detail portfolio values use the same ledger and product sell rates; dashboard rate cards read active configured product rates.
- SIP schedules calculate weekly or monthly dates and planned contribution totals but do not schedule or initiate payments.
- Dashboard transaction totals use unique completed order IDs from the selected date window; failed, pending, and processing orders are excluded. Pending payments count persisted records in Pending or Processing state, while completed totals are derived from orders only so matching payment records are not counted twice.
- Reconciliation variance is settled/actual amount minus expected amount. Matching/mismatch status is derived from that variance unless a mismatch has been annotated as reviewed.

### Node.js API integration

`src/services/apiClient.js` exports `apiRequest(path, options)` and is used by the shared sign-in and session flow:

- `POST /api/auth/login` verifies Admin credentials against `admins` and Super Admin credentials against `superadmins`.
- `GET /api/auth/session` restores the verified role from the server-side session cookie; `POST /api/auth/logout` revokes that session.
- Requires same-origin paths beginning with exactly one `/`; `VITE_API_BASE_URL` is optional when Vite's `/api` proxy is used.
- JSON-encodes object request bodies, supports browser `FormData`/binary bodies without forcing JSON headers, and sends `Accept: application/json`.
- Returns `null` for `204` or an empty response, parses JSON responses, and throws explicit errors for HTTP failures, non-JSON bodies, and malformed JSON.

The admin-console API loads operational records from MySQL, enforces stored role permissions, and persists supported changes. Report exports are generated from current MySQL records and their type, filters, row count, and actor are recorded in `admin_reports`.

Vite `VITE_*` values are bundled into client code; never use them for secrets.
Database credentials belong only in the API service's server-side environment.
Use HTTPS for a deployed API and configure CORS/authentication on the server.

The separate Spring Boot API checklist in [SPRING_BOOT_API_CONTRACT.md](./SPRING_BOOT_API_CONTRACT.md) does not describe the Node.js authentication integration.

## Admin features

- Search, status filters, sortable table columns, and pagination for operational lists.
- Customer profile details with KYC approval and rejection actions.
- Validated customer and metal product forms, plus product activation controls.
- Rate change requests require approval before updating the matching MySQL product rate.
- Buy/sell orders persist order timelines and status transitions; SIP plans support persisted pause/resume.
- Redemptions and gifts persist review and fulfillment states. These records do not initiate real payments, send messages, or contact providers.
- Payments are read-only records; refund decisions and settlement review annotations are persisted without initiating financial transactions.
- Reports export filtered MySQL records as CSV, with report-generation metadata persisted in `admin_reports`.
- Only the `SUPER_ADMIN` and `ADMIN` roles are configured. Super Admin has full access; Admin's permissions are persisted and assigned by Super Admin in Roles & Permissions. Users must sign out and authenticate with the separate account to access the other role. The API enforces permissions for protected operations.
- Role identity is derived from the matched account record, not a stored role string. However, this client-side demo does not provide trustworthy authentication: local storage, permissions, and UI state can be modified by a user. Backend authorization must enforce identity, Super Admin configuration privileges, and Admin assignments. The audit feed is neither immutable nor server-side security logging. Customer mobile-app authentication is separate and is not implemented by this admin panel.
- Financial and metal actions are administrative records only. They do not execute real trades, send payments, contact providers, or deliver messages.

## Tests

Run the automated component and utility tests with `npm test`. They cover all
registered routes, login, dashboard rendering, list search/filters,
pagination, supported creation forms, review confirmations, the two-role permission matrix and route checks, integer-based financial calculations and invalid inputs, SIP schedules,
portfolio ledger actions, reconciliation variance/status, dashboard duplicate
and failed-order handling, the API transport layer, and CSV
content/download setup.

## Admin routes

- `/` dashboard
- `/customers` and `/customers/:customerId`
- `/products`, `/rates`, `/orders` and `/orders/:orderId`
- `/sips`, `/redemptions`, `/gifts`
- `/payments`, `/refunds`, `/reconciliation`, `/reports`
- `/roles`, `/settings`, `/audit-logs`
