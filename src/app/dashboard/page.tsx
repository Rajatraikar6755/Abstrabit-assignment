'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Activity, CheckCircle2, XCircle, Clock, TrendingUp, BarChart3 } from 'lucide-react';

interface Stats {
  totalAll: number;
  totalToday: number;
  successToday: number;
  failedToday: number;
  processingToday: number;
  successRate: number;
  commandBreakdown: { command: string; count: number }[];
  recentFailures: {
    _id: string;
    command: string;
    username: string;
    createdAt: string;
    attempts: { attemptNumber: number; status: string; error?: string; timestamp: string }[];
  }[];
  hourlyData: { hour: number; total: number; success: number; failed: number }[];
}

async function fetchStats(): Promise<Stats> {
  const res = await fetch('/api/stats');
  if (!res.ok) throw new Error('Failed to fetch stats');
  return res.json();
}

export default function DashboardPage() {
  const { data: stats, isLoading, error } = useQuery({
    queryKey: ['stats'],
    queryFn: fetchStats,
    refetchInterval: 10000,
  });

  if (isLoading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '60vh' }}>
        <div className="animate-spin" style={{ width: 32, height: 32, border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%' }} />
      </div>
    );
  }

  if (error || !stats) {
    return (
      <div className="glass-card" style={{ padding: 32, textAlign: 'center' }}>
        <XCircle size={32} color="var(--danger)" style={{ margin: '0 auto 12px' }} />
        <p style={{ color: 'var(--text-secondary)' }}>Failed to load dashboard data</p>
      </div>
    );
  }

  const statCards = [
    { label: 'Total Today', value: stats.totalToday, icon: <Activity size={20} />, color: 'var(--accent-primary)' },
    { label: 'Successful', value: stats.successToday, icon: <CheckCircle2 size={20} />, color: 'var(--success)' },
    { label: 'Failed', value: stats.failedToday, icon: <XCircle size={20} />, color: 'var(--danger)' },
    { label: 'Processing', value: stats.processingToday, icon: <Clock size={20} />, color: 'var(--warning)' },
  ];

  const maxHourly = Math.max(...(stats.hourlyData.map(h => h.total) || [1]), 1);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4 }}>Dashboard</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          Real-time overview of command activity
        </p>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            className="glass-card"
            style={{ padding: 20 }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 500 }}>{card.label}</span>
              <div style={{ color: card.color }}>{card.icon}</div>
            </div>
            <div style={{ fontSize: 32, fontWeight: 700 }}>{card.value}</div>
          </motion.div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Success Rate */}
        <motion.div className="glass-card" style={{ padding: 24 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <TrendingUp size={18} color="var(--accent-primary)" />
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Today&apos;s Activity</h3>
          </div>
          {/* Simple bar chart */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: 120 }}>
            {Array.from({ length: 24 }, (_, hour) => {
              const data = stats.hourlyData.find(h => h.hour === hour);
              const height = data ? (data.total / maxHourly) * 100 : 0;
              const failed = data?.failed || 0;
              return (
                <div key={hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 100 }}>
                    {failed > 0 && (
                      <div style={{ width: '100%', height: `${(failed / maxHourly) * 100}%`, background: 'var(--danger)', borderRadius: '2px 2px 0 0', minHeight: failed > 0 ? 2 : 0 }} />
                    )}
                    <div style={{ width: '100%', height: `${height}%`, background: 'var(--accent-primary)', borderRadius: failed > 0 ? '0' : '2px 2px 0 0', minHeight: height > 0 ? 2 : 0, opacity: 0.8 }} />
                  </div>
                  {hour % 6 === 0 && (
                    <span style={{ fontSize: 10, color: 'var(--text-muted)' }}>{hour}h</span>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--accent-primary)', borderRadius: 2, marginRight: 4 }} />Success</span>
            <span><span style={{ display: 'inline-block', width: 8, height: 8, background: 'var(--danger)', borderRadius: 2, marginRight: 4 }} />Failed</span>
          </div>
        </motion.div>

        {/* Command Breakdown */}
        <motion.div className="glass-card" style={{ padding: 24 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
            <BarChart3 size={18} color="var(--accent-primary)" />
            <h3 style={{ fontSize: 15, fontWeight: 600 }}>Top Commands</h3>
          </div>
          {stats.commandBreakdown.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14 }}>No commands yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {stats.commandBreakdown.map(cmd => {
                const maxCount = stats.commandBreakdown[0]?.count || 1;
                return (
                  <div key={cmd.command}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 4 }}>
                      <span style={{ fontWeight: 500 }}>/{cmd.command}</span>
                      <span style={{ color: 'var(--text-muted)' }}>{cmd.count}</span>
                    </div>
                    <div style={{ width: '100%', height: 6, background: 'var(--bg-secondary)', borderRadius: 3 }}>
                      <div style={{ width: `${(cmd.count / maxCount) * 100}%`, height: '100%', background: 'var(--accent-gradient)', borderRadius: 3 }} />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>
      </div>

      {/* Success Rate + All Time */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 24 }}>
        <div className="glass-card" style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 48, fontWeight: 700, color: stats.successRate >= 0.9 ? 'var(--success)' : stats.successRate >= 0.7 ? 'var(--warning)' : 'var(--danger)' }}>
            {(stats.successRate * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>Success Rate Today</div>
        </div>
        <div className="glass-card" style={{ padding: 24, textAlign: 'center' }}>
          <div style={{ fontSize: 48, fontWeight: 700, color: 'var(--accent-primary)' }}>
            {stats.totalAll}
          </div>
          <div style={{ fontSize: 14, color: 'var(--text-secondary)', marginTop: 4 }}>All-Time Commands</div>
        </div>
      </div>

      {/* Recent Failures */}
      {stats.recentFailures.length > 0 && (
        <motion.div className="glass-card" style={{ padding: 24 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
          <h3 style={{ fontSize: 15, fontWeight: 600, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
            <XCircle size={18} color="var(--danger)" /> Recent Failures
          </h3>
          <table className="data-table">
            <thead>
              <tr>
                <th>Command</th>
                <th>User</th>
                <th>Time</th>
                <th>Attempts</th>
                <th>Last Error</th>
              </tr>
            </thead>
            <tbody>
              {stats.recentFailures.map(f => {
                const lastAttempt = f.attempts?.[f.attempts.length - 1];
                return (
                  <tr key={f._id}>
                    <td><code style={{ color: 'var(--accent-primary)' }}>/{f.command}</code></td>
                    <td style={{ color: 'var(--text-secondary)' }}>{f.username}</td>
                    <td style={{ color: 'var(--text-muted)', fontSize: 13 }}>{new Date(f.createdAt).toLocaleString()}</td>
                    <td><span className="badge badge-danger">{f.attempts?.length || 0}</span></td>
                    <td style={{ color: 'var(--danger)', fontSize: 13, maxWidth: 300, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {lastAttempt?.error || 'Unknown'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </motion.div>
      )}
    </div>
  );
}
