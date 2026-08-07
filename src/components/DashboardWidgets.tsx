import React, { useEffect, useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { AreaChart, Area, ResponsiveContainer, YAxis } from 'recharts';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';
import { formatDistanceToNow } from 'date-fns';
import {
  AlertTriangle, Activity, CheckCircle2, ServerCrash, MessageSquare,
  Clock, ShieldAlert, TrendingUp, TrendingDown,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATED NUMBER — CSS transition, no Framer Motion spring
// ═══════════════════════════════════════════════════════════════════════════

function AnimatedNumber({ value, size = 'lg' }: { value: number; size?: 'sm' | 'md' | 'lg' }) {
  const [display, setDisplay] = useState(value);
  const sizeClass = size === 'lg' ? 'text-4xl' : size === 'md' ? 'text-2xl' : 'text-lg';

  useEffect(() => {
    // Animate from current display to new value
    if (display === value) return;
    const start = display;
    const diff = value - start;
    const duration = 600;
    const startTime = performance.now();
    let frame: number;

    const animate = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(start + diff * eased));
      if (progress < 1) frame = requestAnimationFrame(animate);
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <span className={cn('font-extrabold font-mono tracking-tight', sizeClass)}>{display.toLocaleString()}</span>;
}

// ═══════════════════════════════════════════════════════════════════════════
// STAT CARD
// ═══════════════════════════════════════════════════════════════════════════

interface StatCardProps {
  title: string;
  value: number;
  icon: React.ComponentType<any>;
  trend?: number;
  trendUp?: boolean;
  sparklineData?: { value: number }[];
  colorClass?: string;
}

export function StatCard({ title, value, icon: Icon, trend, trendUp, sparklineData, colorClass }: StatCardProps) {
  const defaultSparkline = useMemo(() =>
    Array.from({ length: 8 }, (_, i) => ({ value: 35 + Math.sin(i * 0.8) * 15 })),
    []
  );
  const data = sparklineData?.length ? sparklineData : defaultSparkline;
  const lineColor = trendUp ? '#34d399' : '#818cf8';

  return (
    <div className="bg-brand-surface/50 border border-brand-border/50 rounded-2xl p-5 relative overflow-hidden group h-full flex flex-col justify-between hover:border-brand-border hover:scale-[1.02] hover:-translate-y-0.5 transition-all duration-200">
      <div className="flex justify-between items-start mb-3 relative z-10">
        <div className={cn('p-2.5 rounded-xl bg-brand-elevated/50 border border-brand-border/30 group-hover:border-brand-border/50 transition-colors', colorClass)}>
          <Icon className="w-5 h-5" />
        </div>
        {trend !== undefined && (
          <div className={cn('flex items-center gap-1 text-[10px] font-bold font-mono px-2 py-1 rounded-full border',
            trendUp ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20')}>
            {trendUp ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {trend}%
          </div>
        )}
      </div>

      <div className="relative z-10 mt-auto">
        <h3 className="text-[10px] font-mono font-bold text-brand-text-muted uppercase tracking-wider mb-1">{title}</h3>
        <AnimatedNumber value={value} />
      </div>

      <div className="absolute bottom-0 left-0 w-full h-20 opacity-15 group-hover:opacity-30 transition-opacity pointer-events-none">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data}>
            <YAxis domain={['dataMin', 'dataMax']} hide />
            <Area type="monotone" dataKey="value" stroke={lineColor} fill={lineColor} fillOpacity={0.3} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LIVE STREAM
// ═══════════════════════════════════════════════════════════════════════════

export function LiveStream() {
  const { messages, isStreamPaused, setStreamPaused } = useStore();

  return (
    <div className="bg-brand-surface border border-brand-border/50 rounded-2xl flex flex-col h-[400px]">
      <div className="p-4 border-b border-brand-border/30 flex items-center justify-between bg-brand-elevated/5">
        <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted flex items-center gap-2">
          <MessageSquare className="w-3.5 h-3.5 text-brand-primary" /> Live Stream
        </h2>
        <button onClick={() => setStreamPaused(!isStreamPaused)}
          className={cn('text-[9px] font-mono font-bold px-2.5 py-1 rounded-full border transition-all',
            isStreamPaused ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20')}>
          {isStreamPaused ? '▶ Resume' : '⏸ Pause'}
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {messages.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-brand-text-muted gap-2">
            <MessageSquare className="w-8 h-8 opacity-20" />
            <p className="font-mono text-[10px] uppercase tracking-wider opacity-50">Waiting for messages…</p>
          </div>
        ) : (
          messages.map((msg, i) => (
            <div key={msg.id || `msg-${i}`}
              className={cn('flex items-start gap-3 p-2.5 rounded-xl border transition-colors',
                i === 0 && !isStreamPaused ? 'bg-brand-primary/5 border-brand-primary/20' : 'border-transparent hover:bg-brand-elevated/30')}>
              <img src={msg.avatar} alt="" className="w-8 h-8 rounded-full border border-brand-border/30 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-baseline mb-0.5">
                  <span className="text-xs font-bold text-white truncate">{msg.user}</span>
                  <span className="text-[9px] text-brand-text-muted font-mono flex-shrink-0 ml-2">{formatDistanceToNow(msg.time)} ago</span>
                </div>
                <p className="text-[10px] text-brand-text-muted truncate">{msg.message}</p>
              </div>
              <span className="text-sm flex-shrink-0">{msg.sentiment === 'positive' ? '🟢' : msg.sentiment === 'negative' ? '🔴' : '⚪'}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HEALTH MATRIX
// ═══════════════════════════════════════════════════════════════════════════

export function HealthMatrix() {
  const { healthMatrix } = useStore();
  const overallScore = healthMatrix.length > 0
    ? Math.round(healthMatrix.reduce((acc, curr) => acc + curr.uptime, 0) / healthMatrix.length)
    : 100;

  return (
    <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-5 flex flex-col h-full min-h-[400px]">
      <div className="flex justify-between items-end mb-5">
        <div>
          <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted flex items-center gap-2 mb-1">
            <Activity className="w-3.5 h-3.5 text-brand-primary" /> System Matrix
          </h2>
          <p className="text-[9px] font-mono text-brand-text-muted">{healthMatrix.length} services monitored</p>
        </div>
        <div className="text-right">
          <div className={cn('text-3xl font-extrabold font-mono',
            overallScore >= 99 ? 'text-emerald-400' : overallScore >= 95 ? 'text-amber-400' : 'text-red-400')}>
            {overallScore}%
          </div>
          <div className="text-[9px] font-mono uppercase tracking-wider text-brand-text-muted">Uptime</div>
        </div>
      </div>

      {healthMatrix.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-brand-text-muted gap-2">
          <Activity className="w-8 h-8 opacity-20" />
          <p className="font-mono text-[10px] uppercase tracking-wider opacity-50">No services</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-2 flex-1 content-start">
          {healthMatrix.map(service => (
            <div key={service.id}
              className={cn('p-3 rounded-xl border transition-all hover:scale-[1.02] duration-150',
                service.status === 'online'   ? 'bg-emerald-500/5 border-emerald-500/20 hover:border-emerald-500/40' :
                service.status === 'degraded' ? 'bg-amber-500/5 border-amber-500/20 hover:border-amber-500/40' :
                                                'bg-red-500/5 border-red-500/20 hover:border-red-500/40')}>
              <div className="flex justify-between items-start mb-2">
                <span className="text-[10px] font-bold text-white truncate mr-2">{service.name}</span>
                {service.status === 'online'   ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 flex-shrink-0" /> :
                 service.status === 'degraded' ? <AlertTriangle className="w-3.5 h-3.5 text-amber-400 animate-pulse flex-shrink-0" /> :
                                                 <ServerCrash   className="w-3.5 h-3.5 text-red-400 animate-pulse flex-shrink-0" />}
              </div>
              <div className="flex justify-between items-end mt-auto">
                <span className="text-[9px] font-mono text-brand-text-muted">{service.uptime}%</span>
                <span className="text-[9px] font-mono font-bold text-white">{service.latency}ms</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// GUARDIAN ALERTS
// ═══════════════════════════════════════════════════════════════════════════

export function GuardianAlertsWidget() {
  const { guardianAlerts } = useStore();
  const navigate = useNavigate();
  const hasCritical = guardianAlerts.some(a => a.severity === 'CRITICAL');

  return (
    <div className={cn('bg-brand-surface border rounded-2xl p-5 flex flex-col relative overflow-hidden transition-colors',
      hasCritical ? 'border-red-500/30 shadow-[inset_0_0_50px_rgba(239,68,68,0.05)]' : 'border-brand-border/50')}>
      {hasCritical && <div className="absolute top-0 left-0 w-full h-0.5 bg-red-400 animate-pulse" />}

      <div className="flex justify-between items-center mb-4">
        <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted flex items-center gap-2">
          <ShieldAlert className={cn('w-3.5 h-3.5', hasCritical ? 'text-red-400' : 'text-brand-text-muted')} />
          Guardian
        </h2>
        {guardianAlerts.length > 0 && (
          <button onClick={() => navigate('/guardian')}
            className="text-[9px] font-mono text-brand-primary hover:text-white transition-colors uppercase">
            View all →
          </button>
        )}
      </div>

      {guardianAlerts.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-brand-text-muted gap-2 py-4">
          <CheckCircle2 className="w-8 h-8 text-emerald-400 opacity-40" />
          <p className="font-mono text-[10px] uppercase tracking-wider opacity-60">All Clear</p>
        </div>
      ) : (
        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {guardianAlerts.map(alert => (
            <div key={alert.id} onClick={() => navigate('/guardian')}
              className="p-2.5 bg-brand-bg/50 rounded-xl border border-brand-border/30 flex items-start gap-3 cursor-pointer hover:border-brand-border/60 hover:bg-brand-elevated/20 transition-all group">
              <div className={cn('w-2 h-2 rounded-full mt-1.5 flex-shrink-0 shadow-lg',
                alert.severity === 'CRITICAL' ? 'bg-red-400 shadow-red-400/30' :
                alert.severity === 'HIGH'     ? 'bg-amber-400 shadow-amber-400/30' : 'bg-violet-400 shadow-violet-400/30')} />
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-bold text-white leading-tight mb-0.5 group-hover:text-brand-primary transition-colors">{alert.title}</p>
                <p className="text-[9px] font-mono text-brand-text-muted">{formatDistanceToNow(alert.time)} ago</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
