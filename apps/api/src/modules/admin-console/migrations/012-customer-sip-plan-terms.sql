ALTER TABLE customer_sip_plans
  ADD COLUMN customer_terms_accepted_at DATETIME NULL AFTER next_due_date;
