'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Helper to verify Admin
async function verifyAdmin() {
  // FIX 1: Await cookies
  const cookieStore = await cookies();
  
  // FIX 2: Pass cookies via global headers
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
  const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  if (!user || user.email !== ADMIN_EMAIL) {
    return false;
  }
  return true;
}

// Initialize Admin Client (Service Role)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function updateMember(id: string, data: { firstName: string; lastName: string; gender: string }) {
  if (!(await verifyAdmin())) return { success: false, error: 'ACCESS DENIED: Admin only.' };

  const { error } = await supabase
    .from('members')
    .update({
      first_name: data.firstName,
      last_name: data.lastName,
      gender: data.gender
    })
    .eq('id', id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function deleteMember(id: string) {
  if (!(await verifyAdmin())) return { success: false, error: 'ACCESS DENIED: Admin only.' };

  await supabase.from('connections').delete().or(`from_member_id.eq.${id},to_member_id.eq.${id}`);

  const { error } = await supabase
    .from('members')
    .delete()
    .eq('id', id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}