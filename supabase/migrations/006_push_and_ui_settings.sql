-- UI prefs LWW + Web Push subscriptions

alter table profiles
  add column if not exists timer_sound boolean not null default true,
  add column if not exists timer_vibration boolean not null default true,
  add column if not exists keep_screen_on boolean not null default true,
  add column if not exists reminder_hour int not null default 18,
  add column if not exists ui_settings_updated_at timestamptz not null default now();

alter table profiles
  drop constraint if exists profiles_reminder_hour_valid;

alter table profiles
  add constraint profiles_reminder_hour_valid
  check (reminder_hour >= 0 and reminder_hour <= 23);

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references profiles(id) on delete cascade,
  endpoint text not null,
  p256dh text not null,
  auth text not null,
  user_agent text,
  reminder_hour int not null default 18,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, endpoint)
);

alter table push_subscriptions enable row level security;

drop policy if exists "push_subscriptions_own" on push_subscriptions;
create policy "push_subscriptions_own" on push_subscriptions
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create index if not exists push_subscriptions_user_id_idx on push_subscriptions (user_id);
create index if not exists push_subscriptions_reminder_hour_idx on push_subscriptions (reminder_hour);
