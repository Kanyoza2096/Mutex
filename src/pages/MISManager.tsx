import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Database, Plus, Users, FileText, Settings, Building, 
  GraduationCap, Heart, Briefcase, ShoppingCart, Hotel, 
  DollarSign, Zap, CheckCircle, Clock, Activity, Terminal,
  RefreshCw, ArrowRight, Wifi, Search, Filter, ExternalLink,
  Copy, Play, BookOpen, Code2
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store/useStore';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

const MIS_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  church_mis: Building,
  school_mis: GraduationCap,
  hospital: Heart,
  crm: Users,
  erp: Briefcase,
  inventory: ShoppingCart,
  hotel: Hotel,
  bank: DollarSign,
};

const MIS_NAMES: Record<string, string> = {
  church_mis: 'Church MIS',
  school_mis: 'School MIS',
  hospital: 'Hospital MIS',
  crm: 'CRM',
  erp: 'ERP',
  inventory: 'Inventory',
  hotel: 'Hotel',
  bank: 'Bank',
};

const MIS_COLORS: Record<string, string> = {
  church_mis: 'text-rose-400',
  school_mis: 'text-sky-400',
  hospital: 'text-red-400',
  crm: 'text-violet-400',
  erp: 'text-amber-400',
  inventory: 'text-emerald-400',
  hotel: 'text-cyan-400',
  bank: 'text-yellow-400',
};

interface PluginInfo {
  name: string;
  commands: Array<{
    intent: string; description: string; params: string[];
    example: string; category: string;
  }>;
  webhooks: Array<{ path: string; method: string; description: string }>;
}

// ── Skeleton ───────────────────────────────────────────────────────────────

