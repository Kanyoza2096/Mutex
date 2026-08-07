import React, { useState, useEffect, useMemo } from 'react';
import { motion } from 'motion/react';
import { useStore } from '../store/useStore';
import { 
  BarChart3, TrendingUp, Users, MessageSquare, Activity, Bot, ThumbsUp, 
  RefreshCw, AlertTriangle, Zap, Coins, Eye, Clock, Hash, Filter
} from 'lucide-react';
import { 
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, 
  Tooltip, ResponsiveContainer, AreaChart, Area 
} from 'recharts';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

const HOURS = Array.from({ length: 24 }, (_, i) => i);
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-brand-surface/95 backdrop-blur-sm border border-brand-border/50 p-3 rounded-xl shadow-xl font-mono text-[10px]">
      <p className="text-brand-text-muted mb-1.5 font-bold">{label}</p>
      {payload.map((item: any) => (
        <div key={item.name} className="flex items-center gap-2 mb-1 last:mb-0">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color || item.fill }} />
          <span className="text-brand-text-muted">{item.name}:</span>
          <span className="text-white font-bold ml-auto">{typeof item.value === 'number' ? item.value.toLocaleString() : item.value}</span>
        </div>
      ))}
    </div>
  );
}

function StatCard({ label, value, icon: Icon, color, subtitle }: any) {
  return (
    <div className="bg-brand-surface/50 border border-brand-border/50 rounded-2xl p-4 hover:border-brand-border transition-colors group">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[9px] font-mono font-bold uppercase tracking-wider text-brand-text-muted">{label}</span>
        <Icon className={cn('w-4 h-4 group-hover:scale-110 transition-transform', color)} />
      </div>
      <div className={cn('text-xl font-mono font-bold', color)}>{value}</div>
      {subtitle && <p className="text-[9px] text-brand-text-muted font-mono mt-0.5">{subtitle}</p>}
    </div>
  );
}

const SKELETON_STAT = () => (
  <div className="bg-brand-surface/50 border border-brand-border/50 rounded-2xl p-4 animate-pulse space-y-2">
    <div className="flex justify-between"><div className="h-3 w-16 bg-brand-elevated rounded" /><div className="w-4 h-4 bg-brand-elevated rounded" /></div>
    <div className="h-6 w-20 bg-brand-elevated rounded" />
  </div>
);

