# Suggested data entities

Planning-level entity inventory from the supplied scope. This is not a database migration or final schema. Select the database, retention policy, and accounting model before translating this into tables.

| Entity | Purpose / example fields |
| --- | --- |
| Users | user ID, name, phone/email, account status, created date |
| UserVerification | user, provider reference, verification type/status, timestamps |
| MetalProducts | metal, purity, product type, minimum buy/sell/redeem quantities, active flag |
| MetalRates | metal/product, buy and sell rates, currency, source, effective time, approval status |
| Quotes | user, rate snapshot, amount, quantity, charges, expiry, status |
| Orders | user, type, quote, quantity, gross/net amount, status, provider reference |
| PaymentTransactions | order, gateway reference, amount/status, callback reference, refund reference |
| MetalLedger | user, order, credit/debit/reserve/release, quantity, event time, immutable reference |
| SIPInstructions | user, amount, frequency, mandate reference, next run, status |
| RedemptionOrders | user, product, quantity, address reference, charges, shipment/delivery status |
| GiftOrders | sender, recipient reference, product/quantity, claim status, expiry |
| Notifications | user, channel, template, delivery status, provider reference |
| AuditLogs | actor, role, action, entity, before/after summary, time, correlation ID |
| ReconciliationRecords | provider/gateway reference, internal reference, expected/actual amount or quantity, status, reviewer |

Avoid storing unnecessary identity/payment data. Treat a ledger as append-only; never adjust balances by editing past ledger entries. Record corrective adjustments as new, authorized, attributable events.
