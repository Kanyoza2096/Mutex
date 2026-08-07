import React, { useEffect, useState, useRef, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { 
  Activity, Clock, AlertTriangle, Zap, ArrowDown, Sparkles,
  Wifi, WifiOff, Gauge, Layers
} from 'lucide-react';
import { cn } from '../lib/utils';

interface TraceData {
  id: string;
  timestamp: string;
  correlation_id: string;
  step: string;
  duration_ms: number;
  metadata?: Record<string, any>;
  error?: string;
  status?: number;
}

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-sky-500/20 text-sky-400',
  POST: 'bg-emerald-500/20 text-emerald-400',
  PUT: 'bg-amber-500/20 text-amber-400',
  PATCH: 'bg-amber-500/20 text-amber-400',
  DELETE: 'bg-red-500/20 text-red-400',
};

function getTraceColor(ms: number) {
  if (ms > 800) return { bar: 'bg-red-500', text: 'text-red-400', glow: 'shadow-red-500/20' };
  if (ms > 300) return { bar: 'bg-amber-500', text: 'text-amber-400', glow: 'shadow-amber-500/20' };
  if (ms > 100) return { bar: 'bg-brand-primary', text: 'text-violet-400', glow: 'shadow-violet-500/20' };
  return { bar: 'bg-emerald-500', text: 'text-emerald-400', glow: 'shadow-emerald-500/20' };
}

// ── Mini sparkline for latency trend ───────────────────────────────────────

