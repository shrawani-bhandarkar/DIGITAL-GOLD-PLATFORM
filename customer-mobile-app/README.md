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

No dependencies were added. Expo SDK, React Native, the entry point, and the
existing scripts are unchanged.

## Try the local demo flows

1. Sign in with a valid 10-digit Indian number and enter the demo OTP shown on
   screen.
2. Choose **Buy Gold**, select **Gold 24K**, enter `₹12,500` (or `1` gram),
   review, then confirm the local demo record. Home, Portfolio, and Activity
   update immediately.
3. Choose **Sell Gold** or **Redeem Gold**, enter a quantity no greater than the
   available demo gold, review, and confirm. The local sample balance changes;
   no actual metal or money moves.
4. Try **Start SIP** and **Gift Gold**. They add local demo history entries but
   do not change holdings, create a payment mandate, contact a recipient, or
   deliver a gift.
5. Open **Activity** to filter by Buy, Sell, Redeem, SIP, or Gift. Tap a row for
   its demo reference and details. **Portfolio** shows the current sample
   holdings and estimated value.
6. On the Android Emulator, press `r` in the Expo terminal (or select Reload
   from the Expo developer menu) to refresh. Demo records and holdings are
   in-memory state and reset after an app reload or demo logout.

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
   expiry, rounding, taxes, fees, rate freshness and currency.
6. Transaction status enum and lifecycle (including pending, failed, rejected,
   settled, cancelled, and reversal states), transaction/reference IDs,
   timestamps, and which statuses permit a customer retry.
7. Standard error schema, field validation error shape, safe customer-facing
   messages, correlation IDs, and expired-session behavior.
8. Pagination and filtering/sorting rules for activity, SIPs, and
   notifications; notification read/unread semantics if available.
9. Quote rules and endpoint sequencing: quote binding/expiry, whether server
   review reserves anything, and the precise payment-provider handoff and
   callback/return verification flow. The app must not treat a client
   calculation or payment redirect as transaction success.
10. Idempotency-key header/body contract, key lifetime, duplicate response
    behavior, and safe recovery for timeouts/unknown outcomes.
11. How admin APIs retrieve the exact same transaction by its authoritative
    transaction ID, permitted admin roles, and consistency/visibility timing.
    The mobile app must never use admin credentials or write to admin APIs.
12. Whether real-time updates are supported (WebSocket, SSE, or push), the
    authentication/reconnect contract, or the approved polling/refresh policy.
13. Product/legal approval for supported metals, cash/physical redemption,
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
