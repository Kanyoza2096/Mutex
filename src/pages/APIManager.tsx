import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { 
  Key, Plus, Trash2, Copy, CheckCircle, AlertTriangle, RefreshCw,
  Shield, Clock, ChevronDown, X, Search,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';
import { fetchApiKeys, generateApiKeyLabeled, revokeApiKey } from '../lib/api';

interface APIKey {
  id: string; key_id?: string; label: string; prefix: string;
  created_at: string; last_used?: string | null; revoked: boolean;
  request_count?: number;
}

const SKELETON_ROW = () => (
  <div className="bg-brand-surface/50 border border-brand-border/50 rounded-2xl p-5 animate-pulse">
    <div className="flex items-center gap-4"><div className="w-10 h-10 bg-brand-elevated rounded-xl" /><div className="space-y-2 flex-1"><div className="h-4 w-32 bg-brand-elevated rounded" /><div className="h-3 w-48 bg-brand-elevated rounded" /></div></div>
  </div>
);

export default function APIManager() {
  const { restEndpoint, masterToken } = useStore();
  const cfg = { restEndpoint, masterToken };

  const [keys, setKeys] = useState<APIKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [keyLabel, setKeyLabel] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generatedKey, setGeneratedKey] = useState<{ token: string; prefix: string; id: string } | null>(null);
  const [expandedKey, setExpandedKey] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<APIKey | null>(null);
  const [revoking, setRevoking] = useState(false);

  const fetchKeys = async () => {
    setLoading(true); setError(null);
    try {
      const d = await fetchApiKeys(cfg);
      setKeys((d.keys || []) as APIKey[]);
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchKeys(); }, [restEndpoint]);

  const handleGenerate = async () => {
    if (!keyLabel.trim()) { toast.error('Key label is required'); return; }
    setGenerating(true);
    try {
      const d = await generateApiKeyLabeled(cfg, keyLabel.trim());
      setGeneratedKey({ token: (d as any).token, prefix: (d as any).prefix, id: (d as any).key_id });
      toast.success('Key generated — copy it now. It will not be shown again.');
      fetchKeys(); resetForm();
    } catch (err: any) { toast.error(err.message || 'Generation failed'); }
    finally { setGenerating(false); }
  };

  const resetForm = () => { setKeyLabel(''); setShowForm(false); };

  const handleCopy = (token: string) => { navigator.clipboard.writeText(token); toast.success('Key copied'); };

  const handleRevoke = async () => {
    if (!confirmDelete) return;
    setRevoking(true);
    try {
      const id = (confirmDelete as any).key_id || confirmDelete.id;
      await revokeApiKey(cfg, id);
      toast.success(`Key "${confirmDelete.prefix}" revoked`);
      setConfirmDelete(null); fetchKeys();
    } catch { toast.error('Revoke failed'); }
    finally { setRevoking(false); }
  };

  const activeKeys = keys.filter(k => !k.revoked);

  const filteredKeys = useMemo(() => {
    if (!searchQuery.trim()) return activeKeys;
    const q = searchQuery.toLowerCase();
    return activeKeys.filter(k => k.label.toLowerCase().includes(q) || k.prefix.toLowerCase().includes(q));
  }, [activeKeys, searchQuery]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-20">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
            <Key className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">API Manager</h1>
            <p className="text-[10px] text-brand-text-muted font-mono uppercase tracking-wider mt-0.5">
              {activeKeys.length} active key{activeKeys.length !== 1 ? 's' : ''} · API keys authenticate with the backend
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchKeys} className="p-2 rounded-xl bg-brand-surface border border-brand-border/50 hover:border-brand-primary/30 text-brand-text-muted hover:text-white transition-all">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => { resetForm(); setShowForm(true); }}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold font-mono uppercase tracking-wider hover:bg-brand-primary/90 transition-all shadow-glow-primary">
            <Plus className="w-4 h-4" /> Generate Key
          </motion.button>
        </div>
      </div>

      {/* Generated key banner */}
      <AnimatePresence>
        {generatedKey && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold text-emerald-400 flex items-center gap-2"><CheckCircle className="w-4 h-4" /> Key Generated</h3>
              <button onClick={() => setGeneratedKey(null)}><X className="w-4 h-4 text-brand-text-muted" /></button>
            </div>
            <p className="text-[10px] text-brand-text-muted mb-3">Copy this key now — <span className="text-amber-400 font-bold">it will not be shown again.</span></p>
            <div className="flex items-center gap-2 bg-brand-elevated border border-brand-border/30 rounded-xl p-3">
              <code className="flex-1 text-xs font-mono text-emerald-400 break-all">{generatedKey.token}</code>
              <button onClick={() => handleCopy(generatedKey.token)}
                className="px-3 py-1.5 rounded-lg bg-brand-primary text-white text-xs font-bold flex items-center gap-1 hover:bg-brand-primary/90">
                <Copy className="w-3 h-3" /> Copy
              </button>
            </div>
            <div className="flex gap-4 mt-2 text-[9px] font-mono text-brand-text-muted">
              <span>ID: {generatedKey.id}</span><span>Prefix: {generatedKey.prefix}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Generate form — simplified: only label, no fake controls */}
      <AnimatePresence>
        {showForm && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            className="bg-brand-surface border border-brand-border/50 rounded-2xl p-5 overflow-hidden">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-xs font-mono font-bold uppercase text-brand-text flex items-center gap-2"><Key className="w-4 h-4 text-brand-primary" /> Generate New API Key</h3>
              <button onClick={resetForm}><X className="w-4 h-4 text-brand-text-muted" /></button>
            </div>

            <div className="mb-4">
              <label className="text-[9px] font-mono font-bold uppercase text-brand-text-muted mb-2 block">Key Label</label>
              <input value={keyLabel} onChange={e => setKeyLabel(e.target.value)} placeholder="e.g. Church Portal, Mobile App, Integration"
                className="w-full bg-brand-elevated border border-brand-border/50 rounded-xl px-3 py-2.5 text-sm text-brand-text focus:outline-none focus:border-brand-primary/50 transition-all" />
              <p className="text-[9px] text-brand-text-muted font-mono mt-1.5">Choose a descriptive name so you remember what this key is for.</p>
            </div>

            <div className="bg-brand-elevated/30 rounded-xl p-3 mb-4">
              <div className="flex items-center gap-2">
                <Shield className="w-3.5 h-3.5 text-brand-primary" />
                <span className="text-[9px] font-mono text-brand-text-muted">Keys have full API access. Keep them secure and never share them.</span>
              </div>
            </div>

            <div className="flex justify-end gap-2">
              <button onClick={resetForm} className="px-4 py-2 rounded-xl bg-brand-surface border border-brand-border text-brand-text-muted hover:text-white text-xs font-semibold transition-colors">Cancel</button>
              <button onClick={handleGenerate} disabled={generating || !keyLabel.trim()}
                className="px-4 py-2 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-white text-xs font-semibold shadow-glow-primary disabled:opacity-50 transition-all flex items-center gap-1.5">
                {generating ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <Key className="w-3.5 h-3.5" />}
                {generating ? 'Generating…' : 'Generate'}
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Search */}
      <div className="relative max-w-xs">
        <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-text-muted" />
        <input type="text" placeholder="Search keys..." value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          className="w-full pl-8 pr-3 py-2 bg-brand-surface border border-brand-border/50 rounded-xl text-xs text-brand-text placeholder-brand-text-muted font-mono focus:outline-none focus:border-brand-primary/50 transition-all" />
      </div>

      {/* Key list */}
      {loading ? (
        <div className="space-y-3">{[1,2,3].map(i => <SKELETON_ROW key={i} />)}</div>
      ) : error ? (
        <div className="py-12 text-center text-red-400 font-mono text-sm">Failed to load keys. <button onClick={fetchKeys} className="text-brand-primary hover:underline">Retry</button></div>
      ) : filteredKeys.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-brand-border/50 rounded-2xl">
          <Key className="w-10 h-10 text-brand-text-muted/30 mx-auto mb-3" />
          <p className="text-sm text-brand-text-muted font-mono">{activeKeys.length === 0 ? 'No API keys yet.' : 'No keys match your search.'}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredKeys.map(key => {
            const isExpanded = expandedKey === (key.key_id || key.id);
            return (
              <motion.div key={key.key_id || key.id} layout
                className="bg-brand-surface border border-brand-border/50 rounded-2xl overflow-hidden hover:border-brand-primary/20 transition-all">
                <button onClick={() => setExpandedKey(isExpanded ? null : (key.key_id || key.id))}
                  className="w-full p-4 flex items-center justify-between text-left group">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                      <Key className="w-4 h-4 text-brand-primary" />
                    </div>
                    <div>
                      <h3 className="text-xs font-bold text-white">{key.label}</h3>
                      <code className="text-[10px] font-mono text-brand-text-muted">{key.prefix}</code>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-[9px] font-mono text-brand-text-muted hidden sm:block">
                      {key.created_at ? new Date(key.created_at).toLocaleDateString() : '—'}
                    </span>
                    <motion.div animate={{ rotate: isExpanded ? 180 : 0 }}>
                      <ChevronDown className="w-4 h-4 text-brand-text-muted group-hover:text-white transition-colors" />
                    </motion.div>
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                      className="px-4 pb-4 border-t border-brand-border/30">
                      <div className="grid grid-cols-2 gap-3 pt-4 mb-4 text-[10px] font-mono">
                        {[
                          { label: 'Created', value: key.created_at ? new Date(key.created_at).toLocaleDateString() : '—' },
                          { label: 'Status', value: 'Active', color: 'text-emerald-400' },
                        ].map(row => (
                          <div key={row.label}>
                            <span className="text-brand-text-muted uppercase">{row.label}</span>
                            <p className={cn('text-white mt-0.5 font-bold', row.color)}>{row.value}</p>
                          </div>
                        ))}
                      </div>
                      <button onClick={() => setConfirmDelete(key)}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 border border-red-500/20 text-[10px] font-bold font-mono uppercase hover:bg-red-500/20 transition-all">
                        <Trash2 className="w-3 h-3" /> Revoke
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Delete modal */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirmDelete(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-brand-surface border border-brand-border/50 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-sm font-bold text-white text-center">Revoke Key?</h3>
              <p className="text-xs text-brand-text-muted text-center mt-1 mb-5">"{confirmDelete.label}" will stop working immediately.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2 rounded-xl bg-brand-surface border border-brand-border text-brand-text-muted text-xs font-semibold">Cancel</button>
                <button onClick={handleRevoke} disabled={revoking} className="flex-1 py-2 rounded-xl bg-red-500 text-white text-xs font-semibold disabled:opacity-50">{revoking ? 'Revoking…' : 'Revoke'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
