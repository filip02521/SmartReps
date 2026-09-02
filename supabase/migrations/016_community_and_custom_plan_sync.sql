-- Community plan catalog + custom_plans sync fields (deload, community provenance, source=community)

-- ---------------------------------------------------------------------------
-- Private custom_plans: source, deload, community_publication_id
-- ---------------------------------------------------------------------------
alter table custom_plans drop constraint if exists custom_plans_source_check;
alter table custom_plans
  add constraint custom_plans_source_check
  check (source in ('user', 'duplicate', 'import', 'community'));

alter table custom_plans
  add column if not exists deload_json jsonb,
  add column if not exists community_publication_id uuid;

create index if not exists custom_plans_community_publication_id
  on custom_plans (community_publication_id)
  where community_publication_id is not null;

-- ---------------------------------------------------------------------------
-- Community publications
-- ---------------------------------------------------------------------------
create table if not exists community_publications (
  id uuid primary key default gen_random_uuid(),
  author_id uuid not null references auth.users(id) on delete cascade,
  source_custom_plan_id uuid not null,
  slug text not null,
  title text not null check (char_length(title) >= 1 and char_length(title) <= 80),
  description text not null default '' check (char_length(description) <= 1500),
  tags text[] not null default '{}',
  snapshot_json jsonb not null,
  author_display_name text not null check (char_length(trim(author_display_name)) >= 1),
  like_count int not null default 0 check (like_count >= 0),
  import_count int not null default 0 check (import_count >= 0),
  content_version int not null default 1 check (content_version >= 1),
  status text not null default 'published'
    check (status in ('published', 'unpublished', 'hidden', 'removed')),
  published_at timestamptz,
  first_published_at timestamptz,
  updated_at timestamptz not null default now(),
  unique (author_id, source_custom_plan_id),
  unique (slug),
  constraint community_publications_tags_subset check (
    tags <@ array['home', 'gym', 'bodyweight', 'weights', 'short_cycle', 'long_cycle']::text[]
  ),
  constraint community_publications_tags_max check (cardinality(tags) <= 3)
);

create index if not exists community_publications_published_popular
  on community_publications (like_count desc, published_at desc)
  where status = 'published';

create index if not exists community_publications_published_newest
  on community_publications (published_at desc)
  where status = 'published';

create index if not exists community_publications_author
  on community_publications (author_id, updated_at desc);

alter table community_publications enable row level security;

create policy community_publications_select on community_publications
  for select using (
    status = 'published'
    or author_id = auth.uid()
  );

revoke insert, update, delete on community_publications from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Likes
-- ---------------------------------------------------------------------------
create table if not exists community_likes (
  publication_id uuid not null references community_publications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (publication_id, user_id)
);

alter table community_likes enable row level security;

create policy community_likes_select_own on community_likes
  for select using (user_id = auth.uid());

revoke insert, update, delete on community_likes from anon, authenticated;

create or replace function community_likes_adjust_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update community_publications
      set like_count = like_count + 1, updated_at = now()
      where id = new.publication_id;
    return new;
  elsif tg_op = 'DELETE' then
    update community_publications
      set like_count = greatest(0, like_count - 1), updated_at = now()
      where id = old.publication_id;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists community_likes_count_trg on community_likes;
create trigger community_likes_count_trg
  after insert or delete on community_likes
  for each row execute function community_likes_adjust_count();

-- ---------------------------------------------------------------------------
-- Imports
-- ---------------------------------------------------------------------------
create table if not exists community_imports (
  publication_id uuid not null references community_publications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  imported_at timestamptz not null default now(),
  primary key (publication_id, user_id)
);

alter table community_imports enable row level security;

create policy community_imports_select_own on community_imports
  for select using (user_id = auth.uid());

revoke insert, update, delete on community_imports from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Reports
-- ---------------------------------------------------------------------------
create table if not exists community_reports (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references community_publications(id) on delete cascade,
  reporter_id uuid not null references auth.users(id) on delete cascade,
  reason text not null check (reason in ('spam', 'unsafe', 'other')),
  status text not null default 'open' check (status in ('open', 'closed')),
  created_at timestamptz not null default now(),
  unique (publication_id, reporter_id)
);

