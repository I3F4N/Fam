'use server';

import { createClient } from '@supabase/supabase-js';

// Initialize Admin Client (Bypasses RLS to see all connections)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

type RelationshipStep = {
  nodeId: string;
  relation: 'parent' | 'child' | 'spouse';
  gender: 'male' | 'female' | 'other';
};

export async function findRelationship(sourceId: string, targetId: string) {
  if (sourceId === targetId) return "This is you.";

  // 1. Fetch entire graph
  const { data: members } = await supabase.from('members').select('id, gender');
  const { data: connections } = await supabase.from('connections').select('*');

  if (!members || !connections) return "Neural Link Severed (DB Error)";

  // 2. Build Graph Map
  const graph = new Map<string, Array<{ id: string; type: 'parent' | 'child' | 'spouse' }>>();
  const genderMap = new Map<string, 'male' | 'female' | 'other'>();

  members.forEach(m => genderMap.set(m.id, m.gender));

  connections.forEach(c => {
    // Init arrays
    if (!graph.has(c.from_member_id)) graph.set(c.from_member_id, []);
    if (!graph.has(c.to_member_id)) graph.set(c.to_member_id, []);

    // Logic: If A 'parent_of' B...
    if (c.type === 'parent_of') {
      graph.get(c.from_member_id)?.push({ id: c.to_member_id, type: 'child' }); // Down
      graph.get(c.to_member_id)?.push({ id: c.from_member_id, type: 'parent' }); // Up
    } 
    else if (c.type === 'married_to') {
      graph.get(c.from_member_id)?.push({ id: c.to_member_id, type: 'spouse' });
      graph.get(c.to_member_id)?.push({ id: c.from_member_id, type: 'spouse' });
    }
  });

  // 3. BFS Algorithm
  const queue: { current: string; path: RelationshipStep[] }[] = [{ current: sourceId, path: [] }];
  const visited = new Set<string>([sourceId]);

  while (queue.length > 0) {
    const { current, path } = queue.shift()!;

    if (current === targetId) {
      return translatePathToEnglish(path);
    }

    const neighbors = graph.get(current) || [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor.id)) {
        visited.add(neighbor.id);
        const newPath = [...path, { 
          nodeId: neighbor.id, 
          relation: neighbor.type,
          gender: genderMap.get(neighbor.id) || 'other'
        }];
        queue.push({ current: neighbor.id, path: newPath });
      }
    }
  }

  return "No direct blood connection found.";
}

// --- THE SMART "SIBLING" REDUCER ---
function translatePathToEnglish(path: RelationshipStep[]): string {
  if (path.length === 0) return "Unknown";

  // 1. Convert the path into a list of raw labels
  // e.g. ["Father", "Father", "Son", "Daughter"]
  let labels: string[] = [];
  
  for (const step of path) {
    if (step.relation === 'parent') {
      labels.push(step.gender === 'male' ? "Father" : "Mother");
    } else if (step.relation === 'child') {
      labels.push(step.gender === 'male' ? "Son" : "Daughter");
    } else if (step.relation === 'spouse') {
      labels.push(step.gender === 'male' ? "Husband" : "Wife");
    }
  }

  // 2. Reduce "Parent + Child" pairs into "Sibling"
  // We iterate backwards or forwards? Forwards works best for building the chain.
  // We need to collapse [..., "Father", "Son", ...] into [..., "Brother", ...]
  
  const reducedLabels: string[] = [];

  for (let i = 0; i < labels.length; i++) {
    const current = labels[i];
    const prev = reducedLabels.length > 0 ? reducedLabels[reducedLabels.length - 1] : null;

    // Check for the "Sibling Pattern"
    // Pattern: Previous was Parent, Current is Child
    const isParent = prev === "Father" || prev === "Mother";
    const isChild = current === "Son" || current === "Daughter";

    if (prev && isParent && isChild) {
      // Remove the "Father/Mother" we just added
      reducedLabels.pop();
      
      // Replace with "Brother/Sister"
      if (current === "Son") {
        reducedLabels.push("Brother");
      } else {
        reducedLabels.push("Sister");
      }
    } else {
      // No pattern, just add the label
      reducedLabels.push(current);
    }
  }

  // 3. Construct the Sentence
  if (reducedLabels.length === 1) {
    // Direct relation (e.g. "Brother", "Father")
    return reducedLabels[0];
  }

  // Complex relation (e.g. "Mother's Brother")
  let text = "Your";
  reducedLabels.forEach((label, i) => {
    const isLast = i === reducedLabels.length - 1;
    const suffix = isLast ? "" : "'s";
    text += ` ${label}${suffix}`;
  });

  return text;
}