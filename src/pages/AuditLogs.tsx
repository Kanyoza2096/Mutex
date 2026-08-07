import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { 
  FileClock, Search, RefreshCw, AlertTriangle, CheckCircle, XCircle,
  Filter, Copy, Eye, ChevronDown, Clock, User, Tag, Hash
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface AuditLogEntry {
  id: string | number; action?: string; user?: string; resource?: string;
  status?: string; created_at?: string; timestamp?: string; detail?: string;
}

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ComponentType<any> }> = {
  success: { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle },
  failed:  { color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20',    icon: XCircle },
  error:   { color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20',    icon: XCircle },
};

const SKELETON_ROW = () => (
  <div className="flex items-center gap-4 px-4 py-3 border-b border-brand-border/20 animate-pulse">
    <div className="w-32 h-3 bg-brand-elevated rounded" />
    <div className="w-20 h-3 bg-brand-elevated rounded" />
    <div className="w-24 h-3 bg-brand-elevated rounded" />
    <div className="w-36 h-3 bg-brand-elevated rounded" />
    <div className="w-16 h-5 bg-brand-elevated rounded-full" />
  </div>
);

export default function AuditLogs() {
  const { restEndpoint, masterToken } = useStore();
  const headers: Record<string, string> = masterToken ? { Authorization: `Bearer ${masterToken}` } : {};
  const base = restEndpoint.replace(/\/+$/, '');

  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [expandedRow, setExpandedRow] = useState<string | number | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);

  const fetchLogs = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${base}/audit-logs?limit=200`, { headers });
      if (res.ok) { const d = await res.json(); setLogs(d.logs || []); }
      else throw new Error('Failed to fetch');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [restEndpoint]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  // Auto-refresh
  useEffect(() => {
    if (!autoRefresh) return;
    // Phase 4: 60s reconciliation; audit logs change infrequently
    const id = setInterval(fetchLogs, 60_000);
    return () => clearInterval(id);
  }, [autoRefresh, fetchLogs]);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    let result = [...logs];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(l => 
        (l.action || '').toLowerCase().includes(q) ||
        (l.user || '').toLowerCase().includes(q) ||
        (l.resource || '').toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'all') result = result.filter(l => l.status === statusFilter);
    return result;
  }, [logs, searchQuery, statusFilter]);

  // Stats
  const stats = useMemo(() => ({
    total: logs.length,
    success: logs.filter(l => l.status === 'success').length,
    failed: logs.filter(l => l.status === 'failed' || l.status === 'error').length,
  }), [logs]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-20">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
            <FileClock className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Audit Logs</h1>
            <p className="text-[10px] text-brand-text-muted font-mono uppercase tracking-wider mt-0.5">
              {stats.total} entries · {stats.success} success · {stats.failed} failed
              {autoRefresh && <span className="text-emerald-400 ml-2">● Live</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setAutoRefresh(!autoRefresh)}
            className={cn('px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition-all',
              autoRefresh ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20' : 'bg-zinc-500/10 text-zinc-400 border border-zinc-500/20')}>
            {autoRefresh ? 'Live' : 'Manual'}
          </button>
          <button onClick={fetchLogs} className="p-2 rounded-lg hover:bg-brand-elevated text-brand-text-muted transition-all">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-md">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
          <input type="text" placeholder="Search by action, user, resource..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-brand-surface border border-brand-border/50 rounded-xl text-xs text-brand-text placeholder-brand-text-muted font-mono focus:outline-none focus:border-brand-primary/50 transition-all" />
        </div>
        <div className="flex gap-1 p-1 bg-brand-surface border border-brand-border/50 rounded-xl">
          {['all', 'success', 'failed'].map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={cn('px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition-all',
                statusFilter === s ? 'bg-brand-primary text-white' : 'text-brand-text-muted hover:text-white')}>
              {s}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <div className="bg-brand-surface border border-brand-border/50 rounded-2xl overflow-hidden">
        {loading && logs.length === 0 ? (
          <div className="divide-y divide-brand-border/20">{[1,2,3,4,5,6].map(i => <SKELETON_ROW key={i} />)}</div>
        ) : error ? (
          <div className="py-12 text-center text-red-400 font-mono text-sm flex flex-col items-center gap-2">
            <XCircle className="w-5 h-5" /> Failed to load.
            <button onClick={fetchLogs} className="text-brand-primary hover:underline text-xs">Retry</button>
          </div>
        ) : filteredLogs.length === 0 ? (
          <div className="py-16 text-center text-brand-text-muted font-mono text-xs">
            {searchQuery || statusFilter !== 'all' ? 'No logs match your filters.' : 'No audit events recorded.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-brand-border/30 bg-brand-elevated/10 text-[9px] font-mono font-bold text-brand-text-muted uppercase tracking-widest">
                  <th className="py-2.5 px-4 text-left">Time</th>
                  <th className="py-2.5 px-4 text-left hidden sm:table-cell">User</th>
                  <th className="py-2.5 px-4 text-left">Action</th>
                  <th className="py-2.5 px-4 text-left hidden lg:table-cell">Resource</th>
                  <th className="py-2.5 px-4 text-left">Status</th>
                  <th className="py-2.5 px-4 w-10"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-brand-border/20">
                <AnimatePresence mode="wait">
                  {filteredLogs.map((log, idx) => {
                    const config = STATUS_CONFIG[log.status || ''] || { color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20', icon: Clock };
                    const StatusIcon = config.icon;
                    const isExpanded = expandedRow === log.id;

                    return (
                      <motion.tr key={log.id} layout
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                        className={cn('hover:bg-brand-elevated/10 transition-colors group', isExpanded && 'bg-brand-elevated/10')}>
                        
                        <td className="py-2.5 px-4 text-[10px] font-mono text-brand-text-muted whitespace-nowrap tabular-nums">
                          {(log.created_at || log.timestamp || '').substring(0, 19) || '—'}
                        </td>
                        <td className="py-2.5 px-4 hidden sm:table-cell">
                          <span className="text-[10px] font-mono text-white flex items-center gap-1.5">
                            <User className="w-3 h-3 text-brand-text-muted" /> {log.user || 'system'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className="text-[10px] font-bold text-white">{log.action || '—'}</span>
                        </td>
                        <td className="py-2.5 px-4 hidden lg:table-cell">
                          <span className="text-[10px] font-mono text-brand-text-muted truncate max-w-[250px] block">{log.resource || '—'}</span>
                        </td>
                        <td className="py-2.5 px-4">
                          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase border', config.bg, config.color, config.border)}>
                            <StatusIcon className="w-2.5 h-2.5" /> {log.status || 'unknown'}
                          </span>
                        </td>
                        <td className="py-2.5 px-4">
                          <button onClick={() => setExpandedRow(isExpanded ? null : log.id)}
                            className="p-1 rounded opacity-0 group-hover:opacity-100 text-brand-text-muted hover:text-white transition-all">
                            <ChevronDown className={cn('w-3.5 h-3.5 transition-transform', isExpanded && 'rotate-180')} />
                          </button>
                        </td>
                      </motion.tr>
                    );
                  })}
                </AnimatePresence>
              </tbody>
            </table>

            {/* Expanded detail */}
            <AnimatePresence>
              {expandedRow && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden border-t border-brand-border/30 bg-brand-elevated/5">
                  <div className="px-4 py-3 ml-8">
                    {(() => {
                      const log = logs.find(l => l.id === expandedRow);
                      if (!log) return null;
                      return (
                        <div className="space-y-2 text-[10px] font-mono">
                          <div className="flex gap-4">
                            <span className="text-brand-text-muted">Action:</span>
                            <span className="text-white font-bold">{log.action || '—'}</span>
                          </div>
                          <div className="flex gap-4">
                            <span className="text-brand-text-muted">User:</span>
                            <span className="text-white">{log.user || 'system'}</span>
                          </div>
                          <div className="flex gap-4">
                            <span className="text-brand-text-muted">Resource:</span>
                            <span className="text-white">{log.resource || '—'}</span>
                          </div>
                          {log.detail && (
                            <div className="flex gap-4">
                              <span className="text-brand-text-muted">Detail:</span>
                              <span className="text-white">{log.detail}</span>
                            </div>
                          )}
                        </div>
                      );
                    })()}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}
