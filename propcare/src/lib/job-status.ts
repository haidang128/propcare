import type { StatusHue } from '@/constants/theme';

/** Mirrors the `job_status` Postgres enum in supabase/migrations/0001_init.sql */
export type JobStatus =
  | 'requested'
  | 'priced'
  | 'approved'
  | 'scheduled'
  | 'in_progress'
  | 'variation_pending'
  | 'awaiting_parts'
  | 'rescheduled'
  | 'completed'
  | 'paid'
  | 'cancelled'
  | 'declined'
  | 'access_failed'
  | 'disputed';

export type StatusPresentation = {
  hue: StatusHue;
  /** Plain-English label for the landlord surface; {tech} = technician first name */
  landlordLabel: string;
  /** True while work is live — the chip dot pulses */
  live?: boolean;
  /** Amber rule: true when the landlord must act */
  actionNeeded?: boolean;
};

/**
 * Status language from the design system: five hues, one meaning each.
 * Amber always means "you need to act". Labels talk like a person, not a database.
 */
export const STATUS: Record<JobStatus, StatusPresentation> = {
  requested: { hue: 'neutral', landlordLabel: 'Request received' },
  priced: { hue: 'amber', landlordLabel: 'Waiting for your approval', actionNeeded: true },
  approved: { hue: 'blue', landlordLabel: 'Approved — scheduling now' },
  scheduled: { hue: 'blue', landlordLabel: 'Booked' },
  in_progress: { hue: 'green', landlordLabel: '{tech} is on the job', live: true },
  variation_pending: { hue: 'amber', landlordLabel: 'Extra work needs your OK', actionNeeded: true },
  awaiting_parts: { hue: 'purple', landlordLabel: 'Paused — awaiting parts' },
  rescheduled: { hue: 'purple', landlordLabel: 'Being rescheduled' },
  completed: { hue: 'green', landlordLabel: 'Work completed' },
  paid: { hue: 'green', landlordLabel: 'Paid' },
  cancelled: { hue: 'red', landlordLabel: 'Cancelled' },
  declined: { hue: 'red', landlordLabel: 'Price declined' },
  access_failed: { hue: 'red', landlordLabel: 'Access failed — needs rebooking', actionNeeded: true },
  disputed: { hue: 'red', landlordLabel: 'In dispute — payment on hold' },
};

export function statusLabel(status: JobStatus, technicianFirstName?: string): string {
  return STATUS[status].landlordLabel.replace('{tech}', technicianFirstName ?? 'Your engineer');
}

/** Format pence-safe numeric prices: 180 -> "£180.00" */
export function formatGBP(amount: number): string {
  return new Intl.NumberFormat('en-GB', { style: 'currency', currency: 'GBP' }).format(amount);
}
