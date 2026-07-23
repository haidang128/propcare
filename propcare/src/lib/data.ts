import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { JobStatus } from '@/lib/job-status';
import { pricing } from '@/lib/pricing';

/**
 * Out-of-hours surcharge (PRD decision #11). The live value is admin-editable in
 * `pricing_settings`; this is only the fallback used before settings load.
 */
export const OUT_OF_HOURS_MULTIPLIER = 1.75;

export type Category = 'plumbing' | 'electrical' | 'handyman';
export type Urgency = 'standard' | 'out_of_hours';

export type Property = {
  id: string;
  address_line1: string;
  address_line2: string | null;
  city: string;
  postcode: string;
  tenant_name: string | null;
  tenant_phone: string | null;
};

export type JobType = {
  id: string;
  category: Category;
  name: string;
  price_ex_vat: number;
  price_inc_vat: number;
  /** Emergency lines only — enforced by the jobs_ooh_eligibility trigger too. */
  out_of_hours_eligible: boolean;
  /** 'hour' lines are bought by the hour; everything else is one flat price */
  unit: 'job' | 'hour';
  /** Price of each hour after the first; null = the same as the first hour */
  additional_unit_price_inc_vat: number | null;
  /** No price on the card: the office quotes it before the landlord approves */
  requires_quote: boolean;
};

export type Job = {
  id: string;
  reference: string;
  property_id: string;
  category: Category;
  description: string;
  urgency: Urgency;
  status: JobStatus;
  /** null until the office quotes a "something else" request */
  agreed_price_inc_vat: number | null;
  surcharge_multiplier: number;
  assigned_technician_id: string | null;
  technician_accepted_at: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  /** What the landlord asked for at booking; the tenant confirms the real one */
  preferred_slot_start: string | null;
  preferred_slot_end: string | null;
  /** Hours bought up front on an hourly line; 1 for every flat-price job */
  quantity: number;
  created_at: string;
  property?: Property;
  job_type?: JobType;
};

export type NewPropertyInput = Omit<Property, 'id'>;

export type CertificationType =
  | 'niceic'
  | 'napit'
  | 'wras'
  | 'gas_safe'
  | 'public_liability'
  | 'other';

export type Certification = {
  /** absent on the technician's own read-only view of their documents */
  id?: string;
  type: CertificationType;
  reference?: string | null;
  expires_on: string;
  verified: boolean;
};

export type Technician = {
  id: string;
  full_name: string;
  phone: string | null;
  certifications: Certification[];
};

/** UI mirror of the DB trigger rule: electrical needs a valid NICEIC/NAPIT cert. */
export function isEligible(tech: Technician, category: Category): boolean {
  if (category !== 'electrical') return true;
  const today = new Date().toISOString().slice(0, 10);
  return tech.certifications.some(
    (c) => (c.type === 'niceic' || c.type === 'napit') && c.verified && c.expires_on >= today,
  );
}

export type NewJobDraft = {
  property: Property;
  jobType: JobType;
  description: string;
  photoUris: string[];
  urgency: Urgency;
  slot: { start: string; end: string } | null;
  /** Hours, for an hourly line. Ignored (forced to 1) on a flat-price line. */
  quantity?: number;
};

/** True when the surcharge tier is offered at all for this job type. */
export function canBookOutOfHours(jobType: JobType): boolean {
  return (
    jobType.out_of_hours_eligible &&
    !jobType.requires_quote &&
    pricing().out_of_hours_multiplier > 1
  );
}

/** Hours can only be bought on an hourly line. */
export function maxUnits(jobType: JobType): number {
  return jobType.unit === 'hour' && !jobType.requires_quote ? 8 : 1;
}

/**
 * Mirrors guard_job_insert() in supabase/migrations/0018. The database is the
 * authority — this is what we show before it answers.
 * Returns null for a line the office has to quote.
 */
export function jobPrice(jobType: JobType, urgency: Urgency, quantity = 1): number | null {
  if (jobType.requires_quote) return null;
  const { out_of_hours_multiplier, minimum_job_inc_vat } = pricing();
  const first = Math.max(jobType.price_inc_vat, minimum_job_inc_vat);
  const units = Math.min(Math.max(quantity, 1), maxUnits(jobType));
  const extra = jobType.additional_unit_price_inc_vat ?? first;
  const base = first + (units - 1) * extra;
  return urgency === 'out_of_hours' && canBookOutOfHours(jobType)
    ? Math.round(base * out_of_hours_multiplier * 100) / 100
    : base;
}

// ========== Demo fallback (preview mode, until Supabase schema is applied) ==========

