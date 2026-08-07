import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  RefreshCw, Zap, WifiOff, Wifi, Clock, AlertTriangle, ExternalLink,
  Activity, Server, CheckCircle2, XCircle
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store/useStore';
import { formatDistanceToNow } from 'date-fns';
import { toast } from 'sonner';

type BackendStatus = 'checking' | 'online' | 'waking' | 'offline' | 'error';

interface PingResult {
  status: BackendStatus;
  httpCode: number | null;
  latencyMs: number | null;
  checkedAt: Date;
  errorHint: string | null;
}

const BACKEND_URL = 'https://kanyoza-systems-bot.onrender.com';
const POLL_INTERVAL_MS = 120_000;
const WAKE_TIMEOUT_MS = 70_000;
const PING_TIMEOUT_MS = 12_000;

function deriveStatus(httpCode: number | null): { status: BackendStatus; hint: string | null } {
  if (httpCode === null) return { status: 'offline', hint: 'No response — backend may be sleeping or crashed.' };
  if (httpCode === 502) return { status: 'error', hint: '502 Bad Gateway — app process crashed. Check Render logs.' };
  if (httpCode === 503) return { status: 'error', hint: '503 Service Unavailable — Render cold-starting.' };
  if (httpCode >= 200 && httpCode < 300) return { status: 'online', hint: null };
  return { status: 'error', hint: `HTTP ${httpCode} — unexpected response.` };
}

async function pingBackend(signal: AbortSignal): Promise<{ httpCode: number | null; latencyMs: number }> {
  const t0 = performance.now();
  try {
    const res = await fetch(`${BACKEND_URL}/api/v1/status`, { method: 'GET', signal, cache: 'no-store' });
    return { httpCode: res.status, latencyMs: Math.round(performance.now() - t0) };
  } catch {
    return { httpCode: null, latencyMs: Math.round(performance.now() - t0) };
  }
}

