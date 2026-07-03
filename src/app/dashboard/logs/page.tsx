'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ScrollText, Search, Filter, RefreshCw, ChevronLeft, ChevronRight, Eye, RotateCcw } from 'lucide-react';

interface Attempt {
  attemptNumber: number;
  status: string;
  error?: string;
  timestamp: string;
  durationMs?: number;
}

interface LogEntry {
  _id: string;
  discordInteractionId: string;
  command: string;
  username: string;
  status: string;
  aiSummary: string;
  aiTags: string[];
  aiPriority: string;
  mirrorSent: boolean;
  discordResponseSent: boolean;
  attempts: Attempt[];
  commandOptions: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

interface LogsResponse {
  logs: LogEntry[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export default function LogsPage() {
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [status, setStatus] = useState('all');
  const [command, setCommand] = useState('all');
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data, isLoading } = useQuery<LogsResponse>({
    queryKey: ['logs', page, status, command, search],
    queryFn: async () => {
      const params = new URLSearchParams({ page: String(page), limit: '20' });
      if (status !== 'all') params.set('status', status);
      if (command !== 'all') params.set('command', command);
      if (search) params.set('search', search);
      const res = await fetch(`/api/logs?${params}`);
      if (!res.ok) throw new Error('Failed to fetch logs');
      return res.json();
    },
    refetchInterval: 10000,
  });

  const retryMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/retry/${id}`, { method: 'POST' });
      if (!res.ok) throw new Error('Retry failed');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['logs'] });
      queryClient.invalidateQueries({ queryKey: ['stats'] });
    },
  });

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
    setPage(1);
  };

  const getStatusBadge = (s: string) => {
    const map: Record<string, string> = {
      success: 'badge-success',
      failed: 'badge-danger',
      processing: 'badge-warning',
      deferred: 'badge-info',
      received: 'badge-muted',
    };
    return map[s] || 'badge-muted';
  };

  const getPriorityBadge = (p: string) => {
    const map: Record<string, string> = {
      critical: 'badge-danger',
      high: 'badge-warning',
      medium: 'badge-info',
      low: 'badge-success',
    };
    return map[p] || 'badge-muted';
  };

  return (
    <div>
      <div style={{ marginBottom: 24 }}>
        <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
          <ScrollText size={24} /> Command Logs
        </h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
          {data ? `${data.total} total interactions` : 'Loading...'}
        </p>
      </div>

      {/* Filters */}
      <div className="glass-card" style={{ padding: 16, marginBottom: 20, display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
        <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8, flex: 1, minWidth: 200 }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
            <input
              className="input-field"
              style={{ paddingLeft: 36 }}
              placeholder="Search by user, command, or AI summary..."
              value={searchInput}
              onChange={e => setSearchInput(e.target.value)}
            />
          </div>
          <button type="submit" className="btn-secondary" style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <Search size={14} /> Search
          </button>
        </form>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <Filter size={14} color="var(--text-muted)" />
          <select
            className="input-field"
            style={{ width: 140 }}
            value={status}
            onChange={e => { setStatus(e.target.value); setPage(1); }}
          >
            <option value="all">All Status</option>
            <option value="success">Success</option>
            <option value="failed">Failed</option>
            <option value="processing">Processing</option>
            <option value="deferred">Deferred</option>
          </select>
          <select
            className="input-field"
            style={{ width: 140 }}
            value={command}
            onChange={e => { setCommand(e.target.value); setPage(1); }}
          >
            <option value="all">All Commands</option>
            <option value="report">report</option>
            <option value="status">status</option>
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="glass-card" style={{ overflow: 'hidden' }}>
        {isLoading ? (
          <div style={{ padding: 60, textAlign: 'center' }}>
            <div className="animate-spin" style={{ width: 24, height: 24, border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', margin: '0 auto' }} />
          </div>
        ) : !data?.logs.length ? (
          <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)' }}>
            No interactions found
          </div>
        ) : (
          <>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Command</th>
                  <th>User</th>
                  <th>Status</th>
                  <th>Priority</th>
                  <th>Mirror</th>
                  <th>Time</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {data.logs.map(log => (
                  <Fragment key={log._id}>
                    <tr style={{ cursor: 'pointer' }} onClick={() => setExpandedId(expandedId === log._id ? null : log._id)}>
                      <td><code style={{ color: 'var(--accent-primary)', fontSize: 13 }}>/{log.command}</code></td>
                      <td style={{ fontSize: 13 }}>{log.username}</td>
                      <td><span className={`badge ${getStatusBadge(log.status)}`}>{log.status}</span></td>
                      <td>
                        {log.aiPriority ? (
                          <span className={`badge ${getPriorityBadge(log.aiPriority)}`}>{log.aiPriority}</span>
                        ) : (
                          <span style={{ color: 'var(--text-muted)', fontSize: 12 }}>—</span>
                        )}
                      </td>
                      <td>
                        {log.mirrorSent ? (
                          <span className="badge badge-success">Sent</span>
                        ) : (
                          <span className="badge badge-muted">No</span>
                        )}
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                        {new Date(log.createdAt).toLocaleString()}
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button
                            className="btn-secondary"
                            style={{ padding: '4px 8px', fontSize: 12 }}
                            onClick={e => { e.stopPropagation(); setExpandedId(expandedId === log._id ? null : log._id); }}
                          >
                            <Eye size={14} />
                          </button>
                          {(log.status === 'failed' || log.status === 'deferred') && (
                            <button
                              className="btn-primary"
                              style={{ padding: '4px 10px', fontSize: 12 }}
                              disabled={retryMutation.isPending}
                              onClick={e => { e.stopPropagation(); retryMutation.mutate(log._id); }}
                            >
                              <RotateCcw size={14} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                    {/* Expanded Row */}
                    <AnimatePresence>
                      {expandedId === log._id && (
                        <tr key={`${log._id}-expanded`}>
                          <td colSpan={7} style={{ padding: 0 }}>
                            <motion.div
                              initial={{ opacity: 0, height: 0 }}
                              animate={{ opacity: 1, height: 'auto' }}
                              exit={{ opacity: 0, height: 0 }}
                              style={{ padding: 20, background: 'var(--bg-secondary)', overflow: 'hidden' }}
                            >
                              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                                <div>
                                  <h4 style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Input</h4>
                                  <pre style={{ fontSize: 13, background: 'var(--bg-primary)', padding: 12, borderRadius: 8, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>
                                    {JSON.stringify(log.commandOptions, null, 2)}
                                  </pre>
                                </div>
                                <div>
                                  <h4 style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>AI Analysis</h4>
                                  {log.aiSummary ? (
                                    <div>
                                      <p style={{ fontSize: 14, marginBottom: 8 }}>{log.aiSummary}</p>
                                      {log.aiTags?.length > 0 && (
                                        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                                          {log.aiTags.map(tag => (
                                            <span key={tag} className="badge badge-info">{tag}</span>
                                          ))}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <p style={{ color: 'var(--text-muted)', fontSize: 13 }}>No AI analysis</p>
                                  )}
                                </div>
                              </div>
                              {log.attempts?.length > 0 && (
                                <div style={{ marginTop: 16 }}>
                                  <h4 style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Attempt History</h4>
                                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    {log.attempts.map((a, i) => (
                                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, fontSize: 13, padding: '6px 10px', background: 'var(--bg-primary)', borderRadius: 6 }}>
                                        <span className={`badge ${a.status === 'success' ? 'badge-success' : 'badge-danger'}`}>#{a.attemptNumber}</span>
                                        <span style={{ color: 'var(--text-muted)' }}>{new Date(a.timestamp).toLocaleString()}</span>
                                        {a.durationMs !== undefined && <span style={{ color: 'var(--text-muted)' }}>{a.durationMs}ms</span>}
                                        {a.error && <span style={{ color: 'var(--danger)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.error}</span>}
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              )}
                              <div style={{ marginTop: 12, fontSize: 12, color: 'var(--text-muted)' }}>
                                Interaction ID: <code>{log.discordInteractionId}</code>
                              </div>
                            </motion.div>
                          </td>
                        </tr>
                      )}
                    </AnimatePresence>
                  </Fragment>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            {data.totalPages > 1 && (
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderTop: '1px solid var(--border-color)' }}>
                <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>
                  Page {data.page} of {data.totalPages}
                </span>
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    className="btn-secondary"
                    style={{ padding: '6px 10px' }}
                    disabled={page <= 1}
                    onClick={() => setPage(p => p - 1)}
                  >
                    <ChevronLeft size={16} />
                  </button>
                  <button
                    className="btn-secondary"
                    style={{ padding: '6px 10px' }}
                    disabled={page >= data.totalPages}
                    onClick={() => setPage(p => p + 1)}
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