const demo = {
  properties: [
    {
      id: 'p1',
      address_line1: 'Flat 2, 14 Berwick Street',
      address_line2: 'Soho',
      city: 'London',
      postcode: 'W1F 0PP',
      tenant_name: 'Priya Sharma',
      tenant_phone: '07700 900412',
    },
    {
      id: 'p2',
      address_line1: '86 Chatsworth Road',
      address_line2: 'Hackney',
      city: 'London',
      postcode: 'E5 0LS',
      tenant_name: 'Tom & Ella W.',
      tenant_phone: '07700 900523',
    },
  ] as Property[],
  jobTypes: [
    { id: 'jt1', category: 'plumbing', name: 'Dripping / leaking tap repair', price_ex_vat: 95, price_inc_vat: 95, out_of_hours_eligible: false, unit: 'job', additional_unit_price_inc_vat: null, requires_quote: false },
    { id: 'jt2', category: 'plumbing', name: 'Sink / bath / shower unblock', price_ex_vat: 105, price_inc_vat: 105, out_of_hours_eligible: false, unit: 'job', additional_unit_price_inc_vat: null, requires_quote: false },
    // The one emergency line — the only job bookable out of hours.
    { id: 'jt3', category: 'plumbing', name: 'Isolate + make safe (leak emergency)', price_ex_vat: 110, price_inc_vat: 110, out_of_hours_eligible: true, unit: 'job', additional_unit_price_inc_vat: null, requires_quote: false },
    // No boiler/hot-water line: gas is deferred until Gas Safe vetting (PRD decision #6).
    { id: 'jt4', category: 'electrical', name: 'Socket replacement', price_ex_vat: 85, price_inc_vat: 85, out_of_hours_eligible: false, unit: 'job', additional_unit_price_inc_vat: null, requires_quote: false },
    { id: 'jt5', category: 'electrical', name: 'Fault-find first hour', price_ex_vat: 95, price_inc_vat: 95, out_of_hours_eligible: false, unit: 'hour', additional_unit_price_inc_vat: null, requires_quote: false },
    { id: 'jt6', category: 'handyman', name: 'General handyman hour', price_ex_vat: 95, price_inc_vat: 95, out_of_hours_eligible: false, unit: 'hour', additional_unit_price_inc_vat: null, requires_quote: false },
    { id: 'jt7', category: 'handyman', name: 'Lock replacement', price_ex_vat: 95, price_inc_vat: 95, out_of_hours_eligible: false, unit: 'job', additional_unit_price_inc_vat: null, requires_quote: false },
    { id: 'jt8', category: 'handyman', name: "Something else — we'll quote it", price_ex_vat: 0, price_inc_vat: 0, out_of_hours_eligible: false, unit: 'job', additional_unit_price_inc_vat: null, requires_quote: true },
  ] as JobType[],
  jobs: [] as Job[],
  counter: 2041,
  technicians: [
    {
      id: 't1',
      full_name: 'Sam Okafor',
      phone: '07700 900101',
      certifications: [
        { type: 'wras', expires_on: '2027-03-03', verified: true },
        { type: 'public_liability', expires_on: '2027-03-03', verified: true },
      ],
    },
    {
      id: 't2',
      full_name: 'Lena Kowalska',
      phone: '07700 900102',
      certifications: [
        { type: 'niceic', expires_on: '2026-11-18', verified: true },
        { type: 'public_liability', expires_on: '2027-01-10', verified: true },
      ],
    },
    {
      id: 't3',
      full_name: 'Marco Tan',
      phone: '07700 900103',
      certifications: [{ type: 'public_liability', expires_on: '2026-12-01', verified: true }],
    },
  ] as Technician[],
};

// ========== API ==========

export async function listProperties(): Promise<Property[]> {
  if (!isSupabaseConfigured) return [...demo.properties];
  const { data, error } = await supabase!.from('properties').select('*').order('created_at');
  if (error) throw new Error(error.message);
  return data as Property[];
}

export async function addProperty(input: NewPropertyInput): Promise<Property> {
  if (!isSupabaseConfigured) {
    const p = { ...input, id: `p${demo.properties.length + 1}` };
    demo.properties.push(p);
    return p;
  }
  const { data: userData } = await supabase!.auth.getUser();
  const { data, error } = await supabase!
    .from('properties')
    .insert({ ...input, landlord_id: userData.user?.id })
    .select()
    .single();
  if (error) throw new Error(error.message);
  return data as Property;
}

export async function listJobTypes(): Promise<JobType[]> {
  if (!isSupabaseConfigured) return [...demo.jobTypes];
  const { data, error } = await supabase!
    .from('job_types')
    .select(
      'id, category, name, price_ex_vat, price_inc_vat, out_of_hours_eligible, unit, additional_unit_price_inc_vat, requires_quote',
    )
    .eq('active', true)
    // "Something else" is priced 0, so price order would float it to the top of
    // the list it is meant to be the last resort for
    .order('requires_quote')
    .order('price_inc_vat');
  if (error) throw new Error(error.message);
  return (data as any[]).map((t) => ({
    ...t,
    additional_unit_price_inc_vat:
      t.additional_unit_price_inc_vat == null ? null : Number(t.additional_unit_price_inc_vat),
  })) as JobType[];
}

const ACTIVE_STATUSES: JobStatus[] = [
  'requested', 'priced', 'approved', 'scheduled', 'in_progress',
  'variation_pending', 'awaiting_parts', 'rescheduled', 'completed', 'disputed',
];

export async function listActiveJobs(): Promise<Job[]> {
  if (!isSupabaseConfigured) {
    return demo.jobs.filter((j) => ACTIVE_STATUSES.includes(j.status));
  }
  const { data, error } = await supabase!
    .from('jobs')
    .select('*, property:properties(*), job_type:job_types(*)')
    .in('status', ACTIVE_STATUSES)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return data as Job[];
}

export async function getJob(id: string): Promise<Job | null> {
  if (!isSupabaseConfigured) return demo.jobs.find((j) => j.id === id) ?? null;
  const { data, error } = await supabase!
    .from('jobs')
    .select('*, property:properties(*), job_type:job_types(*)')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as Job;
}

// ========== Admin: dispatch ==========

/** Statuses the dispatcher works: approved jobs need assignment + scheduling. */
const DISPATCH_STATUSES: JobStatus[] = ['requested', 'priced', 'approved', 'access_failed', 'rescheduled'];

