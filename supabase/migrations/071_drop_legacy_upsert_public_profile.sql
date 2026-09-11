-- Drop legacy 3-arg overload of upsert_my_public_profile.
-- The client (follow-system.ts) only uses the 4-arg version with p_showcase_slots.
-- The 3-arg version is a legacy function that lacks showcase_slots support and is callable by anon (security risk).

DROP FUNCTION IF EXISTS upsert_my_public_profile(text, text, boolean);
