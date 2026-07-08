// Tenant access-slot endpoint — the only unauthenticated surface in PropCare.
// The single-use token in the SMS link is the credential. Deliberately exposes
// no prices, no landlord identity, no other jobs (PRD: tenants never see prices).
//
// GET  ?token=...            → slot options + who's coming
// POST {token, start, end}   → confirm a slot

import { createClient } from 'npm:@supabase/supabase-js@2';

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

async function loadSlot(token: string) {
  const { data, error } = await supabase
    .from('access_slots')
    .select(
      `id, offered_slots, chosen_start, chosen_end, confirmed_at, expires_at,
       job:jobs(id, status,
         job_type:job_types(name),
         property:properties(address_line1, tenant_name),
         technician:profiles!jobs_assigned_technician_id_fkey(full_name))`,
    )
    .eq('token', token)
    .maybeSingle();
  if (error) throw new Error(error.message);
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });

  try {
    if (req.method === 'GET') {
      const token = new URL(req.url).searchParams.get('token');
      if (!token) return json(400, { error: 'missing token' });
      const slot = await loadSlot(token);
      if (!slot) return json(404, { error: 'link not found' });
      if (new Date(slot.expires_at) < new Date()) return json(410, { error: 'link expired' });

      const job = slot.job as any;
      return json(200, {
        tenant_name: job?.property?.tenant_name ?? null,
        technician_name: job?.technician?.full_name ?? null,
        job_name: job?.job_type?.name ?? 'a repair',
        address_line1: job?.property?.address_line1 ?? null,
        offered_slots: slot.offered_slots,
        chosen: slot.confirmed_at
          ? { start: slot.chosen_start, end: slot.chosen_end }
          : null,
      });
    }

    if (req.method === 'POST') {
      const { token, start, end } = await req.json();
      if (!token || !start || !end) return json(400, { error: 'missing fields' });
      const slot = await loadSlot(token);
      if (!slot) return json(404, { error: 'link not found' });
      if (new Date(slot.expires_at) < new Date()) return json(410, { error: 'link expired' });

      const offered = (slot.offered_slots as { start: string; end: string }[]) ?? [];
      if (!offered.some((s) => s.start === start && s.end === end)) {
        return json(400, { error: 'slot not offered' });
      }

      const jobId = (slot.job as any)?.id;
      const { error: e1 } = await supabase
        .from('access_slots')
        .update({ chosen_start: start, chosen_end: end, confirmed_at: new Date().toISOString() })
        .eq('id', slot.id);
      if (e1) throw new Error(e1.message);

      const { error: e2 } = await supabase
        .from('jobs')
        .update({ scheduled_start: start, scheduled_end: end })
        .eq('id', jobId);
      if (e2) throw new Error(e2.message);

      const status = (slot.job as any)?.status;
      await supabase.from('job_events').insert({
        job_id: jobId,
        from_status: status,
        to_status: status,
        note: `Tenant confirmed access — ${new Date(start).toLocaleString('en-GB', { timeZone: 'Europe/London' })}`,
      });

      return json(200, { ok: true });
    }

    return json(405, { error: 'method not allowed' });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : 'internal error' });
  }
});
