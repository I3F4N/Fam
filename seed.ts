import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

// Ensure you have these in your .env.local
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; 

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase Creds. Check .env.local');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

// --- HELPER: Handles the "Pro Tweak" ID Swapping automatically ---
async function canonicalConnect(id1: string, id2: string, type: string) {
  let from = id1;
  let to = id2;

  // If bidirectional, enforce A < B
  if (type === 'married_to' || type === 'divorced_from') {
    if (id1 > id2) {
      from = id2;
      to = id1;
    }
  }

  const { error } = await supabase
    .from('connections')
    .insert({ from_member_id: from, to_member_id: to, type: type as any });

  if (error) console.error(`❌ Link Error (${type}):`, error.message);
  else console.log(`   ✅ Linked: ${type}`);
}

async function createMember(name: string, gender: string, bio: string) {
  const { data, error } = await supabase
    .from('members')
    .insert({
      first_name: name.split(' ')[0],
      last_name: name.split(' ')[1] || 'Bilavinakath',
      gender: gender as any,
      bio: bio,
      is_verified: true
    })
    .select()
    .single();

  if (error) throw new Error(error.message);
  console.log(`👤 Created: ${name}`);
  return data.id;
}

async function seed() {
  console.log('\n🌱 RE-SEEDING START...\n');
  try {
    // 1. Generation 1 (Grandparents)
    const gp_dad = await createMember('Grandpa PATERNAL', 'male', 'Dad Side');
    const gp_mom = await createMember('Grandpa MATERNAL', 'male', 'Mom Side');

    // 2. Generation 2 (Parents & Aunts/Uncles)
    const dad = await createMember('Dad USER', 'male', 'Father');
    const aunt = await createMember('Aunt PATERNAL', 'female', 'Dad Sister');
    
    const mom = await createMember('Mom USER', 'female', 'Mother');
    const uncle = await createMember('Uncle MATERNAL', 'male', 'Mom Brother');

    // 3. Generation 3 (Me & Cousins)
    const me = await createMember('Me ROOT', 'male', 'The Architect');
    const cousin_pat = await createMember('Cousin PATERNAL', 'male', 'Aunt Son');
    const cousin_mat = await createMember('Cousin MATERNAL', 'female', 'Uncle Daughter');

    console.log('\n🔗 BUILDING GRAPH...');

    // Links: Ancestry
    await canonicalConnect(gp_dad, dad, 'parent_of');
    await canonicalConnect(gp_dad, aunt, 'parent_of');
    await canonicalConnect(gp_mom, mom, 'parent_of');
    await canonicalConnect(gp_mom, uncle, 'parent_of');

    // Links: Marriage (Parents)
    await canonicalConnect(dad, mom, 'married_to');

    // Links: My Parents -> Me
    await canonicalConnect(dad, me, 'parent_of');
    await canonicalConnect(mom, me, 'parent_of');

    // Links: Cousins
    await canonicalConnect(aunt, cousin_pat, 'parent_of');
    await canonicalConnect(uncle, cousin_mat, 'parent_of');

    // THE CYCLE: Cousin Marriage
    console.log('\n🔥 CREATING CYCLE (Cousin Marriage)...');
    await canonicalConnect(cousin_pat, cousin_mat, 'married_to');

    console.log('\n✨ COMPLETE.');
  } catch (err) {
    console.error(err);
  }
}

seed();