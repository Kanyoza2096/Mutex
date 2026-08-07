// ═══════════════════════════════════════════════════════════════════════════
// MONITORING — v17 "Control Room"
// Enterprise runtime observability with live telemetry motion.
//
// Visual hierarchy:
//   Control Room → Signal Bar → System Telemetry → Service Mesh
//   → External Watchdogs → System Metrics → Data Flow → Log Statistics → Stream
//
// Motion language:
//   - Ambient: slow orbital/telemetry motion
//   - Live: data-driven number/ring transitions
//   - Alert: stronger motion only for degraded/breach states
// ═══════════════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { AnimatePresence, motion, useSpring, useTransform } from 'motion/react';
import { Pause, Play, Search, Radio, Crosshair } from 'lucide-react';
import { cn } from '../lib/utils';
import { useStore } from '../store/useStore';
import DataFlowVisualizer from '../components/DataFlowVisualizer';

// ═══════════════════════════════════════════════════════════════════════════
// OPAQUE SERVICE IDENTITIES
// ═══════════════════════════════════════════════════════════════════════════

const SERVICE_VISUAL_IDS: Record<string, string> = {
  frontend: 'NX-17',
  gemini: 'AI-42',
  pipeline: 'PX-08',
  render: 'RN-31',
  command: 'CX-14',
  scheduler: 'SC-77',
  connectors: 'IO-52',
  supabase: 'DB-19',
  redis: 'KV-63',
  socketio: 'RT-91',
  facebook: 'GW-44',
};

const SERVICE_DOMAINS: Record<string, string> = {
  frontend: 'edge',
  gemini: 'compute',
  pipeline: 'compute',
  render: 'compute',
  command: 'control',
  scheduler: 'control',
  connectors: 'io',
  supabase: 'storage',
  redis: 'storage',
  socketio: 'io',
  facebook: 'external',
};

// ═══════════════════════════════════════════════════════════════════════════
// ANIMATED NUMBER
// ═══════════════════════════════════════════════════════════════════════════

function AnimatedNumber({
  value,
  className,
  duration = 0.7,
}: {
  value: number;
  className?: string;
  duration?: number;
}) {
  const spring = useSpring(value, { stiffness: 150, damping: 24, mass: 0.7 });
  const rounded = useTransform(spring, latest => Math.round(latest));

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  return <motion.span className={className}>{rounded}</motion.span>;
}

// ═══════════════════════════════════════════════════════════════════════════
// LIVE VALUE CARD
// ═══════════════════════════════════════════════════════════════════════════