export async function listIncomingJobs(): Promise<Job[]> {
  if (!isSupabaseConfigured) {
    return demo.jobs.filter((j) => DISPATCH_STATUSES.includes(j.status) && !j.assigned_technician_id);
  }
  const { data, error } = await supabase!
    .from('jobs')
    .select('*, property:properties(*), job_type:job_types(*)')
    .in('status', DISPATCH_STATUSES)
    .is('assigned_technician_id', null)
    .order('created_at'); // oldest first (design A1)
  if (error) throw new Error(error.message);
  return data as Job[];
}

export async function listTechnicians(): Promise<Technician[]> {
  if (!isSupabaseConfigured) return [...demo.technicians];
  const { data, error } = await supabase!
    .from('profiles')
    .select('id, full_name, phone, certifications:technician_certifications(type, expires_on, verified)')
    .eq('role', 'technician')
    // someone off the roster cannot be assigned; the DB refuses it too
    .is('deactivated_at', null);
  if (error) throw new Error(error.message);
  return data as Technician[];
}

/**
 * Everything the office has under way. The dispatch board only ever listed
 * unassigned requests, so the moment a job was assigned it fell off every admin
 * screen — nobody could see who was on what, or that a job had started.
 */
const IN_FLIGHT_STATUSES: JobStatus[] = [
  'scheduled', 'in_progress', 'variation_pending', 'awaiting_parts', 'completed', 'disputed',
];

export type DispatchJob = Job & { technician?: { full_name: string } | null };

export async function listJobsInFlight(): Promise<DispatchJob[]> {
  if (!isSupabaseConfigured) {
    return demo.jobs.filter((j) => IN_FLIGHT_STATUSES.includes(j.status));
  }
  const { data, error } = await supabase!
    .from('jobs')
    .select(
      '*, property:properties(*), job_type:job_types(*), technician:profiles!jobs_assigned_technician_id_fkey(full_name)',
    )
    .in('status', IN_FLIGHT_STATUSES)
    .order('scheduled_start', { nullsFirst: false });
  if (error) throw new Error(error.message);
  return data as DispatchJob[];
}

/** Office puts a price on a "something else" request; the landlord then approves it. */
export async function quoteJob(jobId: string, price: number): Promise<void> {
  if (!isSupabaseConfigured) {
    const j = demo.jobs.find((x) => x.id === jobId);
    if (j) {
      j.agreed_price_inc_vat = price;
      j.status = 'priced';
    }
    return;
  }
  const { error } = await supabase!.rpc('price_quote_job', { p_job_id: jobId, p_price: price });
  if (error) throw new Error(error.message);
}

/**
 * The three windows the tenant gets to choose between. The first is the slot
 * the landlord asked for in the wizard; the other two are the same window on
 * the next two days, so the tenant always has an out.
 *
 * This used to read job.scheduled_start, which guard_job_insert deliberately
 * nulls on a landlord insert — so the landlord's choice was thrown away and
 * every tenant was offered "tomorrow, at whatever o'clock it is now" instead.
 * The preference now has its own column and survives.
 */
function offeredSlotsFor(job: Job): { start: string; end: string }[] {
  const preferred = job.preferred_slot_start ?? job.scheduled_start;
  const preferredEnd = job.preferred_slot_end ?? job.scheduled_end;
  const durationMs =
    preferred && preferredEnd
      ? new Date(preferredEnd).getTime() - new Date(preferred).getTime()
      : 2 * 3600000;

  // a preference that has already passed helps nobody: fall back to the same
  // time of day tomorrow, on the hour
  let base = preferred ? new Date(preferred) : new Date(Date.now() + 86400000);
  if (base.getTime() < Date.now()) {
    const next = new Date(Date.now() + 86400000);
    next.setHours(preferred ? new Date(preferred).getHours() : 10, 0, 0, 0);
    base = next;
  }

  return [0, 1, 2].map((days) => {
    const start = new Date(base.getTime() + days * 86400000);
    return { start: start.toISOString(), end: new Date(start.getTime() + durationMs).toISOString() };
  });
}

/**
 * Assign + schedule: sets the technician (DB trigger enforces certification),
 * moves approved → scheduled, and creates the tenant access-slot link.
 * Returns the tenant URL to send (SMS automation comes later; share it for now).
 */
export async function assignJob(job: Job, technicianId: string): Promise<string | null> {
  if (!isSupabaseConfigured) {
    const j = demo.jobs.find((x) => x.id === job.id);
    if (j) {
      j.assigned_technician_id = technicianId;
      if (j.status === 'approved') j.status = 'scheduled';
    }
    return null;
  }
  const sb = supabase!;
  const { error } = await sb
    .from('jobs')
    .update({ assigned_technician_id: technicianId })
    .eq('id', job.id);
  if (error) throw new Error(error.message);
  if (job.status === 'approved') {
    const { error: e } = await sb.rpc('transition_job', { p_job_id: job.id, p_to: 'scheduled' });
    if (e) throw new Error(e.message);
  }

  const { data: slot, error: slotErr } = await sb
    .from('access_slots')
    .insert({ job_id: job.id, offered_slots: offeredSlotsFor(job) })
    .select('token')
    .single();
  if (slotErr || !slot) return null;

  const base = process.env.EXPO_PUBLIC_APP_URL ?? 'http://localhost:8081';
  return `${base}/visit/${slot.token}`;
}

/** Public tenant endpoint (no login — token is the credential). */
export const TENANT_ACCESS_ENDPOINT = process.env.EXPO_PUBLIC_SUPABASE_URL
  ? `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/tenant-access`
  : null;

// ========== Technician: my jobs + status updates ==========