function LatencyTrend({ data }: { data: number[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const W = 60, H = 20, PAD = 2;
  const pts = data.map((v, i) => {
    const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
    const y = H - PAD - ((v / max) * (H - PAD * 2));
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="flex-shrink-0">
      <polyline points={pts} fill="none" stroke="#818cf8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.7" />
    </svg>
  );
}

// ═══════════════════════════════════════════════════════════════════════════

export default function DigitalTwin() {
  const { restEndpoint, masterToken, socket } = useStore();
  const [traces, setTraces] = useState<TraceData[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrace, setSelectedTrace] = useState<string | null>(null);
  const [newTraceIds, setNewTraceIds] = useState<Set<string>>(new Set());
  const [pulseId, setPulseId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const prevTraceCount = useRef(0);

  const base = restEndpoint?.replace(/\/+$/, '') || '';
  const headers: Record<string, string> = masterToken
    ? { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` }
    : {};

  const fetchTraces = async () => {
    try {
      const res = await fetch(`${base}/traces/recent?limit=40`, { headers });
      if (res.ok) {
        const data = await res.json();
        const newTraces = data.traces || [];
        if (newTraces.length > prevTraceCount.current) {
          const freshIds = new Set<string>();
          newTraces.slice(0, newTraces.length - prevTraceCount.current).forEach((t: TraceData) => freshIds.add(t.id));
          setNewTraceIds(freshIds);
          if (newTraces.length > 0) { setPulseId(newTraces[0].id); setTimeout(() => setPulseId(null), 1500); }
          setTimeout(() => setNewTraceIds(new Set()), 2000);
        }
        prevTraceCount.current = newTraces.length;
        setTraces(newTraces);
      }
    } catch {}
    finally { setLoading(false); }
  };

  useEffect(() => { fetchTraces(); const interval = setInterval(fetchTraces, 3000); return () => clearInterval(interval); }, [restEndpoint]);
  useEffect(() => { if (listRef.current && newTraceIds.size > 0) listRef.current.scrollTo({ top: 0, behavior: 'smooth' }); }, [newTraceIds.size]);
  useEffect(() => {
    if (!socket) return;
    ['new_message', 'post_published', 'api_payload', 'worker_error'].forEach(e => socket.on(e, fetchTraces));
    return () => { ['new_message', 'post_published', 'api_payload', 'worker_error'].forEach(e => socket.off(e)); };
  }, [socket]);

  // ── Grouped traces ───────────────────────────────────────────────────────
  const groupedTraces = useMemo(() => {
    const groups: Record<string, TraceData[]> = {};
    traces.forEach(t => {
      const key = t.correlation_id || t.id;
      if (!groups[key]) groups[key] = [];
      groups[key].push(t);
    });
    return groups;
  }, [traces]);

  const maxDuration = Math.max(...traces.map(t => t.duration_ms), 1);
  const totalRequests = traces.length;
  const avgDuration = totalRequests > 0 ? Math.round(traces.reduce((s, t) => s + t.duration_ms, 0) / totalRequests) : 0;
  const errorCount = traces.filter(t => t.error || (t.status && t.status >= 400)).length;
  const latencyTrend = traces.slice(-10).map(t => t.duration_ms);

  return (
    <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-4 h-full flex flex-col relative overflow-hidden">
      
      {/* Background */}
      <div className="absolute top-0 right-0 w-40 h-40 bg-brand-primary/3 blur-3xl rounded-full pointer-events-none" />

      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0 relative z-10">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-brand-primary/10 rounded-lg border border-brand-primary/20">
            <Activity className="w-3.5 h-3.5 text-brand-primary" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">Live Traces</h2>
            <p className="text-[9px] font-mono text-brand-text-muted">
              {totalRequests} requests · {avgDuration}ms avg
              {errorCount > 0 && <span className="text-red-400 ml-1">· {errorCount} errors</span>}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {latencyTrend.length > 1 && <LatencyTrend data={latencyTrend} />}
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[8px] font-mono font-bold text-emerald-400 uppercase">Live</span>
          </div>
        </div>
      </div>

      {/* Content */}
      <div ref={listRef} className="flex-1 overflow-y-auto space-y-1.5 relative z-10 pr-1">
        {loading && traces.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-brand-text-muted gap-3">
            <Sparkles className="w-8 h-8 text-brand-primary/30 animate-pulse" />
            <span className="text-[10px] font-mono uppercase">Awaiting requests…</span>
          </div>
        ) : Object.keys(groupedTraces).length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-brand-text-muted gap-2">
            <ArrowDown className="w-8 h-8 text-brand-primary/15" />
            <span className="text-[10px] font-mono uppercase">No traces yet</span>
            <span className="text-[9px] font-mono">Traces appear when API is called</span>
          </div>
        ) : (
          Object.entries(groupedTraces).map(([groupId, groupTraces]) => {
            const totalDuration = groupTraces.reduce((s, t) => s + t.duration_ms, 0);
            const isExpanded = selectedTrace === groupId;
            const hasError = groupTraces.some(t => t.error || (t.status && t.status >= 400));
            const firstTrace = groupTraces[0];
            const isNew = newTraceIds.has(firstTrace?.id);
            const color = getTraceColor(totalDuration);
            const endpointName = firstTrace?.step?.replace(/^(GET|POST|PUT|DELETE|PATCH) /, '') || 'Request';
            const method = firstTrace?.step?.split(' ')[0] || '';
            const methodColor = METHOD_COLORS[method] || 'bg-zinc-500/20 text-zinc-400';

            return (
              <motion.div key={groupId} layout
                initial={isNew ? { opacity: 0, x: 30, scale: 0.96 } : false}
                animate={isNew ? { opacity: 1, x: 0, scale: 1 } : {}}
                className={cn(
                  'bg-brand-elevated/20 border rounded-xl overflow-hidden transition-all',
                  isExpanded ? 'border-brand-primary/30 bg-brand-elevated/40' : 'border-brand-border/30 hover:border-brand-border/50',
                  hasError && 'border-red-500/20'
                )}>
                
                <button onClick={() => setSelectedTrace(isExpanded ? null : groupId)}
                  className="w-full p-2.5 flex items-center justify-between text-left hover:bg-brand-elevated/30 transition-colors">
                  
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <span className={cn('text-[8px] font-bold px-1.5 py-0.5 rounded font-mono flex-shrink-0', methodColor)}>
                      {method || 'REQ'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono text-white truncate">{endpointName}</span>
                        {isNew && <span className="text-[7px] font-bold px-1 py-0.5 rounded bg-brand-primary/20 text-brand-primary uppercase animate-pulse">New</span>}
                      </div>
                      <div className="flex items-center gap-1.5 text-[8px] text-brand-text-muted mt-0.5">
                        <span>{groupTraces.length} step{groupTraces.length > 1 ? 's' : ''}</span>
                        <span>·</span>
                        <span>{new Date(firstTrace?.timestamp ?? '').toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0 ml-2">
                    <div className={cn('px-2 py-0.5 rounded-full text-[9px] font-mono font-bold',
                      totalDuration > 500 ? 'bg-red-500/10 text-red-400' : totalDuration > 200 ? 'bg-amber-500/10 text-amber-400' : 'bg-emerald-500/10 text-emerald-400')}>
                      {totalDuration}ms
                    </div>
                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
                      <ArrowDown className="w-3 h-3 text-brand-text-muted" />
                    </motion.div>
                  </div>
                </button>

                {/* Waterfall */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="border-t border-brand-border/20">
                      {groupTraces.map((trace, i) => {
                        const tc = getTraceColor(trace.duration_ms);
                        const widthPercent = Math.max((trace.duration_ms / maxDuration) * 100, 4);
                        const stepLabel = trace.step?.replace(/^(GET|POST|PUT|DELETE|PATCH) /, '') || trace.step;

                        return (
                          <motion.div key={i} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }}
                            className="px-3 py-2 flex items-center gap-3 border-b border-brand-border/10 last:border-0 hover:bg-brand-elevated/20 transition-colors group">
                            <span className="text-[8px] font-mono text-brand-text-muted w-28 truncate flex-shrink-0">{stepLabel}</span>
                            <div className="flex-1 h-1.5 bg-brand-elevated rounded-full overflow-hidden">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ width: `${widthPercent}%` }}
                                transition={{ duration: 0.5, delay: i * 0.06, ease: 'easeOut' }}
                                className={cn('h-full rounded-full relative', tc.bar)}>
                                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/15 to-transparent animate-shimmer" />
                              </motion.div>
                            </div>
                            <span className={cn('text-[9px] font-mono font-bold w-12 text-right flex-shrink-0', tc.text)}>
                              {trace.duration_ms}ms
                            </span>
                            {(trace.error || (trace.status && trace.status >= 400)) && (
                              <AlertTriangle className="w-3 h-3 text-red-400 flex-shrink-0" />
                            )}
                          </motion.div>
                        );
                      })}

                      {/* Total */}
                      <div className="px-3 py-2 flex items-center gap-3 bg-brand-primary/5">
                        <span className="text-[8px] font-mono font-bold text-white uppercase w-28 flex-shrink-0">Total</span>
                        <div className="flex-1 h-2 bg-brand-elevated rounded-full overflow-hidden">
                          <motion.div initial={{ width: 0 }} animate={{ width: `${Math.min((totalDuration / maxDuration) * 100, 100)}%` }}
                            transition={{ duration: 0.6, ease: 'easeOut' }} className="h-full rounded-full bg-white/30" />
                        </div>
                        <span className="text-[9px] font-mono font-bold text-white w-12 text-right flex-shrink-0">{totalDuration}ms</span>
                      </div>

                      {/* Bottleneck */}
                      {groupTraces.length > 1 && (() => {
                        const slowest = groupTraces.reduce((a, b) => a.duration_ms > b.duration_ms ? a : b);
                        const pct = Math.round((slowest.duration_ms / totalDuration) * 100);
                        if (pct > 40) {
                          return (
                            <div className="px-3 py-1.5 bg-red-500/5 border-t border-red-500/10 text-[8px] font-mono text-red-400 flex items-center gap-1.5">
                              <AlertTriangle className="w-3 h-3 flex-shrink-0" />
                              Bottleneck: <span className="text-white font-bold">{slowest.step?.replace(/^(GET|POST|PUT|DELETE|PATCH) /, '')}</span> — {pct}% of time
                            </div>
                          );
                        }
                        return null;
                      })()}
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })
        )}
      </div>

      {/* Footer */}
      <div className="mt-2 pt-2 border-t border-brand-border/30 flex items-center justify-between text-[8px] font-mono text-brand-text-muted shrink-0 relative z-10">
        <span>{totalRequests} traces · {avgDuration}ms avg · {errorCount} errors</span>
        <span className="flex items-center gap-1">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Every 3s
        </span>
      </div>
    </div>
  );
}