function LiveMetricCard({
  label,
  value,
  color,
  suffix,
  sub,
  pulseKey,
}: {
  label: string;
  value: number;
  color: string;
  suffix?: string;
  sub?: string;
  pulseKey?: string | number;
}) {
  return (
    <motion.div
      key={pulseKey}
      initial={{ boxShadow: '0 0 0 rgba(129,140,248,0)' }}
      animate={{ boxShadow: [`0 0 0 rgba(129,140,248,0)`, `0 0 22px ${color}22`, `0 0 0 ${color}00`] }}
      transition={{ duration: 0.8 }}
      className="bg-brand-elevated/80 border border-brand-border rounded-xl p-3 text-center relative overflow-hidden"
    >
      <motion.div
        className="absolute inset-x-0 top-0 h-px"
        style={{ backgroundColor: color }}
        animate={{ opacity: [0.15, 0.65, 0.15] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: 'easeInOut' }}
      />
      <p className="text-lg font-mono font-bold" style={{ color }}>
        <AnimatedNumber value={value} />
        {suffix}
      </p>
      <p className="text-[10px] font-mono uppercase text-brand-text-muted tracking-wider">{label}</p>
      {sub && <p className="text-[10px] font-mono text-brand-text-muted/70">{sub}</p>}
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SYSTEM TELEMETRY RING
// ═══════════════════════════════════════════════════════════════════════════

function PressureGauge({
  value,
  label,
  color,
  animate = true,
}: {
  value: number;
  label: string;
  color: string;
  animate?: boolean;
}) {
  const radius = 48;
  const circumference = 2 * Math.PI * radius;
  const safeValue = Math.min(100, Math.max(0, Number(value) || 0));
  const offset = circumference - (safeValue / 100) * circumference;
  const pressure = safeValue >= 90 ? 'critical' : safeValue >= 70 ? 'high' : safeValue >= 45 ? 'elevated' : 'nominal';
  const duration = pressure === 'critical' ? 2.2 : pressure === 'high' ? 3.5 : 5.5;

  return (
    <motion.div
      className="bg-brand-elevated/80 border border-brand-border rounded-2xl p-5 flex flex-col items-center justify-center hover:border-indigo-500/20 transition-all group relative overflow-hidden"
      whileHover={{ y: -2 }}
    >
      <div className="absolute inset-x-8 top-0 h-px opacity-30" style={{ backgroundColor: color }} />
      <div className="relative w-32 h-32 flex items-center justify-center mb-3">
        <svg className="absolute inset-0 w-full h-full -rotate-90 overflow-visible">
          <circle
            cx="64"
            cy="64"
            r={radius}
            stroke="var(--color-brand-surface)"
            strokeWidth="7"
            fill="none"
          />
          <circle
            cx="64"
            cy="64"
            r={radius}
            stroke={color}
            strokeWidth="7"
            fill="none"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            className="transition-[stroke-dashoffset] duration-1000 ease-out"
            style={{ filter: `drop-shadow(0 0 5px ${color}55)` }}
          />
          <motion.circle
            cx="64"
            cy="64"
            r={radius}
            stroke={color}
            strokeWidth="2"
            fill="none"
            strokeLinecap="round"
            strokeDasharray="2 18"
            animate={animate ? { rotate: 360 } : { rotate: 0 }}
            transition={{ duration, repeat: Infinity, ease: 'linear' }}
            style={{ transformOrigin: '64px 64px', opacity: 0.9 }}
          />
        </svg>

        <motion.div
          className="absolute inset-4 rounded-full"
          style={{ background: `radial-gradient(circle, ${color}18 0%, transparent 68%)` }}
          animate={{ scale: [0.94, 1.04, 0.94], opacity: [0.55, 0.9, 0.55] }}
          transition={{ duration: pressure === 'critical' ? 1.1 : 2.8, repeat: Infinity, ease: 'easeInOut' }}
        />

        <div className="relative z-10 text-center">
          <div className="flex items-baseline justify-center">
            <AnimatedNumber value={safeValue} className="text-2xl font-mono font-black text-brand-text" />
            <span className="text-xs font-mono font-bold ml-0.5" style={{ color }}>%</span>
          </div>
          <motion.div
            className="mx-auto mt-1 w-1.5 h-1.5 rounded-full"
            style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
            animate={pressure === 'critical' ? { scale: [1, 1.8, 1], opacity: [0.6, 1, 0.6] } : { opacity: [0.55, 1, 0.55] }}
            transition={{ duration: pressure === 'critical' ? 0.7 : 2, repeat: Infinity }}
          />
        </div>
      </div>

      <p className="text-[11px] font-mono font-bold uppercase tracking-[0.15em] text-brand-text-muted group-hover:text-brand-text-secondary transition-colors">
        {label}
      </p>
      <p className="mt-1 text-[9px] font-mono uppercase tracking-widest" style={{ color }}>
        {pressure}
      </p>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE CARD
// ═══════════════════════════════════════════════════════════════════════════

function ServiceCard({
  visualId,
  name,
  domain,
  status,
  uptime,
  latency,
  pressure,
  lastChecked,
  revealSemantic = false,
}: {
  visualId: string;
  name: string;
  domain: string;
  status: string;
  uptime: string;
  latency: number[];
  pressure: number;
  lastChecked: string;
  revealSemantic?: boolean;
}) {
  const safeLatency = latency.filter(Number.isFinite).map(Number);
  const maxLat = Math.max(...safeLatency, 1);
  const avgLat = safeLatency.length > 0
    ? Math.round(safeLatency.reduce((a, b) => a + b, 0) / safeLatency.length)
    : 0;
  const normalizedStatus = String(status || '').toLowerCase();
  const statusColor = normalizedStatus === 'online' ? '#22c55e' : normalizedStatus === 'degraded' ? '#f59e0b' : '#ef4444';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -2 }}
      className="bg-brand-elevated/80 border border-brand-border rounded-2xl p-4 hover:border-indigo-500/20 transition-all group relative overflow-hidden"
    >
      {pressure > 0.1 && (
        <motion.div
          className="absolute top-0 left-0 h-0.5"
          animate={{ width: `${Math.min(100, pressure * 100)}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{
            backgroundColor: pressure > 0.6 ? '#ef4444' : pressure > 0.3 ? '#f59e0b' : '#818cf8',
            boxShadow: `0 0 8px ${pressure > 0.6 ? '#ef4444' : pressure > 0.3 ? '#f59e0b' : '#818cf8'}55`,
          }}
        />
      )}

      <div className="flex items-center justify-between mb-3">
        <div className="min-w-0">
          <h4 className="text-xs font-bold text-brand-text font-mono tracking-wider">
            {revealSemantic ? name : visualId}
          </h4>
          <p className="text-[11px] text-brand-text-muted font-mono uppercase mt-0.5">{domain}</p>
        </div>

        <motion.span
          className={cn(
            'px-2 py-0.5 rounded-full text-[11px] font-bold font-mono uppercase border flex items-center gap-1.5',
            normalizedStatus === 'online'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : normalizedStatus === 'degraded'
              ? 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              : 'bg-red-500/10 text-red-400 border-red-500/30',
          )}
          animate={normalizedStatus === 'online'
            ? { boxShadow: [`0 0 0 ${statusColor}00`, `0 0 10px ${statusColor}22`, `0 0 0 ${statusColor}00`] }
            : { boxShadow: [`0 0 0 ${statusColor}00`, `0 0 14px ${statusColor}35`, `0 0 0 ${statusColor}00`] }}
          transition={{ duration: normalizedStatus === 'online' ? 3 : 1.3, repeat: Infinity }}
        >
          <span className="relative flex h-1.5 w-1.5">
            <span className="absolute inline-flex h-full w-full rounded-full opacity-60" style={{ backgroundColor: statusColor }} />
            <motion.span
              className="relative inline-flex rounded-full h-1.5 w-1.5"
              style={{ backgroundColor: statusColor }}
              animate={{ scale: normalizedStatus === 'online' ? [1, 1.4, 1] : [1, 1.7, 1], opacity: [0.65, 1, 0.65] }}
              transition={{ duration: normalizedStatus === 'online' ? 2 : 0.9, repeat: Infinity }}
            />
          </span>
          {status}
        </motion.span>
      </div>

      <div className="h-9 flex items-end gap-px mb-3">
        {safeLatency.map((val, i) => (
          <motion.div
            key={i}
            className="flex-1 rounded-t-sm"
            animate={{ height: `${Math.max(4, (val / maxLat) * 100)}%` }}
            transition={{ duration: 0.45, delay: i * 0.015 }}
            style={{
              backgroundColor: val > 400 ? 'rgba(245, 158, 11, 0.5)' : 'rgba(129, 140, 248, 0.5)',
            }}
          />
        ))}
      </div>

      <div className="flex items-center justify-between text-[12px] font-mono border-t border-brand-border pt-2.5">
        <span className="text-brand-text-muted">UP {uptime}</span>
        <div className="flex items-center gap-2">
          <span className="text-brand-text-muted">{lastChecked}</span>
          <span className="text-indigo-400 font-bold">{avgLat}ms</span>
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// WATCHDOG CARDS
// ═══════════════════════════════════════════════════════════════════════════

function MonitorWatchdogCard({ revealSemantic = false }: { revealSemantic?: boolean }) {
  const [targets, setTargets] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { restEndpoint, masterToken } = useStore();
  const base = restEndpoint.replace(/\/+$/, '');

  useEffect(() => {
    const headers: Record<string, string> = masterToken ? { Authorization: `Bearer ${masterToken}` } : {};
    let cancelled = false;

    const fetchTargets = async () => {
      try {
        const response = await fetch(`${base}/api/v1/monitor/status`, { headers });
        if (!response.ok) throw new Error(`Monitor status ${response.status}`);
        const data = await response.json();
        if (!cancelled) setTargets(Array.isArray(data?.targets) ? data.targets : []);
      } catch {
        if (!cancelled) setTargets([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchTargets();
    const id = setInterval(() => void fetchTargets(), 30000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [base, masterToken]);

  const downCount = targets.filter(t => t.status === 'down').length;
  const degradedCount = targets.filter(t => t.status !== 'up' && t.status !== 'down').length;
  const upCount = targets.filter(t => t.status === 'up').length;
  const healthColor = downCount > 0 ? '#ef4444' : degradedCount > 0 ? '#f59e0b' : '#22c55e';
  const healthStatus = downCount > 0 ? 'BREACH' : degradedCount > 0 ? 'DEGRADED' : 'NOMINAL';

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-brand-elevated/80 border border-brand-border rounded-2xl p-4 hover:border-indigo-500/20 transition-all group relative overflow-hidden"
    >
      {downCount > 0 && (
        <motion.div
          className="absolute top-0 left-0 h-0.5 bg-red-500"
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          transition={{ duration: 0.8 }}
          style={{ boxShadow: '0 0 8px #ef444480' }}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 flex items-center justify-center">
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-dashed opacity-60"
              style={{ borderColor: healthColor }}
              animate={{ rotate: 360 }}
              transition={{ duration: downCount > 0 ? 2.5 : 6, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute inset-[4px] rounded-full border"
              style={{ borderColor: `${healthColor}80` }}
              animate={{ rotate: -360 }}
              transition={{ duration: degradedCount > 0 || downCount > 0 ? 3 : 4.5, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="relative z-10 w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: healthColor, boxShadow: `0 0 12px ${healthColor}80` }}
              animate={{ scale: downCount > 0 ? [0.75, 1.45, 0.75] : [0.8, 1.2, 0.8], opacity: [0.7, 1, 0.7] }}
              transition={{ duration: downCount > 0 ? 0.8 : 2, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>

          <div>
            <h4 className="text-xs font-bold text-brand-text font-mono tracking-wider">
              {revealSemantic ? 'Site Monitor' : 'WD-01'}
            </h4>
            <p className="text-[11px] text-brand-text-muted font-mono uppercase mt-0.5">watchdog</p>
          </div>
        </div>

        <span
          className="px-2 py-0.5 rounded-full text-[11px] font-bold font-mono uppercase border"
          style={{
            backgroundColor: `${healthColor}15`,
            color: healthColor,
            borderColor: `${healthColor}40`,
          }}
        >
          {loading ? 'SCAN' : healthStatus}
        </span>
      </div>

      <div className="space-y-2 mb-3">
        {loading ? (
          <div className="flex items-center gap-3 py-1">
            <motion.div
              className="w-2 h-2 rounded-full bg-brand-text-muted/30"
              animate={{ opacity: [0.3, 0.8, 0.3], scale: [0.9, 1.15, 0.9] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <p className="text-[11px] font-mono text-brand-text-muted">Scanning targets...</p>
          </div>
        ) : targets.length === 0 ? (
          <p className="text-[11px] font-mono text-brand-text-muted py-1">No targets configured</p>
        ) : (
          targets.slice(0, 4).map(t => {
            const dotColor = t.status === 'up' ? '#22c55e' : t.status === 'down' ? '#ef4444' : '#f59e0b';
            return (
              <div key={t.name} className="flex items-center gap-2.5 text-[11px] font-mono">
                <motion.div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: dotColor, boxShadow: `0 0 8px ${dotColor}70` }}
                  animate={t.status === 'up'
                    ? { scale: [1, 1.3, 1], opacity: [0.8, 1, 0.8] }
                    : t.status === 'down'
                    ? { scale: [1, 1.5, 1], opacity: [0.6, 1, 0.6] }
                    : { opacity: [0.7, 1, 0.7] }}
                  transition={{ duration: t.status === 'down' ? 0.8 : 2, repeat: Infinity, ease: 'easeInOut' }}
                />
                <span className="text-brand-text-secondary truncate max-w-[140px]">{t.name}</span>
                <span className="ml-auto font-bold" style={{ color: dotColor }}>
                  {t.status === 'up' ? `${t.response_time_ms ?? '—'}ms` : String(t.status || '').toUpperCase()}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between text-[12px] font-mono border-t border-brand-border pt-2.5">
        <span className="text-brand-text-muted">{targets.length} TARGETS</span>
        <div className="flex items-center gap-3">
          <span className="text-emerald-400">{upCount} UP</span>
          {degradedCount > 0 && <span className="text-amber-400">{degradedCount} WARN</span>}
          {downCount > 0 && <span className="text-red-400">{downCount} DOWN</span>}
        </div>
      </div>
    </motion.div>
  );
}

function BackupWatchdogCard({ revealSemantic = false }: { revealSemantic?: boolean }) {
  const [records, setRecords] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { restEndpoint, masterToken } = useStore();
  const base = restEndpoint.replace(/\/+$/, '');

  useEffect(() => {
    const headers: Record<string, string> = masterToken ? { Authorization: `Bearer ${masterToken}` } : {};
    let cancelled = false;

    const fetchRecords = async () => {
      try {
        const response = await fetch(`${base}/api/v1/backup/records?limit=5`, { headers });
        if (!response.ok) throw new Error(`Backup records ${response.status}`);
        const data = await response.json();
        if (!cancelled) setRecords(Array.isArray(data?.records) ? data.records : []);
      } catch {
        if (!cancelled) setRecords([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void fetchRecords();
    const id = setInterval(() => void fetchRecords(), 60000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [base, masterToken]);

  const lastBackup = records[0];
  const failedCount = records.filter(r => r.status === 'failed').length;
  const completedCount = records.filter(r => r.status === 'completed').length;
  const healthColor = !lastBackup ? '#6b7280' : lastBackup.status === 'completed' ? '#22c55e' : '#ef4444';
  const healthStatus = !lastBackup ? 'IDLE' : lastBackup.status === 'completed' ? 'SYNCED' : 'BREACH';

  const hoursSinceLastBackup = lastBackup?.started_at
    ? Math.max(0, Math.round((Date.now() - new Date(lastBackup.started_at).getTime()) / 3600000))
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-brand-elevated/80 border border-brand-border rounded-2xl p-4 hover:border-indigo-500/20 transition-all group relative overflow-hidden"
    >
      {failedCount > 0 && (
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: '100%' }}
          className="absolute top-0 left-0 h-0.5 bg-amber-500"
          style={{ boxShadow: '0 0 8px #f59e0b80' }}
        />
      )}

      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative w-11 h-11 flex items-center justify-center">
            <motion.div
              className="absolute inset-0 rounded-full border-2 border-dashed opacity-60"
              style={{ borderColor: healthColor }}
              animate={lastBackup ? { rotate: 360 } : { rotate: 0 }}
              transition={{ duration: lastBackup?.status === 'running' ? 3 : 8, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="absolute inset-[4px] rounded-full border border-dotted"
              style={{ borderColor: `${healthColor}80` }}
              animate={lastBackup ? { rotate: -360 } : { rotate: 0 }}
              transition={{ duration: lastBackup?.status === 'running' ? 2.5 : 5, repeat: Infinity, ease: 'linear' }}
            />
            <motion.div
              className="relative z-10 w-2.5 h-2.5 rounded-full"
              style={{ backgroundColor: healthColor, boxShadow: `0 0 12px ${healthColor}80` }}
              animate={lastBackup?.status === 'running'
                ? { scale: [0.8, 1.3, 0.8], opacity: [0.6, 1, 0.6] }
                : { scale: [0.9, 1.1, 0.9], opacity: [0.8, 1, 0.8] }}
              transition={{ duration: lastBackup?.status === 'running' ? 1 : 3, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>

          <div>
            <h4 className="text-xs font-bold text-brand-text font-mono tracking-wider">
              {revealSemantic ? 'DB Backup' : 'WD-02'}
            </h4>
            <p className="text-[11px] text-brand-text-muted font-mono uppercase mt-0.5">watchdog</p>
          </div>
        </div>

        <span
          className="px-2 py-0.5 rounded-full text-[11px] font-bold font-mono uppercase border"
          style={{
            backgroundColor: `${healthColor}15`,
            color: healthColor,
            borderColor: `${healthColor}40`,
          }}
        >
          {loading ? 'SCAN' : healthStatus}
        </span>
      </div>

      <div className="space-y-2 mb-3">
        {loading ? (
          <div className="flex items-center gap-3 py-1">
            <motion.div
              className="w-2 h-2 rounded-full bg-brand-text-muted/30"
              animate={{ opacity: [0.3, 0.8, 0.3] }}
              transition={{ duration: 1.5, repeat: Infinity }}
            />
            <p className="text-[11px] font-mono text-brand-text-muted">Loading records...</p>
          </div>
        ) : records.length === 0 ? (
          <p className="text-[11px] font-mono text-brand-text-muted py-1">No backups yet</p>
        ) : (
          records.slice(0, 3).map(r => {
            const dotColor = r.status === 'completed' ? '#22c55e' : r.status === 'running' ? '#3b82f6' : '#ef4444';
            return (
              <div key={r.id} className="flex items-center gap-2.5 text-[11px] font-mono">
                <motion.div
                  className="w-2 h-2 rounded-full flex-shrink-0"
                  style={{ backgroundColor: dotColor, boxShadow: `0 0 8px ${dotColor}60` }}
                  animate={r.status === 'running'
                    ? { scale: [1, 1.4, 1], opacity: [0.6, 1, 0.6] }
                    : { scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
                  transition={{ duration: r.status === 'running' ? 1 : 2.5, repeat: Infinity, ease: 'easeInOut' }}
                />
                <span className="text-brand-text-secondary truncate max-w-[120px]">{r.filename}</span>
                <span className="ml-auto font-bold" style={{ color: dotColor }}>
                  {r.status === 'completed' ? 'SYNCED' : String(r.status || '').toUpperCase()}
                </span>
              </div>
            );
          })
        )}
      </div>

      <div className="flex items-center justify-between text-[12px] font-mono border-t border-brand-border pt-2.5">
        <span className="text-brand-text-muted">
          {hoursSinceLastBackup !== null ? `${hoursSinceLastBackup}h AGO` : '—'}
        </span>
        <div className="flex items-center gap-3">
          <span className="text-emerald-400">{completedCount} OK</span>
          {failedCount > 0 && <span className="text-red-400">{failedCount} FAIL</span>}
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LOG ROW
// ═══════════════════════════════════════════════════════════════════════════

const LEVEL_CONFIG: Record<string, { color: string; border: string; label: string }> = {
  DEBUG: { color: '#52525b', border: 'border-l-brand-text-muted/50', label: 'DBG' },
  INFO: { color: '#818cf8', border: 'border-l-indigo-500', label: 'INF' },
  WARNING: { color: '#f59e0b', border: 'border-l-amber-500', label: 'WRN' },
  WARN: { color: '#f59e0b', border: 'border-l-amber-500', label: 'WRN' },
  ERROR: { color: '#ef4444', border: 'border-l-red-500', label: 'ERR' },
  CRITICAL: { color: '#a855f7', border: 'border-l-purple-500', label: 'CRT' },
};

function LogRow({ entry }: { entry: any }) {
  const config = LEVEL_CONFIG[String(entry.level || 'INFO').toUpperCase()] || LEVEL_CONFIG.INFO;

  return (
    <motion.div
      initial={{ opacity: 0, x: -4 }}
      animate={{ opacity: 1, x: 0 }}
      className={cn(
        'flex items-center gap-3 py-1.5 px-2 rounded text-[12px] font-mono border-l-2 hover:bg-brand-surface/50 transition-colors',
        config.border,
      )}
    >
      <span className="text-brand-text-muted w-16 flex-shrink-0 tabular-nums">
        {(() => {
          const timestamp = new Date(entry.timestamp || entry.time).getTime();
          return Number.isFinite(timestamp)
            ? new Date(timestamp).toLocaleTimeString('en-US', { hour12: false })
            : '--:--:--';
        })()}
      </span>
      <span className="w-8 text-center font-bold flex-shrink-0" style={{ color: config.color }}>
        {config.label}
      </span>
      <span className="text-brand-text-muted w-20 truncate flex-shrink-0">
        {SERVICE_VISUAL_IDS[entry.module] || entry.module || '—'}
      </span>
      <span className="text-brand-text-secondary truncate">{entry.message || entry.msg}</span>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function Monitoring() {
  const {
    healthMatrix,
    restEndpoint,
    masterToken,
    latencyHistory,
    socketConnected,
    systemResources,
    workflowMetrics,
    dataChannelStatus,
  } = useStore();

  const [events, setEvents] = useState<any[]>([]);
  const [paused, setPaused] = useState(false);
  const [showSemantic, setShowSemantic] = useState(false);
  const [filter, setFilter] = useState({ level: '', search: '' });
  const [logStats, setLogStats] = useState({
    errors: 0, warnings: 0, info: 0, total_logs: 0, success: 0, rate: 0,
  });
  const [connectionMode, setConnectionMode] = useState<'sse' | 'polling'>('polling');
  const [activeTab, setActiveTab] = useState<'overview' | 'logs'>('overview');
  const pausedBufferRef = useRef<any[]>([]);
  const pausedRef = useRef(paused);
  const esRef = useRef<EventSource | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const connectionGenerationRef = useRef(0);

  const base = restEndpoint.replace(/\/+$/, '');
  const headers = useMemo<Record<string, string>>(
    () => (masterToken ? { Authorization: `Bearer ${masterToken}` } : {}),
    [masterToken],
  );

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const fetchStats = useCallback(async (signal?: AbortSignal) => {
    if (!base) return;

    try {
      const res = await fetch(`${base}/monitoring/stats`, { headers, signal });
      if (!res.ok) return;

      const data = await res.json();
      if (!data?.ok) return;

      setLogStats(prev => ({
        ...prev,
        errors: Number.isFinite(Number(data.errors)) ? Number(data.errors) : 0,
        warnings: Number.isFinite(Number(data.warnings)) ? Number(data.warnings) : 0,
        total_logs: Number.isFinite(Number(data.total)) ? Number(data.total) : 0,
        success: Number.isFinite(Number(data.success)) ? Number(data.success) : 0,
        rate: Number.isFinite(Number(data.rate)) ? Number(data.rate) : 0,
      }));
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') {
        // Best effort.
      }
    }
  }, [base, headers]);

  useEffect(() => {
    const controller = new AbortController();
    void fetchStats(controller.signal);
    const id = setInterval(() => void fetchStats(controller.signal), 30000);

    return () => {
      controller.abort();
      clearInterval(id);
    };
  }, [fetchStats]);

  // ═══════════════════════════════════════════════════════════════════
  // SSE / POLLING
  // ═══════════════════════════════════════════════════════════════════

  const connectSSE = useCallback(async () => {
    if (!base) return;

    const generation = ++connectionGenerationRef.current;

    if (esRef.current) {
      esRef.current.close();
      esRef.current = null;
    }

    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }

    const controller = new AbortController();

    const stopPolling = () => {
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };

    const pollOnce = async () => {
      try {
        const response = await fetch(`${base}/logs/recent?limit=100`, {
          headers,
          signal: controller.signal,
        });
        if (!response.ok) return;

        const data = await response.json();
        if (generation !== connectionGenerationRef.current || pausedRef.current) return;

        const logs = Array.isArray(data?.logs) ? data.logs : [];
        setEvents(logs.slice(0, 300));
      } catch (error) {
        if ((error as DOMException)?.name !== 'AbortError') {
          // Keep polling silently.
        }
      }
    };

    const startPolling = () => {
      if (generation !== connectionGenerationRef.current || pollRef.current) return;

      setConnectionMode('polling');
      void pollOnce();
      pollRef.current = setInterval(() => void pollOnce(), 10000);
    };

    try {
      if (!masterToken) throw new Error('Master token unavailable');

      const tokenRes = await fetch(`${base}/monitoring/stream-token`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${masterToken}`,
        },
        signal: controller.signal,
      });

      if (!tokenRes.ok) throw new Error(`Stream token request failed (${tokenRes.status})`);

      const tokenData = await tokenRes.json();

      if (
        generation !== connectionGenerationRef.current ||
        controller.signal.aborted ||
        !tokenData?.token
      ) {
        return;
      }

      const params = new URLSearchParams();
      params.set('token', String(tokenData.token));
      if (filter.level) params.set('level', filter.level);

      const es = new EventSource(`${base}/monitoring/stream?${params.toString()}`);
      esRef.current = es;

      es.addEventListener('log', (event: MessageEvent) => {
        try {
          const entry = JSON.parse(event.data);
          if (!entry || typeof entry !== 'object') return;

          if (pausedRef.current) {
            pausedBufferRef.current = [entry, ...pausedBufferRef.current].slice(0, 300);
            return;
          }

          setEvents(prev => {
            const entryId = entry.id;
            if (entryId && prev.some(item => item.id === entryId)) return prev;
            return [entry, ...prev].slice(0, 300);
          });
        } catch {
          // Ignore malformed records.
        }
      });

      es.addEventListener('stats', (event: MessageEvent) => {
        try {
          const stats = JSON.parse(event.data);
          if (!stats || typeof stats !== 'object') return;

          setLogStats(prev => ({
            ...prev,
            errors: Number.isFinite(Number(stats.errors)) ? Number(stats.errors) : prev.errors,
            warnings: Number.isFinite(Number(stats.warnings)) ? Number(stats.warnings) : prev.warnings,
            total_logs: Number.isFinite(Number(stats.total_logs)) ? Number(stats.total_logs) : prev.total_logs,
            success: Number.isFinite(Number(stats.success)) ? Number(stats.success) : prev.success,
            rate: Number.isFinite(Number(stats.rate)) ? Number(stats.rate) : prev.rate,
          }));
        } catch {
          // Ignore malformed stream statistics.
        }
      });

      es.addEventListener('heartbeat', () => {});

      es.onopen = () => {
        if (generation === connectionGenerationRef.current) setConnectionMode('sse');
      };

      es.onerror = () => {
        if (generation !== connectionGenerationRef.current) return;

        es.close();
        if (esRef.current === es) esRef.current = null;
        startPolling();
      };
    } catch (error) {
      if ((error as DOMException)?.name !== 'AbortError') startPolling();
    }

    return () => {
      controller.abort();
      stopPolling();
    };
  }, [base, masterToken, headers, filter.level]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    let cancelled = false;

    void connectSSE().then(result => {
      if (cancelled) result?.();
      else cleanup = result;
    });

    return () => {
      cancelled = true;
      connectionGenerationRef.current += 1;

      if (esRef.current) {
        esRef.current.close();
        esRef.current = null;
      }

      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }

      cleanup?.();
    };
  }, [connectSSE]);

  const handlePauseToggle = useCallback(() => {
    if (paused) {
      const buffered = pausedBufferRef.current;
      pausedBufferRef.current = [];
      setPaused(false);

      if (buffered.length) {
        setEvents(prev => {
          const existingIds = new Set(prev.map(item => item?.id).filter(Boolean));
          const uniqueBuffered = buffered.filter(item => !item?.id || !existingIds.has(item.id));
          return [...uniqueBuffered, ...prev].slice(0, 300);
        });
      }
    } else {
      setPaused(true);
    }
  }, [paused]);

  // ═══════════════════════════════════════════════════════════════════
  // DERIVED TELEMETRY
  // ═══════════════════════════════════════════════════════════════════

  const services = useMemo(() =>
    healthMatrix.map(h => ({
      visualId: SERVICE_VISUAL_IDS[h.name?.toLowerCase()] || h.name?.toUpperCase() || '—',
      name: h.name || 'Unknown',
      domain: SERVICE_DOMAINS[h.name?.toLowerCase()] || '—',
      status: h.status,
      uptime: `${Number.isFinite(Number(h.uptime)) ? Number(h.uptime) : 0}%`,
      latency: Array(10).fill(h.latency || 0),
      pressure: Math.min(
        1,
        (h.latency || 0) / 500 +
          (h.status === 'degraded' ? 0.3 : 0) +
          (h.status === 'offline' ? 0.8 : 0),
      ),
      lastChecked: Number.isFinite(new Date(h.lastChecked).getTime())
        ? new Date(h.lastChecked).toLocaleTimeString('en-US', { hour12: false })
        : '—',
    })),
  [healthMatrix]);

  const filteredEvents = useMemo(() => {
    if (!filter.search) return events;
    const q = filter.search.toLowerCase();

    return events.filter(e =>
      (e.message || e.msg || '').toLowerCase().includes(q) ||
      (e.module || '').toLowerCase().includes(q),
    );
  }, [events, filter.search]);

  const gauges = {
    cpu: Number(systemResources.cpu_percent) || 0,
    mem: Number(systemResources.memory_percent) || 0,
    disk: Number(systemResources.disk_percent) || 0,
  };

  const errorCount = logStats.errors || events.filter(
    e => e.level === 'ERROR' || e.level === 'CRITICAL',
  ).length;

  const onlineCount = services.filter(s => s.status === 'online').length;

  const avgPressure = services.length > 0
    ? services.reduce((s, svc) => s + svc.pressure, 0) / services.length
    : 0;

  const avgLatency = latencyHistory.length > 0
    ? Math.round(latencyHistory.reduce((a, b) => a + b, 0) / latencyHistory.length)
    : 0;

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-20 md:pb-0">

      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <motion.div
            className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20"
            animate={{ boxShadow: ['0 0 0 rgba(99,102,241,0)', '0 0 18px rgba(99,102,241,0.18)', '0 0 0 rgba(99,102,241,0)'] }}
            transition={{ duration: 3, repeat: Infinity }}
          >
            <Crosshair className="w-5 h-5 text-indigo-400" />
          </motion.div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-wider font-mono">
              CONTROL<span className="text-brand-text-muted">_ROOM</span>
            </h1>
            <p className="text-[12px] text-brand-text-muted font-mono uppercase tracking-[0.15em] mt-0.5">
              {onlineCount}/{services.length} SPANS · {errorCount} ERR · {connectionMode === 'sse' ? 'STREAM' : 'POLL'}
              {socketConnected
                ? <span className="text-emerald-500 ml-2">● SYNC</span>
                : <span className="text-amber-500 ml-2">● ASYNC</span>
              }
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex gap-1 p-1 bg-brand-elevated border border-brand-border rounded-xl">
            {(['overview', 'logs'] as const).map(tab => (
              <button
                key={tab}
                type="button"
                aria-pressed={activeTab === tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'px-3.5 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase tracking-wider transition-all',
                  activeTab === tab
                    ? 'bg-indigo-500/20 text-indigo-400 shadow-none'
                    : 'text-brand-text-muted hover:text-brand-text-secondary',
                )}
              >
                {tab === 'overview' ? 'TELEMETRY' : 'STREAM'}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowSemantic(p => !p)}
            className={cn(
              'px-2.5 py-1.5 rounded-lg text-[12px] font-mono font-bold uppercase tracking-wider transition-all border',
              showSemantic
                ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                : 'text-brand-text-muted border-brand-border hover:text-brand-text-secondary',
            )}
            aria-pressed={showSemantic}
            title={showSemantic ? 'Show opaque service identifiers' : 'Reveal service names'}
          >
            {showSemantic ? 'SEMANTIC' : 'OPAQUE'}
          </button>

          <div className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-[12px] font-mono font-bold',
            connectionMode === 'sse'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-amber-500/10 text-amber-400 border-amber-500/30',
          )}>
            <motion.div
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                connectionMode === 'sse' ? 'bg-emerald-400' : 'bg-amber-400',
              )}
              animate={{ scale: [1, 1.5, 1], opacity: [0.6, 1, 0.6] }}
              transition={{ duration: connectionMode === 'sse' ? 2 : 1.2, repeat: Infinity }}
            />
            {connectionMode === 'sse' ? 'STREAM' : 'POLL'}
          </div>
        </div>
      </div>

      {/* ── Signal Bar ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          {
            label: 'TRACES',
            value: workflowMetrics.running > 0 ? `${workflowMetrics.running} ACTIVE` : 'IDLE',
            color: workflowMetrics.running > 0 ? 'text-indigo-400' : 'text-brand-text-muted',
          },
          {
            label: 'WS',
            value: dataChannelStatus.socketIO === 'connected' ? 'SYNC' : 'DOWN',
            color: dataChannelStatus.socketIO === 'connected' ? 'text-emerald-400' : 'text-red-400',
          },
          {
            label: 'REST',
            value: dataChannelStatus.restPolling === 'active' ? 'ACTIVE' : 'IDLE',
            color: dataChannelStatus.restPolling === 'active' ? 'text-emerald-400' : 'text-amber-400',
          },
          {
            label: 'DB',
            value: dataChannelStatus.supabaseRealtime === 'subscribed' ? 'SYNC' : '—',
            color: dataChannelStatus.supabaseRealtime === 'subscribed' ? 'text-emerald-400' : 'text-brand-text-muted',
          },
        ].map(m => {
          const active = !['DOWN', 'IDLE', '—'].includes(m.value);
          return (
            <motion.div
              key={m.label}
              className="bg-brand-elevated/80 border border-brand-border rounded-xl p-2.5 flex items-center gap-2 relative overflow-hidden"
              animate={active ? { borderColor: ['rgba(255,255,255,0.08)', 'rgba(99,102,241,0.22)', 'rgba(255,255,255,0.08)'] } : undefined}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <motion.div
                className={cn('absolute left-0 top-0 bottom-0 w-px', m.color)}
                animate={{ opacity: active ? [0.2, 0.8, 0.2] : [0.15, 0.3, 0.15] }}
                transition={{ duration: 2.5, repeat: Infinity }}
              />
              <Radio className={cn('w-3.5 h-3.5 flex-shrink-0', m.color)} />
              <div className="min-w-0">
                <p className="text-[10px] text-brand-text-muted uppercase font-mono tracking-wider">{m.label}</p>
                <p className={cn('text-[10px] font-bold font-mono', m.color)}>{m.value}</p>
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        {activeTab === 'overview' && (
          <motion.div
            key="overview"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="space-y-5"
          >
            {/* ── System Telemetry ───────────────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-[12px] font-mono font-bold uppercase tracking-[0.15em] text-brand-text-muted">
                    System Telemetry
                  </h2>
                  <p className="text-[10px] font-mono text-brand-text-muted/60 uppercase mt-0.5">
                    Live resource pressure
                  </p>
                </div>
                <motion.span
                  className="text-[10px] font-mono uppercase tracking-wider text-emerald-400"
                  animate={{ opacity: [0.45, 1, 0.45] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                >
                  ● LIVE
                </motion.span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <PressureGauge value={gauges.cpu} label="PROCESSOR" color="#818cf8" />
                <PressureGauge value={gauges.mem} label="ALLOCATION" color="#06b6d4" />
                <PressureGauge value={gauges.disk} label="STORAGE" color="#34d399" />
              </div>
            </section>

            {/* ── Service Mesh ───────────────────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-[12px] font-mono font-bold uppercase tracking-[0.15em] text-brand-text-muted">
                    Service Mesh
                  </h2>
                  <p className="text-[10px] font-mono text-brand-text-muted/60 uppercase mt-0.5">
                    Internal execution fabric
                  </p>
                </div>
                <span className="text-[11px] font-mono text-brand-text-muted/70">
                  {showSemantic ? 'SEMANTIC MODE' : 'OPAQUE MODE'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
                {services.map((svc, i) => (
                  <ServiceCard key={svc.visualId || i} {...svc} revealSemantic={showSemantic} />
                ))}
              </div>
            </section>

            {/* ── External Watchdogs ────────────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-[12px] font-mono font-bold uppercase tracking-[0.15em] text-brand-text-muted">
                    External Watchdogs
                  </h2>
                  <p className="text-[10px] font-mono text-brand-text-muted/60 uppercase mt-0.5">
                    Independent verification layer
                  </p>
                </div>
                <span className="text-[11px] font-mono text-brand-text-muted/70">
                  {showSemantic ? 'MONITOR + BACKUP' : 'WD-01 · WD-02'}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                <MonitorWatchdogCard revealSemantic={showSemantic} />
                <BackupWatchdogCard revealSemantic={showSemantic} />
              </div>
            </section>

            {/* ── System Metrics ────────────────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[12px] font-mono font-bold uppercase tracking-[0.15em] text-brand-text-muted">
                  System Metrics
                </h2>
                <span className="text-[10px] font-mono uppercase text-brand-text-muted/60">Derived telemetry</span>
              </div>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                <LiveMetricCard label="LATENCY" value={avgLatency} suffix="ms" sub="P50" color="#818cf8" pulseKey={avgLatency} />
                <LiveMetricCard label="PRESSURE" value={Math.round(avgPressure * 100)} suffix="%" sub="FABRIC" color={avgPressure > 0.5 ? '#f59e0b' : '#34d399'} pulseKey={Math.round(avgPressure * 100)} />
                <LiveMetricCard label="SPANS" value={services.length} sub="REGISTERED" color="#a1a1aa" pulseKey={services.length} />
                <LiveMetricCard label="UPTIME" value={services.length ? Math.round((onlineCount / services.length) * 100) : 0} suffix="%" sub={`${onlineCount}/${services.length} NOMINAL`} color={onlineCount === services.length ? '#34d399' : '#f59e0b'} pulseKey={`${onlineCount}/${services.length}`} />
              </div>
            </section>

            {/* ── Data Flow / Topology ───────────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h2 className="text-[12px] font-mono font-bold uppercase tracking-[0.15em] text-brand-text-muted">
                    Data Flow
                  </h2>
                  <p className="text-[10px] font-mono text-brand-text-muted/60 uppercase mt-0.5">
                    Runtime topology
                  </p>
                </div>
                <motion.span
                  className="text-[10px] font-mono uppercase text-indigo-400"
                  animate={{ opacity: [0.45, 1, 0.45] }}
                  transition={{ duration: 2.5, repeat: Infinity }}
                >
                  ● FLOWING
                </motion.span>
              </div>

              <div className="rounded-2xl border border-brand-border overflow-hidden bg-brand-bg/60">
                <ErrorBoundary name="Data Flow">
                  <DataFlowVisualizer />
                </ErrorBoundary>
              </div>
            </section>

            {/* ── Log Statistics ────────────────────────────────── */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-[12px] font-mono font-bold uppercase tracking-[0.15em] text-brand-text-muted">
                  Log Statistics
                </h2>
                <span className="text-[10px] font-mono uppercase text-brand-text-muted/60">Signal density</span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                <LiveMetricCard label="ERRORS" value={logStats.errors} color="#f87171" pulseKey={logStats.errors} />
                <LiveMetricCard label="WARNINGS" value={logStats.warnings} color="#fbbf24" pulseKey={logStats.warnings} />
                <LiveMetricCard label="SUCCESS" value={logStats.success} color="#34d399" pulseKey={logStats.success} />
                <LiveMetricCard label="RATE" value={Math.round(logStats.rate)} suffix="%" color="#38bdf8" pulseKey={Math.round(logStats.rate)} />
                <LiveMetricCard label="TOTAL" value={logStats.total_logs} color="#a1a1aa" pulseKey={logStats.total_logs} />
              </div>
            </section>
          </motion.div>
        )}

        {/* ── Logs Tab ────────────────────────────────────────────── */}
        {activeTab === 'logs' && (
          <motion.div
            key="logs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="bg-brand-elevated/80 border border-brand-border rounded-2xl overflow-hidden flex flex-col h-[min(600px,calc(100dvh-220px))] min-h-[360px]"
          >
            <div className="p-4 border-b border-brand-border flex flex-wrap items-center gap-3 bg-brand-bg/40 shrink-0">
              <h2 className="text-[12px] font-mono font-bold uppercase tracking-[0.15em] text-brand-text-muted">
                Event Stream
              </h2>

              <select
                value={filter.level}
                onChange={e => setFilter(f => ({ ...f, level: e.target.value }))}
                className="bg-brand-elevated border border-brand-border rounded-lg px-2.5 py-1.5 text-[12px] font-mono text-brand-text-secondary focus:outline-none focus:border-indigo-500/50"
              >
                <option value="">All Levels</option>
                <option value="DEBUG">DEBUG</option>
                <option value="INFO">INFO</option>
                <option value="WARNING">WARNING</option>
                <option value="ERROR">ERROR</option>
                <option value="CRITICAL">CRITICAL</option>
              </select>

              <div className="relative flex-1 max-w-xs">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-brand-text-muted" />
                <input
                  type="text"
                  aria-label="Filter event stream"
                  placeholder="Filter stream..."
                  value={filter.search}
                  onChange={e => setFilter(f => ({ ...f, search: e.target.value }))}
                  className="w-full pl-7 pr-3 py-1.5 bg-brand-elevated border border-brand-border rounded-lg text-[12px] font-mono text-brand-text-secondary placeholder-brand-text-muted/50 focus:outline-none focus:border-indigo-500/50"
                />
              </div>

              <button
                onClick={handlePauseToggle}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-mono font-bold uppercase transition-all',
                  paused
                    ? 'bg-emerald-500/10 text-emerald-400 border border-emerald-500/30'
                    : 'bg-amber-500/10 text-amber-400 border border-amber-500/30',
                )}
              >
                {paused ? <><Play className="w-3 h-3" /> RESUME</> : <><Pause className="w-3 h-3" /> PAUSE</>}
              </button>

              <span className="text-[11px] text-brand-text-muted font-mono ml-auto">
                {filteredEvents.length} ENTRIES
              </span>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {filteredEvents.length === 0 ? (
                <div className="flex items-center justify-center h-full text-brand-text-muted/70 text-[10px] font-mono uppercase">
                  {connectionMode === 'sse' ? 'Awaiting signals...' : 'No events received'}
                </div>
              ) : (
                filteredEvents.map((entry, i) => (
                  <LogRow key={entry.id || i} entry={entry} />
                ))
              )}
            </div>

            <div className="px-3 py-1.5 border-t border-brand-border bg-brand-bg/40 flex items-center justify-between text-[11px] font-mono shrink-0">
              <span className="text-brand-text-muted/70">
                {connectionMode.toUpperCase()} · {filteredEvents.length} EVENTS · {logStats.errors} ERR
              </span>
              <div className="flex items-center gap-2">
                <motion.span
                  className={cn(
                    'w-1.5 h-1.5 rounded-full',
                    connectionMode === 'sse' ? 'bg-emerald-400' : 'bg-amber-400',
                  )}
                  animate={{ scale: [1, 1.5, 1], opacity: [0.5, 1, 0.5] }}
                  transition={{ duration: connectionMode === 'sse' ? 2 : 1.2, repeat: Infinity }}
                />
                <span className="text-brand-text-muted uppercase">
                  {connectionMode === 'sse' ? 'Streaming' : 'Polling'}
                </span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
