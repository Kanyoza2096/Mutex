import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import {
  fetchStats, fetchHealth, fetchRecentLogs, fetchGuardianIssues,
  LogEntry, StatsPayload, HealthDeepPayload, GuardianIssue,
} from '../lib/api';
import {
  AlertTriangle, AlertCircle, CheckCircle, Clock, Activity,
  MoreHorizontal, Filter, RefreshCw, ChevronDown, Eye,
  Wifi, WifiOff, Layers, Shield, FileText, Search
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

type IncidentSeverity = 'critical' | 'high' | 'warning' | 'info';

interface Incident {
  id: string; title: string; description: string;
  severity: IncidentSeverity;
  status: 'open' | 'acknowledged' | 'resolved' | 'closed';
  startedAt: string; acknowledgedAt?: string; resolvedAt?: string;
  affectedServices: string[]; evidence: { type: string; value: string; id?: string }[];
  tags: string[];
}

const SEVERITY_CONFIG: Record<IncidentSeverity, { color: string; bg: string; border: string; icon: React.ComponentType<any>; label: string }> = {
  critical: { color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/30',    icon: AlertCircle,  label: 'Critical' },
  high:     { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: AlertCircle,  label: 'High' },
  warning:  { color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  icon: AlertTriangle, label: 'Warning' },
  info:     { color: 'text-sky-400',    bg: 'bg-sky-500/10',    border: 'border-sky-500/30',    icon: Activity,      label: 'Info' },
};

const STATUS_CONFIG: Record<Incident['status'], string> = {
  open:          'bg-red-500/10 text-red-400 border-red-500/30',
  acknowledged:  'bg-amber-500/10 text-amber-400 border-amber-500/30',
  resolved:      'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
  closed:        'bg-zinc-500/10 text-zinc-400 border-zinc-500/30',
};

export default function IncidentCenter() {
  const { restEndpoint, masterToken } = useStore();
  const [filterSeverity, setFilterSeverity] = useState<IncidentSeverity | ''>('');
  const [filterStatus, setFilterStatus] = useState<Incident['status'] | ''>('');
  const [expandedIncident, setExpandedIncident] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['incident-center', restEndpoint, masterToken],
    queryFn: async () => {
      const [s, h, l, gi] = await Promise.all([
        fetchStats({ restEndpoint, masterToken }).catch(() => null),
        fetchHealth({ restEndpoint, masterToken }).catch(() => null),
        fetchRecentLogs({ restEndpoint, masterToken }, { limit: 50, level: 'ERROR' }).catch(() => ({ logs: [] })),
        fetchGuardianIssues({ restEndpoint, masterToken }).catch(() => ({ issues: [] })),
      ]);
      return { stats: s, health: h, logs: l.logs || [], issues: gi.issues || [] };
    },
    enabled: !!restEndpoint && !!masterToken,
    refetchInterval: 15000,
  });

  const health = data?.health;
  const logs = data?.logs || [];
  const guardianIssues = data?.issues || [];

  // Generate incidents from real data
  const incidents: Incident[] = useMemo(() => {
    const result: Incident[] = [];

    // From health checks
    if (health?.services) {
      for (const [name, svc] of Object.entries(health.services) as [string, any][]) {
        if (svc.status === 'error' || svc.status === 'degraded') {
          result.push({
            id: `health-${name}`,
            title: `${name} Service ${svc.status === 'error' ? 'Unavailable' : 'Degraded'}`,
            description: `The ${name} service is currently ${svc.status === 'error' ? 'unavailable' : 'experiencing degraded performance'}.`,
            severity: svc.status === 'error' ? 'critical' : 'warning',
            status: 'open',
            startedAt: new Date().toISOString(),
            affectedServices: [name],
            evidence: [{ type: 'health', value: JSON.stringify(svc) }],
            tags: [svc.status === 'error' ? 'service-down' : 'service-degraded'],
          });
        }
      }
    }

    // From Guardian
    for (const issue of guardianIssues) {
      result.push({
        id: `guardian-${issue.id}`,
        title: issue.title || 'Security Issue',
        description: 'Guardian detected a potential security vulnerability.',
        severity: (issue.severity === 'critical' || issue.severity === 'high') ? 'critical' : (issue.severity === 'medium' ? 'warning' : 'info'),
        status: 'open',
        startedAt: new Date().toISOString(),
        affectedServices: [],
        evidence: [{ type: 'guardian', value: JSON.stringify(issue) }],
        tags: ['security', `severity-${issue.severity}`],
      });
    }

    // From error logs (top 3)
    logs.slice(0, 3).forEach((log, idx) => {
      result.push({
        id: `log-${idx}`,
        title: log.message.length > 80 ? `${log.message.slice(0, 80)}...` : log.message,
        description: `${log.level} from ${log.module} at ${new Date(log.timestamp).toLocaleTimeString()}`,
        severity: log.level === 'CRITICAL' ? 'critical' : 'warning',
        status: 'open',
        startedAt: log.timestamp,
        affectedServices: [log.module],
        evidence: [{ type: 'log', value: log.message, id: log.timestamp }],
        tags: ['error-log', log.level.toLowerCase()],
      });
    });

    // All clear fallback
    if (result.length === 0) {
      result.push({
        id: 'all-clear',
        title: 'All Systems Operational',
        description: 'No incidents detected. All services are healthy.',
        severity: 'info',
        status: 'resolved',
        startedAt: new Date().toISOString(),
        resolvedAt: new Date().toISOString(),
        affectedServices: [],
        evidence: [],
        tags: ['all-clear'],
      });
    }

    return result.sort((a, b) => {
      const order = { critical: 0, high: 1, warning: 2, info: 3 };
      return (order[a.severity] || 0) - (order[b.severity] || 0);
    });
  }, [health, guardianIssues, logs]);

  // Filters
  const filteredIncidents = useMemo(() => {
    let result = [...incidents];
    if (filterSeverity) result = result.filter(i => i.severity === filterSeverity);
    if (filterStatus) result = result.filter(i => i.status === filterStatus);
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i => i.title.toLowerCase().includes(q) || i.description.toLowerCase().includes(q) || i.affectedServices.some(s => s.toLowerCase().includes(q)));
    }
    return result;
  }, [incidents, filterSeverity, filterStatus, searchQuery]);

  // Stats
  const statsSummary = useMemo(() => {
    const counts: Record<IncidentSeverity, number> = { critical: 0, high: 0, warning: 0, info: 0 };
    incidents.forEach(i => { if (i.status !== 'resolved' && i.status !== 'closed') counts[i.severity]++; });
    return counts;
  }, [incidents]);

  const openCount = incidents.filter(i => i.status === 'open').length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full gap-4 p-4">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
            <AlertTriangle className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Incident Center</h1>
            <p className="text-[10px] text-brand-text-muted font-mono uppercase tracking-wider mt-0.5">
              {incidents.length} incidents · {openCount} open
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-text-muted" />
            <input type="text" placeholder="Search..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-2 bg-brand-surface border border-brand-border/50 rounded-xl text-xs text-brand-text placeholder-brand-text-muted font-mono focus:outline-none focus:border-brand-primary/50 w-40 transition-all" />
          </div>
          <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value as any)}
            className="bg-brand-surface border border-brand-border/50 rounded-xl px-2.5 py-2 text-xs text-brand-text font-mono focus:outline-none focus:border-brand-primary/50">
            <option value="">All Severities</option>
            {Object.entries(SEVERITY_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={filterStatus} onChange={e => setFilterStatus(e.target.value as any)}
            className="bg-brand-surface border border-brand-border/50 rounded-xl px-2.5 py-2 text-xs text-brand-text font-mono focus:outline-none focus:border-brand-primary/50">
            <option value="">All Statuses</option>
            <option value="open">Open</option>
            <option value="acknowledged">Acknowledged</option>
            <option value="resolved">Resolved</option>
          </select>
          <button onClick={() => refetch()} className="p-2 rounded-lg hover:bg-brand-elevated text-brand-text-muted transition-all">
            <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0">
        {Object.entries(statsSummary).map(([severity, count]) => {
          const config = SEVERITY_CONFIG[severity as IncidentSeverity];
          const Icon = config.icon;
          const isAllClear = severity === 'info' && count > 0 && statsSummary.critical === 0;
          return (
            <div key={severity} className={cn('rounded-xl border p-4', config.bg, config.border)}>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted">{config.label}</span>
                <Icon className={cn('w-4 h-4', config.color)} />
              </div>
              <div className={cn('text-2xl font-mono font-bold', config.color)}>{count}</div>
              {severity === 'critical' && count > 0 && (
                <p className="text-[9px] text-red-400/80 font-mono mt-1">Needs immediate action</p>
              )}
              {isAllClear && <p className="text-[9px] text-emerald-400/80 font-mono mt-1">All systems go</p>}
            </div>
          );
        })}
      </div>

      {/* Incident List */}
      <div className="flex-1 bg-brand-surface border border-brand-border/50 rounded-2xl overflow-hidden flex flex-col min-h-0">
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-brand-text-muted animate-spin" />
          </div>
        ) : filteredIncidents.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-brand-text-muted gap-2">
            <Shield className="w-10 h-10 opacity-30" />
            <span className="text-xs font-mono uppercase">No incidents match your filters</span>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto">
            <AnimatePresence mode="wait">
              {filteredIncidents.map((incident) => {
                const sevConfig = SEVERITY_CONFIG[incident.severity];
                const SevIcon = sevConfig.icon;
                const isExpanded = expandedIncident === incident.id;

                return (
                  <motion.div key={incident.id} layout
                    initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                    className={cn('border-b border-brand-border/20 last:border-0', isExpanded && 'bg-brand-elevated/10')}>
                    
                    <button
                      onClick={() => setExpandedIncident(isExpanded ? null : incident.id)}
                      className="w-full text-left p-4 flex items-start gap-4 hover:bg-brand-elevated/20 transition-colors group">
                      
                      {/* Severity badge */}
                      <span className={cn('flex items-center gap-2 px-2.5 py-1.5 rounded-lg border text-[10px] font-bold font-mono uppercase flex-shrink-0',
                        sevConfig.bg, sevConfig.color, sevConfig.border)}>
                        <SevIcon className="w-3.5 h-3.5" /> {sevConfig.label}
                      </span>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="text-sm font-bold text-white truncate">{incident.title}</h3>
                          <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase border', STATUS_CONFIG[incident.status])}>
                            {incident.status}
                          </span>
                        </div>
                        <p className="text-xs text-brand-text-muted mt-1 line-clamp-2">{incident.description}</p>
                        
                        {/* Affected services */}
                        {incident.affectedServices.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mt-2">
                            {incident.affectedServices.map(svc => (
                              <span key={svc} className="px-2 py-0.5 rounded-full text-[9px] font-mono bg-brand-elevated border border-brand-border/30 text-brand-text-muted">
                                {svc}
                              </span>
                            ))}
                          </div>
                        )}

                        {/* Timestamps */}
                        <div className="flex items-center gap-4 mt-2 text-[9px] font-mono text-brand-text-muted">
                          <span>Started: {new Date(incident.startedAt).toLocaleString()}</span>
                          {incident.resolvedAt && <span className="text-emerald-400">Resolved: {new Date(incident.resolvedAt).toLocaleString()}</span>}
                        </div>
                      </div>

                      <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} className="flex-shrink-0 mt-1">
                        <ChevronDown className="w-4 h-4 text-brand-text-muted group-hover:text-white transition-colors" />
                      </motion.div>
                    </button>

                    {/* Expanded evidence */}
                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                          className="overflow-hidden">
                          <div className="px-4 pb-4 ml-[88px] space-y-2">
                            {incident.evidence.map((ev, i) => (
                              <div key={i} className="bg-brand-bg/50 border border-brand-border/30 rounded-xl p-3">
                                <span className="text-[9px] font-mono font-bold uppercase text-brand-text-muted">{ev.type}</span>
                                <p className="text-[10px] font-mono text-brand-text mt-1 break-all">{ev.value}</p>
                              </div>
                            ))}
                            {incident.evidence.length === 0 && (
                              <p className="text-[10px] text-brand-text-muted font-mono">No evidence attached.</p>
                            )}
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
