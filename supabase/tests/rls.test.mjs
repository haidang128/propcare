// PropCare RLS isolation test suite (PRD acceptance criterion).
// Creates disposable users, exercises the full permission matrix against the
// LIVE project, and cleans up. Run:
//   SUPABASE_SERVICE_KEY=... node supabase/tests/rls.test.mjs
// (falls back to %TEMP%/sb-service.txt if the env var is unset)

import crypto from 'node:crypto';
import fs from 'node:fs';

const SUPA = 'https://psmdiezvrnfafqqknyth.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBzbWRpZXp2cm5mYWZxcWtueXRoIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODMyMjUwMDksImV4cCI6MjA5ODgwMTAwOX0.1ofM8clPSFFEdiZ-cI_uXHakFMNTGzcOdVm3HImrXq0';
const SERVICE =
  process.env.SUPABASE_SERVICE_KEY ??
  fs.readFileSync((process.env.TEMP ?? '/tmp') + '/sb-service.txt', 'utf8').trim();
const PASS = 'Rls-' + crypto.randomBytes(8).toString('hex');
const stamp = Date.now();

const results = [];
const log = (step, ok, detail = '') => {
  results.push({ step, ok });
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${step}${detail ? ' — ' + detail : ''}`);
};

async function call(key, token, path, opts = {}) {
  const res = await fetch(`${SUPA}${path}`, {
    ...opts,
    headers: {
      apikey: key,
      Authorization: `Bearer ${token ?? key}`,
      'Content-Type': 'application/json',
      Prefer: 'return=representation',
      ...(opts.headers ?? {}),
    },
  });
  const text = await res.text();
  let body;
  try { body = JSON.parse(text); } catch { body = text; }
  return { status: res.status, body };
}
const svc = (path, opts) => call(SERVICE, null, path, opts);
const as = (token, path, opts) => call(ANON, token, path, opts);
const anon = (path, opts) => call(ANON, null, path, opts);

async function createUser(tag) {
  const email = `rls-${tag}-${stamp}@propcare-test.dev`;
  const r = await svc('/auth/v1/admin/users', {
    method: 'POST',
    body: JSON.stringify({ email, password: PASS, email_confirm: true }),
  });
  if (r.status >= 300) throw new Error(`create ${tag}: ${JSON.stringify(r.body)}`);
  return { id: r.body.id, email };
}
async function signIn(email) {
  const res = await fetch(`${SUPA}/auth/v1/token?grant_type=password`, {
    method: 'POST',
    headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password: PASS }),
  });
  const body = await res.json();
  if (!body.access_token) throw new Error(`sign in: ${JSON.stringify(body)}`);
  return body.access_token;
}

const rowCount = (r) => (Array.isArray(r.body) ? r.body.length : -1);

const ids = { users: [], props: [], jobs: [] };

try {
  // ---------- setup ----------
  const [A, B, T1, T2, ADM] = await Promise.all(
    ['landlordA', 'landlordB', 'tech1', 'tech2', 'admin'].map(createUser),
  );
  ids.users = [A, B, T1, T2, ADM].map((u) => u.id);
  await svc(`/rest/v1/profiles?id=eq.${T1.id}`, { method: 'PATCH', body: JSON.stringify({ role: 'technician', full_name: 'RLS Tech1' }) });
  await svc(`/rest/v1/profiles?id=eq.${T2.id}`, { method: 'PATCH', body: JSON.stringify({ role: 'technician', full_name: 'RLS Tech2' }) });
  await svc(`/rest/v1/profiles?id=eq.${ADM.id}`, { method: 'PATCH', body: JSON.stringify({ role: 'admin', full_name: 'RLS Admin' }) });
  const [tA, tB, tT1, tT2, tADM] = await Promise.all([A, B, T1, T2, ADM].map((u) => signIn(u.email)));
  log('setup: users provisioned', true);

  const propA = await as(tA, '/rest/v1/properties', {
    method: 'POST',
    body: JSON.stringify({ landlord_id: A.id, address_line1: 'RLS Flat A', postcode: 'E1 1AA', tenant_name: 'Ten A' }),
  });
  const propB = await as(tB, '/rest/v1/properties', {
    method: 'POST',
    body: JSON.stringify({ landlord_id: B.id, address_line1: 'RLS Flat B', postcode: 'E2 2BB' }),
  });
  ids.props = [propA.body[0].id, propB.body[0].id];

  // active only: retired cards stay in the table for historic jobs (rate card
  // v1 in 0015 deactivated the whole v0 seed rather than deleting it), and
  // guard_job_insert rightly refuses to book an inactive job type.
  const jt = (await as(tA, '/rest/v1/job_types?select=id,category,price_inc_vat&active=eq.true&limit=40')).body;
  const plumbType = jt.find((x) => x.category === 'plumbing');
  const elecType = jt.find((x) => x.category === 'electrical');

  async function makeJob(token, landlordId, propId, type, extra = {}) {
    const r = await as(token, '/rest/v1/jobs', {
      method: 'POST',
      body: JSON.stringify({
        property_id: propId, landlord_id: landlordId, job_type_id: type.id,
        category: type.category, description: 'rls test', agreed_price_inc_vat: type.price_inc_vat, ...extra,
      }),
    });
    if (r.status !== 201) throw new Error('job create: ' + JSON.stringify(r.body));
    ids.jobs.push(r.body[0].id);
    return r.body[0];
  }
  const rpc = (token, jobId, to) =>
    as(token, '/rest/v1/rpc/transition_job', { method: 'POST', body: JSON.stringify({ p_job_id: jobId, p_to: to }) });

  const job1 = await makeJob(tA, A.id, ids.props[0], plumbType);
  await rpc(tA, job1.id, 'priced');
  await rpc(tA, job1.id, 'approved');
  await svc(`/rest/v1/jobs?id=eq.${job1.id}`, { method: 'PATCH', body: JSON.stringify({ assigned_technician_id: T1.id }) });
  await rpc(tADM, job1.id, 'scheduled');
  await rpc(tT1, job1.id, 'in_progress');
  const jobE = await makeJob(tA, A.id, ids.props[0], elecType);
  log('setup: jobs staged', true);

  // ---------- landlord isolation ----------
  log('landlord B cannot see A properties', rowCount(await as(tB, `/rest/v1/properties?id=eq.${ids.props[0]}`)) === 0);
  log('landlord B cannot see A jobs', rowCount(await as(tB, `/rest/v1/jobs?id=eq.${job1.id}`)) === 0);
  log('landlord A cannot read B profile', rowCount(await as(tA, `/rest/v1/profiles?id=eq.${B.id}`)) === 0);
  log('landlord B cannot insert job on A property', (await as(tB, '/rest/v1/jobs', {
    method: 'POST',
    body: JSON.stringify({ property_id: ids.props[0], landlord_id: B.id, category: 'plumbing', description: 'x', job_type_id: plumbType.id }),
  })).status >= 400);

  // ---------- technician isolation ----------
  log('tech1 sees assigned job', rowCount(await as(tT1, `/rest/v1/jobs?id=eq.${job1.id}`)) === 1);
  log('tech2 cannot see unassigned job', rowCount(await as(tT2, `/rest/v1/jobs?id=eq.${job1.id}`)) === 0);
  log('tech1 can read assigned property (address for visit)', rowCount(await as(tT1, `/rest/v1/properties?id=eq.${ids.props[0]}`)) === 1);
  log('tech1 cannot read other property', rowCount(await as(tT1, `/rest/v1/properties?id=eq.${ids.props[1]}`)) === 0);

  // ---------- direct-write lockdown ----------
  await as(tA, `/rest/v1/jobs?id=eq.${job1.id}`, { method: 'PATCH', body: JSON.stringify({ agreed_price_inc_vat: 1 }) });
  const priceAfter = (await svc(`/rest/v1/jobs?id=eq.${job1.id}&select=agreed_price_inc_vat`)).body[0].agreed_price_inc_vat;
  log('landlord cannot change agreed price directly', Number(priceAfter) === Number(plumbType.price_inc_vat), `price=${priceAfter}`);
  await as(tT1, `/rest/v1/jobs?id=eq.${job1.id}`, { method: 'PATCH', body: JSON.stringify({ status: 'paid' }) });
  const statusAfter = (await svc(`/rest/v1/jobs?id=eq.${job1.id}&select=status`)).body[0].status;
  log('technician cannot set status directly', statusAfter === 'in_progress', `status=${statusAfter}`);

  // ---------- state machine role guards ----------
  const j2 = await makeJob(tA, A.id, ids.props[0], plumbType);
  await rpc(tA, j2.id, 'priced');
  log('technician cannot approve a price', (await rpc(tT1, j2.id, 'approved')).status >= 400);
  await rpc(tA, j2.id, 'approved');
  log('landlord cannot schedule (admin action)', (await rpc(tA, j2.id, 'scheduled')).status >= 400);
  log('illegal transition rejected (approved→paid)', (await rpc(tADM, j2.id, 'paid')).status >= 400);

  // ---------- certification enforcement ----------
  const badAssign = await svc(`/rest/v1/jobs?id=eq.${jobE.id}`, { method: 'PATCH', body: JSON.stringify({ assigned_technician_id: T1.id }) });
  log('uncertified tech blocked from electrical job', badAssign.status >= 400, `status=${badAssign.status}`);
  await svc('/rest/v1/technician_certifications', {
    method: 'POST',
    body: JSON.stringify({ technician_id: T2.id, type: 'niceic', reference: 'RLS-1', expires_on: '2030-01-01', verified: true }),
  });
  const goodAssign = await svc(`/rest/v1/jobs?id=eq.${jobE.id}`, { method: 'PATCH', body: JSON.stringify({ assigned_technician_id: T2.id }) });
  log('certified tech can take electrical job', goodAssign.status < 300, `status=${goodAssign.status}`);

  // ---------- internal data stays internal ----------
  await as(tT1, '/rest/v1/time_materials', {
    method: 'POST',
    body: JSON.stringify({ job_id: job1.id, technician_id: T1.id, description: 'rls part', cost: 9.99 }),
  });
  log('landlord cannot read time & materials (even own job)', rowCount(await as(tA, `/rest/v1/time_materials?job_id=eq.${job1.id}`)) === 0);
  log('tech2 cannot log materials on tech1 job', (await as(tT2, '/rest/v1/time_materials', {
    method: 'POST',
    body: JSON.stringify({ job_id: job1.id, technician_id: T2.id, description: 'x', cost: 1 }),
  })).status >= 400);
  log('landlord cannot read access_slots (token table)', rowCount(await as(tA, '/rest/v1/access_slots?select=id&limit=1')) === 0);

  // ---------- variation visibility & decision ----------
  const varIns = await as(tT1, '/rest/v1/variations', {
    method: 'POST',
    body: JSON.stringify({ job_id: job1.id, technician_id: T1.id, note: 'rls extra', status: 'admin_review', old_job_price_inc_vat: plumbType.price_inc_vat }),
  });
  const varId = varIns.body[0].id;
  log('landlord cannot see variation before admin sends it', rowCount(await as(tA, `/rest/v1/variations?id=eq.${varId}`)) === 0);
  await as(tADM, `/rest/v1/variations?id=eq.${varId}`, { method: 'PATCH', body: JSON.stringify({ admin_price_inc_vat: 50, status: 'pending_landlord' }) });
  log('landlord sees variation once pending', rowCount(await as(tA, `/rest/v1/variations?id=eq.${varId}`)) === 1);
  log('another landlord cannot decide the variation', (await as(tB, '/rest/v1/rpc/decide_variation', {
    method: 'POST',
    body: JSON.stringify({ p_variation_id: varId, p_approve: true }),
  })).status >= 400);

  // ---------- anonymous ----------
  log('anon sees no jobs', rowCount(await anon('/rest/v1/jobs?select=id&limit=1')) === 0);
  log('anon sees no rate card', rowCount(await anon('/rest/v1/job_types?select=id&limit=1')) === 0);
  log('anon sees no profiles', rowCount(await anon('/rest/v1/profiles?select=id&limit=1')) === 0);
} catch (e) {
  log('ABORTED', false, e.message);
}

// ---------- cleanup ----------
try {
  for (const j of ids.jobs) {
    await svc(`/rest/v1/job_events?job_id=eq.${j}`, { method: 'DELETE' });
    await svc(`/rest/v1/variations?job_id=eq.${j}`, { method: 'DELETE' });
    await svc(`/rest/v1/time_materials?job_id=eq.${j}`, { method: 'DELETE' });
    await svc(`/rest/v1/invoices?job_id=eq.${j}`, { method: 'DELETE' });
    await svc(`/rest/v1/access_slots?job_id=eq.${j}`, { method: 'DELETE' });
    await svc(`/rest/v1/jobs?id=eq.${j}`, { method: 'DELETE' });
  }
  for (const p of ids.props) await svc(`/rest/v1/properties?id=eq.${p}`, { method: 'DELETE' });
  for (const u of ids.users) await svc(`/auth/v1/admin/users/${u}`, { method: 'DELETE' });
  console.log('cleanup done');
} catch (e) {
  console.log('cleanup issue:', e.message);
}

const failed = results.filter((r) => !r.ok).length;
console.log(`\n${results.length - failed}/${results.length} checks passed`);
process.exit(failed ? 1 : 0);
