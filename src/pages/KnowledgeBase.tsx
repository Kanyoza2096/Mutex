import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import {
  BookOpen, Search, Plus, FileText, Trash2, AlertTriangle, X,
  RefreshCw, Tag, Clock, Copy, Eye, BrainCircuit,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface KnowledgeDoc {
  id: string | number; title?: string; content?: string;
  doc_type?: string; tags?: string[]; brand_id?: string; created_at?: string;
}

interface Brand { id: string; name: string; }

const TYPE_COLORS: Record<string, string> = {
  fact: 'text-sky-400 bg-sky-500/10 border-sky-500/20',
  faq: 'text-amber-400 bg-amber-500/10 border-amber-500/20',
  policy: 'text-red-400 bg-red-500/10 border-red-500/20',
  product: 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',
  general: 'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
};

const SkeletonCard = () => (
  <div className="bg-brand-surface/50 border border-brand-border/50 rounded-2xl p-5 animate-pulse space-y-3">
    <div className="w-10 h-10 bg-brand-elevated rounded-xl" />
    <div className="h-4 w-3/4 bg-brand-elevated rounded" />
    <div className="h-3 w-full bg-brand-elevated rounded" />
    <div className="h-3 w-2/3 bg-brand-elevated rounded" />
    <div className="pt-3 border-t border-brand-border/30"><div className="h-5 w-16 bg-brand-elevated rounded-full" /></div>
  </div>
);

export default function KnowledgeBase() {
  const { restEndpoint, masterToken, selectedWorkspaceId, aiProviderHealth } = useStore();
  const headers: Record<string, string> = masterToken ? { 'Content-Type': 'application/json', Authorization: `Bearer ${masterToken}` } : {};
  const base = restEndpoint.replace(/\/+$/, '');

  const [activeTab, setActiveTab] = useState<'brand' | 'global'>('brand');
  const [brands, setBrands] = useState<Brand[]>([]);
  const [selectedBrandId, setSelectedBrandId] = useState<string>('');
  const [documents, setDocuments] = useState<KnowledgeDoc[]>([]);
  const [globalDocs, setGlobalDocs] = useState<KnowledgeDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<KnowledgeDoc[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<KnowledgeDoc | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [typeFilter, setTypeFilter] = useState('all');
  const [previewDoc, setPreviewDoc] = useState<KnowledgeDoc | null>(null);
  const [form, setForm] = useState({ title: '', content: '', doc_type: 'fact', tags: '' });

  const aiOnline = aiProviderHealth.filter(p => p.available).length;

  const fetchBrands = useCallback(async () => {
    if (!base) return;
    try {
      const wsId = selectedWorkspaceId || 'default';
      const res = await fetch(`${base}/workspaces/${wsId}/brands`, { headers });
      if (res.ok) {
        const d = await res.json();
        const brList = d.brands || [];
        setBrands(brList);
        setSelectedBrandId(prev => {
          if (prev && brList.find((b: Brand) => b.id === prev)) return prev;
          return brList.length > 0 ? brList[0].id : '';
        });
      }
    } catch { /* silent */ }
  }, [base, headers, selectedWorkspaceId]);

  const fetchDocs = useCallback(async () => {
    if (!base) { setLoading(false); return; }
    if (!selectedBrandId && activeTab === 'brand') return;
    setLoading(true); setError(null);
    try {
      if (activeTab === 'brand') {
        const res = await fetch(`${base}/brands/${selectedBrandId}/knowledge`, { headers });
        if (res.ok) { const d = await res.json(); setDocuments(d.knowledge_entries || []); }
      } else {
        const res = await fetch(`${base}/knowledge?limit=50`, { headers });
        if (res.ok) { const d = await res.json(); setGlobalDocs(d.documents || []); }
      }
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  }, [base, headers, selectedBrandId, activeTab]);

  useEffect(() => { fetchBrands(); }, [fetchBrands]);
  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!searchQuery.trim() || !selectedBrandId) { setSearchResults(null); return; }
    setSearching(true);
    try {
      const res = await fetch(`${base}/brands/${selectedBrandId}/knowledge/search`, {
        method: 'POST', headers,
        body: JSON.stringify({ query: searchQuery.trim(), top_k: 10 }),
      });
      if (res.ok) {
        const d = await res.json();
        setSearchResults((d.results || []).map((r: any) => r.entry || r));
      }
    } catch { /* silent */ } finally { setSearching(false); }
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.content.trim()) { toast.error('Content is required'); return; }
    setSaving(true);
    try {
      const payload = { ...form, tags: form.tags ? form.tags.split(',').map(t => t.trim()).filter(Boolean) : [] };
      const url = activeTab === 'global' ? `${base}/knowledge` : `${base}/brands/${selectedBrandId}/knowledge`;
      await fetch(url, { method: 'POST', headers, body: JSON.stringify(payload) });
      toast.success('Document saved');
      setForm({ title: '', content: '', doc_type: 'fact', tags: '' });
      setShowForm(false);
      fetchDocs();
    } catch (err: any) { toast.error(err.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    setDeleting(true);
    try {
      await fetch(`${base}/knowledge/${confirmDelete.id}`, { method: 'DELETE', headers });
      toast.success('Document deleted');
      setConfirmDelete(null);
      fetchDocs();
    } catch (err: any) { toast.error(err.message || 'Delete failed'); }
    finally { setDeleting(false); }
  };

  const displayedDocs = useMemo(() => {
    const docs = searchResults ?? (activeTab === 'global' ? globalDocs : documents);
    if (typeFilter === 'all') return docs;
    return docs.filter(d => d.doc_type === typeFilter);
  }, [searchResults, activeTab, globalDocs, documents, typeFilter]);

  // Derive doc types from actual data, fall back to defaults
  const availableTypes = useMemo(() => {
    const source = activeTab === 'global' ? globalDocs : documents;
    const types = new Set(source.map(d => d.doc_type).filter(Boolean) as string[]);
    return types.size > 0 ? ['all', ...Array.from(types)] : ['all', ...['fact', 'faq', 'policy', 'product', 'general']];
  }, [activeTab, globalDocs, documents]);

  const stats = useMemo(() => ({
    total: (activeTab === 'global' ? globalDocs : documents).length,
    types: availableTypes.length - 1,
  }), [activeTab, globalDocs, documents, availableTypes]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-20">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
            <BookOpen className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Knowledge Base</h1>
            <p className="text-[10px] text-brand-text-muted font-mono uppercase tracking-wider mt-0.5">
              {stats.total} documents · {stats.types} types · RAG-ready{aiOnline > 0 ? ` · ${aiOnline} AI providers` : ''}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {activeTab === 'brand' && (
            <select value={selectedBrandId} onChange={e => setSelectedBrandId(e.target.value)}
              className="bg-brand-surface border border-brand-border/50 rounded-xl px-3 py-2 text-xs text-brand-text font-medium focus:outline-none focus:border-brand-primary/50 transition-all">
              {brands.length === 0 && <option value="">No brands</option>}
              {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
            </select>
          )}
          <button
            onClick={() => setShowForm(v => !v)}
            disabled={activeTab === 'brand' && !selectedBrandId}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold font-mono uppercase tracking-wider hover:bg-brand-primary/90 transition-all shadow-glow-primary disabled:opacity-50">
            <Plus className="w-4 h-4" /> New Doc
          </button>
        </div>
      </div>

      {/* Tabs + Filters */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex gap-1 p-1 bg-brand-surface border border-brand-border/50 rounded-xl">
          {(['brand', 'global'] as const).map(tab => (
            <button key={tab} onClick={() => { setActiveTab(tab); setSearchResults(null); setTypeFilter('all'); }}
              className={cn('px-3.5 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition-all',
                activeTab === tab ? 'bg-brand-primary text-white shadow-glow-primary' : 'text-brand-text-muted hover:text-white')}>
              {tab === 'brand' ? 'Brand' : 'Global'}
            </button>
          ))}
        </div>
        <div className="flex gap-1 p-1 bg-brand-surface border border-brand-border/50 rounded-xl flex-wrap">
          {availableTypes.map(t => (
            <button key={t} onClick={() => setTypeFilter(t)}
              className={cn('px-2.5 py-1 rounded-lg text-[9px] font-mono font-bold uppercase whitespace-nowrap',
                typeFilter === t ? 'bg-brand-primary text-white' : 'text-brand-text-muted hover:text-white')}>
              {t === 'all' ? 'All' : t}
            </button>
          ))}
        </div>
      </div>

      {/* Search */}
      {activeTab === 'brand' && (
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
            <input type="text" placeholder="Semantic search documents..." value={searchQuery}
              onChange={e => { setSearchQuery(e.target.value); if (!e.target.value) setSearchResults(null); }}
              disabled={!selectedBrandId}
              className="w-full pl-10 pr-4 py-2.5 bg-brand-surface border border-brand-border/50 rounded-xl text-sm text-brand-text placeholder-brand-text-muted focus:outline-none focus:border-brand-primary/50 disabled:opacity-50 transition-all" />
          </div>
          <button type="submit" disabled={searching || !searchQuery.trim()}
            className="px-4 py-2.5 rounded-xl bg-brand-surface border border-brand-border/50 text-brand-text-muted hover:text-white text-xs font-bold font-mono uppercase transition-all disabled:opacity-50">
            {searching ? <RefreshCw className="w-4 h-4 animate-spin" /> : 'Search'}
          </button>
          {searchResults && (
            <button onClick={() => { setSearchResults(null); setSearchQuery(''); }}
              className="px-3 py-2.5 rounded-xl text-brand-text-muted hover:text-white text-xs font-mono">Clear</button>
          )}
        </form>
      )}

      {/* Add Form */}
      <AnimatePresence>
        {showForm && (
          <motion.form initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
            onSubmit={handleSave} className="p-5 bg-brand-surface/80 backdrop-blur-sm border border-brand-border/50 rounded-2xl space-y-4 overflow-hidden">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-brand-text flex items-center gap-2">
                <Plus className="w-4 h-4 text-brand-primary" /> New Document
              </h3>
              <button type="button" onClick={() => setShowForm(false)} className="p-1 rounded-lg hover:bg-brand-elevated text-brand-text-muted"><X className="w-4 h-4" /></button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <input value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="Title"
                className="px-3 py-2.5 bg-brand-elevated border border-brand-border/50 rounded-xl text-sm text-brand-text focus:outline-none focus:border-brand-primary/50 transition-all" />
              <select value={form.doc_type} onChange={e => setForm(f => ({ ...f, doc_type: e.target.value }))}
                className="px-3 py-2.5 bg-brand-elevated border border-brand-border/50 rounded-xl text-sm text-brand-text focus:outline-none focus:border-brand-primary/50 transition-all">
                {availableTypes.filter(t => t !== 'all').map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <input value={form.tags} onChange={e => setForm(f => ({ ...f, tags: e.target.value }))} placeholder="tags, comma, separated"
                className="px-3 py-2.5 bg-brand-elevated border border-brand-border/50 rounded-xl text-sm text-brand-text focus:outline-none focus:border-brand-primary/50 transition-all" />
            </div>
            <textarea rows={5} value={form.content} onChange={e => setForm(f => ({ ...f, content: e.target.value }))} placeholder="Document content..."
              className="w-full px-3 py-2.5 bg-brand-elevated border border-brand-border/50 rounded-xl text-sm text-brand-text focus:outline-none focus:border-brand-primary/50 transition-all resize-none" />
            <p className="text-[9px] text-brand-text-muted font-mono text-right">{form.content.length} chars</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="px-4 py-2 rounded-xl bg-brand-surface border border-brand-border text-brand-text-muted hover:text-white text-xs font-semibold transition-colors">Cancel</button>
              <button type="submit" disabled={saving}
                className="px-4 py-2 rounded-xl bg-brand-primary hover:bg-brand-primary/90 text-white text-xs font-semibold shadow-glow-primary disabled:opacity-50 transition-all">
                {saving ? 'Saving…' : 'Save Document'}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      {/* Documents Grid */}
      {loading || searching ? (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <div className="py-16 text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3 opacity-50" />
          <p className="text-sm text-brand-text-muted font-mono">{error}</p>
          <button onClick={fetchDocs} className="mt-3 text-xs text-brand-primary hover:underline">Retry</button>
        </div>
      ) : displayedDocs.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed border-brand-border/50 rounded-2xl">
          <BookOpen className="w-12 h-12 text-brand-text-muted/30 mx-auto mb-4" />
          <p className="text-sm text-brand-text-muted font-mono">
            {searchResults ? 'No matching documents found.' : 'No documents yet. Create your first document.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {displayedDocs.map(doc => {
            const typeConfig = TYPE_COLORS[doc.doc_type || ''] || TYPE_COLORS.general;
            return (
              <motion.div key={doc.id} layout initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                className="bg-brand-surface border border-brand-border/50 rounded-2xl p-5 hover:border-brand-primary/30 transition-all group flex flex-col">

                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-xl bg-brand-primary/10 flex items-center justify-center">
                    <FileText className="w-5 h-5 text-brand-primary" />
                  </div>
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button onClick={() => setPreviewDoc(doc)} className="p-1 rounded hover:bg-brand-elevated text-brand-text-muted"><Eye className="w-3.5 h-3.5" /></button>
                    <button onClick={() => { navigator.clipboard.writeText(doc.content || ''); toast.success('Copied'); }}
                      className="p-1 rounded hover:bg-brand-elevated text-brand-text-muted"><Copy className="w-3.5 h-3.5" /></button>
                    <button onClick={() => setConfirmDelete(doc)} className="p-1 rounded hover:bg-red-500/10 text-brand-text-muted hover:text-red-400"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                </div>

                {doc.title && <h3 className="text-sm font-bold text-white mb-2 line-clamp-2">{doc.title}</h3>}
                <p className="text-xs text-brand-text-muted line-clamp-3 mb-3 flex-1 leading-relaxed">{doc.content}</p>

                <div className="flex items-center gap-2 pt-3 border-t border-brand-border/30 flex-wrap">
                  {doc.doc_type && (
                    <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase border', typeConfig)}>{doc.doc_type}</span>
                  )}
                  {doc.tags?.map(tag => (
                    <span key={tag} className="px-1.5 py-0.5 rounded-full text-[8px] font-mono bg-brand-elevated text-brand-text-muted border border-brand-border/30 flex items-center gap-0.5">
                      <Tag className="w-2.5 h-2.5" />{tag}
                    </span>
                  ))}
                  {doc.created_at && (
                    <span className="ml-auto text-[9px] text-brand-text-muted font-mono flex items-center gap-1">
                      <Clock className="w-3 h-3" />{new Date(doc.created_at).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      )}

      {/* Preview Modal */}
      <AnimatePresence>
        {previewDoc && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setPreviewDoc(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-brand-surface border border-brand-border/50 rounded-2xl max-w-lg w-full p-6 shadow-2xl max-h-[80vh] overflow-y-auto">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white">{previewDoc.title || 'Untitled'}</h3>
                <button onClick={() => setPreviewDoc(null)} className="p-1 rounded-lg hover:bg-brand-elevated text-brand-text-muted"><X className="w-4 h-4" /></button>
              </div>
              {previewDoc.doc_type && (
                <span className={cn('inline-block px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase border mb-3', TYPE_COLORS[previewDoc.doc_type] || TYPE_COLORS.general)}>
                  {previewDoc.doc_type}
                </span>
              )}
              <p className="text-sm text-brand-text leading-relaxed whitespace-pre-wrap">{previewDoc.content}</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation */}
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
              <h3 className="text-sm font-bold text-white text-center">Delete Document?</h3>
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
