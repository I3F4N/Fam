'use client';
import { useState, useEffect } from 'react';
import { createClient } from '@supabase/supabase-js';
import FamilyGraph from '@/components/FamilyGraph';
import LogoutButton from '@/components/LogoutButton'; // <--- IMPORT THE BUTTON

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function Home() {
  const [session, setSession] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  useEffect(() => {
    // Check active session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // Listen for changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) alert(error.message);
  };

  if (loading) return <div className="bg-black h-screen text-white flex items-center justify-center">Loading Neural Link...</div>;

  // --- IF NOT LOGGED IN: SHOW YOUR CUSTOM LOGIN FORM ---
  if (!session) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-black text-white">
        <div className="w-full max-w-md p-8 space-y-6 bg-zinc-900 rounded-xl border border-zinc-800 shadow-2xl">
          <div className="text-center">
            <h1 className="text-3xl font-bold tracking-tighter">PROJECT BILAVINAKATH</h1>
            <p className="text-zinc-500 text-sm mt-2">Secure Lineage Access Protocol</p>
          </div>
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs uppercase text-zinc-500 mb-1">Identity</label>
              <input 
                type="email" 
                value={email} onChange={(e) => setEmail(e.target.value)}
                className="w-full bg-black border border-zinc-700 rounded p-3 text-white focus:border-indigo-500 outline-none transition"
                placeholder="member@family.com"
              />
            </div>
            <div>
              <label className="block text-xs uppercase text-zinc-500 mb-1">Passcode</label>
              <input 
                type="password" 
                value={password} onChange={(e) => setPassword(e.target.value)}
                className="w-full bg-black border border-zinc-700 rounded p-3 text-white focus:border-indigo-500 outline-none transition"
                placeholder="••••••••"
              />
            </div>
            <button type="submit" className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-3 rounded transition shadow-[0_0_20px_rgba(79,70,229,0.3)]">
              INITIATE SESSION
            </button>
          </form>
        </div>
      </div>
    );
  }

  // --- IF LOGGED IN: SHOW GRAPH + LOGOUT BUTTON ---
  return (
    <main className="relative flex min-h-screen w-full flex-col items-center justify-between bg-black">
      {/* 1. The Disconnect Button (Top Right) */}
      <LogoutButton onLogout={() => setSession(null)} />

      {/* 2. The 3D Engine */}
      <FamilyGraph />
    </main>
  );
}