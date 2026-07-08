-- Week 5: invoices + dispute wiring.
-- Invoice is created server-side the moment a job completes; the 72-hour
-- auto-confirm clock (capture_deadline) starts then. A dispute freezes it.

create or replace function create_invoice_on_completion() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    insert into invoices (job_id, number, total_inc_vat, status, capture_deadline)
    values (new.id, new.reference, new.agreed_price_inc_vat, 'sent', now() + interval '72 hours')
    on conflict (job_id) do nothing;
  end if;
  -- disputed blocks capture until admin resolution (PRD acceptance criterion)
  if new.status = 'disputed' and old.status is distinct from 'disputed' then
    update invoices set status = 'disputed' where job_id = new.id;
  end if;
  if old.status = 'disputed' and new.status = 'completed' then
    -- dispute resolved in the landlord's favour of completion: restart the 72h clock
    update invoices set status = 'sent', capture_deadline = now() + interval '72 hours'
      where job_id = new.id and status = 'disputed';
  end if;
  return new;
end $$;

create trigger jobs_invoice_on_completion after update of status on jobs
  for each row execute function create_invoice_on_completion();
