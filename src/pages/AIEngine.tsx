import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { useQuery, useMutation } from '@tanstack/react-query';
import { 
  BrainCircuit, SlidersHorizontal, Activity, Zap, MessageSquareText, 
  Wifi, Cpu, HardDrive, List, Search, Settings2,
  Clock, Share2, Play, Copy, RefreshCw, Sparkles,
  ChevronDown, Trash2, Gauge
} from 'lucide-react';
import { cn } from '../lib/utils';
import { fetchStatus, chatWithAI } from '../lib/api';
import { toast } from 'sonner';

export default function AIEngine() {
  const { restEndpoint, masterToken, payloads, healthMatrix } = useStore();
  const cfg = { restEndpoint, masterToken };
  const chatEndRef = useRef<HTMLDivElement>(null);

  const [chatInput, setChatInput] = useState('');
  const [chatLog, setChatLog] = useState<{ role: 'user' | 'ai'; text: string; tokens?: number; latency?: number }[]>([]);
  const [activePrompt, setActivePrompt] = useState<any>(null);
  const [temperature, setTemperature] = useState(0.7);
  const [topP, setTopP] = useState(0.9);

  const { data: statusData } = useQuery({
    queryKey: ['backend-status', restEndpoint],
    queryFn: () => fetchStatus(cfg),
    retry: 1,
    staleTime: 60_000,
  });

  const chatMut = useMutation({
    mutationFn: (msg: string) => chatWithAI(cfg, msg),
    onSuccess: (d: any) => {
      const reply = d?.response || d?.reply || 'No response received.';
      setChatLog(prev => [...prev, { role: 'ai', text: reply, tokens: d?.tokens_used, latency: d?.latency_ms }]);
    },
    onError: (err: any) => {
      setChatLog(prev => [...prev, { role: 'ai', text: `⚠ ${err?.message || 'Chat request failed.'}` }]);
    },
  });

  const handleSendChat = () => {
    const msg = chatInput.trim();
    if (!msg || chatMut.isPending) return;
    setChatLog(prev => [...prev, { role: 'user', text: msg }]);
    setChatInput('');
    chatMut.mutate(msg);
  };

  useEffect(() => { chatEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [chatLog]);

  const aiService = healthMatrix.find(h => h.id === 'gemini');
  const aiLatency = aiService?.latency || 0;
  const backendModel = statusData?.config?.gemini_model || 'gemini-2.5-flash';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="h-full flex flex-col pb-20 md:pb-0">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-4 shrink-0">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
            <BrainCircuit className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">AI Engine</h1>
            <p className="text-[10px] text-brand-text-muted font-mono uppercase tracking-wider mt-0.5">
              {backendModel} · {aiLatency}ms · {chatLog.length} messages
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <span className="px-2.5 py-1 rounded-full bg-brand-primary/10 text-brand-primary border border-brand-primary/20 text-[10px] font-mono font-bold">
            {backendModel}
          </span>
          <span className={cn('px-2.5 py-1 rounded-full text-[10px] font-mono font-bold border',
            aiLatency < 500 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20')}>
            {aiLatency}ms
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        
        {/* Left: Context + Queue */}
        <div className="flex flex-col gap-4 overflow-hidden">
          {/* Context Memory */}
          <div className="bg-brand-surface border border-brand-border/50 rounded-2xl flex flex-col overflow-hidden shrink-0">
            <div className="p-3 border-b border-brand-border/30 bg-brand-elevated/10 flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase text-brand-text-muted flex items-center gap-2">
                <HardDrive className="w-3 h-3 text-brand-primary" /> Context Memory
              </span>
            </div>
            <div className="p-3 space-y-2 text-[10px] font-mono">
              <div className="p-2.5 bg-brand-elevated/30 border border-brand-border/30 rounded-lg">
                <div className="text-brand-text-muted mb-1">System Prompt</div>
                <div className="text-white truncate">You are an enterprise AI Orchestrator...</div>
              </div>
              <div className="p-2.5 bg-brand-elevated/30 border border-brand-border/30 rounded-lg">
                <div className="text-brand-text-muted mb-1">Active Model</div>
                <div className="text-brand-primary truncate">{statusData?.config?.gemini_model || '—'}</div>
              </div>
            </div>
          </div>

          {/* Inference Queue */}
          <div className="bg-brand-surface border border-brand-border/50 rounded-2xl flex flex-col flex-1 overflow-hidden min-h-0">
            <div className="p-3 border-b border-brand-border/30 bg-brand-elevated/10 flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase text-brand-text-muted flex items-center gap-2">
                <List className="w-3 h-3 text-amber-400" /> Inference Queue
              </span>
              <span className="text-[9px] font-mono bg-amber-500/10 text-amber-400 px-1.5 py-0.5 rounded-full border border-amber-500/20">
                {payloads.length}
              </span>
            </div>
            <div className="flex-1 overflow-y-auto">
              {payloads.length === 0 ? (
                <div className="p-6 text-center text-brand-text-muted text-xs font-mono">Queue empty</div>
              ) : (
                payloads.slice(0, 15).map((p, i) => (
                  <button key={p.id} onClick={() => setActivePrompt(p)}
                    className={cn('w-full text-left p-2.5 border-b border-brand-border/20 hover:bg-brand-elevated/20 transition-colors',
                      activePrompt?.id === p.id && 'bg-brand-primary/10 border-l-2 border-l-brand-primary')}>
                    <div className="flex justify-between mb-0.5">
                      <span className="text-[9px] font-mono text-brand-primary uppercase">{p.method}</span>
                      <span className="text-[8px] font-mono text-brand-text-muted">{new Date(p.time).toLocaleTimeString()}</span>
                    </div>
                    <div className="text-[10px] text-white truncate">{p.endpoint}</div>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Center: Inspector + Chat */}
        <div className="flex flex-col gap-4 overflow-hidden">
          {/* Prompt Inspector */}
          <div className="bg-brand-surface border border-brand-border/50 rounded-2xl flex flex-col overflow-hidden h-1/3 shrink-0">
            <div className="p-3 border-b border-brand-border/30 bg-brand-elevated/10 flex items-center justify-between">
              <span className="text-[10px] font-mono font-bold uppercase text-brand-text-muted flex items-center gap-2">
                <Search className="w-3 h-3 text-emerald-400" /> Prompt Inspector
              </span>
              {activePrompt && (
                <button onClick={() => setActivePrompt(null)} className="text-[9px] text-brand-text-muted hover:text-white">Clear</button>
              )}
            </div>
            <div className="flex-1 overflow-y-auto p-3 font-mono text-[10px] bg-black/30 text-emerald-400 leading-relaxed">
              {activePrompt ? (
                <pre className="whitespace-pre-wrap">{JSON.stringify(activePrompt.request || activePrompt, null, 2)}</pre>
              ) : (
                <span className="text-brand-text-muted">Select a prompt from the queue to inspect...</span>
              )}
            </div>
          </div>

          {/* Live Chat Console */}
          <div className="bg-brand-surface border border-brand-border/50 rounded-2xl flex flex-col flex-1 overflow-hidden min-h-0">
            <div className="p-3 border-b border-brand-border/30 bg-brand-elevated/10 flex items-center justify-between shrink-0">
              <span className="text-[10px] font-mono font-bold uppercase text-brand-text-muted flex items-center gap-2">
                <MessageSquareText className="w-3 h-3 text-brand-primary" /> Live Test Console
              </span>
              <div className="flex items-center gap-2">
                {chatMut.isPending && <Sparkles className="w-3 h-3 text-brand-primary animate-pulse" />}
                {chatLog.length > 0 && (
                  <button onClick={() => setChatLog([])} className="text-[9px] text-brand-text-muted hover:text-red-400">
                    <Trash2 className="w-3 h-3" />
                  </button>
                )}
              </div>
            </div>
            
            <div className="flex-1 overflow-y-auto p-3 space-y-3">
              {chatLog.length === 0 ? (
                <div className="flex items-center justify-center h-full text-brand-text-muted text-xs font-mono">
                  Send a message to test the AI engine
                </div>
              ) : (
                chatLog.map((msg, i) => (
                  <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                    className={cn('flex flex-col max-w-[90%]', msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start')}>
                    <div className={cn('px-3.5 py-2.5 rounded-2xl text-xs leading-relaxed',
                      msg.role === 'user'
                        ? 'bg-brand-primary text-white rounded-br-md'
                        : 'bg-brand-elevated border border-brand-border/30 text-brand-text rounded-bl-md')}>
                      {msg.text}
                    </div>
                    {msg.role === 'ai' && (msg.tokens || msg.latency) && (
                      <div className="flex gap-3 mt-1 text-[9px] font-mono text-brand-text-muted">
                        {msg.tokens && <span>{msg.tokens} tokens</span>}
                        {msg.latency && <span>{msg.latency}ms</span>}
                      </div>
                    )}
                  </motion.div>
                ))
              )}
              <div ref={chatEndRef} />
            </div>

            <div className="p-3 border-t border-brand-border/30 bg-brand-bg/30 shrink-0">
              <div className="flex items-center gap-2">
                <input type="text" value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleSendChat()}
                  placeholder="Test a prompt..."
                  className="flex-1 bg-brand-elevated border border-brand-border/50 rounded-xl px-3.5 py-2.5 text-xs font-mono text-white focus:outline-none focus:border-brand-primary/50 transition-all" />
                <button onClick={handleSendChat} disabled={chatMut.isPending || !chatInput.trim()}
                  className="p-2.5 rounded-xl bg-brand-primary text-white hover:bg-brand-primary/90 disabled:opacity-50 transition-all">
                  <Play className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Right: Controls + Telemetry */}
        <div className="flex flex-col gap-4 overflow-hidden">
          {/* Engine Controls */}
          <div className="bg-brand-surface border border-brand-border/50 rounded-2xl flex flex-col overflow-hidden shrink-0">
            <div className="p-3 border-b border-brand-border/30 bg-brand-elevated/10">
              <span className="text-[10px] font-mono font-bold uppercase text-brand-text-muted flex items-center gap-2">
                <SlidersHorizontal className="w-3 h-3 text-brand-primary" /> Engine Controls
              </span>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <div className="flex justify-between text-[10px] font-mono mb-1.5">
                  <span className="text-brand-text-muted uppercase">Temperature</span>
                  <span className="text-white font-bold">{temperature.toFixed(1)}</span>
                </div>
                <input type="range" min="0" max="2" step="0.1" value={temperature}
                  onChange={e => setTemperature(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-brand-elevated rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-primary" />
              </div>
              <div>
                <div className="flex justify-between text-[10px] font-mono mb-1.5">
                  <span className="text-brand-text-muted uppercase">Top P</span>
                  <span className="text-white font-bold">{topP.toFixed(1)}</span>
                </div>
                <input type="range" min="0" max="1" step="0.05" value={topP}
                  onChange={e => setTopP(parseFloat(e.target.value))}
                  className="w-full h-1.5 bg-brand-elevated rounded-full appearance-none cursor-pointer [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-brand-accent" />
              </div>
              <div className="pt-2 border-t border-brand-border/30">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="text-brand-text-muted uppercase">Provider Failover</span>
                  <span className="text-emerald-400 font-bold">Enabled</span>
                </div>
                <div className="text-[9px] font-mono text-brand-text-muted mt-1">Primary: Google Vertex AI</div>
                <div className="text-[9px] font-mono text-brand-text-muted">Fallback: Anthropic Claude</div>
              </div>
            </div>
          </div>

          {/* Token Telemetry */}
          <div className="bg-brand-surface border border-brand-border/50 rounded-2xl flex flex-col flex-1 overflow-hidden">
            <div className="p-3 border-b border-brand-border/30 bg-brand-elevated/10">
              <span className="text-[10px] font-mono font-bold uppercase text-brand-text-muted flex items-center gap-2">
                <Gauge className="w-3 h-3 text-brand-primary" /> Token Telemetry
              </span>
            </div>
            <div className="p-4 flex-1 flex flex-col justify-center gap-3">
              <div className="flex justify-between items-end pb-2 border-b border-brand-border/30">
                <span className="text-[10px] font-mono text-brand-text-muted uppercase">Chat Temp</span>
                <span className="text-lg font-mono font-bold text-white">{(statusData?.config as any)?.chat_temperature || '—'}</span>
              </div>
              <div className="flex justify-between items-end pb-2 border-b border-brand-border/30">
                <span className="text-[10px] font-mono text-brand-text-muted uppercase">Post Temp</span>
                <span className="text-lg font-mono font-bold text-brand-primary">{(statusData?.config as any)?.post_temperature || '—'}</span>
              </div>
              <div className="flex justify-between items-end pb-2 border-b border-brand-border/30">
                <span className="text-[10px] font-mono text-brand-text-muted uppercase">Total Tokens</span>
                <span className="text-lg font-mono font-bold text-emerald-400">
                  {chatLog.reduce((sum, m) => sum + (m.tokens || 0), 0).toLocaleString()}
                </span>
              </div>
              <div className="flex justify-between items-end">
                <span className="text-[10px] font-mono text-brand-text-muted uppercase">Messages</span>
                <span className="text-lg font-mono font-bold text-amber-400">{chatLog.length}</span>
              </div>
            </div>
          </div>
        </div>

      </div>
    </motion.div>
  );
}
