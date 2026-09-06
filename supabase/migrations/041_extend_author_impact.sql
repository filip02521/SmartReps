-- ═══════════════════════════════════════════════════════════════
-- 041: Extend get_community_author_impact with follower/following/review/challenge counts
-- Adds: follower_count, following_count, review_count,
--       challenge_participations, challenge_wins
-- These enable community/social achievements in the achievements system.
-- ═══════════════════════════════════════════════════════════════

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
  follower_count int := 0;
  following_count int := 0;
  review_count int := 0;
  challenge_participations int := 0;
  challenge_wins int := 0;
begin
  -- ── Publication impact (existing) ──
  select
    coalesce(sum(like_count), 0)::int,
    coalesce(sum(import_count), 0)::int,
    coalesce(sum(trained_count), 0)::int
  into like_total, import_total, trained_total
  from community_publications
  where author_id = uid
    and status = 'published';

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

  -- ── Follow system counts ──
  select count(*)::int into follower_count
    from user_follows
   where followee_id = uid;

  select count(*)::int into following_count
    from user_follows
   where follower_id = uid;

  -- ── Review count (reviews written by user) ──
  select count(*)::int into review_count
    from community_reviews
   where user_id = uid;

  -- ── Weekly challenge participations ──
  select count(*)::int into challenge_participations
    from weekly_challenge_entries
   where user_id = uid;

  -- ── Weekly challenge wins (rank 1 in challenge) ──
  -- A "win" = the user has the highest total_reps in a challenge they participated in.
  -- We check each challenge where the user's entry equals the max total_reps.
  select count(*)::int into challenge_wins
    from weekly_challenge_entries e
   where e.user_id = uid
     and e.total_reps = (
       select max(e2.total_reps)
         from weekly_challenge_entries e2
        where e2.challenge_id = e.challenge_id
     );

  return jsonb_build_object(
    'like_total', like_total,
    'import_total', import_total,
    'trained_total', trained_total,
    'published_count', published_count,
    'best_plan_imports', coalesce(best_imports, 0),
    'best_plan_trained', coalesce(best_trained, 0),
    'follower_count', follower_count,
    'following_count', following_count,
    'review_count', review_count,
    'challenge_participations', challenge_participations,
    'challenge_wins', challenge_wins
  );
end;
$$;

revoke all on function get_community_author_impact() from public, anon;
grant execute on function get_community_author_impact() to authenticated;
