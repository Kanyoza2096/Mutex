import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import {
  Settings, Link, Key, Globe, Eye, EyeOff, Save, CheckCircle,
  AlertTriangle, Server, Shield, Zap, Copy, Clock, Activity,
  BrainCircuit, HardDrive, RefreshCw, Terminal, FileText,
  Cpu, Plug, Radio, GitBranch, BarChart3, Database,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

export default function SettingsPage() {
  const {
    wsEndpoint, restEndpoint, masterToken, setConnectionParams,
    socketConnected, socketTransport, isUsingLiveBackendData, backendConfig,
    stats, healthMatrix, latencyHistory,
    dataChannelStatus, pluginStatus, aiProviderHealth,
    workflowMetrics, systemResources, integrationStatus,
  } = useStore();

  const [localWsEndpoint, setLocalWsEndpoint] = useState(wsEndpoint);
  const [localRestEndpoint, setLocalRestEndpoint] = useState(restEndpoint);
  const [localMasterToken, setLocalMasterToken] = useState(masterToken);
  const [showToken, setShowToken] = useState(false);
  const [saved, setSaved] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<'idle' | 'success' | 'error'>('idle');
  const [testMessage, setTestMessage] = useState('');
  const [activeTab, setActiveTab] = useState<'connection' | 'system' | 'enterprise' | 'security'>('connection');

  const systemInfo = {
    version: (backendConfig as any)?.version || '12.0.0',
    environment: (backendConfig as any)?.config?.environment || 'production',
    aiProvider: (backendConfig as any)?.config?.ai_provider || 'gemini',
    aiModel: (backendConfig as any)?.config?.gemini_model || 'gemini-2.5-flash',
    supabaseEnabled: (backendConfig as any)?.config?.supabase_enabled || false,
    uptime: (backendConfig as any)?.uptime_seconds || 0,
    apiCalls: stats?.apiCalls || 0,
    postsPublished: stats?.postsPublished || 0,
    messagesToday: stats?.messagesToday || 0,
  };

  const onlineServices = healthMatrix?.filter((h: any) => h.status === 'online').length || 0;
  const totalServices = healthMatrix?.length || 0;
  const degradedServices = totalServices - onlineServices;

  const avgLatency = latencyHistory?.length
    ? Math.round(latencyHistory.reduce((a: number, b: number) => a + b, 0) / latencyHistory.length)
    : 0;

  const activePlugins = pluginStatus.filter(p => p.status === 'active').length;
  const totalPlugins = pluginStatus.length || 0;
  const availableProviders = aiProviderHealth.filter(p => p.available).length;
  const totalProviders = aiProviderHealth.length || 1;
  const connectedIntegrations = integrationStatus.filter(i => i.healthy).length;
  const totalIntegrations = integrationStatus.length || 0;

  const handleSave = () => {
    setConnectionParams({
      wsEndpoint: localWsEndpoint,
      restEndpoint: localRestEndpoint,
      masterToken: localMasterToken,
    });
    setSaved(true);
    toast.success('Connection parameters saved');
    setTimeout(() => setSaved(false), 3000);
  };

  const handleTestConnection = async () => {
    setTesting(true);
    setTestResult('idle');
    setTestMessage('');
    try {
      const base = localRestEndpoint.replace(/\/+$/, '');
      const res = await fetch(`${base}/health/deep`, {
        headers: { Authorization: `Bearer ${localMasterToken}` },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setTestResult('success');
      setTestMessage(`Connected — v${data.version || '?'} — ${Object.keys(data.services || {}).length} services`);
      toast.success('Connection test passed');
    } catch (err: any) {
      setTestResult('error');
      setTestMessage(err.message || 'Connection failed');
      toast.error('Connection test failed');
    } finally {
      setTesting(false);
    }
  };

  const formatUptime = (seconds: number) => {
    if (seconds <= 0 && !backendConfig) return 'Loading...';
    if (seconds <= 0) return '<1m';
    const d = Math.floor(seconds / 86400);
    const h = Math.floor((seconds % 86400) / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const parts = [];
    if (d > 0) parts.push(`${d}d`);
    if (h > 0) parts.push(`${h}h`);
    if (parts.length === 0 || m > 0) parts.push(`${m}m`);
    return parts.join(' ') || '<1m';
  };

  return (
    <div className="max-w-4xl mx-auto pb-24 md:pb-0 space-y-5 px-4 md:px-0 pt-4">

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
            <Settings className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Settings</h1>
            <p className="text-[10px] text-brand-text-muted font-mono uppercase tracking-wider mt-0.5">
              System configuration & diagnostics
            </p>
          </div>
        </div>
        <div className={cn(
          'flex items-center gap-2 px-3 py-1.5 rounded-full border text-xs font-mono font-bold',
          socketConnected
            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
            : 'bg-red-500/10 text-red-400 border-red-500/30'
        )}>
          <div className={cn('w-2 h-2 rounded-full', socketConnected ? 'bg-emerald-400' : 'bg-red-400')} />
          {socketConnected ? 'Connected' : 'Disconnected'}
        </div>
      </div>

      <div className="flex gap-1 p-1 bg-brand-surface border border-brand-border/50 rounded-xl w-fit overflow-x-auto">
        {[
          { id: 'connection', label: 'Connection', icon: Link },
          { id: 'system', label: 'System Info', icon: Server },
          { id: 'enterprise', label: 'Enterprise', icon: BarChart3 },
          { id: 'security', label: 'Security', icon: Shield },
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id as any)}
            className={cn(
              'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-bold uppercase tracking-wider transition-all whitespace-nowrap',
              activeTab === tab.id ? 'bg-brand-primary text-white shadow-glow-primary' : 'text-brand-text-muted hover:text-white'
            )}>
            <tab.icon className="w-3.5 h-3.5" /> {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        
        {activeTab === 'connection' && (
          <motion.div
            key="connection"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.12 }}
            className="space-y-5"
          >
            <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-5">
              <h2 className="text-xs font-bold uppercase tracking-widest text-brand-text flex items-center gap-2 mb-4">
                <Server className="w-4 h-4 text-brand-primary" /> Backend Engine Connection
              </h2>

              <div className="space-y-4">
                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase text-brand-text-muted mb-1.5">WebSocket Endpoint</label>
                  <div className="relative">
                    <Globe className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
                    <input type="text" value={localWsEndpoint} onChange={e => setLocalWsEndpoint(e.target.value)}
                      className="w-full bg-brand-elevated border border-brand-border/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-brand-text font-mono focus:outline-none focus:border-brand-primary/50 focus:ring-1 focus:ring-brand-primary/20 transition-all"
                      placeholder="wss://api.example.com/socket" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase text-brand-text-muted mb-1.5">REST API Base URL</label>
                  <div className="relative">
                    <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
                    <input type="text" value={localRestEndpoint} onChange={e => setLocalRestEndpoint(e.target.value)}
                      className="w-full bg-brand-elevated border border-brand-border/50 rounded-xl pl-10 pr-4 py-2.5 text-sm text-brand-text font-mono focus:outline-none focus:border-brand-primary/50 focus:ring-1 focus:ring-brand-primary/20 transition-all"
                      placeholder="https://api.example.com/api/v1" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase text-brand-text-muted mb-1.5">Master API Token</label>
                  <div className="relative">
                    <Key className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
                    <input type={showToken ? 'text' : 'password'} value={localMasterToken} onChange={e => setLocalMasterToken(e.target.value)}
                      className="w-full bg-brand-elevated border border-brand-border/50 rounded-xl pl-10 pr-20 py-2.5 text-sm text-brand-text font-mono focus:outline-none focus:border-brand-primary/50 focus:ring-1 focus:ring-brand-primary/20 transition-all"
                      placeholder="sk_live_..." />
                    <div className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                      <button type="button" onClick={() => setShowToken(!showToken)}
                        className="p-1.5 rounded-lg hover:bg-brand-elevated text-brand-text-muted hover:text-white transition-colors">
                        {showToken ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                      </button>
                      <button type="button" onClick={() => { navigator.clipboard.writeText(localMasterToken); toast.success('Token copied'); }}
                        className="p-1.5 rounded-lg hover:bg-brand-elevated text-brand-text-muted hover:text-white transition-colors">
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <p className="text-[10px] text-amber-400/80 mt-1.5 font-mono flex items-start gap-1">
                    <AlertTriangle className="w-3 h-3 flex-shrink-0 mt-0.5" />
                    Set as MASTER_API_TOKEN in your backend's .env. Never share.
                  </p>
                </div>
              </div>

              <div className="flex gap-3 mt-6">
                <button onClick={handleTestConnection} disabled={testing}
                  className="flex-1 py-2.5 rounded-xl bg-brand-surface border border-brand-border hover:border-brand-primary/30 text-brand-text text-xs font-bold font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 disabled:opacity-50">
                  {testing ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4 text-brand-accent" />}
                  {testing ? 'Testing...' : 'Test Connection'}
                </button>
                <button onClick={handleSave}
                  className={cn(
                    'flex-1 py-2.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider transition-all flex items-center justify-center gap-2 shadow-glow-primary',
                    saved ? 'bg-emerald-500 text-white' : 'bg-brand-primary hover:bg-brand-primary/90 text-white'
                  )}>
                  {saved ? <><CheckCircle className="w-4 h-4" /> Saved</> : <><Save className="w-4 h-4" /> Save & Apply</>}
                </button>
              </div>

              {testResult !== 'idle' && (
                <div className={cn(
                  'p-3 rounded-xl border flex items-start gap-3 mt-4',
                  testResult === 'success' ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20'
                )}>
                  {testResult === 'success' ? <CheckCircle className="w-5 h-5 text-emerald-400 flex-shrink-0" /> : <AlertTriangle className="w-5 h-5 text-red-400 flex-shrink-0" />}
                  <div>
                    <p className={cn('text-xs font-bold uppercase mb-0.5', testResult === 'success' ? 'text-emerald-400' : 'text-red-400')}>
                      {testResult === 'success' ? 'Connection Successful' : 'Connection Failed'}
                    </p>
                    <p className="text-[10px] text-brand-text-muted font-mono">{testMessage}</p>
                  </div>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono font-bold uppercase text-brand-text-muted tracking-wider">WebSocket</span>
                  <div className={cn('flex items-center gap-1.5 text-[10px] font-mono font-bold',
                    socketConnected ? 'text-emerald-400' : 'text-red-400')}>
                    <div className={cn('w-1.5 h-1.5 rounded-full', socketConnected ? 'bg-emerald-400' : 'bg-red-400')} />
                    {socketConnected ? 'LIVE' : 'DOWN'}
                  </div>
                </div>
                <div className="space-y-1 text-[10px] font-mono text-brand-text-muted">
                  <div className="flex justify-between"><span>Transport</span><span className="text-brand-text font-bold">{socketTransport || 'none'}</span></div>
                  <div className="flex justify-between"><span>Data Feed</span><span className={cn('font-bold', isUsingLiveBackendData ? 'text-emerald-400' : 'text-amber-400')}>{isUsingLiveBackendData ? 'ACTIVE' : 'WAITING'}</span></div>
                  <div className="flex justify-between"><span>Latency</span><span className="text-brand-text font-bold">{avgLatency}ms</span></div>
                </div>
              </div>

              <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-[10px] font-mono font-bold uppercase text-brand-text-muted tracking-wider">REST API</span>
                  <div className={cn('flex items-center gap-1.5 text-[10px] font-mono font-bold',
                    backendConfig ? 'text-emerald-400' : 'text-amber-400')}>
                    <div className={cn('w-1.5 h-1.5 rounded-full', backendConfig ? 'bg-emerald-400' : 'bg-amber-400')} />
                    {backendConfig ? 'ONLINE' : 'NO DATA'}
                  </div>
                </div>
                <div className="space-y-1 text-[10px] font-mono text-brand-text-muted">
                  <div className="flex justify-between"><span>Version</span><span className="text-brand-text font-bold">{systemInfo.version}</span></div>
                  <div className="flex justify-between"><span>Environment</span><span className="text-brand-text font-bold uppercase">{systemInfo.environment}</span></div>
                  <div className="flex justify-between"><span>Services</span><span className="text-brand-text font-bold">{onlineServices}/{totalServices} online</span></div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'system' && (
          <motion.div
            key="system"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.12 }}
            className="space-y-5"
          >
            <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-5">
              <h2 className="text-xs font-bold uppercase tracking-widest text-brand-text flex items-center gap-2 mb-4">
                <Activity className="w-4 h-4 text-brand-primary" /> System Overview
              </h2>
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                {[
                  { label: 'Uptime', value: formatUptime(systemInfo.uptime), icon: Clock, color: 'text-brand-primary' },
                  { label: 'API Calls', value: systemInfo.apiCalls.toLocaleString(), icon: Activity, color: 'text-emerald-400' },
                  { label: 'Posts', value: systemInfo.postsPublished, icon: FileText, color: 'text-violet-400' },
                  { label: 'Messages', value: systemInfo.messagesToday, icon: Zap, color: 'text-amber-400' },
                ].map(stat => (
                  <div key={stat.label} className="bg-brand-elevated/30 border border-brand-border/30 rounded-xl p-3 text-center">
                    <stat.icon className={cn('w-4 h-4 mx-auto mb-1.5', stat.color)} />
                    <p className="text-lg font-mono font-bold text-white">{stat.value}</p>
                    <p className="text-[9px] text-brand-text-muted font-mono uppercase mt-0.5">{stat.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-4">
                <h3 className="text-[10px] font-mono font-bold uppercase text-brand-text-muted tracking-wider mb-3 flex items-center gap-2">
                  <BrainCircuit className="w-3.5 h-3.5 text-brand-primary" /> AI Configuration
                </h3>
                <div className="space-y-2 text-[10px] font-mono">
                  <div className="flex justify-between"><span className="text-brand-text-muted">Provider</span><span className="text-brand-text font-bold uppercase">{systemInfo.aiProvider}</span></div>
                  <div className="flex justify-between"><span className="text-brand-text-muted">Model</span><span className="text-brand-text font-bold">{systemInfo.aiModel}</span></div>
                  <div className="flex justify-between"><span className="text-brand-text-muted">Supabase</span><span className={cn('font-bold', systemInfo.supabaseEnabled ? 'text-emerald-400' : 'text-zinc-500')}>{systemInfo.supabaseEnabled ? 'Enabled' : 'Disabled'}</span></div>
                </div>
              </div>

              <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-4">
                <h3 className="text-[10px] font-mono font-bold uppercase text-brand-text-muted tracking-wider mb-3 flex items-center gap-2">
                  <HardDrive className="w-3.5 h-3.5 text-brand-primary" /> Services
                </h3>
                <div className="space-y-2 text-[10px] font-mono">
                  <div className="flex justify-between"><span className="text-brand-text-muted">Total</span><span className="text-brand-text font-bold">{totalServices}</span></div>
                  <div className="flex justify-between"><span className="text-brand-text-muted">Online</span><span className="text-emerald-400 font-bold">{onlineServices}</span></div>
                  <div className="flex justify-between"><span className="text-brand-text-muted">Degraded</span><span className="text-amber-400 font-bold">{degradedServices}</span></div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'enterprise' && (
          <motion.div
            key="enterprise"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.12 }}
            className="space-y-5"
          >
            <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-5">
              <h2 className="text-xs font-bold uppercase tracking-widest text-brand-text flex items-center gap-2 mb-4">
                <Radio className="w-4 h-4 text-brand-primary" /> Data Pipeline Status
              </h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {[
                  { label: 'Socket.IO', status: dataChannelStatus.socketIO, icon: Radio },
                  { label: 'REST Polling', status: dataChannelStatus.restPolling, icon: Activity },
                  { label: 'Supabase Realtime', status: dataChannelStatus.supabaseRealtime, icon: Database },
                ].map(channel => (
                  <div key={channel.label} className="bg-brand-elevated/30 border border-brand-border/30 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-2">
                      <channel.icon className="w-3.5 h-3.5 text-brand-text-muted" />
                      <span className={cn(
                        'text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full border',
                        channel.status === 'connected' || channel.status === 'active' || channel.status === 'subscribed'
                          ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                          : channel.status === 'reconnecting' || channel.status === 'error'
                            ? 'bg-red-500/10 text-red-400 border-red-500/20'
                            : 'bg-slate-500/10 text-slate-400 border-slate-500/20'
                      )}>{channel.status}</span>
                    </div>
                    <p className="text-[10px] font-mono text-brand-text font-bold">{channel.label}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-5">
              <h2 className="text-xs font-bold uppercase tracking-widest text-brand-text flex items-center gap-2 mb-4">
                <BrainCircuit className="w-4 h-4 text-brand-primary" /> AI Provider Health ({availableProviders}/{totalProviders} online)
              </h2>
              <div className="space-y-2">
                {aiProviderHealth.length === 0 ? (
                  <p className="text-[10px] text-brand-text-muted font-mono">Waiting for provider data...</p>
                ) : (
                  aiProviderHealth.map(provider => (
                    <div key={provider.provider} className="flex items-center justify-between bg-brand-elevated/20 border border-brand-border/30 rounded-xl px-3 py-2.5">
                      <div className="flex items-center gap-2">
                        <span className={cn('w-2 h-2 rounded-full', provider.available ? 'bg-emerald-400' : 'bg-red-400')} />
                        <span className="text-[10px] font-mono text-brand-text capitalize font-bold">{provider.provider}</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-[9px] font-mono text-brand-text-muted">{provider.model}</span>
                        {provider.latency_ms > 0 && <span className="text-[9px] font-mono text-brand-text-muted">{provider.latency_ms}ms</span>}
                        <span className={cn('text-[9px] font-mono font-bold', provider.available ? 'text-emerald-400' : 'text-red-400')}>
                          {provider.available ? 'ONLINE' : 'OFFLINE'}
                        </span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-4">
                <h3 className="text-[10px] font-mono font-bold uppercase text-brand-text-muted tracking-wider mb-3 flex items-center gap-2">
                  <Plug className="w-3.5 h-3.5 text-brand-accent" /> Plugins ({activePlugins}/{totalPlugins})
                </h3>
                <div className="space-y-1.5 max-h-40 overflow-y-auto">
                  {pluginStatus.length === 0 ? (
                    <p className="text-[9px] text-brand-text-muted font-mono">No plugins registered</p>
                  ) : (
                    pluginStatus.map(p => (
                      <div key={p.name} className="flex justify-between text-[9px] font-mono">
                        <span className="text-brand-text capitalize">{p.name.replace(/_/g, ' ')}</span>
                        <span className="text-brand-text-muted">{p.commands} cmd</span>
                      </div>
                    ))
                  )}
                </div>
              </div>

              <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-4">
                <h3 className="text-[10px] font-mono font-bold uppercase text-brand-text-muted tracking-wider mb-3 flex items-center gap-2">
                  <GitBranch className="w-3.5 h-3.5 text-brand-primary" /> Workflows
                </h3>
                <div className="space-y-2 text-[10px] font-mono">
                  <div className="flex justify-between"><span className="text-brand-text-muted">Running</span><span className="text-emerald-400 font-bold">{workflowMetrics.running}</span></div>
                  <div className="flex justify-between"><span className="text-brand-text-muted">Queued</span><span className="text-amber-400 font-bold">{workflowMetrics.queued}</span></div>
                  <div className="flex justify-between"><span className="text-brand-text-muted">Failed Today</span><span className={cn('font-bold', workflowMetrics.failed_today > 0 ? 'text-red-400' : 'text-brand-text-muted')}>{workflowMetrics.failed_today}</span></div>
                  <div className="flex justify-between"><span className="text-brand-text-muted">Completed</span><span className="text-brand-text font-bold">{workflowMetrics.completed_today}</span></div>
                </div>
              </div>

              <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-4">
                <h3 className="text-[10px] font-mono font-bold uppercase text-brand-text-muted tracking-wider mb-3 flex items-center gap-2">
                  <Cpu className="w-3.5 h-3.5 text-brand-warning" /> Resources
                </h3>
                <div className="space-y-2">
                  {[
                    { label: 'CPU', value: systemResources.cpu_percent, color: 'bg-emerald-400' },
                    { label: 'MEM', value: systemResources.memory_percent, color: 'bg-amber-400' },
                    { label: 'DISK', value: systemResources.disk_percent, color: 'bg-blue-400' },
                  ].map(r => (
                    <div key={r.label}>
                      <div className="flex justify-between text-[9px] font-mono mb-0.5">
                        <span className="text-brand-text-muted">{r.label}</span>
                        <span className="text-brand-text font-bold">{r.value.toFixed(0)}%</span>
                      </div>
                      <div className="h-1 bg-brand-elevated rounded-full overflow-hidden">
                        <div className={cn('h-full rounded-full transition-all', r.color)} style={{ width: `${Math.min(r.value, 100)}%` }} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-5">
              <h2 className="text-xs font-bold uppercase tracking-widest text-brand-text flex items-center gap-2 mb-4">
                <Globe className="w-4 h-4 text-brand-primary" /> Integrations ({connectedIntegrations}/{totalIntegrations} connected)
              </h2>
              <div className="flex flex-wrap gap-2">
                {integrationStatus.length === 0 ? (
                  <p className="text-[10px] text-brand-text-muted font-mono">Waiting for integration data...</p>
                ) : (
                  integrationStatus.map(integration => (
                    <div key={integration.id} className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-full border text-[9px] font-mono font-bold',
                      integration.healthy
                        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                        : 'bg-red-500/10 text-red-400 border-red-500/20'
                    )}>
                      <span className={cn('w-1.5 h-1.5 rounded-full', integration.healthy ? 'bg-emerald-400' : 'bg-red-400')} />
                      {integration.platform}
                    </div>
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'security' && (
          <motion.div
            key="security"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.12 }}
            className="space-y-5"
          >
            <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-5">
              <h2 className="text-xs font-bold uppercase tracking-widest text-brand-text flex items-center gap-2 mb-4">
                <Shield className="w-4 h-4 text-brand-primary" /> Security Notes
              </h2>
              <div className="space-y-3">
                {[
                  { icon: Key, title: 'Master API Token', desc: 'Stored in browser session only. Rotated via backend .env file. Never exposed in network requests to third parties.' },
                  { icon: Shield, title: 'Service Credentials', desc: 'Gemini API keys, Facebook tokens, and GitHub tokens are managed server-side. They are never accessible from the frontend.' },
                  { icon: Terminal, title: 'Audit Trail', desc: 'All API mutations are logged to Supabase with correlation IDs. View in Audit Logs page for compliance.' },
                  { icon: Globe, title: 'CORS & Headers', desc: 'Security headers (nosniff, XSS protection, frame denial) applied to every response. CORS configured for allowed origins only.' },
                ].map((item, i) => (
                  <div key={i} className="flex items-start gap-3 p-3 bg-brand-elevated/20 border border-brand-border/30 rounded-xl">
                    <item.icon className="w-4 h-4 text-brand-primary flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs font-bold text-brand-text">{item.title}</p>
                      <p className="text-[10px] text-brand-text-muted font-mono leading-relaxed mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-4 flex items-start gap-3">
              <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
              <p className="text-xs text-amber-300/80 leading-relaxed font-mono">
                Connection parameters (WebSocket URL, REST endpoint, Master Token) are the only credentials stored in this browser. All other secrets remain on the server. Clear your browser storage to fully disconnect this admin console.
              </p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
