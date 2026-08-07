import React, { useMemo, useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { 
  Globe, Bot, DollarSign, Activity, 
  ArrowUpRight, ArrowDownRight 
} from 'lucide-react';
import { cn } from '../lib/utils';
import { animate } from 'motion/react';

export type MetricType = 'reach' | 'ai' | 'revenue' | 'api';

export interface MetricCardProps {
  type: MetricType;
  title: string;
  value: string | number | null | undefined;
  trend?: string;
  isUp?: boolean;
  loading?: boolean;
  className?: string;
}

// ── Parse numeric value ────────────────────────────────────────────────────

function parseNumericValue(val: string | number | null | undefined) {
  if (val === null || val === undefined) return { numeric: null, prefix: '', suffix: '' };
  if (typeof val === 'number') return { numeric: val, prefix: '', suffix: '' };
  
  const str = String(val).trim();
  const match = str.match(/^([^\d\s-]*)\s*([\d,.]+)\s*([^\d\s]*)$/);
  if (match) {
    const prefix = match[1] || '';
    const numStr = match[2].replace(/,/g, '');
    const suffix = match[3] || '';
    const numeric = parseFloat(numStr);
    if (!isNaN(numeric)) return { numeric, prefix, suffix };
  }
  return { numeric: null, prefix: '', suffix: str };
}

// ── CountUp ────────────────────────────────────────────────────────────────

function CountUpValue({ value }: { value: string | number }) {
  const { numeric, prefix, suffix } = useMemo(() => parseNumericValue(value), [value]);
  const [displayValue, setDisplayValue] = useState(0);

  useEffect(() => {
    if (numeric === null) return;
    const controls = animate(0, numeric, {
      duration: 0.8,
      ease: 'easeOut',
      onUpdate: (latest) => setDisplayValue(latest),
    });
    return () => controls.stop();
  }, [numeric]);

  if (numeric === null) return <>{value}</>;

  const hasDecimals = String(value).includes('.');
  const formatted = hasDecimals 
    ? displayValue.toFixed(1) 
    : Math.round(displayValue).toLocaleString();

  return <>{prefix}{formatted}{suffix}</>;
}

// ── Type config ────────────────────────────────────────────────────────────

const TYPE_CONFIG = {
  reach:   { icon: Globe,      color: 'text-brand-primary', bg: 'bg-brand-primary/10', glow: 'bg-brand-primary' },
  ai:      { icon: Bot,        color: 'text-brand-accent',  bg: 'bg-brand-accent/10',  glow: 'bg-brand-accent' },
  revenue: { icon: DollarSign, color: 'text-emerald-400',   bg: 'bg-emerald-500/10',  glow: 'bg-emerald-500' },
  api:     { icon: Activity,   color: 'text-amber-400',     bg: 'bg-amber-500/10',    glow: 'bg-amber-500' },
} as const;

// ═══════════════════════════════════════════════════════════════════════════

export default function MetricCard({
  type, title, value, trend, isUp, loading = false, className,
}: MetricCardProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const config = TYPE_CONFIG[type];
  const Icon = config.icon;

  // ── Skeleton ─────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className={cn(
        'bg-brand-surface/50 border border-brand-border/50 rounded-2xl p-5 flex flex-col justify-between h-[130px] relative overflow-hidden animate-pulse',
        className
      )}>
        <div className="flex justify-between items-start mb-3">
          <div className="w-9 h-9 bg-brand-elevated rounded-xl" />
          <div className="w-14 h-5 bg-brand-elevated rounded-full" />
        </div>
        <div className="space-y-2 mt-auto">
          <div className="w-24 h-7 bg-brand-elevated rounded-md" />
          <div className="w-16 h-3 bg-brand-elevated rounded-md" />
        </div>
      </div>
    );
  }

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <motion.div
      whileHover={prefersReducedMotion ? {} : { y: -3 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={cn(
        'group bg-brand-surface/50 border border-brand-border/50 hover:border-brand-primary/30 rounded-2xl p-5 flex flex-col justify-between relative overflow-hidden transition-all duration-300 cursor-pointer h-full min-h-[130px]',
        className
      )}>
      
      {/* Header */}
      <div className="flex justify-between items-start mb-3 z-10">
        <div className={cn('p-2 rounded-xl border border-brand-border/30 bg-brand-elevated/30 transition-colors', config.bg)}>
          <div className="relative w-5 h-5 flex items-center justify-center">
            {type === 'reach' && (
              <motion.div
                animate={prefersReducedMotion ? {} : { rotate: 360 }}
                transition={{ repeat: Infinity, ease: isHovered ? 'easeOut' : 'linear', duration: isHovered ? 3 : 12 }}>
                <Icon className={cn('w-5 h-5', config.color)} />
              </motion.div>
            )}
            {type === 'ai' && (
              <motion.div
                animate={(!prefersReducedMotion && isHovered) ? { rotate: [-5, 5, -5, 0] } : { rotate: 0 }}
                transition={{ duration: 0.6, ease: 'easeInOut' }}>
                <Icon className={cn('w-5 h-5', config.color)} />
              </motion.div>
            )}
            {type === 'revenue' && (
              <motion.div
                animate={(!prefersReducedMotion && isHovered) ? { scale: [1, 1.12, 1] } : { scale: 1 }}
                transition={{ duration: 0.4, ease: [0.34, 1.56, 0.64, 1] }}>
                <Icon className={cn('w-5 h-5', config.color)} />
              </motion.div>
            )}
            {type === 'api' && (
              <motion.div
                animate={prefersReducedMotion ? {} : { opacity: [0.85, 1, 0.85], scale: [0.95, 1.03, 0.95] }}
                transition={{ duration: 2.5, ease: 'easeInOut', repeat: Infinity }}>
                <Icon className={cn('w-5 h-5', config.color)} />
              </motion.div>
            )}
          </div>
        </div>

        {trend && (
          <div className={cn(
            'flex items-center text-[10px] font-bold font-mono px-2 py-0.5 rounded-full border',
            isUp ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-red-500/10 text-red-400 border-red-500/20')}>
            {isUp ? <ArrowUpRight className="w-3 h-3 mr-0.5" /> : <ArrowDownRight className="w-3 h-3 mr-0.5" />}
            {trend}
          </div>
        )}
      </div>

      {/* Value */}
      <div className="z-10 mt-auto">
        <p className="text-2xl lg:text-3xl font-black text-white tracking-tight">
          {value === null || value === undefined ? '—' : <CountUpValue value={value} />}
        </p>
        <p className="text-[10px] text-brand-text-muted font-mono uppercase truncate mt-1 tracking-wider">{title}</p>
      </div>

      {/* Ambient glow */}
      <div className={cn(
        'absolute -bottom-8 -right-8 w-24 h-24 rounded-full filter blur-xl opacity-8 transition-transform duration-700 z-0 group-hover:scale-150 pointer-events-none',
        config.glow
      )} />
    </motion.div>
  );
}
