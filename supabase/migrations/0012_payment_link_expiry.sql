-- Week 9: unblock payment after the 72-hour mark, and stop handing out dead
-- Stripe links.
--
-- Two defects, both in create-payment-link, both of which made money
-- permanently uncollectable:
--
--   1. It treated invoice status 'auto_captured' as "already paid" and
--      returned 409. Nothing captures money at 72 hours -- there is no card on
--      file at P0 -- so this is exactly backwards. The cron in 0006 says so
--      itself: "Auto-confirmed after 72 hours with no dispute — invoice
--      remains payable". Any landlord who did not pay within 72 hours could
--      never pay, while the app kept showing "Confirm & pay".
--
--   2. It cached session.url on the invoice and returned it unconditionally
--      forever. Stripe Checkout Sessions expire 24 hours after creation, so
--      from day two onwards the landlord was sent to a dead Stripe page with
--      no way to get a fresh one.
--
-- Fix for 1 is in the function (only 'paid' blocks). Fix for 2 needs somewhere
-- to record when the cached link dies, so a fresh session is minted instead.

alter table invoices
  add column if not exists stripe_payment_link_expires_at timestamptz;

comment on column invoices.stripe_payment_link_expires_at is
  'When the cached stripe_payment_link stops working. Stripe Checkout Sessions expire 24h after creation; past this, create-payment-link mints a new session rather than returning a dead URL.';

-- Existing cached links have unknown age and are very likely already expired.
-- Clearing them costs one extra Stripe session on next view and guarantees
-- nobody is handed a dead link.
update invoices
  set stripe_payment_link = null
  where stripe_payment_link is not null
    and status <> 'paid';
