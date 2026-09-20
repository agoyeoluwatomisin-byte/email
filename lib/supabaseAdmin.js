import { createClient } from '@supabase/supabase-js';

// This uses the SERVICE ROLE key, which bypasses Row Level Security.
// It must only ever be imported in server-side code (API routes) -
// never in a component that ships to the browser.
export const supabaseAdmin = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
});
