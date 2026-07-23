// Migration 0018: hours, quotes, the landlord's preferred slot, and the roster.
//
// Each check asserts the STORED value, not the HTTP status — the first version
// of the hardening suite reported "accepted" for a price attack whose value had
// in fact been correctly overwritten (see supabase/tests/hardening.test.mjs).
const URL='https://psmdiezvrnfafqqknyth.supabase.co';
const ANON=process.env.SB_ANON, SVC=process.env.SB_SVC;
const j=async r=>{const t=await r.text();try{return JSON.parse(t)}catch{return t}};
const SH={apikey:SVC,Authorization:`Bearer ${SVC}`,'Content-Type':'application/json'};
let pass=0,fail=0; const ck=(n,ok,d)=>{ok?pass++:fail++;console.log((ok?'PASS  ':'*** FAIL ***  ')+n+(d?' — '+d:''));};

const stamp=Date.now();
const email=`booking-${stamp}@example.com`;
const u=await j(await fetch(`${URL}/auth/v1/admin/users`,{method:'POST',headers:SH,body:JSON.stringify({email,password:'Probe!12345',email_confirm:true})}));
const prop=(await j(await fetch(`${URL}/rest/v1/properties`,{method:'POST',headers:{...SH,Prefer:'return=representation'},body:JSON.stringify({landlord_id:u.id,address_line1:'9 Quote Street',postcode:'N1 7GU'})})))[0];
const t=await j(await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email,password:'Probe!12345'})}));
const UH={apikey:ANON,Authorization:`Bearer ${t.access_token}`,'Content-Type':'application/json'};

const hourly=(await j(await fetch(`${URL}/rest/v1/job_types?active=eq.true&unit=eq.hour&select=id,name,price_inc_vat,additional_unit_price_inc_vat,category&limit=1`,{headers:SH})))[0];
// each hour after the first has its own price (0019); null means repeat the first
const laterHour=Number(hourly.additional_unit_price_inc_vat ?? hourly.price_inc_vat);
const quote=(await j(await fetch(`${URL}/rest/v1/job_types?active=eq.true&requires_quote=eq.true&select=id,name,price_inc_vat,category&limit=1`,{headers:SH})))[0];
const flat=(await j(await fetch(`${URL}/rest/v1/job_types?active=eq.true&unit=eq.job&requires_quote=eq.false&select=id,name,price_inc_vat,category&limit=1`,{headers:SH})))[0];
console.log(`hourly: ${hourly.name} £${hourly.price_inc_vat} | quote: ${quote.name} | flat: ${flat.name} £${flat.price_inc_vat}\n`);

const created=[];
const book=async(type,body={})=>{
  const r=await fetch(`${URL}/rest/v1/jobs`,{method:'POST',headers:{...UH,Prefer:'return=representation'},body:JSON.stringify({property_id:prop.id,landlord_id:u.id,job_type_id:type.id,category:type.category,description:'booking probe',...body})});
  const b=await j(r); const row=Array.isArray(b)?b[0]:null;
  if(row) created.push(row.id);
  return [r.status,row,b];
};

// 1. extra hours are priced server-side: first hour + continuation rate
const expect2=Number(hourly.price_inc_vat)+laterHour;
const [,h2]=await book(hourly,{quantity:2,agreed_price_inc_vat:1});
ck('2 hours = first hour + one continuation hour', h2 && Number(h2.agreed_price_inc_vat)===expect2, h2?`£${h2.agreed_price_inc_vat} for ${h2.quantity}h (expected £${expect2})`:'-');

// 3 hours proves it compounds rather than just adding one flat step
const expect3=Number(hourly.price_inc_vat)+laterHour*2;
const [,h3]=await book(hourly,{quantity:3});
ck('3 hours adds a second continuation hour', h3 && Number(h3.agreed_price_inc_vat)===expect3, h3?`£${h3.agreed_price_inc_vat} (expected £${expect3})`:'-');

// the continuation rate must actually be the cheaper one, or 0019 never landed
ck('later hours cost less than the first', laterHour<Number(hourly.price_inc_vat), `first £${hourly.price_inc_vat}, later £${laterHour}`);

// 2. a client-supplied quantity cannot inflate a flat-price line
const [,f5]=await book(flat,{quantity:5,agreed_price_inc_vat:1});
ck('quantity ignored on a flat-price line', f5 && Number(f5.quantity)===1 && Number(f5.agreed_price_inc_vat)===Number(flat.price_inc_vat), f5?`£${f5.agreed_price_inc_vat} x${f5.quantity}`:'-');

// 3. quantity is clamped, not trusted
const [,h99]=await book(hourly,{quantity:99});
ck('absurd hours clamped to the 8-hour ceiling', h99 && Number(h99.quantity)===8, h99?`${h99.quantity}h`:'-');

