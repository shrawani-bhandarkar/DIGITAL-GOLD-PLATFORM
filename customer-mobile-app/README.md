# DigiGold customer app

This is the existing Expo/React Native customer app. It uses backend customer
sign-in, database-backed metal rates, and the Quick Buy purchase-order API
alongside clearly labelled frontend demo data for features that do not yet
have backend APIs. Illustrative rates,
in-memory holdings and transaction records, and empty notification state are
not production data. No SMS, backend request, payment, or real purchase, sale,
redemption, SIP, or gift is performed in demo mode.

## Run

From this directory:

```powershell
npm start
```

For an Android Studio emulator on Windows, run `npm run android:emulator`
instead. It starts Metro with IPv4-first localhost resolution for ADB reverse
forwarding, clears the Metro cache, and limits bundler workers. Backend sign-in
requires an active customer record in the admin panel database. In API
development mode, the backend-generated one-time code is shown on the
verification screen. No fixed or local demo OTP is accepted by backend login.

Added `@expo/vector-icons` for native action, rate-card, and bottom-navigation
icons and `expo-linear-gradient` for the Gift Gold banner. Expo SDK, React
Native, the entry point, and existing scripts are unchanged.

## Try the local demo flows

1. Sign in with a valid 10-digit Indian number and enter the demo OTP shown on
   screen.
2. Choose **Buy**, select **Gold 24K**, enter a budget (or quantity in grams),
   review the itemized estimate, then confirm the local demo record. Home,
   My Savings, and Activity
   update immediately.
3. Choose **Sell** or **Redeem**, enter a quantity no greater than the
   available demo gold, review, and confirm. The local sample balance changes;
   no actual metal or money moves.
    When no demo holdings are available, the Sell and Redeem cards remain
    themed and open their forms, which explain that a demo buy is needed first.
4. Try **Start SIP** and **Gift Gold**. They add local demo history entries but
   do not change holdings, create a payment mandate, contact a recipient, or
   deliver a gift.
5. Open **Activity** to filter by Buy, Sell, Redeem, SIP, or Gift. Tap a row for
   its demo reference and details. **My Savings** shows the current sample
   holdings and estimated value.
6. On the Android Emulator, press `r` in the Expo terminal (or select Reload
   from the Expo developer menu) to refresh. Demo records and holdings are
   in-memory state and reset after an app reload or demo logout.

## Metal rates and purchase estimates

The dashboard order is the existing DigiGold welcome header, Current Metal
Rates, Quick Buy, Explore DigiGold actions, and Recent Activity. Gold 24K,
Silver, and Platinum rate cards are tappable; tapping one opens Quick Buy,
selects that metal, and scrolls the dashboard to the estimate. Quick Buy can
also be expanded or collapsed and supports amount- or gram-based purchases.
Demo mode retains its local purchase-review flow; backend mode requests a
server quote and submits a confirmed order. The rates have a fixed horizontal
viewport and can be swiped on narrow screens. Rates and sample holdings live
in `src/services/demoData.js` only in demo mode; they are illustrative and are
not live market data. Backend mode displays only the latest effective Gold,
Silver, and Platinum prices and purity returned by the market-rates API from
the MySQL metal-price history table, plus customer activity returned for the
signed-in customer. It does not fill missing rates with demo labels; when no
records exist, the dashboard shows an empty state. Gross and net weights are shown
only when corresponding weight fields
are present in the portfolio data (for example, `goldGrossWeightGrams` or
`grossWeightGrams.gold`); otherwise the UI says they are unavailable. The
local demo `*Grams` holding is not presented as gross or purity-adjusted net
weight. No percentage price movement is shown because no verified previous-rate
feed is configured.

In demo mode, the dashboard **Quick Buy** calculator and dedicated Buy form
share the buy-only `calculateBuyEstimate` calculation in
`src/services/pricingService.js`. Demo Buy estimates use rate × quantity only.
Backend Quick Buy instead uses a server quote sourced from the latest effective
MySQL metal price, purity, active product, and making-charge configuration.
Configured product buy charges are included in the GST taxable base. The
customer supplies a billing-state code; the server compares it with the
configured seller state and applies CGST + SGST for intra-state orders or IGST
for interstate orders. GST rates and the jurisdiction are configured in the
Admin Panel. The quote shows each tax component, and the customer confirms it
before the server recalculates and creates an order. The supplied state is
stored with the order but is not address-verified by the current profile or
payment flow; production payments must verify the billing address before tax
finalization.

### Backend Quick Buy API and payment status

Both endpoints require the existing authenticated customer bearer token:

- `POST /api/customer/orders/purchase/quote` accepts `{ "metalId": "gold",
  "mode": "amount", "value": "1000", "stateCode": "MH" }` (or `mode: "grams"`).
  The state code is the customer's declared billing state. The response returns
  the current rate, purity, effective date, quantity, itemized charges, GST
  jurisdiction and tax breakdown, and total.
