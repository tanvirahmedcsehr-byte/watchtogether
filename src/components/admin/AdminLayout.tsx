import React, { useEffect } from 'react';
import {
  LayoutDashboard,
  Film,
  Radio,
  Settings,
  Subtitles,
  LogOut,
  Shield,
  ExternalLink,
} from 'lucide-react';
import { useRouter } from '../../lib/router';
import { useAuth } from '../../lib/auth/AuthContext';

interface AdminLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
  actionButton?: React.ReactNode;
}

export const AdminLayout: React.FC<AdminLayoutProps> = ({
  children,
  title,
  subtitle,
  actionButton,
}) => {
  const { user, isAdmin, loading, authReady, logout } = useAuth();
  const { route, navigate } = useRouter();

  useEffect(() => {
    if (authReady && (!user || !isAdmin)) {
      navigate('/admin/login');
    }
  }, [user, isAdmin, authReady, navigate]);

  if (!authReady || loading) {
    return (
      <div className="min-h-[85vh] flex items-center justify-center">
        <div className="w-10 h-10 rounded-full border-3 border-rose-500/30 border-t-rose-500 animate-spin" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  const navItems = [
    { name: 'Dashboard', path: '/admin', icon: LayoutDashboard, exact: true },
    { name: 'Live Control', path: '/admin/live', icon: Radio, exact: true },
    { name: 'Movie Library', path: '/admin/movies', icon: Film, exact: false },
    { name: 'Subtitles', path: '/admin/subtitles', icon: Subtitles, exact: true },
    { name: 'Settings', path: '/admin/settings', icon: Settings, exact: true },
  ];

  const isCurrent = (path: string, exact: boolean) => {
    if (exact) return route.path === path;
    return route.path.startsWith(path);
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-16">
      {/* Top Admin Sub-bar */}
      <div className="border-b border-neutral-800/80 bg-neutral-900/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3 gap-3">
            {/* Nav Tabs */}
            <nav className="flex items-center gap-1 sm:gap-2 overflow-x-auto pb-1 sm:pb-0">
              {navItems.map((item) => {
                const active = isCurrent(item.path, item.exact);
                const Icon = item.icon;
                return (
                  <button
                    key={item.path}
                    onClick={() => navigate(item.path)}
                    className={`flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs sm:text-sm font-medium transition-all cursor-pointer whitespace-nowrap ${
                      active
                        ? 'bg-rose-600/20 text-rose-400 border border-rose-500/30 font-semibold'
                        : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60 border border-transparent'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{item.name}</span>
                  </button>
                );
              })}
            </nav>

            {/* Admin identity badge */}
            <div className="flex items-center justify-between sm:justify-end gap-3 text-xs text-neutral-400">
              <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-neutral-800/60 border border-neutral-700/60">
                <Shield className="w-3.5 h-3.5 text-rose-400" />
                <span className="truncate max-w-[160px] font-medium">{user.displayName || user.username || 'Tanvir'}</span>
              </div>
              <button
                onClick={() => logout()}
                className="hover:text-rose-400 transition-colors p-1 cursor-pointer"
                title="Log Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 sm:pt-8">
        {/* Page Title & Action */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">{title}</h1>
            {subtitle && <p className="text-xs sm:text-sm text-neutral-400 mt-1">{subtitle}</p>}
          </div>
          {actionButton && <div>{actionButton}</div>}
        </div>

        {/* Page Content */}
        {children}
      </div>
    </div>
  );
};
