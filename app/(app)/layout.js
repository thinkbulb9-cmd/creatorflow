'use client';

import { useSession, signOut } from 'next-auth/react';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  LayoutDashboard,
  FolderOpen,
  Zap,
  Settings,
  LogOut,
  Plus,
  Loader2,
  Menu,
  X
} from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/projects', label: 'Projects', icon: FolderOpen },
  { href: '/integrations', label: 'Integrations', icon: Zap },
  { href: '/settings', label: 'Settings', icon: Settings }
];

export default function AppLayout({ children }) {
  const { data: session, status } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(true);

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/auth');
    }
  }, [status, router]);

  if (status === 'loading' || !session) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950">
        <Loader2 className="h-8 w-8 animate-spin text-violet-500" />
      </div>
    );
  }

  const isActive = (href) => {
    return pathname === href || pathname.startsWith(href + '/');
  };

  return (
    <div className="flex h-screen bg-slate-950 overflow-hidden">
      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-0'
        } flex-shrink-0 border-r border-slate-800 flex flex-col bg-slate-900/50 transition-all duration-300 overflow-hidden`}
      >
        {/* Logo */}
        <div className="p-6 border-b border-slate-800 flex-shrink-0">
          <Link href="/dashboard" className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center flex-shrink-0">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <div className="text-sm font-semibold text-white">CreatorFlow</div>
              <div className="text-xs text-slate-500">AI Studio</div>
            </div>
          </Link>
        </div>

        {/* New Project Button */}
        <div className="p-4 border-b border-slate-800 flex-shrink-0">
          <Link
            href="/projects/new"
            className="flex items-center justify-center gap-2 w-full py-2 px-4 rounded-lg bg-gradient-to-r from-violet-600 to-indigo-600 hover:from-violet-700 hover:to-indigo-700 text-white text-sm font-medium transition-all"
          >
            <Plus className="h-4 w-4" />
            New Project
          </Link>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
            const active = isActive(href);
            return (
              <Link
                key={href}
                href={href}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  active
                    ? 'bg-violet-600/20 text-violet-400 border border-violet-600/30'
                    : 'text-slate-400 hover:text-white hover:bg-slate-800/50'
                }`}
              >
                <Icon className="h-4 w-4 flex-shrink-0" />
                {label}
              </Link>
            );
          })}
        </nav>

        {/* User Footer */}
        <div className="p-4 border-t border-slate-800 flex-shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-8 w-8 rounded-full bg-gradient-to-br from-violet-600 to-indigo-600 flex items-center justify-center text-xs font-semibold text-white flex-shrink-0">
              {session.user?.name?.[0]?.toUpperCase() ||
                session.user?.email?.[0]?.toUpperCase() ||
                'U'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-xs font-medium text-white truncate">
                {session.user?.name || 'User'}
              </div>
              <div className="text-xs text-slate-500 truncate">
                {session.user?.email}
              </div>
            </div>
          </div>
          <button
            onClick={() => signOut({ callbackUrl: '/auth' })}
            className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm text-slate-400 hover:text-red-400 hover:bg-red-950/20 transition-colors"
          >
            <LogOut className="h-4 w-4" />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile Header */}
        <div className="md:hidden border-b border-slate-800 bg-slate-900/50 px-4 py-3 flex items-center justify-between">
          <button
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="p-2 rounded-lg hover:bg-slate-800 transition-colors"
          >
            {sidebarOpen ? (
              <X className="h-5 w-5 text-slate-400" />
            ) : (
              <Menu className="h-5 w-5 text-slate-400" />
            )}
          </button>
          <div className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-violet-500" />
            <span className="font-semibold text-white">CreatorFlow</span>
          </div>
          <div className="w-10" />
        </div>

        {/* Main Scroll Area */}
        <main className="flex-1 overflow-auto">{children}</main>
      </div>
    </div>
  );
}
