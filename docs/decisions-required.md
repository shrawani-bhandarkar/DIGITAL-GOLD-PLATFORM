# Decisions required before implementation

The planning document intentionally leaves these decisions open. Confirm them with the product, finance, legal/compliance, and provider owners before implementing production behavior.

- Which bullion/custody provider holds metal, confirms buy/sell execution, and owns customer holding records?
- Is physical redemption in the launch scope? Which products, minimum quantities, serviceable locations, delivery partner, charges/taxes, cancellation, and refund rules apply?
- Which payment gateway and payout method are used? Are recurring mandates supported? What are callback, settlement, refund, and retry policies?
- What KYC/AML, identity verification, consent, privacy, and complaint-handling obligations apply to the selected operating model and jurisdiction?
- How are buy/sell rates calculated and refreshed? Which source, spread/markup, quote validity, stale-rate threshold, and approval policy apply?
- What fees/taxes apply to buy, sell, redemption, payment, and refunds? What are unclaimed-gift expiry and SIP failed-installment retry rules?
- Which platforms are required at launch (Android, iOS, web), and which roles may operate/support each workflow?
- Who owns customer support, provider exception resolution, daily reconciliation, and end-of-day sign-off?
- Which database, hosting, queue/scheduler, monitoring, backup, and disaster-recovery targets are approved?

Until resolved, do not present indicative prices as guaranteed execution prices or claim that a provider holds metal on behalf of customers.