- `POST /api/customer/orders/purchase` accepts the same input, the
  `quoteToken` returned by the quote endpoint, and an `Idempotency-Key`
  header. The signed quote token expires after two minutes and is invalidated
  when its rate, active product, making-charge, or GST configuration changes. The
  endpoint re-reads the database and inserts the order and payment intent in
  one MySQL transaction.
  Retrying the same key and input returns the original order; reusing a key
  with different input is rejected.
- Admin Panel configuration uses `PUT /api/admin/console/making-charges/:metal`
  and `PUT /api/admin/console/metal-tax-settings`. Both require Superadmin or
  an Admin with the `products` permission.

Orders reuse `admin_orders`, `admin_payments`, `admin_metal_products`,
`admin_metal_price_history`, and `admin_metal_making_charges`. GST settings use
the dedicated `admin_metal_gst_settings` table. Apply
`apps/api/src/modules/admin-console/migrations/001-create-metal-gst-settings.sql`
to an existing database; it is additive and preserves existing charge data.
For a database whose making-charge table still has the legacy
`charge_per_purchase` column, also apply
`apps/api/src/modules/admin-console/migrations/005-making-charge-type.sql`.
Existing making-charge values remain fixed rupee amounts. Superadmins can
choose fixed rupees or a percentage of metal value per metal; Quick Buy uses
the selected type and value in its server-side quote.
Customer KYC numbers are entered by authorized Admins or Super Admins; the
customer app displays only the latest Pending, Approved, or Rejected status.
Apply
`apps/api/src/modules/admin-console/migrations/006-customer-kyc-documents.sql`
and `apps/api/src/modules/admin-console/migrations/007-admin-managed-customer-kyc.sql`
to existing databases and configure `KYC_ENCRYPTION_KEY` in the API environment
as 64 hex characters generated from 32 random bytes. Keep the key stable and
backed up; KYC numbers are encrypted at rest and full values are returned only
to authenticated Admins with customer permission. The customer profile API
returns the current KYC status for the mobile app.
It initializes the requested 1.5% CGST, 1.5% SGST, and 3% IGST rates while
leaving seller state unconfigured until an authorized Admin sets it. No live
quote is enabled until the seller state is configured. An Admin can update
making charges and GST only when the Superadmin has granted the `products`
permission; Superadmin retains access. Rates displayed by Quick Buy come from
the database quote and persisted GST settings, not client-side defaults.
Saved Quick Buy orders are returned by the existing customer activity API and
Admin Console order state. No payment gateway is configured, so payment stays
**Pending**, no funds are collected, and Admins cannot mark these orders
completed as if a payment had succeeded. Processing or cancellation status
changes remain available in the Admin order screen.

Sell has a separate `calculateSellEstimate` rule. The requested demo config
adds a fixed ₹250 Gold transaction charge and 3% demo GST; CGST/SGST are
displayed as components of that GST, not added a second time. On a rounding
remainder, SGST is adjusted so the displayed components sum exactly to GST.
Silver and Platinum sell making charges are unconfigured and explicitly
excluded from their estimates. Sell estimates are not guaranteed settlement
amounts. Redeem has no configured charge or tax; it does not apply Sell rules.
All of these demo configurations must be replaced or confirmed by the
authorized provider before production transactions.

The dashboard's **My Savings** card and the **Savings** bottom tab open the
same screen and use the same local portfolio state. The Savings screen shows
the total portfolio value and available demo holdings, with an empty state
when no holdings exist. The dashboard's compact **Bill Statements** card and
the statement screen show an honest empty state because statement data and a
statement API are not available. Dashboard copy and the Savings, Activity,
and Account screens explain their available data and demo limitations. The
four persistent main tabs are Home, Savings, Activity, and Account. The Gift
Gold screen also uses a purple hero banner; its recipient form and review are
demo-only, with no recipient verification or gift delivery.
Rate cards use local Material icons because this project contains no gold,
silver, or platinum bullion image assets. Profile has dedicated read-only
Account Details, KYC Status, Bank/Payment Settings, Security, and Help screens.
Customer profile, KYC, bank/payment, and support integrations are not
configured, so unknown information is shown as unavailable and no verified
status is fabricated. The KYC screen includes an identity/review walkthrough,
with local Aadhaar/PAN number validation and a masked review. Full numbers stay
in screen memory only; they are not persisted or submitted. Consent is not
recorded and submission remains disabled until the backend/provider is
integrated. KYC status and any action-required reason remain unavailable until
the backend supplies them.

All estimates are illustrative. The backend/provider must supply authoritative
rates, product-specific making charges, the applicable tax base and
intra-/inter-state treatment, and other transaction fees before production
orders can be enabled.

