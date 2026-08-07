import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Terminal as TerminalIcon, X, Maximize2, Minimize2, Trash2, Copy, Check } from 'lucide-react';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { format } from 'date-fns';
import { toast } from 'sonner';

interface LogLine {
  id: string;
  timestamp: Date;
  type: 'info' | 'warning' | 'error' | 'success' | 'command' | 'system';
  content: string;
}

const LOG_COLORS: Record<string, string> = {
  info:    'text-brand-text-muted',
  warning: 'text-amber-400',
  error:   'text-red-400',
  success: 'text-emerald-400',
  command: 'text-white font-bold',
  system:  'text-brand-primary font-bold',
};

const BOOT_SEQUENCE = [
  { type: 'system',  content: 'INITIALIZING KANYOZA PLATFORM v11...', delay: 200 },
  { type: 'info',    content: 'FastAPI + Uvicorn workers online. ASGI lifespan active.', delay: 350 },
  { type: 'success', content: 'Service Container initialized. 24 services registered.', delay: 350 },
  { type: 'info',    content: 'EventBus → SocketIO bridge wired. 7 subscriptions active.', delay: 350 },
  { type: 'system',  content: 'SYSTEM READY. Type /help for commands.', delay: 250 },
];

export default function CommandTerminal() {
  const { 
    isTerminalOpen, toggleTerminal, healthMatrix, pendingCommand, setPendingCommand, 
    stats, restEndpoint, masterToken, personaMood, payloads, messages, socketConnected
  } = useStore();
  
  const [isMaximized, setIsMaximized] = useState(false);
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<LogLine[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [commandHistory, setCommandHistory] = useState<string[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Boot sequence
  useEffect(() => {
    if (isTerminalOpen && history.length === 0) {
      let cumulativeDelay = 0;
      BOOT_SEQUENCE.forEach(log => {
        cumulativeDelay += log.delay;
        setTimeout(() => {
          setHistory(prev => [...prev, {
            id: Math.random().toString(36).substring(2, 11),
            timestamp: new Date(),
            type: log.type as LogLine['type'],
            content: log.content,
          }]);
        }, cumulativeDelay);
      });
    }
  }, [isTerminalOpen, history.length]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [history]);
  useEffect(() => { if (isTerminalOpen) setTimeout(() => inputRef.current?.focus(), 150); }, [isTerminalOpen]);

  // Global Ctrl+`
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === '`') { e.preventDefault(); toggleTerminal(); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [toggleTerminal]);

  const addLog = useCallback((type: LogLine['type'], content: string) => {
    setHistory(prev => [...prev, { id: Math.random().toString(36).substring(2, 11), timestamp: new Date(), type, content }]);
  }, []);

  // ── API helper ──────────────────────────────────────────────────────────

  const apiCall = useCallback(async (path: string, method = 'GET', body?: any) => {
    const base = (restEndpoint || '').replace(/\/+$/, '');
    if (!base) throw new Error('No REST endpoint configured');
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (masterToken) headers['Authorization'] = `Bearer ${masterToken}`;
    
    const res = await fetch(`${base}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
      signal: AbortSignal.timeout(15000),
    });
    return res.json();
  }, [restEndpoint, masterToken]);

  // ── Command handler ─────────────────────────────────────────────────────

  const handleCommand = useCallback(async (cmd: string) => {
    const trimmed = cmd.trim();
    if (!trimmed) return;

    addLog('command', `admin@kanyoza:~$ ${trimmed}`);
    setCommandHistory(prev => [trimmed, ...prev]);
    setHistoryIndex(-1);

    const args = trimmed.toLowerCase().split(' ');
    const main = args[0];

    // Small delay for realism
    await new Promise(r => setTimeout(r, 60));

    try {
      switch (main) {
        // ── Help ──────────────────────────────────────────────────────────
        case '/help':
          addLog('info', 'Available commands:');
          for (const [cmd, desc] of Object.entries(COMMANDS)) {
            addLog('info', `  ${cmd.padEnd(14)} — ${desc}`);
          }
          break;

        // ── Clear ─────────────────────────────────────────────────────────
        case 'clear':
          setHistory([]);
          toast.success('Terminal cleared');
          break;

        // ── Status (real API) ─────────────────────────────────────────────
        case '/status': {
          addLog('info', 'Fetching system health...');
          try {
            const data = await apiCall('/system/health');
            const connectors = data.connectors || data.services || {};
            addLog('system', '── SYSTEM HEALTH ──');
            for (const [name, svc] of Object.entries(connectors)) {
              const s = svc as any;
              const statusType = s.ok || s.status === 'ok' || s.status === 'healthy' ? 'success' : 
                                 s.status === 'degraded' ? 'warning' : 'error';
              const statusLabel = s.ok ? 'OK' : (s.status || 'unknown').toUpperCase();
              addLog(statusType, `[${statusLabel.padEnd(10)}] ${name.padEnd(22)} ${s.latency_ms || s.latency || 0}ms`);
            }
            addLog('system', '── END ──');
          } catch (err: any) {
            addLog('error', `Health check failed: ${err.message}`);
          }
          break;
        }

        // ── Stats (real API) ──────────────────────────────────────────────
        case '/stats': {
          addLog('info', 'Fetching platform statistics...');
          try {
            const data = await apiCall('/dashboard/live');
            const c = data.counters || data || {};
            addLog('system', '── PLATFORM STATS ──');
            addLog('success', `Messages Today:  ${(c.messages_today || 0).toLocaleString()}`);
            addLog('success', `Posts Published: ${(c.posts_today || c.posts_published || 0).toLocaleString()}`);
            addLog('success', `API Calls:       ${(c.events_emitted || c.api_calls_today || 0).toLocaleString()}`);
            addLog('success', `Active Users:    ${(c.active_connections || c.active_users || 0).toLocaleString()}`);
            addLog('success', `Errors:          ${(c.errors || 0).toLocaleString()}`);
            addLog('system', '── END ──');
          } catch (err: any) {
            addLog('error', `Stats fetch failed: ${err.message}`);
          }
          break;
        }

        // ── Health (real API) ─────────────────────────────────────────────
        case '/health': {
          addLog('info', 'Running deep health check...');
          try {
            const data = await apiCall('/health/deep');
            addLog('system', '── DEEP HEALTH ──');
            addLog('success', `Status: ${data.status || 'ok'}`);
            addLog('info', `Version: ${data.version || '?'}`);
            if (data.services) {
              for (const [name, svc] of Object.entries(data.services)) {
                const s = svc as any;
                const type = s.status === 'ok' ? 'success' : s.status === 'error' ? 'error' : 'warning';
                addLog(type, `${name.padEnd(18)} ${s.status}`);
              }
            }
            addLog('system', '── END ──');
          } catch (err: any) {
            addLog('error', `Health check failed: ${err.message}`);
          }
          break;
        }

        // ── Ping ──────────────────────────────────────────────────────────
        case '/ping': {
          const target = (restEndpoint || '').replace(/\/+$/, '');
          addLog('info', `Pinging ${target}/api/v1/status...`);
          const t0 = performance.now();
          try {
            await apiCall('/status');
            const ms = Math.round(performance.now() - t0);
            addLog('success', `✓ Responding — ${ms}ms`);
          } catch (err: any) {
            const ms = Math.round(performance.now() - t0);
            addLog('error', `✗ No response after ${ms}ms — ${err.message}`);
          }
          break;
        }

        // ── Post (real API) ───────────────────────────────────────────────
        case '/post':
          addLog('warning', 'Triggering content post...');
          try {
            const data = await apiCall('/bot/post', 'POST');
            addLog(data.queued ? 'success' : 'warning', data.queued ? '✓ Post queued for publishing' : '⚠ Queue full — try again');
          } catch (err: any) {
            addLog('error', `Post trigger failed: ${err.message}`);
          }
          break;

        // ── News (real API) ───────────────────────────────────────────────
        case '/news':
          addLog('warning', 'Triggering news post...');
          try {
            const data = await apiCall('/bot/news', 'POST');
            addLog(data.queued ? 'success' : 'warning', data.queued ? '✓ News queued' : '⚠ Queue full');
          } catch (err: any) {
            addLog('error', `News trigger failed: ${err.message}`);
          }
          break;

        // ── Engage (real API) ─────────────────────────────────────────────
        case '/engage':
          addLog('warning', 'Triggering engagement run...');
          try {
            const data = await apiCall('/bot/engage', 'POST');
            addLog(data.queued ? 'success' : 'warning', data.queued ? '✓ Engagement triggered' : '⚠ Queue full');
          } catch (err: any) {
            addLog('error', `Engage trigger failed: ${err.message}`);
          }
          break;

        // ── Scan (real API) ───────────────────────────────────────────────
        case '/scan':
          addLog('warning', 'Running Guardian security scan...');
          try {
            const data = await apiCall('/guardian/scan', 'POST');
            addLog('success', `✓ ${data.message || 'Scan initiated'}`);
          } catch (err: any) {
            addLog('error', `Scan failed: ${err.message}`);
          }
          break;

        // ── Keys (real API) ───────────────────────────────────────────────
        case '/keys':
          addLog('info', 'Fetching API keys...');
          try {
            const data = await apiCall('/keys');
            const keys = data.keys || [];
            addLog('system', '── ACTIVE API KEYS ──');
            keys.forEach((k: any) => addLog('info', `${k.prefix || '****'} — ${k.label || 'unnamed'} — ${k.created_at || ''}`));
            addLog('info', `Total: ${keys.length} active keys`);
            addLog('system', '── END ──');
          } catch (err: any) {
            addLog('error', `Key fetch failed: ${err.message}`);
          }
          break;

        // ── Workspaces (real API) ─────────────────────────────────────────
        case '/workspaces':
          addLog('info', 'Fetching workspaces...');
          try {
            const data = await apiCall('/workspaces');
            const ws = data.workspaces || [];
            addLog('system', '── WORKSPACES ──');
            ws.forEach((w: any) => addLog('info', `${w.id} — ${w.name}${w.slug ? ` (${w.slug})` : ''}`));
            addLog('info', `Total: ${ws.length} workspace(s)`);
            addLog('system', '── END ──');
          } catch (err: any) {
            addLog('error', `Workspace fetch failed: ${err.message}`);
          }
          break;

        // ── Plugins (real API) ────────────────────────────────────────────
        case '/plugins':
          addLog('info', 'Fetching industry plugins...');
          try {
            const data = await apiCall('/plugins');
            const plugins = data.plugins || [];
            addLog('system', '── INDUSTRY PLUGINS ──');
            plugins.forEach((p: any) => addLog('info', `${p.name} — ${p.commands?.length || 0} commands, ${p.webhooks?.length || 0} webhooks`));
            addLog('info', `Total: ${plugins.length} plugin(s)`);
            addLog('system', '── END ──');
          } catch (err: any) {
            addLog('error', `Plugin fetch failed: ${err.message}`);
          }
          break;

        // ── Mood ──────────────────────────────────────────────────────────
        case '/mood':
          addLog('system', `Persona: ${personaMood.toUpperCase()} ${({ analytical: '🧠', professional: '💼', creative: '🎨', urgent: '⚡' })[personaMood] || ''}`);
          break;

        // ── Connection ────────────────────────────────────────────────────
        case '/conn':
          addLog('info', `SocketIO: ${socketConnected ? '✓ Connected' : '✗ Disconnected'}`);
          addLog('info', `REST: ${restEndpoint || 'Not configured'}`);
          break;

        // ── Live state ────────────────────────────────────────────────────
        case '/live':
          addLog('info', `Payloads: ${payloads.length} | Messages: ${messages.length} | Services: ${healthMatrix.length}`);
          addLog('info', `Stats — Posts: ${stats.postsPublished} | API: ${stats.apiCalls} | Messages: ${stats.messagesToday}`);
          break;

        // ── Unknown ───────────────────────────────────────────────────────
        default:
          addLog('error', `Unknown command: ${main}. Type /help for available commands.`);
      }
    } catch (err: any) {
      addLog('error', `Command error: ${err.message}`);
    }
  }, [addLog, apiCall, restEndpoint, masterToken, personaMood, socketConnected, payloads, messages, healthMatrix, stats]);

  // FAB pending commands
  useEffect(() => {
    if (pendingCommand) {
      if (!isTerminalOpen) toggleTerminal();
      setTimeout(() => { handleCommand(pendingCommand); setPendingCommand(null); }, 300);
    }
  }, [pendingCommand, isTerminalOpen, toggleTerminal, setPendingCommand, handleCommand]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { handleCommand(input); setInput(''); }
    else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const next = Math.min(historyIndex + 1, commandHistory.length - 1);
      setHistoryIndex(next); setInput(commandHistory[next] || '');
    }
    else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const next = historyIndex - 1;
      setHistoryIndex(next); setInput(next >= 0 ? commandHistory[next] : '');
    }
  };

  const copyLog = (content: string, id: string) => {
    navigator.clipboard.writeText(content);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <AnimatePresence>
      {isTerminalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.25, 0.1, 0.25, 1] }}
          className={cn(
            'fixed z-50 flex flex-col bg-[#09090b]/98 backdrop-blur-xl border border-brand-primary/20 shadow-[0_0_60px_rgba(79,70,229,0.15)] overflow-hidden transition-all duration-300',
            isMaximized ? 'inset-0 md:inset-4 md:rounded-2xl' : 'bottom-4 right-4 w-full max-w-[640px] h-[440px] rounded-2xl md:bottom-6 md:right-24'
          )}>
          
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-2.5 bg-[#09090b] border-b border-brand-border/20 select-none shrink-0">
            <div className="flex items-center gap-2.5">
              <div className={cn('w-2.5 h-2.5 rounded-full', socketConnected ? 'bg-emerald-400 animate-pulse' : 'bg-red-400')} />
              <TerminalIcon className="w-3.5 h-3.5 text-brand-primary" />
              <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted">Terminal</span>
              <span className="text-[8px] font-mono text-brand-text-muted/50 hidden sm:inline">Ctrl+`</span>
            </div>
            <div className="flex items-center gap-1">
              <button onClick={() => { setHistory([]); toast.success('Cleared'); }}
                className="p-1.5 rounded-lg hover:bg-brand-elevated text-brand-text-muted transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
              <button onClick={() => setIsMaximized(!isMaximized)}
                className="p-1.5 rounded-lg hover:bg-brand-elevated text-brand-text-muted transition-colors">
                {isMaximized ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
              </button>
              <button onClick={toggleTerminal}
                className="p-1.5 rounded-lg hover:bg-red-500/10 text-brand-text-muted hover:text-red-400 transition-colors">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Output */}
          <div className="flex-1 overflow-y-auto p-3 font-mono text-xs space-y-0.5" onClick={() => inputRef.current?.focus()}>
            {history.map(log => (
              <motion.div key={log.id} initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }}
                className="flex items-start group hover:bg-brand-elevated/20 rounded px-1.5 py-0.5 -mx-1.5 transition-colors">
                <span className="text-brand-text-muted/40 mr-2 text-[10px] flex-shrink-0 select-none w-16 tabular-nums">
                  {format(log.timestamp, 'HH:mm:ss')}
                </span>
                <span className={cn('break-all whitespace-pre-wrap flex-1', LOG_COLORS[log.type])}>{log.content}</span>
                <button
                  onClick={() => copyLog(log.content, log.id)}
                  className="ml-2 p-0.5 rounded opacity-0 group-hover:opacity-100 text-brand-text-muted hover:text-white flex-shrink-0 transition-all">
                  {copiedId === log.id ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                </button>
              </motion.div>
            ))}
            <div ref={endRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2.5 bg-[#09090b] border-t border-brand-border/20 flex items-center shrink-0">
            <span className="text-emerald-400 font-mono font-bold mr-2 select-none text-xs">admin@kanyoza:~$</span>
            <input ref={inputRef} type="text" value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKeyDown}
              placeholder="/help"
              spellCheck={false} autoComplete="off"
              className="flex-1 bg-transparent border-none outline-none text-white font-mono text-xs placeholder:text-brand-text-muted/30" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// ── Command registry ────────────────────────────────────────────────────────

const COMMANDS: Record<string, string> = {
  '/help':       'Show available commands',
  '/status':     'Live system health from /system/health',
  '/health':     'Deep health check from /health/deep',
  '/stats':      'Platform statistics from /dashboard/live',
  '/ping':       'Ping REST endpoint latency',
  '/post':       'Force publish a content post',
  '/news':       'Force publish a news post',
  '/engage':     'Trigger engagement run',
  '/scan':       'Run Guardian security scan',
  '/keys':       'List active API keys',
  '/workspaces': 'List all workspaces',
  '/plugins':    'List industry plugins',
  '/mood':       'Show current persona mood',
  '/conn':       'Show connection status',
  '/live':       'Show live payload/message counts',
  'clear':       'Clear terminal output',
};
