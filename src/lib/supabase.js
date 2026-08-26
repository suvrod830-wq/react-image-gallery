import { createClient } from '@supabase/supabase-js';
import { env, isSupabaseConfigured } from './env';

// Browser-side Supabase client. Uses the ANON key only — Row Level Security
// policies in the database are the actual security boundary (spec §33).
// The service_role key never touches the browser; it lives exclusively in
// the serverless functions under /api.
export const supabase = isSupabaseConfigured
  ? createClient(env.supabaseUrl, env.supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
      },
    })
  : null;

export function getSession() {
  return supabase?.auth.getSession() ?? Promise.resolve({ data: { session: null }, error: null });
}

export function getSessionUser() {
  return getSession().then(({ data }) => data.session?.user ?? null);
}
