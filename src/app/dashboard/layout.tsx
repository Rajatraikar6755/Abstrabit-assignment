'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter, usePathname } from 'next/navigation';
import { useEffect } from 'react';
import { Zap, LayoutDashboard, ScrollText, Settings, LogOut } from 'lucide-react';
import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) {
      router.push('/login');
    }
  }, [user, loading, router]);

  const handleSignOut = async () => {
    await logout();
    router.push('/login');
  };

  if (loading || !user) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%' }} />
      </div>
    );
  }

  const navItems = [
    { href: '/dashboard', label: 'Dashboard', icon: <LayoutDashboard size={18} /> },
    { href: '/dashboard/logs', label: 'Command Logs', icon: <ScrollText size={18} /> },
    { href: '/dashboard/settings', label: 'Settings', icon: <Settings size={18} /> },
  ];

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{
        width: 260,
        background: 'var(--bg-secondary)',
        borderRight: '1px solid var(--border-color)',
        display: 'flex',
        flexDirection: 'column',
        padding: '20px 12px',
        position: 'fixed',
        top: 0,
        left: 0,
        bottom: 0,
        zIndex: 50,
      }}>
        {/* Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 16px', marginBottom: 32 }}>
          <div style={{ width: 32, height: 32, background: 'var(--accent-gradient)', borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
            <Zap size={18} color="white" />
          </div>
          <span style={{ fontSize: 17, fontWeight: 700 }} className="gradient-text">CommandPulse</span>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {navItems.map(item => (
            <Link
              key={item.href}
              href={item.href}
              className={`sidebar-link ${pathname === item.href ? 'active' : ''}`}
            >
              {item.icon}
              {item.label}
            </Link>
          ))}
        </nav>

        {/* User / Sign out */}
        <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 16, marginTop: 8 }}>
          <div style={{ padding: '0 16px', marginBottom: 12 }}>
            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>Signed in as</div>
            <div style={{ fontSize: 14, fontWeight: 500, color: 'var(--text-primary)' }}>{user.email}</div>
          </div>
          <button
            onClick={handleSignOut}
            className="sidebar-link"
            style={{ width: '100%', border: 'none', background: 'none', cursor: 'pointer', color: 'var(--danger)', display: 'flex', alignItems: 'center', gap: 8 }}
          >
            <LogOut size={18} />
            Sign Out
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main style={{ flex: 1, marginLeft: 260, padding: '28px 32px', minHeight: '100vh' }}>
        {children}
      </main>
    </div>
  );
}
