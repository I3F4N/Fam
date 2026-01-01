'use client';

/**
 * FAMILY GRAPH COMPONENT (v19.0: Grand Gallery)
 * ---------------------------------------------
 * Architecture: Wide Cylindrical Projection (270deg)
 * Logic: Recursive Center Algorithm + Deep Zipper (+/- 40)
 * UX: Ghost Labels (Always Visible, Contextual Opacity)
 * Visuals: Neon Cyberpunk + High Contrast Beams
 */

import { useEffect, useState, useRef, useCallback } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { createClient } from '@supabase/supabase-js';

// 3D & Graph Imports
import SpriteText from 'three-spritetext';
import * as THREE from 'three'; 
// @ts-ignore
import * as d3 from 'd3-force';

// Utils & Actions
import { findRelationship } from '@/utils/relationshipCalculator'; 
import { addRelative } from '@/app/actions/addRelative'; 
import { updateMember, deleteMember } from '@/app/actions/nodeOperations';

// --- TYPES ---
interface FamilyNode {
  id: string;
  user_id?: string;
  name: string;
  firstName: string;
  lastName: string;
  gender: 'male' | 'female';
  img?: string;
  notes?: string;
  isDeceased: boolean;
  val: number;   
  level: number; 
  // Deterministic Locks
  fx?: number; 
  fy?: number; 
  fz?: number;
  x?: number;
  y?: number;
  z?: number;
  // Calculation Temp props
  rawX?: number;
}

interface FamilyLink {
  source: string | FamilyNode;
  target: string | FamilyNode;
  type: 'parent_of' | 'married_to';
}

interface GraphData {
  nodes: FamilyNode[];
  links: FamilyLink[];
}

