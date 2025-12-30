'use server';

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function updateMember(
  id: string, 
  data: { firstName: string; lastName: string; gender: string }
) {
  const { error } = await supabase
    .from('members')
    .update({
      first_name: data.firstName,
      last_name: data.lastName,
      gender: data.gender
    })
    .eq('id', id);

  if (error) {
    console.error("Update Failed:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}

export async function deleteMember(id: string) {
  // 1. Delete Connections First (Manual Cascade)
  // Although DB cascade might be set, this ensures cleanup.
  await supabase.from('connections').delete().or(`from_member_id.eq.${id},to_member_id.eq.${id}`);

  // 2. Delete Member
  const { error } = await supabase
    .from('members')
    .delete()
    .eq('id', id);

  if (error) {
    console.error("Delete Failed:", error);
    return { success: false, error: error.message };
  }

  return { success: true };
}