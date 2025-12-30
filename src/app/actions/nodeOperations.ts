'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { checkIsAdmin } from '@/utils/adminCheck'; 

// Helper: Verify User via Database Whitelist
async function verifyAdmin() {
  const cookieStore = await cookies();
  
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
  return await checkIsAdmin(user?.email);
}

// Service Role Client for Writes
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function updateMember(id: string, data: { firstName: string; lastName: string; gender: string }) {
  const isAdmin = await verifyAdmin();
  if (!isAdmin) return { success: false, error: 'ACCESS DENIED: You are not on the Admin Whitelist.' };

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
  const isAdmin = await verifyAdmin();
  if (!isAdmin) return { success: false, error: 'ACCESS DENIED: You are not on the Admin Whitelist.' };

  // 1. Cascade Delete Connections
  await supabase.from('connections').delete().or(`from_member_id.eq.${id},to_member_id.eq.${id}`);

  // 2. Delete Member
  const { error } = await supabase
    .from('members')
    .delete()
    .eq('id', id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}