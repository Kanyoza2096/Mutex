// ═══════════════════════════════════════════════════════════════════════════
// MOBILE INFRASTRUCTURE — Pressure Gauge Grid
// Responsive, DPR-independent SVG gauges.
// ═══════════════════════════════════════════════════════════════════════════

import React from 'react';
import { LazyMotion, domAnimation, m } from 'motion/react';
import {
  Server,
  Database,
  Cpu,
  HardDrive,
} from 'lucide-react';

interface InfraMetric {
  label: string;
  value: number;
  color: string;
  icon: React.ComponentType<{
    className?: string;
    style?: React.CSSProperties;
  }>;
  status: string;
}

interface MobileInfraProps {
  metrics?: InfraMetric[];
}

const DEFAULT_METRICS: InfraMetric[] = [
  {
    label: 'PROCESSOR',
    value: 42,
    color: '#818cf8',
    icon: Cpu,
    status: 'NOMINAL',
  },
  {
    label: 'ALLOCATION',
    value: 67,
    color: '#06b6d4',
    icon: Server,
    status: 'NOMINAL',
  },
  {
    label: 'STORAGE',
    value: 31,
    color: '#34d399',
    icon: HardDrive,
    status: 'NOMINAL',
  },
  {
    label: 'MEMORY',
    value: 55,
    color: '#a78bfa',
    icon: Database,
    status: 'NOMINAL',
  },
];

const clamp = (value: number, min = 0, max = 100) =>
  Math.min(max, Math.max(min, Number.isFinite(value) ? value : 0));

function MiniGauge({
  metric,
  index,
}: {
  metric: InfraMetric;
  index: number;
}) {
  const radius = 26;
  const center = 32;
  const circumference = 2 * Math.PI * radius;

  const value = clamp(metric.value);
  const offset =
    circumference - (value / 100) * circumference;

  const Icon = metric.icon;

  return (
    <m.div
      initial={{ opacity: 0, scale: 0.94 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{
        duration: 0.25,
        delay: Math.min(index * 0.04, 0.16),
      }}
      className="
        min-w-0
        rounded-2xl
        border border-zinc-800/60
        bg-[#0a0a14]/80
        p-3
        flex
        flex-col
        items-center
        gap-2
        transition-colors
        duration-200
        hover:border-zinc-700/70
      "
    >
      {/* Gauge */}
      <div className="relative w-16 h-16 shrink-0">
        <svg
          viewBox="0 0 64 64"
          className="block w-full h-full -rotate-90"
          aria-hidden="true"
        >
          {/* Track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            stroke="#1a1a2e"
            strokeWidth="4"
            fill="none"
          />

          {/* Progress */}
          <m.circle
            cx={center}
            cy={center}
            r={radius}
            stroke={metric.color}
            strokeWidth="4"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{
              strokeDashoffset: circumference,
            }}
            animate={{
              strokeDashoffset: offset,
            }}
            transition={{
              duration: 0.9,
              ease: 'easeOut',
            }}
          />
        </svg>

        {/* Ambient glow */}
        <div
          className="pointer-events-none absolute inset-0 rounded-full"
          style={{
            background: `radial-gradient(
              circle,
              ${metric.color}12 0%,
              transparent 70%
            )`,
          }}
        />

        {/* Value */}
        <span className="
          absolute
          inset-0
          flex
          items-center
          justify-center
          text-[10px]
          font-mono
          font-bold
          text-zinc-300
        ">
          {Math.round(value)}
        </span>
      </div>

      {/* Icon */}
      <Icon
        className="w-3.5 h-3.5 shrink-0"
        style={{ color: metric.color }}
      />

      {/* Labels */}
      <div className="min-w-0 w-full text-center">
        <p className="
          truncate
          text-[7px]
          font-mono
          font-bold
          uppercase
          tracking-wider
          text-zinc-500
        ">
          {metric.label}
        </p>

        <p className="
          truncate
          text-[7px]
          font-mono
          text-zinc-700
          mt-0.5
        ">
          {metric.status}
        </p>
      </div>
    </m.div>
  );
}

export default function MobileInfra({
  metrics = DEFAULT_METRICS,
}: MobileInfraProps) {
  const safeMetrics = Array.isArray(metrics)
    ? metrics
    : DEFAULT_METRICS;

  return (
    <LazyMotion features={domAnimation} strict>
      <section
        className="
          flex
          flex-col
          min-h-0
          h-full
          bg-[#060610]
          overflow-hidden
        "
      >
        {/* Header */}
        <header className="
          flex
          items-center
          justify-between
          px-3
          py-2
          border-b
          border-zinc-800/50
          shrink-0
        ">
          <div className="flex items-center gap-2 min-w-0">
            <Server
              className="w-3 h-3 shrink-0 text-indigo-400"
              aria-hidden="true"
            />

            <span className="
              truncate
              text-[9px]
              font-mono
              font-bold
              uppercase
              tracking-wider
              text-zinc-500
            ">
              Infrastructure
            </span>
          </div>

          <span className="
            shrink-0
            ml-2
            text-[8px]
            font-mono
            text-zinc-600
          ">
            {safeMetrics.length} nodes
          </span>
        </header>

        {/* Grid */}
        <div className="
          min-h-0
          flex-1
          grid
          grid-cols-2
          gap-2
          p-3
          content-center
          overflow-auto
          overscroll-contain
        ">
          {safeMetrics.map((metric, index) => (
            <MiniGauge
              key={`${metric.label}-${index}`}
              metric={metric}
              index={index}
            />
          ))}
        </div>
      </section>
    </LazyMotion>
  );
}
