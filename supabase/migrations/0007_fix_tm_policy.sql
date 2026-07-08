-- Fix found by supabase/tests/rls.test.mjs: the time_materials policy let any
-- technician INSERT rows onto any job (it only checked technician_id = self,
-- not assignment). Tighten: writes require being the job's assigned technician.

drop policy tm_technician on time_materials;

create policy tm_technician on time_materials
  for all
  using (technician_id = auth.uid())
  with check (
    technician_id = auth.uid()
    and exists (
      select 1 from jobs j
      where j.id = time_materials.job_id
        and j.assigned_technician_id = auth.uid()
    )
  );
