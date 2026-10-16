# Security, audit, and operational requirements

These requirements apply to future implementation; the current scaffold does not yet implement them.

## Security and access

- HTTPS for all API traffic. No provider or API secrets in mobile/web bundles.
- OTP protection, short-lived access tokens, refresh/session controls, rate limits, and brute-force protection.
- Server-side role-based authorization and least privilege for support, operations, finance, rate manager, and super admin.
- Maker-checker approval for rate changes, refunds, manual ledger adjustments, and other configured high-risk actions.
- Validate all input and provider callback signatures on the server. Use idempotency keys and durable callback/event records to prevent duplicate orders, payments, and ledger postings.
- Encrypt sensitive data in transit and at rest; minimize collection and define access, retention, deletion, and incident policies.

## Financial integrity

- Keep order state transitions and metal/payment ledger events auditable and append-only.
- Never credit metal solely because a client reports payment success. Require verified gateway and bullion/custody provider events.
- Maintain explicit quote expiry, price source/time, charges, tax, cancellation, refund, payout, and retry rules.
- Run daily gateway/provider settlement and metal-ledger reconciliation; route mismatches and stale pending items to an exception queue.

## Operations

- Monitor provider feeds, stale rates, callbacks, job queues, scheduled SIP installments, payment settlement, delivery, and reconciliation.
- Maintain backups, tested restore and disaster-recovery procedures, alerting, support runbooks, and end-of-day sign-off.
- Keep reports role-restricted and filterable by date, metal, order type, and status.
- Obtain qualified legal/compliance advice and validate KYC/AML, privacy, tax, and consumer-disclosure requirements for the chosen operating model and jurisdiction before launch.
