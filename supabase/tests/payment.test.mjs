// Prove an auto_captured (72h-elapsed) invoice is payable again, and that a
// stale Checkout URL is replaced rather than re-served.
const URL = 'https://psmdiezvrnfafqqknyth.supabase.co';
const ANON = process.env.SB_ANON, SVC = process.env.SB_SVC;
const j = async (r) => { const t = await r.text(); try { return JSON.parse(t); } catch { return t; } };
const SH = { apikey: SVC, Authorization: `Bearer ${SVC}`, 'Content-Type': 'application/json' };
let pass = 0, fail = 0;
const check = (n, ok, d) => { (ok ? pass++ : fail++); console.log(`${ok ? 'PASS' : '*** FAIL ***'}  ${n}${d ? ' — ' + d : ''}`); };

const email = `pay-${Date.now()}@example.com`, password = 'Probe!12345';
const user = await j(await fetch(`${URL}/auth/v1/admin/users`, { method: 'POST', headers: SH, body: JSON.stringify({ email, password, email_confirm: true }) }));
const prop = await j(await fetch(`${URL}/rest/v1/properties`, { method: 'POST', headers: { ...SH, Prefer: 'return=representation' }, body: JSON.stringify({ landlord_id: user.id, address_line1: '5 Invoice Way', postcode: 'E1 6AN' }) }));
const tok = await j(await fetch(`${URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }) }));
const AT = tok.access_token;
const jt = await j(await fetch(`${URL}/rest/v1/job_types?active=eq.true&select=id,category,price_inc_vat&limit=1`, { headers: SH }));

// build a completed job as service role (invoice auto-creates on completion)
const job = (await j(await fetch(`${URL}/rest/v1/jobs`, { method: 'POST', headers: { ...SH, Prefer: 'return=representation' }, body: JSON.stringify({ property_id: prop[0].id, landlord_id: user.id, job_type_id: jt[0].id, category: jt[0].category, description: 'payment probe', agreed_price_inc_vat: jt[0].price_inc_vat, status: 'in_progress' }) })))[0];
await fetch(`${URL}/rest/v1/jobs?id=eq.${job.id}`, { method: 'PATCH', headers: SH, body: JSON.stringify({ status: 'completed' }) });
let inv = (await j(await fetch(`${URL}/rest/v1/invoices?job_id=eq.${job.id}&select=id,status,total_inc_vat`, { headers: SH })))[0];
check('invoice auto-created on completion', !!inv, inv ? `${inv.status} £${inv.total_inc_vat}` : 'none');

const callLink = async () => {
  const r = await fetch(`${URL}/functions/v1/create-payment-link`, {
    method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${AT}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ job_id: job.id }),
  });
  return [r.status, await j(r)];
};

// 1. normal 'sent' invoice pays fine
let [s1, b1] = await callLink();
check('payable while status=sent', s1 === 200 && typeof b1.url === 'string', `HTTP ${s1} ${JSON.stringify(b1).slice(0, 90)}`);
const firstUrl = b1.url;

// 2. simulate the 72h cron firing -> the state that used to be a dead end
await fetch(`${URL}/rest/v1/invoices?id=eq.${inv.id}`, { method: 'PATCH', headers: SH, body: JSON.stringify({ status: 'auto_captured' }) });
let [s2, b2] = await callLink();
check('STILL payable after 72h auto_captured', s2 === 200 && typeof b2.url === 'string', `HTTP ${s2} ${JSON.stringify(b2).slice(0, 90)}`);

// 3. expired cached link is replaced, not re-served
await fetch(`${URL}/rest/v1/invoices?id=eq.${inv.id}`, { method: 'PATCH', headers: SH, body: JSON.stringify({ stripe_payment_link_expires_at: new Date(Date.now() - 3600_000).toISOString() }) });
let [s3, b3] = await callLink();
check('expired link replaced with a fresh session', s3 === 200 && b3.url && b3.url !== firstUrl, `HTTP ${s3}, new url ${b3.url !== firstUrl}`);

// 4. genuinely paid still blocks
await fetch(`${URL}/rest/v1/invoices?id=eq.${inv.id}`, { method: 'PATCH', headers: SH, body: JSON.stringify({ status: 'paid' }) });
let [s4, b4] = await callLink();
check('paid invoice blocks payment', s4 === 409, `HTTP ${s4} ${JSON.stringify(b4).slice(0, 60)}`);

// 5. disputed still blocks
await fetch(`${URL}/rest/v1/invoices?id=eq.${inv.id}`, { method: 'PATCH', headers: SH, body: JSON.stringify({ status: 'disputed' }) });
let [s5, b5] = await callLink();
check('disputed invoice blocks payment', s5 === 409, `HTTP ${s5} ${JSON.stringify(b5).slice(0, 60)}`);

// 6. someone else's job stays forbidden
const other = await j(await fetch(`${URL}/auth/v1/admin/users`, { method: 'POST', headers: SH, body: JSON.stringify({ email: `other-${Date.now()}@example.com`, password, email_confirm: true }) }));
const otherTok = await j(await fetch(`${URL}/auth/v1/token?grant_type=password`, { method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: other.email, password }) }));
const r6 = await fetch(`${URL}/functions/v1/create-payment-link`, { method: 'POST', headers: { apikey: ANON, Authorization: `Bearer ${otherTok.access_token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ job_id: job.id }) });
check('another landlord cannot get the link', r6.status === 403, `HTTP ${r6.status}`);

// cleanup
await fetch(`${URL}/rest/v1/invoices?job_id=eq.${job.id}`, { method: 'DELETE', headers: SH });
await fetch(`${URL}/rest/v1/job_events?job_id=eq.${job.id}`, { method: 'DELETE', headers: SH });
await fetch(`${URL}/rest/v1/jobs?id=eq.${job.id}`, { method: 'DELETE', headers: SH });
await fetch(`${URL}/rest/v1/properties?id=eq.${prop[0].id}`, { method: 'DELETE', headers: SH });
for (const u of [user.id, other.id]) await fetch(`${URL}/auth/v1/admin/users/${u}`, { method: 'DELETE', headers: SH });
const residue = await j(await fetch(`${URL}/rest/v1/profiles?id=in.(${user.id},${other.id})&select=id`, { headers: SH }));
console.log(`\n${pass} passed, ${fail} failed. residue: ${JSON.stringify(residue)}`);
process.exit(fail ? 1 : 0);
