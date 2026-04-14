import { createClient } from '@supabase/supabase-js';

let _client = null;

function getSupabaseAdmin() {
  if (_client) return _client;

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey) {
    throw new Error(
      'Missing Supabase environment variables. Please set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in your Vercel project settings.'
    );
  }

  _client = createClient(supabaseUrl, supabaseServiceKey);
  return _client;
}

// Proxy that lazily creates the client on first use
export const supabaseAdmin = new Proxy({}, {
  get(_, prop) {
    return getSupabaseAdmin()[prop];
  }
});
