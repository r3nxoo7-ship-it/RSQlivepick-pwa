'use client';

// ============================================
// R$Q - DASHBOARD LAYOUT (COMPLETE & FIXED)
// ============================================
// Main layout with navigation for all dashboard pages

import { useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import {
  Home,
  Activity,
  Filter,
  Bell,
  Send,
  BarChart3,
  Menu,
  X,
  LogOut,
  Settings,
} from 'lucide-react';
import { authHelpers } from '@/lib/supabase';

// ============================================
// NAVIGATION CONFIG
// ============================================

const navigation = [
  {
    name: 'Home',
    href: '/dashboard',
    icon: Home,
  },
  {
    name: 'Live',
    href: '/dashboard/live',
    icon: Activity,
  },
  {
    name: 'Matches',
    href: '/dashboard/matches',
    icon: BarChart3,
  },
  {
    name: 'Filters',
    href: '/dashboard/filters',
    icon: Filter,
  },
  {
    name: 'Notifications',
    href: '/dashboard/notifications',
    icon: Bell,
  },
  {
    name: 'Library',
    href: '/dashboard/library',
    icon: Send,
  },
];

// ============================================
// LAYOUT COMPONENT
// ============================================

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  
  const handleLogout = () => {
    authHelpers.logout();
    router.push('/login');
  };
  
  return (
    <div className="min-h-screen bg-dark">
      {/* ========== SIDEBAR (Desktop) ========== */}
      <aside className="hidden lg:fixed lg:inset-y-0 lg:flex lg:w-72 lg:flex-col">
        <div className="flex grow flex-col gap-y-5 overflow-y-auto glass-card border-r border-glass-medium px-6 pb-4">
          {/* Logo */}
          <div className="flex h-16 shrink-0 items-center">
            <div className="flex items-center gap-3 w-full">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-accent-cyan to-accent-magenta flex items-center justify-center flex-shrink-0">
                <Activity className="w-6 h-6 text-dark" />
              </div>
              <h1 className="text-2xl font-display font-bold gradient-text">R$Q</h1>
            </div>
          </div>
          
          {/* Navigation */}
          <nav className="flex flex-1 flex-col">
            <ul role="list" className="flex flex-1 flex-col gap-y-7">
              <li>
                <ul role="list" className="-mx-2 space-y-1">
                  {navigation.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    
                    return (
                      <li key={item.name}>
                        <Link
                          href={item.href}
                          className={`
                            group flex gap-x-3 rounded-md p-3 text-sm leading-6 font-semibold transition-all
                            ${isActive
                              ? 'bg-glass-medium text-accent-cyan'
                              : 'text-text-secondary hover:text-text-primary hover:bg-glass-light'
                            }
                          `}
                        >
                          <Icon className="h-5 w-5 shrink-0" />
                          {item.name}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </li>
              
              {/* Bottom Actions */}
              <li className="mt-auto">
                <Link
                  href="/dashboard/settings"
                  className="group flex gap-x-3 rounded-md p-3 text-sm leading-6 font-semibold text-text-secondary hover:text-text-primary hover:bg-glass-light transition-all"
                >
                  <Settings className="h-5 w-5 shrink-0" />
                  Settings
                </Link>
                
                <button
                  onClick={handleLogout}
                  className="w-full group flex gap-x-3 rounded-md p-3 text-sm leading-6 font-semibold text-accent-red hover:bg-accent-red/10 transition-all"
                >
                  <LogOut className="h-5 w-5 shrink-0" />
                  Logout
                </button>
              </li>
            </ul>
          </nav>
        </div>
      </aside>
      
      {/* ========== MOBILE HEADER ========== */}
      <div className="sticky top-0 z-40 flex items-center gap-x-4 glass-card border-b border-glass-medium px-4 py-4 shadow-lg lg:hidden backdrop-blur-xl">
        <button
          type="button"
          className="-m-2.5 p-2.5 text-text-secondary lg:hidden hover:text-accent-cyan transition-colors"
          onClick={() => setMobileMenuOpen(true)}
        >
          <span className="sr-only">Open sidebar</span>
          <Menu className="h-6 w-6" />
        </button>
        
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-cyan to-accent-magenta flex items-center justify-center">
              <Activity className="w-5 h-5 text-dark" />
            </div>
            <h1 className="text-lg font-display font-bold gradient-text">R$Q</h1>
          </div>
        </div>
      </div>
      
      {/* ========== MOBILE MENU ========== */}
      {mobileMenuOpen && (
        <div className="lg:hidden">
          <div className="fixed inset-0 z-50" />
          <div className="fixed inset-y-0 right-0 z-50 w-full overflow-y-auto glass-card px-6 py-6 sm:max-w-sm sm:ring-1 sm:ring-glass-medium">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-accent-cyan to-accent-magenta flex items-center justify-center">
                  <Activity className="w-5 h-5 text-dark" />
                </div>
                <h1 className="text-xl font-display font-bold gradient-text">R$Q</h1>
              </div>
              <button
                type="button"
                className="-m-2.5 rounded-md p-2.5 text-text-secondary hover:text-accent-cyan transition-colors"
                onClick={() => setMobileMenuOpen(false)}
              >
                <span className="sr-only">Close menu</span>
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <div className="mt-6 flow-root">
              <div className="-my-6 divide-y divide-glass-medium">
                <div className="space-y-2 py-6">
                  {navigation.map((item) => {
                    const Icon = item.icon;
                    const isActive = pathname === item.href || pathname.startsWith(item.href + '/');
                    
                    return (
                      <Link
                        key={item.name}
                        href={item.href}
                        onClick={() => setMobileMenuOpen(false)}
                        className={`
                          -mx-3 flex gap-x-3 rounded-lg px-3 py-2 text-base font-semibold leading-7 transition-all
                          ${isActive
                            ? 'bg-glass-medium text-accent-cyan'
                            : 'text-text-secondary hover:bg-glass-light'
                          }
                        `}
                      >
                        <Icon className="h-6 w-6 shrink-0" />
                        {item.name}
                      </Link>
                    );
                  })}
                </div>
                
                <div className="py-6">
                  <Link
                    href="/dashboard/settings"
                    onClick={() => setMobileMenuOpen(false)}
                    className="-mx-3 flex gap-x-3 rounded-lg px-3 py-2.5 text-base font-semibold leading-7 text-text-secondary hover:bg-glass-light"
                  >
                    <Settings className="h-6 w-6 shrink-0" />
                    Settings
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
      

      {/* ========== MAIN CONTENT ========== */}
      <main className="lg:pl-72">
        <div className="min-h-screen">
          {children}
        </div>
      </main>

      {/* ========== MOBILE BOTTOM NAV ========== */}
      {/* Only show on mobile (md:hidden) */}
      <div className="md:hidden">
        {/* Dynamically import to avoid SSR issues */}
        {typeof window !== 'undefined' && (
          require('@/components/BottomNavBar').default()
        )}
      </div>
    </div>
  );
}
