import { isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { JobStatus } from '@/lib/job-status';

/** Out-of-hours surcharge (PRD decision #11); config-level for P0. */
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
};

export type Job = {
  id: string;
  reference: string;
  property_id: string;
  category: Category;
  description: string;
  urgency: Urgency;
  status: JobStatus;
  agreed_price_inc_vat: number;
  surcharge_multiplier: number;
  assigned_technician_id: string | null;
  technician_accepted_at: string | null;
  scheduled_start: string | null;
  scheduled_end: string | null;
  created_at: string;
  property?: Property;
  job_type?: JobType;
};

export type NewPropertyInput = Omit<Property, 'id'>;

export type Certification = {
  type: 'niceic' | 'napit' | 'wras' | 'gas_safe' | 'public_liability' | 'other';
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
};

export function jobPrice(jobType: JobType, urgency: Urgency): number {
  return urgency === 'out_of_hours'
    ? Math.round(jobType.price_inc_vat * OUT_OF_HOURS_MULTIPLIER * 100) / 100
    : jobType.price_inc_vat;
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
    { id: 'jt1', category: 'plumbing', name: 'Leaking / dripping tap', price_ex_vat: 150, price_inc_vat: 180 },
    { id: 'jt2', category: 'plumbing', name: 'Blocked drain / waste', price_ex_vat: 133.33, price_inc_vat: 160 },
    { id: 'jt3', category: 'plumbing', name: 'No hot water — diagnose & fix', price_ex_vat: 183.33, price_inc_vat: 220 },
    { id: 'jt4', category: 'electrical', name: 'Socket not working', price_ex_vat: 116.67, price_inc_vat: 140 },
    { id: 'jt5', category: 'electrical', name: 'Light fitting replacement', price_ex_vat: 108.33, price_inc_vat: 130 },
    { id: 'jt6', category: 'handyman', name: 'Sticking / misaligned door', price_ex_vat: 79.17, price_inc_vat: 95 },
    { id: 'jt7', category: 'handyman', name: 'Lock change', price_ex_vat: 87.5, price_inc_vat: 105 },
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
    .select('id, category, name, price_ex_vat, price_inc_vat')
    .eq('active', true)
    .order('price_inc_vat');
  if (error) throw new Error(error.message);
  return data as JobType[];
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
    .eq('role', 'technician');
  if (error) throw new Error(error.message);
  return data as Technician[];
}

/** Three offered access windows anchored on the landlord's preferred slot. */
function offeredSlotsFor(job: Job): { start: string; end: string }[] {
  const base = job.scheduled_start ? new Date(job.scheduled_start) : new Date(Date.now() + 86400000);
  const durationMs = job.scheduled_end
    ? new Date(job.scheduled_end).getTime() - new Date(job.scheduled_start!).getTime()
    : 2 * 3600000;
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
      old_job_price_inc_vat: job.agreed_price_inc_vat,
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
export async function listPendingVariations(): Promise<Variation[]> {
  if (!isSupabaseConfigured) {
    return demoVariations.filter((v) => v.status === 'flagged' || v.status === 'admin_review');
  }
  const { data, error } = await supabase!
    .from('variations')
    .select('*, job:jobs(*, property:properties(*), job_type:job_types(*))')
    .in('status', ['flagged', 'admin_review'])
    .order('created_at');
  if (error) throw new Error(error.message);
  return data as Variation[];
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
        total_inc_vat: job.agreed_price_inc_vat,
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

/** Registry view: technicians + certs + on-call state (admin). */
export type RegistryTechnician = Technician & { on_call: boolean };

export async function listRegistryTechnicians(): Promise<RegistryTechnician[]> {
  if (!isSupabaseConfigured) {
    return demo.technicians.map((t, i) => ({ ...t, on_call: i === 0 }));
  }
  const { data, error } = await supabase!
    .from('profiles')
    .select(
      'id, full_name, phone, certifications:technician_certifications(type, expires_on, verified), oncall:on_call_optins(active)',
    )
    .eq('role', 'technician');
  if (error) throw new Error(error.message);
  return (data as any[]).map((t) => ({
    id: t.id,
    full_name: t.full_name,
    phone: t.phone,
    certifications: t.certifications ?? [],
    on_call: Array.isArray(t.oncall) ? (t.oncall[0]?.active ?? false) : (t.oncall?.active ?? false),
  }));
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
  const price = jobPrice(draft.jobType, draft.urgency);

  if (!isSupabaseConfigured) {
    const job: Job = {
      id: `j${demo.counter}`,
      reference: `PC-${demo.counter++}`,
      property_id: draft.property.id,
      category: draft.jobType.category,
      description: draft.description,
      urgency: draft.urgency,
      status: 'approved',
      agreed_price_inc_vat: price,
      surcharge_multiplier: draft.urgency === 'out_of_hours' ? OUT_OF_HOURS_MULTIPLIER : 1,
      assigned_technician_id: null,
      technician_accepted_at: null,
      scheduled_start: draft.slot?.start ?? null,
      scheduled_end: draft.slot?.end ?? null,
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
      agreed_price_inc_vat: price,
      surcharge_multiplier: draft.urgency === 'out_of_hours' ? OUT_OF_HOURS_MULTIPLIER : 1,
      scheduled_start: draft.slot?.start ?? null,
      scheduled_end: draft.slot?.end ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(error.message);
  const job = inserted as Job;

  // requested → priced (instant, from rate card) → approved (the landlord's tap)
  const { error: e1 } = await sb.rpc('transition_job', { p_job_id: job.id, p_to: 'priced' });
  if (e1) throw new Error(e1.message);
  const { error: e2 } = await sb.rpc('transition_job', { p_job_id: job.id, p_to: 'approved' });
  if (e2) throw new Error(e2.message);

  for (const uri of draft.photoUris) {
    try {
      const res = await fetch(uri);
      const body = await res.arrayBuffer();
      const path = `${job.id}/request-${Date.now()}.jpg`;
      const { error: upErr } = await sb.storage
        .from('job-photos')
        .upload(path, body, { contentType: 'image/jpeg' });
      if (!upErr) {
        await sb.from('job_photos').insert({
          job_id: job.id,
          kind: 'request',
          storage_path: path,
          uploaded_by: userData.user?.id,
        });
      }
    } catch {
      // photo upload is best-effort at this stage; the job itself is already booked
    }
  }

  return { ...job, status: 'approved', property: draft.property, job_type: draft.jobType };
}