export async function listAssignedJobs(): Promise<Job[]> {
  if (!isSupabaseConfigured) {
    return demo.jobs.filter((j) => j.assigned_technician_id && ACTIVE_STATUSES.includes(j.status));
  }
  const sb = supabase!;
  const { data: userData } = await sb.auth.getUser();
  const { data, error } = await sb
    .from('jobs')
    .select('*, property:properties(*), job_type:job_types(*)')
    .eq('assigned_technician_id', userData.user?.id ?? '')
    .in('status', ACTIVE_STATUSES)
    .order('scheduled_start');
  if (error) throw new Error(error.message);
  return data as Job[];
}

/** One audited move through the state machine (validated server-side). */
export async function transitionJobStatus(jobId: string, to: JobStatus, note?: string): Promise<void> {
  if (!isSupabaseConfigured) {
    const j = demo.jobs.find((x) => x.id === jobId);
    if (j) j.status = to;
    return;
  }
  const { error } = await supabase!.rpc('transition_job', {
    p_job_id: jobId,
    p_to: to,
    ...(note ? { p_note: note } : {}),
  });
  if (error) throw new Error(error.message);
}

/** Accept keeps the job; decline returns it to the dispatch queue for reassignment. */
export async function respondToAssignment(jobId: string, accept: boolean): Promise<void> {
  if (!isSupabaseConfigured) {
    const j = demo.jobs.find((x) => x.id === jobId);
    if (j) {
      if (accept) {
        j.technician_accepted_at = new Date().toISOString();
      } else {
        j.assigned_technician_id = null;
        j.technician_accepted_at = null;
        if (j.status === 'scheduled') j.status = 'rescheduled';
      }
    }
    return;
  }
  const { error } = await supabase!.rpc('respond_to_assignment', {
    p_job_id: jobId,
    p_accept: accept,
  });
  if (error) throw new Error(error.message);
}

// ========== Time & materials (internal — landlord never sees this) ==========

export type TimeMaterial = {
  id: string;
  description: string;
  cost: number | null;
  minutes: number | null;
};

const demoMaterials: Record<string, TimeMaterial[]> = {};

export async function listTimeMaterials(jobId: string): Promise<TimeMaterial[]> {
  if (!isSupabaseConfigured) return demoMaterials[jobId] ?? [];
  const { data, error } = await supabase!
    .from('time_materials')
    .select('id, description, cost, minutes')
    .eq('job_id', jobId)
    .order('created_at');
  if (error) throw new Error(error.message);
  return data as TimeMaterial[];
}

export async function addTimeMaterial(
  jobId: string,
  entry: { description: string; cost?: number; minutes?: number },
): Promise<void> {
  if (!isSupabaseConfigured) {
    (demoMaterials[jobId] ??= []).push({
      id: `tm${Date.now()}`,
      description: entry.description,
      cost: entry.cost ?? null,
      minutes: entry.minutes ?? null,
    });
    return;
  }
  const sb = supabase!;
  const { data: userData } = await sb.auth.getUser();
  const { error } = await sb.from('time_materials').insert({
    job_id: jobId,
    technician_id: userData.user?.id,
    description: entry.description,
    cost: entry.cost ?? null,
    minutes: entry.minutes ?? null,
  });
  if (error) throw new Error(error.message);
}

export async function uploadJobPhoto(jobId: string, uri: string, kind: 'before' | 'after'): Promise<void> {
  if (!isSupabaseConfigured) return;
  const sb = supabase!;
  const { data: userData } = await sb.auth.getUser();
  const res = await fetch(uri);
  const body = await res.arrayBuffer();
  const path = `${jobId}/${kind}-${Date.now()}.jpg`;
  const { error } = await sb.storage.from('job-photos').upload(path, body, { contentType: 'image/jpeg' });
  if (error) throw new Error(error.message);
  await sb.from('job_photos').insert({
    job_id: jobId,
    kind,
    storage_path: path,
    uploaded_by: userData.user?.id,
  });
}

// ========== Variations (the "no surprise bills" machinery) ==========

export type VariationStatus = 'flagged' | 'admin_review' | 'pending_landlord' | 'approved' | 'declined';

export type Variation = {
  id: string;
  job_id: string;
  note: string;
  status: VariationStatus;
  suggested_price_inc_vat: number | null;
  admin_price_inc_vat: number | null;
  old_job_price_inc_vat: number;
  new_job_price_inc_vat: number | null;
  created_at: string;
  job?: Job;
};

const demoVariations: Variation[] = [];

