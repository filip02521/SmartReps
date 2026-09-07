-- 055: Denormalize review summary onto community_publications
--
-- Adds avg_rating and review_count columns to community_publications so
-- the catalog list query can show ratings without an N+1 RPC per card.
-- A trigger keeps them in sync whenever community_reviews changes.

-- ── Add columns ──
alter table community_publications
  add column if not exists avg_rating numeric(3,1) not null default 0,
  add column if not exists review_count int not null default 0;

-- ── Backfill from existing reviews ──
update community_publications p
  set
    avg_rating = coalesce(r.avg_r, 0),
    review_count = coalesce(r.cnt, 0)
  from (
    select publication_id,
           round(avg(rating)::numeric, 1) as avg_r,
           count(*)::int as cnt
    from community_reviews
    group by publication_id
  ) r
  where r.publication_id = p.id;

-- ── Trigger function: recompute summary for a publication ──
create or replace function recompute_publication_rating_summary()
returns trigger
language plpgsql
as $$
declare
  pub_id uuid;
begin
  pub_id := coalesce(new.publication_id, old.publication_id);
  if pub_id is null then return coalesce(new, old); end if;

  update community_publications
    set
      avg_rating = coalesce((
        select round(avg(rating)::numeric, 1)
        from community_reviews
        where publication_id = pub_id
      ), 0),
      review_count = coalesce((
        select count(*)::int
        from community_reviews
        where publication_id = pub_id
      ), 0)
    where id = pub_id;

  return coalesce(new, old);
end;
$$;

-- ── Triggers on community_reviews ──
drop trigger if exists community_reviews_rating_summary_insert on community_reviews;
create trigger community_reviews_rating_summary_insert
  after insert on community_reviews
  for each row execute function recompute_publication_rating_summary();

drop trigger if exists community_reviews_rating_summary_update on community_reviews;
create trigger community_reviews_rating_summary_update
  after update of rating, publication_id on community_reviews
  for each row execute function recompute_publication_rating_summary();

drop trigger if exists community_reviews_rating_summary_delete on community_reviews;
create trigger community_reviews_rating_summary_delete
  after delete on community_reviews
  for each row execute function recompute_publication_rating_summary();

-- ── Index for sorting catalog by rating ──
create index if not exists community_publications_avg_rating_idx
  on community_publications(avg_rating desc, review_count desc)
  where status = 'published';
