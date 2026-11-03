import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://nsvuwjtyevhiwkxokokt.supabase.co';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im5zdnV3anR5ZXZoaXdreG9rb2t0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODc1NzYzNzEsImV4cCI6MjEwMzE1MjM3MX0.DEur81Z4CizlmtQ2d52HTbsQMEs0Fx-ne7jnIC3s4W8';

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

