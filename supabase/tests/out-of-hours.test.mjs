const URL='https://psmdiezvrnfafqqknyth.supabase.co';
const ANON=process.env.SB_ANON, SVC=process.env.SB_SVC;
const j=async r=>{const t=await r.text();try{return JSON.parse(t)}catch{return t}};
const SH={apikey:SVC,Authorization:`Bearer ${SVC}`,'Content-Type':'application/json'};
let pass=0,fail=0; const ck=(n,ok,d)=>{ok?pass++:fail++;console.log((ok?'PASS  ':'*** FAIL ***  ')+n+(d?' — '+d:''));};

const email=`ooh-${Date.now()}@example.com`;
const u=await j(await fetch(`${URL}/auth/v1/admin/users`,{method:'POST',headers:SH,body:JSON.stringify({email,password:'Probe!12345',email_confirm:true})}));
const prop=(await j(await fetch(`${URL}/rest/v1/properties`,{method:'POST',headers:{...SH,Prefer:'return=representation'},body:JSON.stringify({landlord_id:u.id,address_line1:'1 Emergency Way',postcode:'E1 6AN'})})))[0];
const t=await j(await fetch(`${URL}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email,password:'Probe!12345'})}));
const UH={apikey:ANON,Authorization:`Bearer ${t.access_token}`,'Content-Type':'application/json'};

const ooh=(await j(await fetch(`${URL}/rest/v1/job_types?active=eq.true&out_of_hours_eligible=eq.true&select=id,name,price_inc_vat,category`,{headers:SH})))[0];
const normal=(await j(await fetch(`${URL}/rest/v1/job_types?active=eq.true&out_of_hours_eligible=eq.false&select=id,name,price_inc_vat,category&limit=1`,{headers:SH})))[0];
console.log(`OOH line: ${ooh.name} £${ooh.price_inc_vat} | non-OOH line: ${normal.name} £${normal.price_inc_vat}\n`);

const book=async(type,urgency)=>{
  const r=await fetch(`${URL}/rest/v1/jobs`,{method:'POST',headers:{...UH,Prefer:'return=representation'},body:JSON.stringify({property_id:prop.id,landlord_id:u.id,job_type_id:type.id,category:type.category,description:'ooh probe',agreed_price_inc_vat:1,urgency})});
  return [r.status, await j(r)];
};

// 1. emergency line booked out-of-hours -> 1.75x surcharge
const [s1,b1]=await book(ooh,'out_of_hours');
const jb=Array.isArray(b1)?b1[0]:null;
ck('emergency line is bookable out-of-hours', s1<400 && !!jb, `HTTP ${s1}`);
ck('surcharge applied: 110 x 1.75 = 192.50', jb && Number(jb.agreed_price_inc_vat)===192.5, jb?`£${jb.agreed_price_inc_vat} x${jb.surcharge_multiplier}`:'-');

// 2. same line at standard urgency -> base price, no surcharge
const [,b2]=await book(ooh,'standard');
const jb2=Array.isArray(b2)?b2[0]:null;
ck('same line at standard urgency is base price', jb2 && Number(jb2.agreed_price_inc_vat)===110 && Number(jb2.surcharge_multiplier)===1, jb2?`£${jb2.agreed_price_inc_vat} x${jb2.surcharge_multiplier}`:'-');

// 3. a non-eligible line must still be refused out-of-hours
const [s3,b3]=await book(normal,'out_of_hours');
ck('non-eligible line still refused out-of-hours', s3>=400, `HTTP ${s3} ${JSON.stringify(b3).slice(0,90)}`);

// cleanup
for(const x of [jb,jb2].filter(Boolean)){
  await fetch(`${URL}/rest/v1/job_events?job_id=eq.${x.id}`,{method:'DELETE',headers:SH});
  await fetch(`${URL}/rest/v1/jobs?id=eq.${x.id}`,{method:'DELETE',headers:SH});
}
await fetch(`${URL}/rest/v1/properties?id=eq.${prop.id}`,{method:'DELETE',headers:SH});
await fetch(`${URL}/auth/v1/admin/users/${u.id}`,{method:'DELETE',headers:SH});
console.log(`\n${pass} passed, ${fail} failed. residue: ${JSON.stringify(await j(await fetch(`${URL}/rest/v1/profiles?id=eq.${u.id}&select=id`,{headers:SH})))}`);
