import React, { useMemo, useState } from 'react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import {
  Activity, AlertTriangle, ArrowUpRight, Clock3, Database,
  FileWarning, Network, Server, TerminalSquare, Workflow,
  RefreshCw, Zap, Eye, ExternalLink, ChevronRight, Copy,
  CheckCircle2, XCircle, Hourglass, TrendingUp, TrendingDown,
  Gauge, History
} from 'lucide-react';
import { useStore } from '../store/useStore';
import {
  fetchHealth, fetchRecentLogs, fetchSystemHealth, fetchWorkflowHistory,
  type LogEntry, type ServiceHealthEntry, type WorkflowHistoryEntry,
} from '../lib/api';
import { cn } from '../lib/utils';
import { getServiceCatalogEntry, resolveServiceId } from '../lib/serviceCatalog';
import { toast } from 'sonner';

// ── Helpers ────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ComponentType<any>; label: string }> = {
  online:   { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: CheckCircle2, label: 'Online' },
  degraded: { color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20',   icon: AlertTriangle, label: 'Degraded' },
  offline:  { color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/20',     icon: XCircle,       label: 'Offline' },
  unknown:  { color: 'text-zinc-400',    bg: 'bg-zinc-500/10',    border: 'border-zinc-500/20',    icon: Hourglass,     label: 'Unknown' },
};

const LOG_LEVEL_CONFIG: Record<string, string> = {
  ERROR:    'border-red-500/20 bg-red-500/10 text-red-400',
  CRITICAL: 'border-red-500/20 bg-red-500/10 text-red-400',
  WARNING:  'border-amber-500/20 bg-amber-500/10 text-amber-400',
  INFO:     'border-blue-500/20 bg-blue-500/10 text-blue-400',
  DEBUG:    'border-zinc-500/20 bg-zinc-500/10 text-zinc-400',
};

function normalizeStatus(status?: string): string {
  if (status === 'ok' || status === 'healthy' || status === 'online') return 'online';
  if (status === 'error' || status === 'failed' || status === 'offline') return 'offline';
  if (status === 'degraded' || status === 'warning') return 'degraded';
  return 'unknown';
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function SkeletonBlock({ height = 'h-20' }: { height?: string }) {
  return <div className={cn('rounded-xl bg-brand-elevated/30 animate-pulse', height)} />;
}

// ── Mini stat card ─────────────────────────────────────────────────────────

function MiniStat({ label, value, icon: Icon, color = 'text-brand-primary', subtitle }: {
  label: string; value: string | number; icon: React.ComponentType<any>; color?: string; subtitle?: string;
}) {
  return (
    <div className="rounded-2xl border border-brand-border/50 bg-brand-surface p-4 hover:border-brand-border transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted">{label}</span>
        <Icon className={cn('w-4 h-4', color)} />
      </div>
      <div className="text-xl font-mono font-bold text-white">{value}</div>
      {subtitle && <p className="text-[10px] text-brand-text-muted mt-1">{subtitle}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════

export default function ServiceDetail() {
  const params = useParams();
  const serviceId = resolveServiceId(params.serviceId ?? null);
  const service = getServiceCatalogEntry(serviceId);
  const { restEndpoint, masterToken } = useStore();
  const [logFilter, setLogFilter] = useState<'all' | 'ERROR' | 'WARNING'>('all');

  const healthQuery = useQuery({
    queryKey: ['service-detail', 'health', restEndpoint, masterToken],
    queryFn: () => fetchHealth({ restEndpoint, masterToken }),
    enabled: !!restEndpoint && !!masterToken,
    refetchInterval: 15000,
  });

  const systemHealthQuery = useQuery({
    queryKey: ['service-detail', 'system-health', restEndpoint, masterToken],
    queryFn: () => fetchSystemHealth({ restEndpoint, masterToken }),
    enabled: !!restEndpoint && !!masterToken,
    refetchInterval: 15000,
  });

  const logsQuery = useQuery({
    queryKey: ['service-detail', 'logs', restEndpoint, masterToken],
    queryFn: () => fetchRecentLogs({ restEndpoint, masterToken }, { limit: 200 }),
    enabled: !!restEndpoint && !!masterToken,
    refetchInterval: 10000,
  });

  const workflowQuery = useQuery({
    queryKey: ['service-detail', 'workflow-history', restEndpoint, masterToken],
    queryFn: () => fetchWorkflowHistory({ restEndpoint, masterToken }, 30),
    enabled: !!restEndpoint && !!masterToken,
    refetchInterval: 15000,
  });

  // ── Derived data ─────────────────────────────────────────────────────────

  const serviceHealth = useMemo(() => {
    if (!service || !healthQuery.data?.services) return null;
    const entries = Object.entries(healthQuery.data.services);
    return entries.find(([key]) =>
      service.healthKeys.some(c => key.toLowerCase() === c || key.toLowerCase().includes(c))
    ) ?? null;
  }, [healthQuery.data, service]);

  const connectorHealth = useMemo(() => {
    if (!service || !systemHealthQuery.data?.connectors) return null;
    const entries = Object.entries(systemHealthQuery.data.connectors);
    return entries.find(([key]) =>
      [...service.healthKeys, ...(service.connectorKeys ?? [])].some(c => key.toLowerCase() === c || key.toLowerCase().includes(c))
    ) ?? null;
  }, [service, systemHealthQuery.data]);

  const matchingLogs = useMemo(() => {
    if (!service) return [];
    const logs = logsQuery.data?.logs ?? [];
    return logs.filter(log => {
      const haystack = `${log.module} ${log.message}`.toLowerCase();
      return service.logKeywords.some(kw => haystack.includes(kw.toLowerCase()));
    });
  }, [logsQuery.data, service]);

  const filteredLogs = useMemo(() => {
    if (logFilter === 'all') return matchingLogs;
    return matchingLogs.filter(l => l.level === logFilter);
  }, [matchingLogs, logFilter]);

  const matchingRuns = useMemo(() => {
    if (!service) return [];
    const runs = workflowQuery.data?.history ?? [];
    return runs.filter(run => {
      const haystack = `${run.topic ?? ''} ${run.error ?? ''} ${run.steps?.map(s => `${s.name} ${s.error ?? ''}`).join(' ') ?? ''}`.toLowerCase();
      return service.logKeywords.some(kw => haystack.includes(kw.toLowerCase()));
    });
  }, [service, workflowQuery.data]);

  const derivedStatus = normalizeStatus(
    (connectorHealth?.[1] as { status?: string } | undefined)?.status ??
      (serviceHealth?.[1] as ServiceHealthEntry | undefined)?.status
  );

  const statusConfig = STATUS_CONFIG[derivedStatus] || STATUS_CONFIG.unknown;
  const StatusIcon = statusConfig.icon;

  const errorCount = matchingLogs.filter(l => l.level === 'ERROR' || l.level === 'CRITICAL').length;
  const warningCount = matchingLogs.filter(l => l.level === 'WARNING').length;
  const latency = (serviceHealth?.[1] as ServiceHealthEntry | undefined)?.latency_ms ?? 0;
  const isLoading = healthQuery.isLoading || logsQuery.isLoading;

  if (!serviceId || !service) {
    return <Navigate to="/system-architecture" replace />;
  }

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col gap-5 pb-8">
      
      {/* Breadcrumb + Header */}
      <div className="rounded-2xl border border-brand-border/50 bg-brand-surface p-5">
        <div className="flex items-center gap-2 text-xs text-brand-text-muted font-mono mb-3">
          <Link to="/system-architecture" className="hover:text-brand-primary transition-colors">Architecture</Link>
          <ChevronRight className="w-3 h-3" />
          <span className="text-brand-text">{service.label}</span>
        </div>

        <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-2">
              <h1 className="text-xl font-bold text-white">{service.label}</h1>
              <span className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono uppercase border',
                statusConfig.bg, statusConfig.color, statusConfig.border
              )}>
                <StatusIcon className="w-3 h-3" />
                {statusConfig.label}
              </span>
              {isLoading && <RefreshCw className="w-3.5 h-3.5 text-brand-text-muted animate-spin" />}
            </div>
            <p className="text-sm text-brand-text-muted max-w-2xl">{service.description}</p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <Link to={`/live-logs?search=${encodeURIComponent(service.logKeywords[0] ?? service.id)}`}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand-surface border border-brand-border hover:border-brand-primary/30 text-xs font-bold font-mono uppercase tracking-wider text-brand-text-muted hover:text-white transition-all">
              <TerminalSquare className="w-3.5 h-3.5" /> Live Logs
            </Link>
            <Link to="/workflow-runs"
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand-primary/20 border border-brand-primary/30 text-brand-primary text-xs font-bold font-mono uppercase tracking-wider hover:bg-brand-primary/30 transition-all">
              <Workflow className="w-3.5 h-3.5" /> Runs
            </Link>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      {isLoading ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <SkeletonBlock key={i} height="h-24" />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MiniStat label="Status" value={statusConfig.label} icon={StatusIcon} color={statusConfig.color} subtitle="Current health state" />
          <MiniStat label="Latency" value={`${latency}ms`} icon={Gauge} color="text-violet-400" subtitle="Latest reported" />
          <MiniStat label="Errors" value={errorCount} icon={AlertTriangle} color={errorCount > 0 ? 'text-red-400' : 'text-emerald-400'} subtitle="Recent errors" />
          <MiniStat label="Related Runs" value={matchingRuns.length} icon={Workflow} color="text-brand-primary" subtitle="Workflow touchpoints" />
        </div>
      )}

      {/* Main Content */}
      <div className="grid grid-cols-1 xl:grid-cols-[1.2fr,0.8fr] gap-5">
        
        {/* Left: Logs */}
        <div className="rounded-2xl border border-brand-border/50 bg-brand-surface flex flex-col min-h-0">
          <div className="flex items-center justify-between px-5 py-4 border-b border-brand-border/30 shrink-0">
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-white">Service Logs</h2>
              <p className="text-[10px] text-brand-text-muted font-mono mt-0.5">{matchingLogs.length} entries</p>
            </div>
            <div className="flex items-center gap-1.5">
              <div className="flex gap-0.5 p-0.5 bg-brand-elevated rounded-lg">
                {(['all', 'ERROR', 'WARNING'] as const).map(f => (
                  <button key={f} onClick={() => setLogFilter(f)}
                    className={cn('px-2.5 py-1 rounded-md text-[9px] font-mono font-bold uppercase transition-all',
                      logFilter === f ? 'bg-brand-primary text-white' : 'text-brand-text-muted hover:text-white')}>
                    {f === 'all' ? 'All' : f}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-4">
            {filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <FileWarning className="w-8 h-8 text-brand-text-muted/30 mb-3" />
                <p className="text-sm text-brand-text-muted font-mono">No matching logs</p>
              </div>
            ) : (
              <div className="space-y-2">
                <AnimatePresence mode="wait">
                  {filteredLogs.slice(0, 30).map((log, i) => (
                    <motion.div key={`${log.timestamp}-${i}`}
                      initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.01 }}
                      className="rounded-xl border border-brand-border/30 bg-brand-bg/20 p-3 hover:border-brand-border/50 transition-colors group">
                      <div className="flex flex-wrap items-center gap-2 mb-2">
                        <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase border', LOG_LEVEL_CONFIG[log.level] || LOG_LEVEL_CONFIG.INFO)}>
                          {log.level}
                        </span>
                        <span className="text-[10px] font-mono text-brand-text-muted">
                          {new Date(log.timestamp).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </span>
                        <span className="text-[10px] font-mono text-brand-text-muted bg-brand-elevated px-1.5 py-0.5 rounded">{log.module}</span>
                        <button onClick={() => { navigator.clipboard.writeText(log.message); toast.success('Copied'); }}
                          className="ml-auto opacity-0 group-hover:opacity-100 transition-opacity p-0.5">
                          <Copy className="w-3 h-3 text-brand-text-muted hover:text-white" />
                        </button>
                      </div>
                      <p className="text-xs text-white leading-relaxed font-mono">{log.message}</p>
                    </motion.div>
                  ))}
                </AnimatePresence>
              </div>
            )}
          </div>
        </div>

        {/* Right: Details */}
        <div className="space-y-4">
          {/* Health metadata */}
          <div className="rounded-2xl border border-brand-border/50 bg-brand-surface p-4">
            <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted mb-3 flex items-center gap-2">
              <Server className="w-3.5 h-3.5 text-brand-primary" /> Health Metadata
            </h3>
            <div className="space-y-2.5 text-xs">
              {[
                { label: 'Service Key', value: serviceHealth?.[0] ?? service.id },
                { label: 'Latency', value: latency ? `${latency}ms` : 'n/a' },
                { label: 'Connector', value: connectorHealth?.[0] ?? 'n/a' },
                { label: 'Reason', value: (serviceHealth?.[1] as any)?.reason ?? (connectorHealth?.[1] as any)?.reason ?? 'No issues reported' },
              ].map((row, i) => (
                <div key={i} className="flex justify-between gap-3">
                  <span className="text-brand-text-muted flex-shrink-0">{row.label}</span>
                  <span className="text-white text-right font-mono truncate">{row.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Workflow Touchpoints */}
          <div className="rounded-2xl border border-brand-border/50 bg-brand-surface">
            <div className="px-4 py-3 border-b border-brand-border/30">
              <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted flex items-center gap-2">
                <Workflow className="w-3.5 h-3.5 text-brand-primary" /> Workflow Runs
              </h3>
            </div>
            <div className="p-3">
              {matchingRuns.length === 0 ? (
                <p className="text-xs text-brand-text-muted font-mono py-4 text-center">No related runs</p>
              ) : (
                <div className="space-y-2 max-h-64 overflow-y-auto">
                  {matchingRuns.slice(0, 8).map((run, i) => (
                    <div key={i} className="rounded-xl border border-brand-border/30 bg-brand-bg/20 p-3">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-bold text-white truncate">{run.topic ?? 'Workflow run'}</p>
                        <span className="text-[9px] font-mono text-brand-text-muted flex-shrink-0">
                          {run.started_at ? new Date(run.started_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : ''}
                        </span>
                      </div>
                      {run.error && <p className="text-[10px] text-red-400 mt-1 font-mono truncate">{run.error}</p>}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="rounded-2xl border border-brand-border/50 bg-brand-surface p-4">
            <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted mb-3 flex items-center gap-2">
              <Zap className="w-3.5 h-3.5 text-brand-primary" /> Quick Actions
            </h3>
            <div className="space-y-1.5">
              {[
                { to: `/live-logs?search=${encodeURIComponent(service.logKeywords[0] ?? service.id)}`, label: 'Inspect live logs', icon: TerminalSquare },
                { to: '/incident-center', label: 'Review related incidents', icon: AlertTriangle },
                { to: '/workflow-runs', label: 'Inspect workflow history', icon: History },
                { to: '/system-architecture', label: 'View full topology', icon: Network },
              ].map((action, i) => (
                <Link key={i} to={action.to}
                  className="flex items-center justify-between px-3 py-2.5 rounded-xl border border-brand-border/30 bg-brand-bg/20 hover:border-brand-primary/30 hover:bg-brand-elevated/20 transition-all group">
                  <span className="text-xs font-medium text-brand-text-muted group-hover:text-white transition-colors">{action.label}</span>
                  <action.icon className="w-3.5 h-3.5 text-brand-text-muted group-hover:text-brand-primary transition-colors" />
                </Link>
              ))}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