const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
  ssr: false
});

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function FamilyGraph() {
  const router = useRouter();
  const graphRef = useRef<any>(null);
   
  // --- STATE ---
  const [graphData, setGraphData] = useState<GraphData | null>(null);
  const [clanSet, setClanSet] = useState<Set<string>>(new Set());
  const [isAdmin, setIsAdmin] = useState(false);

  // Focus Mode State
  const [hoverNode, setHoverNode] = useState<FamilyNode | null>(null);
  const [highlightNodes, setHighlightNodes] = useState<Set<string>>(new Set());
  const [highlightLinks, setHighlightLinks] = useState<Set<FamilyLink>>(new Set());

  // UI State
  const [selectedNode, setSelectedNode] = useState<FamilyNode | null>(null);
  const [relationshipText, setRelationshipText] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<FamilyNode[]>([]);
   
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    gender: 'male',
    relation: 'child'
  });

  // ---------------------------------------------------------------------------
  // 1. TOPOLOGY HELPER
  // ---------------------------------------------------------------------------
  const calculateTopology = (nodes: any[], links: any[]) => {
    const clanIds = new Set<string>();
    const generationMap: Record<string, number> = {}; 
    const childrenMap: Record<string, string[]> = {}; 
    const spouseMap: Record<string, string> = {}; 
    const childIds = new Set<string>(); 

    links.forEach((l: any) => {
        if (l.type === 'parent_of') {
            if (!childrenMap[l.source]) childrenMap[l.source] = [];
            childrenMap[l.source].push(l.target);
            childIds.add(l.target);
        } else if (l.type === 'married_to') {
            spouseMap[l.source] = l.target;
            spouseMap[l.target] = l.source;
        }
    });

    const potentialRoots = nodes.filter(n => !childIds.has(n.id));
    const getDepth = (id: string): number => {
        const children = childrenMap[id] || [];
        if (children.length === 0) return 0;
        return 1 + Math.max(...children.map(getDepth));
    };
    const rootDepths = potentialRoots.map(r => ({ id: r.id, depth: getDepth(r.id) }));
    const maxDepth = Math.max(...rootDepths.map(r => r.depth), 0);
    const trueSeedRoots = rootDepths.filter(r => r.depth >= Math.max(1, maxDepth - 1)).map(r => r.id);

    const queue = [...trueSeedRoots];
    trueSeedRoots.forEach(id => { clanIds.add(id); generationMap[id] = 0; });

    const processQueue = [...trueSeedRoots];
    while (processQueue.length > 0) {
        const currId = processQueue.shift()!;
        const currentGen = generationMap[currId];
        const children = childrenMap[currId] || [];
        children.forEach(childId => {
            clanIds.add(childId);
            if (generationMap[childId] === undefined) {
                generationMap[childId] = currentGen + 1;
                processQueue.push(childId);
            }
        });
    }

    for (let i = 0; i < 3; i++) {
        nodes.forEach(node => {
            if (!clanIds.has(node.id)) {
                const partnerId = spouseMap[node.id];
                if (partnerId && generationMap[partnerId] !== undefined) {
                    generationMap[node.id] = generationMap[partnerId];
                }
            }
        });
    }

    nodes.forEach(node => {
        if (generationMap[node.id] === undefined) generationMap[node.id] = maxDepth + 1;
    });

    return { clanIds, generationMap, spouseMap };
  };

  // ---------------------------------------------------------------------------
  // 2. DATA FETCHING & GRAND GALLERY LAYOUT
  // ---------------------------------------------------------------------------
  const fetchGraphData = useCallback(async () => {
    try {
      console.log("Fetching Graph Data...");
      const { data: { user } } = await supabase.auth.getUser();
      if (user?.email) {
        const { data: adminEntry } = await supabase.from('admin_whitelist').select('id').eq('email', user.email).single();
        setIsAdmin(!!adminEntry); 
      } else { setIsAdmin(false); }

      const { data: members } = await supabase.from('members').select('*');
      const { data: connections } = await supabase.from('connections').select('*');

      if (!members || !connections) return;

      const rawNodes = members.map((m: any) => ({
        id: m.id,
        user_id: m.user_id,
        name: m.first_name + ' ' + m.last_name,
        firstName: m.first_name, 
        lastName: m.last_name,    
        gender: m.gender,
        img: m.avatar_url,
        notes: m.notes || '',
        isDeceased: (m.notes && m.notes.includes('DECEASED')) || (m.first_name + ' ' + m.last_name).toLowerCase().includes('late')
      }));

      const links = connections.map((c: any) => ({
        source: c.from_member_id,
        target: c.to_member_id,
        type: c.type
      }));

      const { clanIds, generationMap, spouseMap } = calculateTopology(rawNodes, links);
      setClanSet(clanIds);

      // --- NODE SIZING ---
      const processedNodes = rawNodes.map((n: any) => {
          const gen = generationMap[n.id] || 0;
          const isClan = clanIds.has(n.id);
          let sizeVal = 15; 
          if (isClan) {
              if (gen === 0) sizeVal = 40;      // Roots
              else if (gen === 1) sizeVal = 25; // Parents
              else sizeVal = 15;                // Kids
          } 
          return { ...n, val: sizeVal, level: gen };
      });

      // --- THE GRAND GALLERY LAYOUT ---
      const bloodlineNodes = processedNodes.filter(n => clanIds.has(n.id));
      const spouseNodes = processedNodes.filter(n => !clanIds.has(n.id));

      const hierarchy: Record<string, any[]> = {}; 
      bloodlineNodes.forEach(n => {
          const parentLink = links.find(l => l.target === n.id && l.type === 'parent_of' && clanIds.has(l.source));
          const parentId = parentLink ? parentLink.source : 'root';
          if (!hierarchy[parentId]) hierarchy[parentId] = [];
          hierarchy[parentId].push(n);
      });
      Object.values(hierarchy).forEach(kids => kids.sort((a,b) => a.id.localeCompare(b.id)));

      let leafIndex = 0;
      const visited = new Set<string>();

      const assignPositions = (nodeId: string): number => {
          if (visited.has(nodeId)) return 0;
          visited.add(nodeId);
          const children = hierarchy[nodeId] || [];
          let myX = 0;
          if (children.length === 0) {
              myX = leafIndex;
              leafIndex++;
          } else {
              const childXs = children.map(child => assignPositions(child.id));
              myX = (childXs[0] + childXs[childXs.length - 1]) / 2;
          }
          const node = bloodlineNodes.find(n => n.id === nodeId);
          if (node) node.rawX = myX; 
          return myX;
      };

      const roots = bloodlineNodes.filter(n => n.level === 0);
      roots.forEach(root => assignPositions(root.id));

      const maxX = Math.max(leafIndex, 1); 

      // 4. APPLY "GRAND GALLERY" PROJECTION
      const levelGroups: Record<number, FamilyNode[]> = {};
      bloodlineNodes.forEach(node => {
          if(!levelGroups[node.level]) levelGroups[node.level] = [];
          levelGroups[node.level].push(node);
      });

      Object.values(levelGroups).forEach(group => group.sort((a,b) => (a.rawX || 0) - (b.rawX || 0)));

      Object.keys(levelGroups).forEach(levelKey => {
          const lvl = parseInt(levelKey);
          const nodesInLevel = levelGroups[lvl];

          nodesInLevel.forEach((node, i) => {
              if (node.rawX !== undefined) {
                  // WIDE ARC: Spread across 270 degrees (PI * 1.5)
                  const angle = ((node.rawX / maxX) - 0.5) * (Math.PI * 1.5); 
                  const radius = 1200 - (node.level * 50); 

                  node.fx = Math.sin(angle) * radius; 
                  node.fz = Math.cos(angle) * radius; 
                  
                  // DEEP ZIPPER: +/- 40 vertical offset
                  const zipperOffset = (i % 2 === 0) ? -40 : 40;
                  node.fy = (-node.level * 250) + zipperOffset;        
              }
          });
      });

      // 5. ATTACH SPOUSES
      spouseNodes.forEach(spouse => {
          const partnerId = spouseMap[spouse.id];
          const partner = bloodlineNodes.find(n => n.id === partnerId);
          
          if (partner && partner.rawX !== undefined) {
              const offsetAngle = 0.04; 
              const angle = ((partner.rawX / maxX) - 0.5) * (Math.PI * 1.5) + offsetAngle;
              const radius = 1200 - (partner.level * 50);

              spouse.fx = Math.sin(angle) * radius;
              spouse.fz = Math.cos(angle) * radius;
              spouse.fy = partner.fy; 
              spouse.level = partner.level;
          } else {
              spouse.fx = 0; spouse.fy = -spouse.level * 250; spouse.fz = 1200;
          }
      });

      const allNodes = [...bloodlineNodes, ...spouseNodes];
      setGraphData({ nodes: allNodes, links });
      
    } catch (e) { console.error("Critical Fetch Error:", e); }
  }, []);

  useEffect(() => { fetchGraphData(); }, [fetchGraphData]);

  // ---------------------------------------------------------------------------
  // 3. INTERACTION ENGINE
  // ---------------------------------------------------------------------------
  const handleNodeHover = (node: any) => {
    setHoverNode(node || null);
    const newHighlights = new Set<string>();
    const newLinkHighlights = new Set<FamilyLink>();

    if (node) {
      newHighlights.add(node.id);
      graphData?.links.forEach(link => {
        const sourceId = typeof link.source === 'object' ? (link.source as FamilyNode).id : link.source;
        const targetId = typeof link.target === 'object' ? (link.target as FamilyNode).id : link.target;
        
        if (sourceId === node.id || targetId === node.id) {
          newHighlights.add(sourceId as string);
          newHighlights.add(targetId as string);
          newLinkHighlights.add(link);
        }
      });
    }
    setHighlightNodes(newHighlights);
    setHighlightLinks(newLinkHighlights);
  };

  // ---------------------------------------------------------------------------
  // 4. PHYSICS ENGINE (STABILIZER)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (graphRef.current) {
        graphRef.current.d3Force('link').distance((link: any) => {
            return link.type === 'married_to' ? 1 : 100;
        });
        graphRef.current.d3Force('charge', null);
        graphRef.current.d3Force('center', null);
        graphRef.current.d3Force('collide', null);
    }
  }, [graphData]); 

  // ---------------------------------------------------------------------------
  // 5. VISUALS & CAMERA
  // ---------------------------------------------------------------------------
  const flyToNode = useCallback((node: any) => {
    if (graphRef.current) {
      const targetX = node.fx ?? node.x;
      const targetY = node.fy ?? node.y;
      const targetZ = node.fz ?? node.z;

      graphRef.current.cameraPosition(
        { x: targetX, y: targetY + 100, z: targetZ + 500 }, 
        { x: targetX, y: targetY, z: targetZ }, 
        3000
      );
    }
  }, []);

  useEffect(() => {
    const triggerAutoPilot = async () => {
        if (!graphData || !graphData.nodes.length) return;
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            const myNode = graphData.nodes.find(n => n.user_id === user.id);
            if (myNode) {
                setTimeout(() => {
                    flyToNode(myNode);
                    setSelectedNode(myNode);
                }, 500); 
            }
        }
    };
    triggerAutoPilot();
  }, [graphData, flyToNode]);

  // Starfield
  useEffect(() => {
    if (graphData && graphRef.current) {
      const scene = graphRef.current.scene();
      if (scene.getObjectByName('starfield')) return;
      const starGeometry = new THREE.BufferGeometry();
      const starCount = 1500;
      const positions = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 8000; 
      }
      starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const starMaterial = new THREE.PointsMaterial({ 
          color: 0xffffff, size: 2, sizeAttenuation: true, transparent: true, opacity: 0.4 
      });
      const stars = new THREE.Points(starGeometry, starMaterial);
      stars.name = 'starfield';
      scene.add(stars);
    }
  }, [graphData]);

  // Node Renderer
  const nodeThreeObject = useCallback((node: any) => {
    const group = new THREE.Group();
    
    // VISIBILITY LOGIC:
    const isGlobalHover = hoverNode !== null;
    const isHighlighted = highlightNodes.has(node.id);
    const isDeceased = node.isDeceased;
    const isClanMember = clanSet.has(node.id);
    
    // GHOST LABELS:
    // If Highlighted or Important -> 1.0
    // Else -> 0.4 (Ghost)
    const isTargeted = isHighlighted || (!isGlobalHover && node.level <= 1);
    const opacityLevel = isTargeted ? 1 : 0.4;

    // LABEL (Always Rendered, Opacity Controlled)
    const cleanName = node.name.replace(/Late\.?\s*/i, '');
    const label = new SpriteText(cleanName);
    label.color = `rgba(255,255,255,${opacityLevel})`; // White with alpha
    label.backgroundColor = `rgba(0,0,0,${0.6 * opacityLevel})`; // Background fade
    label.padding = 6;
    label.borderRadius = 8;
    label.textHeight = Math.max(4, node.val / 4); 
    const baseRadius = node.val;
    label.position.set(0, -(baseRadius + (node.val/2)), 0); 
    group.add(label);

    let primaryColor;
    if (isDeceased) primaryColor = '#E5E4E2'; 
    else if (isClanMember) primaryColor = '#FFD700'; 
    else primaryColor = '#6366f1'; 

    if (node.img) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const size = 256; canvas.width = size; canvas.height = size;
      if (ctx) {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = node.img;
        img.onload = () => {
          ctx.beginPath(); ctx.arc(size/2, size/2, size/2, 0, Math.PI*2); ctx.closePath(); ctx.clip();
          if (isDeceased) ctx.filter = 'grayscale(100%) brightness(0.8)';
          ctx.drawImage(img, 0, 0, size, size);
          ctx.filter = 'none'; ctx.lineWidth = 15; ctx.strokeStyle = primaryColor; ctx.stroke();
          const texture = new THREE.CanvasTexture(canvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          // Apply opacity to avatar as well
          const spriteMat = new THREE.SpriteMaterial({ map: texture, transparent: true, opacity: isDeceased ? 0.85 * opacityLevel : opacityLevel });
          const sprite = new THREE.Sprite(spriteMat);
          const scale = baseRadius * 2.5; sprite.scale.set(scale, scale, 1); group.add(sprite);
        };
      }
    } else {
      const geometry = new THREE.SphereGeometry(baseRadius, 32, 32);
      const material = new THREE.MeshPhysicalMaterial({
        color: primaryColor, roughness: 0.2, metalness: 0.8, transparent: true, opacity: 0.9 * opacityLevel
      });
      const sphere = new THREE.Mesh(geometry, material);
      group.add(sphere);
    }
    
    if (opacityLevel > 0.1) {
        if (isDeceased) {
            const haloGeo = new THREE.TorusGeometry(baseRadius + (baseRadius * 0.3), 1, 16, 100);
            const haloMat = new THREE.MeshBasicMaterial({ color: 0xFFFFFF, transparent: true, opacity: 0.5 * opacityLevel });
            const halo = new THREE.Mesh(haloGeo, haloMat);
            halo.rotation.x = Math.PI / 2; halo.position.y = baseRadius + 5; group.add(halo);
        } else if (node.gender === 'female') {
            const ringGeo = new THREE.TorusGeometry(baseRadius + (baseRadius * 0.1), 0.5, 8, 50); 
            const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.4 * opacityLevel, transparent: true });
            const ring = new THREE.Mesh(ringGeo, ringMat);
            ring.rotation.x = Math.PI / 2; group.add(ring);
        }
    }

    return group;
  }, [clanSet, hoverNode, highlightNodes]); 

  // --- HANDLERS ---
  useEffect(() => {
    if (searchQuery.trim() === "" || !graphData) { setSearchResults([]); return; }
    const lowerQuery = searchQuery.toLowerCase();
    const results = graphData.nodes.filter(node => node.name.toLowerCase().includes(lowerQuery)).slice(0, 5); 
    setSearchResults(results);
  }, [searchQuery, graphData]);

  const handleSearchSelect = (node: any) => {
    setSearchQuery(""); setSearchResults([]);
    flyToNode(node);
    handleNodeClick(node);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); router.refresh(); };

  const handleNodeClick = async (node: any) => {
    if (!node) return;
    flyToNode(node);
    setSelectedNode(node);
    setRelationshipText("Calculating Neural Link...");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setRelationshipText("Authentication Signal Lost."); return; }
      const myNode = graphData?.nodes.find(n => n.user_id === user.id);
      if (myNode) {
        const text = await findRelationship(myNode.id, node.id);
        setRelationshipText(text);
      } else { setRelationshipText("Identity Unverified."); }
    } catch (error) { console.error(error); setRelationshipText("Neural Link Severed."); }
  };

  const handleBackgroundClick = () => {
    setSelectedNode(null); setRelationshipText(""); setIsModalOpen(false);
    if (graphRef.current) {
      graphRef.current.cameraPosition({ x: 0, y: 200, z: 2000 }, { x: 0, y: 0, z: 800 }, 3000);
    }
  };

  const handleOpenAdd = () => {
    setModalMode('add');
    setFormData({ firstName: '', lastName: '', gender: 'male', relation: 'child' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = () => {
    if (!selectedNode) return;
    setModalMode('edit');
    const cleanFirst = selectedNode.firstName.replace(/Late\.?\s*/i, '');
    setFormData({ firstName: cleanFirst, lastName: selectedNode.lastName, gender: selectedNode.gender, relation: 'child' });
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedNode) return;
    if (window.confirm(`Are you sure you want to permanently delete ${selectedNode.name}?`)) {
        const result = await deleteMember(selectedNode.id);
        if (result.success) { setSelectedNode(null); await fetchGraphData(); } 
        else { alert("Error: " + result.error); }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode) return;
    setIsSubmitting(true);
    let result;
    try {
      if (modalMode === 'add') result = await addRelative(selectedNode.id, formData);
      else result = await updateMember(selectedNode.id, formData);

      if (result.success) {
        await fetchGraphData();
        setIsModalOpen(false);
        if (modalMode === 'edit') {
           setSelectedNode({ ...selectedNode, name: `${formData.firstName} ${formData.lastName}`, firstName: formData.firstName, lastName: formData.lastName, gender: formData.gender } as FamilyNode);
        }
      } else { alert("Error: " + result.error); }
    } catch (e) { console.error("Submission Error", e); } 
    finally { setIsSubmitting(false); }
  };

  if (!graphData) return <div className="text-white p-10 font-mono">Loading Neural Link...</div>;

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      
      {/* HEADER */}
      <header className="fixed top-0 left-0 w-full z-50 flex flex-col md:flex-row items-center justify-between px-4 py-4 md:px-8 md:py-6 pointer-events-none gap-4">
    <div className="pointer-events-auto text-center md:text-left">
      <h1 className="text-white font-bold tracking-widest text-lg drop-shadow-md">PROJECT BILAVINAKATH</h1>
      <div className="flex items-center gap-3">
        <p className="text-zinc-500 text-[10px] uppercase tracking-[0.3em]">
            Bloodline Visualization v18.0
        </p>
        {/* THE NEW COUNTER */}
        <span className="px-2 py-0.5 rounded bg-zinc-800 border border-zinc-700 text-[10px] text-emerald-400 font-mono">
            {graphData ? graphData.nodes.length : 0} MEMBERS
        </span>
      </div>
    </div>
        <div className="pointer-events-auto text-center md:text-left">
          <h1 className="text-white font-bold tracking-widest text-lg drop-shadow-md">PROJECT BILAVINAKATH</h1>
          <p className="text-zinc-500 text-[10px] uppercase tracking-[0.3em]">Bloodline Visualization v19.0 (Grand Gallery)</p>
        </div>
        <div className="pointer-events-auto relative w-full md:w-96">
          <div className="relative group">
            <div className="absolute -inset-0.5 bg-gradient-to-r from-indigo-500 to-purple-600 rounded-lg blur opacity-30 group-hover:opacity-60 transition duration-1000"></div>
            <input type="text" placeholder="Search Member..." value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
              className="relative w-full bg-black/80 backdrop-blur-md border border-zinc-700 text-white text-sm rounded-lg px-4 py-2 outline-none focus:border-indigo-500 transition-all placeholder-zinc-600" />
          </div>
          {searchResults.length > 0 && (
            <div className="absolute top-full mt-2 w-full bg-zinc-900/95 border border-zinc-700 rounded-lg shadow-2xl overflow-hidden backdrop-blur-md">
              {searchResults.map((node) => (
                <button key={node.id} onClick={() => handleSearchSelect(node)}
                  className="w-full text-left px-4 py-3 hover:bg-zinc-800 transition-colors flex items-center gap-3 group">
                  <div className={`w-2 h-2 rounded-full ${node.gender === 'male' ? 'bg-indigo-500' : 'bg-pink-500'}`}></div>
                  <span className="text-zinc-200 text-sm font-medium">{node.name.replace(/Late\.?\s*/i, '')}</span>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="pointer-events-auto absolute top-4 right-4 md:static">
          <button onClick={handleLogout} className="px-6 py-2 bg-black/40 backdrop-blur-md border border-red-500/30 rounded-full text-[10px] tracking-[0.2em] font-bold text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300 shadow-lg">DISCONNECT</button>
        </div>
      </header>

      {/* GRAPH ENGINE */}
      <ForceGraph3D
        ref={graphRef}
        graphData={graphData}
        
        // DETERMINISTIC LAYOUT: 1 TICK = INSTANT FREEZE
        dagMode={undefined}
        cooldownTicks={1} 
        
        onNodeHover={handleNodeHover}
        onNodeClick={handleNodeClick}
        onBackgroundClick={handleBackgroundClick}
        
        nodeThreeObjectExtend={false} 
        nodeThreeObject={nodeThreeObject} 
        nodeLabel={() => ""}
        nodeVal="val"
        
        // VISUAL UPDATE: HIGH CONTRAST NEON POLISH
        linkCurvature={0.25}
        linkCurveRotation={0.5}
        
        linkColor={(link: any) => {
            const isHidden = hoverNode && !highlightLinks.has(link);
            const alpha = isHidden ? 0.15 : (link.type === 'married_to' ? 1 : 0.9);
            return link.type === 'married_to' 
                ? `rgba(236, 72, 153, ${alpha})` // Neon Pink
                : `rgba(255, 215, 0, ${alpha})`;  // Solid Gold
        }}
        
        linkWidth={(link: any) => {
            if (highlightLinks.has(link)) return 8; 
            return link.type === 'married_to' ? 6 : 2.5; 
        }}
        
        linkDirectionalParticles={(link: any) => highlightLinks.has(link) ? 4 : 0}
        linkDirectionalParticleWidth={4}
        linkDirectionalParticleSpeed={0.01}
        
        // CRITICAL FIX: Velocity Decay is a PROP
        d3VelocityDecay={0.5}
        
        backgroundColor="#000000"
        controlType="orbit"
        
        onEngineStop={() => {
            if (graphRef.current) {
                const scene = graphRef.current.scene();
                scene.add(new THREE.AmbientLight(0xffffff, 0.6));
                const dirLight = new THREE.DirectionalLight(0xffffff, 1);
                dirLight.position.set(100, 100, 100);
                scene.add(dirLight);
            }
        }}
      />

      {/* LEGEND */}
      <div className="absolute bottom-4 right-4 md:bottom-10 md:right-10 scale-75 origin-bottom-right md:scale-100 p-4 bg-black/40 backdrop-blur-md border border-white/10 rounded-lg pointer-events-none select-none z-0">
        <h4 className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3 border-b border-white/10 pb-2">Index</h4>
        <div className="flex items-center gap-3 mb-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-[0_0_10px_#FFD700]"></div>
            <span className="text-xs text-white font-mono">Bilavinakath Bloodline</span>
        </div>
        <div className="flex items-center gap-3 mb-2">
            <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_10px_#6366f1]"></div>
            <span className="text-xs text-zinc-400 font-mono">Allied Families</span>
        </div>
        <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full border-2 border-zinc-400 bg-transparent"></div>
            <span className="text-xs text-zinc-400 font-mono">Ancestral Spirits</span>
        </div>
      </div>

      {/* HUD & MODAL */}
      {selectedNode && (
        <div className="fixed bottom-4 left-4 right-4 md:absolute md:left-10 md:bottom-10 md:right-auto md:w-auto z-40 p-6 bg-zinc-900/90 border border-zinc-700 rounded-xl backdrop-blur-md max-w-md shadow-2xl select-none">
          <div className="flex items-center gap-4 mb-4">
             {selectedNode.img ? (
              <img src={selectedNode.img} alt="avatar" className={`w-12 h-12 rounded-full object-cover border-2 ${selectedNode.isDeceased ? 'border-zinc-400 grayscale' : 'border-white/20'}`} />
            ) : (
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${selectedNode.isDeceased ? 'bg-zinc-600' : (clanSet.has(selectedNode.id) ? 'bg-yellow-600' : 'bg-indigo-600')}`}>
                 <span className="text-xl font-bold text-white">{selectedNode.name.replace(/Late\.?\s*/i, '')[0]}</span>
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white tracking-tight truncate">{selectedNode.name.replace(/Late\.?\s*/i, '')}</h2>
                  {isAdmin && (
                    <>
                      <button onClick={handleOpenEdit} className="text-zinc-500 hover:text-white transition" title="Edit Profile">✏️</button>
                      <button onClick={handleDelete} className="text-zinc-500 hover:text-red-500 transition" title="Delete Member">🗑️</button>
                    </>
                  )}
              </div>
              <p className="text-zinc-400 text-xs">ID: {selectedNode.id.slice(0,8)} {selectedNode.isDeceased && '(DECEASED)'}</p>
            </div>
          </div>
          <div className="border-t border-zinc-700 pt-3 mb-3">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">RELATIONSHIP PROTOCOL</p>
            <p className="text-md text-emerald-400 font-mono leading-tight">{relationshipText}</p>
          </div>
          {isAdmin && (
             <button onClick={handleOpenAdd} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold tracking-widest rounded border border-indigo-400 shadow-[0_0_15px_rgba(79,70,229,0.4)] transition-all">+ ADD RELATIVE</button>
          )}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-sm bg-zinc-900 border border-zinc-700 rounded-xl p-6 shadow-2xl relative">
            <h3 className="text-lg font-bold text-white mb-4">
                {modalMode === 'add' ? `Add Relative to ${selectedNode?.firstName}` : `Edit Profile: ${selectedNode?.firstName}`}
            </h3>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-2">
                <input type="text" placeholder="First Name" required className="bg-black border border-zinc-700 rounded p-2 text-white text-sm outline-none focus:border-indigo-500" value={formData.firstName} onChange={e => setFormData({...formData, firstName: e.target.value})} />
                <input type="text" placeholder="Last Name" required className="bg-black border border-zinc-700 rounded p-2 text-white text-sm outline-none focus:border-indigo-500" value={formData.lastName} onChange={e => setFormData({...formData, lastName: e.target.value})} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <select className="bg-black border border-zinc-700 rounded p-2 text-white text-sm outline-none focus:border-indigo-500" value={formData.gender} onChange={e => setFormData({...formData, gender: e.target.value})}>
                  <option value="male">Male</option><option value="female">Female</option>
                </select>
                {modalMode === 'add' && (
                    <select className="bg-black border border-zinc-700 rounded p-2 text-white text-sm outline-none focus:border-indigo-500" value={formData.relation} onChange={e => setFormData({...formData, relation: e.target.value})}>
                    <option value="child">Child (Son/Daughter)</option><option value="spouse">Spouse (Wife/Husband)</option><option value="parent">Parent (Mom/Dad)</option><option value="sibling">Sibling (Brother/Sister)</option>
                    </select>
                )}
              </div>
              <div className="flex gap-2 pt-2">
                <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-2 bg-zinc-800 hover:bg-zinc-700 text-white text-xs font-bold rounded transition">CANCEL</button>
                <button type="submit" disabled={isSubmitting} className="flex-1 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded transition shadow-[0_0_10px_rgba(16,185,129,0.4)]">
                    {isSubmitting ? 'PROCESSING...' : (modalMode === 'add' ? 'CONFIRM LINK' : 'SAVE CHANGES')}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}