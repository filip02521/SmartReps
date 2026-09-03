-- Add tier_level to user_achievements for progressive achievement tiers
alter table user_achievements
  add column if not exists tier_level int;
