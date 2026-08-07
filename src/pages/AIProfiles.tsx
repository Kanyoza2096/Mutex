import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { 
  Bot, Plus, Trash2, Edit2, AlertTriangle, X, RefreshCw, CheckCircle,
  Sparkles, Zap, MessageSquare, Pen, Search
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface AIProfile {
  id: string; name: string; tone?: string; expertise?: string;
  complexity?: string; emoji_level?: string; writing_style?: string;
  system_prompt_override?: string;
}

const COMPLEXITY_OPTIONS = ['simple', 'moderate', 'advanced'];
const EMOJI_OPTIONS = ['none', 'low', 'medium', 'high'];

const SKELETON_CARD = () => (
  <div className="bg-brand-surface/50 border border-brand-border/50 rounded-2xl p-5 animate-pulse space-y-3">
    <div className="h-5 w-24 bg-brand-elevated rounded" />
    <div className="flex gap-2"><div className="h-5 w-16 bg-brand-elevated rounded-full" /><div className="h-5 w-14 bg-brand-elevated rounded-full" /></div>
    <div className="pt-3 border-t border-brand-border/30 flex justify-end gap-2"><div className="h-8 w-8 bg-brand-elevated rounded" /><div className="h-8 w-8 bg-brand-elevated rounded" /></div>
  </div>
);

export default function AIProfiles() {
  const { restEndpoint, masterToken } = useStore();
  const headers: Record<string, string> = masterToken ? { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` } : {};
  const base = restEndpoint.replace(/\/+$/, '');

  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [profiles, setProfiles] = useState<AIProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<AIProfile | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<AIProfile | null>(null);
  const [form, setForm] = useState({ name: '', tone: '', expertise: '', complexity: '', emoji_level: '', writing_style: '', system_prompt_override: '' });
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const fetchWorkspaces = async () => {
    try {
      const res = await fetch(`${base}/workspaces`, { headers });
      if (res.ok) { const d = await res.json(); const ws = d.workspaces || []; setWorkspaces(ws); if (!selectedWorkspaceId && ws.length > 0) setSelectedWorkspaceId(ws[0].id); }
    } catch {}
  };

  const fetchProfiles = async () => {
    if (!selectedWorkspaceId) return;
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${base}/workspaces/${selectedWorkspaceId}/ai-profiles`, { headers });
      if (res.ok) { const d = await res.json(); setProfiles(d.ai_profiles || []); }
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchWorkspaces(); }, [restEndpoint]);
  useEffect(() => { fetchProfiles(); }, [restEndpoint, selectedWorkspaceId]);

  const resetForm = () => { setForm({ name: '', tone: '', expertise: '', complexity: '', emoji_level: '', writing_style: '', system_prompt_override: '' }); setEditing(null); setShowForm(false); };

  const openEdit = (p: AIProfile) => {
    setEditing(p);
    setForm({ name: p.name, tone: p.tone || '', expertise: p.expertise || '', complexity: p.complexity || '', emoji_level: p.emoji_level || '', writing_style: p.writing_style || '', system_prompt_override: p.system_prompt_override || '' });
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) { toast.error('Profile name is required'); return; }
    setSaving(true);
    try {
      const url = editing ? `${base}/ai-profiles/${editing.id}` : `${base}/workspaces/${selectedWorkspaceId}/ai-profiles`;
      const res = await fetch(url, { method: editing ? 'PUT' : 'POST', headers, body: JSON.stringify(form) });
      if (res.ok) { toast.success(editing ? 'Profile updated' : 'Profile created'); resetForm(); fetchProfiles(); }
      else { const d = await res.json(); toast.error(d.error || 'Save failed'); }
    } catch (err: any) { toast.error(err.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await fetch(`${base}/ai-profiles/${confirmDelete.id}`, { method: 'DELETE', headers });
      toast.success(`"${confirmDelete.name}" deleted`);
      setConfirmDelete(null); fetchProfiles();
    } catch (err: any) { toast.error(err.message || 'Delete failed'); }
    finally { setDeleting(false); }
  };

  const filteredProfiles = useMemo(() => {
    if (!searchQuery.trim()) return profiles;
    const q = searchQuery.toLowerCase();
    return profiles.filter(p => p.name.toLowerCase().includes(q) || (p.tone || '').toLowerCase().includes(q) || (p.expertise || '').toLowerCase().includes(q));
  }, [profiles, searchQuery]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-20">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
            <Bot className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">AI Profiles</h1>
            <p className="text-[10px] text-brand-text-muted font-mono uppercase tracking-wider mt-0.5">
              {profiles.length} profile{profiles.length !== 1 ? 's' : ''} · Persona configurations
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <select value={selectedWorkspaceId} onChange={e => setSelectedWorkspaceId(e.target.value)}
            className="bg-brand-surface border border-brand-border/50 rounded-xl px-3 py-2 text-xs text-brand-text font-medium focus:outline-none focus:border-brand-primary/50 transition-all">
            {workspaces.length === 0 && <option value="">No workspaces</option>}
            {workspaces.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
          </select>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-text-muted" />
            <input type="text" placeholder="Search..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-2 bg-brand-surface border border-brand-border/50 rounded-xl text-xs text-brand-text placeholder-brand-text-muted font-mono focus:outline-none focus:border-brand-primary/50 w-32 transition-all" />
          </div>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={() => { resetForm(); setShowForm(v => !v); }} disabled={!selectedWorkspaceId}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold font-mono uppercase tracking-wider hover:bg-brand-primary/90 transition-all shadow-glow-primary disabled:opacity-50">
            <Plus className="w-4 h-4" /> Add
          </motion.button>
        </div>
      </div>

      {/* Form */}
      <AnimatePresence>
        {showForm && (
          <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSubmit} className="p-5 bg-brand-surface/80 backdrop-blur-sm border border-brand-border/50 rounded-2xl space-y-4 overflow-hidden">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold uppercase text-brand-text flex items-center gap-2">
                <Bot className="w-4 h-4 text-brand-primary" /> {editing ? 'Edit Profile' : 'New Profile'}
              </h3>
              <button type="button" onClick={resetForm} className="p-1 rounded-lg hover:bg-brand-elevated text-brand-text-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div><label className="text-[9px] font-mono font-bold uppercase text-brand-text-muted mb-1 block">Name</label><input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="w-full px-3 py-2.5 bg-brand-elevated border border-brand-border/50 rounded-xl text-sm text-brand-text focus:outline-none focus:border-brand-primary/50 transition-all" /></div>
              <div><label className="text-[9px] font-mono font-bold uppercase text-brand-text-muted mb-1 block">Tone</label><input value={form.tone} onChange={e => setForm(f => ({ ...f, tone: e.target.value }))} placeholder="Witty, formal" className="w-full px-3 py-2.5 bg-brand-elevated border border-brand-border/50 rounded-xl text-sm text-brand-text focus:outline-none focus:border-brand-primary/50 transition-all" /></div>
              <div><label className="text-[9px] font-mono font-bold uppercase text-brand-text-muted mb-1 block">Expertise</label><input value={form.expertise} onChange={e => setForm(f => ({ ...f, expertise: e.target.value }))} placeholder="Finance, tech" className="w-full px-3 py-2.5 bg-brand-elevated border border-brand-border/50 rounded-xl text-sm text-brand-text focus:outline-none focus:border-brand-primary/50 transition-all" /></div>
              <div>
                <label className="text-[9px] font-mono font-bold uppercase text-brand-text-muted mb-1 block">Complexity</label>
                <select value={form.complexity} onChange={e => setForm(f => ({ ...f, complexity: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-brand-elevated border border-brand-border/50 rounded-xl text-sm text-brand-text focus:outline-none focus:border-brand-primary/50 transition-all">
                  <option value="">Select</option>
                  {COMPLEXITY_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="text-[9px] font-mono font-bold uppercase text-brand-text-muted mb-1 block">Emoji Level</label>
                <select value={form.emoji_level} onChange={e => setForm(f => ({ ...f, emoji_level: e.target.value }))}
                  className="w-full px-3 py-2.5 bg-brand-elevated border border-brand-border/50 rounded-xl text-sm text-brand-text focus:outline-none focus:border-brand-primary/50 transition-all">
                  <option value="">Select</option>
                  {EMOJI_OPTIONS.map(o => <option key={o} value={o}>{o}</option>)}
                </select>
              </div>
              <div><label className="text-[9px] font-mono font-bold uppercase text-brand-text-muted mb-1 block">Writing Style</label><input value={form.writing_style} onChange={e => setForm(f => ({ ...f, writing_style: e.target.value }))} placeholder="Conversational" className="w-full px-3 py-2.5 bg-brand-elevated border border-brand-border/50 rounded-xl text-sm text-brand-text focus:outline-none focus:border-brand-primary/50 transition-all" /></div>
              <div className="md:col-span-2"><label className="text-[9px] font-mono font-bold uppercase text-brand-text-muted mb-1 block">System Prompt Override</label><textarea rows={3} value={form.system_prompt_override} onChange={e => setForm(f => ({ ...f, system_prompt_override: e.target.value }))} className="w-full px-3 py-2.5 bg-brand-elevated border border-brand-border/50 rounded-xl text-sm text-brand-text focus:outline-none focus:border-brand-primary/50 transition-all resize-none" /></div>
            </div>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={resetForm} className="px-4 py-2 rounded-xl bg-brand-surface border border-brand-border text-brand-text-muted hover:text-white text-xs font-semibold transition-colors">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-white text-xs font-semibold shadow-glow-primary disabled:opacity-50 transition-all">{saving ? 'Saving…' : editing ? 'Save Changes' : 'Create'}</button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Cards */}
      {!selectedWorkspaceId ? (
        <div className="py-16 text-center border-2 border-dashed border-brand-border/50 rounded-2xl text-brand-text-muted font-mono text-xs">Select a workspace.</div>
      ) : loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">{[1,2,3].map(i => <SKELETON_CARD key={i} />)}</div>
      ) : error ? (
        <div className="py-12 text-center text-red-400 font-mono text-sm">Failed to load. <button onClick={fetchProfiles} className="text-brand-primary hover:underline">Retry</button></div>
      ) : filteredProfiles.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-brand-border/50 rounded-2xl text-brand-text-muted font-mono text-xs">
          {searchQuery ? 'No profiles match your search.' : 'No AI profiles yet.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <AnimatePresence mode="wait">
            {filteredProfiles.map((p, idx) => (
              <motion.div key={p.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="bg-brand-surface border border-brand-border/50 rounded-2xl p-5 hover:border-brand-primary/30 transition-all group">
                
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-2.5">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-violet-500/30 to-brand-primary/30 flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-violet-400" />
                    </div>
                    <h3 className="font-bold text-white text-sm">{p.name}</h3>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => openEdit(p)} className="p-1.5 rounded-lg hover:bg-brand-elevated text-brand-text-muted hover:text-white"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setConfirmDelete(p)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-brand-text-muted hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {p.tone && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase bg-brand-elevated text-brand-text-muted border border-brand-border/30">{p.tone}</span>}
                  {p.expertise && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase bg-brand-elevated text-brand-text-muted border border-brand-border/30 flex items-center gap-1"><Zap className="w-2.5 h-2.5" />{p.expertise}</span>}
                  {p.complexity && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase bg-amber-500/10 text-amber-400 border border-amber-500/20">{p.complexity}</span>}
                  {p.emoji_level && p.emoji_level !== 'none' && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase bg-rose-500/10 text-rose-400 border border-rose-500/20">{p.emoji_level} emoji</span>}
                  {p.writing_style && <span className="px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase bg-sky-500/10 text-sky-400 border border-sky-500/20 flex items-center gap-1"><Pen className="w-2.5 h-2.5" />{p.writing_style}</span>}
                </div>

                {p.system_prompt_override && (
                  <div className="pt-3 border-t border-brand-border/30">
                    <p className="text-[10px] text-brand-text-muted font-mono line-clamp-2 italic">"{p.system_prompt_override}"</p>
                  </div>
                )}
              </motion.div>
            ))}
          </AnimatePresence>
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
