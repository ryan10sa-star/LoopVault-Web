// Supabase Edge Function: lemon-webhook
// Deploy with: supabase functions deploy lemon-webhook
//
// NOTE (Ryan): Set LEMONSQUEEZY_WEBHOOK_SECRET in the Supabase dashboard under
//   Edge Functions → lemon-webhook → Secrets before going live.
//
// In LemonSqueezy dashboard, point the webhook to:
//   https://<your-supabase-project>.supabase.co/functions/v1/lemon-webhook
// and select the `order_created` event.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { hmac } from 'https://deno.land/x/hmac@v2.0.1/mod.ts';

const WEBHOOK_SECRET = Deno.env.get('LEMONSQUEEZY_WEBHOOK_SECRET') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

Deno.serve(async (req: Request) => {
  if (req.method !== 'POST') {
    return new Response('Method Not Allowed', { status: 405 });
  }

  const rawBody = await req.text();

  // Verify LemonSqueezy webhook signature
  const signature = req.headers.get('X-Signature') ?? '';
  if (WEBHOOK_SECRET) {
    const expected = hmac('sha256', WEBHOOK_SECRET, rawBody, 'utf8', 'hex');
    if (signature !== expected) {
      return new Response('Unauthorized', { status: 401 });
    }
  }

  let payload: Record<string, unknown>;
  try {
    payload = JSON.parse(rawBody) as Record<string, unknown>;
  } catch {
    return new Response('Bad Request', { status: 400 });
  }

  const eventName = (payload['meta'] as Record<string, unknown> | undefined)?.['event_name'];
  if (eventName !== 'order_created') {
    // Ignore other events
    return new Response('OK', { status: 200 });
  }

  const data = payload['data'] as Record<string, unknown> | undefined;
  const attributes = data?.['attributes'] as Record<string, unknown> | undefined;
  const customerEmail = attributes?.['user_email'] as string | undefined;

  if (!customerEmail) {
    return new Response('Bad Request: missing user_email', { status: 400 });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false }
  });

  // Look up user by email using admin API
  const { data: usersData, error: userError } = await supabase.auth.admin.listUsers();
  if (userError) {
    console.error('Failed to list users:', userError.message);
    return new Response('Internal Server Error', { status: 500 });
  }

  const matchedUser = usersData?.users.find((u) => u.email?.toLowerCase() === customerEmail.toLowerCase());
  if (!matchedUser) {
    console.warn(`No user found for email: ${customerEmail}`);
    // Return 200 so LemonSqueezy does not retry — the user may not have registered yet
    return new Response('OK', { status: 200 });
  }

  const { error: updateError } = await supabase
    .from('profiles')
    .update({ subscription_active: true })
    .eq('id', matchedUser.id);

  if (updateError) {
    console.error('Failed to update profile:', updateError.message);
    return new Response('Internal Server Error', { status: 500 });
  }

  return new Response('OK', { status: 200 });
});
