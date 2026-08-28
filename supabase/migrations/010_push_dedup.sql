-- Smart push dedup: at most one reminder push per calendar day (user timezone).

alter table push_subscriptions
  add column if not exists last_push_date date;

comment on column push_subscriptions.last_push_date is
  'Local calendar date (user timezone) when the last workout reminder push was sent';
