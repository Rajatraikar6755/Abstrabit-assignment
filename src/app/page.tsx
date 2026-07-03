'use client';

import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { motion } from 'framer-motion';
import { Zap, Shield, Bot, BarChart3, ArrowRight } from 'lucide-react';

export default function HomePage() {
  const { user, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (user) router.push('/dashboard');
  }, [user, router]);

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh' }}>
        <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%' }} />
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', overflow: 'hidden' }}>
      {/* Background decoration */}
      <div style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-20%', left: '-10%', width: '40%', height: '40%', background: 'radial-gradient(circle, rgba(6,182,212,0.08) 0%, transparent 70%)', borderRadius: '50%' }} />
        <div style={{ position: 'absolute', bottom: '-20%', right: '-10%', width: '50%', height: '50%', background: 'radial-gradient(circle, rgba(59,130,246,0.06) 0%, transparent 70%)', borderRadius: '50%' }} />
      </div>

      {/* Header */}
      <header style={{ position: 'relative', zIndex: 10, padding: '20px 40px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 36, height: 36, background: 'var(--accent-gradient)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Zap size={20} color="white" />
          </div>
          <span style={{ fontSize: 20, fontWeight: 700 }} className="gradient-text">CommandPulse</span>
        </div>
        <button className="btn-primary" onClick={() => router.push('/login')} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          Admin Login <ArrowRight size={16} />
        </button>
      </header>

      {/* Hero */}
      <main style={{ position: 'relative', zIndex: 10, maxWidth: 1100, margin: '0 auto', padding: '80px 40px', textAlign: 'center' }}>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <div className="badge badge-info" style={{ marginBottom: 20, padding: '6px 16px', fontSize: 13 }}>
            🤖 AI-Powered Discord Bot
          </div>
          <h1 style={{ fontSize: 56, fontWeight: 800, lineHeight: 1.1, marginBottom: 20, letterSpacing: '-0.03em' }}>
            <span className="gradient-text">Slash Commands</span>
            <br />
            <span style={{ color: 'var(--text-primary)' }}>That Actually Work</span>
          </h1>
          <p style={{ fontSize: 18, color: 'var(--text-secondary)', maxWidth: 600, margin: '0 auto 40px', lineHeight: 1.7 }}>
            AI-powered triage, real-time monitoring, configurable rules, and cross-platform notifications — all from Discord slash commands.
          </p>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
            <button className="btn-primary" onClick={() => router.push('/login')} style={{ padding: '14px 32px', fontSize: 16 }}>
              Open Dashboard
            </button>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="btn-secondary" style={{ padding: '14px 32px', fontSize: 16 }}>
              View Source
            </a>
          </div>
        </motion.div>

        {/* Feature cards */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3 }}
          style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 20, marginTop: 80 }}
        >
          {[
            { icon: <Bot size={24} />, title: 'Slash Commands', desc: '/report and /status with modal forms and interactive buttons' },
            { icon: <Shield size={24} />, title: 'Ed25519 Security', desc: 'Every request verified with signature + timestamp freshness checks' },
            { icon: <Zap size={24} />, title: 'AI Triage', desc: 'Gemini-powered report analysis with tags, priority, and suggested actions' },
            { icon: <BarChart3 size={24} />, title: 'Live Dashboard', desc: 'Real-time command logs, stats, and configurable rule engine' },
          ].map((f, i) => (
            <motion.div
              key={f.title}
              className="glass-card"
              style={{ padding: 28, textAlign: 'left' }}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.4 + i * 0.1 }}
            >
              <div style={{ width: 44, height: 44, background: 'rgba(88,101,242,0.1)', borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--accent-primary)', marginBottom: 16 }}>
                {f.icon}
              </div>
              <h3 style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>{f.title}</h3>
              <p style={{ fontSize: 14, color: 'var(--text-secondary)', lineHeight: 1.6 }}>{f.desc}</p>
            </motion.div>
          ))}
        </motion.div>
      </main>
    </div>
  );
}