## Data modes

- Default: `EXPO_PUBLIC_DATA_MODE=backend`. Rates and recent activity are loaded
  from the API. If the database has no active metal rates or the signed-in
  customer has no activity, the dashboard shows an empty state rather than
  sample records.
- Demo: set `EXPO_PUBLIC_DATA_MODE=demo`. Illustrative rates, starting portfolio
  values, and sample transactions come from `src/services/demoData.js` or
  in-memory app state and are never presented as backend records.
- Backend: set `EXPO_PUBLIC_API_BASE_URL` to the API origin, then restart Expo.
  Backend mode does not fall back to demo sign-in or use local storage. The API
  customer OTP, market-rate, and customer-activity routes are implemented;
  other data routes are not all available yet and remain separate from sign-in.

For local development, set `NODE_ENV=development` for the API and apply
`apps/api/src/modules/customer-auth/schema.sql` to `digital_gold_db`. The
development OTP is exposed only by a development API response. Production OTP
delivery requires an SMS provider, which is not configured in this project;
the API returns an error rather than claiming a code was sent.

In development, the app defaults to `http://10.0.2.2:4000` on the Android
emulator and `http://localhost:4000` on iOS simulator/web. For a physical
device, set `EXPO_PUBLIC_API_BASE_URL` to the development machine's LAN address
before starting or restarting Expo.

The app does not persist access tokens, store payment details, access the
database directly, or call the admin panel. Admin visibility must come from the
same authoritative backend transaction records used by the customer API.

## Backend contract required

Before production integration, the backend and admin owners must provide and
agree on:

1. API base URL(s) per environment, TLS policy, and allowed app origins/network
   configuration.
2. OTP request/verify/logout paths and HTTP methods; mobile-number format,
   OTP expiry/attempt limits, throttling, consent, and response behavior.
3. Authentication/session format, expiry/refresh/revocation, secure storage
   requirements, and the profile response fields. The current adapter expects
   an `accessToken` from OTP verification only as a proposed contract.
4. Exact paths, methods, request and response schemas for profile, rates,
   portfolio, transaction history, sell quote and submission,
   redemption quote and submission, SIP list/create/cancel, gift quote/send,
   and notifications.
5. Server-side validation rules for customer permissions, holdings, metal
   eligibility, minimum/maximum amounts, quantities, decimal precision, quote
    expiry, rounding, taxes, fees, rate freshness and currency. Include
    separate Gold/Silver/Platinum rate and purity data, accurate gross and
    net-weight definitions, and a per-metal, transaction-specific making
    charge rule and charge type.
6. Authoritative taxable base, tax rates and transaction/location rules
    (including intra-state CGST/SGST versus inter-state IGST), rounding
    behavior, and applicable buy/sell/redemption fees. The app's 3% split GST
    and ₹250 Gold charge are demo-only and must not be copied as universal
    production rules.
7. Transaction status enum and lifecycle (including pending, failed, rejected,
    settled, cancelled, and reversal states), transaction/reference IDs,
    timestamps, and which statuses permit a customer retry.
8. Standard error schema, field validation error shape, safe customer-facing
    messages, correlation IDs, and expired-session behavior.
9. Pagination and filtering/sorting rules for activity, SIPs, and
    notifications; notification read/unread semantics if available.
10. A future payment-provider handoff and callback/return verification flow.
    Quick Buy currently makes no reservation and recalculates its quote on
    submission. The app does not treat a client calculation as payment success.
11. Quick Buy uses the `Idempotency-Key` header; a retry must reuse the same
    key and input to recover an unknown network outcome.
12. How admin APIs retrieve the exact same transaction by its authoritative
    transaction ID, permitted admin roles, and consistency/visibility timing.
    The mobile app must never use admin credentials or write to admin APIs.
13. Whether real-time updates are supported (WebSocket, SSE, or push), the
    authentication/reconnect contract, or the approved polling/refresh policy.
14. Product/legal approval for supported metals, cash/physical redemption,
    gifting, SIPs, payment methods, privacy/terms destinations, and any data
    retention requirements.

In demo mode, confirming a review adds a clearly marked local sample record to
the top of Recent Activity and transaction history. Demo buy/sell/redeem
actions update only the in-memory sample holdings; a sell or redemption
requires a preceding demo buy. SIP and gift create local history records but
do not move metal or money. Records and balances reset when the app restarts
or the demo user logs out. No action contacts a backend, payment provider, or
gift recipient, and demo activity is not visible to the admin panel.

Backend Quick Buy is available with server-confirmed database order
persistence, but it does not charge customers. Sell, redemption, SIP, gift,
and other real financial actions remain unavailable until their backend
contracts, payment integration, authorization, and server-confirmed
transaction flows are implemented.
