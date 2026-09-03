-- Body weight tracking — user-entered weight entries with optional note.
-- Synced offline-first via the same pull/push flow as max_tests.

create table if not exists body_weight_entries (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles not null,
  weight_kg numeric not null check (weight_kg > 0),
  measured_at timestamptz not null,
  note text,
  created_at timestamptz default now()
);

-- One entry per user per measured_at timestamp (prevents duplicates on re-sync).
create unique index if not exists body_weight_entries_user_measured_unique
  on body_weight_entries (user_id, measured_at);

alter table body_weight_entries enable row level security;

create policy "body_weight_own" on body_weight_entries
  for all using (auth.uid() = user_id);
