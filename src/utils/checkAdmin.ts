import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function checkAdmin() {
  const cookieStore = await cookies();

  // 1. Identify the User (using Anon Key + Cookies)
  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: { persistSession: false },
      global: {
        headers: {
          cookie: cookieStore.toString(),
        },
      },
    }
  );

  const { data: { user } } = await authClient.auth.getUser();

  if (!user || !user.email) {
    throw new Error("Unauthorized: No active session.");
  }

  // 2. Verify against Whitelist (using Service Role Key)
  const adminClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data } = await adminClient
    .from('admin_whitelist')
    .select('id')
    .eq('email', user.email)
    .single();

  if (!data) {
    throw new Error(`Unauthorized: ${user.email} is not an Admin.`);
  }

  return true;
}