alter table community_reports enable row level security;

create policy community_reports_select_own on community_reports
  for select using (reporter_id = auth.uid());

revoke insert, update, delete on community_reports from anon, authenticated;

-- ---------------------------------------------------------------------------
-- Helpers
-- ---------------------------------------------------------------------------
create or replace function community_assert_authenticated()
returns uuid
language plpgsql
stable
as $$
declare
  uid uuid := auth.uid();
begin
  if uid is null then
    raise exception 'not_authenticated';
  end if;
  return uid;
end;
$$;

-- ---------------------------------------------------------------------------
-- RPC: publish (upsert by author + source plan)
-- ---------------------------------------------------------------------------
create or replace function publish_community_plan(
  p_source_custom_plan_id uuid,
  p_title text,
  p_description text,
  p_tags text[],
  p_snapshot_json jsonb,
  p_slug text,
  p_author_display_name text
)
returns community_publications
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := community_assert_authenticated();
  existing community_publications%rowtype;
  result community_publications%rowtype;
  write_count int;
  tags_norm text[] := coalesce(p_tags, '{}');
  snap_bytes int;
begin
  if p_source_custom_plan_id is null then
    raise exception 'invalid_source';
  end if;
  if char_length(trim(coalesce(p_title, ''))) < 1 or char_length(p_title) > 80 then
    raise exception 'invalid_title';
  end if;
  if char_length(coalesce(p_description, '')) > 1500 then
    raise exception 'invalid_description';
  end if;
  if char_length(trim(coalesce(p_author_display_name, ''))) < 1 then
    raise exception 'invalid_display_name';
  end if;
  if char_length(trim(coalesce(p_slug, ''))) < 3 or char_length(p_slug) > 120 then
    raise exception 'invalid_slug';
  end if;
  if cardinality(tags_norm) > 3 then
    raise exception 'too_many_tags';
  end if;
  if not (tags_norm <@ array['home', 'gym', 'bodyweight', 'weights', 'short_cycle', 'long_cycle']::text[]) then
    raise exception 'invalid_tags';
  end if;
  if p_snapshot_json is null or jsonb_typeof(p_snapshot_json) <> 'object' then
    raise exception 'invalid_snapshot';
  end if;
  snap_bytes := octet_length(p_snapshot_json::text);
  if snap_bytes > 524288 then
    raise exception 'snapshot_too_large';
  end if;

  select count(*) into write_count
  from community_publications
  where author_id = uid
    and updated_at > now() - interval '24 hours';
  if write_count >= 5 then
    raise exception 'rate_limited';
  end if;

  select * into existing
  from community_publications
  where author_id = uid and source_custom_plan_id = p_source_custom_plan_id
  for update;

  if found then
    update community_publications set
      title = trim(p_title),
      description = coalesce(p_description, ''),
      tags = tags_norm,
      snapshot_json = p_snapshot_json,
      author_display_name = trim(p_author_display_name),
      content_version = content_version + 1,
      status = 'published',
      published_at = now(),
      first_published_at = coalesce(first_published_at, now()),
      updated_at = now()
    where id = existing.id
    returning * into result;
  else
    insert into community_publications (
      author_id,
      source_custom_plan_id,
      slug,
      title,
      description,
      tags,
      snapshot_json,
      author_display_name,
      status,
      published_at,
      first_published_at,
      updated_at
    ) values (
      uid,
      p_source_custom_plan_id,
      lower(trim(p_slug)),
      trim(p_title),
      coalesce(p_description, ''),
      tags_norm,
      p_snapshot_json,
      trim(p_author_display_name),
      'published',
      now(),
      now(),
      now()
    )
    returning * into result;
  end if;

  update profiles
    set display_name = trim(p_author_display_name)
    where id = uid
      and (display_name is distinct from trim(p_author_display_name));

  return result;
end;
$$;