// 4. the landlord's preferred slot survives the insert (the tenant-link bug)
const want='2030-01-15T10:00:00.000Z', wantEnd='2030-01-15T12:00:00.000Z';
const [,pref]=await book(flat,{preferred_slot_start:want,preferred_slot_end:wantEnd,scheduled_start:want});
ck('preferred slot is kept', pref && new Date(pref.preferred_slot_start).toISOString()===want, pref?String(pref.preferred_slot_start):'-');
ck('scheduled slot is still the office\'s to set', pref && pref.scheduled_start===null, pref?String(pref.scheduled_start):'-');

// 5. a "something else" line takes no price from the client and stops at requested
const [,q1]=await book(quote,{agreed_price_inc_vat:500,urgency:'standard'});
ck('quote line stores no price', q1 && q1.agreed_price_inc_vat===null, q1?String(q1.agreed_price_inc_vat):'-');
ck('quote line waits at requested', q1 && q1.status==='requested', q1?q1.status:'-');

// 6. only an admin can put a price on it
const r6=await fetch(`${URL}/rest/v1/rpc/price_quote_job`,{method:'POST',headers:UH,body:JSON.stringify({p_job_id:q1.id,p_price:150})});
const after6=(await j(await fetch(`${URL}/rest/v1/jobs?id=eq.${q1.id}&select=agreed_price_inc_vat,status`,{headers:SH})))[0];
ck('landlord cannot quote their own job', r6.status>=400 && after6.agreed_price_inc_vat===null, `HTTP ${r6.status}, stored ${after6.agreed_price_inc_vat}`);

// 7. the office quote lands and moves the job to priced — driven by a real
//    admin through the RPC, not by the service role. The RLS suite once stayed
//    green through a regression that broke every landlord approval because it
//    only ever asserted that the WRONG person is refused.
const adminEmail=`quoter-${stamp}@example.com`;
const adminUser=await j(await fetch(`${URL}/auth/v1/admin/users`,{method:'POST',headers:SH,body:JSON.stringify({email:adminEmail,password:'Probe!12345',email_confirm:true})}));
await fetch(`${URL}/rest/v1/profiles?id=eq.${adminUser.id}`,{method:'PATCH',headers:SH,body:JSON.stringify({role:'admin',full_name:'Quote Probe'})});
const at=await j(await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:adminEmail,password:'Probe!12345'})}));
const AH={apikey:ANON,Authorization:`Bearer ${at.access_token}`,'Content-Type':'application/json'};

const rFloor=await fetch(`${URL}/rest/v1/rpc/price_quote_job`,{method:'POST',headers:AH,body:JSON.stringify({p_job_id:q1.id,p_price:10})});
const afterFloor=(await j(await fetch(`${URL}/rest/v1/jobs?id=eq.${q1.id}&select=agreed_price_inc_vat`,{headers:SH})))[0];
ck('a quote below the call-out floor is refused', rFloor.status>=400 && afterFloor.agreed_price_inc_vat===null, `HTTP ${rFloor.status}, stored ${afterFloor.agreed_price_inc_vat}`);

const r7=await fetch(`${URL}/rest/v1/rpc/price_quote_job`,{method:'POST',headers:AH,body:JSON.stringify({p_job_id:q1.id,p_price:150})});
const after7=(await j(await fetch(`${URL}/rest/v1/jobs?id=eq.${q1.id}&select=agreed_price_inc_vat,status`,{headers:SH})))[0];
ck('the office CAN quote it', r7.status<400 && Number(after7.agreed_price_inc_vat)===150 && after7.status==='priced', `HTTP ${r7.status}, £${after7.agreed_price_inc_vat} ${after7.status}`);

const events=await j(await fetch(`${URL}/rest/v1/job_events?job_id=eq.${q1.id}&to_status=eq.priced&select=note`,{headers:SH}));
ck('the quote is audited in the timeline', Array.isArray(events)&&events.length===1, events?.[0]?.note?.slice(0,40));

const rTwice=await fetch(`${URL}/rest/v1/rpc/price_quote_job`,{method:'POST',headers:AH,body:JSON.stringify({p_job_id:q1.id,p_price:900})});
const afterTwice=(await j(await fetch(`${URL}/rest/v1/jobs?id=eq.${q1.id}&select=agreed_price_inc_vat`,{headers:SH})))[0];
ck('an already-quoted job cannot be re-priced behind the landlord', rTwice.status>=400 && Number(afterTwice.agreed_price_inc_vat)===150, `HTTP ${rTwice.status}, still £${afterTwice.agreed_price_inc_vat}`);

// 8. the landlord approves it — the other half of the quote flow
const r8=await fetch(`${URL}/rest/v1/rpc/transition_job`,{method:'POST',headers:UH,body:JSON.stringify({p_job_id:q1.id,p_to:'approved'})});
const after8=(await j(await fetch(`${URL}/rest/v1/jobs?id=eq.${q1.id}&select=status`,{headers:SH})))[0];
ck('landlord can approve the quote', r8.status<400 && after8.status==='approved', `HTTP ${r8.status}, ${after8.status}`);

