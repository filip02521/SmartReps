-- 033_follow_system.sql
-- Follow system: observe innych użytkowników i widz ich publiczne postępy.
-- Tabela follows + public_profiles (dla publicznych statystyk).

-- ── Public profiles — public stats for followed users ──
create table if not exists public_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  display_name text not null default '' check (char_length(display_name) <= 60),
  bio text not null default '' check (char_length(bio) <= 200),
  is_public boolean not null default false,
  total_sessions int not null default 0,
  total_reps int not null default 0,
  current_streak_weeks int not null default 0,
  best_streak_weeks int not null default 0,
  pushup_max int not null default 0,
  pullup_max int not null default 0,
  updated_at timestamptz not null default now()
);

create index if not exists public_profiles_public_idx
  on public_profiles(is_public, updated_at desc);

-- ── Follows table ──
create table if not exists user_follows (
  follower_id uuid not null references auth.users(id) on delete cascade,
  followee_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followee_id),
  check (follower_id <> followee_id)
);

create index if not exists user_follows_followee_idx
  on user_follows(followee_id, created_at desc);

create index if not exists user_follows_follower_idx
  on user_follows(follower_id, created_at desc);

-- ── RLS ──
alter table public_profiles enable row level security;

-- Public profiles are readable by anyone if is_public = true, or by the owner
create policy public_profiles_select on public_profiles
  for select using (
    is_public = true or user_id = auth.uid()
  );

-- Users can insert/update only their own public profile
create policy public_profiles_insert on public_profiles
  for insert with check (user_id = auth.uid());

create policy public_profiles_update on public_profiles
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

alter table user_follows enable row level security;

-- Follows are public (anyone can see who follows whom)
create policy user_follows_select on user_follows
  for select using (true);

-- Users can insert only their own follows
create policy user_follows_insert on user_follows
  for insert with check (
    follower_id = auth.uid()
    and exists (
      select 1 from public_profiles
      where user_id = followee_id and is_public = true
    )
  );

-- Users can delete only their own follows
create policy user_follows_delete on user_follows
  for delete using (follower_id = auth.uid());

-- ── Updated_at trigger for public_profiles ──
create or replace function public_profiles_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger public_profiles_updated_at
  before update on public_profiles
  for each row execute function public_profiles_set_updated_at();

-- ── Helper: assert authenticated ──
create or replace function follow_assert_authenticated()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where id = auth.uid();
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  return uid;
end;
$$;

-- ── RPC: toggle follow ──
create or replace function toggle_follow(
  p_followee_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := follow_assert_authenticated();
  following boolean;
  follower_count int;
begin
  if p_followee_id = uid then
    raise exception 'cannot_follow_self';
  end if;

  -- Check followee has public profile
  if not exists (
    select 1 from public_profiles where user_id = p_followee_id and is_public = true
  ) then
    raise exception 'user_not_public';
  end if;

  if exists (
    select 1 from user_follows where follower_id = uid and followee_id = p_followee_id
  ) then
    delete from user_follows where follower_id = uid and followee_id = p_followee_id;
    following := false;
  else
    insert into user_follows (follower_id, followee_id) values (uid, p_followee_id);
    following := true;
  end if;

  select count(*) into follower_count
  from user_follows where followee_id = p_followee_id;

  return jsonb_build_object(
    'following', following,
    'follower_count', follower_count
  );
end;
$$;

-- ── RPC: get following list (users I follow) ──
create or replace function get_following(
  p_limit int default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := follow_assert_authenticated();
  result jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'followee_id', f.followee_id,
      'display_name', p.display_name,
      'bio', p.bio,
      'total_sessions', p.total_sessions,
      'total_reps', p.total_reps,
      'current_streak_weeks', p.current_streak_weeks,
      'best_streak_weeks', p.best_streak_weeks,
      'pushup_max', p.pushup_max,
      'pullup_max', p.pullup_max,
      'followed_at', f.created_at
    )
    order by f.created_at desc
  ), '[]'::jsonb) into result
  from user_follows f
  join public_profiles p on p.user_id = f.followee_id
  where f.follower_id = uid
  limit p_limit;

  return result;
