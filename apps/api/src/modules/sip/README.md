# SIP and recurring purchases

The admin console keeps its existing SIP contribution plans in `customer_sip_plans`. Customer-facing schemes and enrollments use the separate `sip_schemes`, `customer_sip_enrollments`, and `customer_sip_enrollment_installments` tables.

Apply `apps/api/src/modules/admin-console/migrations/011-sip-schemes-and-customer-enrollments.sql` and `012-customer-sip-plan-terms.sql` to existing databases; fresh databases receive these tables and columns from `schema.sql`. Scheme management is Super Admin-only. Customer enrollment requires an authenticated customer, approved KYC, an active scheme, and acceptance of the non-refundable SIP terms.

Customer mobile SIP browsing includes both active configured schemes and unassigned active SIP plans created in SIP Management. Enrolling in a configured scheme persists a schedule snapshot, installment charges, taxes on charges, and due dates so later scheme edits do not change existing customer history. Enrolling in an Admin-created plan atomically assigns its existing schedule to the authenticated customer and records terms acceptance on that plan. Pausing or cancelling existing SIP plans must not silently reverse completed purchases.
