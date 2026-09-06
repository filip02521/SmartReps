-- 035_publish_requires_public_profile.sql
-- Enforce that a user must have a public profile (is_public = true) to publish community plans.
-- This is a CREATE OR REPLACE of publish_community_plan from 017, with the public profile check ADDED.
-- All original 017 validations are preserved (slug, snapshot, display_name, tags, rate limit, etc).

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
  profile_is_public boolean;
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

  -- Require public profile to publish
  select is_public into profile_is_public
  from public_profiles where user_id = uid;

  if profile_is_public is null or profile_is_public = false then
    raise exception 'public_profile_required';
  end if;

  -- Rate limit: max 5 publications per 24 hours
  select count(*) into write_count
  from community_publications
  where author_id = uid
    and last_publish_write_at > now() - interval '24 hours';
  if write_count >= 5 then
    raise exception 'rate_limited';
  end if;

  -- Lock existing row to prevent race conditions
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

  -- Sync display name to profiles table
  update profiles
    set display_name = trim(p_author_display_name)
    where id = uid
      and (display_name is distinct from trim(p_author_display_name));

  return result;
end;
$$;