// ── Status config ──────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<BackendStatus, { label: string; color: string; bg: string; border: string; icon: React.ComponentType<{ className?: string }> }> = {
  checking: { label: 'Checking', color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20', icon: RefreshCw },
  online:   { label: 'Online',  color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', icon: Wifi },
  waking:   { label: 'Waking',  color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20', icon: Zap },
  offline:  { label: 'Offline', color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20', icon: WifiOff },
  error:    { label: 'Error',   color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20', icon: AlertTriangle },
};

// ── Latency mini sparkline ─────────────────────────────────────────────────

function LatencyBar({ ms, max = 3000 }: { ms: number | null; max?: number }) {
  if (ms === null) return <div className="h-1.5 bg-brand-elevated rounded-full" />;
  const pct = Math.min((ms / max) * 100, 100);
  const color = ms < 500 ? 'bg-emerald-400' : ms < 1500 ? 'bg-amber-400' : 'bg-red-400';
  return (
    <div className="h-1.5 bg-brand-elevated rounded-full overflow-hidden">
      <div className={cn('h-full rounded-full transition-all duration-500', color)} style={{ width: `${pct}%` }} />
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════

export default function BackendStatusCard() {
  const { masterToken } = useStore();
  const [result, setResult] = useState<PingResult | null>(null);
  const [waking, setWaking] = useState(false);
  const [wakeProgress, setWakeProgress] = useState(0);
  const [pingHistory, setPingHistory] = useState<number[]>([]);
  const abortRef = useRef<AbortController | null>(null);
  const wakeTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const pollTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const runPing = useCallback(async () => {
    const ac = new AbortController();
    abortRef.current = ac;
    const timeout = setTimeout(() => ac.abort(), PING_TIMEOUT_MS);
    const { httpCode, latencyMs } = await pingBackend(ac.signal);
    clearTimeout(timeout);
    const { status, hint } = deriveStatus(httpCode);
    setResult({ status, httpCode, latencyMs, checkedAt: new Date(), errorHint: hint });
    if (latencyMs !== null) setPingHistory(prev => [...prev.slice(-19), latencyMs]);
    return status;
  }, []);

  useEffect(() => {
    runPing();
    const schedule = () => {
      pollTimer.current = setTimeout(async () => {
        if (document.visibilityState === 'visible') await runPing();
        schedule();
      }, POLL_INTERVAL_MS);
    };
    schedule();
    return () => {
      abortRef.current?.abort();
      if (pollTimer.current) clearTimeout(pollTimer.current);
    };
  }, [runPing]);

  const handleWake = useCallback(async () => {
    if (waking) return;
    setWaking(true); setWakeProgress(0);
    if (pollTimer.current) clearTimeout(pollTimer.current);

    const startedAt = Date.now();
    wakeTimer.current = setInterval(() => {
      setWakeProgress(Math.min(((Date.now() - startedAt) / WAKE_TIMEOUT_MS) * 100, 97));
    }, 500);

    const ac = new AbortController();
    abortRef.current = ac;
    const timeout = setTimeout(() => ac.abort(), WAKE_TIMEOUT_MS);
    try {
      await fetch(`${BACKEND_URL}/api/v1/status`, {
        method: 'GET', signal: ac.signal, cache: 'no-store',
        headers: { Authorization: `Bearer ${masterToken}` },
      });
    } catch { /* timeout */ }
    clearTimeout(timeout);
    if (wakeTimer.current) clearInterval(wakeTimer.current);
    setWakeProgress(100);

    const finalStatus = await runPing();
    if (finalStatus === 'online') toast.success('Backend is now online');
    else toast.error('Backend did not respond');

    setTimeout(() => {
      setWaking(false); setWakeProgress(0);
      pollTimer.current = setTimeout(async () => { await runPing(); }, POLL_INTERVAL_MS);
    }, 600);
  }, [waking, masterToken, runPing]);

  const current = result?.status ?? 'checking';
  const config = STATUS_CONFIG[current];
  const StatusIcon = config.icon;
  const avgLatency = pingHistory.length > 0 ? Math.round(pingHistory.reduce((a, b) => a + b, 0) / pingHistory.length) : null;

  return (
    <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-5 relative overflow-hidden group">
      
      {/* Top accent */}
      {current === 'online' && <motion.div className="absolute top-0 left-0 w-full h-0.5 bg-emerald-400" initial={{ scaleX: 0 }} animate={{ scaleX: 1 }} transition={{ duration: 0.6 }} />}
      {current === 'error' && <div className="absolute top-0 left-0 w-full h-0.5 bg-red-400 animate-pulse" />}

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xs font-bold text-white uppercase tracking-wider flex items-center gap-2">
            <Server className="w-3.5 h-3.5 text-brand-primary" /> Backend Engine
          </h2>
          <p className="text-[9px] font-mono text-brand-text-muted mt-0.5">{BACKEND_URL.replace('https://', '')}</p>
        </div>
        <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold font-mono uppercase border', config.bg, config.color, config.border)}>
          <StatusIcon className={cn('w-3 h-3', current === 'checking' && 'animate-spin', current === 'waking' && 'animate-pulse')} />
          {config.label}
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-brand-bg/50 rounded-xl p-2.5 text-center">
          <p className="text-[8px] font-mono text-brand-text-muted uppercase mb-1">Latency</p>
          <p className={cn('text-base font-mono font-bold', 
            result?.latencyMs == null ? 'text-brand-text-muted' : result.latencyMs < 500 ? 'text-emerald-400' : result.latencyMs < 1500 ? 'text-amber-400' : 'text-red-400')}>
            {result?.latencyMs ?? '—'}<span className="text-[9px] font-normal text-brand-text-muted ml-0.5">ms</span>
          </p>
        </div>
        <div className="bg-brand-bg/50 rounded-xl p-2.5 text-center">
          <p className="text-[8px] font-mono text-brand-text-muted uppercase mb-1">HTTP</p>
          <p className={cn('text-base font-mono font-bold',
            result?.httpCode == null ? 'text-brand-text-muted' : result.httpCode < 300 ? 'text-emerald-400' : result.httpCode < 500 ? 'text-amber-400' : 'text-red-400')}>
            {result?.httpCode ?? '—'}
          </p>
        </div>
        <div className="bg-brand-bg/50 rounded-xl p-2.5 text-center">
          <p className="text-[8px] font-mono text-brand-text-muted uppercase mb-1">Avg</p>
          <p className={cn('text-base font-mono font-bold',
            avgLatency == null ? 'text-brand-text-muted' : avgLatency < 500 ? 'text-emerald-400' : avgLatency < 1500 ? 'text-amber-400' : 'text-red-400')}>
            {avgLatency ?? '—'}<span className="text-[9px] font-normal text-brand-text-muted ml-0.5">ms</span>
          </p>
        </div>
      </div>

      {/* Latency sparkline */}
      {pingHistory.length > 1 && (
        <div className="flex items-end gap-px h-6 mb-3">
          {pingHistory.map((ms, i) => (
            <div key={i} className="flex-1 rounded-t-sm" style={{ 
              height: `${Math.max(4, (ms / Math.max(...pingHistory, 1)) * 100)}%`,
              backgroundColor: ms < 500 ? '#34d399' : ms < 1500 ? '#f59e0b' : '#ef4444',
              opacity: 0.5 + (ms / Math.max(...pingHistory, 1)) * 0.5,
            }} />
          ))}
        </div>
      )}

      {/* Error hint */}
      <AnimatePresence>
        {result?.errorHint && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="mb-3 px-3 py-2 bg-red-500/5 border border-red-500/20 rounded-lg text-[10px] font-mono text-red-400 leading-relaxed">
            <AlertTriangle className="w-3 h-3 inline mr-1.5" /> {result.errorHint}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Wake progress */}
      <AnimatePresence>
        {waking && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} className="mb-3">
            <div className="flex justify-between text-[9px] font-mono text-brand-text-muted mb-1.5">
              <span>Waking Render dyno…</span>
              <span>{Math.round(wakeProgress)}%</span>
            </div>
            <div className="w-full h-1.5 bg-brand-elevated rounded-full overflow-hidden">
              <motion.div className="h-full bg-amber-400 rounded-full" style={{ width: `${wakeProgress}%` }} transition={{ duration: 0.5 }} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Actions */}
      <div className="flex gap-1.5">
        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }}
          onClick={handleWake} disabled={waking || current === 'checking'}
          className={cn('flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-xl text-[10px] font-bold font-mono uppercase tracking-wider transition-all',
            waking ? 'bg-amber-500/15 text-amber-400 border border-amber-500/30' :
            current === 'online' ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 hover:bg-emerald-500/20' :
            'bg-brand-primary text-white hover:bg-brand-primary/90 shadow-glow-primary')}>
          {waking ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
          {waking ? 'Waking…' : current === 'online' ? 'Online' : 'Wake'}
        </motion.button>
        <button onClick={() => !waking && runPing()} disabled={waking}
          className="p-2 rounded-xl bg-brand-elevated border border-brand-border/50 text-brand-text-muted hover:text-white transition-all">
          <RefreshCw className={cn('w-3.5 h-3.5', current === 'checking' && 'animate-spin')} />
        </button>
        <a href="https://dashboard.render.com" target="_blank" rel="noreferrer"
          className="p-2 rounded-xl bg-brand-elevated border border-brand-border/50 text-brand-text-muted hover:text-white transition-all">
          <ExternalLink className="w-3.5 h-3.5" />
        </a>
      </div>

      {/* Poll indicator */}
      <div className="flex items-center gap-1.5 mt-2.5">
        <div className="w-1.5 h-1.5 rounded-full bg-brand-primary animate-pulse" />
        <span className="text-[8px] font-mono text-brand-text-muted">Auto-check every 2m</span>
        {result?.checkedAt && (
          <span className="text-[8px] font-mono text-brand-text-muted ml-auto">
            {formatDistanceToNow(result.checkedAt, { addSuffix: true })}
          </span>
        )}
      </div>
    </div>
  );
}
