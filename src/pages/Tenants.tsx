import React, { useEffect, useState, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import {
  Building2, Plus, Users, Trash2, Edit2, AlertTriangle, X, RefreshCw,
  Mail, Calendar, Zap, Crown, Star, Search, CheckCircle2, Copy,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface Workspace {
  id: string; name: string; slug: string; plan: string;
  owner?: string; owner_email?: string; status?: string;
  member_count?: number; created_at?: string; description?: string;
}

const PLAN_CONFIG: Record<string, { icon: React.ComponentType<any>; color: string; bg: string; border: string; label: string }> = {
  free:     { icon: Zap,   color: 'text-zinc-400',    bg: 'bg-zinc-500/10',    border: 'border-zinc-500/30',    label: 'Free' },
  pro:      { icon: Star,  color: 'text-brand-primary', bg: 'bg-brand-primary/10', border: 'border-brand-primary/30', label: 'Pro' },
  business: { icon: Crown, color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/30',   label: 'Business' },
};

const PLANS = ['free', 'pro', 'business'];

const SkeletonCard = () => (
  <div className="bg-brand-surface/50 border border-brand-border/50 rounded-2xl p-5 animate-pulse">
    <div className="flex items-center gap-3 mb-4">
      <div className="w-10 h-10 rounded-xl bg-brand-elevated" />
      <div className="space-y-2 flex-1">
        <div className="h-3 w-24 bg-brand-elevated rounded" />
        <div className="h-2.5 w-16 bg-brand-elevated rounded-full" />
      </div>
    </div>
    <div className="grid grid-cols-2 gap-4 py-3 border-y border-brand-border/30 my-4">
      <div className="h-10 bg-brand-elevated rounded" /><div className="h-10 bg-brand-elevated rounded" />
    </div>
    <div className="h-8 bg-brand-elevated rounded-lg mt-1" />
  </div>
);

export default function Tenants() {
  const { restEndpoint, integrationStatus, masterToken, setSelectedWorkspaceId, selectedWorkspaceId } = useStore();

  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [planFilter, setPlanFilter] = useState('all');

  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Workspace | null>(null);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [plan, setPlan] = useState('free');
  const [owner, setOwner] = useState('');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<Workspace | null>(null);
  const [deleting, setDeleting] = useState(false);

  const base = restEndpoint.replace(/\/+$/, '');

  const authHeaders: Record<string, string> = { 'Content-Type': 'application/json' };
  if (masterToken) authHeaders['Authorization'] = `Bearer ${masterToken}`;

  const fetchWorkspaces = useCallback(async () => {
    if (!base) { setLoading(false); return; }
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${base}/workspaces`, { headers: authHeaders });
      if (res.ok) {
        const data = await res.json();
        setWorkspaces(data.workspaces || []);
      } else throw new Error('Failed to fetch');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [base]);

  useEffect(() => { fetchWorkspaces(); }, [fetchWorkspaces]);

  const filteredWorkspaces = useMemo(() => {
    let result = [...workspaces];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(w =>
        w.name.toLowerCase().includes(q) || w.slug.toLowerCase().includes(q) ||
        (w.owner || w.owner_email || '').toLowerCase().includes(q)
      );
    }
    if (planFilter !== 'all') result = result.filter(w => w.plan === planFilter);
    return result;
  }, [workspaces, searchQuery, planFilter]);

  const stats = useMemo(() => ({
    total: workspaces.length,
    active: workspaces.filter(w => w.status !== 'inactive').length,
    totalMembers: workspaces.reduce((sum, w) => sum + (w.member_count || 0), 0),
    proBusiness: workspaces.filter(w => w.plan === 'pro' || w.plan === 'business').length,
  }), [workspaces]);

  const connectedPlatforms = integrationStatus.filter(i => i.healthy).length;

  const resetForm = () => {
    setName(''); setSlug(''); setPlan('free'); setOwner(''); setDescription(''); setEditing(null); setShowForm(false);
  };

  const openEdit = (ws: Workspace) => {
    setEditing(ws);
    setName(ws.name);
    setSlug(ws.slug);
    setPlan(ws.plan);
    setOwner(ws.owner || ws.owner_email || '');
    setDescription(ws.description || '');
    setShowForm(true);
  };

  const switchWorkspace = (ws: Workspace) => {
    setSelectedWorkspaceId(ws.id);
    toast.success(`Switched to "${ws.name}"`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) { toast.error('Workspace name is required'); return; }
    setSaving(true);
    try {
      const computedSlug = slug.trim() || name.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');

      // Canonical payload matching backend WorkspaceCreateRequest
      const payload: Record<string, any> = {
        name: name.trim(),
        description: description.trim() || undefined,
      };

      if (editing) {
        payload.slug = computedSlug;
        payload.plan = plan;
        payload.owner = owner.trim() || undefined;
      } else {
        payload.id = computedSlug;
        payload.slug = computedSlug;
        payload.plan = plan;
        payload.owner = owner.trim() || undefined;
      }

      const url = editing ? `${base}/workspaces/${editing.id}` : `${base}/workspaces`;
      const method = editing ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: authHeaders,
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        toast.success(editing ? 'Workspace updated' : 'Workspace created');
        resetForm();
        fetchWorkspaces();
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || d.detail || 'Save failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Save failed');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      const res = await fetch(`${base}/workspaces/${confirmDelete.id}`, {
        method: 'DELETE',
        headers: authHeaders,
      });
      if (res.ok) {
        toast.success(`"${confirmDelete.name}" deleted`);
        setConfirmDelete(null);
        fetchWorkspaces();
      } else {
        const d = await res.json().catch(() => ({}));
        toast.error(d.error || 'Delete failed');
      }
    } catch (err: any) {
      toast.error(err.message || 'Delete failed');
    } finally {
      setDeleting(false);
    }
  };

  const ownerDisplay = (ws: Workspace) => ws.owner || ws.owner_email || '—';

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-20 md:pb-0">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
            <Building2 className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Workspaces</h1>
            <p className="text-[10px] text-brand-text-muted font-mono uppercase tracking-wider mt-0.5">
              {stats.total} workspaces · {stats.totalMembers} members · {stats.proBusiness} premium · {connectedPlatforms} platforms
              {selectedWorkspaceId && <span className="ml-2 text-brand-primary">· Active: {String(selectedWorkspaceId)}</span>}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchWorkspaces} className="p-2.5 rounded-xl bg-brand-surface border border-brand-border hover:border-brand-primary/30 text-brand-text-muted hover:text-white transition-all">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
          <button
            onClick={() => { resetForm(); setShowForm(v => !v); }}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-bold font-mono uppercase tracking-wider hover:bg-brand-primary/90 transition-all shadow-glow-primary"
          >
            <Plus className="w-4 h-4" /> Add Workspace
          </button>
        </div>
      </div>

      {/* Stats bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { label: 'Total', value: stats.total, icon: Building2, color: 'text-brand-primary' },
          { label: 'Active', value: stats.active, icon: CheckCircle2, color: 'text-emerald-400' },
          { label: 'Members', value: stats.totalMembers, icon: Users, color: 'text-amber-400' },
          { label: 'Premium', value: stats.proBusiness, icon: Crown, color: 'text-violet-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-brand-surface/50 border border-brand-border/50 rounded-xl p-2.5 hover:border-brand-border transition-colors">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[9px] text-brand-text-muted uppercase font-mono tracking-wider">{stat.label}</span>
              <stat.icon className={cn('w-3 h-3', stat.color)} />
            </div>
            <div className={cn('text-sm font-mono font-bold', stat.color)}>{stat.value}</div>
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
                <Building2 className="w-4 h-4 text-brand-primary" />{editing ? 'Edit Workspace' : 'New Workspace'}
              </h3>
              <button type="button" onClick={resetForm} className="p-1 rounded-lg hover:bg-brand-elevated text-brand-text-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase text-brand-text-muted mb-1.5">Name *</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="My Workspace"
                  className="w-full px-3 py-2.5 bg-brand-elevated border border-brand-border/50 rounded-xl text-sm text-brand-text placeholder-brand-text-muted focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition-all" />
              </div>
              {!editing && (
                <div>
                  <label className="block text-[10px] font-mono font-bold uppercase text-brand-text-muted mb-1.5">Slug</label>
                  <input value={slug} onChange={e => setSlug(e.target.value)} placeholder="auto-generated"
                    className="w-full px-3 py-2.5 bg-brand-elevated border border-brand-border/50 rounded-xl text-sm text-brand-text placeholder-brand-text-muted focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition-all" />
                </div>
              )}
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase text-brand-text-muted mb-1.5">Plan</label>
                <select value={plan} onChange={e => setPlan(e.target.value)}
                  className="w-full px-3 py-2.5 bg-brand-elevated border border-brand-border/50 rounded-xl text-sm text-brand-text focus:outline-none focus:border-brand-primary transition-all">
                  {PLANS.map(p => <option key={p} value={p}>{p.charAt(0).toUpperCase() + p.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-mono font-bold uppercase text-brand-text-muted mb-1.5">Owner</label>
                <input value={owner} onChange={e => setOwner(e.target.value)} placeholder="admin@example.com"
                  className="w-full px-3 py-2.5 bg-brand-elevated border border-brand-border/50 rounded-xl text-sm text-brand-text placeholder-brand-text-muted focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition-all" />
              </div>
              <div className="md:col-span-2">
                <label className="block text-[10px] font-mono font-bold uppercase text-brand-text-muted mb-1.5">Description</label>
                <input value={description} onChange={e => setDescription(e.target.value)} placeholder="What's this workspace for?"
                  className="w-full px-3 py-2.5 bg-brand-elevated border border-brand-border/50 rounded-xl text-sm text-brand-text placeholder-brand-text-muted focus:outline-none focus:border-brand-primary focus:ring-1 focus:ring-brand-primary/20 transition-all" />
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

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
          <input type="text" placeholder="Search workspaces..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-brand-surface border border-brand-border/50 rounded-xl text-sm text-brand-text placeholder-brand-text-muted focus:outline-none focus:border-brand-primary/50 transition-all" />
        </div>
        <div className="flex gap-1.5 p-1 bg-brand-surface border border-brand-border/50 rounded-xl">
          {['all', 'free', 'pro', 'business'].map(p => {
            const config = p === 'all' ? { icon: Building2, label: 'All' } : PLAN_CONFIG[p];
            const Icon = config.icon;
            return (
              <button key={p} onClick={() => setPlanFilter(p)}
                className={cn('px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all flex items-center gap-1.5',
                  planFilter === p ? 'bg-brand-primary text-white' : 'text-brand-text-muted hover:text-white')}>
                <Icon className="w-3 h-3" />{config.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">{[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}</div>
      ) : error ? (
        <div className="py-16 text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3 opacity-50" />
          <p className="text-sm text-brand-text-muted font-mono">Failed to load workspaces</p>
          <button onClick={fetchWorkspaces} className="mt-3 text-xs text-brand-primary hover:underline">Retry</button>
        </div>
      ) : filteredWorkspaces.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-brand-border/50 rounded-2xl">
          <Building2 className="w-10 h-10 text-brand-text-muted/30 mx-auto mb-3" />
          <p className="text-sm text-brand-text-muted font-mono">
            {workspaces.length === 0 ? 'No workspaces yet — create your first one.' : 'No workspaces match your filters.'}
          </p>
          {workspaces.length > 0 && (
            <button onClick={() => { setSearchQuery(''); setPlanFilter('all'); }} className="mt-2 text-xs text-brand-primary hover:underline">Clear filters</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {filteredWorkspaces.map(ws => {
            const planConfig = PLAN_CONFIG[ws.plan] || PLAN_CONFIG.free;
            const PlanIcon = planConfig.icon;
            const isActive = String(selectedWorkspaceId) === String(ws.id);
            return (
              <motion.div key={ws.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className={cn(
                  'bg-brand-surface border rounded-2xl p-5 hover:shadow-xl transition-all group cursor-pointer',
                  isActive ? 'border-brand-primary shadow-lg shadow-brand-primary/10' : 'border-brand-border/50 hover:border-brand-primary/30',
                )}
                onClick={() => switchWorkspace(ws)}>

                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-3">
                    <div className={cn(
                      'w-10 h-10 rounded-xl flex items-center justify-center text-white font-bold text-sm ring-2',
                      isActive ? 'bg-gradient-to-br from-brand-primary to-brand-accent ring-brand-primary/30' : 'bg-gradient-to-br from-brand-primary/30 to-brand-accent/30 ring-brand-primary/10',
                    )}>
                      {ws.name.substring(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <h3 className="font-bold text-white text-sm truncate">{ws.name}</h3>
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase border mt-0.5',
                        planConfig.bg, planConfig.color, planConfig.border)}>
                        <PlanIcon className="w-3 h-3" />{planConfig.label}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity" onClick={e => e.stopPropagation()}>
                    <button onClick={() => openEdit(ws)} className="p-1.5 rounded-lg hover:bg-brand-elevated text-brand-text-muted hover:text-white"><Edit2 className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setConfirmDelete(ws)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-brand-text-muted hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 py-3.5 border-y border-brand-border/30 my-1">
                  <div className="text-center">
                    <p className="text-[9px] text-brand-text-muted font-mono uppercase mb-1">Members</p>
                    <p className="text-sm font-bold text-white flex items-center justify-center gap-1.5">
                      <Users className="w-3.5 h-3.5 text-brand-text-muted" />{ws.member_count || 0}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-brand-text-muted font-mono uppercase mb-1">Slug</p>
                    <button onClick={(e) => { e.stopPropagation(); navigator.clipboard.writeText(ws.slug); toast.success('Slug copied'); }}
                      className="text-sm font-bold text-brand-primary hover:text-brand-accent transition-colors flex items-center justify-center gap-1 group/slug">
                      {ws.slug}<Copy className="w-3 h-3 opacity-0 group-hover/slug:opacity-100 transition-opacity" />
                    </button>
                  </div>
                </div>

                <div className="flex items-center justify-between mt-3 text-[10px] text-brand-text-muted font-mono">
                  <span className="flex items-center gap-1"><Calendar className="w-3 h-3" />{ws.created_at ? new Date(ws.created_at).toLocaleDateString() : '—'}</span>
                  <span className="flex items-center gap-1 truncate max-w-[140px]" title={ownerDisplay(ws)}>
                    <Mail className="w-3 h-3 flex-shrink-0" /><span className="truncate">{ownerDisplay(ws)}</span>
                  </span>
                </div>

                {isActive && (
                  <div className="mt-3 pt-3 border-t border-brand-primary/20">
                    <span className="text-[9px] font-mono text-brand-primary font-bold uppercase">● Active Workspace</span>
                  </div>
                )}
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Delete Modal */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
            onClick={() => setConfirmDelete(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.95, y: 10 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 10 }}
              onClick={e => e.stopPropagation()}
              className="bg-brand-surface border border-brand-border/50 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-sm font-bold text-white text-center mb-1">Delete Workspace?</h3>
              <p className="text-xs text-brand-text-muted text-center mb-5">
                This will permanently remove "<span className="text-white font-semibold">{confirmDelete.name}</span>" and all associated data.
              </p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(null)} className="flex-1 px-4 py-2.5 rounded-xl bg-brand-surface border border-brand-border text-brand-text-muted hover:text-white text-xs font-semibold transition-colors">Cancel</button>
                <button onClick={handleDelete} disabled={deleting} className="flex-1 px-4 py-2.5 rounded-xl bg-red-500 text-white text-xs font-semibold hover:bg-red-600 disabled:opacity-50 transition-all">
                  {deleting ? 'Deleting…' : 'Delete Forever'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
