-- 058: Allow 'starter' as custom_plans.source value
-- Starter templates are first-party bundled plans materialized as user CustomPlans.
-- They are NOT community publications (no community_publication_id, no record_community_import).

alter table custom_plans drop constraint if exists custom_plans_source_check;
alter table custom_plans
  add constraint custom_plans_source_check
  check (source in ('user', 'duplicate', 'import', 'community', 'starter'));
