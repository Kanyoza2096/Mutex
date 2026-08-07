import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { 
  ShieldAlert, CheckCircle, Search, Filter, AlertTriangle, Shield, 
  ChevronDown, ExternalLink, RefreshCw, Bug, Clock, Activity,
  GitBranch, FileText, Zap
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

type Severity = 'ALL' | 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ComponentType<any> }> = {
  CRITICAL: { color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    icon: Bug },
  HIGH:     { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: AlertTriangle },
  MEDIUM:   { color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  icon: AlertTriangle },
  LOW:      { color: 'text-zinc-400',   bg: 'bg-zinc-500/10',   border: 'border-zinc-500/30',   icon: Activity },
};

const SkeletonRow = () => (
  <div className="p-5 flex items-start gap-4 animate-pulse border-b border-brand-border/30">
    <div className="w-8 h-8 bg-brand-elevated rounded-lg" />
    <div className="flex-1 space-y-2">
      <div className="h-4 w-3/4 bg-brand-elevated rounded" />
      <div className="h-3 w-1/3 bg-brand-elevated rounded" />
    </div>
    <div className="h-6 w-16 bg-brand-elevated rounded-full" />
  </div>
);

export default function Guardian() {
  const { restEndpoint, masterToken } = useStore();
  const headers: Record<string, string> = masterToken ? { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` } : {};
  const base = restEndpoint.replace(/\/+$/, '');

  const [filterSeverity, setFilterSeverity] = useState<Severity>('ALL');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [investigatingId, setInvestigatingId] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const { data: alerts = [], isLoading, refetch } = useQuery({
    queryKey: ['guardian-issues', restEndpoint, filterSeverity],
    queryFn: async () => {
      const res = await fetch(`${base}/guardian/issues${filterSeverity !== 'ALL' ? `?severity=${filterSeverity.toLowerCase()}` : ''}`, { headers });
      if (!res.ok) throw new Error('Failed');
      const d = await res.json();
      return d.issues || [];
    },
    enabled: !!restEndpoint,
    staleTime: 30_000,
    // Phase 4: 60s REST reconciliation; scan_complete Socket.IO event triggers an
    // immediate refetch via the invalidation below, so polling can be much less frequent.
    refetchInterval: 60_000,
  });

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await fetch(`${base}/guardian/scan`, { method: 'POST', headers });
      const d = await res.json();
      toast.success(d.message || 'Scan started');
      setTimeout(() => refetch(), 3000);
    } catch (err: any) {
      toast.error(err.message || 'Scan failed');
    } finally { setScanning(false); }
  };

  // Filtered + searched
  const filteredAlerts = useMemo(() => {
    if (!searchQuery.trim()) return alerts;
    const q = searchQuery.toLowerCase();
    return alerts.filter((a: any) => (a.title || '').toLowerCase().includes(q));
  }, [alerts, searchQuery]);

  // Stats
  const stats = useMemo(() => {
    const counts: Record<string, number> = { CRITICAL: 0, HIGH: 0, MEDIUM: 0, LOW: 0 };
    alerts.forEach((a: any) => { if (counts[a.severity] !== undefined) counts[a.severity]++; });
    return counts;
  }, [alerts]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-5xl mx-auto pb-24 space-y-5">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
            <Shield className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Code Guardian</h1>
            <p className="text-[10px] text-brand-text-muted font-mono uppercase tracking-wider mt-0.5">
              {alerts.length} issues · {stats.CRITICAL} critical · {stats.HIGH} high
            </p>
          </div>
        </div>
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
          onClick={handleScan} disabled={scanning}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-bold font-mono uppercase tracking-wider hover:bg-brand-primary/90 transition-all shadow-glow-primary disabled:opacity-50">
          {scanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
          {scanning ? 'Scanning…' : 'Run Scan'}
        </motion.button>
      </div>

      {/* Stats + Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex gap-2">
          {Object.entries(stats).map(([severity, count]) => {
            const config = SEVERITY_CONFIG[severity];
            if (count === 0 && severity !== 'CRITICAL') return null;
            return (
              <button key={severity} onClick={() => setFilterSeverity(severity as Severity)}
                className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono uppercase border transition-all',
                  filterSeverity === severity ? config.bg + ' ' + config.color + ' ' + config.border : 'bg-brand-surface border-brand-border/50 text-brand-text-muted hover:text-white')}>
                {severity} <span className="opacity-60">{count}</span>
              </button>
            );
          })}
          {filterSeverity !== 'ALL' && (
            <button onClick={() => setFilterSeverity('ALL')}
              className="px-2 py-1 rounded-full text-[9px] font-mono text-brand-primary hover:underline">Clear</button>
          )}
        </div>
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-text-muted" />
          <input type="text" placeholder="Search issues..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="pl-8 pr-3 py-2 bg-brand-surface border border-brand-border/50 rounded-xl text-xs text-brand-text placeholder-brand-text-muted font-mono focus:outline-none focus:border-brand-primary/50 w-48 transition-all" />
        </div>
      </div>

      {/* Issue List */}
      <div className="bg-brand-surface border border-brand-border/50 rounded-2xl overflow-hidden">
        {isLoading ? (
          <div className="divide-y divide-brand-border/30">
            {[1,2,3,4,5].map(i => <SkeletonRow key={i} />)}
          </div>
        ) : filteredAlerts.length === 0 ? (
          <div className="py-16 flex flex-col items-center justify-center text-brand-text-muted">
            <CheckCircle className="w-12 h-12 text-emerald-400 mb-4 opacity-50" />
            <p className="text-sm font-mono uppercase tracking-widest">No Issues Detected</p>
            <p className="text-xs text-brand-text-muted font-mono mt-1">All systems secure</p>
          </div>
        ) : (
          <div className="divide-y divide-brand-border/20">
            <AnimatePresence mode="wait">
              {filteredAlerts.map((alert: any) => {
                const config = SEVERITY_CONFIG[alert.severity] || SEVERITY_CONFIG.LOW;
                const Icon = config.icon;
                const isExpanded = investigatingId === alert.id;

                return (
                  <motion.div key={alert.id} layout
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className={cn('transition-colors', isExpanded && 'bg-brand-elevated/10')}>
                    
                    <div className="p-4 flex items-start gap-4 group">
                      <div className={cn('p-2 rounded-lg flex-shrink-0', config.bg)}>
                        <Icon className={cn('w-4 h-4', config.color)} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-white">{alert.title || 'Untitled Issue'}</h3>
                          <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase border', config.bg, config.color, config.border)}>
                            {alert.severity}
                          </span>
                        </div>
                        <div className="flex items-center gap-3 mt-1.5 text-[10px] font-mono text-brand-text-muted">
                          <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {new Date(alert.time).toLocaleString()}</span>
                          {alert.repo && <span className="flex items-center gap-1"><GitBranch className="w-3 h-3" /> {alert.repo}</span>}
                        </div>
                      </div>
                      <button onClick={() => setInvestigatingId(isExpanded ? null : alert.id)}
                        className={cn('px-3 py-1.5 rounded-lg text-[10px] font-bold font-mono uppercase transition-all flex items-center gap-1.5 flex-shrink-0',
                          isExpanded ? 'bg-brand-primary/20 text-brand-primary border border-brand-primary/30' : 'bg-brand-elevated border border-brand-border/50 text-brand-text-muted hover:text-white opacity-0 group-hover:opacity-100')}>
                        <ExternalLink className="w-3 h-3" /> {isExpanded ? 'Close' : 'Details'}
                      </button>
                    </div>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden">
                          <div className={cn('mx-4 mb-4 p-4 rounded-xl border font-mono text-xs', config.bg, config.border)}>
                            <p className="font-bold uppercase text-white mb-2">Incident Details</p>
                            <div className="space-y-1.5">
                              <div className="flex justify-between"><span className="text-brand-text-muted">Severity</span><span className={cn('font-bold', config.color)}>{alert.severity}</span></div>
                              <div className="flex justify-between"><span className="text-brand-text-muted">Detected</span><span className="text-white">{new Date(alert.time).toLocaleString()}</span></div>
                              {alert.repo && <div className="flex justify-between"><span className="text-brand-text-muted">Repository</span><span className="text-white">{alert.repo}</span></div>}
                              {alert.status && <div className="flex justify-between"><span className="text-brand-text-muted">Status</span><span className="text-white">{alert.status}</span></div>}
                            </div>
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          </div>
        )}
      </div>
    </motion.div>
  );
}
