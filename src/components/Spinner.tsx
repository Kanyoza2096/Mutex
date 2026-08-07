import React from 'react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { Sparkles } from 'lucide-react';

interface SpinnerProps {
  className?: string;
  size?: number;
}

// ── 1. Dual-ring spinner (premium) ────────────────────────────────────────

export const Spinner = ({ className, size = 16 }: SpinnerProps) => (
  <span className={cn('relative inline-block shrink-0', className)} style={{ width: size, height: size }}>
    <motion.span
      className="absolute inset-0 rounded-full border-2 border-current border-t-transparent"
      style={{ opacity: 0.9 }}
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 0.7, ease: 'linear' }}
    />
    <motion.span
      className="absolute inset-0 rounded-full border-2 border-current border-b-transparent"
      style={{ opacity: 0.25 }}
      animate={{ rotate: -360 }}
      transition={{ repeat: Infinity, duration: 1.1, ease: 'linear' }}
    />
  </span>
);

// ── 2. Centered block spinner ─────────────────────────────────────────────

export const SpinnerBlock = ({ label = 'Loading…' }: { label?: string }) => (
  <motion.div
    initial={{ opacity: 0 }}
    animate={{ opacity: 1 }}
    className="flex flex-col items-center justify-center gap-3 py-16 text-brand-text-muted">
    <Spinner size={32} className="text-brand-primary" />
    <span className="text-[10px] font-mono uppercase tracking-widest">{label}</span>
  </motion.div>
);

// ── 3. Three bouncing dots (AI thinking) ──────────────────────────────────

export const ThinkingDots = ({ className }: { className?: string }) => (
  <div className={cn('flex items-center gap-1', className)}>
    {[0, 0.15, 0.3].map((delay, i) => (
      <motion.span
        key={i}
        className="w-2 h-2 rounded-full bg-brand-primary"
        animate={{ opacity: [0.3, 1, 0.3], y: [0, -5, 0] }}
        transition={{ duration: 1, repeat: Infinity, delay }}
      />
    ))}
  </div>
);

// ── 4. Glowing orb spinner ────────────────────────────────────────────────

export const GlowSpinner = ({ size = 48, className }: { size?: number; className?: string }) => (
  <motion.div
    className={cn('relative', className)}
    style={{ width: size, height: size }}
    animate={{ boxShadow: [
      '0 0 8px rgba(99,102,241,0.3)',
      '0 0 24px rgba(99,102,241,0.6)',
      '0 0 8px rgba(99,102,241,0.3)',
    ]}}
    transition={{ duration: 2, repeat: Infinity }}>
    <Sparkles className="w-full h-full text-brand-primary animate-spin" />
  </motion.div>
);

// ── 5. Progress bar spinner ───────────────────────────────────────────────

export const ProgressSpinner = ({ progress, label }: { progress: number; label?: string }) => (
  <div className="space-y-1.5">
    {label && (
      <div className="flex justify-between text-[9px] font-mono text-brand-text-muted">
        <span>{label}</span>
        <span>{Math.round(progress)}%</span>
      </div>
    )}
    <div className="w-full h-1.5 bg-brand-elevated rounded-full overflow-hidden">
      <motion.div
        className="h-full bg-brand-primary rounded-full"
        initial={{ width: 0 }}
        animate={{ width: `${progress}%` }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
      />
    </div>
  </div>
);

// ── 6. Ripple spinner (expanding rings) ───────────────────────────────────

export const RippleSpinner = ({ size = 32, className }: { size?: number; className?: string }) => (
  <div className={cn('relative', className)} style={{ width: size, height: size }}>
    {[0, 0.4, 0.8].map((delay, i) => (
      <motion.div
        key={i}
        className="absolute inset-0 rounded-full border-2 border-brand-primary"
        initial={{ scale: 0.3, opacity: 1 }}
        animate={{ scale: 1.5, opacity: 0 }}
        transition={{ duration: 1.5, repeat: Infinity, delay, ease: 'easeOut' }}
      />
    ))}
  </div>
);

// ── 7. Inline text spinner ────────────────────────────────────────────────

export const InlineSpinner = ({ text = 'Loading' }: { text?: string }) => (
  <span className="inline-flex items-center gap-2 text-xs font-mono text-brand-text-muted">
    <Spinner size={12} className="text-brand-primary" />
    {text}
    <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1.5, repeat: Infinity }}>…</motion.span>
  </span>
);

// ── 8. Full page spinner ──────────────────────────────────────────────────

export const PageSpinner = ({ title = 'Loading', subtitle }: { title?: string; subtitle?: string }) => (
  <div className="min-h-[60vh] flex flex-col items-center justify-center gap-4">
    <motion.div
      className="w-16 h-16 rounded-2xl bg-brand-primary/10 border border-brand-primary/20 flex items-center justify-center"
      animate={{ boxShadow: [
        '0 0 0px rgba(99,102,241,0)',
        '0 0 32px rgba(99,102,241,0.2)',
        '0 0 0px rgba(99,102,241,0)',
      ]}}
      transition={{ duration: 2.5, repeat: Infinity }}>
      <Spinner size={28} className="text-brand-primary" />
    </motion.div>
    <div className="text-center">
      <p className="text-sm font-bold text-white">{title}</p>
      {subtitle && <p className="text-[10px] font-mono text-brand-text-muted mt-1">{subtitle}</p>}
    </div>
  </div>
);
