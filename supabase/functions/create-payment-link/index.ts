// Creates (or returns) the Stripe payment URL for a completed job's invoice.
// Caller must be the job's landlord (JWT verified by the platform, ownership
// checked here). Returns 501 until STRIPE_SECRET_KEY is set as a secret.

import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

const service = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

const headers = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Content-Type': 'application/json',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  try {
    // identify the caller from their JWT
    const authHeader = req.headers.get('Authorization') ?? '';
    const userClient = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_ANON_KEY')!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    const userId = userData.user?.id;
    if (!userId) return json(401, { error: 'not signed in' });

    const { job_id } = await req.json();
    if (!job_id) return json(400, { error: 'missing job_id' });

    const { data: job } = await service
      .from('jobs')
      .select('id, landlord_id, reference, agreed_price_inc_vat, job_type:job_types(name)')
      .eq('id', job_id)
      .maybeSingle();
    if (!job) return json(404, { error: 'job not found' });
    if (job.landlord_id !== userId) return json(403, { error: 'not your job' });

    const { data: invoice } = await service
      .from('invoices')
      .select('id, number, total_inc_vat, status, stripe_payment_link')
      .eq('job_id', job_id)
      .maybeSingle();
    if (!invoice) return json(409, { error: 'no invoice yet — job not completed' });
    if (invoice.status === 'disputed') return json(409, { error: 'invoice is disputed — payment is on hold' });
    if (invoice.status === 'paid' || invoice.status === 'auto_captured') {
      return json(409, { error: 'already paid' });
    }
    if (invoice.stripe_payment_link) return json(200, { url: invoice.stripe_payment_link });

    const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
    if (!stripeKey) return json(501, { error: 'payments not configured yet' });

    const stripe = new Stripe(stripeKey);
    const appUrl = Deno.env.get('APP_URL') ?? 'http://localhost:8081';
    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'gbp',
            unit_amount: Math.round(Number(invoice.total_inc_vat) * 100),
            product_data: {
              name: `${(job.job_type as any)?.name ?? 'Maintenance job'} — invoice ${invoice.number}`,
            },
          },
        },
      ],
      metadata: { job_id: job.id, invoice_id: invoice.id },
      success_url: `${appUrl}/?paid=${job.id}`,
      cancel_url: `${appUrl}/?cancelled=${job.id}`,
    });

    await service
      .from('invoices')
      .update({ stripe_payment_link: session.url })
      .eq('id', invoice.id);

    return json(200, { url: session.url });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : 'internal error' });
  }
});
