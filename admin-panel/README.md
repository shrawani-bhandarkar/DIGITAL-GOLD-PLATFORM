# Digital Gold Platform — Admin Panel

A React admin console built with Vite. It includes server-verified administrator sign-in, responsive navigation, dashboard, customer management and detail views, metal product catalog, rate approval workflow, buy/sell order and detail views, SIP management, redemption and delivery, gift management, payment and refund review, sample settlement reconciliation, CSV reports, role/permission configuration, settings, and audit logs.

## Run locally

```bash
npm install
npm run dev
```

Start the API in a second terminal from the repository root with `npm run dev:api`. Configure MySQL in `apps/api/.env` first. The admin-panel Vite server proxies `/api` requests to `http://localhost:4000`; leave `VITE_API_BASE_URL` empty for local development. Create a production build with `npm run build`, or preview it with `npm run preview`.

## Administrator sign-in

Sign-in checks credentials against the API's `admin_users` table. The API stores password hashes using scrypt and issues an eight-hour, HttpOnly session cookie; only a hash of the session token is stored in MySQL. There are no built-in demo credentials.

Before first use, create the MySQL authentication tables and an administrator account from the repository root. Set up the API database and `.env` as described in the root README, then run these commands in Command Prompt:

```cmd
mysql -u root -p digital_gold_db < apps\api\src\modules\auth\schema.sql
set ADMIN_EMAIL=you@example.com
set ADMIN_DISPLAY_NAME=Your Name
set ADMIN_PASSWORD=use-a-unique-password-at-least-12-characters
npm run create:admin --workspace @digi-gold/api
set ADMIN_EMAIL=
set ADMIN_DISPLAY_NAME=
set ADMIN_PASSWORD=
```

Set `NODE_ENV=production` and serve the UI/API over HTTPS in production so the session cookie is marked Secure. Configure `WEB_ORIGIN` to the exact trusted admin-panel origin if it is served separately from the API.

## Data and API readiness

Dashboard figures, customer profiles, products, rate requests, orders, SIP plans, redemptions, gifts, payment/refund records, settlements, activity, audit events, and transactions are mock data for UI development only. Operational actions, settings, permission-matrix edits, and audit history remain in application memory and reset on a full page reload; they are not persisted by the API. Server-side authorization for future operational endpoints must be implemented before those actions operate on real data.

### Metal catalog and financial demo calculations

Gold, Silver, and Platinum are supported in the sample product catalog, rate requests, dashboard cards, orders, portfolio ledgers, and metal filters. Product entries hold independently configurable buy/sell rates, charge and tax basis points, optional buy/sell quantity limits, and redemption eligibility, fulfillment methods, quantity bounds, delivery charge, and tax. Platinum redemption remains unconfigured in the mock catalog until those rules are supplied; an operator can edit those demo settings from the product form.

`src/utils/financial.js` is the shared calculation layer for order quotes, portfolio quantities, SIP date schedules, reconciliation differences, and dashboard totals. Money calculations use integer paise; metal quantities use integer milligrams (0.001 g precision), with half-up rounding at the paise/milligram boundary. The per-product fee/tax defaults are independent zero-valued demo placeholders because actual approved rules have not been supplied. Non-zero unit-test examples exercise fee/tax calculation and rounding only; they are not real tax rates or platform policies.

- Amount-based buys treat the entered amount as the base metal value; quantity is base value divided by the selected buy rate. Quantity-based buys compute base value from grams × buy rate.
- Sell quotes compute gross proceeds from quantity × sell rate and then subtract configured demo charges and tax. Sell and redemption requests are limited by available balances derived from opening demo ledger entries, completed orders, and reservations.
- Per-product fee, tax, quantity, and redemption values are configurable placeholders; blank quantity bounds mean no product-specific bound was supplied. Redemption creation requires that the product and requested fulfillment method be configured.
- Portfolio values include available and reserved quantity and are estimates at each product's displayed sell rate.
- Customer-list and customer-detail portfolio values use the same ledger and product sell rates; dashboard rate cards read the active sampled product rates.
- SIP schedules calculate weekly or monthly dates and planned contribution totals but do not schedule or initiate payments.
- Dashboard transaction totals use unique completed order IDs from the 30-day mock window (16 Sep–15 Oct 2026); failed, pending, and processing orders are excluded. Pending payments count mock records in Pending or Processing state, while completed totals are derived from orders only so matching payment records are not counted twice.
- Reconciliation variance is settled/actual amount minus expected amount. Matching/mismatch status is derived from that variance unless a mismatch has been annotated as reviewed.

### API client preparation

`src/services/apiClient.js` exports `apiRequest(path, options)` for same-origin API calls and includes:

- Same-origin `/api` requests by default (proxied to the API during local development), or an optional configured API base URL, and a path beginning with exactly one `/`.
- JSON-encodes object request bodies, supports browser `FormData`/binary bodies without forcing JSON headers, and sends `Accept: application/json`.
- Returns `null` for `204` or an empty response, parses JSON responses, and throws explicit errors for HTTP failures, non-JSON bodies, and malformed JSON.
- Sends browser credentials for the administrator session. The current authentication endpoints are `POST /api/auth/login`, `GET /api/auth/session`, and `POST /api/auth/logout`.

Vite `VITE_*` values are bundled into client code; never use them for secrets. Use HTTPS for a deployed API and configure CORS/authentication on the server.

The Spring Boot API work still required—including endpoint and schema decisions—is documented in [SPRING_BOOT_API_CONTRACT.md](./SPRING_BOOT_API_CONTRACT.md). It is an integration checklist, not a statement that these endpoints or backend behaviors currently exist.

## Admin features

- Search, status filters, sortable table columns, and pagination for operational lists.
- Customer profile details with KYC approval and rejection actions.
- Validated customer and metal product forms, plus product activation controls.
- Rate change requests require approval before updating the matching in-memory product rate.
- Buy/sell orders expose simulated order timelines and status transitions; SIP plans support simulated pause/resume.
- Redemptions track sample approval, shipping, payout, and delivery states; gift records support scheduled delivery and simulated resend/cancellation.
- Payments are read-only sample records; refund decisions and settlement mismatch reviews only change in-memory review labels.
- Reports export filtered mock records as CSV; exports are not financial statements or settlement instructions.
- Roles and permissions are an editable UI preview and are not enforced authorization. Settings, operational state, role edits, and audit events remain in memory until reload; the audit feed is neither immutable nor durable and is not server-side security logging.
- Product/rate/rule editing is frontend demo state, not a security boundary. The existing role permission matrix is unchanged and is not enforced by the frontend; the backend must enforce Super Admin configuration privileges and the Admin role's assigned operational permissions. Customer mobile-app authentication is separate and is not implemented by this admin panel.
- All values and actions are for demonstration only and do not persist or execute trades.

## Tests

Run the automated component and utility tests with `npm test`. They cover all
registered routes, demo login, dashboard rendering, list search/filters,
pagination, supported creation forms, review confirmations, in-memory demo
state, integer-based financial calculations and invalid inputs, SIP schedules,
portfolio ledger actions, reconciliation variance/status, dashboard duplicate
and failed-order handling, the API transport preparation boundary, and CSV
content/download setup.

## Admin routes

- `/` dashboard
- `/customers` and `/customers/:customerId`
- `/products`, `/rates`, `/orders` and `/orders/:orderId`
- `/sips`, `/redemptions`, `/gifts`
- `/payments`, `/refunds`, `/reconciliation`, `/reports`
- `/roles`, `/settings`, `/audit-logs`
