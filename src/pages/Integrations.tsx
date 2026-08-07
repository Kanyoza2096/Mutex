import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { 
  Link, CheckCircle, XCircle, Plug, Server, RefreshCw, Search,
  Wifi, WifiOff, Activity, Filter, Layers, Zap, Globe, Database
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';

interface IntegrationEntry {
  id: string; name: string; category: string;
  connected: boolean; status: string; description: string;
}

const CATEGORY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  'AI': Zap,
  'Social Media': Globe,
  'Database': Database,
  'Infrastructure': Server,
  'Messaging': Activity,
};

const CATEGORY_COLORS: Record<string, string> = {
  'AI': 'text-violet-400',
  'Social Media': 'text-sky-400',
  'Database': 'text-emerald-400',
  'Infrastructure': 'text-amber-400',
  'Messaging': 'text-rose-400',
};

const SkeletonCard = () => (
  <div className="bg-brand-surface/50 border border-brand-border/50 rounded-xl p-4 animate-pulse space-y-3">
    <div className="flex items-center justify-between">
      <div className="h-4 w-24 bg-brand-elevated rounded" />
      <div className="h-5 w-16 bg-brand-elevated rounded-full" />
    </div>
    <div className="h-3 w-full bg-brand-elevated rounded" />
  </div>
);