end;
$$;

-- ── RPC: get followers list (users following me) ──
create or replace function get_followers(
  p_limit int default 50
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := follow_assert_authenticated();
  result jsonb;
begin
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'follower_id', f.follower_id,
      'followed_at', f.created_at
    )
    order by f.created_at desc
  ), '[]'::jsonb) into result
  from user_follows f
  where f.followee_id = uid
  limit p_limit;

  return result;
end;
$$;

-- ── RPC: upsert my public profile ──
create or replace function upsert_my_public_profile(
  p_display_name text default '',
  p_bio text default '',
  p_is_public boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := follow_assert_authenticated();
  profile_row public_profiles%rowtype;
begin
  if char_length(p_display_name) > 60 then
    raise exception 'display_name_too_long';
  end if;
  if char_length(p_bio) > 200 then
    raise exception 'bio_too_long';
  end if;

  insert into public_profiles (user_id, display_name, bio, is_public)
  values (uid, p_display_name, p_bio, p_is_public)
  on conflict (user_id)
  do update set
    display_name = excluded.display_name,
    bio = excluded.bio,
    is_public = excluded.is_public,
    updated_at = now()
  returning * into profile_row;

  return jsonb_build_object(
    'user_id', profile_row.user_id,
    'display_name', profile_row.display_name,
    'bio', profile_row.bio,
    'is_public', profile_row.is_public,
    'updated_at', profile_row.updated_at
  );
end;
$$;

-- ── RPC: get my public profile ──
create or replace function get_my_public_profile()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := follow_assert_authenticated();
  profile_row public_profiles%rowtype;
begin
  select * into profile_row from public_profiles where user_id = uid;
  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'user_id', profile_row.user_id,
    'display_name', profile_row.display_name,
    'bio', profile_row.bio,
    'is_public', profile_row.is_public,
    'total_sessions', profile_row.total_sessions,
    'total_reps', profile_row.total_reps,
    'current_streak_weeks', profile_row.current_streak_weeks,
    'best_streak_weeks', profile_row.best_streak_weeks,
    'pushup_max', profile_row.pushup_max,
    'pullup_max', profile_row.pullup_max,
    'updated_at', profile_row.updated_at
  );
end;
$$;

-- ── RPC: get public profile by user id ──
create or replace function get_public_profile(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  profile_row public_profiles%rowtype;
  is_following boolean;
  uid uuid;
begin
  select * into profile_row from public_profiles where user_id = p_user_id;
  if not found or not profile_row.is_public then
    if p_user_id <> auth.uid() then
      raise exception 'profile_not_public';
    end if;
  end if;

  -- Check if current user is following
  select id into uid from auth.users where id = auth.uid();
  is_following := false;
  if uid is not null and uid <> p_user_id then
    select exists(
      select 1 from user_follows where follower_id = uid and followee_id = p_user_id
    ) into is_following;
  end if;

  return jsonb_build_object(
    'user_id', profile_row.user_id,
    'display_name', profile_row.display_name,
    'bio', profile_row.bio,
    'is_public', profile_row.is_public,
    'total_sessions', profile_row.total_sessions,
    'total_reps', profile_row.total_reps,
    'current_streak_weeks', profile_row.current_streak_weeks,
    'best_streak_weeks', profile_row.best_streak_weeks,
    'pushup_max', profile_row.pushup_max,
    'pullup_max', profile_row.pullup_max,
    'is_following', is_following
  );
end;
$$;

-- ── RPC: get follower + following counts ──
create or replace function get_follow_counts(
  p_user_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  followers int;
  following int;
begin
  select count(*) into followers from user_follows where followee_id = p_user_id;
  select count(*) into following from user_follows where follower_id = p_user_id;

  return jsonb_build_object(
    'followers', followers,
    'following', following
  );
end;
$$;
