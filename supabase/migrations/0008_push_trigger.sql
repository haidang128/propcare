-- Push notification fan-out: every job_events insert pings the notify-push
-- Edge Function via pg_net (async, non-blocking). The anon key in the header
-- is the public client key — it only gets the request past JWT verification;
-- the function itself uses the service role internally.

create extension if not exists pg_net;

create or replace function notify_job_event() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  perform net.http_post(
    url := 'https://psmdiezvrnfafqqknyth.supabase.co/functions/v1/notify-push',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzbWRpZXp2cm5mYWZxcWtueXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMjUwMDksImV4cCI6MjA5ODgwMTAwOX0.1ofM8clPSFFEdiZ-cI_uXHakFMNTGzcOdVm3HImrXq0'
    ),
    body := jsonb_build_object('job_id', new.job_id, 'to_status', new.to_status, 'note', new.note)
  );
  return new;
end $$;

create trigger job_events_notify after insert on job_events
  for each row execute function notify_job_event();
