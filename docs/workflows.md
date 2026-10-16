# Core workflows

These are planning-level flows, not implemented routes or guarantees. Confirm the operating model, provider contracts, fees, and policies before building production behavior.

## Customer app

- **Register/login:** authenticate with phone/email and OTP, capture consent, create profile, complete required KYC/identity checks, and manage sessions/devices.
- **Dashboard and rates:** show gold/silver rate with source and timestamp, rate validity, portfolio/holdings, recent transactions, and notices. Indicative rates must not be shown as guaranteed execution prices.
- **Buy:** check eligibility; obtain current approved rate; calculate indicative quantity, fees, and taxes; issue expiring quote; collect payment; validate signed/idempotent payment callback; obtain bullion/custody provider confirmation; then post an immutable ledger credit and receipt. Failed/expired payment must not credit metal. Pending provider confirmation remains pending and is reconciled; retries must not create duplicates.
- **Sell:** validate available unreserved balance; quote price/fees; reserve quantity; obtain provider execution and payout confirmation; post ledger debit only according to confirmed events; release or retain reservation per explicit failure policy.
- **Redeem physical metal:** check product, eligible quantity, minimums and serviceable location; calculate charges/tax; accept terms and payment where applicable; reserve metal; fulfill via provider; track shipment and proof of delivery; close or resolve exception under defined cancellation/refund rules.
- **SIP:** capture schedule and mandate/standing instruction; schedule each installment, track payment and purchase independently, apply configured retry rules, and stop future installments on pause/cancel without silently reversing completed purchases.
- **Gift:** take sender, recipient, metal, quantity, and message; collect payment; notify recipient; apply recipient verification and claim/expiry/refund policies.
- **History/profile/support:** expose transaction receipts and statements, profile/KYC state, consent, FAQs, tickets, terms, privacy information, and service notifications.

## Operations/admin

- Role-authorized dashboard and customer search.
- Rate feed monitoring and maker-checker approval before publishing manual or changed rates.
- Order, payment, redemption, SIP, gift, and exception queues with immutable history.
- Finance settlement, payout, provider/metal ledger matching, mismatch review, and sign-off.
- Role/permission and limit management, configuration, audit history, and operational exports.

## Order lifecycle

Preserve each transition as an event; do not overwrite the sole evidence of earlier states. The planning statuses include:

`Draft → QuoteGenerated → AwaitingPayment → PaymentPending → PaymentConfirmed → ProviderPending → Completed`

Exceptional states include `QuoteExpired`, `PaymentFailed`, `ProviderFailed`, `Cancelled`, `RefundPending`, `Refunded`, `PayoutPending`, `PayoutFailed`, and `ReconciliationRequired`. Define permitted transitions and recovery policies before implementation.
