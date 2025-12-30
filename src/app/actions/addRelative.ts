'use server';

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function addRelative(
  originId: string, 
  data: { firstName: string; lastName: string; gender: string; relation: string }
) {
  console.log("⚡ Action: Adding Relative...", data);

  // 1. Create the New Member
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

  // 2. Handle Connections based on Relation Type
  const linksToCreate = [];

  if (data.relation === 'child') {
    // Me -> Parent Of -> New
    linksToCreate.push({ from_member_id: originId, to_member_id: newMember.id, type: 'parent_of' });
  } 
  else if (data.relation === 'parent') {
    // New -> Parent Of -> Me
    linksToCreate.push({ from_member_id: newMember.id, to_member_id: originId, type: 'parent_of' });
  } 
  else if (data.relation === 'spouse') {
    // Me <-> Married To <-> New (Canonical Order)
    const [id1, id2] = originId < newMember.id ? [originId, newMember.id] : [newMember.id, originId];
    linksToCreate.push({ from_member_id: id1, to_member_id: id2, type: 'married_to' });
  }
  else if (data.relation === 'sibling') {
    // --- SIBLING LOGIC ---
    // A. Find the parents of the Origin Node
    const { data: parents } = await supabase
      .from('connections')
      .select('from_member_id')
      .eq('to_member_id', originId)
      .eq('type', 'parent_of');

    if (!parents || parents.length === 0) {
      // 🛑 Critical Check: You cannot have a sibling if you have no parents in the DB
      // Cleanup: Delete the orphan node we just created to prevent clutter
      await supabase.from('members').delete().eq('id', newMember.id);
      return { 
        success: false, 
        error: "Cannot add Sibling: This node has no parents recorded. Please add a Parent first." 
      };
    }

    // B. Link the new person to ALL found parents
    parents.forEach(p => {
      linksToCreate.push({ from_member_id: p.from_member_id, to_member_id: newMember.id, type: 'parent_of' });
    });
  }

  // 3. Execute Link Creation
  const { error: linkError } = await supabase.from('connections').insert(linksToCreate);

  if (linkError) {
    console.error("Link Failed:", linkError);
    return { success: false, error: linkError.message };
  }

  return { success: true };
}