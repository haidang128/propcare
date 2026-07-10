-- Week 9: out-of-hours eligibility per job type.
--
-- The surcharge was a global multiplier applied to whatever the landlord picked,
-- so an out-of-hours flat-pack assembly was bookable at 1.75x. The rate card only
-- ever intended out-of-hours for emergency lines ("Isolate + make safe"), which is
-- also the only line whose value is that it happens at 10pm on a Sunday.

alter table job_types
  add column if not exists out_of_hours_eligible boolean not null default false;

comment on column job_types.out_of_hours_eligible is
  'Can this job be booked at the out-of-hours surcharge? Emergency lines only.';

-- Defence in depth: the UI hides the option, the database refuses it outright.
create or replace function enforce_ooh_eligibility() returns trigger
language plpgsql set search_path = public as $$
declare eligible boolean;
begin
  if new.urgency <> 'out_of_hours' then
    return new;
  end if;
  if new.job_type_id is null then
    return new; -- admin-created jobs with no rate-card line
  end if;
  select out_of_hours_eligible into eligible from job_types where id = new.job_type_id;
  if not coalesce(eligible, false) then
    raise exception 'this job type cannot be booked out of hours';
  end if;
  return new;
end $$;

create trigger jobs_ooh_eligibility before insert or update of urgency, job_type_id on jobs
  for each row execute function enforce_ooh_eligibility();
