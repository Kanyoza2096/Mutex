import React, { useState, useRef, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { 
  MessageSquare, Send, Bot, User, RefreshCw, AlertTriangle,
  CheckCircle, XCircle, Sparkles, Trash2, Copy, Terminal,
  ChevronDown, Zap, Shield, Wifi, WifiOff, Clock, Hash,
  ArrowUp, History
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

const QUICK_ACTIONS = [
  { icon: Zap, label: 'System health', message: "What's the system health?" },
  { icon: Shield, label: 'List workspaces', message: 'Show all workspaces' },
  { icon: Sparkles, label: 'Add member', message: 'Add member John Doe phone 0888123456' },
  { icon: Terminal, label: 'Get stats', message: "Show me today's stats" },
];

export default function AIChat() {
  const { restEndpoint, masterToken, socket } = useStore();
  const base = restEndpoint.replace(/\/+$/, '');

  const [messages, setMessages] = useState<{ 
    id: number; role: 'user' | 'assistant' | 'error' | 'system'; 
    content: string; timestamp: number; commandResult?: any; tokens?: number; latency?: number;
  }[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connectionStatus, setConnectionStatus] = useState<'connected' | 'disconnected'>('connected');
  const [showQuickActions, setShowQuickActions] = useState(true);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const inputHistory = useRef<string[]>([]);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (masterToken) headers['Authorization'] = `Bearer ${masterToken}`;

  useEffect(() => { scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }, [messages]);

  useEffect(() => {
    if (!socket) return;
    socket.on('connect', () => setConnectionStatus('connected'));
    socket.on('disconnect', () => setConnectionStatus('disconnected'));
    return () => { socket.off('connect'); socket.off('disconnect'); };
  }, [socket]);

  useEffect(() => {
    if (messages.length === 0) {
      setMessages([{ id: Date.now(), role: 'assistant', content: 'Hello! I\'m Kanyoza AI. I can manage your platform, execute commands, and help with church management. Try a quick action below or type a command.', timestamp: Date.now() }]);
    }
  }, []);

  const handleSend = async (overrideInput?: string) => {
    const text = (overrideInput || input).trim();
    if (!text || loading) return;
    
    // Save to history
    inputHistory.current = [text, ...inputHistory.current.slice(0, 49)];
    setHistoryIndex(-1);

    const t0 = performance.now();
    const userMsg = { id: Date.now(), role: 'user' as const, content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);
    setError(null);
    setShowQuickActions(false);

    try {
      if (!masterToken) throw new Error('API token not configured. Go to Settings to set your master token.');
      
      const res = await fetch(`${base}/ai/chat`, {
        method: 'POST', headers,
        body: JSON.stringify({ message: userMsg.content }),
      });
      const d = await res.json();
      const latency = Math.round(performance.now() - t0);

      if (!res.ok) throw new Error(d.error || d.message || `Server error (HTTP ${res.status})`);

      if (d.model === 'guard') {
        setMessages(prev => [...prev, { id: Date.now() + 1, role: 'error', content: '⚠️ ' + d.reply, timestamp: Date.now() }]);
        return;
      }

      if (d.command_result && !d.command_result.ok) {
        setMessages(prev => [...prev, { id: Date.now() + 1, role: 'error', content: `❌ Command failed: ${d.command_result.message || d.command_result.error || 'Unknown error'}`, timestamp: Date.now(), commandResult: d.command_result }]);
        return;
      }

      setMessages(prev => [...prev, {
        id: Date.now() + 1, role: 'assistant',
        content: d.reply || d.response || d.command_result?.message || 'Command processed.',
        timestamp: Date.now(), commandResult: d.command_result,
        tokens: d.tokens_used, latency,
      }]);
      setError(null);
    } catch (err: any) {
      const errorMsg = err.message || 'AI service unavailable.';
      setError(errorMsg);
      setMessages(prev => [...prev, { id: Date.now() + 1, role: 'error', content: `❌ ${errorMsg}`, timestamp: Date.now() }]);
    } finally {
      setLoading(false);
      inputRef.current?.focus();
    }
  };

  const handleQuickAction = (message: string) => { setInput(message); inputRef.current?.focus(); };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); }
    // Arrow up for history
    if (e.key === 'ArrowUp' && !input) {
      e.preventDefault();
      const newIndex = Math.min(historyIndex + 1, inputHistory.current.length - 1);
      setHistoryIndex(newIndex);
      setInput(inputHistory.current[newIndex] || '');
    }
    if (e.key === 'ArrowDown' && historyIndex >= 0) {
      e.preventDefault();
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setInput(newIndex >= 0 ? inputHistory.current[newIndex] : '');
    }
  };

  const clearChat = () => {
    setMessages([{ id: Date.now(), role: 'assistant', content: 'Chat cleared. How can I help you?', timestamp: Date.now() }]);
    setError(null); setShowQuickActions(true);
  };

  const totalTokens = useMemo(() => messages.reduce((s, m) => s + (m.tokens || 0), 0), [messages]);
  const avgLatency = useMemo(() => {
    const withLatency = messages.filter(m => m.latency);
    return withLatency.length > 0 ? Math.round(withLatency.reduce((s, m) => s + (m.latency || 0), 0) / withLatency.length) : 0;
  }, [messages]);

  return (
    <div className="h-[calc(100vh-100px)] flex flex-col bg-brand-surface border border-brand-border/50 rounded-2xl overflow-hidden shadow-xl">
      
      {/* Header */}
      <div className="p-4 border-b border-brand-border/30 flex justify-between items-center bg-brand-elevated/10 backdrop-blur-sm shrink-0">
        <div className="flex items-center gap-3">
          <motion.div 
            className="w-10 h-10 rounded-xl bg-brand-primary/20 flex items-center justify-center border border-brand-primary/30"
            animate={{ boxShadow: loading ? ['0 0 0px #6366f1', '0 0 16px #6366f140', '0 0 0px #6366f1'] : 'none' }}
            transition={{ duration: 2, repeat: Infinity }}>
            {loading ? <RefreshCw className="w-5 h-5 text-brand-primary animate-spin" /> : <Bot className="w-5 h-5 text-brand-primary" />}
          </motion.div>
          <div>
            <h2 className="text-sm font-bold text-white flex items-center gap-2">
              AI Command Center
              {loading && <span className="text-[10px] font-mono text-brand-primary animate-pulse">processing…</span>}
            </h2>
            <div className="flex items-center gap-3 text-[9px] font-mono text-brand-text-muted">
              <span className={cn('flex items-center gap-1', connectionStatus === 'connected' ? 'text-emerald-400' : 'text-red-400')}>
                <div className={cn('w-1.5 h-1.5 rounded-full', connectionStatus === 'connected' ? 'bg-emerald-400' : 'bg-red-400')} />
                {connectionStatus === 'connected' ? 'Connected' : 'Offline'}
              </span>
              <span className="flex items-center gap-1"><Hash className="w-3 h-3" />{totalTokens.toLocaleString()} tokens</span>
              {avgLatency > 0 && <span className="flex items-center gap-1"><Clock className="w-3 h-3" />{avgLatency}ms avg</span>}
              {!masterToken && <span className="text-red-400">⚠ No token</span>}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <button onClick={() => setShowQuickActions(!showQuickActions)}
            className="p-1.5 rounded-lg text-brand-text-muted hover:text-white hover:bg-brand-elevated transition-all">
            <ChevronDown className={cn('w-4 h-4 transition-transform', showQuickActions ? 'rotate-0' : 'rotate-180')} />
          </button>
          <button onClick={clearChat}
            className="p-1.5 rounded-lg text-brand-text-muted hover:text-red-400 hover:bg-red-500/10 transition-all">
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4" ref={scrollRef}>
        <AnimatePresence>
          {messages.map((msg) => (
            <motion.div key={msg.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className={cn('flex gap-3', msg.role === 'user' ? 'ml-auto flex-row-reverse max-w-[80%] md:max-w-[65%]' : 'max-w-[90%] md:max-w-[75%]')}>
              
              <div className="flex-shrink-0 mt-1">
                {msg.role === 'user' ? (
                  <div className="w-8 h-8 rounded-xl bg-brand-elevated border border-brand-border/30 flex items-center justify-center">
                    <User className="w-4 h-4 text-brand-text-muted" />
                  </div>
                ) : msg.role === 'error' ? (
                  <div className="w-8 h-8 rounded-xl bg-red-500/10 border border-red-500/30 flex items-center justify-center">
                    <AlertTriangle className="w-4 h-4 text-red-400" />
                  </div>
                ) : (
                  <div className="w-8 h-8 rounded-xl bg-brand-primary/20 border border-brand-primary/30 flex items-center justify-center">
                    <Bot className="w-4 h-4 text-brand-primary" />
                  </div>
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className={cn('px-4 py-3 rounded-2xl text-sm leading-relaxed group relative',
                  msg.role === 'user' ? 'bg-brand-primary text-white rounded-tr-sm' :
                  msg.role === 'error' ? 'bg-red-500/10 border border-red-500/30 text-red-300 rounded-tl-sm' :
                  'bg-brand-elevated border border-brand-border/30 text-brand-text rounded-tl-sm')}>
                  
                  {msg.role !== 'user' && (
                    <button onClick={() => { navigator.clipboard.writeText(msg.content); toast.success('Copied'); }}
                      className="absolute top-2 right-2 p-1 rounded opacity-0 group-hover:opacity-100 transition-opacity text-brand-text-muted hover:text-white">
                      <Copy className="w-3 h-3" />
                    </button>
                  )}
                  
                  <div className="whitespace-pre-wrap break-words pr-4">{msg.content}</div>
                  
                  {msg.commandResult && msg.commandResult.ok && msg.commandResult.data && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
                      className="mt-2 pt-2 border-t border-brand-border/30">
                      <div className="text-[10px] font-mono text-brand-text-muted uppercase mb-1">Details</div>
                      <pre className="text-[10px] font-mono text-brand-primary/80 overflow-x-auto">
                        {JSON.stringify(msg.commandResult.data, null, 1)}
                      </pre>
                    </motion.div>
                  )}
                </div>
                
                <div className="flex items-center gap-2 mt-1 px-1">
                  <span className="text-[9px] font-mono text-brand-text-muted/50">
                    {new Date(msg.timestamp).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {msg.tokens && <span className="text-[9px] font-mono text-brand-text-muted/50">{msg.tokens} tok</span>}
                  {msg.latency && <span className="text-[9px] font-mono text-brand-text-muted/50">{msg.latency}ms</span>}
                </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Typing indicator */}
        {loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex gap-3 max-w-[85%]">
            <div className="w-8 h-8 rounded-xl bg-brand-primary/20 border border-brand-primary/30 flex items-center justify-center">
              <RefreshCw className="w-4 h-4 text-brand-primary animate-spin" />
            </div>
            <div className="px-4 py-3 rounded-2xl bg-brand-elevated border border-brand-border/30 rounded-tl-sm">
              <div className="flex items-center gap-2">
                <span className="flex gap-1">
                  {[0, 0.2, 0.4].map(delay => (
                    <motion.span key={delay} className="w-1.5 h-1.5 rounded-full bg-brand-primary"
                      animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 1, repeat: Infinity, delay }} />
                  ))}
                </span>
                <span className="text-xs text-brand-text-muted font-mono">Thinking…</span>
              </div>
            </div>
          </motion.div>
        )}
      </div>

      {/* Error banner */}
      <AnimatePresence>
        {error && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="mx-4 p-3 bg-red-500/5 border border-red-500/20 rounded-xl flex items-center justify-between">
            <div className="flex items-center gap-2 text-xs text-red-400 font-mono">
              <AlertTriangle className="w-3.5 h-3.5 flex-shrink-0" />
              <span className="truncate">{error}</span>
            </div>
            <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300"><XCircle className="w-4 h-4" /></button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick actions */}
      <AnimatePresence>
        {showQuickActions && messages.length <= 2 && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="px-4 pb-2">
            <div className="flex flex-wrap gap-1.5">
              {QUICK_ACTIONS.map(action => (
                <button key={action.label} onClick={() => { setInput(action.message); inputRef.current?.focus(); }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-elevated/50 border border-brand-border/30 hover:border-brand-primary/30 hover:text-brand-primary text-[10px] font-mono text-brand-text-muted rounded-lg transition-all">
                  <action.icon className="w-3 h-3" /> {action.label}
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Input */}
      <div className="p-4 border-t border-brand-border/30 bg-brand-elevated/5 shrink-0">
        <div className="flex items-end gap-2">
          <textarea ref={inputRef} value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={masterToken ? 'Type a command or ask a question...' : '⚠ Configure your API token in Settings first'}
            disabled={!masterToken}
            className="flex-1 bg-brand-elevated border border-brand-border/50 rounded-xl px-4 py-3 min-h-[48px] max-h-32 text-sm text-brand-text resize-none focus:outline-none focus:border-brand-primary/50 disabled:opacity-50 disabled:cursor-not-allowed placeholder:text-brand-text-muted/50 transition-all"
            rows={1} />
          <button onClick={() => handleSend()} disabled={loading || !input.trim() || !masterToken}
            className="h-[48px] px-5 bg-brand-primary hover:bg-brand-primary/90 disabled:opacity-40 disabled:cursor-not-allowed text-white rounded-xl font-bold flex items-center gap-2 transition-all hover:scale-[1.02] active:scale-[0.98] shadow-lg shadow-brand-primary/20">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            Send
          </button>
        </div>
        <div className="flex justify-between items-center mt-2">
          <span className="text-[9px] font-mono text-brand-text-muted/40">
            Enter to send · Shift+Enter for new line · ↑ for history
          </span>
          <span className="text-[9px] font-mono text-brand-text-muted/40">
            {input.length > 0 ? `${input.length} chars` : 'Ready'}
          </span>
        </div>
      </div>
    </div>
  );
}
