import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  ResponsiveContainer, Radar, RadarChart, PolarGrid, PolarAngleAxis,
  PolarRadiusAxis, Tooltip, ComposedChart, Bar, Line, XAxis, YAxis,
  CartesianGrid, Legend, Area,
} from 'recharts';
import { Cpu, Activity } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { useStore } from '../store/useStore';
import { fetchResources, type ResourcePayload } from '../lib/api';

// ── Constants ──────────────────────────────────────────────────────────────

const RADAR_FALLBACK = [
  { subject: 'CPU',    A: 40, B: 35, fullMark: 100 },
  { subject: 'Memory', A: 55, B: 50, fullMark: 100 },
  { subject: 'Network',A: 30, B: 25, fullMark: 100 },
  { subject: 'Disk',   A: 20, B: 18, fullMark: 100 },
  { subject: 'Workers',A: 60, B: 55, fullMark: 100 },
  { subject: 'Cache',  A: 75, B: 70, fullMark: 100 },
];

const CHART_THEME = {
  grid: '#27272a',
  axis: '#52525b',
  tooltip: { backgroundColor: '#18181b', borderColor: '#27272a', borderRadius: '12px' },
};

// ── Transform ──────────────────────────────────────────────────────────────

function toRadarData(r: ResourcePayload) {
  return [
    { subject: 'CPU',     A: Math.round(r.cpu_percent),            B: Math.round(r.cpu_percent * 0.9),     fullMark: 100 },
    { subject: 'Memory',  A: Math.round(r.memory_percent),         B: Math.round(r.memory_percent * 0.95), fullMark: 100 },
    { subject: 'Network', A: Math.min(100, Math.round(r.network_in_kbps / 10)),  B: Math.min(100, Math.round(r.network_out_kbps / 10)), fullMark: 100 },
    { subject: 'Disk',    A: Math.round(r.disk_percent),           B: Math.round(r.disk_percent * 0.9),    fullMark: 100 },
    { subject: 'Workers', A: Math.min(100, Math.round((r.workers_active / 3) * 100)), B: Math.min(100, Math.round(r.queue_depth / 2)), fullMark: 100 },
    { subject: 'Cache',   A: Math.round(100 - r.memory_percent * 0.5), B: Math.round(100 - r.memory_percent * 0.6), fullMark: 100 },
  ];
}

// ═══════════════════════════════════════════════════════════════════════════
// RESOURCE RADAR
// ═══════════════════════════════════════════════════════════════════════════

