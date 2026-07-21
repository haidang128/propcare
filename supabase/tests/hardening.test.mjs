// Precise post-hardening check: assert the STORED values, not just HTTP status.
const URL = 'https://psmdiezvrnfafqqknyth.supabase.co';
const ANON = process.env.SB_ANON, SVC = process.env.SB_SVC;
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };
const SH = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' };
let pass = 0, fail = 0;
const check = (name, ok, detail) => { (ok ? pass++ : fail++); console.log(`${ok ? 'PASS' : '*** FAIL ***'}  ${name}${detail ? ' — ' + detail : ''}`); };

const email = `harden-${Date.now()}@example.com`, password = 'Probe!12345';
const user = await j(await fetch(`${URL}/auth/v1/admin/users`, { method: 'POST', headers: SH, body: JSON.stringify({ email, password, email_confirm: true }) }));
const prop = await j(await fetch(`${URL}/rest/v1/properties`, { method: 'POST', headers: { ...SH, Prefer: 'return=representation' }, body: JSON.stringify({ landlord_id: user.id, address_line1: '1 Exploit Road', postcode: 'E1 6AN' }) }));
const propId = prop[0].id;
const tok = await j(await fetch(`${URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }));
const UH = { apikey: ANON, Authorization: `Bearer ${tok.access_token}`, 'Content-Type': 'application/json' };

const jt = await j(await fetch(`${URL}/rest/v1/job_types?active=eq.true&category=eq.electrical&select=id,name,price_inc_vat,category&limit=1`, { headers: SH }));
const type = jt[0];

// 1. price is derived from the rate card, not the client
const r1 = await j(await fetch(`${URL}/rest/v1/jobs`, {
  method: 'POST', headers: { ...UH, Prefer: 'return=representation' },
  body: JSON.stringify({ property_id: propId, landlord_id: user.id, job_type_id: type.id, category: 'handyman', description: 'probe', agreed_price_inc_vat: 0.5, urgency: 'standard', status: 'approved' }),
}));
const job = Array.isArray(r1) ? r1[0] : null;
check('price overwritten from rate card', job && Number(job.agreed_price_inc_vat) === Number(type.price_inc_vat), job ? `sent 0.50, stored ${job.agreed_price_inc_vat} (card ${type.price_inc_vat})` : JSON.stringify(r1).slice(0, 120));
check('category forced to match job type', job && job.category === type.category, job ? `sent "handyman", stored "${job.category}"` : '-');
check('status forced to requested', job && job.status === 'requested', job ? `sent "approved", stored "${job.status}"` : '-');

// 2. landlord cannot self-mark paid
if (job) {
  for (const to of ['priced', 'approved']) await fetch(`${URL}/rest/v1/rpc/transition_job`, { method: 'POST', headers: UH, body: JSON.stringify({ p_job_id: job.id, p_to: to }) });
  // force to completed as service role so 'paid' is a legal edge
  await fetch(`${URL}/rest/v1/jobs?id=eq.${job.id}`, { method: 'PATCH', headers: SH, body: JSON.stringify({ status: 'completed' }) });
  const rp = await fetch(`${URL}/rest/v1/rpc/transition_job`, { method: 'POST', headers: UH, body: JSON.stringify({ p_job_id: job.id, p_to: 'paid' }) });
  const body = await rp.text();
  const st = await j(await fetch(`${URL}/rest/v1/jobs?id=eq.${job.id}&select=status`, { headers: SH }));
  check('landlord cannot self-mark paid', rp.status >= 400 && st[0]?.status === 'completed', `HTTP ${rp.status}, status still "${st[0]?.status}" ${body.slice(0, 80)}`);

  // 2b. landlord cannot cancel work under way
  await fetch(`${URL}/rest/v1/jobs?id=eq.${job.id}`, { method: 'PATCH', headers: SH, body: JSON.stringify({ status: 'in_progress' }) });
  const rc = await fetch(`${URL}/rest/v1/rpc/transition_job`, { method: 'POST', headers: UH, body: JSON.stringify({ p_job_id: job.id, p_to: 'cancelled' }) });
  const st2 = await j(await fetch(`${URL}/rest/v1/jobs?id=eq.${job.id}&select=status`, { headers: SH }));
  check('landlord cannot cancel in-progress work', rc.status >= 400 && st2[0]?.status === 'in_progress', `HTTP ${rc.status}, status "${st2[0]?.status}"`);
}

// 3. storage scoped
const ls = await fetch(`${URL}/storage/v1/object/list/job-photos`, { method: 'POST', headers: UH, body: JSON.stringify({ prefix: '', limit: 100 }) });
const listed = await j(ls);
check('stranger enumerates no job photos', Array.isArray(listed) && listed.length === 0, `got ${Array.isArray(listed) ? listed.length : JSON.stringify(listed).slice(0, 60)} entries`);

// 4. pay rate is admin-only
const pr = await fetch(`${URL}/rest/v1/profiles?id=eq.${user.id}`, { method: 'PATCH', headers: UH, body: JSON.stringify({ pay_rate_per_hour: 500 }) });
const prAfter = await j(await fetch(`${URL}/rest/v1/profiles?id=eq.${user.id}&select=pay_rate_per_hour`, { headers: SH }));
check('user cannot set own pay rate', pr.status >= 400 || prAfter[0]?.pay_rate_per_hour === null, `HTTP ${pr.status}, stored ${JSON.stringify(prAfter[0]?.pay_rate_per_hour)}`);

// 5. role escalation still blocked (0009 regression check)
const re = await fetch(`${URL}/rest/v1/profiles?id=eq.${user.id}`, { method: 'PATCH', headers: UH, body: JSON.stringify({ role: 'admin' }) });
const reAfter = await j(await fetch(`${URL}/rest/v1/profiles?id=eq.${user.id}&select=role`, { headers: SH }));
check('role escalation still blocked', re.status >= 400 || reAfter[0]?.role === 'landlord', `HTTP ${re.status}, role ${reAfter[0]?.role}`);

// cleanup — invoices first: this test drives a job through 'completed', which
// auto-creates an invoice whose FK otherwise blocks the whole delete chain and
// strands a profile row in prod.
if (job) {
  await fetch(`${URL}/rest/v1/invoices?job_id=eq.${job.id}`, { method: 'DELETE', headers: SH });
  await fetch(`${URL}/rest/v1/ratings?job_id=eq.${job.id}`, { method: 'DELETE', headers: SH });
  await fetch(`${URL}/rest/v1/job_events?job_id=eq.${job.id}`, { method: 'DELETE', headers: SH });
  await fetch(`${URL}/rest/v1/jobs?id=eq.${job.id}`, { method: 'DELETE', headers: SH });
}
await fetch(`${URL}/rest/v1/properties?id=eq.${propId}`, { method: 'DELETE', headers: SH });
await fetch(`${URL}/auth/v1/admin/users/${user.id}`, { method: 'DELETE', headers: SH });
const residue = await j(await fetch(`${URL}/rest/v1/profiles?id=eq.${user.id}&select=id`, { headers: SH }));
console.log(`\n${pass} passed, ${fail} failed. cleanup residue: ${JSON.stringify(residue)}`);
process.exit(fail ? 1 : 0);
