-- Fix community impact staleness: only count currently-published plans
-- and reject trained records for unpublished/removed plans.

-- ---------------------------------------------------------------------------
-- get_community_author_impact: filter by status = 'published'
-- ---------------------------------------------------------------------------
create or replace function get_community_author_impact()
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := community_assert_authenticated();
  like_total int := 0;
  import_total int := 0;
  trained_total int := 0;
  published_count int := 0;
  best_imports int := 0;
  best_trained int := 0;
begin
  -- Only count currently-published plans — unpublished/hidden/removed
  -- should not contribute to achievement metrics.
  select
    coalesce(sum(like_count), 0)::int,
    coalesce(sum(import_count), 0)::int,
    coalesce(sum(trained_count), 0)::int
  into like_total, import_total, trained_total
  from community_publications
  where author_id = uid
    and status = 'published';

  -- Same publication for plan_with_legs (import≥5 ∧ trained≥1), not maxes from different rows
  select coalesce(import_count, 0), coalesce(trained_count, 0)
    into best_imports, best_trained
    from community_publications
   where author_id = uid
     and status = 'published'
   order by
     (case when import_count >= 5 and trained_count >= 1 then 1 else 0 end) desc,
     import_count desc,
     trained_count desc
   limit 1;

  select count(*)::int into published_count
    from community_publications
   where author_id = uid
     and status = 'published';

  return jsonb_build_object(
    'like_total', like_total,
    'import_total', import_total,
    'trained_total', trained_total,
    'published_count', published_count,
    'best_plan_imports', coalesce(best_imports, 0),
    'best_plan_trained', coalesce(best_trained, 0)
  );
end;
$$;

revoke all on function get_community_author_impact() from public, anon;
grant execute on function get_community_author_impact() to authenticated;

-- ---------------------------------------------------------------------------
-- record_community_trained: reject unpublished/hidden/removed plans
-- ---------------------------------------------------------------------------
create or replace function record_community_trained(p_publication_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := community_assert_authenticated();
  pub community_publications%rowtype;
  imp community_imports%rowtype;
  counted boolean := false;
begin
  select * into pub from community_publications where id = p_publication_id;
  if not found then
    raise exception 'publication_not_found';
  end if;
  if pub.author_id = uid then
    raise exception 'self_train_forbidden';
  end if;
  -- Reject training records for non-published plans
  if pub.status != 'published' then
    raise exception 'publication_not_published';
  end if;

  select * into imp
    from community_imports
   where publication_id = p_publication_id
     and user_id = uid;

  if not found then
    -- Allow train record only after import row exists
    raise exception 'import_required';
  end if;

  if imp.first_trained_at is null then
    update community_imports
       set first_trained_at = now()
     where publication_id = p_publication_id
       and user_id = uid;
    update community_publications
       set trained_count = trained_count + 1
     where id = p_publication_id;
    counted := true;
  end if;

  select trained_count into pub.trained_count from community_publications where id = p_publication_id;
  return jsonb_build_object('trained_count', pub.trained_count, 'counted', counted);
end;
$$;

revoke all on function record_community_trained(uuid) from public, anon;
grant execute on function record_community_trained(uuid) to authenticated;
