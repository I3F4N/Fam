import { createClient } from '@supabase/supabase-js';

// Initialize Admin Client (Bypasses RLS to query the whitelist)
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function checkIsAdmin(email: string | undefined): Promise<boolean> {
  if (!email) return false;

  const { data } = await supabaseAdmin
    .from('admin_whitelist')
    .select('email')
    .eq('email', email)
    .single();

  return !!data; // Returns true if the row exists
}