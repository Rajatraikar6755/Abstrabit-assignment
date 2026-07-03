'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'framer-motion';
import { FlaskConical, Send, Bot, Hash, Tag, Activity, Cpu } from 'lucide-react';

interface SimulateResponse {
  success: boolean;
  interactionId: string;
  durationMs: number;
  embed: {
    title: string;
    color: number;
    fields: { name: string; value: string; inline?: boolean }[];
    timestamp: string;
    footer: { text: string };
  };
  ruleResults: any;
  triageResult: any;
  priority: string;
  tags: string[];
}

export default function SimulatePage() {
  const [command, setCommand] = useState('report');
  const [text, setText] = useState('');
  const [username, setUsername] = useState('dashboard_admin');
  const [isSimulating, setIsSimulating] = useState(false);
  const [result, setResult] = useState<SimulateResponse | null>(null);
  const [error, setError] = useState('');

  // Fetch available guilds to populate the dropdown
  const { data: configsData } = useQuery({
    queryKey: ['guildConfigs'],
    queryFn: async () => {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json();
    },
  });

  const [guildId, setGuildId] = useState('');

  const handleSimulate = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSimulating(true);
    setError('');
    setResult(null);

    // Default to the first configured guild if not explicitly set
    const selectedGuild = guildId || (configsData?.configs?.[0]?.discordGuildId) || 'test-guild-id';

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ command, text, username, guildId: selectedGuild }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Simulation failed');
      
      setResult(data);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSimulating(false);
    }
  };

  // Helper to convert discord number color to CSS hex
  const formatColor = (numColor: number) => {
    return '#' + numColor.toString(16).padStart(6, '0');
  };

  return (
    <div style={{ paddingBottom: 40 }}>
      <div style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 800, marginBottom: 4, letterSpacing: '-0.02em', display: 'flex', alignItems: 'center', gap: 10 }}>
            <FlaskConical size={28} color="var(--accent-primary)" /> Command Simulator
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Test your commands, rules, and AI triage behavior without leaving the dashboard.
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
        {/* Left Side: Input Form */}
        <motion.div className="glass-card" style={{ padding: 28 }} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Bot size={18} color="var(--accent-primary)" /> Configure Command
          </h3>

          <form onSubmit={handleSimulate} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Select Command</label>
              <select className="input-field" value={command} onChange={e => setCommand(e.target.value)}>
                <option value="report">/report</option>
                <option value="status">/status</option>
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Guild (Server) Context</label>
              <select className="input-field" value={guildId} onChange={e => setGuildId(e.target.value)}>
                {configsData?.configs?.length > 0 ? (
                  configsData.configs.map((conf: any) => (
                    <option key={conf.discordGuildId} value={conf.discordGuildId}>
                      {conf.guildName || conf.discordGuildId}
                    </option>
                  ))
                ) : (
                  <option value="test-guild-id">Test Server Environment</option>
                )}
              </select>
            </div>

            <div>
              <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Simulated Username</label>
              <input 
                className="input-field" 
                value={username} 
                onChange={e => setUsername(e.target.value)} 
                required 
              />
            </div>

            {command === 'report' && (
              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 6 }}>Report Input Text</label>
                <textarea 
                  className="input-field" 
                  value={text} 
                  onChange={e => setText(e.target.value)} 
                  rows={4}
                  placeholder="Type a simulated bug report, feature request, or issue here to see how the AI and Rules Engine processes it..."
                  required
                />
              </div>
            )}

            {error && (
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid var(--danger)', padding: 12, borderRadius: 8, color: 'var(--danger)', fontSize: 14 }}>
                {error}
              </div>
            )}

            <button 
              type="submit" 
              className="btn-primary" 
              disabled={isSimulating || (command === 'report' && !text.trim())}
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '14px', marginTop: 10, fontSize: 15 }}
            >
              {isSimulating ? (
                <div className="animate-spin" style={{ width: 18, height: 18, border: '2px solid rgba(255,255,255,0.3)', borderTopColor: 'white', borderRadius: '50%' }} />
              ) : (
                <Send size={18} />
              )}
              {isSimulating ? 'Processing Pipeline...' : 'Fire Command'}
            </button>
          </form>
        </motion.div>

        {/* Right Side: Discord Card Preview */}
        <motion.div className="glass-card" style={{ padding: 28, background: 'var(--bg-secondary)', borderStyle: 'dashed' }} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Hash size={18} color="var(--accent-secondary)" /> Live Output Preview
          </h3>

          {!result && !isSimulating && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--text-muted)' }}>
              <Cpu size={48} style={{ marginBottom: 16, opacity: 0.5 }} />
              <p style={{ fontSize: 15, fontWeight: 500 }}>Waiting for command execution...</p>
              <p style={{ fontSize: 13, textAlign: 'center', marginTop: 8, maxWidth: 250 }}>The processed Discord embed preview will appear here in real-time.</p>
            </div>
          )}

          {isSimulating && (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: 300, color: 'var(--accent-primary)' }}>
              <div className="animate-spin" style={{ width: 40, height: 40, border: '3px solid var(--border-glow)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', marginBottom: 16 }} />
              <p style={{ fontSize: 14, fontWeight: 600 }} className="animate-pulse">Running AI Triage & Rules Engine...</p>
            </div>
          )}

          {result && !isSimulating && (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: 'spring', damping: 20 }}>
              
              {/* Discord Embed Mockup */}
              <div style={{ 
                background: '#2b2d31', 
                borderRadius: '4px', 
                borderLeft: `4px solid ${formatColor(result.embed.color)}`,
                padding: '12px 16px',
                marginTop: 10,
                boxShadow: '0 4px 6px rgba(0,0,0,0.3)',
                color: '#dbdee1',
                fontFamily: 'system-ui, -apple-system, sans-serif'
              }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: '#f2f3f5', marginBottom: 8 }}>{result.embed.title}</div>
                
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px 24px', marginBottom: 12 }}>
                  {result.embed.fields.map((field, idx) => (
                    <div key={idx} style={{ flexBasis: field.inline ? '45%' : '100%' }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: '#b5bac1', marginBottom: 4, textTransform: 'uppercase' }}>{field.name}</div>
                      <div style={{ fontSize: 13, lineHeight: '1.4' }}>
                        {field.value.split('\n').map((line, i) => (
                          <div key={i}>{line}</div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <div style={{ fontSize: 11, color: '#949ba4', display: 'flex', alignItems: 'center', gap: 6, marginTop: 12 }}>
                  <div style={{ width: 16, height: 16, background: '#1e1f22', borderRadius: '50%', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Bot size={10} color="#f2f3f5" />
                  </div>
                  {result.embed.footer.text} • Today at {new Date(result.embed.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </div>
              </div>

              {/* Debug Execution Data */}
              <div style={{ marginTop: 24, padding: 16, background: 'rgba(255,255,255,0.02)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 12, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Execution Trace</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 13 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Latency</span>
                    <span style={{ color: 'var(--accent-primary)', fontWeight: 600 }}>{result.durationMs}ms</span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Rules Matched</span>
                    <span style={{ color: result.ruleResults.matched ? 'var(--success)' : 'var(--text-primary)', fontWeight: 600 }}>
                      {result.ruleResults.matchedRules?.length || 0}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>AI Triage Triggered</span>
                    <span style={{ color: result.triageResult ? 'var(--success)' : 'var(--text-primary)', fontWeight: 600 }}>
                      {result.triageResult ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: 'var(--text-muted)' }}>Assigned Priority</span>
                    <span style={{ fontWeight: 600, textTransform: 'uppercase' }}>{result.priority}</span>
                  </div>
                </div>
              </div>

            </motion.div>
          )}
        </motion.div>
      </div>
    </div>
  );
}
