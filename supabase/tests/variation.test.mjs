// Declined-variation stranding: a landlord decline used to leave the job in
// variation_pending with no admin queue showing it, the landlord seeing nothing
// pending, and every technician button disabled. Only a manual SQL edit
// unstuck it. This walks the whole path and asserts the office can resolve it.
//
//   SUPABASE_SERVICE_KEY=... node supabase/tests/variation.test.mjs
const URL = 'https://psmdiezvrnfafqqknyth.supabase.co';
const ANON = process.env.SB_ANON ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzbWRpZXp2cm5mYWZxcWtueXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMjUwMDksImV4cCI6MjA5ODgwMTAwOX0.1ofM8clPSFFEdiZ-cI_uXHakFMNTGzcOdVm3HImrXq0';
const SVC = process.env.SUPABASE_SERVICE_KEY ?? process.env.SB_SVC;
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };
const SH = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' };
let pass = 0, fail = 0;
const check = (n, ok, d) => { (ok ? pass++ : fail++); console.log(`${ok ? 'PASS' : '*** FAIL ***'}  ${n}${d ? ' — ' + d : ''}`); };

const mk = async (role, name) => {
  const email = `var-${role}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}@example.com`;
  const u = await j(await fetch(`${URL}/auth/v1/admin/users`, { method: 'POST', headers: SH, body: JSON.stringify({ email, password: 'Probe!12345', email_confirm: true }) }));
  await fetch(`${URL}/rest/v1/profiles?id=eq.${u.id}`, { method: 'PATCH', headers: SH, body: JSON.stringify({ role, full_name: name }) });
  const t = await j(await fetch(`${URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password: 'Probe!12345' }) }));
  return { id: u.id, h: { apikey: ANON, Authorization: `Bearer ${t.access_token}`, 'Content-Type': 'application/json' } };
};

const landlord = await mk('landlord', 'Var Landlord');
const tech = await mk('technician', 'Var Tech');
const admin = await mk('admin', 'Var Admin');
const prop = (await j(await fetch(`${URL}/rest/v1/properties`, { method: 'POST', headers: { ...SH, Prefer: 'return=representation' }, body: JSON.stringify({ landlord_id: landlord.id, address_line1: '3 Variation Villas', postcode: 'E1 6AN' }) })))[0];
const type = (await j(await fetch(`${URL}/rest/v1/job_types?active=eq.true&select=id,category,price_inc_vat&limit=1`, { headers: SH })))[0];

// job in progress with our technician on site
const job = (await j(await fetch(`${URL}/rest/v1/jobs`, { method: 'POST', headers: { ...SH, Prefer: 'return=representation' }, body: JSON.stringify({ property_id: prop.id, landlord_id: landlord.id, job_type_id: type.id, category: type.category, description: 'variation stranding probe', agreed_price_inc_vat: type.price_inc_vat, status: 'in_progress', assigned_technician_id: tech.id }) })))[0];

// 1. technician flags extra work
const v = (await j(await fetch(`${URL}/rest/v1/variations`, { method: 'POST', headers: { ...tech.h, Prefer: 'return=representation' }, body: JSON.stringify({ job_id: job.id, technician_id: tech.id, note: 'Rotten joist behind the panel', old_job_price_inc_vat: 9999 }) })))[0];
check('technician flag forced to flagged/unpriced', v && v.status === 'flagged' && v.admin_price_inc_vat === null, v ? `status=${v.status}` : JSON.stringify(v).slice(0, 100));
check('technician cannot preload the "was" price', v && Number(v.old_job_price_inc_vat) === Number(type.price_inc_vat), v ? `sent 9999, stored ${v.old_job_price_inc_vat}` : '-');
await fetch(`${URL}/rest/v1/rpc/transition_job`, { method: 'POST', headers: tech.h, body: JSON.stringify({ p_job_id: job.id, p_to: 'variation_pending', p_note: 'flagged' }) });

// 2. office prices it and sends to the landlord
await fetch(`${URL}/rest/v1/variations?id=eq.${v.id}`, { method: 'PATCH', headers: admin.h, body: JSON.stringify({ admin_price_inc_vat: 85, status: 'pending_landlord' }) });

// 3. landlord declines
const dec = await fetch(`${URL}/rest/v1/rpc/decide_variation`, { method: 'POST', headers: landlord.h, body: JSON.stringify({ p_variation_id: v.id, p_approve: false, p_note: 'not now' }) });
const afterDecline = (await j(await fetch(`${URL}/rest/v1/jobs?id=eq.${job.id}&select=status,agreed_price_inc_vat`, { headers: SH })))[0];
check('decline leaves job paused at original price', dec.status < 400 && afterDecline.status === 'variation_pending' && Number(afterDecline.agreed_price_inc_vat) === Number(type.price_inc_vat), `status=${afterDecline.status} price=${afterDecline.agreed_price_inc_vat}`);

// 4. THE BUG: does the office queue show it?
const queue = await j(await fetch(`${URL}/rest/v1/variations?status=in.(flagged,admin_review,declined)&select=id,status,job:jobs(status)`, { headers: admin.h }));
const visible = Array.isArray(queue) && queue.some((x) => x.id === v.id && x.job?.status === 'variation_pending');
check('declined+paused variation appears in the office queue', visible, `queue has ${Array.isArray(queue) ? queue.length : '?'} rows`);

// 5. office resumes the job at the original price
const res = await fetch(`${URL}/rest/v1/rpc/transition_job`, { method: 'POST', headers: admin.h, body: JSON.stringify({ p_job_id: job.id, p_to: 'in_progress', p_note: 'resumed at original price' }) });
const resumed = (await j(await fetch(`${URL}/rest/v1/jobs?id=eq.${job.id}&select=status,agreed_price_inc_vat`, { headers: SH })))[0];
check('office can resume at the original price', res.status < 400 && resumed.status === 'in_progress' && Number(resumed.agreed_price_inc_vat) === Number(type.price_inc_vat), `status=${resumed.status} price=${resumed.agreed_price_inc_vat}`);

// 6. once resumed it drops out of the queue
const queue2 = await j(await fetch(`${URL}/rest/v1/variations?status=in.(flagged,admin_review,declined)&select=id,status,job:jobs(status)`, { headers: admin.h }));
check('resolved variation leaves the queue', Array.isArray(queue2) && !queue2.some((x) => x.id === v.id && x.job?.status === 'variation_pending'), 'no longer paused');

// 7. the other outcome: cancelling is admin-only
await fetch(`${URL}/rest/v1/jobs?id=eq.${job.id}`, { method: 'PATCH', headers: SH, body: JSON.stringify({ status: 'variation_pending' }) });
const llCancel = await fetch(`${URL}/rest/v1/rpc/transition_job`, { method: 'POST', headers: landlord.h, body: JSON.stringify({ p_job_id: job.id, p_to: 'cancelled' }) });
check('landlord cannot cancel the paused job themselves', llCancel.status >= 400, `HTTP ${llCancel.status}`);
const admCancel = await fetch(`${URL}/rest/v1/rpc/transition_job`, { method: 'POST', headers: admin.h, body: JSON.stringify({ p_job_id: job.id, p_to: 'cancelled', p_note: 'called off' }) });
const cancelled = (await j(await fetch(`${URL}/rest/v1/jobs?id=eq.${job.id}&select=status`, { headers: SH })))[0];
check('office can cancel the job', admCancel.status < 400 && cancelled.status === 'cancelled', `status=${cancelled.status}`);

// 8. the positive path nobody was testing: the RIGHT landlord CAN approve, and
// the job price moves to old + admin price. 0011 broke exactly this and the
// RLS suite stayed green because it only checked that the WRONG landlord fails.
await fetch(`${URL}/rest/v1/jobs?id=eq.${job.id}`, { method: 'PATCH', headers: SH, body: JSON.stringify({ status: 'variation_pending', agreed_price_inc_vat: type.price_inc_vat }) });
const v2 = (await j(await fetch(`${URL}/rest/v1/variations`, { method: 'POST', headers: { ...SH, Prefer: 'return=representation' }, body: JSON.stringify({ job_id: job.id, technician_id: tech.id, note: 'second flag', old_job_price_inc_vat: type.price_inc_vat, status: 'pending_landlord', admin_price_inc_vat: 40 }) })))[0];
const appr = await fetch(`${URL}/rest/v1/rpc/decide_variation`, { method: 'POST', headers: landlord.h, body: JSON.stringify({ p_variation_id: v2.id, p_approve: true, p_note: 'go ahead' }) });
const approved = (await j(await fetch(`${URL}/rest/v1/jobs?id=eq.${job.id}&select=status,agreed_price_inc_vat`, { headers: SH })))[0];
check('the job\'s landlord CAN approve a variation', appr.status < 400, `HTTP ${appr.status}`);
check('approval adds the admin price to the job', Number(approved.agreed_price_inc_vat) === Number(type.price_inc_vat) + 40, `${type.price_inc_vat} + 40 -> ${approved.agreed_price_inc_vat}`);
check('approval resumes the job', approved.status === 'in_progress', `status=${approved.status}`);

// 9. a landlord still cannot rewrite a variation by hand (RLS, no UPDATE policy)
const hand = await fetch(`${URL}/rest/v1/variations?id=eq.${v2.id}`, { method: 'PATCH', headers: landlord.h, body: JSON.stringify({ admin_price_inc_vat: 1 }) });
const untouched = (await j(await fetch(`${URL}/rest/v1/variations?id=eq.${v2.id}&select=admin_price_inc_vat`, { headers: SH })))[0];
check('landlord cannot hand-edit variation pricing', Number(untouched.admin_price_inc_vat) === 40, `HTTP ${hand.status}, still ${untouched.admin_price_inc_vat}`);

// cleanup
await fetch(`${URL}/rest/v1/variations?job_id=eq.${job.id}`, { method: 'DELETE', headers: SH });
await fetch(`${URL}/rest/v1/invoices?job_id=eq.${job.id}`, { method: 'DELETE', headers: SH });
await fetch(`${URL}/rest/v1/job_events?job_id=eq.${job.id}`, { method: 'DELETE', headers: SH });
await fetch(`${URL}/rest/v1/jobs?id=eq.${job.id}`, { method: 'DELETE', headers: SH });
await fetch(`${URL}/rest/v1/properties?id=eq.${prop.id}`, { method: 'DELETE', headers: SH });
for (const u of [landlord.id, tech.id, admin.id]) await fetch(`${URL}/auth/v1/admin/users/${u}`, { method: 'DELETE', headers: SH });
const residue = await j(await fetch(`${URL}/rest/v1/profiles?id=in.(${landlord.id},${tech.id},${admin.id})&select=id`, { headers: SH }));
console.log(`\n${pass} passed, ${fail} failed. residue: ${JSON.stringify(residue)}`);
process.exit(fail ? 1 : 0);
