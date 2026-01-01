'use server';

import { createClient } from '@supabase/supabase-js';
import { checkAdmin } from '@/utils/checkAdmin';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function updateMember(id: string, data: { firstName: string; lastName: string; gender: string }) {
  // 1. SECURITY CHECK
  try {
    await checkAdmin();
  } catch (e: any) {
    return { success: false, error: e.message };
  }

  // 2. UPDATE LOGIC
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
  // 1. SECURITY CHECK
  try {
    await checkAdmin();
  } catch (e: any) {
    return { success: false, error: e.message };
  }

  // 2. DELETE LOGIC (Cascade Connections First)
  await supabase.from('connections').delete().or(`from_member_id.eq.${id},to_member_id.eq.${id}`);

  const { error } = await supabase
    .from('members')
    .delete()
    .eq('id', id);

  if (error) return { success: false, error: error.message };
  return { success: true };
}