revoke all on function publish_community_plan(uuid, text, text, text[], jsonb, text, text) from public;
grant execute on function publish_community_plan(uuid, text, text, text[], jsonb, text, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: unpublish
-- ---------------------------------------------------------------------------
create or replace function unpublish_community_plan(p_publication_id uuid)
returns community_publications
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := community_assert_authenticated();
  result community_publications%rowtype;
begin
  update community_publications
    set status = 'unpublished', updated_at = now()
    where id = p_publication_id
      and author_id = uid
      and status in ('published', 'unpublished')
  returning * into result;

  if not found then
    raise exception 'not_found';
  end if;
  return result;
end;
$$;

revoke all on function unpublish_community_plan(uuid) from public;
grant execute on function unpublish_community_plan(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: toggle like
-- ---------------------------------------------------------------------------
create or replace function toggle_community_like(p_publication_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := community_assert_authenticated();
  pub community_publications%rowtype;
  liked boolean;
begin
  select * into pub from community_publications where id = p_publication_id;
  if not found or pub.status <> 'published' then
    raise exception 'not_found';
  end if;
  if pub.author_id = uid then
    raise exception 'self_like_forbidden';
  end if;

  if exists (
    select 1 from community_likes where publication_id = p_publication_id and user_id = uid
  ) then
    delete from community_likes where publication_id = p_publication_id and user_id = uid;
    liked := false;
  else
    insert into community_likes (publication_id, user_id) values (p_publication_id, uid);
    liked := true;
  end if;

  select like_count into pub.like_count from community_publications where id = p_publication_id;
  return jsonb_build_object('liked', liked, 'like_count', pub.like_count);
end;
$$;

revoke all on function toggle_community_like(uuid) from public;
grant execute on function toggle_community_like(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: record import
-- ---------------------------------------------------------------------------
create or replace function record_community_import(p_publication_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := community_assert_authenticated();
  pub community_publications%rowtype;
  did_insert boolean := false;
begin
  select * into pub from community_publications where id = p_publication_id;
  if not found or pub.status <> 'published' then
    raise exception 'not_found';
  end if;

  insert into community_imports (publication_id, user_id)
  values (p_publication_id, uid)
  on conflict do nothing
  returning true into did_insert;

  if coalesce(did_insert, false) and pub.author_id <> uid then
    update community_publications
      set import_count = import_count + 1, updated_at = now()
      where id = p_publication_id;
  end if;

  select import_count into pub.import_count from community_publications where id = p_publication_id;
  return jsonb_build_object('import_count', pub.import_count);
end;
$$;

revoke all on function record_community_import(uuid) from public;
grant execute on function record_community_import(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: report
-- ---------------------------------------------------------------------------
create or replace function report_community_publication(
  p_publication_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := community_assert_authenticated();
  pub community_publications%rowtype;
  recent int;
begin
  if p_reason not in ('spam', 'unsafe', 'other') then
    raise exception 'invalid_reason';
  end if;

  select * into pub from community_publications where id = p_publication_id;
  if not found or pub.status <> 'published' then
    raise exception 'not_found';
  end if;

  select count(*) into recent
  from community_reports
  where reporter_id = uid and created_at > now() - interval '24 hours';
  if recent >= 10 then
    raise exception 'rate_limited';
  end if;

  insert into community_reports (publication_id, reporter_id, reason)
  values (p_publication_id, uid, p_reason)
  on conflict (publication_id, reporter_id) do update
    set reason = excluded.reason, status = 'open';

  return jsonb_build_object('ok', true);
end;
$$;

revoke all on function report_community_publication(uuid, text) from public;
grant execute on function report_community_publication(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- RPC: refresh author display name on all publications
-- ---------------------------------------------------------------------------
create or replace function refresh_community_author_display_name(p_display_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := community_assert_authenticated();
  name text := trim(coalesce(p_display_name, ''));
begin
  if char_length(name) < 1 then
    raise exception 'invalid_display_name';
  end if;

  update profiles set display_name = name where id = uid;

  update community_publications
    set author_display_name = name, updated_at = now()
    where author_id = uid;
end;
$$;

revoke all on function refresh_community_author_display_name(text) from public;
grant execute on function refresh_community_author_display_name(text) to authenticated;

grant select on community_publications to anon, authenticated;
grant select on community_likes to authenticated;
grant select on community_imports to authenticated;
grant select on community_reports to authenticated;