/** Technician flags extra work: variation row + photos + job pauses (in_progress → variation_pending). */
export async function flagVariation(
  job: Job,
  input: { note: string; photoUris: string[]; suggestedPrice?: number },
): Promise<void> {
  if (!isSupabaseConfigured) {
    demoVariations.push({
      id: `v${Date.now()}`,
      job_id: job.id,
      note: input.note,
      status: 'admin_review',
      suggested_price_inc_vat: input.suggestedPrice ?? null,
      admin_price_inc_vat: null,
      old_job_price_inc_vat: job.agreed_price_inc_vat ?? 0,
      new_job_price_inc_vat: null,
      created_at: new Date().toISOString(),
      job,
    });
    const j = demo.jobs.find((x) => x.id === job.id);
    if (j) j.status = 'variation_pending';
    return;
  }
  const sb = supabase!;
  const { data: userData } = await sb.auth.getUser();
  const { data: inserted, error } = await sb
    .from('variations')
    .insert({
      job_id: job.id,
      technician_id: userData.user?.id,
      note: input.note,
      status: 'admin_review',
      suggested_price_inc_vat: input.suggestedPrice ?? null,
      old_job_price_inc_vat: job.agreed_price_inc_vat,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);

  const { error: tErr } = await sb.rpc('transition_job', {
    p_job_id: job.id,
    p_to: 'variation_pending',
    p_note: `Variation flagged: ${input.note.slice(0, 120)}`,
  });
  if (tErr) throw new Error(tErr.message);

  for (const uri of input.photoUris) {
    try {
      const res = await fetch(uri);
      const body = await res.arrayBuffer();
      const path = `${job.id}/variation-${inserted.id}-${Date.now()}.jpg`;
      const { error: upErr } = await sb.storage
        .from('job-photos')
        .upload(path, body, { contentType: 'image/jpeg' });
      if (!upErr) {
        await sb.from('job_photos').insert({
          job_id: job.id,
          kind: 'variation',
          storage_path: path,
          uploaded_by: userData.user?.id,
        });
      }
    } catch {
      // best-effort; the variation itself is already flagged
    }
  }
}

/** Admin queue: variations awaiting review. */
/**
 * The office queue. Two kinds of work land here:
 *  - 'flagged'/'admin_review': needs pricing before it reaches the landlord.
 *  - 'declined' while the job is still paused: the landlord said no, and by
 *    policy that pauses the job at no charge for the office to rearrange or
 *    cancel. Without this second case the job appears in no queue at all —
 *    the landlord sees nothing pending, the technician's buttons are all
 *    disabled, and only a manual database edit would unstick it.
 */
export async function listPendingVariations(): Promise<Variation[]> {
  if (!isSupabaseConfigured) {
    return demoVariations.filter(
      (v) =>
        v.status === 'flagged' ||
        v.status === 'admin_review' ||
        (v.status === 'declined' &&
          demo.jobs.find((j) => j.id === v.job_id)?.status === 'variation_pending'),
    );
  }
  const { data, error } = await supabase!
    .from('variations')
    .select('*, job:jobs(*, property:properties(*), job_type:job_types(*))')
    .in('status', ['flagged', 'admin_review', 'declined'])
    .order('created_at');
  if (error) throw new Error(error.message);
  // a declined variation only needs the office while its job is still paused
  return (data as Variation[]).filter(
    (v) => v.status !== 'declined' || v.job?.status === 'variation_pending',
  );
}

/**
 * Everything the office should be able to see, not only what it has to act on.
 * A variation sent to the landlord left the queue and appeared nowhere at all,
 * so a technician could be stood in a flat waiting on a decision no one could
 * see was outstanding.
 */
export async function listAllVariations(): Promise<Variation[]> {
  if (!isSupabaseConfigured) return [...demoVariations];
  const { data, error } = await supabase!
    .from('variations')
    .select('*, job:jobs(*, property:properties(*), job_type:job_types(*))')
    .order('created_at', { ascending: false })
    .limit(50);
  if (error) throw new Error(error.message);
  return data as Variation[];
}

/** True when this variation is a landlord decline still waiting on the office. */
export function needsOfficeResolution(v: Variation): boolean {
  return v.status === 'declined' && v.job?.status === 'variation_pending';
}

/**
 * Office resolution after a landlord declines: resume the original scope at the
 * original price, or call the job off. Both are admin-only in the database.
 */
export async function resolveDeclinedVariation(
  variation: Variation,
  outcome: 'resume' | 'cancel',
): Promise<void> {
  const to: JobStatus = outcome === 'resume' ? 'in_progress' : 'cancelled';
  const note =
    outcome === 'resume'
      ? 'Landlord declined the extra work — job resumes at the original price and original scope'
      : 'Landlord declined the extra work — job cancelled by the office, nothing charged';
  if (!isSupabaseConfigured) {
    const j = demo.jobs.find((x) => x.id === variation.job_id);
    if (j) j.status = to;
    return;
  }
  const { error } = await supabase!.rpc('transition_job', {
    p_job_id: variation.job_id,
    p_to: to,
    p_note: note,
  });
  if (error) throw new Error(error.message);
}

export async function getVariation(id: string): Promise<Variation | null> {
  if (!isSupabaseConfigured) return demoVariations.find((v) => v.id === id) ?? null;
  const { data, error } = await supabase!
    .from('variations')
    .select('*, job:jobs(*, property:properties(*), job_type:job_types(*))')
    .eq('id', id)
    .single();
  if (error) return null;
  return data as Variation;
}

/** Admin prices the variation and sends it to the landlord. */
export async function sendVariationToLandlord(variationId: string, adminPrice: number): Promise<void> {
  if (!isSupabaseConfigured) {
    const v = demoVariations.find((x) => x.id === variationId);
    if (v) {
      v.admin_price_inc_vat = adminPrice;
      v.status = 'pending_landlord';
    }
    return;
  }
  const { error } = await supabase!
    .from('variations')
    .update({ admin_price_inc_vat: adminPrice, status: 'pending_landlord' })
    .eq('id', variationId);
  if (error) throw new Error(error.message);
}

/** Admin rejects the flag outright: variation declined, work resumes at the original price. */
export async function rejectVariation(variation: Variation): Promise<void> {
  if (!isSupabaseConfigured) {
    const v = demoVariations.find((x) => x.id === variation.id);
    if (v) v.status = 'declined';
    const j = demo.jobs.find((x) => x.id === variation.job_id);
    if (j && j.status === 'variation_pending') j.status = 'in_progress';
    return;
  }
  const sb = supabase!;
  const { error } = await sb.from('variations').update({ status: 'declined' }).eq('id', variation.id);
  if (error) throw new Error(error.message);
  const { error: tErr } = await sb.rpc('transition_job', {
    p_job_id: variation.job_id,
    p_to: 'in_progress',
    p_note: 'Variation rejected by office — job resumes at the original price',
  });
  if (tErr) throw new Error(tErr.message);
}

/** Landlord's pending variation for a job, if any. */
export async function getPendingVariationForJob(jobId: string): Promise<Variation | null> {
  if (!isSupabaseConfigured) {
    return demoVariations.find((v) => v.job_id === jobId && v.status === 'pending_landlord') ?? null;
  }
  const { data, error } = await supabase!
    .from('variations')
    .select('*')
    .eq('job_id', jobId)
    .eq('status', 'pending_landlord')
    .maybeSingle();
  if (error) return null;
  return data as Variation | null;
}

/** The landlord's decision — priced and audited server-side (decide_variation RPC). */
export async function decideVariation(variation: Variation, approve: boolean): Promise<void> {
  if (!isSupabaseConfigured) {
    const v = demoVariations.find((x) => x.id === variation.id);
    const j = demo.jobs.find((x) => x.id === variation.job_id);
    if (v && j) {
      if (approve && v.admin_price_inc_vat != null) {
        v.status = 'approved';
        v.new_job_price_inc_vat = v.old_job_price_inc_vat + v.admin_price_inc_vat;
        j.agreed_price_inc_vat = v.new_job_price_inc_vat;
        j.status = 'in_progress';
      } else {
        v.status = 'declined';
      }
    }
    return;
  }
  const { error } = await supabase!.rpc('decide_variation', {
    p_variation_id: variation.id,
    p_approve: approve,
  });
  if (error) throw new Error(error.message);
}

// ========== Completion, payment & rating ==========

export type Invoice = {
  id: string;
  number: string;
  total_inc_vat: number;
  status: 'draft' | 'sent' | 'paid' | 'auto_captured' | 'disputed';
  stripe_payment_link: string | null;
  capture_deadline: string | null;
};

const demoInvoices: Record<string, Invoice> = {};
const demoRatings: Record<string, { stars: number; comment: string | null }> = {};

export async function getInvoice(jobId: string): Promise<Invoice | null> {
  if (!isSupabaseConfigured) {
    const job = demo.jobs.find((j) => j.id === jobId);
    if (job && ['completed', 'paid', 'disputed'].includes(job.status) && !demoInvoices[jobId]) {
      demoInvoices[jobId] = {
        id: `inv-${jobId}`,
        number: job.reference,
        total_inc_vat: job.agreed_price_inc_vat ?? 0,
        status: job.status === 'paid' ? 'paid' : job.status === 'disputed' ? 'disputed' : 'sent',
        stripe_payment_link: null,
        capture_deadline: new Date(Date.now() + 72 * 3600000).toISOString(),
      };
    }
    return demoInvoices[jobId] ?? null;
  }
  const { data, error } = await supabase!
    .from('invoices')
    .select('id, number, total_inc_vat, status, stripe_payment_link, capture_deadline')
    .eq('job_id', jobId)
    .maybeSingle();
  if (error) return null;
  return data as Invoice | null;
}

export async function getRating(jobId: string): Promise<{ stars: number; comment: string | null } | null> {
  if (!isSupabaseConfigured) return demoRatings[jobId] ?? null;
  const { data } = await supabase!
    .from('ratings')
    .select('stars, comment')
    .eq('job_id', jobId)
    .maybeSingle();
  return data ?? null;
}

export async function submitRating(jobId: string, stars: number, comment: string): Promise<void> {
  if (!isSupabaseConfigured) {
    demoRatings[jobId] = { stars, comment: comment || null };
    return;
  }
  const sb = supabase!;
  const { data: userData } = await sb.auth.getUser();
  const { error } = await sb.from('ratings').insert({
    job_id: jobId,
    landlord_id: userData.user?.id,
    stars,
    comment: comment || null,
  });
  if (error) throw new Error(error.message);
}

/** Disputed blocks payment capture until admin resolution (PRD). */
export async function raiseDispute(jobId: string, reason: string): Promise<void> {
  await transitionJobStatus(jobId, 'disputed', reason);
}

/** Ask the Edge Function for the Stripe URL. 501 until Stripe keys are configured. */
export async function requestPaymentLink(jobId: string): Promise<{ url?: string; error?: string }> {
  if (!isSupabaseConfigured) return { error: 'Payments are not available in preview mode.' };
  const sb = supabase!;
  const { data: sessionData } = await sb.auth.getSession();
  const token = sessionData.session?.access_token;
  const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/create-payment-link`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
      apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    },
    body: JSON.stringify({ job_id: jobId }),
  });
  const body = await res.json().catch(() => ({}));
  if (res.status === 501) return { error: 'Online payment is being set up — you\'ll be able to pay here soon.' };
  if (!res.ok) return { error: body.error ?? 'Could not create payment link.' };
  return { url: body.url };
}

// ========== Property history (the tax / insurance / resale record) ==========

export type HistoryEntry = Job & { invoice?: Invoice | null };

export async function listPropertyHistory(propertyId: string): Promise<HistoryEntry[]> {
  if (!isSupabaseConfigured) {
    return demo.jobs.filter((j) => j.property_id === propertyId);
  }
  const { data, error } = await supabase!
    .from('jobs')
    .select('*, property:properties(*), job_type:job_types(*), invoice:invoices(id, number, total_inc_vat, status, stripe_payment_link, capture_deadline)')
    .eq('property_id', propertyId)
    .order('created_at', { ascending: false });
  if (error) throw new Error(error.message);
  return (data as (Job & { invoice: Invoice | Invoice[] | null })[]).map((j) => ({
    ...j,
    invoice: Array.isArray(j.invoice) ? (j.invoice[0] ?? null) : j.invoice,
  }));
}

export async function getProperty(id: string): Promise<Property | null> {
  if (!isSupabaseConfigured) return demo.properties.find((p) => p.id === id) ?? null;
  const { data } = await supabase!.from('properties').select('*').eq('id', id).maybeSingle();
  return (data as Property) ?? null;
}

// ========== On-call pool (out-of-hours opt-in) ==========

export async function getOnCall(): Promise<boolean> {
  if (!isSupabaseConfigured) return false;
  const sb = supabase!;
  const { data: userData } = await sb.auth.getUser();
  const { data } = await sb
    .from('on_call_optins')
    .select('active')
    .eq('technician_id', userData.user?.id ?? '')
    .maybeSingle();
  return data?.active ?? false;
}

export async function setOnCall(active: boolean): Promise<void> {
  if (!isSupabaseConfigured) return;
  const sb = supabase!;
  const { data: userData } = await sb.auth.getUser();
  const { error } = await sb
    .from('on_call_optins')
    .upsert({ technician_id: userData.user?.id, active, updated_at: new Date().toISOString() });
  if (error) throw new Error(error.message);
}

export async function listMyCertifications(): Promise<Certification[]> {
  if (!isSupabaseConfigured) return demo.technicians[0].certifications;
  const sb = supabase!;
  const { data: userData } = await sb.auth.getUser();
  const { data } = await sb
    .from('technician_certifications')
    .select('type, expires_on, verified')
    .eq('technician_id', userData.user?.id ?? '')
    .order('expires_on');
  return (data as Certification[]) ?? [];
}

/** Registry view: technicians + certs + on-call state + cost (admin). */
export type RegistryTechnician = Technician & {
  email: string | null;
  on_call: boolean;
  pay_rate_per_hour: number | null;
  /** set when they leave the roster; history stays, new work does not */
  deactivated_at: string | null;
};

export async function listRegistryTechnicians(): Promise<RegistryTechnician[]> {
  if (!isSupabaseConfigured) {
    return demo.technicians.map((t, i) => ({
      ...t,
      email: `${t.full_name.split(' ')[0].toLowerCase()}@example.com`,
      on_call: i === 0,
      pay_rate_per_hour: null,
      deactivated_at: null,
    }));
  }
  const { data, error } = await supabase!
    .from('profiles')
    .select(
      'id, full_name, phone, email, pay_rate_per_hour, deactivated_at, certifications:technician_certifications(id, type, reference, expires_on, verified), oncall:on_call_optins(active)',
    )
    .eq('role', 'technician')
    .order('deactivated_at', { nullsFirst: true })
    .order('full_name');
  if (error) throw new Error(error.message);
  return (data as any[]).map((t) => ({
    id: t.id,
    full_name: t.full_name,
    phone: t.phone,
    email: t.email ?? null,
    pay_rate_per_hour: t.pay_rate_per_hour == null ? null : Number(t.pay_rate_per_hour),
    deactivated_at: t.deactivated_at ?? null,
    certifications: t.certifications ?? [],
    on_call: Array.isArray(t.oncall) ? (t.oncall[0]?.active ?? false) : (t.oncall?.active ?? false),
  }));
}

/** Name and phone are the office's record of who to send where. */
export async function updateTechnician(
  technicianId: string,
  patch: { full_name?: string; phone?: string | null },
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase!.from('profiles').update(patch).eq('id', technicianId);
  if (error) throw new Error(error.message);
}

/**
 * Leaving the roster is deactivation, never deletion: jobs.assigned_technician_id
 * has no cascade and the financial record has to survive six years.
 */
export async function setTechnicianOnRoster(technicianId: string, onRoster: boolean): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase!
    .from('profiles')
    .update({ deactivated_at: onRoster ? null : new Date().toISOString() })
    .eq('id', technicianId);
  if (error) throw new Error(error.message);
}

export async function addCertification(
  technicianId: string,
  cert: { type: CertificationType; expires_on: string; reference?: string; verified: boolean },
): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase!.from('technician_certifications').insert({
    technician_id: technicianId,
    type: cert.type,
    expires_on: cert.expires_on,
    reference: cert.reference || null,
    verified: cert.verified,
  });
  if (error) throw new Error(error.message);
}

export async function removeCertification(certificationId: string): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase!
    .from('technician_certifications')
    .delete()
    .eq('id', certificationId);
  if (error) throw new Error(error.message);
}

/**
 * Add someone to the roster. Creating a login needs the service role, so this
 * goes through an Edge Function that checks the caller is an admin. It returns
 * a one-time sign-in link because Supabase's built-in mail is rate limited to a
 * handful an hour — the office sends it the same way it sends the tenant link.
 */
export async function inviteTechnician(input: {
  email: string;
  full_name: string;
  phone?: string;
}): Promise<{ signInLink: string | null; alreadyExisted: boolean }> {
  if (!isSupabaseConfigured) return { signInLink: null, alreadyExisted: false };
  const sb = supabase!;
  const { data: sessionData } = await sb.auth.getSession();
  const res = await fetch(`${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/manage-roster`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${sessionData.session?.access_token}`,
      apikey: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
    },
    body: JSON.stringify({ action: 'add_technician', ...input }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(body.error ?? 'Could not add that technician.');
  return { signInLink: body.sign_in_link ?? null, alreadyExisted: !!body.already_existed };
}

/** Technician cost per hour — the missing input for per-job margin (PRD §2 gate). */
export async function setTechnicianPayRate(technicianId: string, rate: number | null): Promise<void> {
  if (!isSupabaseConfigured) return;
  const { error } = await supabase!
    .from('profiles')
    .update({ pay_rate_per_hour: rate })
    .eq('id', technicianId);
  if (error) throw new Error(error.message);
}

/** The 90-day gate numbers (PRD §2) plus the leading indicators of §8. Admin only. */
export type PilotMetrics = {
  completed_jobs: number;
  total_jobs: number;
  variation_jobs: number;
  variation_rate: number;
  total_margin: number;
  avg_margin: number;
  jobs_missing_cost: number;
  repeat_landlords: number;
  cohort_landlords: number;
  repeat_rate: number;
};

export async function getPilotMetrics(): Promise<PilotMetrics | null> {
  if (!isSupabaseConfigured) return null;
  const { data, error } = await supabase!.rpc('pilot_metrics');
  if (error) throw new Error(error.message);
  const row = Array.isArray(data) ? data[0] : data;
  if (!row) return null;
  return Object.fromEntries(Object.entries(row).map(([k, v]) => [k, Number(v)])) as PilotMetrics;
}

/** Signed URLs for a job's photos (private bucket; 1-hour links). */
export async function getJobPhotoUrls(jobId: string, kind?: 'request' | 'before' | 'after' | 'variation'): Promise<string[]> {
  if (!isSupabaseConfigured) return [];
  const sb = supabase!;
  let query = sb.from('job_photos').select('storage_path').eq('job_id', jobId);
  if (kind) query = query.eq('kind', kind);
  const { data, error } = await query.order('created_at');
  if (error || !data) return [];
  const urls: string[] = [];
  for (const row of data) {
    const { data: signed } = await sb.storage.from('job-photos').createSignedUrl(row.storage_path, 3600);
    if (signed?.signedUrl) urls.push(signed.signedUrl);
  }
  return urls;
}

/**
 * The hero flow's final act: create the request, price it from the rate card
 * snapshot, and record the landlord's approval — three audited transitions.
 * Photos upload to the private job-photos bucket.
 */
export async function createApprovedJob(draft: NewJobDraft): Promise<Job> {
  const quantity = Math.min(Math.max(draft.quantity ?? 1, 1), maxUnits(draft.jobType));
  const price = jobPrice(draft.jobType, draft.urgency, quantity);
  // a "something else" line has no card price: it stops at 'requested' until
  // the office quotes it, and only then does the landlord approve
  const needsQuote = draft.jobType.requires_quote;

  if (!isSupabaseConfigured) {
    const job: Job = {
      id: `j${demo.counter}`,
      reference: `PC-${demo.counter++}`,
      property_id: draft.property.id,
      category: draft.jobType.category,
      description: draft.description,
      urgency: draft.urgency,
      status: needsQuote ? 'requested' : 'approved',
      agreed_price_inc_vat: price as number,
      surcharge_multiplier: draft.urgency === 'out_of_hours' && canBookOutOfHours(draft.jobType) ? pricing().out_of_hours_multiplier : 1,
      assigned_technician_id: null,
      technician_accepted_at: null,
      scheduled_start: null,
      scheduled_end: null,
      preferred_slot_start: draft.slot?.start ?? null,
      preferred_slot_end: draft.slot?.end ?? null,
      quantity,
      created_at: new Date().toISOString(),
      property: draft.property,
      job_type: draft.jobType,
    };
    demo.jobs.unshift(job);
    return job;
  }

  const sb = supabase!;
  const { data: userData } = await sb.auth.getUser();
  const { data: inserted, error } = await sb
    .from('jobs')
    .insert({
      property_id: draft.property.id,
      landlord_id: userData.user?.id,
      job_type_id: draft.jobType.id,
      category: draft.jobType.category,
      description: draft.description,
      urgency: draft.urgency,
      quantity,
      agreed_price_inc_vat: price,
      surcharge_multiplier: draft.urgency === 'out_of_hours' && canBookOutOfHours(draft.jobType) ? pricing().out_of_hours_multiplier : 1,
      // scheduled_* is the office's to set; this is only what the landlord asked for
      preferred_slot_start: draft.slot?.start ?? null,
      preferred_slot_end: draft.slot?.end ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  const job = inserted as Job;

  if (needsQuote) {
    await uploadDraftPhotos(job.id, draft.photoUris, userData.user?.id);
    return { ...job, property: draft.property, job_type: draft.jobType };
  }

  // requested → priced (instant, from rate card) → approved (the landlord's tap)
  const { error: e1 } = await sb.rpc('transition_job', { p_job_id: job.id, p_to: 'priced' });
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await sb.rpc('transition_job', { p_job_id: job.id, p_to: 'approved' });
  if (e2) throw new Error(e2.message);

  await uploadDraftPhotos(job.id, draft.photoUris, userData.user?.id);

  return { ...job, status: 'approved', property: draft.property, job_type: draft.jobType };
}

/** Best-effort: the job is already booked, a failed photo must not undo that. */
async function uploadDraftPhotos(jobId: string, uris: string[], userId?: string): Promise<void> {
  const sb = supabase!;
  for (const uri of uris) {
    try {
      const res = await fetch(uri);
      const body = await res.arrayBuffer();
      const path = `${jobId}/request-${Date.now()}.jpg`;
      const { error: upErr } = await sb.storage
        .from('job-photos')
        .upload(path, body, { contentType: 'image/jpeg' });
      if (!upErr) {
        await sb.from('job_photos').insert({
          job_id: jobId,
          kind: 'request',
          storage_path: path,
          uploaded_by: userId,
        });
      }
    } catch {
      // best-effort
    }
  }
}
