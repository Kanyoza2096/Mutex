// components/Spinners.tsx
import React from 'react';
import { motion } from 'motion/react';
import { RefreshCw, Loader2, Sparkles } from 'lucide-react';
import { cn } from '../lib/utils';

// ── 1. Classic rotating spinner ────────────────────────────────────────────

export function Spinner({ size = 'md', className }: { size?: 'sm' | 'md' | 'lg'; className?: string }) {
  const sizeMap = { sm: 'w-4 h-4', md: 'w-6 h-6', lg: 'w-10 h-10' };
  return <RefreshCw className={cn('animate-spin text-brand-primary', sizeMap[size], className)} />;
}

// ── 2. Three bouncing dots (AI thinking) ───────────────────────────────────

export function ThinkingDots({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center gap-1', className)}>
      {[0, 0.2, 0.4].map((delay, i) => (
        <motion.span
          key={i}
          className="w-2 h-2 rounded-full bg-brand-primary"
          animate={{ opacity: [0.3, 1, 0.3], y: [0, -4, 0] }}
          transition={{ duration: 1, repeat: Infinity, delay }}
        />
      ))}
    </div>
  );
}

// ── 3. Pulsing ring (live indicator) ───────────────────────────────────────

export function LivePulse({ color = 'bg-emerald-400', className }: { color?: string; className?: string }) {
  return (
    <span className={cn('relative flex h-2.5 w-2.5', className)}>
      <span className={cn('animate-ping absolute inline-flex h-full w-full rounded-full opacity-75', color)} />
      <span className={cn('relative inline-flex rounded-full h-full w-full', color)} />
    </span>
  );
}

// ── 4. Progress bar spinner ────────────────────────────────────────────────

export function ProgressSpinner({ progress, label, color = 'bg-brand-primary' }: { progress: number; label?: string; color?: string }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <div className="flex justify-between text-[9px] font-mono text-brand-text-muted">
          <span>{label}</span>
          <span>{Math.round(progress)}%</span>
        </div>
      )}
      <div className="w-full h-1.5 bg-brand-elevated rounded-full overflow-hidden">
        <motion.div className={cn('h-full rounded-full', color)} style={{ width: `${progress}%` }} transition={{ duration: 0.5 }} />
      </div>
    </div>
  );
}

// ── 5. Glowing orb spinner (background task) ───────────────────────────────

export function GlowSpinner({ className }: { className?: string }) {
  return (
    <motion.div
      className={cn('w-12 h-12 rounded-full relative', className)}
      animate={{ boxShadow: ['0 0 8px rgba(99,102,241,0.3)', '0 0 24px rgba(99,102,241,0.6)', '0 0 8px rgba(99,102,241,0.3)'] }}
      transition={{ duration: 2, repeat: Infinity }}>
      <Sparkles className="w-6 h-6 text-brand-primary absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 animate-spin" />
    </motion.div>
  );
}

// ── 6. Ripple spinner (expanding rings) ────────────────────────────────────

export function RippleSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('relative w-8 h-8', className)}>
      {[0, 0.5, 1].map((delay, i) => (
        <motion.div
          key={i}
          className="absolute inset-0 rounded-full border-2 border-brand-primary"
          initial={{ scale: 0, opacity: 1 }}
          animate={{ scale: 2, opacity: 0 }}
          transition={{ duration: 1.5, repeat: Infinity, delay, ease: 'easeOut' }}
        />
      ))}
      <div className="absolute inset-0 rounded-full bg-brand-primary/20" />
    </div>
  );
}

// ── 7. Typing text spinner ─────────────────────────────────────────────────

export function TypingSpinner({ texts = ['Processing…', 'Thinking…', 'Generating…'], interval = 2000 }: { texts?: string[]; interval?: number }) {
  const [index, setIndex] = React.useState(0);
  React.useEffect(() => {
    const timer = setInterval(() => setIndex(i => (i + 1) % texts.length), interval);
    return () => clearInterval(timer);
  }, [texts, interval]);
  
  return (
    <div className="flex items-center gap-2">
      <motion.span className="w-1.5 h-1.5 rounded-full bg-brand-primary" animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 0.8, repeat: Infinity }} />
      <span className="text-xs font-mono text-brand-text-muted">{texts[index]}</span>
    </div>
  );
}

// ── 8. Skeleton pulse (content placeholder) ────────────────────────────────

export function Skeleton({ className, lines = 1 }: { className?: string; lines?: number }) {
  return (
    <div className={cn('space-y-2', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-3 bg-brand-elevated rounded animate-pulse" style={{ width: `${60 + Math.random() * 40}%` }} />
      ))}
    </div>
  );
}

// ── 9. Circular progress (determinate) ─────────────────────────────────────

export function CircularProgress({ value, size = 48, strokeWidth = 4, color = '#818cf8' }: { value: number; size?: number; strokeWidth?: number; color?: string }) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg className="w-full h-full -rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="#27272a" strokeWidth={strokeWidth} />
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={offset} className="transition-all duration-500" />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-xs font-mono font-bold text-white">{Math.round(value)}%</span>
      </div>
    </div>
  );
}

// ── 10. Particle burst (one-shot celebration) ──────────────────────────────

export function ParticleBurst({ trigger, color = '#818cf8' }: { trigger: boolean; color?: string }) {
  const [particles, setParticles] = React.useState<{ id: number; x: number; y: number; angle: number }[]>([]);
  
  React.useEffect(() => {
    if (!trigger) return;
    const newParticles = Array.from({ length: 12 }, (_, i) => ({
      id: Date.now() + i,
      x: 0, y: 0,
      angle: (Math.PI * 2 * i) / 12,
    }));
    setParticles(newParticles);
    setTimeout(() => setParticles([]), 1000);
  }, [trigger]);

  return (
    <div className="relative w-8 h-8">
      {particles.map(p => (
        <motion.div
          key={p.id}
          className="absolute top-1/2 left-1/2 w-1.5 h-1.5 rounded-full"
          style={{ backgroundColor: color }}
          initial={{ x: 0, y: 0, opacity: 1 }}
          animate={{ x: Math.cos(p.angle) * 20, y: Math.sin(p.angle) * 20, opacity: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      ))}
    </div>
  );
}
