-- Trigger functions are invoked by the trigger mechanism, not via RPC —
-- revoking EXECUTE does not affect their operation. This silences advisor
-- lints 0028/0029 and removes a confusing public API surface.
revoke execute on function public.streak_freezes_require_pro() from anon, authenticated;
revoke execute on function public.protect_subscription_fields() from anon, authenticated;
revoke execute on function public.enforce_custom_plan_limit() from anon, authenticated;
revoke execute on function public.handle_new_user() from anon, authenticated;
