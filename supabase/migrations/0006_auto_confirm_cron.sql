-- Week 6: the 72-hour auto-confirm clock (PRD: "captured automatically after
-- 72 hours with no dispute"). Hourly sweep closes the dispute window on unpaid,
-- undisputed invoices past their deadline and audits it on the job.
-- (Payment itself still happens via the Stripe link — no card on file at P0.)

create extension if not exists pg_cron;

select cron.schedule(
  'auto-confirm-invoices',
  '15 * * * *',
  $cron$
  with due as (
    update invoices
      set status = 'auto_captured'
      where status = 'sent' and capture_deadline < now()
      returning job_id
  )
  insert into job_events (job_id, from_status, to_status, note)
  select j.id, j.status, j.status,
         'Auto-confirmed after 72 hours with no dispute — invoice remains payable'
  from jobs j
  join due d on d.job_id = j.id;
  $cron$
);
