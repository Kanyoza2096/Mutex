import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { 
  Database, Key, Activity, Shield, Copy, Check, RefreshCw, AlertTriangle, 
  XCircle, Zap, TrendingUp, Clock, Eye, EyeOff, Trash2
} from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

const SKELETON_CARD = () => (
  <div className="bg-brand-surface/50 border border-brand-border/50 rounded-2xl p-5 animate-pulse space-y-3">
    <div className="flex items-center gap-3"><div className="w-10 h-10 bg-brand-elevated rounded-xl" /><div className="h-3 w-24 bg-brand-elevated rounded" /></div>
    <div className="h-8 w-20 bg-brand-elevated rounded" />
    <div className="h-3 w-28 bg-brand-elevated rounded" />
  </div>
);

export default function ApiAnalytics() {
  const { restEndpoint, masterToken, stats, latencyHistory } = useStore();
  const headers: Record<string, string> = masterToken ? { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` } : {};
  const base = restEndpoint.replace(/\/+$/, '');

  const [generatedKey, setGeneratedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [keyLabel, setKeyLabel] = useState('');
  const [storedKeys, setStoredKeys] = useState<any[]>([]);
  const [generating, setGenerating] = useState(false);
  const [loading, setLoading] = useState(true);

  const fetchKeys = async () => {
    try {
      const res = await fetch(`${base}/keys`, { headers });
      if (res.ok) { const d = await res.json(); setStoredKeys(d.keys || []); }
    } catch {} finally { setLoading(false); }
  };

  useEffect(() => { fetchKeys(); }, [restEndpoint]);

  const avgLatency = latencyHistory.length > 0
    ? Math.round(latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length) : null;
  // Phase 5: P99 cannot be computed client-side accurately; only show observed max as "peak"
  const peakLatency = latencyHistory.length > 0
    ? Math.round(Math.max(...latencyHistory.slice(-20))) : null;

  const handleGenerateKey = async () => {
    setGenerating(true);
    try {
      const res = await fetch(`${base}/keys/generate`, {
        method: 'POST', headers,
        body: JSON.stringify({ label: keyLabel || 'api-key' }),
      });
      if (res.ok) {
        const d = await res.json();
        setGeneratedKey(d.token || d.key);
        setShowKey(true);
        fetchKeys();
        toast.success('API key generated');
      } else {
        const d = await res.json();
        toast.error(d.error || 'Generation failed');
      }
    } catch (err: any) { toast.error(err.message || 'Generation failed'); }
    finally { setGenerating(false); }
  };

  const handleRevoke = async (keyId: string) => {
    try {
      const res = await fetch(`${base}/keys/${keyId}`, { method: 'DELETE', headers });
      if (res.ok) { toast.success('Key revoked'); fetchKeys(); }
      else toast.error('Revoke failed');
    } catch { toast.error('Revoke failed'); }
  };

  const copyKey = () => {
    if (!generatedKey) return;
    navigator.clipboard.writeText(generatedKey).then(() => toast.success('Key copied'));
  };

  // Phase 5: No historical data is available from the backend — only today's live count.
  // Show the real today value; mark prior days as null so the chart is honest.
  const chartData = useMemo(() => {
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    const today = new Date().getDay();
    return Array.from({ length: 7 }, (_, i) => ({
      name: dayNames[(today - 6 + i + 7) % 7],
      // Only today (i === 6) has a real value; prior days have no data
      calls: i === 6 ? (stats?.apiCalls ?? 0) : null,
    }));
  }, [stats?.apiCalls]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 max-w-7xl mx-auto pb-20">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
            <Activity className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">API Analytics</h1>
            <p className="text-[10px] text-brand-text-muted font-mono uppercase tracking-wider mt-0.5">
              {stats?.apiCalls?.toLocaleString() || 0} calls · {avgLatency ? `${avgLatency}ms avg` : 'Measuring…'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <input type="text" placeholder="Key label..." value={keyLabel} onChange={e => setKeyLabel(e.target.value)}
            className="px-3 py-2 bg-brand-surface border border-brand-border/50 rounded-xl text-xs text-brand-text focus:outline-none focus:border-brand-primary/50 w-32 transition-all" />
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={handleGenerateKey} disabled={generating}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold font-mono uppercase tracking-wider hover:bg-brand-primary/90 transition-all shadow-glow-primary disabled:opacity-50">
            {generating ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Key className="w-4 h-4" />} Generate
          </motion.button>
        </div>
      </div>

      {/* Generated Key Banner */}
      <AnimatePresence>
        {generatedKey && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="overflow-hidden">
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-mono font-bold uppercase text-emerald-400 flex items-center gap-2">
                  <Key className="w-3.5 h-3.5" /> New API Key
                </span>
                <button onClick={() => setGeneratedKey(null)} className="text-brand-text-muted hover:text-white text-xs">✕</button>
              </div>
              <div className="flex items-center gap-2">
                <code className="flex-1 bg-brand-bg border border-brand-border/30 rounded-lg px-3 py-2 text-xs font-mono text-emerald-400 truncate">
                  {showKey ? generatedKey : '••••••••••••••••••••••••••'}
                </code>
                <button onClick={() => setShowKey(!showKey)} className="p-2 rounded-lg hover:bg-brand-elevated text-brand-text-muted">
                  {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
                <button onClick={copyKey} className="p-2 rounded-lg hover:bg-brand-elevated text-brand-text-muted">
                  <Copy className="w-4 h-4" />
                </button>
              </div>
              <p className="text-[9px] text-brand-text-muted font-mono">Store securely — not shown again after dismissal.</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">{[1,2,3,4].map(i => <SKELETON_CARD key={i} />)}</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {[
            { label: 'API Calls Today', value: (stats?.apiCalls || 0).toLocaleString(), icon: Zap, color: 'text-brand-primary' },
            { label: 'Avg Latency', value: avgLatency ? `${avgLatency}ms` : '—', icon: Clock, color: 'text-violet-400' },
            { label: 'Peak Latency', value: peakLatency ? `${peakLatency}ms` : '—', icon: TrendingUp, color: 'text-amber-400' },
            { label: 'Active Keys', value: storedKeys.length, icon: Shield, color: 'text-emerald-400' },
          ].map(stat => (
            <div key={stat.label} className="bg-brand-surface/50 border border-brand-border/50 rounded-2xl p-4 hover:border-brand-border transition-colors">
              <div className="flex items-center justify-between mb-2">
                <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-brand-text-muted">{stat.label}</span>
                <stat.icon className={cn('w-4 h-4', stat.color)} />
              </div>
              <div className={cn('text-xl font-mono font-bold', stat.color)}>{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      {/* Chart */}
      <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-5">
        <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted mb-4 flex items-center gap-2">
          <Activity className="w-3.5 h-3.5 text-brand-primary" /> Usage Volume (Today · Historical data not available)
        </h2>
        <div className="h-[280px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="apiGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#27272a" vertical={false} />
              <XAxis dataKey="name" stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="#52525b" fontSize={11} tickLine={false} axisLine={false} tickFormatter={v => v.toLocaleString()} />
              <Tooltip contentStyle={{ backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px', fontSize: '12px' }} formatter={(v) => [Number(v).toLocaleString(), 'Calls']} />
              <Area type="monotone" dataKey="calls" stroke="#818cf8" strokeWidth={2} fill="url(#apiGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Active Keys */}
      {storedKeys.length > 0 && (
        <div className="bg-brand-surface border border-brand-border/50 rounded-2xl overflow-hidden">
          <div className="px-5 py-3 border-b border-brand-border/30 bg-brand-elevated/10">
            <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted flex items-center gap-2">
              <Key className="w-3.5 h-3.5 text-brand-primary" /> Active Keys
            </h2>
          </div>
          <div className="divide-y divide-brand-border/20">
            {storedKeys.map((k, i) => (
              <div key={k.id || i} className="flex items-center justify-between px-5 py-3 hover:bg-brand-elevated/10 transition-colors group">
                <div className="min-w-0">
                  <code className="text-xs font-mono text-white">{k.prefix || '****'}</code>
                  <span className="text-[10px] text-brand-text-muted font-mono ml-2">{k.label || ''}</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] text-brand-text-muted font-mono hidden sm:block">
                    {k.created_at ? new Date(k.created_at).toLocaleDateString() : ''}
                  </span>
                  <button onClick={() => handleRevoke(k.id)}
                    className="text-[9px] font-bold font-mono uppercase text-brand-text-muted hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all">
                    Revoke
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
