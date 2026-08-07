import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Network, Search, Filter, Server, ArrowRightLeft, Clock, Zap, 
  CheckCircle2, AlertCircle, Copy, Check, Activity, XCircle,
  Download, Trash2, Eye, Code2, Layers, Wifi, WifiOff
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore, PayloadLog } from '../store/useStore';
import { toast } from 'sonner';

// ── Method color config ────────────────────────────────────────────────────

const METHOD_COLORS: Record<string, string> = {
  GET: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
  POST: 'bg-violet-500/10 text-violet-400 border-violet-500/20',
  PUT: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  PATCH: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
  DELETE: 'bg-red-500/10 text-red-400 border-red-500/20',
};

// ── JSON syntax highlighter (basic) ────────────────────────────────────────

function JsonViewer({ data }: { data: any }) {
  const formatted = JSON.stringify(data, null, 2);
  const highlighted = formatted
    .replace(/(".*?")(?=\s*:)/g, '<span class="text-sky-400">$1</span>')  // keys
    .replace(/: (".*?")/g, ': <span class="text-emerald-400">$1</span>')   // string values
    .replace(/: (\d+\.?\d*)/g, ': <span class="text-amber-400">$1</span>') // numbers
    .replace(/: (true|false)/g, ': <span class="text-violet-400">$1</span>') // booleans
    .replace(/: (null)/g, ': <span class="text-zinc-500">$1</span>');       // null

  return (
    <pre 
      className="font-mono text-xs leading-relaxed overflow-x-auto"
      dangerouslySetInnerHTML={{ __html: highlighted }}
    />
  );
}

// ── Empty state ────────────────────────────────────────────────────────────