const SkeletonCard = () => (
  <div className="bg-brand-surface/50 border border-brand-border/50 rounded-2xl p-6 animate-pulse space-y-4">
    <div className="w-12 h-12 bg-brand-elevated rounded-xl" />
    <div className="h-5 bg-brand-elevated rounded w-2/3" />
    <div className="h-3 bg-brand-elevated rounded w-1/2" />
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════

export default function MISManager() {
  const { restEndpoint, masterToken } = useStore();
  const [selectedPlugin, setSelectedPlugin] = useState<string | null>(null);
  const [expandedCommand, setExpandedCommand] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  const base = restEndpoint.replace(/\/+$/, '');
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (masterToken) headers['Authorization'] = `Bearer ${masterToken}`;

  const { data: plugins = [], isLoading, error, refetch } = useQuery({
    queryKey: ['plugins', restEndpoint],
    queryFn: async () => {
      const res = await fetch(`${base}/plugins`, { headers });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      return (data.plugins || []) as PluginInfo[];
    },
    enabled: !!restEndpoint,
    staleTime: 30_000,
  });

  useEffect(() => {
    if (plugins.length > 0 && !selectedPlugin) setSelectedPlugin(plugins[0].name);
  }, [plugins, selectedPlugin]);

  const activePlugin = plugins.find(p => p.name === selectedPlugin);
  const activeIcon = activePlugin ? (MIS_ICONS[activePlugin.name] || Database) : Database;
  const activeName = activePlugin ? (MIS_NAMES[activePlugin.name] || activePlugin.name) : 'MIS';
  const activeColor = activePlugin ? (MIS_COLORS[activePlugin.name] || 'text-brand-primary') : 'text-brand-primary';
  const Icon = activeIcon;

  // Commands grouped by category
  const commandsByCategory = useMemo(() => {
    if (!activePlugin) return {};
    return activePlugin.commands.reduce((acc, cmd) => {
      const cat = cmd.category || 'general';
      if (!acc[cat]) acc[cat] = [];
      acc[cat].push(cmd);
      return acc;
    }, {} as Record<string, PluginInfo['commands']>);
  }, [activePlugin]);

  // Filtered commands
  const filteredCategories = useMemo(() => {
    if (!searchQuery && categoryFilter === 'all') return commandsByCategory;
    const result: Record<string, PluginInfo['commands']> = {};
    Object.entries(commandsByCategory).forEach(([cat, cmds]) => {
      if (categoryFilter !== 'all' && cat !== categoryFilter) return;
      const filtered = cmds.filter(c => 
        !searchQuery || 
        c.intent.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description.toLowerCase().includes(searchQuery.toLowerCase())
      );
      if (filtered.length > 0) result[cat] = filtered;
    });
    return result;
  }, [commandsByCategory, searchQuery, categoryFilter]);

  const allCategories = useMemo(() => 
    ['all', ...Object.keys(commandsByCategory)], [commandsByCategory]
  );

  const totalCommands = activePlugin?.commands.length || 0;
  const totalWebhooks = activePlugin?.webhooks?.length || 0;
  const totalParams = activePlugin?.commands.reduce((s, c) => s + (c.params?.length || 0), 0) || 0;

  const comingSoon = ['erp', 'inventory', 'hotel', 'bank'].filter(id => !plugins.find(p => p.name === id));

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-20">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
            <Database className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">MIS Manager</h1>
            <p className="text-[10px] text-brand-text-muted font-mono uppercase tracking-wider mt-0.5">
              {plugins.length} systems · {totalCommands} commands · {totalWebhooks} webhooks
              {!isLoading && <span className="text-emerald-400 ml-2">● Live</span>}
            </p>
          </div>
        </div>
        <button onClick={() => refetch()} className="p-2 rounded-xl bg-brand-surface border border-brand-border/50 hover:border-brand-primary/30 text-brand-text-muted hover:text-white transition-all">
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} />
        </button>
      </div>

      {/* Plugin Cards */}
      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <div className="py-12 text-center bg-red-500/5 border border-red-500/20 rounded-2xl">
          <p className="text-red-400 font-mono text-sm">Failed to load plugins</p>
          <button onClick={() => refetch()} className="mt-3 text-xs text-brand-primary hover:underline">Retry</button>
        </div>
      ) : (
        <div className="flex gap-2 overflow-x-auto pb-2">
          {plugins.map(plugin => {
            const IconComp = MIS_ICONS[plugin.name] || Database;
            const isSelected = selectedPlugin === plugin.name;
            const color = MIS_COLORS[plugin.name] || 'text-brand-primary';
            return (
              <button key={plugin.name}
                onClick={() => { setSelectedPlugin(plugin.name); setExpandedCommand(null); }}
                className={cn(
                  'min-w-[150px] p-4 rounded-2xl border flex flex-col items-center gap-2.5 transition-all flex-shrink-0 relative group',
                  isSelected ? 'bg-brand-primary/10 border-brand-primary shadow-lg shadow-brand-primary/10' : 'bg-brand-surface border-brand-border/50 hover:border-brand-primary/30'
                )}>
                <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center',
                  isSelected ? 'bg-brand-primary/20' : 'bg-brand-elevated group-hover:bg-brand-primary/10')}>
                  <IconComp className={cn('w-5 h-5', isSelected ? 'text-brand-primary' : 'text-brand-text-muted')} />
                </div>
                <div className="text-center">
                  <span className={cn('text-xs font-bold block', isSelected ? 'text-brand-primary' : 'text-white')}>
                    {MIS_NAMES[plugin.name] || plugin.name}
                  </span>
                  <span className={cn('text-[9px] font-mono', isSelected ? color : 'text-brand-text-muted')}>
                    {plugin.commands.length} cmd
                  </span>
                </div>
                {isSelected && <motion.div layoutId="misActive" className="absolute -bottom-0.5 left-3 right-3 h-0.5 bg-brand-primary rounded-full" />}
              </button>
            );
          })}

          {comingSoon.map(id => {
            const IconComp = MIS_ICONS[id] || Database;
            return (
              <div key={id} className="min-w-[150px] p-4 rounded-2xl border border-brand-border/30 bg-brand-surface/30 flex flex-col items-center gap-2.5 flex-shrink-0 opacity-40">
                <div className="w-10 h-10 rounded-xl bg-brand-elevated flex items-center justify-center">
                  <IconComp className="w-5 h-5 text-brand-text-muted" />
                </div>
                <div className="text-center">
                  <span className="text-xs font-bold text-brand-text-muted block">{MIS_NAMES[id]}</span>
                  <span className="text-[9px] font-mono text-brand-text-muted">Coming soon</span>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Active Plugin */}
      {activePlugin && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          
          {/* Left: Info */}
          <div className="lg:col-span-4 bg-brand-surface border border-brand-border/50 rounded-2xl p-5 flex flex-col">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-lg font-bold text-white">Kanyoza {activeName}</h2>
                <div className="flex gap-1.5 mt-1.5">
                  <span className="px-2 py-0.5 bg-emerald-500/10 text-emerald-400 text-[9px] font-bold font-mono uppercase rounded-full border border-emerald-500/20 flex items-center gap-1">
                    <CheckCircle className="w-2.5 h-2.5" /> Live
                  </span>
                  <span className="px-2 py-0.5 bg-brand-primary/10 text-brand-primary text-[9px] font-bold font-mono uppercase rounded-full border border-brand-primary/20">v10</span>
                </div>
              </div>
              <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center', activeColor.replace('text-', 'bg-').replace('400', '500/20'))}>
                <Icon className={cn('w-6 h-6', activeColor)} />
              </div>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 gap-2 mb-5">
              {[
                { label: 'Commands', value: totalCommands, icon: Terminal, color: 'text-brand-primary' },
                { label: 'Categories', value: Object.keys(commandsByCategory).length, icon: BookOpen, color: 'text-emerald-400' },
                { label: 'Webhooks', value: totalWebhooks, icon: ExternalLink, color: 'text-sky-400' },
                { label: 'Parameters', value: totalParams, icon: Code2, color: 'text-amber-400' },
              ].map(s => (
                <div key={s.label} className="bg-brand-elevated/30 border border-brand-border/30 rounded-xl p-3 text-center">
                  <s.icon className={cn('w-3.5 h-3.5 mx-auto mb-1', s.color)} />
                  <p className={cn('text-lg font-mono font-bold', s.color)}>{s.value}</p>
                  <p className="text-[9px] font-mono text-brand-text-muted uppercase">{s.label}</p>
                </div>
              ))}
            </div>

            <p className="text-[10px] text-brand-text-muted font-mono leading-relaxed mb-4">
              Manage {activeName.toLowerCase()} operations through natural language AI commands or REST API. Workspace-isolated data stored in Supabase.
            </p>

            {/* Webhooks */}
            {activePlugin.webhooks?.length > 0 && (
              <div className="pt-4 border-t border-brand-border/30">
                <h4 className="text-[9px] font-mono font-bold uppercase text-brand-text-muted mb-2">Webhooks</h4>
                {activePlugin.webhooks.map(wh => (
                  <div key={wh.path} className="flex items-center gap-2 text-[10px] font-mono text-brand-text-muted mb-1.5">
                    <span className="px-1.5 py-0.5 bg-brand-elevated rounded text-brand-primary font-bold flex-shrink-0">{wh.method}</span>
                    <span className="truncate">{wh.path}</span>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Right: Commands */}
          <div className="lg:col-span-8 bg-brand-surface border border-brand-border/50 rounded-2xl p-5 flex flex-col">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted flex items-center gap-2">
                <Terminal className="w-3.5 h-3.5 text-brand-primary" /> Commands
              </h3>
              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-brand-text-muted" />
                  <input type="text" placeholder="Filter..." value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    className="pl-7 pr-2 py-1.5 bg-brand-elevated border border-brand-border/50 rounded-lg text-[10px] font-mono text-brand-text w-32 focus:outline-none focus:border-brand-primary/50" />
                </div>
                <select value={categoryFilter} onChange={e => setCategoryFilter(e.target.value)}
                  className="bg-brand-elevated border border-brand-border/50 rounded-lg px-2 py-1.5 text-[10px] font-mono text-brand-text focus:outline-none focus:border-brand-primary/50">
                  {allCategories.map(c => <option key={c} value={c}>{c === 'all' ? 'All' : c}</option>)}
                </select>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 pr-1">
              {Object.keys(filteredCategories).length === 0 ? (
                <div className="py-12 text-center text-brand-text-muted text-xs font-mono">No commands match your filters.</div>
              ) : (
                Object.entries(filteredCategories).map(([category, commands]) => (
                  <div key={category}>
                    <h4 className="text-[9px] font-mono font-bold uppercase text-brand-primary mb-2 tracking-wider">{category}</h4>
                    <div className="space-y-1.5">
                      {commands.map(cmd => (
                        <motion.div key={cmd.intent} layout
                          className={cn(
                            'bg-brand-elevated/30 border border-brand-border/30 rounded-xl overflow-hidden transition-all',
                            expandedCommand === cmd.intent ? 'border-brand-primary/30' : 'hover:border-brand-primary/20'
                          )}>
                          <button
                            onClick={() => setExpandedCommand(expandedCommand === cmd.intent ? null : cmd.intent)}
                            className="w-full p-3.5 flex items-center justify-between text-left gap-3">
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-1.5 flex-wrap mb-1">
                                <span className="px-1.5 py-0.5 bg-brand-primary/10 text-brand-primary text-[9px] font-mono font-bold rounded">
                                  {cmd.intent}
                                </span>
                                {cmd.params?.map(p => (
                                  <span key={p} className="text-[9px] font-mono text-brand-text-muted">{`{${p}}`}</span>
                                ))}
                              </div>
                              <p className="text-[10px] text-brand-text-muted">{cmd.description}</p>
                            </div>
                            <motion.div animate={{ rotate: expandedCommand === cmd.intent ? 180 : 0 }}>
                              <ArrowRight className="w-3.5 h-3.5 text-brand-text-muted flex-shrink-0" />
                            </motion.div>
                          </button>

                          <AnimatePresence>
                            {expandedCommand === cmd.intent && (
                              <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
                                className="px-3.5 pb-3.5 border-t border-brand-border/30">
                                <div className="pt-3 space-y-2.5">
                                  <div>
                                    <span className="text-[9px] font-mono text-brand-text-muted uppercase">Example</span>
                                    <div className="flex items-center gap-2 mt-1">
                                      <p className="text-[10px] font-mono text-brand-primary bg-brand-elevated rounded-lg p-2 flex-1">{cmd.example}</p>
                                      <button onClick={() => { navigator.clipboard.writeText(cmd.example); toast.success('Copied'); }}
                                        className="p-1.5 rounded-lg hover:bg-brand-elevated text-brand-text-muted flex-shrink-0">
                                        <Copy className="w-3 h-3" />
                                      </button>
                                    </div>
                                  </div>
                                  {cmd.params?.length > 0 && (
                                    <div>
                                      <span className="text-[9px] font-mono text-brand-text-muted uppercase">Parameters</span>
                                      <div className="flex flex-wrap gap-1 mt-1">
                                        {cmd.params.map(p => (
                                          <span key={p} className="px-2 py-0.5 bg-brand-primary/5 border border-brand-primary/10 rounded text-[9px] font-mono text-brand-text">{p}</span>
                                        ))}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Empty */}
      {!isLoading && !error && plugins.length === 0 && (
        <div className="py-20 text-center border-2 border-dashed border-brand-border/50 rounded-2xl">
          <Database className="w-12 h-12 text-brand-text-muted/30 mx-auto mb-4" />
          <p className="text-sm text-brand-text-muted font-mono">No MIS plugins deployed.</p>
          <p className="text-xs text-brand-text-muted font-mono mt-1">Add plugin folders to plugins/industries/ and deploy.</p>
        </div>
      )}
    </motion.div>
  );
}
