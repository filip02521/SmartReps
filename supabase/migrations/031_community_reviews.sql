-- 031_community_reviews.sql
-- Plan reviews: 1-5 star rating + optional short comment on community publications.
-- One review per user per publication (upsert). Author cannot review own plan.

-- ── Reviews table ──
create table if not exists community_reviews (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references community_publications(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  rating int not null check (rating >= 1 and rating <= 5),
  comment text not null default '' check (char_length(comment) <= 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (publication_id, user_id)
);

-- Index for listing reviews by publication (newest first)
create index if not exists community_reviews_publication_idx
  on community_reviews(publication_id, created_at desc);

-- Index for finding a user's review on a publication
create index if not exists community_reviews_user_idx
  on community_reviews(user_id, publication_id);

-- ── RLS ──
alter table community_reviews enable row level security;

-- Reviews are public (anyone can see reviews on published plans)
create policy community_reviews_select on community_reviews
  for select using (true);

-- Users can insert only their own reviews, and only on published plans, not own plans
create policy community_reviews_insert on community_reviews
  for insert with check (
    user_id = auth.uid()
    and exists (
      select 1 from community_publications p
      where p.id = publication_id
        and p.status = 'published'
        and p.author_id <> auth.uid()
    )
  );

-- Users can update only their own reviews
create policy community_reviews_update on community_reviews
  for update using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Users can delete only their own reviews
create policy community_reviews_delete on community_reviews
  for delete using (user_id = auth.uid());

-- ── Updated_at trigger ──
create or replace function community_reviews_set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger community_reviews_updated_at
  before update on community_reviews
  for each row execute function community_reviews_set_updated_at();

-- ── RPC: upsert review (insert or update) ──
-- Returns the review row as jsonb. Raises 'self_review_forbidden' if author reviews own plan.
create or replace function upsert_community_review(
  p_publication_id uuid,
  p_rating int,
  p_comment text default ''
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := community_assert_authenticated();
  pub community_publications%rowtype;
  review_row community_reviews%rowtype;
begin
  -- Validate rating
  if p_rating < 1 or p_rating > 5 then
    raise exception 'invalid_rating';
  end if;

  -- Validate comment length
  if char_length(p_comment) > 500 then
    raise exception 'comment_too_long';
  end if;

  -- Check publication exists and is published
  select * into pub from community_publications where id = p_publication_id;
  if not found or pub.status <> 'published' then
    raise exception 'not_found';
  end if;

  -- Author cannot review own plan
  if pub.author_id = uid then
    raise exception 'self_review_forbidden';
  end if;

  -- Upsert review
  insert into community_reviews (publication_id, user_id, rating, comment)
  values (p_publication_id, uid, p_rating, p_comment)
  on conflict (publication_id, user_id)
  do update set rating = excluded.rating, comment = excluded.comment, updated_at = now()
  returning * into review_row;

  return jsonb_build_object(
    'id', review_row.id,
    'publication_id', review_row.publication_id,
    'user_id', review_row.user_id,
    'rating', review_row.rating,
    'comment', review_row.comment,
    'created_at', review_row.created_at,
    'updated_at', review_row.updated_at
  );
end;
$$;

-- ── RPC: delete own review ──
create or replace function delete_community_review(
  p_publication_id uuid
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := community_assert_authenticated();
begin
  delete from community_reviews
  where publication_id = p_publication_id and user_id = uid;
end;
$$;

-- ── RPC: get review summary (avg rating + count) ──
create or replace function get_community_review_summary(
  p_publication_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  avg_rating numeric;
  review_count int;
begin
  select avg(rating), count(*)
  into avg_rating, review_count
  from community_reviews
  where publication_id = p_publication_id;

  return jsonb_build_object(
    'avg_rating', coalesce(avg_rating, 0),
    'review_count', coalesce(review_count, 0)
  );
end;
$$;

-- ── RPC: get current user's review for a publication ──
create or replace function get_my_community_review(
  p_publication_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  uid uuid := community_assert_authenticated();
  review_row community_reviews%rowtype;
begin
  select * into review_row
  from community_reviews
  where publication_id = p_publication_id and user_id = uid;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'id', review_row.id,
    'publication_id', review_row.publication_id,
    'rating', review_row.rating,
    'comment', review_row.comment,
    'created_at', review_row.created_at,
    'updated_at', review_row.updated_at
  );
end;
$$;