function EmptyState({ icon: Icon, label }: { icon: React.ComponentType<any>; label: string }) {
  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-brand-text-muted font-mono text-xs opacity-50">
      <Icon className="w-10 h-10 mb-3 text-brand-border" />
      <span className="uppercase tracking-wider">{label}</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════

export default function PayloadInspector() {
  const { payloads, socketConnected } = useStore();
  const [selectedReq, setSelectedReq] = useState<PayloadLog | null>(null);
  const [filter, setFilter] = useState('all');
  const [methodFilter, setMethodFilter] = useState('all');
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'split' | 'request' | 'response'>('split');

  useEffect(() => {
    if (payloads.length > 0 && !selectedReq) {
      setSelectedReq(payloads[0]);
    }
  }, [payloads, selectedReq]);

  const currentReq = selectedReq 
    ? (payloads.find(p => p.id === selectedReq.id) || selectedReq)
    : (payloads[0] || null);

  // ── Filtered payloads ────────────────────────────────────────────────────

  const filteredPayloads = useMemo(() => {
    return payloads.filter(p => {
      if (filter === 'errors' && p.status < 400) return false;
      if (filter === 'inbound' && p.type !== 'inbound') return false;
      if (filter === 'outbound' && p.type !== 'outbound') return false;
      if (methodFilter !== 'all' && p.method !== methodFilter) return false;
      if (search.trim()) {
        const q = search.toLowerCase();
        return p.id.toLowerCase().includes(q) || 
               p.endpoint.toLowerCase().includes(q) || 
               p.method.toLowerCase().includes(q) ||
               JSON.stringify(p.request).toLowerCase().includes(q) ||
               JSON.stringify(p.response).toLowerCase().includes(q);
      }
      return true;
    });
  }, [payloads, filter, methodFilter, search]);

  // ── Stats ────────────────────────────────────────────────────────────────

  const stats = useMemo(() => ({
    total: payloads.length,
    errors: payloads.filter(p => p.status >= 400).length,
    avgLatency: payloads.length > 0 
      ? Math.round(payloads.reduce((s, p) => s + (parseInt(p.latency) || 0), 0) / payloads.length) 
      : 0,
    methods: [...new Set(payloads.map(p => p.method))],
  }), [payloads]);

  // ── Helpers ──────────────────────────────────────────────────────────────

  const copyToClipboard = async (text: string) => {
    await navigator.clipboard.writeText(text);
    toast.success('Copied to clipboard');
  };

  const clearPayloads = () => {
    useStore.setState({ payloads: [] });
    setSelectedReq(null);
    toast.success('Payload log cleared');
  };

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} 
      className="max-w-7xl mx-auto lg:h-[calc(100vh-8rem)] h-auto flex flex-col space-y-4">
      
      {/* Header */}
      <div className="flex-shrink-0 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
            <Network className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Payload Inspector</h1>
            <p className="text-[10px] text-brand-text-muted font-mono uppercase tracking-wider mt-0.5">
              {stats.total} requests · {stats.errors} errors · {stats.avgLatency}ms avg
              {socketConnected ? (
                <span className="text-emerald-400 ml-2">● Live</span>
              ) : (
                <span className="text-amber-400 ml-2">● Buffered</span>
              )}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Method filter */}
          <div className="flex gap-0.5 p-0.5 bg-brand-surface border border-brand-border/50 rounded-lg">
            {['all', 'GET', 'POST', 'PUT', 'DELETE'].map(m => (
              <button key={m} onClick={() => setMethodFilter(m)}
                className={cn('px-2.5 py-1 rounded-md text-[9px] font-mono font-bold uppercase transition-all',
                  methodFilter === m ? 'bg-brand-primary text-white' : 'text-brand-text-muted hover:text-white')}>
                {m}
              </button>
            ))}
          </div>

          {/* Type filter */}
          <div className="flex gap-0.5 p-0.5 bg-brand-surface border border-brand-border/50 rounded-lg">
            {['all', 'inbound', 'outbound', 'errors'].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                className={cn('px-2.5 py-1 rounded-md text-[9px] font-mono font-bold uppercase transition-all',
                  filter === f ? 'bg-brand-primary text-white' : 'text-brand-text-muted hover:text-white')}>
                {f === 'errors' ? 'Errors' : f}
              </button>
            ))}
          </div>

          <button onClick={clearPayloads}
            className="p-2 rounded-lg bg-brand-surface border border-brand-border/50 hover:border-red-500/30 text-brand-text-muted hover:text-red-400 transition-all">
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Main Grid */}
      <div className="flex-1 grid grid-cols-1 lg:grid-cols-3 gap-4 lg:min-h-0 min-h-[600px]">
        
        {/* Left: Log Stream */}
        <div className="lg:col-span-1 bg-brand-surface border border-brand-border/50 rounded-2xl flex flex-col overflow-hidden">
          <div className="p-3 border-b border-brand-border/30 flex items-center gap-2 bg-brand-elevated/10">
            <Search className="w-3.5 h-3.5 text-brand-text-muted flex-shrink-0" />
            <input 
              type="text" value={search} onChange={e => setSearch(e.target.value)}
              placeholder="Search endpoints, IDs, JSON..."
              className="flex-1 bg-transparent text-xs text-brand-text placeholder-brand-text-muted font-mono focus:outline-none" />
            <span className="text-[9px] text-brand-text-muted font-mono flex-shrink-0">{filteredPayloads.length}</span>
          </div>
          
          <div className="flex-1 overflow-y-auto p-2 space-y-1">
            <AnimatePresence initial={false}>
              {filteredPayloads.map(req => {
                const methodColor = METHOD_COLORS[req.method] || METHOD_COLORS.GET;
                const isSelected = currentReq?.id === req.id;
                const isError = req.status >= 400;

                return (
                  <motion.button
                    key={req.id}
                    initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0 }}
                    onClick={() => setSelectedReq(req)}
                    className={cn(
                      'w-full text-left p-3 rounded-xl border transition-all relative group',
                      isSelected 
                        ? 'bg-brand-elevated/80 border-brand-primary/40 shadow-lg' 
                        : 'bg-brand-bg/40 border-transparent hover:border-brand-border/50 hover:bg-brand-elevated/30'
                    )}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className={cn('text-[9px] font-bold font-mono uppercase px-1.5 py-0.5 rounded', methodColor)}>
                        {req.method}
                      </span>
                      <span className="text-[9px] font-mono text-brand-text-muted">{req.time}</span>
                    </div>
                    
                    <p className="font-mono text-[10px] text-brand-text truncate mb-1.5">{req.endpoint}</p>
                    
                    <div className="flex items-center justify-between text-[9px] font-mono">
                      <span className={cn('flex items-center gap-1', isError ? 'text-red-400' : 'text-emerald-400')}>
                        {isError ? <XCircle className="w-3 h-3" /> : <CheckCircle2 className="w-3 h-3" />}
                        {req.status}
                      </span>
                      <span className="text-brand-text-muted">{req.latency}</span>
                    </div>

                    {isSelected && <div className="absolute left-0 top-1 bottom-1 w-0.5 bg-brand-primary rounded-full" />}
                  </motion.button>
                );
              })}
            </AnimatePresence>

            {filteredPayloads.length === 0 && (
              <EmptyState icon={Network} label="No payloads match your filters" />
            )}
          </div>
        </div>

        {/* Right: Inspector */}
        <div className="lg:col-span-2 bg-brand-surface border border-brand-border/50 rounded-2xl flex flex-col overflow-hidden">
          {currentReq ? (
            <>
              {/* Header */}
              <div className="p-3 border-b border-brand-border/30 flex items-center justify-between bg-brand-elevated/10 shrink-0">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="text-[10px] font-mono font-bold text-brand-primary bg-brand-primary/10 px-2 py-0.5 rounded flex-shrink-0">
                    {currentReq.id}
                  </span>
                  <span className="text-xs font-mono text-brand-text truncate">{currentReq.endpoint}</span>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <span className={cn('text-[9px] font-mono font-bold uppercase px-2 py-0.5 rounded-full',
                    currentReq.type === 'inbound' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-violet-500/10 text-violet-400')}>
                    {currentReq.type}
                  </span>
                  {/* View toggle */}
                  <div className="flex gap-0.5 p-0.5 bg-brand-elevated rounded-lg">
                    {(['split', 'request', 'response'] as const).map(m => (
                      <button key={m} onClick={() => setViewMode(m)}
                        className={cn('px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase transition-all',
                          viewMode === m ? 'bg-brand-primary text-white' : 'text-brand-text-muted')}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
              
              {/* Content */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {(viewMode === 'split' || viewMode === 'request') && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-[10px] font-mono font-bold uppercase text-violet-400 flex items-center gap-2">
                        <Server className="w-3.5 h-3.5" /> Request
                      </h3>
                      <button onClick={() => copyToClipboard(JSON.stringify(currentReq.request, null, 2))}
                        className="flex items-center gap-1 text-[9px] font-mono text-brand-text-muted hover:text-white transition-colors">
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                    </div>
                    <div className="bg-brand-bg/50 rounded-xl border border-brand-border/30 p-4 overflow-x-auto">
                      <JsonViewer data={currentReq.request} />
                    </div>
                  </div>
                )}

                {(viewMode === 'split' || viewMode === 'response') && (
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h3 className={cn('text-[10px] font-mono font-bold uppercase flex items-center gap-2',
                        currentReq.status < 400 ? 'text-emerald-400' : 'text-red-400')}>
                        {currentReq.status < 400 ? <CheckCircle2 className="w-3.5 h-3.5" /> : <XCircle className="w-3.5 h-3.5" />}
                        Response ({currentReq.status})
                      </h3>
                      <button onClick={() => copyToClipboard(JSON.stringify(currentReq.response, null, 2))}
                        className="flex items-center gap-1 text-[9px] font-mono text-brand-text-muted hover:text-white transition-colors">
                        <Copy className="w-3 h-3" /> Copy
                      </button>
                    </div>
                    <div className="bg-brand-bg/50 rounded-xl border border-brand-border/30 p-4 overflow-x-auto">
                      <JsonViewer data={currentReq.response} />
                    </div>
                  </div>
                )}
              </div>
            </>
          ) : (
            <EmptyState icon={Activity} label="Select a request to inspect" />
          )}
        </div>
      </div>
    </motion.div>
  );
}