export default function Analytics() {
  const { restEndpoint, masterToken, stats } = useStore();
  const headers: Record<string, string> = masterToken ? { Authorization: `Bearer ${masterToken}` } : {};
  const base = restEndpoint.replace(/\/+$/, '');

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [analytics, setAnalytics] = useState<any>({});
  const [perfPosts, setPerfPosts] = useState<any[]>([]);
  const [topPosts, setTopPosts] = useState<any[]>([]);
  const [heatmap, setHeatmap] = useState<any>(null);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [selectedMetric, setSelectedMetric] = useState('all');

  const fetchAll = async () => {
    setLoading(true); setError(false);
    try {
      const [aRes, pRes, hRes, mRes] = await Promise.allSettled([
        fetch(`${base}/analytics`, { headers }),
        fetch(`${base}/analytics/posts-performance`, { headers }),
        fetch(`${base}/analytics/engagement-heatmap`, { headers }),
        fetch(`${base}/metrics`, { headers }),
      ]);
      if (aRes.status === 'fulfilled' && aRes.value.ok) setAnalytics(await aRes.value.json());
      if (pRes.status === 'fulfilled' && pRes.value.ok) {
        const d = await pRes.value.json();
        setPerfPosts(d.posts || []);
        setTopPosts((d.posts || []).sort((a: any, b: any) => (b.engagement || b.likes || 0) - (a.engagement || a.likes || 0)));
      }
      if (hRes.status === 'fulfilled' && hRes.value.ok) setHeatmap(await hRes.value.json());
      if (mRes.status === 'fulfilled' && mRes.value.ok) {
        const d = await mRes.value.json();
        const m = d.metrics || {};
        setMetrics(Object.entries(m).filter((e): e is [string, number] => typeof e[1] === 'number').map(([name, value]) => ({ name, value, unit: '' })));
      }
    } catch { setError(true); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchAll(); }, [restEndpoint]);

  const heatGrid: number[][] = heatmap?.heatmap ? DAYS.map((_, i) => heatmap.heatmap[i]?.hours ?? Array(24).fill(0)) : DAYS.map(() => Array(24).fill(0));
  const heatMax = Math.max(1, ...heatGrid.flat());

  const statCards = [
    { label: 'Total Posts', value: (analytics?.total_posts ?? stats?.postsPublished ?? 0).toLocaleString(), icon: MessageSquare, color: 'text-brand-primary' },
    { label: 'Messages', value: (analytics?.total_messages ?? stats?.messagesToday ?? 0).toLocaleString(), icon: Bot, color: 'text-violet-400' },
    { label: 'Active Users', value: (analytics?.active_users ?? stats?.activeUsers ?? 0).toLocaleString(), icon: Users, color: 'text-emerald-400' },
    { label: 'API Calls', value: (analytics?.api_calls ?? stats?.apiCalls ?? 0).toLocaleString(), icon: Activity, color: 'text-amber-400' },
    { label: 'Tokens', value: (analytics?.token_usage ?? 0).toLocaleString(), icon: Coins, color: 'text-sky-400' },
    { label: 'Engagement', value: `${(analytics?.engagement_rate ?? 0).toFixed(1)}%`, icon: ThumbsUp, color: 'text-rose-400' },
  ];

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-24">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
            <BarChart3 className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Analytics</h1>
            <p className="text-[10px] text-brand-text-muted font-mono uppercase tracking-wider mt-0.5">
              Performance Intelligence
            </p>
          </div>
        </div>
        <button onClick={fetchAll} className="p-2 rounded-xl bg-brand-surface border border-brand-border/50 hover:border-brand-primary/30 text-brand-text-muted hover:text-white transition-all">
          <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
        </button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="p-3 bg-amber-500/5 border border-amber-500/20 rounded-xl text-amber-400 text-xs font-mono flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5" /> Some endpoints returned errors — showing available data.
        </div>
      )}

      {/* Stats */}
      {loading ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {[1,2,3,4,5,6].map(i => <SKELETON_STAT key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
          {statCards.map(s => <StatCard key={s.label} {...s} />)}
        </div>
      )}

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Post Volume */}
        <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-5">
          <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted mb-4 flex items-center gap-2">
            <TrendingUp className="w-3.5 h-3.5 text-brand-primary" /> Post Volume
          </h2>
          {loading ? (
            <div className="h-48 flex items-center justify-center"><RefreshCw className="w-5 h-5 animate-spin text-brand-text-muted" /></div>
          ) : perfPosts.length === 0 ? (
            <div className="h-48 flex items-center justify-center text-brand-text-muted font-mono text-xs">No data</div>
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={perfPosts}>
                <defs>
                  <linearGradient id="postGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#818cf8" stopOpacity={0.3} /><stop offset="95%" stopColor="#818cf8" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#27272a" /><XAxis dataKey="date" tick={{ fontSize: 10, fill: '#52525b' }} /><YAxis tick={{ fontSize: 10, fill: '#52525b' }} />
                <Tooltip content={<CustomTooltip />} /><Area type="monotone" dataKey="count" name="Posts" stroke="#818cf8" fill="url(#postGrad)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Top Posts */}
        <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-5">
          <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted mb-4 flex items-center gap-2">
            <Eye className="w-3.5 h-3.5 text-brand-primary" /> Top Performing Posts
          </h2>
          {loading ? (
            <div className="space-y-2">{[1,2,3,4].map(i => <div key={i} className="h-10 bg-brand-elevated/50 rounded-xl animate-pulse" />)}</div>
          ) : topPosts.length === 0 ? (
            <div className="h-40 flex items-center justify-center text-brand-text-muted font-mono text-xs">No data</div>
          ) : (
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {topPosts.slice(0, 8).map((p: any, i: number) => (
                <div key={p.id ?? i} className="flex items-center gap-3 p-2.5 rounded-xl hover:bg-brand-elevated/20 transition-colors group">
                  <span className="text-[10px] font-mono text-brand-text-muted w-5 flex-shrink-0">#{i + 1}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-white truncate">{p.title || p.topic || `Post ${p.id}`}</p>
                  </div>
                  <div className="flex items-center gap-3 text-[10px] font-mono flex-shrink-0">
                    {p.reach !== undefined && <span className="text-brand-primary">{p.reach.toLocaleString()} reach</span>}
                    {p.likes !== undefined && <span className="text-rose-400">{p.likes} ♥</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Heatmap */}
      <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-5">
        <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted mb-4 flex items-center gap-2">
          <Clock className="w-3.5 h-3.5 text-brand-primary" /> Engagement Heatmap (UTC)
        </h2>
        {loading ? (
          <div className="h-24 flex items-center justify-center"><RefreshCw className="w-5 h-5 animate-spin text-brand-text-muted" /></div>
        ) : (
          <div className="overflow-x-auto">
            <div className="inline-block min-w-full">
              <div className="flex items-center gap-0.5 mb-1 ml-10">
                {HOURS.map(h => <div key={h} className="w-7 text-[8px] font-mono text-brand-text-muted text-center">{h}</div>)}
              </div>
              {DAYS.map((day, di) => (
                <div key={day} className="flex items-center gap-0.5 mb-0.5">
                  <div className="w-9 text-[9px] font-mono text-brand-text-muted flex-shrink-0">{day}</div>
                  {HOURS.map(hi => {
                    const val = heatGrid[di]?.[hi] ?? 0;
                    const intensity = 0.06 + (val / heatMax) * 0.94;
                    return (
                      <div key={hi} title={`${day} ${hi}:00 — ${val} engagements`}
                        className="w-7 h-6 rounded-sm transition-colors hover:ring-1 hover:ring-white/20"
                        style={{ backgroundColor: `rgba(129, 140, 248, ${intensity})` }} />
                    );
                  })}
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1 mt-3 justify-end text-[8px] font-mono text-brand-text-muted">
              <span>Low</span>
              <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: 'rgba(129,140,248,0.1)' }} />
              <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: 'rgba(129,140,248,0.35)' }} />
              <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: 'rgba(129,140,248,0.65)' }} />
              <div className="w-4 h-3 rounded-sm" style={{ backgroundColor: 'rgba(129,140,248,1)' }} />
              <span>High</span>
            </div>
          </div>
        )}
      </div>

      {/* System Metrics */}
      {metrics.length > 0 && (
        <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-5">
          <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted mb-4 flex items-center gap-2">
            <Activity className="w-3.5 h-3.5 text-brand-primary" /> System Metrics
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
            {metrics.map((m, i) => (
              <div key={i} className="bg-brand-elevated/30 border border-brand-border/30 rounded-xl p-3 text-center hover:border-brand-border transition-colors">
                <div className="text-sm font-mono font-bold text-white">{m.value.toFixed(1)}</div>
                <div className="text-[9px] font-mono text-brand-text-muted truncate mt-0.5">{m.name.replace(/_/g, ' ')}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </motion.div>
  );
}
