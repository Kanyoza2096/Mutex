import React, { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { io, Socket } from 'socket.io-client';
import { 
  Terminal, Play, Square, Trash2, Radio, AlertTriangle, CheckCircle2, 
  ChevronDown, ChevronUp, Copy, Check, Wifi, WifiOff, Clock 
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store/useStore';
import { toast } from 'sonner';

type LogLevel = 'info' | 'success' | 'error' | 'event';

interface LogLine {
  id: string;
  time: string;
  level: LogLevel;
  text: string;
}

const LEVEL_STYLE: Record<LogLevel, string> = {
  info:    'text-brand-text-muted',
  success: 'text-emerald-400',
  error:   'text-red-400',
  event:   'text-sky-400',
};

function toHttp(url: string): string {
  return url.replace(/^wss:\/\//i, 'https://').replace(/^ws:\/\//i, 'http://').replace(/\/+$/, '');
}

export default function SocketDebugPanel() {
  const { wsEndpoint, masterToken } = useStore();

  const [isOpen, setIsOpen] = useState(false);
  const [endpoint, setEndpoint] = useState(toHttp(wsEndpoint));
  const [namespace, setNamespace] = useState('/dashboard');
  const [path, setPath] = useState('/socket.io');
  const [token, setToken] = useState(masterToken);
  const [usePolling, setUsePolling] = useState(true);
  const [useWebsocket, setUseWebsocket] = useState(true);
  const [status, setStatus] = useState<'idle' | 'connecting' | 'connected' | 'error'>('idle');
  const [logs, setLogs] = useState<LogLine[]>([]);
  const [lastWorkingTransport, setLastWorkingTransport] = useState<string | null>(null);
  const [latency, setLatency] = useState<number | null>(null);

  const socketRef = useRef<Socket | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  const pushLog = useCallback((level: LogLevel, text: string) => {
    setLogs(prev => [
      ...prev.slice(-299),
      { id: `${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, time: new Date().toLocaleTimeString(), level, text },
    ]);
  }, []);

  useEffect(() => { logEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [logs]);

  const disconnect = useCallback((silent = false) => {
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
      socketRef.current = null;
      if (!silent) pushLog('info', 'Disconnected');
    }
    setStatus('idle');
    setLatency(null);
  }, [pushLog]);

  const connect = useCallback(() => {
    if (socketRef.current) disconnect(true);

    const transports: string[] = [];
    if (usePolling) transports.push('polling');
    if (useWebsocket) transports.push('websocket');
    if (transports.length === 0) {
      pushLog('error', 'Select at least one transport');
      return;
    }

    const base = toHttp(endpoint);
    const ns = namespace.startsWith('/') ? namespace : `/${namespace}`;
    const target = `${base}${ns}`;

    pushLog('info', `Connecting to ${target} [${transports.join(', ')}]`);
    setStatus('connecting');

    const t0 = performance.now();
    const socket = io(target, {
      path, transports,
      query: { token },
      auth: { token },
      reconnection: false,
      timeout: 15000,
    });
    socketRef.current = socket;

    socket.on('connect', () => {
      setStatus('connected');
      setLatency(Math.round(performance.now() - t0));
      const t = socket.io.engine?.transport?.name ?? 'unknown';
      setLastWorkingTransport(t);
      pushLog('success', `✓ Connected · ${t} · ID: ${socket.id?.slice(0, 12)}… · ${Math.round(performance.now() - t0)}ms`);
    });

    socket.io.engine?.on?.('upgrade', (t: any) => {
      setLastWorkingTransport(t?.name ?? null);
      pushLog('info', `↑ Upgraded to ${t?.name}`);
    });

    socket.on('connect_error', (err: any) => {
      setStatus('error');
      pushLog('error', `✗ ${err?.message || String(err)}`);
    });

    socket.on('disconnect', (reason: string) => {
      setStatus('idle');
      pushLog('info', `Disconnected: ${reason}`);
    });

    // Event logging
    socket.on('stats', (data: any) => pushLog('event', `📊 stats: ${JSON.stringify(data).slice(0, 200)}`));
    socket.onAny((eventName: string, ...args: any[]) => {
      if (['connect', 'connect_error', 'disconnect', 'error', 'stats'].includes(eventName)) return;
      pushLog('event', `${eventName}: ${JSON.stringify(args).slice(0, 200)}`);
    });
  }, [endpoint, namespace, path, token, usePolling, useWebsocket, pushLog, disconnect]);

  useEffect(() => { return () => { disconnect(true); }; }, []);

  const statusMeta = {
    idle:       { label: 'Idle',       icon: Radio,          color: 'text-zinc-400', bg: 'bg-zinc-500/10', border: 'border-zinc-500/20' },
    connecting: { label: 'Connecting', icon: Radio,          color: 'text-amber-400', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
    connected:  { label: 'Connected',  icon: CheckCircle2,   color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
    error:      { label: 'Error',      icon: AlertTriangle,  color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
  }[status];
  const StatusIcon = statusMeta.icon;

  return (
    <div className="bg-brand-surface border border-brand-border/50 rounded-2xl overflow-hidden">
      {/* Header */}
      <button onClick={() => setIsOpen(v => !v)}
        className="w-full flex items-center justify-between px-5 py-4 hover:bg-brand-elevated/10 transition-colors">
        <div className="flex items-center gap-2.5">
          <div className="p-1.5 bg-brand-primary/10 rounded-lg border border-brand-primary/20">
            <Terminal className="w-3.5 h-3.5 text-brand-primary" />
          </div>
          <div>
            <h2 className="text-xs font-bold text-white uppercase tracking-wider">Socket.IO Debug Console</h2>
            <p className="text-[9px] font-mono text-brand-text-muted mt-0.5">
              {status === 'connected' ? `${lastWorkingTransport || 'connected'} · ${latency}ms` : 'Raw connection tester'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <span className={cn('flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase border', statusMeta.bg, statusMeta.color, statusMeta.border)}>
            <StatusIcon className={cn('w-3 h-3', status === 'connecting' && 'animate-pulse')} />
            {statusMeta.label}
          </span>
          {isOpen ? <ChevronUp className="w-4 h-4 text-brand-text-muted" /> : <ChevronDown className="w-4 h-4 text-brand-text-muted" />}
        </div>
      </button>

      {/* Body */}
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25 }} className="overflow-hidden">
            <div className="px-5 pb-5 space-y-4 border-t border-brand-border/30 pt-4">
              
              <p className="text-[10px] text-brand-text-muted font-mono leading-relaxed">
                Test raw Socket.IO connections independently from the main dashboard. Isolate auth, transport, and namespace issues.
              </p>

              {/* Config grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <div>
                  <label className="text-[9px] font-mono font-bold uppercase text-brand-text-muted mb-1 block">Endpoint</label>
                  <input type="text" value={endpoint} onChange={e => setEndpoint(e.target.value)}
                    disabled={status === 'connected' || status === 'connecting'}
                    className="w-full bg-brand-elevated border border-brand-border/50 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-brand-primary/50 disabled:opacity-40 transition-all" />
                </div>
                <div>
                  <label className="text-[9px] font-mono font-bold uppercase text-brand-text-muted mb-1 block">Namespace</label>
                  <input type="text" value={namespace} onChange={e => setNamespace(e.target.value)}
                    disabled={status === 'connected' || status === 'connecting'}
                    className="w-full bg-brand-elevated border border-brand-border/50 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-brand-primary/50 disabled:opacity-40 transition-all" />
                </div>
                <div>
                  <label className="text-[9px] font-mono font-bold uppercase text-brand-text-muted mb-1 block">Path</label>
                  <input type="text" value={path} onChange={e => setPath(e.target.value)}
                    disabled={status === 'connected' || status === 'connecting'}
                    className="w-full bg-brand-elevated border border-brand-border/50 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-brand-primary/50 disabled:opacity-40 transition-all" />
                </div>
                <div>
                  <label className="text-[9px] font-mono font-bold uppercase text-brand-text-muted mb-1 block">Token</label>
                  <input type="text" value={token} onChange={e => setToken(e.target.value)}
                    disabled={status === 'connected' || status === 'connecting'}
                    className="w-full bg-brand-elevated border border-brand-border/50 rounded-lg px-3 py-2 text-xs font-mono text-white focus:outline-none focus:border-brand-primary/50 disabled:opacity-40 transition-all" />
                </div>
              </div>

              {/* Transports */}
              <div className="flex items-center gap-4">
                <label className="flex items-center gap-1.5 text-[10px] font-mono text-white cursor-pointer">
                  <input type="checkbox" checked={usePolling} onChange={e => setUsePolling(e.target.checked)}
                    disabled={status === 'connected' || status === 'connecting'} className="accent-brand-primary" />
                  Polling
                </label>
                <label className="flex items-center gap-1.5 text-[10px] font-mono text-white cursor-pointer">
                  <input type="checkbox" checked={useWebsocket} onChange={e => setUseWebsocket(e.target.checked)}
                    disabled={status === 'connected' || status === 'connecting'} className="accent-brand-primary" />
                  WebSocket
                </label>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button onClick={connect} disabled={status === 'connected' || status === 'connecting'}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-bold font-mono uppercase tracking-wider hover:bg-brand-primary/90 disabled:opacity-40 transition-all">
                  <Play className="w-3.5 h-3.5" /> Connect
                </button>
                <button onClick={() => disconnect()} disabled={status === 'idle'}
                  className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl bg-brand-surface border border-brand-border/50 text-white text-xs font-bold font-mono uppercase tracking-wider hover:border-red-500/30 hover:text-red-400 disabled:opacity-40 transition-all">
                  <Square className="w-3.5 h-3.5" /> Disconnect
                </button>
                <button onClick={() => setLogs([])}
                  className="px-3 py-2.5 rounded-xl bg-brand-surface border border-brand-border/50 text-brand-text-muted hover:text-white transition-all">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Log output */}
              <div className="bg-black/30 rounded-xl border border-brand-border/30 p-3 h-64 overflow-y-auto font-mono text-[10px] leading-relaxed">
                {logs.length === 0 ? (
                  <p className="text-brand-text-muted/40 italic">No output — click Connect to test.</p>
                ) : (
                  logs.map(line => (
                    <div key={line.id} className="flex gap-2 hover:bg-white/[0.02] rounded px-1">
                      <span className="text-brand-text-muted/40 flex-shrink-0 select-none">[{line.time}]</span>
                      <span className={cn('break-all', LEVEL_STYLE[line.level])}>{line.text}</span>
                    </div>
                  ))
                )}
                <div ref={logEndRef} />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
