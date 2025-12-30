'use client';

import { useEffect, useState, useRef, useCallback, useMemo } from 'react';
import dynamic from 'next/dynamic';
import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';
import SpriteText from 'three-spritetext';
import * as THREE from 'three'; 
import { findRelationship } from '@/utils/relationshipCalculator'; 
import { addRelative } from '@/app/actions/addRelative'; 
import { updateMember, deleteMember } from '@/app/actions/nodeOperations';

// 1. Dynamic Import
const ForceGraph3D = dynamic(() => import('react-force-graph-3d'), {
  ssr: false
});

// 2. Client Init
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function FamilyGraph() {
  const router = useRouter();
  const graphRef = useRef<any>(null);
  
  // --- STATE ---
  const [graphData, setGraphData] = useState<{ nodes: any[]; links: any[] } | null>(null);
  const [clanSet, setClanSet] = useState<Set<string>>(new Set());
  
  // HUD & UI State
  const [selectedNode, setSelectedNode] = useState<any>(null);
  const [relationshipText, setRelationshipText] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<any[]>([]);
  
  // Editor State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState<'add' | 'edit'>('add');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '',
    lastName: '',
    gender: 'male',
    relation: 'child'
  });

  // --- DATA FETCHING ---
  const fetchGraphData = useCallback(async () => {
    console.log("Fetching Graph Data...");
    const { data: user } = await supabase.auth.getUser();
    const currentUserId = user.user?.id;

    const { data: members } = await supabase.from('members').select('*');
    const { data: connections } = await supabase.from('connections').select('*');

    if (!members || !connections) return;

    const nodes = members.map((m: any) => ({
      id: m.id,
      user_id: m.user_id,
      name: m.first_name + ' ' + m.last_name,
      firstName: m.first_name, 
      lastName: m.last_name,   
      gender: m.gender,
      img: m.avatar_url
    }));

    const links = connections.map((c: any) => ({
      source: c.from_member_id,
      target: c.to_member_id,
      type: c.type
    }));

    // CALCULATE CLAN MEMBERS
    const rootNode = nodes.find((n: any) => n.user_id === currentUserId);
    if (rootNode) {
        const calculatedClan = calculateClanMembers(nodes, links, rootNode.id);
        setClanSet(calculatedClan);
    }

    setGraphData({ nodes, links });
  }, []);

  useEffect(() => {
    fetchGraphData();
  }, [fetchGraphData]);

  // --- THE CLAN LOGIC ---
  const calculateClanMembers = (nodes: any[], links: any[], rootId: string) => {
    const clanIds = new Set<string>();
    const parentMap: Record<string, string[]> = {};
    const childrenMap: Record<string, string[]> = {};
    const nodeMap: Record<string, any> = {};

    nodes.forEach((n: any) => { nodeMap[n.id] = n; });
    links.forEach((l: any) => {
        if (l.type === 'parent_of') {
            if (!childrenMap[l.source]) childrenMap[l.source] = [];
            childrenMap[l.source].push(l.target);
            if (!parentMap[l.target]) parentMap[l.target] = [];
            parentMap[l.target].push(l.source);
        }
    });

    const clanFathers = new Set<string>();
    const queueUp = [rootId];
    while (queueUp.length > 0) {
        const currId = queueUp.shift()!;
        clanFathers.add(currId); 
        const parents = parentMap[currId] || [];
        parents.forEach(pid => {
            const parentNode = nodeMap[pid];
            if (parentNode && parentNode.gender === 'male') {
                queueUp.push(pid);
            }
        });
    }

    const queueDown = Array.from(clanFathers);
    while (queueDown.length > 0) {
        const currId = queueDown.shift()!;
        clanIds.add(currId); 
        const children = childrenMap[currId] || [];
        children.forEach(childId => {
            if (!clanIds.has(childId)) {
                clanIds.add(childId);
                const childNode = nodeMap[childId];
                if (childNode && childNode.gender === 'male') {
                    queueDown.push(childId);
                }
            }
        });
    }
    return clanIds;
  };

  // --- VISUAL UPGRADE: COSMOS ---
  useEffect(() => {
    if (graphData && graphRef.current) {
      const scene = graphRef.current.scene();
      if (scene.getObjectByName('starfield')) return;

      const starGeometry = new THREE.BufferGeometry();
      const starCount = 1500;
      const positions = new Float32Array(starCount * 3);
      for (let i = 0; i < starCount * 3; i++) {
        positions[i] = (Math.random() - 0.5) * 4000; 
      }
      starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      const starMaterial = new THREE.PointsMaterial({
        color: 0xffffff, size: 2, sizeAttenuation: true, transparent: true, opacity: 0.8
      });
      const stars = new THREE.Points(starGeometry, starMaterial);
      stars.name = 'starfield';
      scene.add(stars);
    }
  }, [graphData]);

  // --- SEARCH & INTERACTION ---
  useEffect(() => {
    if (searchQuery.trim() === "" || !graphData) { setSearchResults([]); return; }
    const lowerQuery = searchQuery.toLowerCase();
    const results = graphData.nodes.filter(node => node.name.toLowerCase().includes(lowerQuery)).slice(0, 5); 
    setSearchResults(results);
  }, [searchQuery, graphData]);

  const flyToNode = (node: any) => {
    if (graphRef.current) {
      const distance = 40;
      const distRatio = 1 + distance/Math.hypot(node.x, node.y, node.z);
      graphRef.current.cameraPosition(
        { x: node.x * distRatio, y: node.y * distRatio, z: node.z * distRatio }, node, 1500
      );
    }
  };

  const handleSearchSelect = (node: any) => {
    setSearchQuery(""); setSearchResults([]);
    flyToNode(node);
    handleNodeClick(node);
  };

  const handleLogout = async () => { await supabase.auth.signOut(); router.refresh(); };

  const handleNodeClick = async (node: any) => {
    if (!node || node.x === undefined) return;
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
      graphRef.current.cameraPosition({ x: 0, y: 0, z: 400 }, { x: 0, y: 0, z: 0 }, 1500);
    }
  };

  // --- HANDLERS (Modal/Actions) ---
  const handleOpenAdd = () => {
    setModalMode('add');
    setFormData({ firstName: '', lastName: '', gender: 'male', relation: 'child' });
    setIsModalOpen(true);
  };

  const handleOpenEdit = () => {
    if (!selectedNode) return;
    setModalMode('edit');
    setFormData({ 
        firstName: selectedNode.firstName, 
        lastName: selectedNode.lastName, 
        gender: selectedNode.gender, 
        relation: 'child' 
    });
    setIsModalOpen(true);
  };

  const handleDelete = async () => {
    if (!selectedNode) return;
    if (window.confirm(`Are you sure you want to permanently delete ${selectedNode.name}?`)) {
        const result = await deleteMember(selectedNode.id);
        if (result.success) {
            setSelectedNode(null); 
            await fetchGraphData(); 
        } else {
            alert("Error deleting member: " + result.error);
        }
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedNode) return;
    setIsSubmitting(true);

    let result;
    if (modalMode === 'add') {
        result = await addRelative(selectedNode.id, formData);
    } else {
        result = await updateMember(selectedNode.id, formData);
    }

    if (result.success) {
      await fetchGraphData();
      setIsModalOpen(false);
      if (modalMode === 'edit') {
         setSelectedNode({
             ...selectedNode,
             name: `${formData.firstName} ${formData.lastName}`,
             firstName: formData.firstName,
             lastName: formData.lastName,
             gender: formData.gender
         });
      }
    } else { alert("Error: " + result.error); }
    setIsSubmitting(false);
  };

  // --- VISUAL RENDERER ---
  const nodeThreeObject = useCallback((node: any) => {
    const group = new THREE.Group();
    
    // Label
    const label = new SpriteText(node.name);
    label.color = 'white';
    label.textHeight = 3; 
    label.position.set(0, -9, 0); 

    // Bloodline Check
    const isClanMember = clanSet.has(node.id);
    
    // Geometry
    if (node.img) {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const size = 256; canvas.width = size; canvas.height = size;
      if (ctx) {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = node.img;
        img.onload = () => {
          ctx.beginPath();
          ctx.arc(size/2, size/2, size/2, 0, Math.PI*2);
          ctx.closePath();
          ctx.clip();
          ctx.drawImage(img, 0, 0, size, size);
          
          ctx.lineWidth = 15;
          ctx.strokeStyle = isClanMember ? '#FFD700' : '#6366f1';
          ctx.stroke();

          const texture = new THREE.CanvasTexture(canvas);
          texture.colorSpace = THREE.SRGBColorSpace;
          const material = new THREE.SpriteMaterial({ map: texture });
          const sprite = new THREE.Sprite(material);
          sprite.scale.set(12, 12, 1); 
          group.add(sprite);
        };
      }
    } else {
      const geometry = new THREE.SphereGeometry(4, 32, 32);
      let material;

      if (isClanMember) {
        material = new THREE.MeshPhysicalMaterial({ 
          color: 0xFFD700, roughness: 0.2, metalness: 1.0, emissive: 0xaa6c39, emissiveIntensity: 0.2, clearcoat: 1.0
        });
      } else {
        material = new THREE.MeshPhysicalMaterial({ 
          color: 0x6366f1, roughness: 0, metalness: 0.1, transmission: 0.6, thickness: 1.5, emissive: 0x6366f1, emissiveIntensity: 0.2
        });
      }

      const sphere = new THREE.Mesh(geometry, material);
      group.add(sphere);
    }
    
    // Gender Ring
    if (node.gender === 'female') {
        const ringGeo = new THREE.TorusGeometry(5, 0.1, 8, 50); 
        const ringMat = new THREE.MeshBasicMaterial({ color: 0xffffff, opacity: 0.6, transparent: true });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.rotation.x = Math.PI / 2; 
        group.add(ring);
    }

    group.add(label);
    return group;
  }, [clanSet]); 

  if (!graphData) return <div className="text-white p-10">Loading Neural Link...</div>;

  return (
    <div className="relative w-full h-screen bg-black overflow-hidden">
      
      {/* --- RESPONSIVE HEADER --- */}
      <header className="fixed top-0 left-0 w-full z-50 flex flex-col md:flex-row items-center justify-between px-4 py-4 md:px-8 md:py-6 pointer-events-none gap-4">
        
        {/* Title */}
        <div className="pointer-events-auto text-center md:text-left">
          <h1 className="text-white font-bold tracking-widest text-lg drop-shadow-md">PROJECT BILAVINAKATH</h1>
          <p className="text-zinc-500 text-[10px] uppercase tracking-[0.3em]">Bloodline Visualization v3.0</p>
        </div>

        {/* Search Bar */}
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
                  <span className="text-zinc-200 text-sm font-medium">{node.name}</span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Disconnect Button */}
        <div className="pointer-events-auto absolute top-4 right-4 md:static">
          <button onClick={handleLogout} className="px-6 py-2 bg-black/40 backdrop-blur-md border border-red-500/30 rounded-full text-[10px] tracking-[0.2em] font-bold text-red-500 hover:text-red-400 hover:bg-red-500/10 transition-all duration-300 shadow-lg">DISCONNECT</button>
        </div>
      </header>

      {/* GRAPH */}
      <ForceGraph3D
        ref={graphRef}
        graphData={graphData}
        onNodeClick={handleNodeClick}
        onBackgroundClick={handleBackgroundClick}
        nodeThreeObjectExtend={false} 
        nodeThreeObject={nodeThreeObject} 
        nodeLabel="name"
        linkColor={() => 'rgba(255,255,255,0.1)'} 
        linkWidth={0.5}
        linkDirectionalParticles={2} 
        linkDirectionalParticleWidth={1.5}
        linkDirectionalParticleSpeed={0.005} 
        backgroundColor="#000000"
        controlType="orbit"
        onEngineStop={() => {
            if (graphRef.current) {
                const scene = graphRef.current.scene();
                scene.add(new THREE.AmbientLight(0xffffff, 0.6));
                const dirLight = new THREE.DirectionalLight(0xffffff, 1);
                dirLight.position.set(100, 100, 100);
                scene.add(dirLight);
                const rimLight = new THREE.PointLight(0x00ffff, 0.5);
                rimLight.position.set(-100, -100, -100);
                scene.add(rimLight);
            }
        }}
      />

      {/* --- RESPONSIVE LEGEND --- */}
      <div className="absolute bottom-4 right-4 md:bottom-10 md:right-10 scale-75 origin-bottom-right md:scale-100 p-4 bg-black/40 backdrop-blur-md border border-white/10 rounded-lg pointer-events-none select-none z-0">
        <h4 className="text-[10px] text-zinc-500 uppercase tracking-widest mb-3 border-b border-white/10 pb-2">Index</h4>
        <div className="flex items-center gap-3 mb-2">
            <div className="w-3 h-3 rounded-full bg-yellow-500 shadow-[0_0_10px_#FFD700]"></div>
            <span className="text-xs text-white font-mono">Bilavinakath Bloodline</span>
        </div>
        <div className="flex items-center gap-3">
            <div className="w-3 h-3 rounded-full bg-indigo-500 shadow-[0_0_10px_#6366f1]"></div>
            <span className="text-xs text-zinc-400 font-mono">Allied Families</span>
        </div>
      </div>

      {/* --- RESPONSIVE HUD & MODAL --- */}
      {selectedNode && (
        <div className="fixed bottom-4 left-4 right-4 md:absolute md:left-10 md:bottom-10 md:right-auto md:w-auto z-40 p-6 bg-zinc-900/90 border border-zinc-700 rounded-xl backdrop-blur-md max-w-md shadow-2xl select-none">
          <div className="flex items-center gap-4 mb-4">
             {selectedNode.img ? (
              <img src={selectedNode.img} alt="avatar" className="w-12 h-12 rounded-full object-cover border-2 border-white/20" />
            ) : (
              <div className={`w-12 h-12 rounded-full flex items-center justify-center ${clanSet.has(selectedNode.id) ? 'bg-yellow-600' : 'bg-indigo-600'}`}>
                 <span className="text-xl font-bold text-white">{selectedNode.name[0]}</span>
              </div>
            )}
            <div className="flex-1">
              <div className="flex items-center gap-2">
                  <h2 className="text-xl font-bold text-white tracking-tight truncate">{selectedNode.name}</h2>
                  {/* ADMIN ACTIONS */}
                  <button onClick={handleOpenEdit} className="text-zinc-500 hover:text-white transition" title="Edit Profile">✏️</button>
                  <button onClick={handleDelete} className="text-zinc-500 hover:text-red-500 transition" title="Delete Member">🗑️</button>
              </div>
              <p className="text-zinc-400 text-xs">ID: {selectedNode.id.slice(0,8)}</p>
            </div>
          </div>
          <div className="border-t border-zinc-700 pt-3 mb-3">
            <p className="text-[10px] uppercase tracking-widest text-zinc-500 mb-1">RELATIONSHIP PROTOCOL</p>
            <p className="text-md text-emerald-400 font-mono leading-tight">{relationshipText}</p>
          </div>
          <button onClick={handleOpenAdd} className="w-full py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold tracking-widest rounded border border-indigo-400 shadow-[0_0_15px_rgba(79,70,229,0.4)] transition-all">+ ADD RELATIVE</button>
        </div>
      )}

      {/* SHARED MODAL */}
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