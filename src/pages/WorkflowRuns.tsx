import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import {
  fetchWorkflowHistory,
  fetchWorkflowStatus,
  pauseWorkflow,
  triggerPost,
  cancelWorkflow,
  rollbackWorkflow,
  getJobStatus,
  WorkflowHistoryEntry,
  WorkflowStatusPayload,
} from '../lib/api';
import { 
  Play, Pause, RotateCcw, XCircle, RefreshCw, Clock, CheckCircle, 
  AlertCircle, Zap, History, Filter, ChevronDown, Download, Search,
  ArrowUpRight, X, FileText, Calendar, Hash
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

// ── Status config ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { icon: React.ComponentType<any>; color: string; bg: string; border: string; label: string }> = {
  running:   { icon: Play,         color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'Running' },
  active:    { icon: Play,         color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'Active' },
  paused:    { icon: Pause,        color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   label: 'Paused' },
  idle:      { icon: Clock,        color: 'text-zinc-400',    bg: 'bg-zinc-500/10',    border: 'border-zinc-500/30',    label: 'Idle' },
  cancelled: { icon: XCircle,      color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    label: 'Cancelled' },
  rolled_back:{ icon: RotateCcw,   color: 'text-blue-400',    bg: 'bg-blue-500/10',    border: 'border-blue-500/30',    label: 'Rolled Back' },
  failed:    { icon: AlertCircle,  color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/30',     label: 'Failed' },
  error:     { icon: AlertCircle,  color: 'text-red-400',     bg: 'bg-red-500/10',     border: 'border-red-500/30',     label: 'Error' },
  completed: { icon: CheckCircle,  color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'Completed' },
  success:   { icon: CheckCircle,  color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'Success' },
  PUBLISHED: { icon: CheckCircle,  color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30', label: 'Published' },
  GENERATING:{ icon: Zap,          color: 'text-violet-400',  bg: 'bg-violet-500/10',   border: 'border-violet-500/30',  label: 'AI Writing' },
  VALIDATING:{ icon: FileText,     color: 'text-sky-400',     bg: 'bg-sky-500/10',      border: 'border-sky-500/30',     label: 'Validating' },
  RENDERING: { icon: FileText,     color: 'text-amber-400',   bg: 'bg-amber-500/10',    border: 'border-amber-500/30',   label: 'Rendering' },
  PUBLISHING:{ icon: ArrowUpRight,  color: 'text-brand-primary', bg: 'bg-brand-primary/10', border: 'border-brand-primary/30', label: 'Publishing' },
  QUEUED:    { icon: Clock,        color: 'text-zinc-400',    bg: 'bg-zinc-500/10',     border: 'border-zinc-500/30',    label: 'Queued' },
};

const DEFAULT_STATUS = { icon: Clock, color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/30', label: 'Unknown' };

// ── Skeleton row ───────────────────────────────────────────────────────────

const SkeletonRow = () => (
  <div className="p-4 border-b border-brand-border/30 grid grid-cols-12 gap-4 animate-pulse">
    <div className="col-span-2 h-4 bg-brand-elevated rounded" />
    <div className="col-span-3 h-4 bg-brand-elevated rounded" />
    <div className="col-span-2 h-6 w-20 bg-brand-elevated rounded-full" />
    <div className="col-span-3 h-4 bg-brand-elevated rounded" />
    <div className="col-span-2 h-4 bg-brand-elevated rounded" />
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════

export default function WorkflowRuns() {
  const { restEndpoint, masterToken, selectedBrandId, socket } = useStore();
  const cfg = { restEndpoint, masterToken };

  const [history, setHistory] = useState<WorkflowHistoryEntry[]>([]);
  const [status, setStatus] = useState<WorkflowStatusPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [filter, setFilter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');

  // Job detail modal
  const [selectedJob, setSelectedJob] = useState<any>(null);
  const [jobDetailLoading, setJobDetailLoading] = useState(false);

  const loadData = useCallback(async () => {
    try {
      const [h, s] = await Promise.all([
        fetchWorkflowHistory(cfg).catch(() => ({ history: [] as WorkflowHistoryEntry[] })),
        fetchWorkflowStatus(cfg).catch(() => ({ status: 'idle' as WorkflowStatusPayload['status'] })),
      ]);
      setHistory(h.history || []);
      setStatus(s as WorkflowStatusPayload);
    } finally {
      setLoading(false);
    }
  }, [restEndpoint, masterToken]);

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30_000);
    return () => clearInterval(interval);
  }, [loadData]);

  useEffect(() => {
    if (!socket) return;
    const handler = () => { loadData(); };
    socket.on('workflow_status', handler);
    socket.on('mission_status', handler);
    return () => {
      socket.off('workflow_status', handler);
      socket.off('mission_status', handler);
    };
  }, [socket, loadData]);

  const handleAction = async (action: string, fn: () => Promise<any>, successMsg: string) => {
    setActionLoading(action);
    try {
      await fn();
      toast.success(successMsg);
      await loadData();
    } catch (err: any) {
      toast.error('Action failed', { description: err?.message });
    } finally {
      setActionLoading(null);
    }
  };

  const handleViewJobDetails = async (run: WorkflowHistoryEntry) => {
    const jobId = (run as any).job_id || run.id;
    if (!jobId) {
      toast.error('No job ID available for this run');
      return;
    }
    setJobDetailLoading(true);
    try {
      const res = await getJobStatus(cfg, String(jobId));
      setSelectedJob(res.job || null);
    } catch {
      toast.error('Failed to load job details');
    } finally {
      setJobDetailLoading(false);
    }
  };

  // ── Filtered & searched history ──────────────────────────────────────────

  const filteredHistory = useMemo(() => {
    let items = history;
    if (filter !== 'all') {
      items = items.filter(r => r.status === filter);
    }
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      items = items.filter(r => (r.topic || '').toLowerCase().includes(q));
    }
    return items;
  }, [history, filter, searchQuery]);

  // ── Stats ────────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total: history.length,
    running: history.filter(r => r.status === 'running' || r.status === 'active').length,
    completed: history.filter(r => r.status === 'completed' || r.status === 'success' || r.status === 'PUBLISHED').length,
    failed: history.filter(r => r.status === 'failed' || r.status === 'error').length,
  }), [history]);

  const statusFilters = ['all', 'running', 'completed', 'failed', 'paused', 'cancelled'];
  const currentStatusConfig = STATUS_CONFIG[status?.status || ''] || DEFAULT_STATUS;
  const StatusIcon = currentStatusConfig.icon;

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-col h-full gap-4 p-4 md:p-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
            <History className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Workflow Runs</h1>
            <p className="text-[10px] text-brand-text-muted font-mono uppercase tracking-wider mt-0.5">
              {stats.total} total · {stats.running} running · {stats.completed} completed
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={loadData}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-brand-surface border border-brand-border hover:border-brand-primary/30 text-brand-text-muted hover:text-white transition-all text-xs font-medium"
          >
            <RefreshCw className={cn('w-3.5 h-3.5', loading && 'animate-spin')} />
            Refresh
          </button>

          {status?.status === 'running' ? (
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => handleAction('pause', () => pauseWorkflow(cfg), 'Workflow paused')}
              disabled={actionLoading === 'pause'}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono uppercase tracking-wider bg-amber-500/15 text-amber-400 border border-amber-500/30 hover:bg-amber-500/25 disabled:opacity-50 transition-all"
            >
              <Pause className="w-4 h-4" />
              {actionLoading === 'pause' ? 'Pausing…' : 'Pause'}
            </motion.button>
          ) : (
            <motion.button
              whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
              onClick={() => {
                if (!selectedBrandId) {
                  toast.error('Select a brand before triggering a run');
                  return;
                }
                handleAction('trigger', () => triggerPost(cfg, selectedBrandId), 'Pipeline triggered');
              }}
              disabled={actionLoading === 'trigger' || !selectedBrandId}
              title={!selectedBrandId ? 'Select a brand first from the workspace settings' : undefined}
              className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold font-mono uppercase tracking-wider bg-brand-primary/20 text-brand-primary border border-brand-primary/30 hover:bg-brand-primary/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Zap className="w-4 h-4" />
              {actionLoading === 'trigger' ? 'Starting…' : status?.status === 'paused' ? 'Trigger New Run' : 'Trigger Run'}
            </motion.button>
          )}
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-4 gap-2 shrink-0">
        {[
          { label: 'Total', value: stats.total, icon: Zap },
          { label: 'Running', value: stats.running, icon: Play },
          { label: 'Completed', value: stats.completed, icon: CheckCircle },
          { label: 'Failed', value: stats.failed, icon: AlertCircle },
        ].map(stat => (
          <div key={stat.label} className="bg-brand-surface/50 border border-brand-border/50 rounded-xl p-2.5 hover:border-brand-border transition-colors">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-brand-text-muted uppercase font-mono tracking-wider">{stat.label}</span>
              <stat.icon className="w-3 h-3 text-brand-text-muted" />
            </div>
            <div className="text-sm font-mono font-bold text-white">{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Current Status */}
      <AnimatePresence>
        {status && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="p-4 bg-brand-surface/80 backdrop-blur-sm border border-brand-border/50 rounded-xl shrink-0"
          >
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-4">
                <span className="text-[10px] text-brand-text-muted uppercase font-mono tracking-wider">Current Status</span>
                <span className={cn(
                  'inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-bold font-mono uppercase border',
                  currentStatusConfig.bg, currentStatusConfig.color, currentStatusConfig.border
                )}>
                  <StatusIcon className="w-3.5 h-3.5" />
                  {currentStatusConfig.label}
                </span>
                {status.current_step && (
                  <span className="text-xs text-brand-text-muted font-mono">
                    Step: <span className="text-white font-bold">{status.current_step}</span>
                  </span>
                )}
              </div>
              {status.progress != null && status.progress > 0 && (
                <div className="w-full sm:w-56">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-[9px] text-brand-text-muted font-mono">Progress</span>
                    <span className="text-[9px] text-brand-primary font-mono font-bold">{Math.round(status.progress * 100)}%</span>
                  </div>
                  <div className="h-2 bg-brand-elevated rounded-full overflow-hidden">
                    <motion.div
                      className="h-full bg-gradient-to-r from-brand-primary to-brand-accent rounded-full"
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(status.progress * 100, 100)}%` }}
                      transition={{ duration: 0.5, ease: 'easeOut' }}
                    />
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Filters + Search */}
      <div className="flex items-center gap-2 shrink-0">
        <div className="flex items-center gap-1 p-1 bg-brand-surface border border-brand-border/50 rounded-xl">
          {statusFilters.map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={cn(
                'px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition-all',
                filter === f ? 'bg-brand-primary text-white' : 'text-brand-text-muted hover:text-white'
              )}
            >
              {f}
            </button>
          ))}
        </div>
        <div className="relative flex-1 max-w-xs ml-auto">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-brand-text-muted" />
          <input
            type="text"
            placeholder="Search by topic..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-brand-surface border border-brand-border/50 rounded-xl text-xs text-brand-text placeholder-brand-text-muted font-mono focus:outline-none focus:border-brand-primary/50 transition-colors"
          />
        </div>
      </div>

      {/* History Table */}
      <div className="flex-1 bg-brand-surface border border-brand-border/50 rounded-xl overflow-hidden flex flex-col min-h-0">
        <div className="px-4 py-3 border-b border-brand-border/50 grid grid-cols-12 gap-4 text-[10px] font-bold text-brand-text-muted uppercase tracking-widest bg-brand-elevated/20 shrink-0">
          <div className="col-span-2">Time</div>
          <div className="col-span-3">Topic</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-3">Duration</div>
          <div className="col-span-2 text-right">Actions</div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="space-y-0">
              {Array.from({ length: 5 }).map((_, i) => <SkeletonRow key={i} />)}
            </div>
          ) : filteredHistory.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center py-16 text-center">
              <History className="w-10 h-10 text-brand-text-muted/30 mx-auto mb-3" />
              <p className="text-sm text-brand-text-muted font-mono">
                {history.length === 0 ? 'No workflow runs yet' : 'No runs match your filters'}
              </p>
              {history.length > 0 && (
                <button onClick={() => { setFilter('all'); setSearchQuery(''); }} className="mt-2 text-xs text-brand-primary hover:underline">
                  Clear filters
                </button>
              )}
            </div>
          ) : (
            <AnimatePresence mode="wait">
              {filteredHistory.map((run, i) => {
                const config = STATUS_CONFIG[run.status || ''] || DEFAULT_STATUS;
                const Icon = config.icon;
                const jobId = (run as any).job_id || run.id;
                return (
                  <motion.div
                    key={run.id || run.topic}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 10 }}
                    transition={{ delay: i * 0.02 }}
                    onClick={() => handleViewJobDetails(run)}
                    className="px-4 py-3 border-b border-brand-border/30 grid grid-cols-12 gap-4 hover:bg-brand-elevated/30 transition-colors items-center group cursor-pointer"
                  >
                    <div className="col-span-2 text-brand-text-muted text-xs font-mono tabular-nums">
                      {run.started_at ? new Date(run.started_at).toLocaleString([], { 
                        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' 
                      }) : '—'}
                    </div>
                    <div className="col-span-3 text-white text-sm font-medium truncate">
                      {run.topic || 'Untitled Run'}
                      {jobId && <span className="text-[9px] text-brand-text-muted ml-1.5 font-mono">#{String(jobId).slice(-8)}</span>}
                    </div>
                    <div className="col-span-2" onClick={e => e.stopPropagation()}>
                      <span className={cn(
                        'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono uppercase border',
                        config.bg, config.color, config.border
                      )}>
                        <Icon className="w-3 h-3" />
                        {config.label}
                      </span>
                    </div>
                    <div className="col-span-3 text-brand-text-muted text-xs font-mono tabular-nums">
                      {run.duration_ms ? `${(run.duration_ms / 1000).toFixed(1)}s` : '—'}
                    </div>
                    <div className="col-span-2 flex items-center justify-end gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                      {run.status === 'running' && (
                        <button
                          onClick={() => handleAction(`cancel-${run.id}`, () => cancelWorkflow(cfg, run.id || run.topic!), 'Run cancelled')}
                          disabled={!!actionLoading}
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/30 transition-colors"
                          title="Cancel run"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                        </button>
                      )}
                      {(run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') && (
                        <button
                          onClick={() => handleAction(`rollback-${run.id}`, () => rollbackWorkflow(cfg, run.id || run.topic!), 'Rollback initiated')}
                          disabled={!!actionLoading}
                          className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20 border border-blue-500/30 transition-colors"
                          title="Rollback"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        <div className="px-4 py-2 border-t border-brand-border/50 bg-brand-elevated/10 shrink-0 flex items-center justify-between">
          <span className="text-[10px] text-brand-text-muted font-mono">
            Showing {filteredHistory.length} of {history.length} runs · Click a row for job details
          </span>
          <span className="text-[10px] text-brand-text-muted font-mono">
            Live via Socket.IO · REST reconciles every 30s
          </span>
        </div>
      </div>

      {/* Job Detail Modal */}
      <AnimatePresence>
        {selectedJob && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setSelectedJob(null)}
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-brand-surface border border-brand-border/50 rounded-2xl max-w-md w-full p-6 shadow-2xl max-h-[80vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                  <FileText className="w-4 h-4 text-brand-primary" /> Job Details
                </h3>
                <button onClick={() => setSelectedJob(null)} className="p-1 rounded-lg hover:bg-brand-elevated text-brand-text-muted">
                  <X className="w-4 h-4" />
                </button>
              </div>

              {jobDetailLoading ? (
                <div className="flex items-center justify-center py-8">
                  <RefreshCw className="w-6 h-6 text-brand-primary animate-spin" />
                </div>
              ) : selectedJob ? (
                <div className="space-y-3">
                  {[
                    { label: 'Job ID', value: selectedJob.job_id || '—', icon: Hash },
                    { label: 'Status', value: (STATUS_CONFIG[selectedJob.status]?.label || selectedJob.status || '—'), icon: () => {
                      const cfg = STATUS_CONFIG[selectedJob.status] || DEFAULT_STATUS;
                      return <cfg.icon className="w-3.5 h-3.5" style={{ color: cfg.color.replace('text-', '') }} />;
                    }},
                    { label: 'Topic', value: selectedJob.topic || '—', icon: FileText },
                    { label: 'Created', value: selectedJob.created_at ? new Date(selectedJob.created_at).toLocaleString() : '—', icon: Calendar },
                    { label: 'Started', value: selectedJob.started_at ? new Date(selectedJob.started_at).toLocaleString() : '—', icon: Play },
                    { label: 'Completed', value: selectedJob.completed_at ? new Date(selectedJob.completed_at).toLocaleString() : '—', icon: CheckCircle },
                    { label: 'Duration', value: selectedJob.duration_ms ? `${(selectedJob.duration_ms / 1000).toFixed(1)}s` : '—', icon: Clock },
                    { label: 'Attempts', value: `${selectedJob.attempt_count || 0}/${selectedJob.max_attempts || 3}`, icon: RotateCcw },
                  ].map(row => (
                    <div key={row.label} className="flex items-center gap-3 py-1.5">
                      <div className="w-8 flex-shrink-0 flex justify-center">
                        {(() => { const I = row.icon as React.ComponentType<{ className?: string }>; return <I className="w-3.5 h-3.5 text-brand-text-muted" />; })()}
                      </div>
                      <span className="text-[10px] text-brand-text-muted font-mono uppercase w-20 flex-shrink-0">{row.label}</span>
                      <span className="text-xs text-white font-mono font-bold truncate">{row.value}</span>
                    </div>
                  ))}

                  {selectedJob.last_error && (
                    <div className="bg-red-500/5 border border-red-500/10 rounded-xl p-3 mt-2">
                      <span className="text-[9px] font-mono font-bold text-red-400 uppercase">Error</span>
                      <p className="text-[10px] text-red-300 font-mono mt-1">{selectedJob.last_error}</p>
                      {selectedJob.last_error_code && (
                        <p className="text-[9px] text-red-400/60 font-mono mt-0.5">Code: {selectedJob.last_error_code}</p>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-brand-text-muted text-center py-8">No job details available.</p>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
