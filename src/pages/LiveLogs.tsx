import React, { useEffect, useRef, useState, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import {
  connectLogStream, fetchRecentLogs, fetchLogStats, clearLogs, LogEntry,
} from '../lib/api';
import { cn } from '../lib/utils';
import { 
  Trash2, Pause, Play, Filter, Search, RefreshCw, AlertCircle, 
  AlertTriangle, Info, Terminal, Copy, Download, Maximize2, Minimize2,
  Eye, EyeOff, Zap, Clock, Hash, X
} from 'lucide-react';
import { toast } from 'sonner';

// ── Level config ───────────────────────────────────────────────────────────

const LEVEL_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ComponentType<any> }> = {
  CRITICAL: { color: 'text-purple-400', bg: 'bg-purple-500/10', border: 'border-l-purple-500', icon: AlertCircle },
  ERROR:    { color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-l-red-500',    icon: AlertCircle },
  WARNING:  { color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-l-amber-500',  icon: AlertTriangle },
  INFO:     { color: 'text-sky-400',    bg: 'bg-sky-500/10',    border: 'border-l-sky-500',    icon: Info },
  DEBUG:    { color: 'text-zinc-400',   bg: 'bg-zinc-500/10',   border: 'border-l-zinc-500',   icon: Terminal },
};

const LEVELS = ['', 'DEBUG', 'INFO', 'WARNING', 'ERROR', 'CRITICAL'];

// ── Log row component ──────────────────────────────────────────────────────

function LogRow({ log, isCompact }: { log: LogEntry; isCompact: boolean }) {
  const config = LEVEL_CONFIG[log.level] || LEVEL_CONFIG.INFO;
  const Icon = config.icon;

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'flex gap-3 py-1.5 px-2 border-l-2 hover:bg-brand-elevated/20 transition-colors group',
        config.border
      )}>
      {!isCompact && (
        <span className="text-brand-text-muted w-20 flex-shrink-0 text-[10px] font-mono tabular-nums">
          {new Date(log.timestamp).toLocaleTimeString('en-US', { hour12: false })}
        </span>
      )}
      <span className={cn('w-16 flex-shrink-0 text-[10px] font-bold font-mono uppercase flex items-center gap-1', config.color)}>
        <Icon className="w-3 h-3" /> {log.level}
      </span>
      {!isCompact && (
        <span className="text-cyan-400 w-32 flex-shrink-0 text-[10px] font-mono truncate">{log.module}</span>
      )}
      <span className="text-white text-[10px] font-mono flex-1 break-all leading-relaxed">{log.message}</span>
      <button
        onClick={() => { navigator.clipboard.writeText(log.message); toast.success('Copied'); }}
        className="opacity-0 group-hover:opacity-100 p-0.5 flex-shrink-0 text-brand-text-muted hover:text-white transition-all">
        <Copy className="w-3 h-3" />
      </button>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════

export default function LiveLogs() {
  const { restEndpoint, masterToken } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [isStreaming, setIsStreaming] = useState(true);
  const [isPaused, setIsPaused] = useState(false);
  const [stats, setStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [filterLevel, setFilterLevel] = useState<string>(searchParams.get('level') ?? '');
  const [filterModule, setFilterModule] = useState<string>(searchParams.get('module') ?? '');
  const [searchQuery, setSearchQuery] = useState<string>(searchParams.get('search') ?? '');
  const [showFilters, setShowFilters] = useState(true);
  const [isCompact, setIsCompact] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const streamRef = useRef<EventSource | null>(null);
  const pausedBufferRef = useRef<LogEntry[]>([]);

  // Load initial logs
  useEffect(() => {
    const loadInitial = async () => {
      try {
        const [initialLogs, logStats] = await Promise.all([
          fetchRecentLogs({ restEndpoint, masterToken }, { limit: 300, level: filterLevel || undefined, module: filterModule || undefined, search: searchQuery || undefined }).catch(() => ({ logs: [] })),
          fetchLogStats({ restEndpoint, masterToken }).catch(() => null),
        ]);
        setLogs(initialLogs.logs || []);
        setStats(logStats);
      } finally { setLoading(false); }
    };
    loadInitial();
  }, [restEndpoint, masterToken]);

  // Sync filters to URL
  useEffect(() => {
    const nextParams = new URLSearchParams();
    if (filterLevel) nextParams.set('level', filterLevel);
    if (filterModule) nextParams.set('module', filterModule);
    if (searchQuery) nextParams.set('search', searchQuery);
    setSearchParams(nextParams, { replace: true });
  }, [filterLevel, filterModule, searchQuery]);

  // SSE stream
  useEffect(() => {
    if (isStreaming && restEndpoint && masterToken) {
      streamRef.current = connectLogStream(
        { restEndpoint, masterToken },
        (entry) => {
          if (isPaused) {
            pausedBufferRef.current.push(entry);
          } else {
            setLogs(prev => [entry, ...prev].slice(0, 500));
          }
        },
        () => {},
        { level: filterLevel || undefined, module: filterModule || undefined }
      );
    }
    return () => { streamRef.current?.close(); };
  }, [restEndpoint, masterToken, isStreaming, isPaused, filterLevel, filterModule]);

  // Auto-scroll
  useEffect(() => {
    if (scrollRef.current && autoScroll && !isPaused) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs, isPaused, autoScroll]);

  // Detect manual scroll
  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  }, []);

  // Filtered logs
  const filteredLogs = useMemo(() => {
    if (!searchQuery && !filterModule) return logs;
    return logs.filter(log => {
      if (filterModule && !log.module.toLowerCase().includes(filterModule.toLowerCase())) return false;
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (!log.message.toLowerCase().includes(q) && !log.module.toLowerCase().includes(q)) return false;
      }
      return true;
    });
  }, [logs, searchQuery, filterModule]);

  const handleClear = async () => {
    await clearLogs({ restEndpoint, masterToken }).catch(() => {});
    setLogs([]);
    toast.success('Logs cleared');
  };

  const handleResume = () => {
    setIsPaused(false);
    if (pausedBufferRef.current.length > 0) {
      setLogs(prev => [...pausedBufferRef.current, ...prev].slice(0, 500));
      pausedBufferRef.current = [];
    }
  };

  const errorCount = stats?.errors || logs.filter(l => l.level === 'ERROR' || l.level === 'CRITICAL').length;
  const warnCount = stats?.warnings || logs.filter(l => l.level === 'WARNING').length;

  return (
    <div className={cn(
      'flex flex-col gap-3',
      isFullscreen ? 'fixed inset-0 z-50 bg-brand-bg p-4' : 'h-full p-4'
    )}>
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-brand-primary/10 rounded-lg border border-brand-primary/20">
            <Terminal className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white">Live Logs</h1>
            <p className="text-[10px] text-brand-text-muted font-mono">
              {filteredLogs.length} entries · {errorCount} errors · {warnCount} warnings
              {isStreaming && <span className="text-emerald-400 ml-2">● Streaming</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {/* Stream toggle */}
          <button onClick={() => isPaused ? handleResume() : setIsPaused(true)}
            className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition-all',
              isPaused ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' : 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30')}>
            {isPaused ? <><Play className="w-3 h-3" /> Live</> : <><Pause className="w-3 h-3" /> Pause</>}
          </button>

          {/* Compact toggle */}
          <button onClick={() => setIsCompact(!isCompact)}
            className={cn('p-1.5 rounded-lg transition-all', isCompact ? 'bg-brand-primary/20 text-brand-primary' : 'text-brand-text-muted hover:text-white')}>
            {isCompact ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
          </button>

          {/* Filters toggle */}
          <button onClick={() => setShowFilters(!showFilters)}
            className={cn('p-1.5 rounded-lg transition-all', showFilters ? 'bg-brand-primary/20 text-brand-primary' : 'text-brand-text-muted hover:text-white')}>
            <Filter className="w-3.5 h-3.5" />
          </button>
          <button onClick={() => { setLogs([]); fetchRecentLogs({ restEndpoint, masterToken }, { limit: 300, level: filterLevel || undefined, module: filterModule || undefined, search: searchQuery || undefined }).then(r => setLogs(r.logs || [])).catch(() => {}); }}
            className="p-1.5 rounded-lg text-brand-text-muted hover:text-white transition-all">
            <RefreshCw className="w-3.5 h-3.5" />
          </button>

          <button onClick={handleClear}
            className="p-1.5 rounded-lg text-brand-text-muted hover:text-red-400 transition-all">
            <Trash2 className="w-3.5 h-3.5" />
          </button>

          <button onClick={() => setIsFullscreen(!isFullscreen)}
            className="p-1.5 rounded-lg text-brand-text-muted hover:text-white transition-all">
            {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* Filters */}
      <AnimatePresence>
        {showFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-2 p-3 bg-brand-surface border border-brand-border/50 rounded-xl">
              <div className="relative flex-1 min-w-[180px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-text-muted" />
                <input type="text" placeholder="Search messages..." value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 bg-brand-elevated border border-brand-border/50 rounded-lg text-[11px] font-mono text-brand-text placeholder-brand-text-muted focus:outline-none focus:border-brand-primary/50" />
                {searchQuery && (
                  <button onClick={() => setSearchQuery('')} className="absolute right-2 top-1/2 -translate-y-1/2">
                    <X className="w-3 h-3 text-brand-text-muted hover:text-white" />
                  </button>
                )}
              </div>
              <select value={filterLevel} onChange={e => setFilterLevel(e.target.value)}
                className="bg-brand-elevated border border-brand-border/50 rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-brand-text focus:outline-none focus:border-brand-primary/50">
                {LEVELS.map(l => <option key={l} value={l}>{l || 'All Levels'}</option>)}
              </select>
              <input type="text" placeholder="Module..." value={filterModule}
                onChange={e => setFilterModule(e.target.value)}
                className="bg-brand-elevated border border-brand-border/50 rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-brand-text placeholder-brand-text-muted focus:outline-none focus:border-brand-primary/50 w-32" />
              {filterModule && (
                <button onClick={() => setFilterModule('')} className="p-1 text-brand-text-muted hover:text-white">
                  <X className="w-3 h-3" />
                </button>
              )}
              {(filterLevel || filterModule || searchQuery) && (
                <button onClick={() => { setFilterLevel(''); setFilterModule(''); setSearchQuery(''); }}
                  className="text-[9px] font-mono text-brand-primary hover:underline ml-auto">
                  Clear all
                </button>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Stats bar */}
      {stats && (
        <div className="flex items-center gap-4 px-3 py-2 bg-brand-surface border border-brand-border/50 rounded-xl text-[10px] font-mono shrink-0">
          <span className="flex items-center gap-1.5"><Hash className="w-3 h-3 text-brand-text-muted" /> <span className="text-white font-bold">{stats.total_logs || 0}</span> total</span>
          <span className="flex items-center gap-1.5"><AlertCircle className="w-3 h-3 text-red-400" /> <span className="text-red-400 font-bold">{errorCount}</span> errors</span>
          <span className="flex items-center gap-1.5"><AlertTriangle className="w-3 h-3 text-amber-400" /> <span className="text-amber-400 font-bold">{warnCount}</span> warnings</span>
          <span className="flex items-center gap-1.5 ml-auto"><Clock className="w-3 h-3 text-brand-text-muted" /> {new Date().toLocaleTimeString()}</span>
        </div>
      )}

      {/* Log stream */}
      <div className="flex-1 bg-brand-surface border border-brand-border/50 rounded-xl overflow-hidden flex flex-col min-h-0">
        {loading ? (
          <div className="flex-1 flex items-center justify-center">
            <RefreshCw className="w-5 h-5 text-brand-text-muted animate-spin" />
          </div>
        ) : (
          <div ref={scrollRef} onScroll={handleScroll}
            className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {filteredLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-brand-text-muted gap-2">
                <Terminal className="w-8 h-8 opacity-30" />
                <span className="text-xs font-mono uppercase">No logs to display</span>
              </div>
            ) : (
              <>
                {filteredLogs.map((log, idx) => (
                  <LogRow key={`${log.timestamp}-${idx}`} log={log} isCompact={isCompact} />
                ))}
                {!autoScroll && isStreaming && (
                  <button
                    onClick={() => { setAutoScroll(true); scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }}
                    className="sticky bottom-2 left-1/2 -translate-x-1/2 px-3 py-1.5 bg-brand-primary text-white text-[10px] font-mono font-bold rounded-full shadow-lg z-10">
                    ↓ Scroll to latest
                  </button>
                )}
              </>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
