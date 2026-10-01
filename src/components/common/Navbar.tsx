import React, { useEffect, useState } from 'react';
import { Tv, ShieldCheck, LogOut, Radio } from 'lucide-react';
import { useRouter } from '../../lib/router';
import { useAuth } from '../../lib/auth/AuthContext';
import { subscribeToLiveState } from '../../lib/services/liveState';
import { LiveState } from '../../types';

export const Navbar: React.FC = () => {
  const { route, navigate } = useRouter();
  const { user, isAdmin, logout } = useAuth();
  const [liveState, setLiveState] = useState<LiveState | null>(null);

  useEffect(() => {
    const unsub = subscribeToLiveState(setLiveState);
    return () => unsub();
  }, []);

  const isLive = liveState?.status === 'LIVE';

  return (
    <header className="sticky top-0 z-40 w-full border-b border-neutral-800/80 bg-neutral-950/85 backdrop-blur-md">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
        {/* Brand */}
        <div
          onClick={() => navigate(isAdmin ? '/admin' : '/')}
          className="flex items-center gap-2.5 cursor-pointer group select-none"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-rose-600 via-rose-500 to-amber-500 flex items-center justify-center text-white shadow-lg shadow-rose-600/25 group-hover:scale-105 transition-transform">
            <Tv className="w-5 h-5" />
          </div>
          <div>
            <span className="text-lg font-bold text-white tracking-tight group-hover:text-rose-300 transition-colors">
              Cine<span className="text-rose-500">Live</span>
            </span>
          </div>
        </div>

        {/* Center Live Indicator */}
        <div className="flex items-center gap-2">
          {isLive ? (
            <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-rose-600/20 border border-rose-500/40 text-rose-300 text-xs font-bold tracking-wide uppercase animate-pulse">
              <span className="w-2 h-2 rounded-full bg-rose-500" />
              <span>LIVE TV CHANNEL</span>
            </div>
          ) : (
            <div className="hidden sm:flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-900 border border-neutral-800 text-neutral-400 text-xs font-medium">
              <span className="w-2 h-2 rounded-full bg-neutral-600" />
              <span>CHANNEL OFFLINE</span>
            </div>
          )}
        </div>

        {/* Right Nav */}
        <div className="flex items-center gap-3">
          {isAdmin ? (
            <div className="flex items-center gap-2">
              <button
                onClick={() => navigate('/admin')}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors cursor-pointer ${
                  route.name.startsWith('admin')
                    ? 'bg-neutral-800 text-white'
                    : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                }`}
              >
                Dashboard
              </button>
              <button
                onClick={() => logout()}
                className="p-2 text-neutral-400 hover:text-rose-400 hover:bg-neutral-800/60 rounded-lg transition-colors cursor-pointer"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <button
              onClick={() => navigate('/admin/login')}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 border border-neutral-800 text-xs font-semibold text-neutral-300 hover:text-white transition-colors cursor-pointer"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-rose-500" />
              <span>Admin Login</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
