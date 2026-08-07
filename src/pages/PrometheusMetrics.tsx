import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  AreaChart, Area,
} from 'recharts';
import {
  Activity, Server, RefreshCcw, BarChart3, Clock,
  HardDrive, Zap, Cpu, TrendingUp, TrendingDown, Gauge,
  Layers, Radio, Database,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store/useStore';
import { useQuery } from '@tanstack/react-query';
import { fetchResources, fetchHealth as fetchHealthApi } from '../lib/api';

// ── Chart theme ────────────────────────────────────────────────────────────

const CHART_THEME = {
  grid: '#1E293B',
  axis: '#475569',
  tooltip: { backgroundColor: '#0F172A', borderColor: '#1E293B', color: '#F8FAFC' },
};

// ── Sparkline ──────────────────────────────────────────────────────────────

function Sparkline({ data, color, height = 40 }: { data: number[]; color: string; height?: number }) {
  if (data.length < 2) return <div className="flex items-center justify-center h-full text-brand-text-muted text-xs font-mono">—</div>;
  const max = Math.max(...data, 1);
  const points = data.map((v, i) => `${(i / (data.length - 1)) * 100},${100 - (v / max) * 100}`).join(' ');
  return (
    <svg viewBox="0 0 100 100" className="w-full" style={{ height }}>
      <polyline points={points} fill="none" stroke={color} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      <polygon points={`0,100 ${points} 100,100`} fill={color} opacity="0.08" />
    </svg>
  );
}

function NoData({ label }: { label: string }) {
  return (
    <div className="h-64 flex flex-col items-center justify-center text-brand-text-muted text-xs font-mono uppercase tracking-widest opacity-50">
      <Activity className="w-8 h-8 mb-3 text-brand-border" />
      <span>{label}</span>
    </div>
  );
}

function StatTile({ label, value, icon: Icon, color, subtitle, sparkline, sparkColor }: {
  label: string; value: string; icon: React.ComponentType<any>; color: string;
  subtitle?: string; sparkline?: number[]; sparkColor?: string;
}) {
  return (
    <div className="bg-brand-surface/50 border border-brand-border/50 rounded-xl p-3.5 hover:border-brand-border transition-colors group">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-brand-text-muted">{label}</span>
        <Icon className={cn('w-3.5 h-3.5', color)} />
      </div>
      <div className="flex items-end gap-3">
        <div>
          <div className={cn('text-xl font-mono font-bold', color)}>{value}</div>
          {subtitle && <p className="text-[9px] text-brand-text-muted font-mono mt-0.5">{subtitle}</p>}
        </div>
        {sparkline && sparkColor && (
          <div className="flex-1 h-10"><Sparkline data={sparkline} color={sparkColor} height={40} /></div>
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════

export default function PrometheusMetrics() {
  const { restEndpoint, masterToken, latencyHistory, systemResources, dataChannelStatus, workflowMetrics } = useStore();
  const cfg = { restEndpoint, masterToken };
  const [activeTab, setActiveTab] = useState<'system' | 'app' | 'database'>('system');
  const [timeRange, setTimeRange] = useState<'5m' | '15m' | '1h'>('5m');

  const timeRangeMs = useMemo(() =>
    timeRange === '5m' ? 300_000 : timeRange === '15m' ? 900_000 : 3_600_000,
    [timeRange]
  );
  const pointsToShow = timeRange === '5m' ? 20 : timeRange === '15m' ? 30 : 40;

  const { data: healthData, isFetching, refetch } = useQuery({
    queryKey: ['health-deep', restEndpoint],
    queryFn: () => fetchHealthApi(cfg),
    retry: 1,
    staleTime: 15_000,
    refetchInterval: 30_000,
  });

  // Phase 4: system_resources are pushed via Socket.IO (useStore.systemResources).
  // REST is used only for initial hydration + 30s reconciliation.
  const { data: resources } = useQuery({
    queryKey: ['resources', restEndpoint],
    queryFn: () => fetchResources(cfg),
    retry: 1,
    staleTime: 25_000,
    refetchInterval: 30_000,
  });

  const isLive = !!healthData && !isFetching;

  // ── Chart data ───────────────────────────────────────────────────────────

  const chartData = useMemo(() => {
    if (latencyHistory.length < 2) return [];
    const recent = latencyHistory.slice(-pointsToShow);
    const now = Date.now();
    const interval = timeRangeMs / recent.length;
    // p99 and p50 were removed — they were estimated via 1.5× and 0.6× multipliers
    // rather than measured from real request data, producing synthetic percentiles.
    return recent.map((latMs, i) => ({
      time: new Date(now - (recent.length - 1 - i) * interval).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      latency: latMs,
    }));
  }, [latencyHistory, pointsToShow, timeRangeMs]);

  const noChartData = chartData.length < 2;

  // ── Stats ────────────────────────────────────────────────────────────────

  const avgLatency = latencyHistory.length > 0
    ? Math.round(latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length) : null;
  // Peak latency over the last 20 observations — no multiplier applied.
  const p99Latency = latencyHistory.length > 0
    ? Math.round(Math.max(...latencyHistory.slice(-20))) : null;

  const cpu = (resources?.cpu_percent ?? systemResources.cpu_percent) || null;
  const memory = (resources?.memory_percent ?? systemResources.memory_percent) || null;
  const disk = (resources?.disk_percent ?? systemResources.disk_percent) || null;
  
  const serviceCount = healthData?.services ? Object.keys(healthData.services).length : 0;
  const healthyCount = healthData?.services
    ? Object.values(healthData.services).filter((s: any) => s.status === 'ok' || s.status === 'online').length : 0;

  // DB-related services — filter dynamically
  const dbKeywords = ['supabase', 'redis', 'database', 'db', 'postgres', 'sql', 'storage'];
  const dbServices = useMemo(() => {
    if (!healthData?.services) return [];
    return Object.entries(healthData.services)
      .filter(([name]) => dbKeywords.some(k => name.toLowerCase().includes(k)));
  }, [healthData]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="max-w-7xl mx-auto pb-24 md:pb-0 space-y-5">

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
            <BarChart3 className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Metrics</h1>
            <p className="text-[10px] text-brand-text-muted font-mono uppercase tracking-wider mt-0.5">
              {serviceCount} services · {healthyCount} healthy · {avgLatency ? `${avgLatency}ms avg` : 'No data'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-0.5 p-0.5 bg-brand-surface border border-brand-border/50 rounded-lg">
            {(['5m', '15m', '1h'] as const).map(r => (
              <button key={r} onClick={() => setTimeRange(r)}
                className={cn('px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase transition-all',
                  timeRange === r ? 'bg-brand-primary text-white' : 'text-brand-text-muted hover:text-white')}>{r}</button>
            ))}
          </div>

          <div className="flex gap-0.5 p-0.5 bg-brand-surface border border-brand-border/50 rounded-lg">
            {(['system', 'app', 'database'] as const).map(tab => (
              <button key={tab} onClick={() => setActiveTab(tab)}
                className={cn('px-3 py-1 rounded-md text-[10px] font-mono font-bold uppercase transition-all',
                  activeTab === tab ? 'bg-brand-primary text-white' : 'text-brand-text-muted hover:text-white')}>{tab}</button>
            ))}
          </div>

          <button onClick={() => refetch()} disabled={isFetching}
            className="p-2 rounded-lg bg-brand-surface border border-brand-border/50 hover:border-brand-primary/30 text-brand-text-muted hover:text-white transition-all">
            <RefreshCcw className={cn('w-4 h-4', isFetching && 'animate-spin')} />
          </button>

          <div className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[10px] font-mono font-bold',
            isLive ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400' : 'bg-amber-500/10 border-amber-500/30 text-amber-400'
          )}>
            <div className={cn('w-1.5 h-1.5 rounded-full', isLive ? 'bg-emerald-400 animate-pulse' : 'bg-amber-400')} />
            {isLive ? 'Live' : 'Waiting'}
          </div>
        </div>
      </div>

      {/* Enterprise data channel bar */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: 'WS', status: dataChannelStatus.socketIO },
          { label: 'REST', status: dataChannelStatus.restPolling },
          { label: 'DB', status: dataChannelStatus.supabaseRealtime },
        ].map(c => (
          <div key={c.label} className="bg-brand-surface/50 border border-brand-border/50 rounded-xl p-2 flex items-center gap-2">
            <Radio className={cn('w-3 h-3', c.status === 'connected' || c.status === 'active' || c.status === 'subscribed' ? 'text-emerald-400' : 'text-amber-400')} />
            <span className="text-[9px] font-mono text-brand-text-muted">{c.label}</span>
            <span className={cn('text-[9px] font-mono ml-auto capitalize',
              c.status === 'connected' || c.status === 'active' || c.status === 'subscribed' ? 'text-emerald-400' : 'text-amber-400')}>{c.status}</span>
          </div>
        ))}
      </div>

      {/* Service health cards */}
      {healthData?.services && (
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {Object.entries(healthData.services).map(([name, svc]: any) => {
            const ok = svc.status === 'ok' || svc.status === 'online';
            return (
              <div key={name} className={cn(
                'rounded-xl border p-2.5 flex items-center gap-2.5',
                ok ? 'bg-emerald-500/5 border-emerald-500/20' :
                svc.status === 'error' || svc.status === 'offline' ? 'bg-red-500/5 border-red-500/20' : 'bg-amber-500/5 border-amber-500/20'
              )}>
                <div className={cn('w-2 h-2 rounded-full flex-shrink-0',
                  ok ? 'bg-emerald-400' : svc.status === 'error' || svc.status === 'offline' ? 'bg-red-400' : 'bg-amber-400')} />
                <div className="min-w-0">
                  <p className="text-[10px] font-mono font-bold text-white truncate">{name}</p>
                  {svc.latency_ms !== undefined && <p className="text-[9px] font-mono text-brand-text-muted">{svc.latency_ms}ms</p>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Primary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Avg Latency" value={avgLatency ? `${avgLatency}ms` : '—'} icon={Clock} color="text-brand-primary"
          subtitle="Mean observed" sparkline={latencyHistory.slice(-20)} sparkColor="#818cf8" />
        <StatTile label="Peak Latency" value={p99Latency ? `${p99Latency}ms` : '—'} icon={TrendingUp} color="text-red-400" subtitle="Max observed (last 20)" />
        <StatTile label="CPU" value={cpu != null ? `${cpu.toFixed(1)}%` : '—'} icon={Cpu} color="text-amber-400" subtitle="Process usage" />
        <StatTile label="Memory" value={memory != null ? `${memory.toFixed(1)}%` : '—'} icon={Server} color="text-violet-400" subtitle="RSS usage" />
      </div>

      {/* Secondary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatTile label="Disk" value={disk != null ? `${disk.toFixed(1)}%` : '—'} icon={HardDrive} color="text-emerald-400" />
        <StatTile label="Services" value={`${healthyCount}/${serviceCount}`} icon={Layers} color="text-brand-primary" subtitle="Healthy / Total" />
        <StatTile label="Workers" value={resources?.workers_active != null ? String(resources.workers_active) : '—'} icon={Zap} color="text-amber-400" />
        <StatTile label="Queue" value={resources?.queue_depth != null ? String(resources.queue_depth) : '—'} icon={Gauge} color="text-violet-400" />
      </div>

      {/* Charts */}
      <AnimatePresence>
        {activeTab === 'system' && (
          <motion.div key="system" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-4">

            <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 text-brand-primary" /> Observed Latency
                </h2>
                <span className="text-[9px] font-mono text-brand-text-muted">Last {timeRange}</span>
              </div>
              <div className="h-64">
                {noChartData ? <NoData label="No latency data yet" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} vertical={false} />
                      <XAxis dataKey="time" stroke={CHART_THEME.axis} fontSize={10} tickLine={false} />
                      <YAxis stroke={CHART_THEME.axis} fontSize={10} tickFormatter={v => `${v}ms`} tickLine={false} />
                      <Tooltip contentStyle={CHART_THEME.tooltip} formatter={(v) => [`${v ?? ''}ms`]} />
                      <Line type="monotone" dataKey="latency" stroke="#818cf8" strokeWidth={2} dot={false} name="Latency" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>

            <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted flex items-center gap-2">
                  <Activity className="w-3.5 h-3.5 text-brand-primary" /> Latency Area
                </h2>
              </div>
              <div className="h-64">
                {noChartData ? <NoData label="No latency data yet" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                      <defs>
                        <linearGradient id="latGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} />
                          <stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} vertical={false} />
                      <XAxis dataKey="time" stroke={CHART_THEME.axis} fontSize={10} tickLine={false} />
                      <YAxis stroke={CHART_THEME.axis} fontSize={10} tickFormatter={v => `${v}ms`} tickLine={false} />
                      <Tooltip contentStyle={CHART_THEME.tooltip} formatter={(v) => [`${v ?? ''}ms`, 'Latency']} />
                      <Area type="monotone" dataKey="latency" stroke="#818cf8" fill="url(#latGrad)" name="Latency ms" />
                    </AreaChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'app' && (
          <motion.div key="app" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-5">
              <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted mb-4 flex items-center gap-2">
                <TrendingUp className="w-3.5 h-3.5 text-red-400" /> Peak Latency
              </h2>
              <div className="h-64">
                {noChartData ? <NoData label="No data" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} vertical={false} />
                      <XAxis dataKey="time" stroke={CHART_THEME.axis} fontSize={10} tickLine={false} />
                      <YAxis stroke={CHART_THEME.axis} fontSize={10} tickFormatter={v => `${v}ms`} tickLine={false} />
                      <Tooltip contentStyle={CHART_THEME.tooltip} />
                      <Line type="monotone" dataKey="latency" stroke="#ef4444" strokeWidth={2} dot={false} />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
            <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-5">
              <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted mb-4 flex items-center gap-2">
                <TrendingDown className="w-3.5 h-3.5 text-emerald-400" /> Avg Latency
              </h2>
              <div className="h-64">
                {noChartData ? <NoData label="No data" /> : (
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={chartData}>
                      <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} vertical={false} />
                      <XAxis dataKey="time" stroke={CHART_THEME.axis} fontSize={10} tickLine={false} />
                      <YAxis stroke={CHART_THEME.axis} fontSize={10} tickFormatter={v => `${v}ms`} tickLine={false} />
                      <Tooltip contentStyle={CHART_THEME.tooltip} />
                      <Line type="monotone" dataKey="latency" stroke="#34d399" strokeWidth={2} dot={false} strokeDasharray="4 2" />
                    </LineChart>
                  </ResponsiveContainer>
                )}
              </div>
            </div>
          </motion.div>
        )}

        {activeTab === 'database' && (
          <motion.div key="database" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-5">
              <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted mb-4 flex items-center gap-2">
                <Database className="w-3.5 h-3.5 text-brand-primary" /> Database Services
              </h2>
              <div className="space-y-2">
                {dbServices.length > 0 ? (
                  dbServices.map(([name, svc]: any) => {
                    const ok = svc.status === 'ok' || svc.status === 'online';
                    return (
                      <div key={name} className="flex items-center justify-between p-3 rounded-xl bg-brand-elevated/30 border border-brand-border/30">
                        <span className="text-xs font-mono font-bold text-white">{name}</span>
                        <div className="flex items-center gap-3">
                          {svc.latency_ms != null && <span className="text-[10px] font-mono text-brand-text-muted">{svc.latency_ms}ms</span>}
                          <span className={cn('px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase',
                            ok ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>{svc.status}</span>
                        </div>
                      </div>
                    );
                  })
                ) : <NoData label="No database services detected" />}
              </div>
            </div>

            <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-5">
              <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted mb-4 flex items-center gap-2">
                <HardDrive className="w-3.5 h-3.5 text-brand-primary" /> Resources
              </h2>
              {resources || systemResources.cpu_percent > 0 ? (
                <div className="space-y-4">
                  {[
                    { label: 'Disk', value: disk || 0, color: '#34d399' },
                    { label: 'CPU', value: cpu || 0, color: '#f59e0b' },
                    { label: 'Memory', value: memory || 0, color: '#818cf8' },
                  ].map(r => (
                    <div key={r.label}>
                      <div className="flex justify-between text-[10px] font-mono mb-1">
                        <span className="text-brand-text-muted uppercase">{r.label}</span>
                        <span className="text-brand-text font-bold">{r.value?.toFixed(1)}%</span>
                      </div>
                      <div className="h-1.5 bg-brand-elevated rounded-full overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.min(100, r.value || 0)}%`, backgroundColor: r.color }} />
                      </div>
                    </div>
                  ))}
                  <div className="grid grid-cols-2 gap-3 pt-2">
                    <div className="text-center p-2 rounded-xl bg-brand-elevated/30 border border-brand-border/30">
                      <p className="text-[9px] font-mono text-brand-text-muted uppercase">Net In</p>
                      <p className="text-xs font-mono font-bold text-white">{resources?.network_in_kbps?.toFixed(0) ?? '—'} kbps</p>
                    </div>
                    <div className="text-center p-2 rounded-xl bg-brand-elevated/30 border border-brand-border/30">
                      <p className="text-[9px] font-mono text-brand-text-muted uppercase">Net Out</p>
                      <p className="text-xs font-mono font-bold text-white">{resources?.network_out_kbps?.toFixed(0) ?? '—'} kbps</p>
                    </div>
                  </div>
                </div>
              ) : <NoData label="No resource data" />}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
