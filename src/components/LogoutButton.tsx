'use client';

import { createClient } from '@supabase/supabase-js';
import { useRouter } from 'next/navigation';

// Initialize Client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function LogoutButton({ onLogout }: { onLogout: () => void }) {
  const router = useRouter();

  const handleLogout = async () => {
    // 1. Kill the session in Supabase
    await supabase.auth.signOut();
    
    // 2. Trigger the UI update in the parent
    onLogout();
    
    // 3. Force a router refresh (clean up cookies/cache)
    router.refresh();
  };

  return (
    <button
      onClick={handleLogout}
      className="absolute top-6 right-6 z-50 px-6 py-2 
                 bg-black/40 backdrop-blur-md border border-white/10 rounded-full
                 text-xs tracking-[0.2em] font-bold text-red-500 hover:text-red-400 hover:bg-black/60
                 transition-all duration-300 ease-out shadow-lg group"
    >
      <span className="relative z-10">DISCONNECT</span>
      {/* Glitch Effect / Hover Glow */}
      <div className="absolute inset-0 rounded-full bg-red-500/10 opacity-0 group-hover:opacity-100 transition-opacity blur-lg" />
    </button>
  );
}