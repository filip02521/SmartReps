-- Community workflow fixes: rate limit, counters, grants, snapshot checks

-- ---------------------------------------------------------------------------
-- Track real publish writes separately from like/import bumps
-- ---------------------------------------------------------------------------
alter table community_publications
  add column if not exists last_publish_write_at timestamptz;

update community_publications
set last_publish_write_at = coalesce(published_at, updated_at, now())
where last_publish_write_at is null;

-- Likes must not poison publish rate-limit via updated_at
create or replace function community_likes_adjust_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'INSERT' then
    update community_publications
      set like_count = like_count + 1
      where id = new.publication_id;
    return new;
  elsif tg_op = 'DELETE' then
    update community_publications
      set like_count = greatest(0, like_count - 1)
      where id = old.publication_id;
    return old;
  end if;
  return null;
end;
$$;

-- Mirror likes: decrement import_count when an import row is removed
create or replace function community_imports_adjust_count()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  author uuid;
begin
  if tg_op = 'DELETE' then
    select author_id into author from community_publications where id = old.publication_id;
    if found and author is distinct from old.user_id then
      update community_publications
        set import_count = greatest(0, import_count - 1)
        where id = old.publication_id;
    end if;
    return old;
  end if;
  return null;
end;
$$;

drop trigger if exists community_imports_count_trg on community_imports;
create trigger community_imports_count_trg
  after delete on community_imports
  for each row execute function community_imports_adjust_count();

-- Auth helper: pin search_path
create or replace function community_assert_authenticated()
returns uuid
language plpgsql
stable
security invoker
set search_path = public
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
-- Publish: rate limit on last_publish_write_at + light snapshot validation
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
  if coalesce((p_snapshot_json->>'schemaVersion')::int, 0) <> 1 then
    raise exception 'invalid_snapshot';
  end if;
  if jsonb_typeof(p_snapshot_json->'days') <> 'array'
     or jsonb_array_length(p_snapshot_json->'days') < 1 then
    raise exception 'invalid_snapshot';
  end if;
  if jsonb_typeof(p_snapshot_json->'exercises') <> 'array'
     or jsonb_array_length(p_snapshot_json->'exercises') < 1 then
    raise exception 'invalid_snapshot';
  end if;
  snap_bytes := octet_length(p_snapshot_json::text);
  if snap_bytes > 524288 then
    raise exception 'snapshot_too_large';
  end if;

  select count(*) into write_count
  from community_publications
  where author_id = uid
    and last_publish_write_at > now() - interval '24 hours';
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
      last_publish_write_at = now(),
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
      last_publish_write_at,
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

-- Import: do not bump updated_at (keeps publish rate-limit clean)
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
      set import_count = import_count + 1
      where id = p_publication_id;
  end if;

  select import_count into pub.import_count from community_publications where id = p_publication_id;
  return jsonb_build_object(
    'import_count', pub.import_count,
    'counted', coalesce(did_insert, false) and pub.author_id <> uid
  );
end;
$$;

-- Report: block self-report
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
  if pub.author_id = uid then
    raise exception 'self_report_forbidden';
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

-- Display name refresh: update author_display_name without touching updated_at
create or replace function refresh_community_author_display_name(p_display_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := community_assert_authenticated();
  name text := trim(p_display_name);
begin
  if char_length(name) < 1 then
    raise exception 'invalid_display_name';
  end if;

  update profiles set display_name = name where id = uid;

  update community_publications
    set author_display_name = name
    where author_id = uid
      and author_display_name is distinct from name;
end;
$$;

-- Harden grants: authenticated only; never expose trigger helpers as RPC
revoke all on function community_likes_adjust_count() from public, anon, authenticated;
revoke all on function community_imports_adjust_count() from public, anon, authenticated;

revoke all on function publish_community_plan(uuid, text, text, text[], jsonb, text, text) from public, anon;
grant execute on function publish_community_plan(uuid, text, text, text[], jsonb, text, text) to authenticated;

revoke all on function unpublish_community_plan(uuid) from public, anon;
grant execute on function unpublish_community_plan(uuid) to authenticated;

revoke all on function toggle_community_like(uuid) from public, anon;
grant execute on function toggle_community_like(uuid) to authenticated;

revoke all on function record_community_import(uuid) from public, anon;
grant execute on function record_community_import(uuid) to authenticated;

revoke all on function report_community_publication(uuid, text) from public, anon;
grant execute on function report_community_publication(uuid, text) to authenticated;

revoke all on function refresh_community_author_display_name(text) from public, anon;
grant execute on function refresh_community_author_display_name(text) to authenticated;
