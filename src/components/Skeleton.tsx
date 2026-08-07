import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';

interface SkeletonProps {
  className?: string;
  style?: React.CSSProperties;
}

// ── Base shimmer block ─────────────────────────────────────────────────────

export const Skeleton = ({ className, style }: SkeletonProps) => (
  <div className={cn('relative overflow-hidden rounded-lg bg-white/[0.03]', className)} style={style}>
    <motion.div
      className="absolute inset-0"
      style={{ background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.06), transparent)' }}
      animate={{ x: ['-100%', '100%'] }}
      transition={{ repeat: Infinity, duration: 1.8, ease: 'easeInOut' }}
    />
  </div>
);

// ── Stat card skeleton ─────────────────────────────────────────────────────

export const SkeletonCard = ({ className }: SkeletonProps) => (
  <motion.div
    className={cn('rounded-2xl bg-brand-surface/50 border border-brand-border/50 p-5 space-y-3', className)}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.3 }}>
    <div className="flex items-center justify-between">
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-8 w-8 rounded-xl" />
    </div>
    <Skeleton className="h-8 w-24" />
    <Skeleton className="h-3 w-32" />
  </motion.div>
);

// ── Table skeleton ─────────────────────────────────────────────────────────

export const SkeletonTable = ({ rows = 5, className }: SkeletonProps & { rows?: number }) => (
  <div className={cn('space-y-0', className)}>
    {/* Header */}
    <div className="flex items-center gap-4 px-4 py-3 border-b border-brand-border/30 bg-brand-elevated/10 rounded-t-2xl">
      <Skeleton className="h-3 w-24" />
      <Skeleton className="h-3 w-16" />
      <Skeleton className="h-3 w-20" />
      <Skeleton className="h-3 w-32 ml-auto" />
    </div>
    {/* Rows */}
    {Array.from({ length: rows }).map((_, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.25, delay: i * 0.04 }}
        className="flex items-center gap-4 px-4 py-3 border-b border-brand-border/20 last:border-0">
        <Skeleton className="h-3 w-28" />
        <Skeleton className="h-5 w-14 rounded-full" />
        <Skeleton className="h-3 w-16" />
        <Skeleton className="h-3 w-40 ml-auto" />
      </motion.div>
    ))}
  </div>
);

// ── Chart skeleton ─────────────────────────────────────────────────────────

export const SkeletonChart = ({ className }: SkeletonProps) => (
  <motion.div
    className={cn('rounded-2xl bg-brand-surface/50 border border-brand-border/50 p-5 space-y-4', className)}
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    transition={{ duration: 0.3, delay: 0.08 }}>
    <div className="flex items-center justify-between">
      <Skeleton className="h-3 w-28" />
      <Skeleton className="h-3 w-16" />
    </div>
    {/* Fake chart bars */}
    <div className="flex items-end gap-2 h-40 pt-2">
      {Array.from({ length: 12 }).map((_, i) => (
        <Skeleton key={i} className="flex-1 rounded-t-sm" style={{ height: `${30 + Math.random() * 70}%` }} />
      ))}
    </div>
    <Skeleton className="h-3 w-48 mx-auto" />
  </motion.div>
);

// ── Message / list skeleton ────────────────────────────────────────────────

export const SkeletonList = ({ items = 5, className }: SkeletonProps & { items?: number }) => (
  <div className={cn('space-y-2', className)}>
    {Array.from({ length: items }).map((_, i) => (
      <motion.div
        key={i}
        initial={{ opacity: 0, x: -6 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{ duration: 0.2, delay: i * 0.03 }}
        className="flex items-center gap-3 p-3 rounded-xl bg-brand-surface/30 border border-brand-border/20">
        <Skeleton className="h-8 w-8 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-1.5">
          <Skeleton className="h-3 w-32" />
          <Skeleton className="h-2.5 w-full" />
        </div>
        <Skeleton className="h-3 w-12 flex-shrink-0" />
      </motion.div>
    ))}
  </div>
);

// ── Full page skeleton ─────────────────────────────────────────────────────

export const SkeletonPage = ({ variant = 'dashboard' }: { variant?: 'dashboard' | 'list' | 'detail' }) => {
  if (variant === 'list') {
    return (
      <div className="p-6 space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
        <div className="flex gap-2">
          <Skeleton className="h-9 w-48 rounded-xl" />
          <Skeleton className="h-9 w-24 rounded-xl" />
        </div>
        <SkeletonTable rows={8} />
      </div>
    );
  }

  if (variant === 'detail') {
    return (
      <div className="p-6 space-y-5">
        <Skeleton className="h-8 w-64" />
        <div className="grid grid-cols-4 gap-3">
          {[1,2,3,4].map(i => <SkeletonCard key={i} />)}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-[1.2fr,0.8fr] gap-4">
          <SkeletonList items={6} />
          <div className="space-y-3">
            <SkeletonCard />
            <SkeletonCard />
          </div>
        </div>
      </div>
    );
  }

  // Default: dashboard
  return (
    <div className="p-6 space-y-5">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <motion.div key={i} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.3, delay: i * 0.06 }}>
            <SkeletonCard />
          </motion.div>
        ))}
      </div>
      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SkeletonChart />
        <SkeletonChart />
      </div>
      {/* Table */}
      <div className="rounded-2xl bg-brand-surface/30 border border-brand-border/30 overflow-hidden">
        <SkeletonTable rows={5} />
      </div>
    </div>
  );
};
