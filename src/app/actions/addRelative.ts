'use server';

import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

export async function addRelative(
  originId: string, 
  data: { firstName: string; lastName: string; gender: string; relation: string }
) {
  // FIX 1: Await the cookies() call (Required for Next.js 15)
  const cookieStore = await cookies();

  // FIX 2: Pass cookies via 'global.headers' so supabase-js can find the session
  const authClient = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: false, // Server actions don't need persistent storage
      },
      global: {
        headers: {
          cookie: cookieStore.toString(),
        },
      },
    }
  );

  // 2. Security Check
  const { data: { user } } = await authClient.auth.getUser();
  const ADMIN_EMAIL = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  if (!user || user.email !== ADMIN_EMAIL) {
    console.error(`🚨 Security Alert: Unauthorized write attempt by ${user?.email || 'Unknown'}`);
    return { success: false, error: 'ACCESS DENIED: You do not have Admin privileges.' };
  }

  // 3. Initialize Admin Client (Service Role)
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  console.log("⚡ Action: Adding Relative...", data);

  // --- LOGIC: CREATE MEMBER ---
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

  // --- LOGIC: CREATE CONNECTIONS ---
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

  if (linkError) {
    return { success: false, error: linkError.message };
  }

  return { success: true };
}