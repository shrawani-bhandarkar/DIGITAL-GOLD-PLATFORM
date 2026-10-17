# Digital Gold Platform — Admin Panel

A frontend-only React admin console built with Vite. It includes the protected demo login, responsive navigation, dashboard, customer management and detail views, metal product catalog, rate approval workflow, buy/sell order and detail views, SIP management, redemption and delivery, gift management, payment and refund review, sample settlement reconciliation, CSV reports, role/permission configuration, settings, and audit logs.

## Run locally

```bash
npm install
npm run dev
```

Create a production build with `npm run build`, or preview it with `npm run preview`.
Copy `.env.example` to `.env.local` for local configuration. Keep `VITE_API_BASE_URL` empty for demo-only mode.

## Demo access

- **Super Admin (shop owner):** `superadmin@digitalgold.demo` / `SuperAdmin123!`
- **Admin (assigned permissions):** `admin@digitalgold.demo` / `Admin123!`

The matched demo account determines the identity and role; there is no role selector or role-preview switch. The account ID is stored in browser local storage to preserve the demo session across refreshes. This authentication is **not production security**: browser storage and frontend permission checks can be tampered with. Real password verification, authentication, and authorization must be implemented and enforced by the backend. No payment, refund, metal transfer, delivery, or backend persistence is performed by this frontend.

## Data and API readiness

Dashboard figures, customer profiles, products, rate requests, orders, SIP plans, redemptions, gifts, payment/refund records, settlements, activity, audit events, and transactions are mock data for UI development only. Operational actions, settings, and audit history are held in application memory and reset on a full page reload. Super Admin's Admin-permission configuration is stored in browser local storage so it can be used by the separate Admin demo login; it is not server persistence. No backend endpoints are assumed or called.

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

`src/services/apiClient.js` exports `apiRequest(path, options)` for future same-origin API integration. It:

- Requires `VITE_API_BASE_URL` to be configured and a path beginning with exactly one `/`.
- JSON-encodes object request bodies, supports browser `FormData`/binary bodies without forcing JSON headers, and sends `Accept: application/json`.
- Returns `null` for `204` or an empty response, parses JSON responses, and throws explicit errors for HTTP failures, non-JSON bodies, and malformed JSON.
- Does not provide authentication, retries, endpoint contracts, or a backend. Add those only after the API contract and security requirements are defined.

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
- Only the `SUPER_ADMIN` (Super Admin/shop owner) and `ADMIN` roles are configured. Super Admin has all demo permissions; Admin's permissions are assigned by Super Admin in Roles & Permissions. Users must sign out and authenticate with the separate account to access the other role. Sidebar links and direct routes respect the active demo permissions, with missing permissions denied by default.
- Role identity is derived from the matched account record, not a stored role string. However, this client-side demo does not provide trustworthy authentication: local storage, permissions, and UI state can be modified by a user. Backend authorization must enforce identity, Super Admin configuration privileges, and Admin assignments. The audit feed is neither immutable nor server-side security logging. Customer mobile-app authentication is separate and is not implemented by this admin panel.
- All values and actions are for demonstration only and do not persist or execute trades.

## Tests

Run the automated component and utility tests with `npm test`. They cover all
registered routes, demo login, dashboard rendering, list search/filters,
pagination, supported creation forms, review confirmations, in-memory demo
state, the two-role permission matrix and route checks, integer-based financial calculations and invalid inputs, SIP schedules,
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
