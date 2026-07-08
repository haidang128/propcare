-- Week 3 remainder: technician accept/decline, realtime status, push-token slot.

alter table jobs add column technician_accepted_at timestamptz;
alter table profiles add column expo_push_token text;

-- Technician responds to an assignment. Decline returns the job to the dispatch
-- queue (scheduled → rescheduled, unassigned) so the admin can reassign — the
-- PRD acceptance criterion "admin can reassign if a technician declines".
create or replace function respond_to_assignment(p_job_id uuid, p_accept boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v_job jobs;
begin
  select * into v_job from jobs where id = p_job_id for update;
  if v_job.id is null then
    raise exception 'job not found';
  end if;
  if v_job.assigned_technician_id is distinct from auth.uid() then
    raise exception 'not your assignment';
  end if;

  if p_accept then
    update jobs set technician_accepted_at = now() where id = p_job_id;
    insert into job_events (job_id, from_status, to_status, actor_id, note)
      values (p_job_id, v_job.status, v_job.status, auth.uid(),
              coalesce(p_note, 'Technician accepted the job'));
  else
    update jobs
      set assigned_technician_id = null,
          technician_accepted_at = null,
          status = case when status = 'scheduled' then 'rescheduled'::job_status else status end
      where id = p_job_id;
    insert into job_events (job_id, from_status, to_status, actor_id, note)
      values (p_job_id, v_job.status,
              case when v_job.status = 'scheduled' then 'rescheduled'::job_status else v_job.status end,
              auth.uid(), coalesce(p_note, 'Technician declined — needs reassignment'));
  end if;
end $$;

-- Live status: let clients subscribe to job changes (RLS still applies).
alter publication supabase_realtime add table jobs;