// 9. someone off the roster cannot be assigned
const techEmail=`roster-${stamp}@example.com`;
const tech=await j(await fetch(`${URL}/auth/v1/admin/users`,{method:'POST',headers:SH,body:JSON.stringify({email:techEmail,email_confirm:true})}));
await fetch(`${URL}/rest/v1/profiles?id=eq.${tech.id}`,{method:'PATCH',headers:SH,body:JSON.stringify({role:'technician',full_name:'Roster Probe',deactivated_at:new Date().toISOString()})});
const r9=await fetch(`${URL}/rest/v1/jobs?id=eq.${pref.id}`,{method:'PATCH',headers:SH,body:JSON.stringify({assigned_technician_id:tech.id})});
const after9=(await j(await fetch(`${URL}/rest/v1/jobs?id=eq.${pref.id}&select=assigned_technician_id`,{headers:SH})))[0];
ck('a technician off the roster cannot be assigned', r9.status>=400 && after9.assigned_technician_id===null, `HTTP ${r9.status}, stored ${after9.assigned_technician_id}`);

// 10. …and can be put back
await fetch(`${URL}/rest/v1/profiles?id=eq.${tech.id}`,{method:'PATCH',headers:SH,body:JSON.stringify({deactivated_at:null})});
const r10=await fetch(`${URL}/rest/v1/jobs?id=eq.${pref.id}`,{method:'PATCH',headers:SH,body:JSON.stringify({assigned_technician_id:tech.id})});
const after10=(await j(await fetch(`${URL}/rest/v1/jobs?id=eq.${pref.id}&select=assigned_technician_id`,{headers:SH})))[0];
ck('restored to the roster, assignment works', r10.status<400 && after10.assigned_technician_id===tech.id, `HTTP ${r10.status}`);

// 11. a technician cannot take THEMSELF off the roster. RLS lets them write
//     their own profile row, so only the column guard stands between them and
//     silently vanishing from dispatch — a landlord's PATCH would match no rows
//     and prove nothing.
await fetch(`${URL}/auth/v1/admin/users/${tech.id}`,{method:'PUT',headers:SH,body:JSON.stringify({password:'Probe!12345'})});
const tt=await j(await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:techEmail,password:'Probe!12345'})}));
const TH={apikey:ANON,Authorization:`Bearer ${tt.access_token}`,'Content-Type':'application/json'};
const r11=await fetch(`${URL}/rest/v1/profiles?id=eq.${tech.id}`,{method:'PATCH',headers:TH,body:JSON.stringify({deactivated_at:new Date().toISOString()})});
const after11=(await j(await fetch(`${URL}/rest/v1/profiles?id=eq.${tech.id}&select=deactivated_at`,{headers:SH})))[0];
ck('a technician cannot take themself off the roster', r11.status>=400 && after11.deactivated_at===null, `HTTP ${r11.status}, stored ${after11.deactivated_at}`);

// …and the office can
const r11b=await fetch(`${URL}/rest/v1/profiles?id=eq.${tech.id}`,{method:'PATCH',headers:AH,body:JSON.stringify({deactivated_at:new Date().toISOString()})});
const after11b=(await j(await fetch(`${URL}/rest/v1/profiles?id=eq.${tech.id}&select=deactivated_at`,{headers:SH})))[0];
ck('the office CAN take them off the roster', r11b.status<400 && after11b.deactivated_at!==null, `HTTP ${r11b.status}`);

// 12. the quote line is exempt from the call-out floor, priced lines are not
const floorRow=(await j(await fetch(`${URL}/rest/v1/pricing_settings?select=minimum_job_inc_vat`,{headers:SH})))[0];
const under=await fetch(`${URL}/rest/v1/job_types`,{method:'POST',headers:SH,body:JSON.stringify({category:'handyman',name:`floor probe ${stamp}`,price_ex_vat:5,price_inc_vat:5,active:true})});
ck('call-out floor still rejects a cheap priced line', under.status>=400, `floor £${floorRow.minimum_job_inc_vat}, HTTP ${under.status}`);

// cleanup — invoices/events first, they hold the FK that strands a profile row
for(const id of created){
  await fetch(`${URL}/rest/v1/job_events?job_id=eq.${id}`,{method:'DELETE',headers:SH});
  await fetch(`${URL}/rest/v1/jobs?id=eq.${id}`,{method:'DELETE',headers:SH});
}
await fetch(`${URL}/rest/v1/properties?id=eq.${prop.id}`,{method:'DELETE',headers:SH});
await fetch(`${URL}/auth/v1/admin/users/${u.id}`,{method:'DELETE',headers:SH});
await fetch(`${URL}/auth/v1/admin/users/${tech.id}`,{method:'DELETE',headers:SH});
await fetch(`${URL}/auth/v1/admin/users/${adminUser.id}`,{method:'DELETE',headers:SH});
const residue=await j(await fetch(`${URL}/rest/v1/profiles?id=in.(${u.id},${tech.id},${adminUser.id})&select=id`,{headers:SH}));
console.log(`\n${pass} passed, ${fail} failed. residue: ${JSON.stringify(residue)}`);
