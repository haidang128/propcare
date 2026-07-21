-- Fixes a regression introduced by 0011.
--
-- 0011 added guard_variation_update to stop a technician moving their own
-- variation on or setting the price the landlord sees. That threat was already
-- fully covered by RLS: on `variations`, non-admins hold only SELECT
-- (variations_technician, variations_landlord_read) and INSERT
-- (variations_technician_insert). The single UPDATE path is variations_admin.
-- The trigger therefore defended nothing.
--
-- It did, however, break the one sanctioned write. decide_variation is
-- SECURITY DEFINER, but SECURITY DEFINER changes the database role, NOT
-- auth.uid() -- that still returns the caller from the JWT. So when a landlord
-- approved or declined, the function's own `update variations set status=...`
-- hit the trigger as a non-admin and raised "variation pricing and status are
-- set by the office". Every landlord approve AND decline failed.
--
-- The RLS suite stayed green at 26/26 because it only asserts that the WRONG
-- landlord is refused (rls.test.mjs:180); it never asserted that the right one
-- succeeds. Positive coverage added in supabase/tests/variation.test.mjs.

drop trigger if exists variations_guard_update on variations;
drop function if exists guard_variation_update();

-- guard_variation_insert stays: it normalises technician-supplied inserts,
-- which RLS genuinely cannot constrain (it can permit the row, not the values).
