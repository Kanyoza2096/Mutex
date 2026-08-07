import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { 
  ToggleLeft, AlertTriangle, ShieldOff, Unlock, RefreshCw, CheckCircle,
  Shield, Pause, Activity, Trash2, Wrench, Clock, Zap, History,
  Search, Filter, Layers
} from 'lucide-react';
import { cn, fetchWithTimeout } from '../lib/utils';
import { toast } from 'sonner';

function formatLabel(key: string) {
  return key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

const SKELETON_ROW = () => (
  <div className="flex items-center justify-between p-5 animate-pulse border-b border-brand-border/30">
    <div className="space-y-2"><div className="h-4 w-32 bg-brand-elevated rounded" /><div className="h-3 w-20 bg-brand-elevated rounded" /></div>
    <div className="h-6 w-12 bg-brand-elevated rounded-full" />
  </div>
);

export default function Features() {
  const { restEndpoint, masterToken } = useStore();
  const headers: Record<string, string> = masterToken ? { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` } : {};
  const base = restEndpoint.replace(/\/+$/, '');

  const [features, setFeatures] = useState<Record<string, boolean>>({});
  const [limits, setLimits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [rlLoading, setRlLoading] = useState(true);
  const [rlError, setRlError] = useState<string | null>(null);
  const [toggling, setToggling] = useState<string | null>(null);
  const [unblocking, setUnblocking] = useState<string | null>(null);
  const [toggleHistory, setToggleHistory] = useState<Array<{ feature: string; enabled: boolean; time: string }>>([]);
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [rateLimitPerUser, setRateLimitPerUser] = useState('30');
  const [rateWindow, setRateWindow] = useState('60');
  const [aiChatLimit, setAiChatLimit] = useState('20');
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [rlSearch, setRlSearch] = useState('');
  const [rlFilter, setRlFilter] = useState<'all' | 'blocked' | 'active'>('all');

  const fetchFeatures = async () => {
    if (!base) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${base}/features`, { headers });
      if (res.ok) { const d = await res.json(); setFeatures(d.features || {}); }
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  const fetchLimits = async () => {
    if (!base) { setRlLoading(false); return; }
    setRlLoading(true); setRlError(null);
    try {
      const res = await fetch(`${base}/rate-limits`, { headers });
      if (res.ok) {
        const d = await res.json();
        const list = d.rate_limits || [];
        setLimits(list);
        if (list.length > 0) {
          setRateLimitPerUser(String(list[0]?.limit || 30));
          setRateWindow(String(list[0]?.window || 60));
        }
      }
    } catch (err: any) { setRlError(err.message); }
    finally { setRlLoading(false); }
  };

  useEffect(() => { fetchFeatures(); fetchLimits(); }, [restEndpoint]);

  const handleToggle = async (key: string, enabled: boolean) => {
    setToggling(key);
    const newEnabled = !enabled;
    setFeatures(prev => ({ ...prev, [key]: newEnabled }));
    setToggleHistory(prev => [{ feature: formatLabel(key), enabled: newEnabled, time: new Date().toLocaleTimeString() }, ...prev].slice(0, 50));
    try {
      const res = await fetch(`${base}/features/toggle`, { method: 'POST', headers, body: JSON.stringify({ feature: key, enabled: newEnabled }) });
      if (res.ok) {
        toast.success(`${formatLabel(key)} ${newEnabled ? 'enabled' : 'disabled'}`);
      } else {
        setFeatures(prev => ({ ...prev, [key]: enabled }));
        toast.error('Toggle failed');
      }
    } catch {
      setFeatures(prev => ({ ...prev, [key]: enabled }));
      toast.error('Toggle failed');
    } finally { setToggling(null); }
  };

  const handleUnblock = async (identifier: string) => {
    setUnblocking(identifier);
    try {
      const res = await fetch(`${base}/rate-limits/unblock`, { method: 'POST', headers, body: JSON.stringify({ identifier }) });
      if (res.ok) { toast.success(`${identifier} unblocked`); fetchLimits(); }
      else toast.error('Unblock failed');
    } catch { toast.error('Unblock failed'); }
    finally { setUnblocking(null); }
  };

  const quickAction = async (path: string, label: string, method: 'GET' | 'POST' = 'POST') => {
    setActionLoading(label);
    try {
      const res = await fetch(`${base}${path}`, {
        method,
        headers: method === 'GET' ? { Authorization: headers.Authorization } : headers,
      });
      const d = await res.json().catch(() => ({}));
      toast[res.ok ? 'success' : 'error'](d.message || d.status || `${label} completed`);
    } catch (err: any) { toast.error(`${label} failed`); }
    finally { setActionLoading(null); }
  };

  const toggleMaintenanceMode = async () => {
    const next = !maintenanceMode;
    setMaintenanceMode(next); // optimistic
    try {
      const res = await fetch(`${base}/features/toggle`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ feature: 'maintenance_mode', enabled: next }),
      });
      if (res.ok) {
        toast.info(next ? 'Maintenance mode enabled — all posting paused' : 'Maintenance mode disabled');
      } else {
        setMaintenanceMode(!next); // revert
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || d.detail || 'Failed to update maintenance mode');
      }
    } catch (err: any) {
      setMaintenanceMode(!next); // revert
      toast.error(err.message || 'Failed to update maintenance mode');
    }
  };

  const saveRateConfig = async () => {
    try {
      const res = await fetch(`${base}/rate-limits/config`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({
          per_user: parseInt(rateLimitPerUser, 10),
          window_seconds: parseInt(rateWindow, 10),
          ai_chat_per_user: parseInt(aiChatLimit, 10),
        }),
      });
      if (res.ok) {
        toast.success('Rate config saved');
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || d.detail || 'Save failed — endpoint may not be supported');
      }
    } catch (err: any) {
      toast.error(err.message || 'Save failed');
    }
  };

  const entries = Object.entries(features);

  // Filtered rate limits
  const filteredLimits = useMemo(() => {
    let result = [...limits];
    if (rlSearch.trim()) {
      const q = rlSearch.toLowerCase();
      result = result.filter(l => (l.identifier || '').toLowerCase().includes(q));
    }
    if (rlFilter === 'blocked') result = result.filter(l => l.blocked);
    if (rlFilter === 'active') result = result.filter(l => !l.blocked);
    return result;
  }, [limits, rlSearch, rlFilter]);

  const blockedCount = limits.filter(l => l.blocked).length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-20">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
            <ToggleLeft className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Feature Toggles</h1>
            <p className="text-[10px] text-brand-text-muted font-mono uppercase tracking-wider mt-0.5">
              {entries.length} flags · {Object.values(features).filter(Boolean).length} enabled
            </p>
          </div>
        </div>
        <button onClick={fetchFeatures} className="p-2 rounded-xl bg-brand-surface border border-brand-border/50 hover:border-brand-primary/30 text-brand-text-muted hover:text-white transition-all">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Maintenance Mode */}
      <div className={cn(
        'rounded-2xl border p-5 transition-all',
        maintenanceMode ? 'bg-red-500/5 border-red-500/30 shadow-[0_0_30px_rgba(239,68,68,0.1)]' : 'bg-brand-surface border-brand-border/50'
      )}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className={cn('text-sm font-bold flex items-center gap-2', maintenanceMode ? 'text-red-400' : 'text-white')}>
              <Wrench className="w-4 h-4" /> Maintenance Mode
            </h3>
            <p className="text-[10px] text-brand-text-muted font-mono mt-1">
              Pauses all scheduled posts, auto-replies, and engagement
            </p>
          </div>
          <button onClick={toggleMaintenanceMode}
            className={cn('px-4 py-2 rounded-xl text-xs font-bold font-mono uppercase transition-all',
              maintenanceMode ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 'bg-brand-elevated border border-brand-border/50 text-brand-text-muted hover:border-amber-500/30')}>
            {maintenanceMode ? '⚠️ Disable' : 'Enable'}
          </button>
        </div>
      </div>

      {/* Feature Toggles */}
      {loading ? (
        <div className="bg-brand-surface border border-brand-border/50 rounded-2xl divide-y divide-brand-border/30">
          {[1,2,3,4,5].map(i => <SKELETON_ROW key={i} />)}
        </div>
      ) : error ? (
        <div className="py-12 text-center text-red-400 font-mono text-sm">Failed to load. <button onClick={fetchFeatures} className="text-brand-primary hover:underline">Retry</button></div>
      ) : (
        <div className="bg-brand-surface border border-brand-border/50 rounded-2xl divide-y divide-brand-border/30">
          {entries.map(([key, enabled], idx) => (
            <motion.div key={key} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: idx * 0.02 }}
              className="flex items-center justify-between p-4 hover:bg-brand-elevated/10 transition-colors group">
              <div>
                <h3 className="text-xs font-bold text-white">{formatLabel(key)}</h3>
                <code className="text-[9px] font-mono text-brand-text-muted">{key}</code>
              </div>
              <button onClick={() => handleToggle(key, enabled)}
                className={cn('relative w-11 h-5 rounded-full transition-colors flex-shrink-0', enabled ? 'bg-emerald-500' : 'bg-brand-elevated border border-brand-border')}>
                <motion.span layout className={cn('absolute top-0.5 w-4 h-4 rounded-full bg-white shadow flex items-center justify-center', enabled ? 'left-6' : 'left-0.5')}>
                  {toggling === key && <RefreshCw className="w-2.5 h-2.5 animate-spin text-brand-primary" />}
                </motion.span>
              </button>
            </motion.div>
          ))}
        </div>
      )}

      {/* Dependencies */}
      <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-4">
        <h3 className="text-[10px] font-mono font-bold uppercase text-brand-text-muted mb-2">Dependencies</h3>
        <div className="text-[10px] font-mono text-brand-text-muted space-y-1">
          <p>🔗 <span className="text-brand-primary">Auto Reply</span> → requires <span className="text-emerald-400">Auto Reply</span></p>
          <p>⚠️ Disabling <span className="text-red-400">Auto Post</span> pauses the <span className="text-amber-400">Scheduler</span></p>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {([
          { label: 'Security Scan', icon: Shield, path: '/guardian/scan', method: 'POST' as const, color: 'text-brand-primary' },
          { label: 'Pause All Posts', icon: Pause, path: '/workflow/pause', method: 'POST' as const, color: 'text-amber-400' },
          { label: 'Health Check', icon: Activity, path: '/health/deep', method: 'GET' as const, color: 'text-emerald-400' },
        ] as const).map(action => (
          <button key={action.label} onClick={() => quickAction(action.path, action.label, action.method)}
            disabled={actionLoading === action.label}
            className="bg-brand-surface border border-brand-border/50 rounded-xl p-4 text-center hover:border-brand-primary/30 transition-all disabled:opacity-50 group">
            {actionLoading === action.label ? <RefreshCw className="w-5 h-5 mx-auto mb-2 animate-spin text-brand-primary" /> : <action.icon className={cn('w-5 h-5 mx-auto mb-2 group-hover:scale-110 transition-transform', action.color)} />}
            <span className="text-[10px] font-mono font-bold uppercase text-brand-text-muted group-hover:text-white">{action.label}</span>
          </button>
        ))}
      </div>

      {/* Toggle History */}
      {toggleHistory.length > 0 && (
        <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-4">
          <h2 className="text-[10px] font-mono font-bold uppercase text-brand-text-muted flex items-center gap-2 mb-3">
            <History className="w-3.5 h-3.5" /> Recent Changes
          </h2>
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {toggleHistory.slice(0, 10).map((entry, i) => (
              <div key={i} className="flex items-center justify-between text-[10px] font-mono py-1.5 px-2 rounded hover:bg-brand-elevated/30">
                <span className="text-white">{entry.feature}</span>
                <span className={cn('px-1.5 py-0.5 rounded text-[8px] font-bold uppercase', entry.enabled ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>
                  {entry.enabled ? 'On' : 'Off'}
                </span>
                <span className="text-brand-text-muted">{entry.time}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Rate Limits Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-brand-border/30">
        <div>
          <h2 className="text-lg font-bold text-white flex items-center gap-2">
            <ShieldOff className="w-5 h-5 text-amber-400" /> Rate Limits
            {blockedCount > 0 && <span className="px-2 py-0.5 bg-red-500/10 text-red-400 text-[10px] font-bold rounded-full border border-red-500/30">{blockedCount} blocked</span>}
          </h2>
        </div>
        <button onClick={fetchLimits} className="p-2 rounded-lg hover:bg-brand-elevated text-brand-text-muted">
          <RefreshCw className={cn('w-4 h-4', rlLoading && 'animate-spin')} />
        </button>
      </div>

      {/* Rate Config */}
      <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-4">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[
            { label: 'Per User (req/min)', value: rateLimitPerUser, set: setRateLimitPerUser },
            { label: 'Window (seconds)', value: rateWindow, set: setRateWindow },
            { label: 'AI Chat (req/min)', value: aiChatLimit, set: setAiChatLimit },
          ].map(field => (
            <div key={field.label}>
              <label className="text-[9px] font-mono uppercase text-brand-text-muted">{field.label}</label>
              <input type="number" value={field.value} onChange={e => field.set(e.target.value)}
                className="w-full bg-brand-elevated border border-brand-border/50 rounded-lg px-3 py-2 text-sm text-brand-text mt-1 focus:outline-none focus:border-brand-primary/50" />
            </div>
          ))}
          <div className="flex items-end">
            <button onClick={saveRateConfig}
              className="w-full py-2.5 rounded-lg bg-brand-primary text-white text-xs font-bold font-mono uppercase hover:bg-brand-primary/90 transition-all">Save</button>
          </div>
        </div>
      </div>

      {/* Rate Limits Table */}
      <div className="bg-brand-surface border border-brand-border/50 rounded-2xl overflow-hidden">
        <div className="flex items-center gap-2 px-4 py-3 border-b border-brand-border/30 bg-brand-elevated/10">
          <Search className="w-3.5 h-3.5 text-brand-text-muted" />
          <input type="text" placeholder="Search identifiers..." value={rlSearch}
            onChange={e => setRlSearch(e.target.value)}
            className="flex-1 bg-transparent text-xs text-brand-text font-mono focus:outline-none" />
          <select value={rlFilter} onChange={e => setRlFilter(e.target.value as any)}
            className="bg-brand-elevated border border-brand-border/50 rounded-lg px-2 py-1 text-[10px] font-mono text-brand-text">
            <option value="all">All</option><option value="blocked">Blocked</option><option value="active">Active</option>
          </select>
        </div>
        {rlLoading ? (
          <div className="divide-y divide-brand-border/30">{[1,2,3].map(i => <SKELETON_ROW key={i} />)}</div>
        ) : rlError ? (
          <div className="py-10 text-center text-red-400 font-mono text-sm">Failed to load</div>
        ) : filteredLimits.length === 0 ? (
          <div className="py-10 text-center text-brand-text-muted font-mono text-xs">No entries</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead><tr className="border-b border-brand-border/30 text-[9px] font-mono font-bold text-brand-text-muted uppercase tracking-widest">
                <th className="py-2.5 px-4">Identifier</th><th className="py-2.5 px-4">Remaining</th><th className="py-2.5 px-4">Status</th><th className="py-2.5 px-4"></th>
              </tr></thead>
              <tbody className="divide-y divide-brand-border/20">
                {filteredLimits.map((l, i) => (
                  <tr key={l.id ?? i} className="hover:bg-brand-elevated/10 transition-colors">
                    <td className="py-2.5 px-4 text-[10px] font-mono text-white">{l.identifier || '—'}</td>
                    <td className="py-2.5 px-4 text-[10px] font-mono">
                      <span className={l.remaining === 0 ? 'text-red-400 font-bold' : 'text-brand-text'}>{l.remaining ?? '—'} / {l.limit ?? '—'}</span>
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase border',
                        l.blocked ? 'bg-red-500/10 text-red-400 border-red-500/30' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30')}>
                        {l.blocked ? 'Blocked' : 'Active'}
                      </span>
                    </td>
                    <td className="py-2.5 px-4">
                      {l.blocked && (
                        <button onClick={() => handleUnblock(String(l.identifier ?? l.id))} disabled={unblocking === String(l.identifier ?? l.id)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold font-mono hover:bg-emerald-500/20 transition-all disabled:opacity-50">
                          {unblocking === String(l.identifier ?? l.id) ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Unlock className="w-3 h-3" />} Unblock
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </motion.div>
  );
}
