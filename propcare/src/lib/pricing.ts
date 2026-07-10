/**
 * Pricing settings, loaded once per session from the `pricing_settings` singleton.
 *
 * VAT is the reason this exists. Registration is still an open decision (PRD §9,
 * "blocking first invoice"), and below the registration threshold it is unlawful
 * to charge or itemise VAT. So the app must be able to render every price with no
 * VAT line at all — `vatBreakdown()` returns null until registration is recorded,
 * and callers render the tax rows only when it doesn't.
 *
 * The getters are synchronous and fall back to the same defaults the database
 * column defaults use, so a screen that renders before the fetch lands shows the
 * conservative (unregistered, no surcharge clamp) values rather than guessing.
 */
import { isSupabaseConfigured, supabase } from '@/lib/supabase';

export type PricingSettings = {
  vat_registered: boolean;
  vat_rate: number;
  out_of_hours_multiplier: number;
  minimum_job_inc_vat: number;
  platform_overhead_per_job: number;
};

const DEFAULTS: PricingSettings = {
  vat_registered: false,
  vat_rate: 0.2,
  out_of_hours_multiplier: 1.75,
  minimum_job_inc_vat: 0,
  platform_overhead_per_job: 0,
};

let cached: PricingSettings = DEFAULTS;

/** Current settings. Safe to call before `loadPricingSettings()` resolves. */
export function pricing(): PricingSettings {
  return cached;
}

export async function loadPricingSettings(): Promise<PricingSettings> {
  if (!isSupabaseConfigured) return cached;
  const { data, error } = await supabase!
    .from('pricing_settings')
    .select('vat_registered, vat_rate, out_of_hours_multiplier, minimum_job_inc_vat, platform_overhead_per_job')
    .single();
  if (error || !data) return cached; // keep the conservative defaults
  cached = {
    vat_registered: data.vat_registered,
    vat_rate: Number(data.vat_rate),
    out_of_hours_multiplier: Number(data.out_of_hours_multiplier),
    minimum_job_inc_vat: Number(data.minimum_job_inc_vat),
    platform_overhead_per_job: Number(data.platform_overhead_per_job),
  };
  return cached;
}

/**
 * Net/VAT split of a gross price, or null when we are not VAT registered — in
 * which case there is no tax component to show and the gross IS the price.
 */
export function vatBreakdown(gross: number): { net: number; vat: number; ratePct: number } | null {
  const { vat_registered, vat_rate } = cached;
  if (!vat_registered) return null;
  const net = Math.round((gross / (1 + vat_rate)) * 100) / 100;
  return {
    net,
    vat: Math.round((gross - net) * 100) / 100,
    ratePct: Math.round(vat_rate * 100),
  };
}

/** " inc. VAT" when registered, "" otherwise. Never claim VAT we don't charge. */
export function incVatSuffix(): string {
  return cached.vat_registered ? ' inc. VAT' : '';
}

/** "inc. VAT" / "" — for standalone captions rather than sentence suffixes. */
export function incVatCaption(): string {
  return cached.vat_registered ? 'inc. VAT' : '';
}
