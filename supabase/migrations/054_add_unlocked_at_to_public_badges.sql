-- ═══════════════════════════════════════════════════════════════
-- 054: Add unlocked_at to public achievement badges
--
-- get_user_achievements_public now returns unlocked_at so followers/
-- following cards can show when a badge was earned when the user
-- taps a badge to inspect it.
-- ═══════════════════════════════════════════════════════════════

create or replace function public.get_user_achievements_public(
  p_user_id uuid,
  p_limit int default 4,
  p_pinned_slots jsonb default null
)
returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  result jsonb;
  pinned_ids text[];
  pinned_json jsonb;
begin
  -- If pinned slots provided, use them (filter to only unlocked + non-secret)
  if p_pinned_slots is not null and jsonb_array_length(p_pinned_slots) > 0 then
    select coalesce(jsonb_agg(
      jsonb_build_object(
        'achievement_id', t.achievement_id,
        'tier_level', coalesce(t.tier_level, 0),
        'unlocked_at', t.unlocked_at
      )
    ), '[]'::jsonb) into result
    from (
      select ua.achievement_id, ua.tier_level, ua.unlocked_at
      from user_achievements ua
      where ua.user_id = p_user_id
        and ua.achievement_id = any(
          select jsonb_array_elements_text(p_pinned_slots)
        )
        and ua.achievement_id not in ('secret_night', 'secret_precision')
      order by ua.unlocked_at desc
      limit greatest(1, p_limit)
    ) t;

    -- If fewer pinned badges are unlocked than requested, fill remaining slots
    -- with auto-ranked badges (excluding already-included pinned ones)
    if jsonb_array_length(coalesce(result, '[]'::jsonb)) < p_limit then
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'achievement_id', t.achievement_id,
          'tier_level', coalesce(t.tier_level, 0),
          'unlocked_at', t.unlocked_at
        )
      ), '[]'::jsonb) into pinned_json
      from (
        select ua.achievement_id, ua.tier_level, ua.unlocked_at
        from user_achievements ua
        where ua.user_id = p_user_id
          and ua.achievement_id not in ('secret_night', 'secret_precision')
          and ua.achievement_id not in (
            select jsonb_array_elements_text(p_pinned_slots)
          )
        order by
          case
            when ua.achievement_id in ('legend_full_circle', 'legend_grandmaster', 'legend_quiet_master', 'streak_52') then 3
            when ua.achievement_id in ('streak_26', 'sessions_100', 'volume_10k', 'goal_pushups_100', 'goal_pullups_50', 'comeback_stronger', 'cycle_closed_strong') then 3
            when ua.achievement_id in ('streak_12', 'cycles_5', 'pr_master', 'habit_builder', 'custom_sessions_25', 'trainer_25', 'poly_publisher', 'community_pillar') then 2
            when ua.achievement_id in ('first_session', 'habit_3_in_14', 'first_custom_session', 'streak_1', 'streak_4') then 1
            when ua.achievement_id in ('first_publish', 'first_like', 'first_import', 'first_trained', 'plan_with_legs') then 1
            when ua.achievement_id in ('liked_author', 'imported_author') then 1
            else 1
          end desc,
          coalesce(ua.tier_level, 0) desc,
          ua.unlocked_at desc
        limit greatest(0, p_limit - jsonb_array_length(coalesce(result, '[]'::jsonb)))
      ) t;

      result := coalesce(result, '[]'::jsonb) || coalesce(pinned_json, '[]'::jsonb);
    end if;

    return result;
  end if;

  -- Auto-ranked: no pinned slots
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'achievement_id', t.achievement_id,
      'tier_level', coalesce(t.tier_level, 0),
      'unlocked_at', t.unlocked_at
    )
  ), '[]'::jsonb) into result
  from (
    select ua.achievement_id, ua.tier_level, ua.unlocked_at
    from user_achievements ua
    where ua.user_id = p_user_id
      and ua.achievement_id not in ('secret_night', 'secret_precision')
    order by
      -- Rarity rank: legendary=3, rare=2, common=1 (mirrors showcase.ts)
      case
        when ua.achievement_id in ('legend_full_circle', 'legend_grandmaster', 'legend_quiet_master', 'streak_52') then 3
        when ua.achievement_id in ('streak_26', 'sessions_100', 'volume_10k', 'goal_pushups_100', 'goal_pullups_50', 'comeback_stronger', 'cycle_closed_strong') then 3
        when ua.achievement_id in ('streak_12', 'cycles_5', 'pr_master', 'habit_builder', 'custom_sessions_25', 'trainer_25', 'poly_publisher', 'community_pillar') then 2
        when ua.achievement_id in ('first_session', 'habit_3_in_14', 'first_custom_session', 'streak_1', 'streak_4') then 1
        when ua.achievement_id in ('first_publish', 'first_like', 'first_import', 'first_trained', 'plan_with_legs') then 1
        when ua.achievement_id in ('liked_author', 'imported_author') then 1
        else 1
      end desc,
      coalesce(ua.tier_level, 0) desc,
      ua.unlocked_at desc
    limit greatest(1, p_limit)
  ) t;

  return result;
end;
$$;

grant execute on function public.get_user_achievements_public(uuid, int, jsonb) to authenticated;
