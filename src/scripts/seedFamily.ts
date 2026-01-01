import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function seed() {
  console.log("🌱 Initializing Grand Archive Injection...");

  // --- 1. THE ROSTER ---
  // Status: "Late" is detected in the notes/logic, but we keep the name clean.
  const FAMILY_MEMBERS = [
    // --- GENERATION 0 (Roots) ---
    { id: 'root_sulaiman', first: 'A.', last: 'Sulaiman', gender: 'male', deceased: true },
    { id: 'root_kunhayisha', first: 'B.', last: 'Kunhayisha', gender: 'female', deceased: true },

    // --- GENERATION 1 (The Sisters) ---
    { id: 'g1_thayyiba', first: 'B.', last: 'Thayyiba', gender: 'female', note: 'Moothamma' },
    { id: 'g1_thahira', first: 'B.', last: 'Thahira', gender: 'female', note: 'Cheriyithatha' },
    { id: 'g1_saliha', first: 'B.', last: 'Saliha', gender: 'female', note: 'Salithatha' },
    { id: 'g1_zainabi', first: 'B.', last: 'Zainabi', gender: 'female', note: 'Poothatha' },
    { id: 'g1_nasira', first: 'B.', last: 'Nasira', gender: 'female', note: 'Aama' },
    { id: 'g1_mansoora', first: 'B.', last: 'Mansoora', gender: 'female' },

    // --- BRANCH: THAYYIBA ---
    { id: 'ashraf', first: 'Ashraf', last: 'Ali', gender: 'male' },
    { id: 'raseena', first: 'Raseena', last: '', gender: 'female' },
    { id: 'fathima', first: 'Fathima', last: 'Ashraf', gender: 'female' },
    { id: 'bilal', first: 'Bilal', last: 'Ashraf', gender: 'male' },
    { id: 'raniya', first: 'Raniya', last: 'Ashraf', gender: 'female' },

    { id: 'akthar', first: 'Akthar', last: 'Ali', gender: 'male' },
    { id: 'sheba', first: 'Sheba', last: '', gender: 'female' },
    { id: 'ayisha', first: 'Ayisha', last: 'Akthar', gender: 'female' },
    { id: 'salman_b', first: 'Salman', last: 'Bilavin', gender: 'male' },

    { id: 'salma', first: 'Salma', last: 'B', gender: 'female' },
    { id: 'ahmed_r', first: 'Ahmed', last: 'Rasheed', gender: 'male' },
    { id: 'roshan', first: 'Roshan', last: 'Ahmed', gender: 'male' },
    { id: 'asifa', first: 'Asifa', last: 'B', gender: 'female' },
    { id: 'zeeshan', first: 'Zeeshan', last: 'Ahmed', gender: 'male' },
    { id: 'ahmed_isa', first: 'Ahmed', last: 'Isa', gender: 'male' },

    // --- BRANCH: THAHIRA (YOURS) ---
    { id: 'mubashir', first: 'Mubashir', last: 'Ahmad', gender: 'male' },
    { id: 'shameera', first: 'Shameera', last: '', gender: 'female' },
    { id: 'suhana', first: 'Suhana', last: 'Mubashir', gender: 'female' },
    { id: 'lubna', first: 'Lubna', last: 'Mubashir', gender: 'female' },

    { id: 'musaddiq', first: 'Musaddiq', last: 'Ahmad', gender: 'male' }, // Dad
    { id: 'mumthaz', first: 'Mumthaz', last: '', gender: 'female' },       // Mom
    { id: 'irfan', first: 'Irfan', last: 'Ahmad', gender: 'male' },        // YOU
    { id: 'khoula', first: 'Khoula', last: 'Ahmad', gender: 'female' },

    { id: 'shahida', first: 'Shahida', last: 'B', gender: 'female' },
    { id: 'muneem', first: 'Muneem', last: 'Salam', gender: 'male' },
    { id: 'fida', first: 'Fida', last: 'Muneem', gender: 'female' },
    { id: 'nadia', first: 'Nadia', last: 'Muneem', gender: 'female' },
    { id: 'fazl', first: 'Fazl-ur-raheem', last: '', gender: 'male' },

    // --- BRANCH: SALIHA ---
    { id: 'khaleel', first: 'Khaleel', last: 'Ahmed', gender: 'male' },
    { id: 'rafeena', first: 'Rafeena', last: '', gender: 'female' },
    { id: 'sahal', first: 'Sahal', last: 'Khaleel', gender: 'male' },
    { id: 'fahar', first: 'Fahar', last: 'Jameel', gender: 'male' },

    { id: 'sabira', first: 'B', last: 'Sabira', gender: 'female' },
    { id: 'muzaffar', first: 'Muzaffar', last: 'Ahmed', gender: 'male' },
    { id: 'farhan', first: 'Farhan', last: '', gender: 'male' },
    { id: 'thuba', first: 'Thuba', last: 'Samreen', gender: 'female' },
    { id: 'safwan', first: 'Safwan', last: 'Ahmed', gender: 'male' },
    
    { id: 'jameel', first: 'Jameel', last: '', gender: 'male', deceased: true }, // Late Jameel

    // --- BRANCH: ZAINABI ---
    { id: 'sajna', first: 'Sajna', last: 'Mashood', gender: 'female' },
    { id: 'jalal', first: 'Jalaluddin', last: '', gender: 'male' },
    { id: 'shariq', first: 'Shariq', last: '', gender: 'male' },
    { id: 'tariq', first: 'Tariq', last: '', gender: 'male' },
    { id: 'aliya', first: 'Aliya', last: 'Jalaluddin', gender: 'female' },
    { id: 'amila', first: 'Amila', last: 'Jalaluddin', gender: 'female' },

    { id: 'riyadh', first: 'Riyadh', last: 'Mashood', gender: 'male', deceased: true }, // Late Riyadh

    { id: 'fahd', first: 'Fahd', last: 'Mashood', gender: 'male' },
    { id: 'nasiya', first: 'Nasiya', last: '', gender: 'female' },
    { id: 'nuha', first: 'Nuha', last: '', gender: 'female' },

    // --- BRANCH: NASIRA ---
    { id: 'nishan', first: 'Nishan', last: 'Ahmed', gender: 'male' },
    { id: 'sanooja', first: 'Sanooja', last: '', gender: 'female' },
    { id: 'imran', first: 'Imran', last: 'Ahmed', gender: 'male' },

    // --- BRANCH: MANSOORA ---
    { id: 'shifad', first: 'Shifad', last: 'Wahid', gender: 'male' }, // SVP AIG
    { id: 'anam', first: 'Anam', last: '', gender: 'female' },
    { id: 'armaan', first: 'Armaan', last: '', gender: 'male' },

    { id: 'niyad', first: 'Niyad', last: 'Wahid', gender: 'male' }, // Navizone
    { id: 'azra', first: 'Azra', last: '', gender: 'female' },
    { id: 'rohan', first: 'Rohan', last: '', gender: 'male' },

    { id: 'haima', first: 'Haima', last: 'Wahid', gender: 'female' },
    { id: 'anees', first: 'Anees', last: '', gender: 'male' },
    { id: 'rayhan', first: 'Rayhan', last: '', gender: 'male' },
  ];

  // --- 2. RELATIONSHIPS ---
  const RELATIONSHIPS = [
    // Roots -> Sisters
    { p: 'root_sulaiman', c: 'g1_thayyiba' }, { p: 'root_kunhayisha', c: 'g1_thayyiba' },
    { p: 'root_sulaiman', c: 'g1_thahira' },  { p: 'root_kunhayisha', c: 'g1_thahira' },
    { p: 'root_sulaiman', c: 'g1_saliha' },   { p: 'root_kunhayisha', c: 'g1_saliha' },
    { p: 'root_sulaiman', c: 'g1_zainabi' },  { p: 'root_kunhayisha', c: 'g1_zainabi' },
    { p: 'root_sulaiman', c: 'g1_nasira' },   { p: 'root_kunhayisha', c: 'g1_nasira' },
    { p: 'root_sulaiman', c: 'g1_mansoora' }, { p: 'root_kunhayisha', c: 'g1_mansoora' },

    // Thayyiba Branch
    { p: 'g1_thayyiba', c: 'ashraf' }, { p: 'ashraf', s: 'raseena' },
      { p: 'ashraf', c: 'fathima' }, { p: 'ashraf', c: 'bilal' }, { p: 'ashraf', c: 'raniya' },
    { p: 'g1_thayyiba', c: 'akthar' }, { p: 'akthar', s: 'sheba' },
      { p: 'akthar', c: 'ayisha' }, { p: 'akthar', c: 'salman_b' },
    { p: 'g1_thayyiba', c: 'salma' }, { p: 'salma', s: 'ahmed_r' },
      { p: 'salma', c: 'roshan' }, { p: 'salma', c: 'asifa' }, { p: 'salma', c: 'zeeshan' }, { p: 'salma', c: 'ahmed_isa' },

    // Thahira Branch (Yours)
    { p: 'g1_thahira', c: 'mubashir' }, { p: 'mubashir', s: 'shameera' },
      { p: 'mubashir', c: 'suhana' }, { p: 'mubashir', c: 'lubna' },
    { p: 'g1_thahira', c: 'musaddiq' }, { p: 'musaddiq', s: 'mumthaz' },
      { p: 'musaddiq', c: 'irfan' }, { p: 'musaddiq', c: 'khoula' },
      { p: 'mumthaz', c: 'irfan' }, { p: 'mumthaz', c: 'khoula' },
    { p: 'g1_thahira', c: 'shahida' }, { p: 'shahida', s: 'muneem' },
      { p: 'shahida', c: 'fida' }, { p: 'shahida', c: 'nadia' }, { p: 'shahida', c: 'fazl' },

    // Saliha Branch
    { p: 'g1_saliha', c: 'khaleel' }, { p: 'khaleel', s: 'rafeena' },
      { p: 'khaleel', c: 'sahal' }, { p: 'khaleel', c: 'fahar' },
    { p: 'g1_saliha', c: 'sabira' }, { p: 'sabira', s: 'muzaffar' },
      { p: 'sabira', c: 'farhan' }, { p: 'sabira', c: 'thuba' }, { p: 'sabira', c: 'safwan' },
    { p: 'g1_saliha', c: 'jameel' }, // Late Jameel

    // Zainabi Branch
    { p: 'g1_zainabi', c: 'sajna' }, { p: 'sajna', s: 'jalal' },
      { p: 'sajna', c: 'shariq' }, { p: 'sajna', c: 'tariq' }, { p: 'sajna', c: 'aliya' }, { p: 'sajna', c: 'amila' },
    { p: 'g1_zainabi', c: 'riyadh' }, // Late Riyadh
    { p: 'g1_zainabi', c: 'fahd' }, { p: 'fahd', s: 'nasiya' },
      { p: 'fahd', c: 'nuha' },

    // Nasira Branch
    { p: 'g1_nasira', c: 'nishan' }, { p: 'nishan', s: 'sanooja' },
      { p: 'nishan', c: 'imran' },

    // Mansoora Branch
    { p: 'g1_mansoora', c: 'shifad' }, { p: 'shifad', s: 'anam' },
      { p: 'shifad', c: 'armaan' },
    { p: 'g1_mansoora', c: 'niyad' }, { p: 'niyad', s: 'azra' },
      { p: 'niyad', c: 'rohan' },
    { p: 'g1_mansoora', c: 'haima' }, { p: 'haima', s: 'anees' },
      { p: 'haima', c: 'rayhan' },
  ];

  // --- 3. EXECUTION ---
  const idMap: Record<string, string> = {};

  // 1. LINK TO YOU (ROOT)
  const { data: rootUser } = await supabase.from('members').select('id').ilike('first_name', 'Irfan').eq('last_name', 'Ahmad').single();
  if (!rootUser) { console.error("❌ ERROR: Irfan Ahmad not found. Run SQL Insert first."); return; }
  idMap['irfan'] = rootUser.id;

  // 2. INSERT ALL MEMBERS
  for (const p of FAMILY_MEMBERS) {
    if (p.id === 'irfan') continue;

    // STORE DECEASED STATUS IN NOTES FOR NOW (To avoid DB schema changes)
    const notes = p.deceased ? 'DECEASED' : (p as any).note || null;

    const { data, error } = await supabase.from('members').insert({
      first_name: p.first,
      last_name: p.last,
      gender: p.gender,
      is_verified: true,
      notes: notes
    }).select().single();

    if (error) { console.error(`❌ Error ${p.first}:`, error.message); continue; }
    idMap[p.id] = data.id;
    console.log(`✨ Added: ${p.first} ${p.deceased ? '(Late)' : ''}`);
  }

  // 3. CREATE LINKS
  const links = [];
  for (const r of RELATIONSHIPS) {
    if ((r as any).p && (r as any).c) {
      const pID = idMap[(r as any).p]; const cID = idMap[(r as any).c];
      if (pID && cID) links.push({ from_member_id: pID, to_member_id: cID, type: 'parent_of' });
    }
    if ((r as any).p && (r as any).s) {
      const pID = idMap[(r as any).p]; const sID = idMap[(r as any).s];
      if (pID && sID) {
        const [id1, id2] = pID < sID ? [pID, sID] : [sID, pID];
        links.push({ from_member_id: id1, to_member_id: id2, type: 'married_to' });
      }
    }
  }
  if (links.length) await supabase.from('connections').insert(links);
  console.log(`✅ Family Tree Built with ${links.length} connections.`);
}

seed();