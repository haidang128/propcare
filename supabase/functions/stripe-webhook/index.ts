// Stripe webhook: checkout.session.completed → invoice paid + job completed → paid.
// Deployed with --no-verify-jwt; authenticity comes from the Stripe signature.
// Requires secrets: STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET.

import { createClient } from 'npm:@supabase/supabase-js@2';
import Stripe from 'npm:stripe@17';

const service = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
);

Deno.serve(async (req) => {
  const stripeKey = Deno.env.get('STRIPE_SECRET_KEY');
  const webhookSecret = Deno.env.get('STRIPE_WEBHOOK_SECRET');
  if (!stripeKey || !webhookSecret) {
    return new Response(JSON.stringify({ error: 'not configured' }), { status: 501 });
  }

  const stripe = new Stripe(stripeKey);
  const signature = req.headers.get('stripe-signature');
  if (!signature) return new Response('missing signature', { status: 400 });

  let event: Stripe.Event;
  try {
    event = await stripe.webhooks.constructEventAsync(await req.text(), signature, webhookSecret);
  } catch {
    return new Response('bad signature', { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;
    const jobId = session.metadata?.job_id;
    const invoiceId = session.metadata?.invoice_id;
    if (jobId && invoiceId) {
      await service.from('invoices').update({ status: 'paid' }).eq('id', invoiceId);
      const { data: job } = await service.from('jobs').select('status').eq('id', jobId).maybeSingle();
      if (job && (job.status === 'completed' || job.status === 'disputed')) {
        await service.from('jobs').update({ status: 'paid' }).eq('id', jobId);
        await service.from('job_events').insert({
          job_id: jobId,
          from_status: job.status,
          to_status: 'paid',
          note: 'Payment received via Stripe',
        });
      }
    }
  }

  return new Response(JSON.stringify({ received: true }), { status: 200 });
});