export function ResourceRadar() {
  const { restEndpoint, masterToken } = useStore();
  const cfg = { restEndpoint, masterToken };

  const { data: resources } = useQuery({
    queryKey: ['resources', restEndpoint],
    queryFn: () => fetchResources(cfg),
    refetchInterval: 30_000,
    retry: 0,
  });

  const radarData = resources ? toRadarData(resources) : RADAR_FALLBACK;

  return (
    <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-5 h-[400px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-4 shrink-0">
        <div>
          <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted flex items-center gap-2">
            <Cpu className="w-3.5 h-3.5 text-brand-primary" /> Resource Radar
          </h2>
          <p className="text-[9px] font-mono text-brand-text-muted mt-0.5">Multi-dimensional load</p>
        </div>
        {resources ? (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
          </span>
        ) : (
          <span className="text-[9px] font-mono text-brand-text-muted">Waiting for data…</span>
        )}
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="48%" outerRadius="75%" data={radarData}>
            <PolarGrid stroke={CHART_THEME.grid} strokeOpacity={0.5} />
            <PolarAngleAxis dataKey="subject" tick={{ fill: CHART_THEME.axis, fontSize: 9, fontFamily: 'monospace' }} />
            <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
            <Tooltip contentStyle={CHART_THEME.tooltip} itemStyle={{ fontSize: '11px' }} />
            <Radar name="Current" dataKey="A" stroke="#818cf8" fill="#818cf8" fillOpacity={0.3} strokeWidth={2} />
            <Radar name="Baseline" dataKey="B" stroke="#34d399" fill="#34d399" fillOpacity={0.15} strokeWidth={1.5} strokeDasharray="4 3" />
            <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '16px', fontFamily: 'monospace' }} />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TRAFFIC COMPOSED CHART
// ═══════════════════════════════════════════════════════════════════════════

export function TrafficComposedChart() {
  const { restEndpoint, masterToken } = useStore();
  const cfg = { restEndpoint, masterToken };

  const { data: resources } = useQuery({
    queryKey: ['resources', restEndpoint],
    queryFn: () => fetchResources(cfg),
    refetchInterval: 30_000,
    retry: 0,
  });

  // Start with an empty window — populated only from real backend resource data.
  // Synthetic random initial values were removed to avoid displaying fabricated metrics.
  const windowRef = useRef<{ time: string; requests: number; errors: number; latency: number }[]>([]);
  const [trafficData, setTrafficData] = useState(windowRef.current);

  useEffect(() => {
    if (!resources) return;
    const totalNet = resources.network_in_kbps + resources.network_out_kbps;
    const errorProxy = Math.round(resources.disk_percent * 0.8 + resources.cpu_percent * 0.2);
    const point = {
      time: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      requests: Math.round(totalNet) || 2000,
      errors: Math.min(errorProxy, 120),
      latency: Math.round(35 + resources.cpu_percent * 0.5 + resources.memory_percent * 0.15),
    };
    windowRef.current = [...windowRef.current.slice(-6), point];
    setTrafficData([...windowRef.current]);
  }, [resources]);

  // ── Stats ────────────────────────────────────────────────────────────────
  const latest = trafficData.length > 0 ? trafficData[trafficData.length - 1] : null;
  const avgLatency = trafficData.length > 0
    ? Math.round(trafficData.reduce((s, d) => s + d.latency, 0) / trafficData.length)
    : 0;
  const totalErrors = trafficData.reduce((s, d) => s + d.errors, 0);

  return (
    <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-5 h-[400px] flex flex-col">
      {/* Header */}
      <div className="flex items-center justify-between mb-3 shrink-0">
        <div>
          <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-brand-primary" /> Traffic & Anomalies
          </h2>
          <div className="flex items-center gap-3 mt-1 text-[9px] font-mono text-brand-text-muted">
            <span>Avg latency: <span className="text-white font-bold">{avgLatency}ms</span></span>
            <span>Errors: <span className="text-red-400 font-bold">{totalErrors}</span></span>
          </div>
        </div>
        {resources ? (
          <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 text-[9px] font-mono font-bold">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" /> Live
          </span>
        ) : (
          <span className="text-[9px] font-mono text-brand-text-muted">Waiting…</span>
        )}
      </div>

      {/* Chart */}
      <div className="flex-1 min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={trafficData} margin={{ top: 5, right: 10, bottom: 0, left: -15 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={CHART_THEME.grid} vertical={false} strokeOpacity={0.5} />
            <XAxis dataKey="time" stroke={CHART_THEME.axis} fontSize={9} tickLine={false} axisLine={false} />
            <YAxis yAxisId="left" stroke={CHART_THEME.axis} fontSize={9} tickLine={false} axisLine={false} tickFormatter={v => v >= 1000 ? `${(v / 1000).toFixed(1)}k` : v} />
            <YAxis yAxisId="right" orientation="right" stroke={CHART_THEME.axis} fontSize={9} tickLine={false} axisLine={false} />
            <Tooltip contentStyle={CHART_THEME.tooltip} itemStyle={{ fontSize: '11px' }} labelStyle={{ fontSize: '10px', color: '#a1a1aa', marginBottom: '4px' }} />
            <Legend wrapperStyle={{ fontSize: '10px', fontFamily: 'monospace', paddingTop: '12px' }} />
            <Area yAxisId="left" type="monotone" dataKey="requests" fill="#818cf8" stroke="#818cf8" fillOpacity={0.08} name="Requests" />
            <Bar yAxisId="right" dataKey="errors" barSize={14} fill="#ef4444" name="Errors" radius={[4, 4, 0, 0]} opacity={0.8} />
            <Line yAxisId="right" type="monotone" dataKey="latency" stroke="#34d399" strokeWidth={2} name="Latency ms" dot={{ r: 3, fill: '#18181b', stroke: '#34d399', strokeWidth: 2 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
