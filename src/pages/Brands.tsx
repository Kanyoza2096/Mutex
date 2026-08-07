import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import {
  Palette, Plus, Trash2, Edit2, AlertTriangle, X, RefreshCw,
  CheckCircle, Bot, Globe, Hash, Users, Search, Radio, Send,
  BrainCircuit,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface Brand {
  id: string; name: string; tone?: string; hashtags?: string;
  language?: string; audience?: string; workspace_id?: string; ai_profile_id?: string;
}

interface AIProfile { id: string; name: string; tone?: string; expertise?: string; }

const SKELETON_CARD = () => (
  <div className="bg-brand-surface/50 border border-brand-border/50 rounded-2xl p-5 animate-pulse space-y-3">
    <div className="h-5 w-24 bg-brand-elevated rounded" />
    <div className="flex gap-2"><div className="h-5 w-16 bg-brand-elevated rounded-full" /><div className="h-5 w-14 bg-brand-elevated rounded-full" /></div>
    <div className="h-3 w-32 bg-brand-elevated rounded" />
    <div className="pt-3 border-t border-brand-border/30 flex justify-end gap-2"><div className="h-8 w-8 bg-brand-elevated rounded" /><div className="h-8 w-8 bg-brand-elevated rounded" /></div>
  </div>
);

export default function Brands() {
  const { restEndpoint, masterToken, integrationStatus, aiProviderHealth } = useStore();
  const headers: Record<string, string> = masterToken ? { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` } : {};
  const base = restEndpoint.replace(/\/+$/, '');

  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [aiProfiles, setAiProfiles] = useState<AIProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Brand | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<Brand | null>(null);
  const [form, setForm] = useState({ name: '', tone: '', hashtags: '', language: '', audience: '', ai_profile_id: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const connectedPlatforms = integrationStatus.filter(i => i.healthy).length;
  const totalPlatforms = integrationStatus.length || 0;

  const fetchWorkspaces = useCallback(async () => {
    try {
      const res = await fetch(`${base}/workspaces`, { headers });
      if (res.ok) {
        const d = await res.json();
        const ws = d.workspaces || [];
        setWorkspaces(ws);
        setSelectedWorkspaceId(prev => {
          if (prev && ws.find((w: any) => w.id === prev)) return prev;
          return ws.length > 0 ? ws[0].id : '';
        });
      }
    } catch { /* silent */ }
  }, [base, headers]);

  const fetchBrands = useCallback(async () => {
    if (!selectedWorkspaceId) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${base}/workspaces/${selectedWorkspaceId}/brands`, { headers });
      if (res.ok) { const d = await res.json(); setBrands(d.brands || []); }
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [base, headers, selectedWorkspaceId]);

  const fetchAiProfiles = useCallback(async () => {
    if (!selectedWorkspaceId) return;
    try {
      const res = await fetch(`${base}/workspaces/${selectedWorkspaceId}/ai-profiles`, { headers });
      if (res.ok) { const d = await res.json(); setAiProfiles(d.ai_profiles || []); }
    } catch { /* silent */ }
  }, [base, headers, selectedWorkspaceId]);

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);
  useEffect(() => { fetchBrands(); fetchAiProfiles(); }, [fetchBrands, fetchAiProfiles]);

  const resetForm = useCallback(() => {
    setForm({ name: '', tone: '', hashtags: '', language: '', audience: '', ai_profile_id: '' });
    setEditing(null); setShowForm(false);
  }, []);

  // Close form on workspace switch
  useEffect(() => { resetForm(); }, [selectedWorkspaceId, resetForm]);

  const openEdit = useCallback((b: Brand) => {
    setEditing(b);
    setForm({
      name: b.name, tone: b.tone || '',
      hashtags: Array.isArray(b.hashtags) ? b.hashtags.join(', ') : (b.hashtags || ''),
      language: b.language || '', audience: b.audience || '',
      ai_profile_id: b.ai_profile_id || '',
    });
    setShowForm(true);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Brand name is required'); return; }
    setSaving(true);
    try {
      const payload = {
        ...form,
        hashtags: form.hashtags ? form.hashtags.split(',').map(t => t.trim()).filter(Boolean) : [],
        ai_profile_id: form.ai_profile_id || null,
      };
      const url = editing ? `${base}/brands/${editing.id}` : `${base}/workspaces/${selectedWorkspaceId}/brands`;
      const res = await fetch(url, { method: editing ? 'PUT' : 'POST', headers, body: JSON.stringify(payload) });
      if (res.ok) { toast.success(editing ? 'Brand updated' : 'Brand created'); resetForm(); fetchBrands(); }
      else { const d = await res.json(); toast.error(d.error || 'Save failed'); }
    } catch (err: any) { toast.error(err.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`${base}/brands/${confirmDelete.id}`, { method: 'DELETE', headers });
      if (res.ok) { toast.success(`"${confirmDelete.name}" deleted`); setConfirmDelete(null); fetchBrands(); }
      else { const d = await res.json(); toast.error(d.error || 'Delete failed'); }
    } catch (err: any) { toast.error(err.message || 'Delete failed'); }
    finally { setDeleting(false); }
  };

  const filteredBrands = useMemo(() => {
    if (!searchQuery.trim()) return brands;
    const q = searchQuery.toLowerCase();
    return brands.filter(b => b.name.toLowerCase().includes(q) || (b.tone || '').toLowerCase().includes(q));
  }, [brands, searchQuery]);

  const brandsWithAI = brands.filter(b => b.ai_profile_id).length;

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-20">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
            <Palette className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Brands</h1>
            <p className="text-[10px] text-brand-text-muted font-mono uppercase tracking-wider mt-0.5">
              {brands.length} brand{brands.length !== 1 ? 's' : ''} · {brandsWithAI} with AI · Voice & identity
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select value={selectedWorkspaceId} onChange={e => setSelectedWorkspaceId(e.target.value)}
            className="bg-brand-surface border border-brand-border/50 rounded-xl px-3 py-2 text-xs text-brand-text font-medium focus:outline-none focus:border-brand-primary/50 transition-all">
            {workspaces.length === 0 && <option value="">No workspaces</option>}
            {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-text-muted" />
            <input type="text" placeholder="Search..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-2 bg-brand-surface border border-brand-border/50 rounded-xl text-xs text-brand-text placeholder-brand-text-muted font-mono focus:outline-none focus:border-brand-primary/50 w-36 transition-all" />
          </div>
          <button
            onClick={() => { resetForm(); setShowForm(v => !v); }}
            disabled={!selectedWorkspaceId}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold font-mono uppercase tracking-wider hover:bg-brand-primary/90 transition-all shadow-glow-primary disabled:opacity-50">
            <Plus className="w-4 h-4" /> Add
          </button>
        </div>
      </div>

      {/* Enterprise status bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: 'Platforms', value: `${connectedPlatforms}/${totalPlatforms} ready`, icon: Send, color: connectedPlatforms > 0 ? 'text-emerald-400' : 'text-amber-400' },
          { label: 'AI Profiles', value: `${aiProfiles.length} available`, icon: Bot, color: aiProfiles.length > 0 ? 'text-violet-400' : 'text-brand-text-muted' },
          { label: 'Brands with AI', value: brandsWithAI, icon: BrainCircuit, color: brandsWithAI > 0 ? 'text-brand-primary' : 'text-brand-text-muted' },
          { label: 'Workspace', value: workspaces.find(w => w.id === selectedWorkspaceId)?.name || '—', icon: Radio, color: 'text-brand-text-muted' },
        ].map(m => (
          <div key={m.label} className="bg-brand-surface/50 border border-brand-border/50 rounded-xl p-2.5">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[8px] text-brand-text-muted uppercase font-mono">{m.label}</span>
              <m.icon className={cn('w-3 h-3', m.color)} />
            </div>
            <div className={cn('text-xs font-bold font-mono', m.color === 'text-brand-text-muted' ? 'text-white' : m.color)}>{m.value}</div>
          </div>
        ))}
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit} className="p-5 bg-brand-surface/80 backdrop-blur-sm border border-brand-border/50 rounded-2xl space-y-4 overflow-hidden">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-brand-text flex items-center gap-2">
                <Palette className="w-4 h-4 text-brand-primary" /> {editing ? 'Edit Brand' : 'New Brand'}
              </h3>
              <button type="button" onClick={resetForm} className="p-1 rounded-lg hover:bg-brand-elevated text-brand-text-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><label className="text-[9px] font-mono font-bold uppercase text-brand-text-muted mb-1 block">Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2.5 bg-brand-elevated border border-brand-border/50 rounded-xl text-sm text-brand-text focus:outline-none focus:border-brand-primary/50 transition-all" /></div>
              <div><label className="text-[9px] font-mono font-bold uppercase text-brand-text-muted mb-1 block">Tone</label><input value={form.tone} onChange={e => setForm(f => ({ ...f, tone: e.target.value }))} placeholder="Bold, friendly" className="w-full px-3 py-2.5 bg-brand-elevated border border-brand-border/50 rounded-xl text-sm text-brand-text focus:outline-none focus:border-brand-primary/50 transition-all" /></div>
              <div><label className="text-[9px] font-mono font-bold uppercase text-brand-text-muted mb-1 block">Language</label><input value={form.language} onChange={e => setForm(f => ({ ...f, language: e.target.value }))} placeholder="English" className="w-full px-3 py-2.5 bg-brand-elevated border border-brand-border/50 rounded-xl text-sm text-brand-text focus:outline-none focus:border-brand-primary/50 transition-all" /></div>
              <div><label className="text-[9px] font-mono font-bold uppercase text-brand-text-muted mb-1 block">Audience</label><input value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))} placeholder="Young professionals" className="w-full px-3 py-2.5 bg-brand-elevated border border-brand-border/50 rounded-xl text-sm text-brand-text focus:outline-none focus:border-brand-primary/50 transition-all" /></div>
              <div className="md:col-span-2"><label className="text-[9px] font-mono font-bold uppercase text-brand-text-muted mb-1 block">Hashtags</label><input value={form.hashtags} onChange={e => setForm(f => ({ ...f, hashtags: e.target.value }))} placeholder="#brand #marketing" className="w-full px-3 py-2.5 bg-brand-elevated border border-brand-border/50 rounded-xl text-sm text-brand-text focus:outline-none focus:border-brand-primary/50 transition-all" /></div>
              <div className="md:col-span-2">
                <label className="text-[9px] font-mono font-bold uppercase text-brand-text-muted mb-1 flex items-center gap-1.5"><Bot className="w-3.5 h-3.5 text-brand-primary" /> AI Profile</label>
                <select value={form.ai_profile_id} onChange={e => setForm(f => ({ ...f, ai_profile_id: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-brand-elevated border border-brand-border/50 rounded-xl text-sm text-brand-text focus:outline-none focus:border-brand-primary/50 transition-all">
                  <option value="">None (workspace default)</option>
                  {aiProfiles.map(p => <option key={p.id} value={p.id}>{p.name}{p.tone ? ` (${p.tone})` : ''}</option>)}
                </select>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={resetForm} className="px-4 py-2 rounded-xl bg-brand-surface border border-brand-border text-brand-text-muted hover:text-white text-xs font-semibold transition-colors">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-white text-xs font-semibold shadow-glow-primary disabled:opacity-50 transition-all">
                {saving ? 'Saving…' : editing ? 'Save Changes' : 'Create'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Brand Cards */}
      {!selectedWorkspaceId ? (
        <div className="py-16 text-center border-2 border-dashed border-brand-border/50 rounded-2xl text-brand-text-muted font-mono text-xs">Select a workspace to manage brands.</div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i => <SKELETON_CARD key={i} />)}</div>
      ) : error ? (
        <div className="py-12 text-center text-red-400 font-mono text-sm">Failed to load. <button onClick={fetchBrands} className="text-brand-primary hover:underline">Retry</button></div>
      ) : filteredBrands.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-brand-border/50 rounded-2xl text-brand-text-muted font-mono text-xs">
          {searchQuery ? 'No brands match your search.' : 'No brands in this workspace yet.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredBrands.map(b => (
            <motion.div key={b.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              className="bg-brand-surface border border-brand-border/50 rounded-2xl p-5 hover:border-brand-primary/30 transition-all group">

              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-brand-primary/30 to-brand-accent/30 flex items-center justify-center text-xs font-bold text-white">
                    {b.name.substring(0, 2).toUpperCase()}
                  </div>
                  <h3 className="font-bold text-white text-sm">{b.name}</h3>
                </div>
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button onClick={() => openEdit(b)} className="p-1.5 rounded-lg hover:bg-brand-elevated text-brand-text-muted hover:text-white"><Edit2 className="w-3.5 h-3.5" /></button>
                  <button onClick={() => setConfirmDelete(b)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-brand-text-muted hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>

              <div className="flex flex-wrap gap-1.5 mb-3">
                {b.tone && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase bg-brand-elevated text-brand-text-muted border border-brand-border/30">{b.tone}</span>}
                {b.language && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase bg-brand-elevated text-brand-text-muted border border-brand-border/30 flex items-center gap-1"><Globe className="w-2.5 h-2.5" />{b.language}</span>}
                {b.ai_profile_id && (
                  <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase bg-violet-500/10 text-violet-400 border border-violet-500/20 flex items-center gap-1">
                    <Bot className="w-2.5 h-2.5" /> AI
                  </span>
                )}
              </div>

              {b.audience && (
                <p className="text-[10px] text-brand-text-muted font-mono flex items-center gap-1.5 mb-3">
                  <Users className="w-3 h-3" /> {b.audience}
                </p>
              )}

              {b.hashtags && (
                <div className="flex flex-wrap gap-1 pt-3 border-t border-brand-border/30">
                  {((Array.isArray(b.hashtags) ? b.hashtags : String(b.hashtags).split(',').map((t: string) => t.trim()).filter(Boolean)) as string[]).slice(0, 4).map((tag: string) => (
                    <span key={tag} className="text-[9px] font-mono text-sky-400 flex items-center gap-0.5">
                      <Hash className="w-2.5 h-2.5" />{tag.replace('#', '')}
                    </span>
                  ))}
                </div>
              )}
            </motion.div>
          ))}
        </div>
      )}

      {/* Delete Modal */}
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
              <h3 className="text-sm font-bold text-white text-center">Delete "{confirmDelete.name}"?</h3>
              <p className="text-xs text-brand-text-muted text-center mt-1 mb-5">This cannot be undone.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2 rounded-xl bg-brand-surface border border-brand-border text-brand-text-muted text-xs font-semibold">Cancel</button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 py-2 rounded-xl bg-red-500 text-white text-xs font-semibold disabled:opacity-50">{deleting ? 'Deleting…' : 'Delete'}</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
