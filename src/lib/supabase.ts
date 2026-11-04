import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://xrvdohzqdzcunqshgqoz.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_sEIK_e4-z4BREXo2iCLznQ_HhwDfTkx';

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Supabase environment variables are not configured.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

