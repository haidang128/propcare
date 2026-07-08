-- Job photos bucket. Private: signed URLs / authenticated reads only.
-- P0 policy is simple (any signed-in user, path convention job-photos/{job_id}/...);
-- tightened to per-job path checks in hardening week 7.

insert into storage.buckets (id, name, public)
values ('job-photos', 'job-photos', false)
on conflict (id) do nothing;

create policy "job photos upload by signed-in users" on storage.objects
  for insert with check (bucket_id = 'job-photos' and auth.uid() is not null);

create policy "job photos read by signed-in users" on storage.objects
  for select using (bucket_id = 'job-photos' and auth.uid() is not null);
