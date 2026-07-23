// Roster management — the one part of "add a technician" a client cannot do.
//
// Creating a login needs the service role, so it happens here. Everything else
// about a technician (name, phone, pay rate, certifications, deactivation) is
// ordinary admin-RLS table access from the app.
//
// The caller's own JWT decides whether they may do this: we look their role up
// with the service key rather than trusting anything in the request body. A
// landlord calling this gets 403, which is the whole point of the function
// existing rather than shipping a service key to the client.

import { createClient } from 'npm:@supabase/supabase-js@2';

const admin = createClient(
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

async function callerIsAdmin(req: Request): Promise<boolean> {
  const auth = req.headers.get('Authorization');
  if (!auth) return false;
  const { data, error } = await admin.auth.getUser(auth.replace('Bearer ', ''));
  if (error || !data.user) return false;
  const { data: profile } = await admin
    .from('profiles')
    .select('role')
    .eq('id', data.user.id)
    .maybeSingle();
  return profile?.role === 'admin';
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers });
  if (req.method !== 'POST') return json(405, { error: 'method not allowed' });

  try {
    if (!(await callerIsAdmin(req))) return json(403, { error: 'admin only' });

    const { action, email, full_name, phone } = await req.json();
    if (action !== 'add_technician') return json(400, { error: 'unknown action' });
    if (!email || !full_name) return json(400, { error: 'email and name are required' });

    const address = String(email).trim().toLowerCase();

    // Someone who has already signed up (as a landlord, by default) is promoted
    // rather than duplicated — one person, one login.
    const { data: existing } = await admin
      .from('profiles')
      .select('id')
      .eq('email', address)
      .maybeSingle();

    let userId = existing?.id as string | undefined;
    let alreadyExisted = !!userId;

    if (!userId) {
      const { data: created, error: createError } = await admin.auth.admin.createUser({
        email: address,
        email_confirm: true,
        user_metadata: { full_name },
      });
      if (createError) {
        // a login can exist without a profile row if the signup trigger ever failed
        if (!/already/i.test(createError.message)) {
          return json(400, { error: createError.message });
        }
        const { data: list } = await admin.auth.admin.listUsers();
        userId = list?.users.find((u) => u.email?.toLowerCase() === address)?.id;
        alreadyExisted = true;
        if (!userId) return json(400, { error: createError.message });
      } else {
        userId = created.user!.id;
      }
    }

    const { error: profileError } = await admin
      .from('profiles')
      .upsert(
        {
          id: userId,
          role: 'technician',
          full_name,
          phone: phone || null,
          email: address,
          deactivated_at: null,
        },
        { onConflict: 'id' },
      );
    if (profileError) return json(400, { error: profileError.message });

    // The built-in mailer is rate limited to a handful an hour, so hand the link
    // back for the office to send however it likes rather than relying on email.
    const appUrl = Deno.env.get('APP_URL') ?? 'https://propcare.expo.app';
    const { data: link } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: address,
      options: { redirectTo: appUrl },
    });

    return json(200, {
      user_id: userId,
      already_existed: alreadyExisted,
      sign_in_link: link?.properties?.action_link ?? null,
    });
  } catch (e) {
    return json(500, { error: e instanceof Error ? e.message : 'internal error' });
  }
});
