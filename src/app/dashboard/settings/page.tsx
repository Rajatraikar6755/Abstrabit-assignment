'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Settings, Shield, Bot, Save, AlertCircle, CheckCircle2, Plus, Trash2, HelpCircle, Info } from 'lucide-react';

interface GuildConfig {
  discordGuildId: string;
  guildName: string;
  channelId: string;
  mirrorType: 'slack' | 'discord';
  aiEnabled: boolean;
  hasMirrorWebhook: boolean;
}

interface Rule {
  field: string;
  operator: 'contains' | 'equals' | 'startsWith' | 'endsWith' | 'regex' | 'lengthGreaterThan' | 'lengthLessThan';
  value: string;
}

interface Action {
  type: 'tag' | 'priority' | 'autoReply' | 'mirrorOverride';
  params: Record<string, string>;
}

interface CommandConfig {
  _id: string;
  commandName: string;
  guildId: string;
  description: string;
  enabled: boolean;
  rules: Rule[];
  actions: Action[];
}

export default function SettingsPage() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<'bot' | 'rules'>('bot');
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  // Bot Config Form State
  const [guildId, setGuildId] = useState('');
  const [channelId, setChannelId] = useState('');
  const [mirrorWebhookUrl, setMirrorWebhookUrl] = useState('');
  const [mirrorType, setMirrorType] = useState<'slack' | 'discord'>('discord');
  const [aiEnabled, setAiEnabled] = useState(true);

  // Helper popup guide states
  const [showGuildHelp, setShowGuildHelp] = useState(false);
  const [showChannelHelp, setShowChannelHelp] = useState(false);
  const [showWebhookHelp, setShowWebhookHelp] = useState(false);

  // Rules Editor Form State
  const [selectedCommandId, setSelectedCommandId] = useState<string>('');
  const [rules, setRules] = useState<Rule[]>([]);
  const [actions, setActions] = useState<Action[]>([]);
  const [commandEnabled, setCommandEnabled] = useState(true);

  // Queries
  const { data: guildData, isLoading: isGuildLoading } = useQuery({
    queryKey: ['guildSettings'],
    queryFn: async () => {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed to fetch guild settings');
      return res.json() as Promise<{ configs: GuildConfig[] }>;
    },
  });

  const { data: rulesData, isLoading: isRulesLoading } = useQuery({
    queryKey: ['commandRules'],
    queryFn: async () => {
      const res = await fetch('/api/rules');
      if (!res.ok) throw new Error('Failed to fetch command rules');
      return res.json() as Promise<{ configs: CommandConfig[] }>;
    },
  });

  // Populate form states when data is loaded
  useEffect(() => {
    if (guildData?.configs && guildData.configs.length > 0) {
      const config = guildData.configs[0];
      setGuildId(config.discordGuildId);
      setChannelId(config.channelId || '');
      setMirrorType(config.mirrorType || 'discord');
      setAiEnabled(config.aiEnabled !== false);
    }
  }, [guildData]);

  const activeCommand = rulesData?.configs.find(c => c._id === selectedCommandId);

  useEffect(() => {
    if (activeCommand) {
      setRules(activeCommand.rules || []);
      setActions(activeCommand.actions || []);
      setCommandEnabled(activeCommand.enabled !== false);
    } else if (rulesData?.configs && rulesData.configs.length > 0 && !selectedCommandId) {
      setSelectedCommandId(rulesData.configs[0]._id);
    }
  }, [activeCommand, rulesData, selectedCommandId]);

  // Mutations
  const updateGuildMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/settings', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update guild configuration');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['guildSettings'] });
      showSuccess('Guild configuration saved successfully!');
    },
    onError: (err: any) => {
      showError(err.message || 'Error saving guild configuration');
    },
  });

  const updateRulesMutation = useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch('/api/rules', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Failed to update command rules');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commandRules'] });
      showSuccess('Command rules and actions saved successfully!');
    },
    onError: (err: any) => {
      showError(err.message || 'Error saving command rules');
    },
  });

  const showSuccess = (msg: string) => {
    setSuccessMsg(msg);
    setTimeout(() => setSuccessMsg(''), 4000);
  };

  const showError = (msg: string) => {
    setErrorMsg(msg);
    setTimeout(() => setErrorMsg(''), 4000);
  };

  const handleSaveBotSettings = (e: React.FormEvent) => {
    e.preventDefault();
    if (!guildId) return;
    updateGuildMutation.mutate({
      guildId,
      channelId,
      mirrorWebhookUrl,
      mirrorType,
      aiEnabled,
    });
  };

  const handleSaveRules = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCommandId) return;
    updateRulesMutation.mutate({
      id: selectedCommandId,
      enabled: commandEnabled,
      rules,
      actions,
    });
  };

  const addRule = () => {
    setRules([...rules, { field: 'text', operator: 'contains', value: '' }]);
  };

  const removeRule = (index: number) => {
    setRules(rules.filter((_, i) => i !== index));
  };

  const updateRule = (index: number, key: keyof Rule, val: string) => {
    const updated = [...rules];
    updated[index] = { ...updated[index], [key]: val };
    setRules(updated);
  };

  const addAction = () => {
    setActions([...actions, { type: 'tag', params: { tag: '' } }]);
  };

  const removeAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const updateActionType = (index: number, type: Action['type']) => {
    const updated = [...actions];
    let params: Record<string, string> = {};
    if (type === 'tag') params = { tag: '' };
    if (type === 'priority') params = { level: 'high' };
    if (type === 'autoReply') params = { message: '' };
    updated[index] = { type, params };
    setActions(updated);
  };

  const updateActionParam = (index: number, paramKey: string, val: string) => {
    const updated = [...actions];
    updated[index] = {
      ...updated[index],
      params: { ...updated[index].params, [paramKey]: val },
    };
    setActions(updated);
  };

  const isLoading = isGuildLoading || isRulesLoading;

  return (
    <div style={{ maxWidth: 800, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 28, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: 28, fontWeight: 700, marginBottom: 4, display: 'flex', alignItems: 'center', gap: 10 }}>
            <Settings size={24} /> Settings
          </h1>
          <p style={{ color: 'var(--text-secondary)', fontSize: 14 }}>
            Configure server connections, notification hooks, and rule behaviors
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 8, borderBottom: '1px solid var(--border-color)', marginBottom: 24, paddingBottom: 1 }}>
        <button
          className={`sidebar-link ${activeTab === 'bot' ? 'active' : ''}`}
          style={{ border: 'none', background: 'none', cursor: 'pointer', borderRadius: '8px 8px 0 0', padding: '10px 20px' }}
          onClick={() => setActiveTab('bot')}
        >
          <Shield size={16} /> Bot & Integrations
        </button>
        <button
          className={`sidebar-link ${activeTab === 'rules' ? 'active' : ''}`}
          style={{ border: 'none', background: 'none', cursor: 'pointer', borderRadius: '8px 8px 0 0', padding: '10px 20px' }}
          onClick={() => setActiveTab('rules')}
        >
          <Bot size={16} /> Command Rules Engine
        </button>
      </div>

      {/* Notifications */}
      {successMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'rgba(67, 181, 129, 0.1)', border: '1px solid rgba(67, 181, 129, 0.2)', borderRadius: 8, marginBottom: 20, fontSize: 14, color: 'var(--success)' }}>
          <CheckCircle2 size={16} /> {successMsg}
        </div>
      )}
      {errorMsg && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'rgba(240, 71, 71, 0.1)', border: '1px solid rgba(240, 71, 71, 0.2)', borderRadius: 8, marginBottom: 20, fontSize: 14, color: 'var(--danger)' }}>
          <AlertCircle size={16} /> {errorMsg}
        </div>
      )}

      {isLoading ? (
        <div style={{ padding: 60, textAlign: 'center' }}>
          <div className="animate-spin" style={{ width: 24, height: 24, border: '3px solid var(--border-color)', borderTopColor: 'var(--accent-primary)', borderRadius: '50%', margin: '0 auto' }} />
        </div>
      ) : (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2 }}>
          {activeTab === 'bot' && (
            <form onSubmit={handleSaveBotSettings} className="glass-card" style={{ padding: 28, display: 'flex', flexDirection: 'column', gap: 20 }}>
              <h3 style={{ fontSize: 16, fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: 10 }}>Guild Association</h3>
              
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Discord Guild ID (Connected Server)</label>
                  <button
                    type="button"
                    onClick={() => setShowGuildHelp(!showGuildHelp)}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
                    className="hover-bright"
                  >
                    <HelpCircle size={14} /> How to find?
                  </button>
                </div>
                <input
                  className="input-field"
                  placeholder="e.g., 123456789012345678"
                  value={guildId}
                  onChange={e => setGuildId(e.target.value)}
                  required
                />
                {showGuildHelp && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px dashed var(--border-color)',
                      borderRadius: 8,
                      padding: 16,
                      marginTop: 10,
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                      lineHeight: '1.6'
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Info size={14} color="var(--accent-primary)" /> How to find Discord Server (Guild) ID:
                    </div>
                    <ol style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, margin: 0 }}>
                      <li>Open Discord and go to your <strong>User Settings</strong> (gear icon next to username).</li>
                      <li>In the left sidebar, click <strong>Advanced</strong> (under App Settings).</li>
                      <li>Toggle on <strong>Developer Mode</strong>.</li>
                      <li>Go back to Discord, right-click the server icon/name in the list, and select <strong>Copy Server ID</strong>.</li>
                    </ol>
                  </motion.div>
                )}
              </div>

              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>Bot Posts Channel ID (e.g., Reports logging)</label>
                  <button
                    type="button"
                    onClick={() => setShowChannelHelp(!showChannelHelp)}
                    style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
                    className="hover-bright"
                  >
                    <HelpCircle size={14} /> How to find?
                  </button>
                </div>
                <input
                  className="input-field"
                  placeholder="e.g., 987654321098765432"
                  value={channelId}
                  onChange={e => setChannelId(e.target.value)}
                />
                {showChannelHelp && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    style={{
                      background: 'rgba(255, 255, 255, 0.02)',
                      border: '1px dashed var(--border-color)',
                      borderRadius: 8,
                      padding: 16,
                      marginTop: 10,
                      fontSize: 13,
                      color: 'var(--text-secondary)',
                      lineHeight: '1.6'
                    }}
                  >
                    <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <Info size={14} color="var(--accent-primary)" /> How to find Discord Channel ID:
                    </div>
                    <ol style={{ paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 6, margin: 0 }}>
                      <li>Ensure Discord <strong>Developer Mode</strong> is turned on (Settings &gt; Advanced).</li>
                      <li>Navigate to your Discord server channel list.</li>
                      <li>Right-click the text channel where you want the bot to post reports (e.g., `#alerts`), and click <strong>Copy Channel ID</strong> at the bottom of the list.</li>
                    </ol>
                  </motion.div>
                )}
              </div>

              <h3 style={{ fontSize: 16, fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: 10, marginTop: 10 }}>Mirror Notifications (Slack / Discord webhook)</h3>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
                <div>
                  <label style={{ display: 'block', fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)', marginBottom: 6 }}>Mirror Type</label>
                  <select
                    className="input-field"
                    value={mirrorType}
                    onChange={e => setMirrorType(e.target.value as 'slack' | 'discord')}
                  >
                    <option value="discord">Discord Channel Webhook</option>
                    <option value="slack">Slack Incoming Webhook</option>
                  </select>
                </div>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                    <label style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-secondary)' }}>
                      Webhook URL {guildData?.configs?.[0]?.hasMirrorWebhook && <span style={{ color: 'var(--success)', fontSize: 12 }}>(Already Configured)</span>}
                    </label>
                    <button
                      type="button"
                      onClick={() => setShowWebhookHelp(!showWebhookHelp)}
                      style={{ background: 'none', border: 'none', color: 'var(--accent-primary)', fontSize: 12, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, padding: 0 }}
                      className="hover-bright"
                    >
                      <HelpCircle size={14} /> How to find?
                    </button>
                  </div>
                  <input
                    type="password"
                    className="input-field"
                    placeholder="Paste new Webhook URL to update, or leave blank to keep"
                    value={mirrorWebhookUrl}
                    onChange={e => setMirrorWebhookUrl(e.target.value)}
                  />
                </div>
              </div>

              {showWebhookHelp && (
                <motion.div
                  initial={{ opacity: 0, y: -5 }}
                  animate={{ opacity: 1, y: 0 }}
                  style={{
                    background: 'rgba(255, 255, 255, 0.02)',
                    border: '1px dashed var(--border-color)',
                    borderRadius: 8,
                    padding: 16,
                    fontSize: 13,
                    color: 'var(--text-secondary)',
                    lineHeight: '1.6'
                  }}
                >
                  <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 8, display: 'flex', alignItems: 'center', gap: 6 }}>
                    <Info size={14} color="var(--accent-primary)" /> How to create and get a Webhook URL:
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, fontSize: 12 }}>For Discord:</div>
                      <ol style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4, margin: 0 }}>
                        <li>Go to your Discord Server settings {"→"} <strong>Integrations</strong>.</li>
                        <li>Click <strong>Webhooks</strong> {"→"} <strong>New Webhook</strong>.</li>
                        <li>Choose a target channel and click <strong>Copy Webhook URL</strong>.</li>
                      </ol>
                    </div>
                    <div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginBottom: 4, fontSize: 12 }}>For Slack:</div>
                      <ol style={{ paddingLeft: 16, display: 'flex', flexDirection: 'column', gap: 4, margin: 0 }}>
                        <li>Go to your Slack workspace and click <strong>Apps</strong> {"→"} Add App.</li>
                        <li>Search for <strong>Incoming Webhooks</strong> and install it.</li>
                        <li>Pick a channel, add the integration, and copy the generated Webhook URL.</li>
                      </ol>
                    </div>
                  </div>
                </motion.div>
              )}

              <h3 style={{ fontSize: 16, fontWeight: 600, borderBottom: '1px solid var(--border-color)', paddingBottom: 10, marginTop: 10 }}>AI features</h3>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div>
                  <div style={{ fontSize: 14, fontWeight: 500 }}>Enable Gemini Triage / Report Summaries</div>
                  <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>Triages raw /report inputs automatically with Gemini 2.0 Flash.</div>
                </div>
                <div
                  className={`toggle-switch ${aiEnabled ? 'active' : ''}`}
                  onClick={() => setAiEnabled(!aiEnabled)}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} disabled={updateGuildMutation.isPending}>
                  <Save size={16} /> Save Bot Settings
                </button>
              </div>
            </form>
          )}

          {activeTab === 'rules' && (
            <div className="glass-card" style={{ padding: 28 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--border-color)', paddingBottom: 16, marginBottom: 20 }}>
                <h3 style={{ fontSize: 16, fontWeight: 600 }}>Command Configuration</h3>
                <select
                  className="input-field"
                  style={{ width: 180 }}
                  value={selectedCommandId}
                  onChange={e => setSelectedCommandId(e.target.value)}
                >
                  {rulesData?.configs.map(c => (
                    <option key={c._id} value={c._id}>/{c.commandName}</option>
                  ))}
                </select>
              </div>

              {activeCommand && (
                <form onSubmit={handleSaveRules} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 600 }}>Enable Command Behavior</div>
                      <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>Toggle if this command triggers rule check and webhook actions.</div>
                    </div>
                    <div
                      className={`toggle-switch ${commandEnabled ? 'active' : ''}`}
                      onClick={() => setCommandEnabled(!commandEnabled)}
                    />
                  </div>

                  {/* Rules list */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 600 }}>Matching Rules</h4>
                      <button type="button" className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }} onClick={addRule}>
                        <Plus size={14} /> Add Rule
                      </button>
                    </div>
                    {rules.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic', padding: 12, background: 'var(--bg-secondary)', borderRadius: 8 }}>
                        No matching rules configured. Bot runs triage default behaviors.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {rules.map((rule, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <select
                              className="input-field"
                              style={{ flex: 1 }}
                              value={rule.field}
                              onChange={e => updateRule(idx, 'field', e.target.value)}
                            >
                              <option value="text">Report Input Text</option>
                            </select>
                            <select
                              className="input-field"
                              style={{ flex: 1 }}
                              value={rule.operator}
                              onChange={e => updateRule(idx, 'operator', e.target.value as any)}
                            >
                              <option value="contains">Contains</option>
                              <option value="equals">Equals</option>
                              <option value="startsWith">Starts With</option>
                              <option value="endsWith">Ends With</option>
                              <option value="regex">Regex</option>
                              <option value="lengthGreaterThan">Length &gt;</option>
                              <option value="lengthLessThan">Length &lt;</option>
                            </select>
                            <input
                              className="input-field"
                              style={{ flex: 2 }}
                              placeholder="Value..."
                              value={rule.value}
                              onChange={e => updateRule(idx, 'value', e.target.value)}
                              required
                            />
                            <button type="button" className="btn-secondary" style={{ padding: 10, color: 'var(--danger)' }} onClick={() => removeRule(idx)}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Actions list */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                      <h4 style={{ fontSize: 14, fontWeight: 600 }}>Applied Actions</h4>
                      <button type="button" className="btn-secondary" style={{ padding: '6px 12px', fontSize: 12, display: 'flex', alignItems: 'center', gap: 6 }} onClick={addAction}>
                        <Plus size={14} /> Add Action
                      </button>
                    </div>
                    {actions.length === 0 ? (
                      <p style={{ color: 'var(--text-muted)', fontSize: 13, fontStyle: 'italic', padding: 12, background: 'var(--bg-secondary)', borderRadius: 8 }}>
                        No specific actions configured on rule match.
                      </p>
                    ) : (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {actions.map((action, idx) => (
                          <div key={idx} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                            <select
                              className="input-field"
                              style={{ flex: 1 }}
                              value={action.type}
                              onChange={e => updateActionType(idx, e.target.value as any)}
                            >
                              <option value="tag">Apply Tag</option>
                              <option value="priority">Set Priority</option>
                              <option value="autoReply">Send Auto-Reply</option>
                            </select>
                            
                            {action.type === 'tag' && (
                              <input
                                className="input-field"
                                style={{ flex: 3 }}
                                placeholder="Tag name (e.g., support-needed)"
                                value={action.params.tag || ''}
                                onChange={e => updateActionParam(idx, 'tag', e.target.value)}
                                required
                              />
                            )}

                            {action.type === 'priority' && (
                              <select
                                className="input-field"
                                style={{ flex: 3 }}
                                value={action.params.level || 'high'}
                                onChange={e => updateActionParam(idx, 'level', e.target.value)}
                              >
                                <option value="low">Low</option>
                                <option value="medium">Medium</option>
                                <option value="high">High</option>
                                <option value="critical">Critical</option>
                              </select>
                            )}

                            {action.type === 'autoReply' && (
                              <input
                                className="input-field"
                                style={{ flex: 3 }}
                                placeholder="Auto reply message content..."
                                value={action.params.message || ''}
                                onChange={e => updateActionParam(idx, 'message', e.target.value)}
                                required
                              />
                            )}

                            <button type="button" className="btn-secondary" style={{ padding: 10, color: 'var(--danger)' }} onClick={() => removeAction(idx)}>
                              <Trash2 size={16} />
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 10 }}>
                    <button type="submit" className="btn-primary" style={{ display: 'flex', alignItems: 'center', gap: 8 }} disabled={updateRulesMutation.isPending}>
                      <Save size={16} /> Save Command Config
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
