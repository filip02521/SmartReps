-- User achievements + community trained_count

-- ---------------------------------------------------------------------------
-- user_achievements (private collection, sync)
-- ---------------------------------------------------------------------------
create table if not exists user_achievements (
  user_id uuid not null references auth.users (id) on delete cascade,
  achievement_id text not null,
  unlocked_at timestamptz not null default now(),
  seen_at timestamptz,
  primary key (user_id, achievement_id)
);

create index if not exists user_achievements_user_unlocked
  on user_achievements (user_id, unlocked_at desc);

alter table user_achievements enable row level security;

create policy user_achievements_select on user_achievements
  for select to authenticated
  using (auth.uid() = user_id);

create policy user_achievements_upsert on user_achievements
  for insert to authenticated
  with check (auth.uid() = user_id);

create policy user_achievements_update on user_achievements
  for update to authenticated
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy user_achievements_delete on user_achievements
  for delete to authenticated
  using (auth.uid() = user_id);

revoke all on user_achievements from anon;
grant select, insert, update, delete on user_achievements to authenticated;

-- ---------------------------------------------------------------------------
-- trained_count on publications + import training flag
-- ---------------------------------------------------------------------------
alter table community_publications
  add column if not exists trained_count int not null default 0;

alter table community_imports
  add column if not exists first_trained_at timestamptz;

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
  select
    coalesce(sum(like_count), 0)::int,
    coalesce(sum(import_count), 0)::int,
    coalesce(sum(trained_count), 0)::int
  into like_total, import_total, trained_total
  from community_publications
  where author_id = uid;

  -- Same publication for plan_with_legs (import≥5 ∧ trained≥1), not maxes from different rows
  select coalesce(import_count, 0), coalesce(trained_count, 0)
    into best_imports, best_trained
    from community_publications
   where author_id = uid
   order by
     (case when import_count >= 5 and trained_count >= 1 then 1 else 0 end) desc,
     import_count desc,
     trained_count desc
   limit 1;

  select count(*)::int into published_count
    from community_publications
   where author_id = uid
     and first_published_at is not null;

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
