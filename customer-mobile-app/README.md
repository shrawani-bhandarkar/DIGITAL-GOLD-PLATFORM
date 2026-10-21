# DigiGold customer app

This is the existing Expo/React Native customer app. It currently runs in a
clearly labelled frontend demo mode. Demo sign-in, illustrative rates,
in-memory holdings and transaction records, and empty notification state are
not production data. No SMS, backend request, payment, or real purchase, sale,
redemption, SIP, or gift is performed in demo mode.

## Run

From this directory:

```powershell
npm start
```

Use the Expo QR code or press `a` for an Android emulator. Demo sign-in accepts
a valid Indian mobile number and the OTP shown on the verification screen.
That OTP is for local UI demonstration only; it is not authentication.

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

The dashboard uses a compact purple DigiGold header, followed by tappable
Gold 24K, Silver, and Platinum rate cards before the Explore DigiGold actions.
The rates have a fixed-height horizontal viewport so the cards remain visible
and can be swiped on narrow screens. Rates and sample holdings live in
`src/services/demoData.js`; they are illustrative and are not live market
data. Gross and net weights are shown only when corresponding weight fields
are present in the portfolio data (for example, `goldGrossWeightGrams` or
`grossWeightGrams.gold`); otherwise the UI says they are unavailable.
The local demo `*Grams` holding is not presented as gross or purity-adjusted
net weight. No percentage price movement is shown because no verified
previous-rate feed is configured.

The dashboard **Quick Buy** calculator and dedicated Buy form share the
buy-only `calculateBuyEstimate` calculation in
`src/services/pricingService.js`. Buy estimates use rate × quantity only and
do not show or apply making charges or tax. SIP/Gift demo quantity estimates
also use the rate-only calculation.

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
status is fabricated.

All estimates are illustrative. The backend/provider must supply authoritative
rates, product-specific making charges, the applicable tax base and
intra-/inter-state treatment, and other transaction fees before production
orders can be enabled.

## Data modes

- Default: `EXPO_PUBLIC_DATA_MODE=demo`. Dashboard rates and starting portfolio
  values are explicitly illustrative and are loaded from
  `src/services/demoData.js`. New sample transactions and portfolio updates
  live only in React state and start empty on each app session.
- Backend: set `EXPO_PUBLIC_DATA_MODE=backend` and
  `EXPO_PUBLIC_API_BASE_URL` to the approved API origin, then restart Expo.
  Backend mode does not fall back to demo data. The routes in
  `src/config/apiRoutes.js` are proposals only and must be confirmed before
  connecting to an API. The generic API methods are scaffolding, not evidence
  that those API endpoints exist or that their schemas are compatible.

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
   portfolio, transaction history, purchase/sell quote and submission,
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
10. Quote rules and endpoint sequencing: quote binding/expiry, whether server
    review reserves anything, and the precise payment-provider handoff and
    callback/return verification flow. The app must not treat a client
    calculation or payment redirect as transaction success.
11. Idempotency-key header/body contract, key lifetime, duplicate response
    behavior, and safe recovery for timeouts/unknown outcomes.
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

Real financial actions stay unavailable until the backend contract, quote
flow, payment integration, authorization, and server-confirmed transaction
refresh are implemented.
