// Sends Expo push notifications on job status changes. Invoked by the
// job_events trigger (migration 0008) via pg_net. The landlord hears about
// every change; the technician hears about pauses/resumes they didn't cause.

import { createClient } from 'npm:@supabase/supabase-js@2';

const service = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const LANDLORD_MESSAGES: Record<string, string> = {
  priced: 'Your fixed price is ready — approve to book',
  scheduled: 'Your job is booked',
  in_progress: 'Your engineer has started work',
  variation_pending: 'Extra work needs your OK — job paused',
  awaiting_parts: 'Job paused — awaiting parts',
  completed: 'Work finished — take a look and confirm',
  paid: 'Payment received — all done',
  access_failed: 'Access failed — needs rebooking',
};

Deno.serve(async (req) => {
  try {
    const { job_id, to_status, note } = await req.json();
    if (!job_id || !to_status) return new Response('missing fields', { status: 400 });

    const { data: job } = await service
      .from('jobs')
      .select('reference, landlord_id, assigned_technician_id, job_type:job_types(name)')
      .eq('id', job_id)
      .maybeSingle();
    if (!job) return new Response('job not found', { status: 404 });

    const messages: { to: string; title: string; body: string }[] = [];
    const jobName = (job.job_type as any)?.name ?? 'Your job';

    const landlordBody = LANDLORD_MESSAGES[to_status];
    if (landlordBody && job.landlord_id) {
      const { data: p } = await service
        .from('profiles')
        .select('expo_push_token')
        .eq('id', job.landlord_id)
        .maybeSingle();
      if (p?.expo_push_token) {
        messages.push({ to: p.expo_push_token, title: `${jobName} · ${job.reference}`, body: landlordBody });
      }
    }

    // technician: tell them about landlord/admin decisions that unblock or change their day
    if (['scheduled', 'in_progress', 'cancelled'].includes(to_status) && job.assigned_technician_id) {
      const { data: p } = await service
        .from('profiles')
        .select('expo_push_token')
        .eq('id', job.assigned_technician_id)
        .maybeSingle();
      if (p?.expo_push_token) {
        messages.push({
          to: p.expo_push_token,
          title: `${jobName} · ${job.reference}`,
          body: note ?? `Status: ${to_status.replace('_', ' ')}`,
        });
      }
    }

    if (messages.length > 0) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages.map((m) => ({ ...m, sound: 'default' }))),
      });
    }

    return new Response(JSON.stringify({ sent: messages.length }), { status: 200 });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : 'error', { status: 500 });
  }
});
