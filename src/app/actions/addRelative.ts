'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { checkIsAdmin } from '@/utils/adminCheck'; // Ensure this path is correct for your project

export async function addRelative(
  originId: string, 
  data: { firstName: string; lastName: string; gender: string; relation: string }
) {
  // FIX 1: Await the cookies() call (Next.js 15 Requirement)
  const cookieStore = await cookies();

  // FIX 2: Correctly pass cookies to Supabase via global headers
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

  // 2. Security Check (Database Whitelist)
  const { data: { user } } = await authClient.auth.getUser();
  // Ensure checkIsAdmin handles undefined safely
  const isAdmin = await checkIsAdmin(user?.email ?? undefined);

  if (!isAdmin) {
    console.error(`🚨 Unauthorized Access: ${user?.email}`);
    return { success: false, error: 'ACCESS DENIED: You are not on the Admin Whitelist.' };
  }

  // 3. Initialize Write Client (Service Role)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log("⚡ Action: Adding Relative...", data);

  // --- MEMBER CREATION ---
  const { data: newMember, error: memberError } = await supabase
    .from('members')
    .insert({
      first_name: data.firstName,
      last_name: data.lastName,
      gender: data.gender,
      is_verified: true
    })
    .select()
    .single();

  if (memberError || !newMember) return { success: false, error: memberError?.message };

  // --- CONNECTION LOGIC ---
  const linksToCreate = [];

  if (data.relation === 'child') {
    linksToCreate.push({ from_member_id: originId, to_member_id: newMember.id, type: 'parent_of' });
  } 
  else if (data.relation === 'parent') {
    linksToCreate.push({ from_member_id: newMember.id, to_member_id: originId, type: 'parent_of' });
  } 
  else if (data.relation === 'spouse') {
    const [id1, id2] = originId < newMember.id ? [originId, newMember.id] : [newMember.id, originId];
    linksToCreate.push({ from_member_id: id1, to_member_id: id2, type: 'married_to' });
  }
  else if (data.relation === 'sibling') {
    const { data: parents } = await supabase
      .from('connections')
      .select('from_member_id')
      .eq('to_member_id', originId)
      .eq('type', 'parent_of');

    if (!parents || parents.length === 0) {
      await supabase.from('members').delete().eq('id', newMember.id);
      return { 
        success: false, 
        error: "Cannot add Sibling: This node has no parents recorded. Please add a Parent first." 
      };
    }

    parents.forEach(p => {
      linksToCreate.push({ from_member_id: p.from_member_id, to_member_id: newMember.id, type: 'parent_of' });
    });
  }

  const { error: linkError } = await supabase.from('connections').insert(linksToCreate);

  if (linkError) return { success: false, error: linkError.message };

  return { success: true };
}