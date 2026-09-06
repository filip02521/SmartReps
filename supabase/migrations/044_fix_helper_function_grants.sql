-- ═══════════════════════════════════════════════════════════════
-- 044: Revoke EXECUTE from helper functions that should not be called directly
-- follow_assert_authenticated and community_assert_authenticated are internal
-- helpers used by other SECURITY DEFINER functions, not meant for direct API calls.
-- ═══════════════════════════════════════════════════════════════

revoke all on function public.follow_assert_authenticated() from public, anon, authenticated;
grant execute on function public.follow_assert_authenticated() to service_role;

revoke all on function public.community_assert_authenticated() from public, anon, authenticated;
grant execute on function public.community_assert_authenticated() to service_role;
