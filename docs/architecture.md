# High-level architecture

## Applications

- **Customer app (`apps/mobile`)** — Android-first React Native/Expo client for registration, verification, rates, buying/selling, holdings, redemption, SIPs, gifts, notifications, receipts, and support.
- **Operations panel (`apps/web`)** — React web client for role-restricted customer support, order/redeemption operations, rate approval, finance/reconciliation, reporting, configuration, and audit review.
- **API (`apps/api`)** — Node.js/Express service. It is the trust boundary for authentication, authorization, validation, business rules, provider callbacks, ledger writes, and audit records.

## Logical components

```text
Customer mobile app ─┐
                     ├── HTTPS API ── domain services ── persistence/ledger
Admin web panel ─────┘                    │
                                          ├── payment gateway
                                          ├── bullion/custody provider
                                          ├── rate and KYC providers
                                          └── SMS/email/push, payout, delivery
```

Provider adapters belong behind API integration boundaries. Credentials and signing keys are server-side secrets; clients must never receive them. Persist external references and provider events needed for idempotency and reconciliation.

## Domain boundaries

Keep user identity and verification, product/rate/quote, orders, payment, metal ledger, SIP, redemption/delivery, gifts, notifications/support, reporting/reconciliation, access control, settings, and audit concerns in separate API modules. A payment confirmation is not itself proof that bullion execution completed; represent those events and status transitions independently.

## Deployment and data choices

Hosting, database engine, queue/scheduler, and provider selections are open decisions. Choose them only after the operating model and regulated partner contracts are known. This scaffold does not imply custody, execution, pricing, or regulatory approval.
