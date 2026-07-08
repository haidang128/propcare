-- Week 4: variation decision RPC + live variation queue.
--
-- Declined-variation policy (CEO to confirm, see DESIGN-FIXES.md): declining
-- pauses the job at no charge; the office follows up to rearrange or cancel.
-- So decline keeps the job in variation_pending for admin resolution.

create or replace function decide_variation(p_variation_id uuid, p_approve boolean, p_note text default null)
returns void
language plpgsql security definer set search_path = public as $$
declare
  v variations;
  v_job jobs;
  v_new_price numeric(10,2);
begin
  select * into v from variations where id = p_variation_id for update;
  if v.id is null then
    raise exception 'variation not found';
  end if;
  select * into v_job from jobs where id = v.job_id for update;
  if v_job.landlord_id is distinct from auth.uid() then
    raise exception 'only the landlord can decide this variation';
  end if;
  if v.status <> 'pending_landlord' then
    raise exception 'variation is not awaiting a decision';
  end if;
  if p_approve and v.admin_price_inc_vat is null then
    raise exception 'variation has no admin price';
  end if;

  if p_approve then
    v_new_price := v.old_job_price_inc_vat + v.admin_price_inc_vat;
    update variations
      set status = 'approved', decided_by = auth.uid(), decided_at = now(),
          new_job_price_inc_vat = v_new_price
      where id = p_variation_id;
    -- the price snapshot moves only here, with a full audit trail either side
    update jobs set agreed_price_inc_vat = v_new_price where id = v.job_id;
    if v_job.status = 'variation_pending' then
      update jobs set status = 'in_progress' where id = v.job_id;
      insert into job_events (job_id, from_status, to_status, actor_id, note)
        values (v.job_id, 'variation_pending', 'in_progress', auth.uid(),
                coalesce(p_note, 'Variation approved — new fixed price £' || v_new_price::text));
    end if;
  else
    update variations
      set status = 'declined', decided_by = auth.uid(), decided_at = now()
      where id = p_variation_id;
    insert into job_events (job_id, from_status, to_status, actor_id, note)
      values (v.job_id, v_job.status, v_job.status, auth.uid(),
              coalesce(p_note, 'Variation declined — office to rearrange or cancel (no charge)'));
  end if;
end $$;

-- Admin review queue updates live
alter publication supabase_realtime add table variations;
