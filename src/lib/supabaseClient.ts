// NOTE (Ryan): Before deploying, enable Email auth in Supabase dashboard:
//   Authentication → Providers → Email → Enable
// Also set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in your .env file.
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;

if (!supabaseUrl || !supabaseAnonKey) {
  console.warn('LoopVault: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is not set. Authentication will not work.');
}

export const supabase = createClient(supabaseUrl ?? '', supabaseAnonKey ?? '');