export default function Integrations() {
  const { restEndpoint, masterToken } = useStore();
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'connected' | 'disconnected'>('all');

  const headers: Record<string, string> = masterToken ? { Authorization: `Bearer ${masterToken}` } : {};
  const base = restEndpoint.replace(/\/+$/, '');

  const { data: integrations, isLoading, error, refetch } = useQuery({
    queryKey: ['integrations', restEndpoint],
    queryFn: async () => {
      const [intRes, connRes] = await Promise.all([
        fetch(`${base}/integrations`, { headers }),
        fetch(`${base}/system/connectors`, { headers }),
      ]);
      const intData = intRes.ok ? await intRes.json() : { integrations: [] };
      const connData = connRes.ok ? await connRes.json() : { supported_connectors: [] };
      return {
        integrations: (intData.integrations || []) as IntegrationEntry[],
        connectors: (connData.supported_connectors || []) as string[],
      };
    },
    enabled: !!restEndpoint,
    staleTime: 60_000,
  });

  const allIntegrations = integrations?.integrations || [];
  const connectors = integrations?.connectors || [];

  // Filtered integrations
  const filteredIntegrations = useMemo(() => {
    let result = [...allIntegrations];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(i => i.name.toLowerCase().includes(q) || i.description?.toLowerCase().includes(q));
    }
    if (statusFilter === 'connected') result = result.filter(i => i.connected);
    if (statusFilter === 'disconnected') result = result.filter(i => !i.connected);
    return result;
  }, [allIntegrations, searchQuery, statusFilter]);

  const categories = useMemo(() => 
    [...new Set(filteredIntegrations.map(i => i.category))],
    [filteredIntegrations]
  );

  const stats = useMemo(() => ({
    total: allIntegrations.length,
    connected: allIntegrations.filter(i => i.connected).length,
    disconnected: allIntegrations.filter(i => !i.connected).length,
    connectors: connectors.length,
  }), [allIntegrations, connectors]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-20">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
            <Link className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Integrations</h1>
            <p className="text-[10px] text-brand-text-muted font-mono uppercase tracking-wider mt-0.5">
              {stats.connected}/{stats.total} connected · {stats.connectors} connectors
            </p>
          </div>
        </div>
        <button onClick={() => refetch()} disabled={isLoading}
          className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand-surface border border-brand-border/50 hover:border-brand-primary/30 text-brand-text-muted hover:text-white text-xs font-bold font-mono uppercase tracking-wider transition-all">
          <RefreshCw className={cn('w-4 h-4', isLoading && 'animate-spin')} /> Refresh
        </button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total', value: stats.total, icon: Layers, color: 'text-brand-primary' },
          { label: 'Connected', value: stats.connected, icon: CheckCircle, color: 'text-emerald-400' },
          { label: 'Disconnected', value: stats.disconnected, icon: XCircle, color: 'text-red-400' },
          { label: 'Connectors', value: stats.connectors, icon: Plug, color: 'text-violet-400' },
        ].map(s => (
          <div key={s.label} className="bg-brand-surface/50 border border-brand-border/50 rounded-xl p-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-brand-text-muted">{s.label}</span>
              <s.icon className={cn('w-3.5 h-3.5', s.color)} />
            </div>
            <div className={cn('text-lg font-mono font-bold', s.color)}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-text-muted" />
          <input type="text" placeholder="Search integrations..." value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full pl-8 pr-3 py-2 bg-brand-surface border border-brand-border/50 rounded-xl text-xs text-brand-text placeholder-brand-text-muted font-mono focus:outline-none focus:border-brand-primary/50 transition-all" />
        </div>
        <div className="flex gap-1 p-1 bg-brand-surface border border-brand-border/50 rounded-xl">
          {(['all', 'connected', 'disconnected'] as const).map(f => (
            <button key={f} onClick={() => setStatusFilter(f)}
              className={cn('px-3 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition-all',
                statusFilter === f ? 'bg-brand-primary text-white' : 'text-brand-text-muted hover:text-white')}>
              {f}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      {isLoading ? (
        <div className="space-y-5">
          {[1, 2].map(s => (
            <div key={s}>
              <div className="h-4 w-24 bg-brand-elevated rounded mb-3 animate-pulse" />
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                {[1,2,3].map(i => <SkeletonCard key={i} />)}
              </div>
            </div>
          ))}
        </div>
      ) : error ? (
        <div className="py-16 text-center">
          <XCircle className="w-10 h-10 text-red-400 mx-auto mb-3 opacity-50" />
          <p className="text-sm text-brand-text-muted font-mono">Failed to load integrations</p>
          <button onClick={() => refetch()} className="mt-3 text-xs text-brand-primary hover:underline">Retry</button>
        </div>
      ) : filteredIntegrations.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-brand-border/50 rounded-2xl">
          <Plug className="w-10 h-10 text-brand-text-muted/30 mx-auto mb-3" />
          <p className="text-sm text-brand-text-muted font-mono">No integrations match your filters.</p>
        </div>
      ) : (
        <div className="space-y-5">
          {categories.map(category => {
            const CatIcon = CATEGORY_ICONS[category] || Plug;
            const catColor = CATEGORY_COLORS[category] || 'text-brand-text-muted';
            const items = filteredIntegrations.filter(i => i.category === category);
            
            return (
              <div key={category}>
                <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted mb-3 flex items-center gap-2">
                  <CatIcon className={cn('w-3.5 h-3.5', catColor)} /> {category}
                  <span className="text-brand-text-muted/50">({items.length})</span>
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                  {items.map(integration => (
                    <motion.div key={integration.id} layout
                      initial={{ opacity: 0 }} animate={{ opacity: 1 }}
                      className="bg-brand-surface border border-brand-border/50 rounded-xl p-4 hover:border-brand-primary/30 transition-all group">
                      <div className="flex items-center justify-between mb-2">
                        <h4 className="text-xs font-bold text-white">{integration.name}</h4>
                        {integration.connected ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-bold font-mono uppercase">
                            <CheckCircle className="w-2.5 h-2.5" /> Active
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 border border-red-500/20 text-[9px] font-bold font-mono uppercase">
                            <XCircle className="w-2.5 h-2.5" /> Off
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-brand-text-muted font-mono leading-relaxed">{integration.description}</p>
                    </motion.div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Connectors */}
      {connectors.length > 0 && (
        <div>
          <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted mb-3 flex items-center gap-2">
            <Server className="w-3.5 h-3.5 text-brand-primary" /> Platform Connectors
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {connectors.map((name, i) => (
              <div key={i} className="bg-brand-surface/50 border border-brand-border/50 rounded-xl p-3 flex items-center gap-2.5">
                <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                <span className="text-xs font-bold text-white capitalize truncate">{name}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
