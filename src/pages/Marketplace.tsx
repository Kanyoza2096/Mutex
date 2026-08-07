import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Store, Search, Plus, Star, Download, Trash2, RefreshCw, 
  CheckCircle, Upload, Puzzle, Zap, Shield, Users, Database,
  Heart, Globe, ExternalLink, Package, Tag, Clock
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store/useStore';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

const CATEGORIES = [
  'All', 'Church', 'Education', 'Healthcare', 'CRM',
  'Business', 'Social Media', 'ERP', 'Finance'
];

// ── Category config ────────────────────────────────────────────────────────

const CATEGORY_META: Record<string, { icon: React.ComponentType<any>; color: string; description: string }> = {
  Church:      { icon: Heart,   color: 'text-rose-400',   description: 'Church management & member tracking' },
  Education:   { icon: Users,   color: 'text-sky-400',    description: 'School MIS & student management' },
  Healthcare:  { icon: Shield,  color: 'text-emerald-400', description: 'Hospital & patient management' },
  CRM:         { icon: Users,   color: 'text-violet-400',  description: 'Customer relationship management' },
  'Social Media': { icon: Globe, color: 'text-blue-400',  description: 'Social platform connectors' },
};

// ── Plugin card skeleton ───────────────────────────────────────────────────

const SkeletonCard = () => (
  <div className="bg-brand-surface/50 border border-brand-border/50 rounded-2xl p-5 animate-pulse space-y-4">
    <div className="flex justify-between"><div className="w-12 h-12 bg-brand-elevated rounded-xl" /><div className="w-20 h-5 bg-brand-elevated rounded-full" /></div>
    <div className="h-5 w-3/4 bg-brand-elevated rounded" />
    <div className="h-3 w-1/2 bg-brand-elevated rounded" />
    <div className="h-4 w-full bg-brand-elevated rounded" />
    <div className="pt-3 border-t border-brand-border/30 flex justify-between"><div className="h-4 w-16 bg-brand-elevated rounded" /><div className="h-4 w-12 bg-brand-elevated rounded" /></div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════

export default function Marketplace() {
  const { restEndpoint, masterToken } = useStore();
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch real plugins from backend
  const { data: pluginsData, isLoading, error, refetch } = useQuery({
    queryKey: ['plugins', restEndpoint],
    queryFn: async () => {
      const res = await fetch(`${restEndpoint.replace(/\/+$/, '')}/plugins`, {
        headers: masterToken ? { Authorization: `Bearer ${masterToken}` } : {},
      });
      if (!res.ok) throw new Error('Failed to fetch');
      const data = await res.json();
      return data.plugins || [];
    },
    enabled: !!restEndpoint,
    staleTime: 30_000,
  });

  // Transform real plugins into marketplace cards
  const plugins = useMemo(() => {
    if (!pluginsData || pluginsData.length === 0) return [];
    return pluginsData.map((p: any) => ({
      id: p.name || 'plugin',
      name: (p.name || 'plugin').replace(/_/g, ' ').replace(/\b\w/g, (c: string) => c.toUpperCase()),
      description: `${p.commands?.length || 0} commands available • Webhooks: ${p.webhooks?.length || 0}`,
      category: mapCategory(p.name),
      author: 'Kanyoza Systems',
      version: '1.0.0',
      price: 'Free',
      status: 'installed',
      commands: p.commands || [],
      webhooks: p.webhooks || [],
    }));
  }, [pluginsData]);

  function mapCategory(name: string): string {
    if (name.includes('church')) return 'Church';
    if (name.includes('school') || name.includes('mis')) return 'Education';
    if (name.includes('hospital')) return 'Healthcare';
    if (name.includes('crm')) return 'CRM';
    return 'Business';
  }

  const filteredPlugins = useMemo(() => {
    let result = [...plugins];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(p => p.name.toLowerCase().includes(q) || p.description.toLowerCase().includes(q));
    }
    if (selectedCategory !== 'All') result = result.filter(p => p.category === selectedCategory);
    return result;
  }, [plugins, searchQuery, selectedCategory]);

  const totalInstalled = plugins.length;
  const totalCommands = plugins.reduce((s: number, p: any) => s + (p.commands?.length || 0), 0);
  const totalWebhooks = plugins.reduce((s: number, p: any) => s + (p.webhooks?.length || 0), 0);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-20">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
            <Store className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Plugin Marketplace</h1>
            <p className="text-[10px] text-brand-text-muted font-mono uppercase tracking-wider mt-0.5">
              {totalInstalled} installed · {totalCommands} commands · {totalWebhooks} webhooks
            </p>
          </div>
        </div>
        <div className="relative w-full sm:w-64">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted" />
          <input type="text" placeholder="Search plugins..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-brand-surface border border-brand-border/50 rounded-xl text-sm text-brand-text placeholder-brand-text-muted font-mono focus:outline-none focus:border-brand-primary/50 transition-all" />
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Installed', value: totalInstalled, icon: CheckCircle, color: 'text-emerald-400' },
          { label: 'Commands', value: totalCommands, icon: Zap, color: 'text-violet-400' },
          { label: 'Webhooks', value: totalWebhooks, icon: Globe, color: 'text-sky-400' },
        ].map(stat => (
          <div key={stat.label} className="bg-brand-surface/50 border border-brand-border/50 rounded-xl p-3.5">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-brand-text-muted">{stat.label}</span>
              <stat.icon className={cn('w-4 h-4', stat.color)} />
            </div>
            <div className={cn('text-xl font-mono font-bold', stat.color)}>{stat.value}</div>
          </div>
        ))}
      </div>

      {/* Categories */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {CATEGORIES.map(cat => {
          const meta = CATEGORY_META[cat];
          const Icon = meta?.icon || Puzzle;
          return (
            <button key={cat} onClick={() => setSelectedCategory(cat)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-xl whitespace-nowrap text-xs font-bold font-mono uppercase tracking-wider transition-all border flex-shrink-0',
                selectedCategory === cat
                  ? 'bg-brand-primary text-white border-brand-primary shadow-glow-primary'
                  : 'bg-brand-surface border-brand-border/50 text-brand-text-muted hover:text-white hover:border-brand-primary/30'
              )}>
              <Icon className="w-3.5 h-3.5" />
              {cat}
            </button>
          );
        })}
      </div>

      {/* Plugin Cards */}
      {isLoading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[1,2,3,4,5,6,7,8].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <div className="py-16 text-center">
          <Package className="w-10 h-10 text-red-400 mx-auto mb-3 opacity-50" />
          <p className="text-sm text-brand-text-muted font-mono">Failed to load plugins</p>
          <button onClick={() => refetch()} className="mt-3 text-xs text-brand-primary hover:underline">Retry</button>
        </div>
      ) : filteredPlugins.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed border-brand-border/50 rounded-2xl">
          <Package className="w-12 h-12 text-brand-text-muted/30 mx-auto mb-4" />
          <p className="text-sm text-brand-text-muted font-mono">
            {plugins.length === 0 ? 'No plugins installed yet. Deploy industry plugins to your backend.' : 'No plugins match your filters.'}
          </p>
          {plugins.length > 0 && (
            <button onClick={() => { setSearchQuery(''); setSelectedCategory('All'); }} className="mt-2 text-xs text-brand-primary hover:underline">Clear filters</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          <AnimatePresence mode="wait">
            {filteredPlugins.map((plugin, idx) => {
              const meta = CATEGORY_META[plugin.category];
              return (
                <motion.div key={plugin.id} layout
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  whileHover={{ y: -3 }}
                  className="bg-brand-surface border border-brand-border/50 rounded-2xl p-5 flex flex-col hover:border-brand-primary/30 transition-all group">
                  
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={cn('w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold',
                      meta?.color.replace('text-', 'bg-').replace('400', '500/20'),
                      meta?.color || 'text-brand-primary')}>
                      {plugin.name.substring(0, 2).toUpperCase()}
                    </div>
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold font-mono uppercase">
                      <CheckCircle className="w-2.5 h-2.5" /> Installed
                    </span>
                  </div>

                  {/* Info */}
                  <h3 className="text-sm font-bold text-white mb-1">{plugin.name}</h3>
                  <p className="text-[10px] text-brand-text-muted font-mono mb-3">{plugin.author} · v{plugin.version}</p>
                  <p className="text-xs text-brand-text-muted mb-4 flex-1 line-clamp-2">{plugin.description}</p>

                  {/* Meta — Phase 5: removed fake rating/download numbers */}
                  <div className="flex items-center justify-between pt-3 border-t border-brand-border/30 text-[10px] font-mono">
                    <span className="flex items-center gap-1 text-brand-text-muted">
                      <Zap className="w-3 h-3" /> {plugin.commands?.length || 0} cmd
                    </span>
                    <span className="flex items-center gap-1 text-brand-text-muted">
                      <Globe className="w-3 h-3" /> {plugin.webhooks?.length || 0} hooks
                    </span>
                    <span className="text-emerald-400 font-bold">{plugin.price}</span>
                  </div>

                  {/* Category tag */}
                  {meta && (
                    <div className="mt-3 flex items-center gap-1.5">
                      <meta.icon className={cn('w-3 h-3', meta.color)} />
                      <span className={cn('text-[9px] font-mono font-bold uppercase', meta.color)}>{plugin.category}</span>
                    </div>
                  )}
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}
    </motion.div>
  );
}
