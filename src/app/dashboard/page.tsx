'use client';

import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { Activity, CheckCircle2, XCircle, Clock, TrendingUp, BarChart3, Users, Zap, ShieldAlert } from 'lucide-react';

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
  recentActivity: {
    _id: string;
    command: string;
    username: string;
    status: string;
    createdAt: string;
    priority?: string;
    tags?: string[];
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
    refetchInterval: 10000, // Short-poll every 10s
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
    { label: 'Total Today', value: stats.totalToday, icon: <Activity size={20} />, color: 'var(--accent-primary)', bg: 'linear-gradient(135deg, rgba(88,101,242,0.1) 0%, transparent 100%)' },
    { label: 'Successful', value: stats.successToday, icon: <CheckCircle2 size={20} />, color: 'var(--success)', bg: 'linear-gradient(135deg, rgba(67,181,129,0.1) 0%, transparent 100%)' },
    { label: 'Failed', value: stats.failedToday, icon: <XCircle size={20} />, color: 'var(--danger)', bg: 'linear-gradient(135deg, rgba(240,71,71,0.1) 0%, transparent 100%)' },
    { label: 'Processing', value: stats.processingToday, icon: <Clock size={20} />, color: 'var(--warning)', bg: 'linear-gradient(135deg, rgba(250,166,26,0.1) 0%, transparent 100%)' },
  ];

  const maxHourly = Math.max(...(stats.hourlyData.map(h => h.total) || [1]), 1);

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4, letterSpacing: '-0.02em' }}>Dashboard Overview</h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Real-time status metrics and Discord bot triage monitoring feed
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px', background: 'rgba(88,101,242,0.06)', border: '1px solid rgba(88,101,242,0.15)', borderRadius: 8 }}>
          <span className="status-dot status-dot-success" style={{ animation: 'pulse-glow 2s infinite' }} />
          <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--accent-primary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Live Connection Active</span>
        </div>
      </div>

      {/* Stat Cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16, marginBottom: 24 }}>
        {statCards.map((card, i) => (
          <motion.div
            key={card.label}
            className="glass-card"
            style={{ padding: 22, background: card.bg, borderLeft: `3px solid ${card.color}` }}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12 }}>
              <span style={{ fontSize: 13, color: 'var(--text-secondary)', fontWeight: 600, letterSpacing: '0.02em', textTransform: 'uppercase' }}>{card.label}</span>
              <div style={{ color: card.color }}>{card.icon}</div>
            </div>
            <div style={{ fontSize: 36, fontWeight: 800, letterSpacing: '-0.03em' }}>{card.value}</div>
          </motion.div>
        ))}
      </div>

      {/* Charts section */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 16, marginBottom: 24 }}>
        {/* Hourly Chart */}
        <motion.div className="glass-card" style={{ padding: 24 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <TrendingUp size={18} color="var(--accent-primary)" />
            <h3 style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>Today&apos;s Activity Curve</h3>
          </div>
          {/* Simple bar chart */}
          <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, height: 130 }}>
            {Array.from({ length: 24 }, (_, hour) => {
              const data = stats.hourlyData.find(h => h.hour === hour);
              const height = data ? (data.total / maxHourly) * 100 : 0;
              const failed = data?.failed || 0;
              return (
                <div key={hour} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
                  <div style={{ width: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', height: 110 }}>
                    {failed > 0 && (
                      <div style={{ width: '100%', height: `${(failed / maxHourly) * 100}%`, background: 'var(--danger)', borderRadius: '3px 3px 0 0', minHeight: failed > 0 ? 3 : 0 }} />
                    )}
                    <div style={{ width: '100%', height: `${height}%`, background: 'var(--accent-primary)', borderRadius: failed > 0 ? '0' : '3px 3px 0 0', minHeight: height > 0 ? 3 : 0, opacity: 0.8 }} />
                  </div>
                  {hour % 4 === 0 && (
                    <span style={{ fontSize: 9, color: 'var(--text-muted)', fontWeight: 600 }}>{hour}h</span>
                  )}
                </div>
              );
            })}
          </div>
          <div style={{ display: 'flex', gap: 16, marginTop: 14, fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--accent-primary)', borderRadius: 3 }} />Successful commands</span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}><span style={{ display: 'inline-block', width: 10, height: 10, background: 'var(--danger)', borderRadius: 3 }} />Failed commands</span>
          </div>
        </motion.div>

        {/* Command Breakdown */}
        <motion.div className="glass-card" style={{ padding: 24 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 20 }}>
            <BarChart3 size={18} color="var(--accent-primary)" />
            <h3 style={{ fontSize: 15, fontWeight: 700, letterSpacing: '-0.01em' }}>Distribution</h3>
          </div>
          {stats.commandBreakdown.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: 14, fontStyle: 'italic' }}>No commands logged yet</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {stats.commandBreakdown.map(cmd => {
                const maxCount = stats.commandBreakdown[0]?.count || 1;
                return (
                  <div key={cmd.command}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, marginBottom: 6 }}>
                      <span style={{ fontWeight: 600 }}>/{cmd.command}</span>
                      <span style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>{cmd.count}</span>
                    </div>
                    <div style={{ width: '100%', height: 8, background: 'var(--bg-secondary)', borderRadius: 4 }}>
                      <div style={{ width: `${(cmd.count / maxCount) * 100}%`, height: '100%', background: 'var(--accent-gradient)', borderRadius: 4 }} />
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
        <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: '-0.04em', color: stats.successRate >= 0.9 ? 'var(--success)' : stats.successRate >= 0.7 ? 'var(--warning)' : 'var(--danger)' }}>
            {(stats.successRate * 100).toFixed(1)}%
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 6 }}>Success Rate Today</div>
        </div>
        <div className="glass-card" style={{ padding: 24, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ fontSize: 52, fontWeight: 800, letterSpacing: '-0.04em', color: 'var(--text-primary)' }}>
            {stats.totalAll}
          </div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em', marginTop: 6 }}>All-Time Interactions</div>
        </div>
      </div>

      {/* Today's Activity Table */}
      <motion.div className="glass-card" style={{ padding: 24, marginBottom: 24 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Activity size={18} color="var(--accent-primary)" /> Today&apos;s Command Activity Feed
          </h3>
          <span style={{ fontSize: 12, color: 'var(--text-secondary)', fontWeight: 500 }}>Showing last 6 events</span>
        </div>
        {stats.recentActivity.length === 0 ? (
          <p style={{ color: 'var(--text-muted)', fontSize: 14, fontStyle: 'italic', padding: '20px 0', textAlign: 'center' }}>No command activities recorded today.</p>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Command</th>
                  <th>User</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Tags</th>
                  <th>Timestamp</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentActivity.map(act => {
                  let statusBadge = <span className="badge badge-info">processing</span>;
                  if (act.status === 'success') statusBadge = <span className="badge badge-success">success</span>;
                  if (act.status === 'failed') statusBadge = <span className="badge badge-danger">failed</span>;
                  if (act.status === 'deferred') statusBadge = <span className="badge badge-warning">deferred</span>;

                  let priorityBadge = <span className="badge badge-muted">—</span>;
                  if (act.priority === 'critical') priorityBadge = <span className="badge badge-danger">critical</span>;
                  else if (act.priority === 'high') priorityBadge = <span className="badge badge-warning">high</span>;
                  else if (act.priority === 'medium') priorityBadge = <span className="badge badge-info">medium</span>;
                  else if (act.priority === 'low') priorityBadge = <span className="badge badge-success">low</span>;
                  else if (act.priority === 'normal') priorityBadge = <span className="badge badge-muted">normal</span>;

                  return (
                    <tr key={act._id}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: act.status === 'failed' ? 'var(--danger)' : 'var(--accent-primary)' }} />
                          <code style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-primary)' }}>
                            /{act.command.replace('button:', 'btn:')}
                          </code>
                        </div>
                      </td>
                      <td style={{ fontWeight: 600, color: 'var(--text-primary)' }}>@{act.username}</td>
                      <td>{statusBadge}</td>
                      <td>{priorityBadge}</td>
                      <td>
                        {act.tags && act.tags.length > 0 ? (
                          <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>
                            {act.tags.map(t => (
                              <span key={t} style={{ fontSize: 10, background: 'rgba(88,101,242,0.1)', border: '1px solid rgba(88,101,242,0.2)', padding: '1px 6px', borderRadius: 4, color: 'var(--accent-primary)', fontWeight: 600 }}>{t}</span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 13, fontWeight: 500 }}>
                        {new Date(act.createdAt).toLocaleString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true })}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </motion.div>

      {/* Recent Failures Details */}
      {stats.recentFailures.length > 0 && (
        <motion.div className="glass-card" style={{ padding: 24, border: '1px solid rgba(240,71,71,0.2)' }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.6 }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8, color: 'var(--danger)' }}>
            <ShieldAlert size={18} /> Recent Failures & Error Logs
          </h3>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Command</th>
                  <th>User</th>
                  <th>Attempts</th>
                  <th>Last Error Log</th>
                  <th>Time</th>
                </tr>
              </thead>
              <tbody>
                {stats.recentFailures.map(f => {
                  const lastAttempt = f.attempts?.[f.attempts.length - 1];
                  return (
                    <tr key={f._id}>
                      <td><code style={{ color: 'var(--danger)', fontWeight: 700 }}>/{f.command}</code></td>
                      <td style={{ fontWeight: 600 }}>@{f.username}</td>
                      <td><span className="badge badge-danger" style={{ fontWeight: 700 }}>{f.attempts?.length || 0} attempts</span></td>
                      <td style={{ color: 'var(--danger)', fontSize: 13, fontFamily: 'monospace', background: 'rgba(240,71,71,0.05)', padding: '6px 10px', borderRadius: 4, maxWidth: 350, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {lastAttempt?.error || 'Execution timeout'}
                      </td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: 13 }}>{new Date(f.createdAt).toLocaleString()}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </div>
  );
}
