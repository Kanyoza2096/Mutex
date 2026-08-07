// ═══════════════════════════════════════════════════════════════════════════
// DASHBOARD — Mission Control v18
// Premium Observability / AI Operations Command Center
//
// Single-file dashboard.
// Existing store, topology, workflow, security, infrastructure and mobile
// components are intentionally preserved.
//
// Visual system:
//   • High-density observability-console layout
//   • Continuous telemetry motion
//   • Rotating/spinning live indicators
//   • Signal sweeps
//   • Animated gauges
//   • Infrastructure status illumination
//   • Glass/depth panels
//   • Responsive desktop/mobile topology
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useMemo,
  useState,
  useEffect,
  useRef,
  Suspense,
} from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';

import {
  Activity,
  Zap,
  BrainCircuit,
  Wifi,
  WifiOff,
  Clock,
  Globe,
  RefreshCw,
  Shield,
  Package,
  Server,
  CheckCircle,
  AlertTriangle,
  XCircle,
  Workflow,
  Target,
  BarChart3,
  Play,
  Pause,
  Network,
  Crosshair,
  Layers,
  Gauge,
  Radio,
  HardDrive,
  Cpu,
  Database,
  Cloud,
  Sparkles,
  Radar,
  Waves,
  CircleDot,
  ChevronRight,
  Terminal,
  Boxes,
  Lock,
  Eye,
  Send,
  MessageSquare,
  GitBranch,
  ActivitySquare,
} from 'lucide-react';

import { cn, vibrate } from '../lib/utils';

import Topology3D from '../components/Topology3D';
import AIOrb from '../components/AIOrb';
import DigitalTwin from '../components/DigitalTwin';
import { ErrorBoundary } from '../components/ErrorBoundary';

import MobileTopology from '../components/mobile/MobileTopology';
import MobileWorkflow from '../components/mobile/MobileWorkflow';
import MobileSecurity from '../components/mobile/MobileSecurity';
import MobileInfra from '../components/mobile/MobileInfra';

import {
  VirtualizationMapper,
  DataflowLens,
  DepthController,
  SignalVirtualizer,
  resolveLabel,
} from '../lib/virtualization';

import type {
  DataflowLensType,
  DepthLevel,
  DisplayMode,
  VirtualizedSignal,
} from '../lib/virtualization';

const Workflow3D = React.lazy(() => import('../components/Workflow3D'));
const SecurityGlobe = React.lazy(() => import('../components/SecurityGlobe'));
const InfraMap3D = React.lazy(() => import('../components/InfraMap3D'));

// ═══════════════════════════════════════════════════════════════════════════
// PIPELINE
// ═══════════════════════════════════════════════════════════════════════════

const PIPELINE_STAGES = [
  { label: 'Planner', status: 'completed' as const },
  { label: 'Research', status: 'completed' as const },
  { label: 'Knowledge', status: 'active' as const, progress: 72 },
  { label: 'Prompt', status: 'waiting' as const },
  { label: 'LLM', status: 'waiting' as const },
  { label: 'Validator', status: 'waiting' as const },
  { label: 'Reviewer', status: 'waiting' as const },
  { label: 'Renderer', status: 'waiting' as const },
  { label: 'Publisher', status: 'waiting' as const },
  { label: 'Analytics', status: 'waiting' as const },
];

// ═══════════════════════════════════════════════════════════════════════════
// VISUAL PRIMITIVES
// ═══════════════════════════════════════════════════════════════════════════

const PulseDot = React.memo(
  ({
    color,
    size = 'sm',
    intensity = 'normal',
  }: {
    color: string;
    size?: 'sm' | 'lg';
    intensity?: 'normal' | 'strong';
  }) => (
    <span
      className={cn(
        'relative flex shrink-0',
        size === 'lg' ? 'h-3 w-3' : 'h-2 w-2',
      )}
    >
      <span
        className={cn(
          'absolute inline-flex h-full w-full rounded-full',
          intensity === 'strong' ? 'animate-ping' : 'animate-pulse',
          'opacity-70',
        )}
        style={{ backgroundColor: color }}
      />
      <span
        className="relative inline-flex rounded-full h-full w-full"
        style={{
          backgroundColor: color,
          boxShadow: `0 0 8px ${color}90`,
        }}
      />
    </span>
  ),
);

PulseDot.displayName = 'PulseDot';

// ───────────────────────────────────────────────────────────────────────────

const LiveSweep = React.memo(
  ({ color = '#6366f1' }: { color?: string }) => (
    <div className="pointer-events-none absolute inset-0 overflow-hidden rounded-[inherit]">
      <motion.div
        className="absolute top-0 bottom-0 w-px"
        style={{
          background: `linear-gradient(
            to bottom,
            transparent,
            ${color}80,
            transparent
          )`,
          boxShadow: `0 0 20px ${color}70`,
        }}
        animate={{ left: ['-5%', '105%'] }}
        transition={{
          duration: 5.5,
          repeat: Infinity,
          ease: 'linear',
          repeatDelay: 2.5,
        }}
      />
    </div>
  ),
);

LiveSweep.displayName = 'LiveSweep';

// ───────────────────────────────────────────────────────────────────────────

const RotatingSignal = React.memo(
  ({
    color = '#818cf8',
    size = 34,
    speed = 8,
  }: {
    color?: string;
    size?: number;
    speed?: number;
  }) => (
    <div
      className="relative flex items-center justify-center shrink-0"
      style={{ width: size, height: size }}
    >
      <motion.div
        className="absolute inset-0 rounded-full border border-dashed"
        style={{ borderColor: `${color}60` }}
        animate={{ rotate: 360 }}
        transition={{
          duration: speed,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      <motion.div
        className="absolute inset-[5px] rounded-full border"
        style={{
          borderColor: `${color}25`,
          borderTopColor: `${color}90`,
          borderBottomColor: `${color}60`,
        }}
        animate={{ rotate: -360 }}
        transition={{
          duration: speed * 1.7,
          repeat: Infinity,
          ease: 'linear',
        }}
      />

      <motion.span
        className="rounded-full"
        style={{
          width: 5,
          height: 5,
          backgroundColor: color,
          boxShadow: `0 0 12px ${color}`,
        }}
        animate={{
          scale: [0.75, 1.25, 0.75],
          opacity: [0.55, 1, 0.55],
        }}
        transition={{
          duration: 1.6,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
      />
    </div>
  ),
);

RotatingSignal.displayName = 'RotatingSignal';

// ───────────────────────────────────────────────────────────────────────────

const Panel = React.memo(
  ({
    children,
    className,
    color = '#6366f1',
    sweep = false,
  }: {
    children: React.ReactNode;
    className?: string;
    color?: string;
    sweep?: boolean;
  }) => (
    <motion.div
      initial={{ opacity: 0, y: 7 }}
      animate={{ opacity: 1, y: 0 }}
      whileHover={{ y: -1 }}
      transition={{ duration: 0.35 }}
      className={cn(
        'relative overflow-hidden rounded-2xl',
        'border border-brand-border',
        'bg-brand-surface/90 backdrop-blur-xl',
        'shadow-[0_12px_45px_rgba(0,0,0,0.18)]',
        className,
      )}
    >
      <div
        className="absolute left-0 right-0 top-0 h-px opacity-70"
        style={{
          background: `linear-gradient(
            90deg,
            transparent,
            ${color}70,
            transparent
          )`,
        }}
      />

      <div
        className="absolute -top-20 -right-20 h-40 w-40 rounded-full blur-3xl opacity-[0.035]"
        style={{ backgroundColor: color }}
      />

      {sweep && <LiveSweep color={color} />}

      <div className="relative z-10">{children}</div>
    </motion.div>
  ),
);

Panel.displayName = 'Panel';

// ───────────────────────────────────────────────────────────────────────────

const PanelHeader = React.memo(
  ({
    icon: Icon,
    label,
    color = '#818cf8',
    right,
  }: {
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    label: string;
    color?: string;
    right?: React.ReactNode;
  }) => (
    <div className="flex items-center gap-2 px-4 py-3 border-b border-brand-border">
      <div
        className="flex h-6 w-6 items-center justify-center rounded-lg border"
        style={{
          backgroundColor: `${color}0c`,
          borderColor: `${color}25`,
        }}
      >
        <Icon
          className="h-3.5 w-3.5"
          style={{
            color,
            filter: `drop-shadow(0 0 5px ${color}60)`,
          }}
        />
      </div>

      <span className="text-[11px] font-mono font-bold uppercase tracking-[0.18em] text-brand-text-secondary">
        {label}
      </span>

      <div className="ml-auto">{right}</div>
    </div>
  ),
);

PanelHeader.displayName = 'PanelHeader';

// ═══════════════════════════════════════════════════════════════════════════
// STATUS
// ═══════════════════════════════════════════════════════════════════════════

const StatusBadge = React.memo(({ status }: { status: string }) => {
  const config: Record<
    string,
    { color: string; dot: string; glow: string }
  > = {
    online: {
      color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      dot: 'bg-emerald-400',
      glow: '#34d399',
    },
    active: {
      color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      dot: 'bg-emerald-400',
      glow: '#34d399',
    },
    healthy: {
      color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      dot: 'bg-emerald-400',
      glow: '#34d399',
    },
    connected: {
      color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
      dot: 'bg-emerald-400',
      glow: '#34d399',
    },
    running: {
      color: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
      dot: 'bg-blue-400',
      glow: '#60a5fa',
    },
    standby: {
      color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      dot: 'bg-amber-400',
      glow: '#fbbf24',
    },
    degraded: {
      color: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
      dot: 'bg-amber-400',
      glow: '#fbbf24',
    },
    waiting: {
      color: 'bg-brand-text-muted/10 text-brand-text-secondary border-brand-border',
      dot: 'bg-brand-text-secondary',
      glow: '#a1a1aa',
    },
    idle: {
      color: 'bg-brand-text-muted/10 text-brand-text-secondary border-brand-border',
      dot: 'bg-brand-text-secondary',
      glow: '#a1a1aa',
    },
    offline: {
      color: 'bg-red-500/10 text-red-400 border-red-500/20',
      dot: 'bg-red-400',
      glow: '#f87171',
    },
  };

  const c = config[status] || config.offline;

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-1.5 py-0.5',
        'rounded border text-[10px] font-mono uppercase',
        c.color,
      )}
    >
      <span className="relative flex h-1.5 w-1.5">
        {(status === 'active' ||
          status === 'running' ||
          status === 'connected' ||
          status === 'healthy') && (
          <span
            className="absolute inset-0 animate-ping rounded-full opacity-50"
            style={{ backgroundColor: c.glow }}
          />
        )}
        <span
          className={cn('relative h-1.5 w-1.5 rounded-full', c.dot)}
          style={{ boxShadow: `0 0 5px ${c.glow}` }}
        />
      </span>

      {status}
    </span>
  );
});

StatusBadge.displayName = 'StatusBadge';

// ═══════════════════════════════════════════════════════════════════════════
// PRESSURE BAR
// ═══════════════════════════════════════════════════════════════════════════

const PressureBar = React.memo(
  ({
    value,
    color,
    height = 3,
    animated = true,
  }: {
    value: number;
    color: string;
    height?: number;
    animated?: boolean;
  }) => {
    const safe = Math.min(1, Math.max(0, value));

    return (
      <div
        className="relative flex-1 overflow-hidden rounded-full bg-brand-elevated"
        style={{ height }}
      >
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${safe * 100}%` }}
          transition={{
            duration: animated ? 0.9 : 0,
            ease: 'easeOut',
          }}
          className="relative h-full rounded-full"
          style={{
            backgroundColor: color,
            boxShadow: `0 0 9px ${color}70`,
          }}
        >
          {animated && (
            <motion.div
              className="absolute inset-y-0 w-12"
              style={{
                background: `linear-gradient(
                  90deg,
                  transparent,
                  rgba(255,255,255,.35),
                  transparent
                )`,
              }}
              animate={{ x: ['-50px', '100px'] }}
              transition={{
                duration: 1.8,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          )}
        </motion.div>
      </div>
    );
  },
);

PressureBar.displayName = 'PressureBar';

// ═══════════════════════════════════════════════════════════════════════════
// METRIC ROW
// ═══════════════════════════════════════════════════════════════════════════

const MetricRow = React.memo(
  ({
    label,
    value,
    unit = '',
    sub,
    accent = false,
  }: {
    label: string;
    value: string | number;
    unit?: string;
    sub?: string;
    accent?: boolean;
  }) => (
    <div className="flex items-center justify-between py-1">
      <span className="text-[11px] font-mono text-brand-text-muted">
        {label}
      </span>

      <div className="text-right">
        <span
          className={cn(
            'text-[11px] font-mono font-bold tabular-nums',
            accent ? 'text-indigo-300' : 'text-brand-text-secondary',
          )}
        >
          {value}
        </span>

        {unit && (
          <span className="ml-0.5 text-[10px] text-brand-text-muted">
            {unit}
          </span>
        )}

        {sub && (
          <span className="block text-[10px] text-brand-text-muted">
            {sub}
          </span>
        )}
      </div>
    </div>
  ),
);

MetricRow.displayName = 'MetricRow';

// ═══════════════════════════════════════════════════════════════════════════
// PRESSURE GAUGE
// ═══════════════════════════════════════════════════════════════════════════

const PressureGauge = React.memo(
  ({
    value,
    label,
    color,
    size = 'md',
  }: {
    value: number;
    label: string;
    color: string;
    size?: 'sm' | 'md';
  }) => {
    const radius = size === 'sm' ? 22 : 30;
    const circumference = 2 * Math.PI * radius;
    const safeValue = Math.min(100, Math.max(0, value));
    const offset =
      circumference - (safeValue / 100) * circumference;

    const svgSize = size === 'sm' ? 56 : 72;

    return (
      <motion.div
        whileHover={{ scale: 1.025 }}
        className="group flex flex-col items-center justify-center rounded-2xl border border-brand-border bg-brand-surface/80 p-3"
      >
        <div
          className="relative flex items-center justify-center"
          style={{ width: svgSize, height: svgSize }}
        >
          <motion.div
            className="absolute inset-0 rounded-full"
            style={{
              background: `radial-gradient(
                circle,
                ${color}12 0%,
                transparent 68%
              )`,
            }}
            animate={{
              opacity: [0.5, 1, 0.5],
              scale: [0.94, 1.04, 0.94],
            }}
            transition={{
              duration: 2.5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />

          <svg
            className="h-full w-full -rotate-90"
            viewBox={`0 0 ${svgSize} ${svgSize}`}
          >
            <circle
              cx={svgSize / 2}
              cy={svgSize / 2}
              r={radius}
              stroke="#151522"
              strokeWidth="4"
              fill="none"
            />

            <motion.circle
              cx={svgSize / 2}
              cy={svgSize / 2}
              r={radius}
              stroke={color}
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={circumference}
              animate={{ strokeDashoffset: offset }}
              transition={{
                duration: 1.2,
                ease: 'easeOut',
              }}
              style={{
                filter: `drop-shadow(0 0 4px ${color}90)`,
              }}
            />
          </svg>

          <motion.span
            className="absolute text-[10px] font-mono font-bold text-brand-text"
            animate={{
              opacity: [0.7, 1, 0.7],
            }}
            transition={{
              duration: 2,
              repeat: Infinity,
            }}
          >
            {Math.round(safeValue)}
          </motion.span>
        </div>

        <p className="mt-2 text-[10px] font-mono font-bold uppercase tracking-[0.15em] text-brand-text-muted group-hover:text-brand-text-secondary">
          {label}
        </p>
      </motion.div>
    );
  },
);

PressureGauge.displayName = 'PressureGauge';

// ═══════════════════════════════════════════════════════════════════════════
// SIGNAL ROW
// ═══════════════════════════════════════════════════════════════════════════

const SignalRow = React.memo(
  ({
    signal,
    mode,
    onClick,
    index,
  }: {
    signal: VirtualizedSignal;
    mode: DisplayMode;
    onClick?: () => void;
    index: number;
  }) => {
    const sourceLabel =
      mode === 'RAW' ? signal.rawSource : signal.virtualSource;

    const targetLabel =
      mode === 'RAW' ? signal.rawTarget : signal.virtualTarget;

    const typeLabel = SignalVirtualizer.typeLabel(signal.type);
    const sevColor = SignalVirtualizer.severityColor(
      signal.severity,
    );

    return (
      <motion.div
        initial={{ opacity: 0, x: -8 }}
        animate={{ opacity: 1, x: 0 }}
        transition={{
          duration: 0.25,
          delay: index * 0.025,
        }}
        className="group flex cursor-pointer items-center gap-2 rounded-lg px-1 py-1.5 text-[11px] font-mono transition-colors hover:bg-indigo-500/[0.035]"
        onClick={onClick}
        role="button"
        tabIndex={0}
      >
        <span className="w-14 shrink-0 tabular-nums text-brand-text-muted">
          {new Date(signal.timestamp).toLocaleTimeString([], {
            hour: '2-digit',
            minute: '2-digit',
            second: '2-digit',
          })}
        </span>

        <span
          className="w-8 shrink-0 rounded px-1 py-0.5 text-center font-bold"
          style={{
            backgroundColor: `${sevColor}15`,
            color: sevColor,
            boxShadow: `inset 0 0 8px ${sevColor}08`,
          }}
        >
          {typeLabel}
        </span>

        <span className="truncate text-brand-text-muted group-hover:text-brand-text-secondary">
          {sourceLabel}
        </span>

        <span className="shrink-0 text-indigo-500/40">
          →
        </span>

        <span className="truncate text-brand-text-muted group-hover:text-brand-text-secondary">
          {targetLabel}
        </span>

        {signal.latency && (
          <span className="ml-auto shrink-0 text-brand-text-muted">
            {signal.latency}ms
          </span>
        )}

        <span className="ml-1 shrink-0 text-[10px] text-brand-text-muted">
          {signal.traceId.slice(0, 8)}
        </span>
      </motion.div>
    );
  },
);

SignalRow.displayName = 'SignalRow';

// ═══════════════════════════════════════════════════════════════════════════
// LIVE COUNTER
// ═══════════════════════════════════════════════════════════════════════════

const LiveCounter = React.memo(
  ({
    value,
    label,
    color = '#818cf8',
    icon: Icon = Activity,
  }: {
    value: string | number;
    label: string;
    color?: string;
    icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  }) => (
    <div className="relative overflow-hidden rounded-xl border border-brand-border bg-brand-surface/80 px-3 py-2">
      <motion.div
        className="absolute inset-y-0 left-0 w-px"
        style={{ backgroundColor: color }}
        animate={{
          opacity: [0.25, 0.9, 0.25],
        }}
        transition={{
          duration: 2,
          repeat: Infinity,
        }}
      />

      <div className="flex items-center gap-2">
        <Icon
          className="h-3 w-3"
          style={{
            color,
            filter: `drop-shadow(0 0 5px ${color}60)`,
          }}
        />

        <div>
          <motion.div
            key={String(value)}
            initial={{ opacity: 0, y: 3 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-sm font-mono font-bold tabular-nums text-brand-text"
          >
            {value}
          </motion.div>

          <div className="text-[10px] font-mono uppercase tracking-wider text-brand-text-muted">
            {label}
          </div>
        </div>
      </div>
    </div>
  ),
);

LiveCounter.displayName = 'LiveCounter';

// ───────────────────────────────────────────────────────────────────────────
// Isolated mission clock
//
// This clock updates independently so the 10fps centisecond display does not
// force the entire 2,800+ line dashboard tree to re-render.
// ───────────────────────────────────────────────────────────────────────────
const MissionClock = React.memo(function MissionClock() {
  const [elapsed, setElapsed] = useState(0);

  useEffect(() => {
    const start = performance.now();
    const tick = () => setElapsed(performance.now() - start);
    tick();
    const id = window.setInterval(tick, 100);
    return () => window.clearInterval(id);
  }, []);

  const total = Math.max(0, Math.floor(elapsed));
  const h = Math.floor(total / 3600000).toString().padStart(2, '0');
  const m = Math.floor((total % 3600000) / 60000).toString().padStart(2, '0');
  const s = Math.floor((total % 60000) / 1000).toString().padStart(2, '0');
  const cs = Math.floor((total % 1000) / 10).toString().padStart(2, '0');

  return <>{h}:{m}:{s}:{cs}</>;
});

MissionClock.displayName = 'MissionClock';

// ═══════════════════════════════════════════════════════════════════════════
// MAIN DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════

export default function Dashboard() {
  const {
    stats,
    messages,
    healthMatrix,
    payloads,
    socketConnected,
    latencyHistory,
    pluginStatus,
    aiProviderHealth,
    workflowMetrics,
    systemResources,
    integrationStatus,
    dataChannelStatus,
    guardianAlerts,
    recentPosts,
    aiDecision: aiDecisionFromStore,
    missionStatus: missionFromStore,
  } = useStore();

  const [lastUpdated, setLastUpdated] = useState<Date>(
    new Date(),
  );

  const [isLoading, setIsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState<
    'topology' | 'traces'
  >('topology');

  const [streamPaused, setStreamPaused] = useState(false);

  const [displayMode, setDisplayMode] =
    useState<DisplayMode>('VIRTUALIZED');

  const [activeLens, setActiveLens] =
    useState<DataflowLensType>('SYSTEM');

  const [depthLevel, setDepthLevel] =
    useState<DepthLevel>('L0_EXECUTIVE');


  const [telemetryTick, setTelemetryTick] = useState(0);

  const navigate = useNavigate();

  // ─────────────────────────────────────────────────────────────────────────
  // VISUAL TELEMETRY PULSE
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const id = window.setInterval(() => {
      if (
        document.visibilityState === 'visible' &&
        !streamPaused
      ) {
        setTelemetryTick(v => v + 1);
      }
    }, 2000);

    return () => window.clearInterval(id);
  }, [streamPaused]);

  // ─────────────────────────────────────────────────────────────────────────
  // UPDATE TIME
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const id = window.setInterval(() => {
      if (document.visibilityState === 'visible') {
        setLastUpdated(new Date());
      }
    }, 5000);

    return () => window.clearInterval(id);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // INITIAL LOADING
  // ─────────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const t = window.setTimeout(
      () => setIsLoading(false),
      900,
    );

    return () => window.clearTimeout(t);
  }, []);

  // ═══════════════════════════════════════════════════════════════════════════
  // DERIVED DATA
  // ═══════════════════════════════════════════════════════════════════════════

  const healthSafe = Array.isArray(healthMatrix)
    ? healthMatrix
    : [];

  const onlineCount = healthSafe.filter(
    h => h?.status === 'online',
  ).length;

  const totalCount =
    healthSafe.length || 7;

  const avgLatency = useMemo(() => {
    if (!latencyHistory.length) return 0;

    return Math.round(
      latencyHistory.reduce(
        (a, b) => a + b,
        0,
      ) / latencyHistory.length,
    );
  }, [latencyHistory]);

  const virtualNodes = useMemo(
    () =>
      healthSafe.map(h =>
        VirtualizationMapper.healthEntry(h),
      ),
    [healthSafe],
  );

  const lensNodes = useMemo(
    () =>
      DataflowLens.filterNodes(
        virtualNodes,
        activeLens,
      ),
    [virtualNodes, activeLens],
  );

  const lensEdges = useMemo(() => {
    const lensDef =
      DataflowLens.getLens(activeLens);

    return lensDef.edges.map(
      ([from, to]) =>
        VirtualizationMapper.edge(from, to),
    );
  }, [activeLens]);

  // ═══════════════════════════════════════════════════════════════════════════
  // CURRENT MISSION
  // ═══════════════════════════════════════════════════════════════════════════

  const currentMission = useMemo(() => {
    if (missionFromStore?.is_active) {
      return {
        goal: missionFromStore.goal,
        stage: missionFromStore.stage,
        progress: missionFromStore.progress,
        activeAgent:
          missionFromStore.active_agent,
        isActive: true,
      };
    }

    if (workflowMetrics.running > 0) {
      return {
        goal: 'Content Publishing',
        stage: 'Working',
        progress: 50,
        activeAgent:
          aiProviderHealth.find(
            p => p.available,
          )?.model ||
          'COGNITIVE_ENGINE',
        isActive: true,
      };
    }

    return {
      goal: 'Monitoring',
      stage: 'Idle',
      progress: 100,
      activeAgent: 'Standby',
      isActive: false,
    };
  }, [
    missionFromStore,
    workflowMetrics.running,
    aiProviderHealth,
  ]);

  const aiDecision =
    aiDecisionFromStore || null;

  // ═══════════════════════════════════════════════════════════════════════════
  // SOCIAL PLATFORMS
  // ═══════════════════════════════════════════════════════════════════════════

  const socialPlatforms = [
    {
      name: 'Facebook',
      connected:
        integrationStatus.find(
          i => i.platform === 'facebook',
        )?.healthy ?? false,
    },
    {
      name: 'LinkedIn',
      connected:
        integrationStatus.find(
          i => i.platform === 'linkedin',
        )?.healthy ?? false,
    },
    {
      name: 'Instagram',
      connected:
        integrationStatus.find(
          i => i.platform === 'instagram',
        )?.healthy ?? false,
    },
    {
      name: 'X / Twitter',
      connected:
        integrationStatus.find(
          i => i.platform === 'twitter',
        )?.healthy ?? false,
    },
    {
      name: 'Telegram',
      connected:
        integrationStatus.find(
          i => i.platform === 'telegram',
        )?.healthy ?? false,
    },
  ];

  // ═══════════════════════════════════════════════════════════════════════════
  // ACTIVITY FEED
  // ═══════════════════════════════════════════════════════════════════════════

  const activityFeed = useMemo(() => {
    const items: Array<{
      id: string;
      timestamp: number;
      source: string;
      target: string;
      type: string;
      traceId: string;
      latency?: number;
      isError: boolean;
      linkTo?: string;
    }> = [];

    messages
      .slice(0, 4)
      .forEach(m =>
        items.push({
          id:
            m.id ||
            `msg_${Date.now()}`,
          timestamp:
            m.time ||
            Date.now(),
          source: 'connectors',
          target: 'socketio',
          type: 'message',
          traceId: `trace_${Date.now().toString(36)}`,
          isError: false,
          linkTo: '/messenger',
        }),
      );

    payloads
      .slice(0, 3)
      .forEach(p =>
        items.push({
          id:
            p.id ||
            `api_${Date.now()}`,
          timestamp:
            typeof p.time === 'string'
              ? Date.now()
              : p.time || 0,
          source: 'frontend',
          target: 'api',
          type: 'request',
          traceId: `trace_${Date.now().toString(36)}`,
          latency: p.status
            ? p.status >= 400
              ? 500
              : 200
            : undefined,
          isError: p.status >= 400,
          linkTo: '/payloads',
        }),
      );

    recentPosts
      .slice(0, 2)
      .forEach(p =>
        items.push({
          id:
            p.id ||
            `pub_${Date.now()}`,
          timestamp:
            p.time ||
            Date.now(),
          source: 'scheduler',
          target: 'connectors',
          type: 'publish',
          traceId: `trace_${Date.now().toString(36)}`,
          isError: false,
          linkTo: '/posts',
        }),
      );

    guardianAlerts
      .slice(0, 2)
      .forEach(a =>
        items.push({
          id:
            a.id ||
            `scan_${Date.now()}`,
          timestamp:
            a.time ||
            Date.now(),
          source: 'guardian',
          target: 'supabase',
          type: 'scan',
          traceId: `trace_${Date.now().toString(36)}`,
          isError:
            a.severity === 'CRITICAL',
          linkTo: '/guardian',
        }),
      );

    return [...items]
      .sort(
        (a, b) =>
          (b.timestamp || 0) -
          (a.timestamp || 0),
      )
      .slice(0, 8);
  }, [
    messages,
    payloads,
    recentPosts,
    guardianAlerts,
    telemetryTick,
  ]);

  const virtualSignals = useMemo(
    () =>
      SignalVirtualizer.virtualizeBatch(
        activityFeed,
      ),
    [activityFeed],
  );

  const criticalAlerts =
    guardianAlerts.filter(
      a => a.severity === 'CRITICAL',
    ).length;

  const systemHealthy =
    healthSafe.length > 0 && onlineCount === totalCount;

  // ═══════════════════════════════════════════════════════════════════════════
  // INFRA METRICS
  // ═══════════════════════════════════════════════════════════════════════════

  const infraMetrics = useMemo(
    () => [
      {
        label: 'PROCESSOR',
        value:
          systemResources.cpu_percent || 0,
        color: '#818cf8',
        icon: Cpu,
        status: 'NOMINAL' as const,
      },
      {
        label: 'ALLOCATION',
        value:
          systemResources.memory_percent ||
          0,
        color: '#06b6d4',
        icon: Server,
        status: 'NOMINAL' as const,
      },
      {
        label: 'STORAGE',
        value:
          systemResources.disk_percent ||
          0,
        color: '#34d399',
        icon: HardDrive,
        status: 'NOMINAL' as const,
      },
      {
        label: 'THROUGHPUT',
        value: Math.min(
          100,
          (avgLatency || 0) / 10,
        ),
        color: '#a78bfa',
        icon: Zap,
        status: 'NOMINAL' as const,
      },
    ],
    [systemResources, avgLatency],
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // LOADING STATE
  // ═══════════════════════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <div className="relative space-y-4 pb-20">
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          <motion.div
            className="absolute -top-40 left-1/2 h-80 w-80 rounded-full bg-indigo-500/5 blur-3xl"
            animate={{
              scale: [1, 1.2, 1],
              opacity: [0.3, 0.6, 0.3],
            }}
            transition={{
              duration: 3,
              repeat: Infinity,
            }}
          />
        </div>

        <div className="h-28 animate-pulse rounded-2xl border border-brand-border bg-brand-surface/80" />

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="h-40 animate-pulse rounded-2xl border border-brand-border bg-brand-surface/70"
            />
          ))}
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          {[1, 2, 3].map(i => (
            <div
              key={i}
              className="h-32 animate-pulse rounded-2xl border border-brand-border bg-brand-surface/70"
            />
          ))}
        </div>

        <div className="h-56 animate-pulse rounded-2xl border border-brand-border bg-brand-surface/70" />
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════════

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="relative space-y-3 overflow-hidden pb-24 md:pb-4"
    >
      {/* ═══════════════════════════════════════════════════════════════════
          AMBIENT BACKGROUND
          ═══════════════════════════════════════════════════════════════════ */}

      <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
        <motion.div
          className="absolute left-[15%] top-[5%] h-72 w-72 rounded-full bg-indigo-600/[0.025] blur-3xl"
          animate={{
            x: [0, 40, 0],
            y: [0, 20, 0],
          }}
          transition={{
            duration: 14,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />

        <motion.div
          className="absolute right-[5%] top-[30%] h-96 w-96 rounded-full bg-cyan-600/[0.018] blur-3xl"
          animate={{
            x: [0, -35, 0],
            y: [0, 25, 0],
          }}
          transition={{
            duration: 17,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          HEADER
          ═══════════════════════════════════════════════════════════════════ */}

      <Panel
        color="#6366f1"
        sweep
        className="px-4 py-3"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <RotatingSignal
              color={
                systemHealthy
                  ? '#6366f1'
                  : '#f59e0b'
              }
              size={38}
              speed={10}
            />

            <div>
              <div className="flex items-center gap-2">
                <Crosshair className="h-4 w-4 text-indigo-400" />

                <h1 className="text-base font-bold tracking-[0.16em] text-white font-mono sm:text-lg">
                  MISSION
                  <span className="text-brand-text-muted">
                    _CONTROL
                  </span>
                </h1>

                <span className="hidden rounded border border-indigo-500/20 bg-indigo-500/10 px-1.5 py-0.5 text-[10px] font-mono text-indigo-400 sm:inline">
                  LIVE
                </span>
              </div>

              <div className="mt-1 flex items-center gap-2">
                <PulseDot
                  color={
                    systemHealthy
                      ? '#22c55e'
                      : '#f59e0b'
                  }
                  intensity="strong"
                />

                <span
                  className={cn(
                    'text-[10px] font-mono font-bold uppercase tracking-widest',
                    systemHealthy
                      ? 'text-emerald-400'
                      : 'text-amber-400',
                  )}
                >
                  {systemHealthy
                    ? 'SYSTEM NOMINAL'
                    : 'SYSTEM DEGRADED'}
                </span>

                <span className="text-brand-text-muted">
                  /
                </span>

                <span className="text-[10px] font-mono text-brand-text-muted">
                  TELEMETRY STREAM
                </span>
              </div>
            </div>

            <div className="hidden h-8 w-px bg-brand-border xl:block" />

            <div className="hidden items-center gap-2 xl:flex">
              <Clock className="h-3 w-3 text-brand-text-muted" />

              <div>
                <div className="text-[10px] font-mono uppercase tracking-wider text-brand-text-muted">
                  Mission elapsed
                </div>

                <div className="text-[10px] font-mono font-bold tabular-nums tracking-wider text-brand-text-secondary">
                  <MissionClock />
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-1.5 md:flex">
              <span
                className={cn(
                  'flex items-center gap-1 text-[10px] font-mono',
                  socketConnected
                    ? 'text-emerald-400'
                    : 'text-red-400',
                )}
              >
                {socketConnected ? (
                  <Wifi className="h-2.5 w-2.5" />
                ) : (
                  <WifiOff className="h-2.5 w-2.5" />
                )}

                {socketConnected
                  ? 'SYNC'
                  : 'RECONNECTING'}
              </span>

              <span className="text-brand-text-muted">
                |
              </span>

              <span className="text-[10px] font-mono text-brand-text-muted">
                {avgLatency}ms RTT
              </span>
            </div>

            <div className="flex items-center gap-1 rounded-lg border border-brand-border bg-black/20 px-2 py-1">
              <motion.span
                className="h-1.5 w-1.5 rounded-full bg-emerald-400"
                animate={{
                  opacity: [0.35, 1, 0.35],
                  boxShadow: [
                    '0 0 2px #34d399',
                    '0 0 8px #34d399',
                    '0 0 2px #34d399',
                  ],
                }}
                transition={{
                  duration: 1.8,
                  repeat: Infinity,
                }}
              />

              <span className="text-[10px] font-mono tabular-nums text-brand-text-muted">
                {lastUpdated.toLocaleTimeString(
                  [],
                  {
                    hour: '2-digit',
                    minute: '2-digit',
                    second: '2-digit',
                  },
                )}
              </span>
            </div>
          </div>
        </div>
      </Panel>

      {/* ═══════════════════════════════════════════════════════════════════
          TOP TELEMETRY COUNTERS
          ═══════════════════════════════════════════════════════════════════ */}

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <LiveCounter
          value={onlineCount}
          label="services online"
          color="#34d399"
          icon={Server}
        />

        <LiveCounter
          value={workflowMetrics.running || 0}
          label="active workflows"
          color="#818cf8"
          icon={Workflow}
        />

        <LiveCounter
          value={guardianAlerts.length}
          label="security signals"
          color={
            criticalAlerts > 0
              ? '#f87171'
              : '#fbbf24'
          }
          icon={Shield}
        />

        <LiveCounter
          value={`${avgLatency || 0}ms`}
          label="avg latency"
          color="#22d3ee"
          icon={Activity}
        />
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          CONTROLS
          ═══════════════════════════════════════════════════════════════════ */}

      <div className="flex items-center gap-2 overflow-x-auto pb-0.5 scrollbar-thin">
        <div className="flex shrink-0 gap-0.5 rounded-xl border border-brand-border bg-brand-surface/90 p-0.5">
          {DataflowLens.getAllLenses().map(
            lens => (
              <button
                key={lens}
                onClick={() => {
                  setActiveLens(lens);
                  vibrate(5);
                }}
                className={cn(
                  'rounded-lg px-2.5 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider transition-all',
                  activeLens === lens
                    ? 'bg-indigo-500/15 text-indigo-400 shadow-[inset_0_0_12px_rgba(99,102,241,0.08)]'
                    : 'text-brand-text-muted hover:bg-brand-elevated hover:text-brand-text-secondary',
                )}
              >
                {lens}
              </button>
            ),
          )}
        </div>

        <div className="flex shrink-0 gap-0.5 rounded-xl border border-brand-border bg-brand-surface/90 p-0.5">
          {(
            [
              'L0_EXECUTIVE',
              'L1_OPERATIONAL',
              'L2_INFRASTRUCTURE',
            ] as DepthLevel[]
          ).map(level => (
            <button
              key={level}
              onClick={() =>
                setDepthLevel(level)
              }
              className={cn(
                'rounded-lg px-2 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider transition-all',
                depthLevel === level
                  ? 'bg-cyan-500/10 text-cyan-400'
                  : 'text-brand-text-muted hover:text-brand-text-secondary',
              )}
            >
              {DepthController.label(
                level,
              )}
            </button>
          ))}
        </div>

        <button
          onClick={() =>
            setDisplayMode(m =>
              m === 'VIRTUALIZED'
                ? 'RAW'
                : 'VIRTUALIZED',
            )
          }
          className={cn(
            'ml-auto shrink-0 rounded-xl border px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider transition-all',
            displayMode === 'RAW'
              ? 'border-amber-500/30 bg-amber-500/10 text-amber-400'
              : 'border-indigo-500/30 bg-indigo-500/10 text-indigo-400',
          )}
        >
          {displayMode === 'VIRTUALIZED'
            ? 'SEMANTIC OFF'
            : 'SEMANTIC ON'}
        </button>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          CURRENT MISSION
          ═══════════════════════════════════════════════════════════════════ */}

      <Panel
        color={
          currentMission.isActive
            ? '#818cf8'
            : '#22c55e'
        }
        sweep
        className="p-4"
      >
        <div className="mb-3 flex items-center gap-2">
          <Target className="h-3.5 w-3.5 text-indigo-400" />

          <span className="text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-brand-text-muted">
            Active mission
          </span>

          {currentMission.isActive && (
            <span className="ml-1 flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-400">
              <PulseDot
                color="#22c55e"
                size="sm"
                intensity="strong"
              />
              EXECUTING
            </span>
          )}

          <div className="ml-auto hidden items-center gap-1 text-[10px] font-mono text-brand-text-muted sm:flex">
            <Radio className="h-2.5 w-2.5" />
            LIVE TELEMETRY
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div>
            <div className="mb-0.5 text-[10px] font-mono uppercase tracking-wider text-brand-text-muted">
              Objective
            </div>

            <div className="truncate text-xs font-bold text-white">
              {currentMission.goal}
            </div>
          </div>

          <div>
            <div className="mb-0.5 text-[10px] font-mono uppercase tracking-wider text-brand-text-muted">
              Stage
            </div>

            <div className="text-xs font-bold text-brand-text">
              {currentMission.stage}
            </div>
          </div>

          <div className="col-span-2 sm:col-span-1">
            <div className="mb-1 text-[10px] font-mono uppercase tracking-wider text-brand-text-muted">
              Progress
            </div>

            <div className="flex items-center gap-2">
              <PressureBar
                value={
                  currentMission.progress / 100
                }
                color={
                  currentMission.isActive
                    ? '#818cf8'
                    : '#22c55e'
                }
                height={4}
              />

              <span className="w-8 text-right text-[10px] font-mono font-bold tabular-nums text-white">
                {currentMission.progress}%
              </span>
            </div>
          </div>

          <div className="hidden lg:block">
            <div className="mb-0.5 text-[10px] font-mono uppercase tracking-wider text-brand-text-muted">
              Agent
            </div>

            <div className="truncate text-xs font-bold font-mono text-brand-text">
              {displayMode ===
              'VIRTUALIZED'
                ? VirtualizationMapper.virtualId(
                    currentMission.activeAgent,
                  )
                : currentMission.activeAgent}
            </div>
          </div>

          <div className="hidden lg:block">
            <div className="mb-0.5 text-[10px] font-mono uppercase tracking-wider text-brand-text-muted">
              Active lens
            </div>

            <div className="text-xs font-bold font-mono text-indigo-400">
              {activeLens}
            </div>
          </div>
        </div>
      </Panel>

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 1 — SYSTEM / AI / WORKFLOW
          ═══════════════════════════════════════════════════════════════════ */}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* SYSTEM HEALTH */}
        <Panel color="#34d399">
          <PanelHeader
            icon={Activity}
            label="System Health"
            color="#34d399"
            right={
              <StatusBadge
                status={
                  systemHealthy
                    ? 'healthy'
                    : 'degraded'
                }
              />
            }
          />

          <div className="space-y-3 p-4">
            {[
              {
                label: 'PROCESSOR',
                value:
                  systemResources.cpu_percent ||
                  0,
                color: '#22c55e',
              },
              {
                label: 'ALLOCATION',
                value:
                  systemResources.memory_percent ||
                  0,
                color: '#f59e0b',
              },
              {
                label: 'STORAGE',
                value:
                  systemResources.disk_percent ||
                  0,
                color: '#06b6d4',
              },
            ].map(r => (
              <div
                key={r.label}
                className="flex items-center justify-between"
              >
                <span className="text-[11px] font-mono text-brand-text-muted">
                  {r.label}
                </span>

                <div className="flex w-40 items-center gap-2">
                  <PressureBar
                    value={
                      (r.value || 0) / 100
                    }
                    color={r.color}
                  />

                  <span className="w-8 text-right text-[11px] font-mono tabular-nums text-brand-text-secondary">
                    {(r.value || 0).toFixed(
                      0,
                    )}
                    %
                  </span>
                </div>
              </div>
            ))}

            <div className="border-t border-brand-border pt-2">
              <MetricRow
                label={resolveLabel(
                  'redis',
                  displayMode,
                )}
                value="NOMINAL"
                accent
              />

              <MetricRow
                label={resolveLabel(
                  'supabase',
                  displayMode,
                )}
                value="SYNC"
                accent
              />

              <MetricRow
                label="Uptime"
                value={`${onlineCount}/${totalCount}`}
                sub="services online"
              />
            </div>
          </div>
        </Panel>

        {/* AI CORE */}
        <Panel
          color="#8b5cf6"
          sweep
        >
          <PanelHeader
            icon={BrainCircuit}
            label="Cognitive Engine"
            color="#8b5cf6"
            right={
              <div className="flex items-center gap-1">
                <PulseDot
                  color="#a78bfa"
                  intensity="strong"
                />
                <span className="text-[10px] font-mono text-violet-400">
                  ONLINE
                </span>
              </div>
            }
          />

          <div className="flex flex-col items-center gap-3 p-4">
            <div className="relative">
              <motion.div
                className="absolute -inset-8 rounded-full border border-violet-500/10"
                animate={{
                  rotate: 360,
                  scale: [0.92, 1.05, 0.92],
                }}
                transition={{
                  rotate: {
                    duration: 15,
                    repeat: Infinity,
                    ease: 'linear',
                  },
                  scale: {
                    duration: 3,
                    repeat: Infinity,
                  },
                }}
              />

              <RotatingSignal
                color="#8b5cf6"
                size={118}
                speed={13}
              />

              <div className="absolute inset-0 flex items-center justify-center">
                <ErrorBoundary name="AI Orb">
                  <AIOrb size="md" />
                </ErrorBoundary>
              </div>
            </div>

            <div className="w-full space-y-2">
              {(
                aiProviderHealth.length
                  ? aiProviderHealth
                  : [
                      {
                        provider: 'gemini',
                        model: '2.5-flash',
                        available: true,
                        latency_ms: 0,
                        last_checked: '',
                      },
                    ]
              )
                .slice(0, 4)
                .map(p => (
                  <div
                    key={p.provider}
                    className="flex items-center justify-between rounded-lg border border-brand-border bg-black/10 px-2 py-1.5"
                  >
                    <div className="flex items-center gap-1.5">
                      <PulseDot
                        color={
                          p.available
                            ? '#34d399'
                            : '#f87171'
                        }
                        size="sm"
                      />

                      <span className="text-[11px] font-mono text-brand-text-secondary">
                        {displayMode ===
                        'VIRTUALIZED'
                          ? VirtualizationMapper.virtualId(
                              p.provider,
                            )
                          : p.provider}
                      </span>
                    </div>

                    <span className="text-[10px] font-mono text-brand-text-muted">
                      {p.available
                        ? p.model
                        : 'Offline'}
                    </span>
                  </div>
                ))}
            </div>
          </div>
        </Panel>

        {/* WORKFLOWS */}
        <Panel color="#f59e0b">
          <PanelHeader
            icon={Workflow}
            label="Workflow Matrix"
            color="#f59e0b"
            right={
              <RotatingSignal
                color="#f59e0b"
                size={22}
                speed={7}
              />
            }
          />

          <div className="space-y-2 p-4">
            {[
              {
                label: 'Publishing',
                status:
                  workflowMetrics.running >
                  0
                    ? 'running'
                    : 'idle',
              },
              {
                label: 'Messenger Auto Reply',
                status: 'idle',
              },
              {
                label: 'Guardian Scan',
                status:
                  guardianAlerts.length >
                  0
                    ? 'running'
                    : 'idle',
              },
              {
                label: 'Scheduler',
                status: 'waiting',
              },
            ].map(w => (
              <div
                key={w.label}
                className="flex items-center justify-between rounded-lg border border-brand-border px-2 py-1.5"
              >
                <span className="text-[11px] font-mono text-brand-text-secondary">
                  {w.label}
                </span>

                <StatusBadge
                  status={w.status}
                />
              </div>
            ))}

            <div className="border-t border-brand-border pt-2">
              <MetricRow
                label="Queue"
                value={
                  workflowMetrics.queued ||
                  0
                }
                sub="jobs pending"
                accent
              />
            </div>
          </div>
        </Panel>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 2 — SOCIAL / MODULES / PLATFORM
          ═══════════════════════════════════════════════════════════════════ */}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* SOCIAL */}
        <Panel color="#10b981">
          <PanelHeader
            icon={Globe}
            label="Social Fabric"
            color="#10b981"
            right={
              <span className="text-[10px] font-mono text-brand-text-muted">
                5 CONNECTORS
              </span>
            }
          />

          <div className="space-y-1.5 p-4">
            {socialPlatforms.map(
              p => (
                <div
                  key={p.name}
                  className="group flex items-center justify-between rounded-lg border border-brand-border px-2 py-1.5 transition-colors hover:border-brand-border"
                >
                  <div className="flex items-center gap-2">
                    <motion.span
                      className="h-1.5 w-1.5 rounded-full"
                      style={{
                        backgroundColor:
                          p.connected
                            ? '#34d399'
                            : '#3f3f46',
                      }}
                      animate={
                        p.connected
                          ? {
                              opacity: [
                                0.45,
                                1,
                                0.45,
                              ],
                            }
                          : undefined
                      }
                      transition={{
                        duration: 1.8,
                        repeat: Infinity,
                      }}
                    />

                    <span className="text-[11px] font-mono text-brand-text-secondary">
                      {displayMode ===
                      'VIRTUALIZED'
                        ? VirtualizationMapper.virtualId(
                            p.name,
                          )
                        : p.name}
                    </span>
                  </div>

                  {p.connected ? (
                    <CheckCircle className="h-3 w-3 text-emerald-400" />
                  ) : (
                    <XCircle className="h-3 w-3 text-brand-text-muted" />
                  )}
                </div>
              ),
            )}
          </div>
        </Panel>

        {/* MODULES */}
        <Panel color="#ec4899">
          <PanelHeader
            icon={Boxes}
            label="Business Modules"
            color="#ec4899"
          />

          <div className="space-y-1.5 p-4">
            {(
              pluginStatus.length
                ? pluginStatus
                : [
                    {
                      name: 'church_mis',
                      commands: 0,
                      webhooks: 0,
                      status:
                        'standby' as const,
                    },
                  ]
            ).map(p => (
              <div
                key={p.name}
                className="flex items-center justify-between rounded-lg border border-brand-border px-2 py-1.5"
              >
                <span className="truncate text-[11px] font-mono capitalize text-brand-text-secondary">
                  {displayMode ===
                  'VIRTUALIZED'
                    ? VirtualizationMapper.virtualId(
                        p.name,
                      )
                    : p.name.replace(
                        /_/g,
                        ' ',
                      )}
                </span>

                <StatusBadge
                  status={p.status as any}
                />
              </div>
            ))}
          </div>
        </Panel>

        {/* PLATFORM */}
        <Panel color="#a855f7">
          <PanelHeader
            icon={Server}
            label="Platform Fabric"
            color="#a855f7"
            right={
              <div className="flex gap-1">
                <span className="h-1 w-1 rounded-full bg-emerald-400" />
                <span className="h-1 w-1 rounded-full bg-emerald-400/60" />
                <span className="h-1 w-1 rounded-full bg-emerald-400/30" />
              </div>
            }
          />

          <div className="space-y-1.5 p-4">
            {[
              {
                name: 'REST API',
                status: 'healthy',
              },
              {
                name: 'Socket.IO',
                status:
                  socketConnected
                    ? 'connected'
                    : 'offline',
              },
              {
                name: 'Supabase',
                status: 'connected',
              },
              {
                name: 'Redis',
                status: 'connected',
              },
              {
                name: 'Storage',
                status: 'healthy',
              },
            ].map(s => (
              <div
                key={s.name}
                className="flex items-center justify-between rounded-lg border border-brand-border px-2 py-1.5"
              >
                <span className="text-[11px] font-mono text-brand-text-secondary">
                  {displayMode ===
                  'VIRTUALIZED'
                    ? VirtualizationMapper.virtualId(
                        s.name,
                      )
                    : s.name}
                </span>

                <StatusBadge
                  status={s.status}
                />
              </div>
            ))}
          </div>
        </Panel>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SIGNAL INTELLIGENCE
          ═══════════════════════════════════════════════════════════════════ */}

      <Panel
        color="#6366f1"
        className="overflow-hidden"
      >
        <PanelHeader
          icon={Radio}
          label="Signal Intelligence"
          color="#818cf8"
          right={
            <div className="flex items-center gap-2">
              <span className="hidden text-[10px] font-mono text-brand-text-muted sm:inline">
                STREAM {telemetryTick
                  .toString()
                  .padStart(4, '0')}
              </span>

              <button
                onClick={() =>
                  setStreamPaused(
                    !streamPaused,
                  )
                }
                aria-label={
                  streamPaused
                    ? 'Resume stream'
                    : 'Pause stream'
                }
                className={cn(
                  'rounded-md p-1 transition-colors',
                  streamPaused
                    ? 'text-amber-400'
                    : 'text-brand-text-muted hover:text-brand-text-secondary',
                )}
              >
                {streamPaused ? (
                  <Play className="h-3 w-3" />
                ) : (
                  <Pause className="h-3 w-3" />
                )}
              </button>

              <span className="text-[10px] font-mono text-brand-text-muted">
                {virtualSignals.length}{' '}
                SIG
              </span>
            </div>
          }
        />

        <div className="relative px-4 py-2">
          {!streamPaused && (
            <motion.div
              className="pointer-events-none absolute left-0 right-0 h-px bg-gradient-to-r from-transparent via-indigo-400/30 to-transparent"
              animate={{
                top: ['0%', '100%'],
                opacity: [0, 1, 0],
              }}
              transition={{
                duration: 3.5,
                repeat: Infinity,
                ease: 'linear',
              }}
            />
          )}

          {virtualSignals.length === 0 ? (
            <div className="flex items-center justify-center gap-2 py-8">
              <RotatingSignal
                color="#52525b"
                size={30}
              />

              <div>
                <div className="text-[11px] font-mono text-brand-text-muted">
                  Awaiting telemetry
                </div>

                <div className="text-[10px] font-mono text-brand-text-muted">
                  SIGNAL BUS STANDBY
                </div>
              </div>
            </div>
          ) : (
            <div className="max-h-52 space-y-0.5 overflow-y-auto scrollbar-thin">
              <AnimatePresence initial={false}>
                {virtualSignals.map(
                  (sig, i) => (
                    <SignalRow
                      key={
                        sig.id || i
                      }
                      signal={sig}
                      mode={
                        displayMode
                      }
                      index={i}
                      onClick={() => {
                        const item =
                          activityFeed[
                            i
                          ];

                        if (
                          item?.linkTo
                        ) {
                          navigate(
                            item.linkTo,
                          );
                        }
                      }}
                    />
                  ),
                )}
              </AnimatePresence>
            </div>
          )}
        </div>
      </Panel>

      {/* ═══════════════════════════════════════════════════════════════════
          ROW 3 — AI / ANALYTICS / WORKFLOW
          ═══════════════════════════════════════════════════════════════════ */}

      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        {/* AI DECISION */}
        <Panel color="#8b5cf6">
          <PanelHeader
            icon={BrainCircuit}
            label={
              displayMode ===
              'VIRTUALIZED'
                ? 'Cognitive Engine'
                : 'AI Decision Engine'
            }
            color="#8b5cf6"
          />

          {aiDecision ? (
            <div className="space-y-1 p-4">
              <MetricRow
                label="Topic"
                value={aiDecision.topic}
                accent
              />

              <MetricRow
                label="Confidence"
                value={
                  aiDecision.confidence
                }
                unit="%"
              />

              <div className="py-2">
                <div className="mb-1 flex items-center justify-between">
                  <span className="text-[11px] font-mono text-brand-text-muted">
                    Engagement
                  </span>

                  <span className="text-[11px] font-mono text-brand-text-secondary">
                    {aiDecision.engagement_score ||
                      0}
                  </span>
                </div>

                <PressureBar
                  value={
                    (aiDecision.engagement_score ||
                      0) / 100
                  }
                  color="#8b5cf6"
                />
              </div>

              <MetricRow
                label="Est. Reach"
                value={
                  aiDecision.estimated_reach
                }
              />

              {aiDecision.brand_name && (
                <MetricRow
                  label="Brand"
                  value={
                    displayMode ===
                    'VIRTUALIZED'
                      ? VirtualizationMapper.virtualId(
                          aiDecision.brand_name,
                        )
                      : aiDecision.brand_name
                  }
                />
              )}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10">
              <RotatingSignal
                color="#8b5cf6"
                size={58}
                speed={9}
              />

              <div className="mt-3 text-center">
                <div className="text-[11px] font-mono text-brand-text-muted">
                  Awaiting cognitive activity
                </div>

                <div className="mt-1 text-[10px] font-mono text-brand-text-muted">
                  DATA APPEARS AFTER FIRST PUBLISH
                </div>
              </div>
            </div>
          )}
        </Panel>

        {/* ANALYTICS */}
        <Panel color="#f59e0b">
          <PanelHeader
            icon={BarChart3}
            label="Analytics"
            color="#f59e0b"
            right={
              <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400">
                <PulseDot
                  color="#34d399"
                  size="sm"
                />
                LIVE
              </span>
            }
          />

          <div className="space-y-1 p-4">
            <MetricRow
              label="Messages Today"
              value={(
                stats.messagesToday ||
                0
              ).toLocaleString()}
            />

            <MetricRow
              label="API Calls"
              value={(
                stats.apiCalls || 0
              ).toLocaleString()}
            />

            <MetricRow
              label="AI Requests"
              value={(
                stats.apiCalls || 0
              ).toLocaleString()}
            />

            <MetricRow
              label="Errors"
              value={
                workflowMetrics.failed_today ||
                0
              }
            />

            <MetricRow
              label="Avg Response"
              value={
                avgLatency || 0
              }
              unit="ms"
              accent
            />

            <div className="mt-3 grid grid-cols-3 gap-1.5">
              {[
                {
                  label: 'MSG',
                  value:
                    stats.messagesToday ||
                    0,
                  color: '#818cf8',
                },
                {
                  label: 'API',
                  value:
                    stats.apiCalls ||
                    0,
                  color: '#22d3ee',
                },
                {
                  label: 'ERR',
                  value:
                    workflowMetrics.failed_today ||
                    0,
                  color: '#f87171',
                },
              ].map(x => (
                <motion.div
                  key={x.label}
                  className="rounded-lg border border-brand-border bg-black/10 p-2"
                  animate={{
                    borderColor: [
                      'rgba(39,39,42,.4)',
                      `${x.color}25`,
                      'rgba(39,39,42,.4)',
                    ],
                  }}
                  transition={{
                    duration: 3,
                    repeat: Infinity,
                  }}
                >
                  <div
                    className="text-[10px] font-mono"
                    style={{
                      color: x.color,
                    }}
                  >
                    {x.label}
                  </div>

                  <div className="mt-1 text-[11px] font-mono font-bold text-brand-text-secondary">
                    {x.value}
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        </Panel>

        {/* WORKFLOW 3D */}
        <Panel
          color="#06b6d4"
          className="hidden min-h-[320px] overflow-hidden xl:block"
        >
          <ErrorBoundary name="Workflow 3D">
            <Suspense
              fallback={
                <div className="flex min-h-[320px] items-center justify-center">
                  <RotatingSignal
                    color="#06b6d4"
                    size={50}
                  />
                </div>
              }
            >
              <Workflow3D />
            </Suspense>
          </ErrorBoundary>
        </Panel>

        {/* MOBILE WORKFLOW */}
        <div className="xl:hidden">
          <div className="overflow-hidden rounded-2xl border border-brand-border">
            <MobileWorkflow
              stages={PIPELINE_STAGES}
            />
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════════
          SECURITY
          ═══════════════════════════════════════════════════════════════════ */}

      <Panel
        color={
          criticalAlerts > 0
            ? '#ef4444'
            : '#10b981'
        }
        className="overflow-hidden"
      >
        <div className="hidden min-h-[300px] xl:block">
          <ErrorBoundary name="Security Globe">
            <Suspense
              fallback={
                <div className="flex min-h-[300px] items-center justify-center">
                  <RotatingSignal
                    color={
                      criticalAlerts > 0
                        ? '#ef4444'
                        : '#10b981'
                    }
                    size={70}
                  />
                </div>
              }
            >
              <SecurityGlobe />
            </Suspense>
          </ErrorBoundary>
        </div>

        <div className="xl:hidden">
          <MobileSecurity
            criticalCount={
              criticalAlerts
            }
            totalAlerts={
              guardianAlerts.length
            }
            systemHealthy={
              systemHealthy
            }
          />
        </div>
      </Panel>

      {/* ═══════════════════════════════════════════════════════════════════
          TOPOLOGY
          ═══════════════════════════════════════════════════════════════════ */}

      <Panel
        color="#6366f1"
        className="overflow-hidden"
      >
        <div className="hidden min-h-[420px] xl:block">
          <div className="grid min-h-[420px] grid-cols-3 gap-3 p-1">
            <div className="col-span-2 overflow-hidden rounded-xl border border-brand-border">
              <ErrorBoundary name="Topology 3D">
                <Topology3D />
              </ErrorBoundary>
            </div>

            <div className="col-span-1 overflow-hidden rounded-xl border border-brand-border bg-brand-surface/80">
              <ErrorBoundary name="Digital Twin">
                <DigitalTwin />
              </ErrorBoundary>
            </div>
          </div>
        </div>

        <div className="space-y-3 p-2 xl:hidden">
          <div className="flex gap-1">
            {[
              'topology',
              'traces',
            ].map(tab => (
              <button
                key={tab}
                onClick={() =>
                  setActiveTab(
                    tab as
                      | 'topology'
                      | 'traces',
                  )
                }
                className={cn(
                  'flex-1 rounded-lg py-1.5 text-[11px] font-mono font-bold uppercase',
                  activeTab === tab
                    ? 'border border-indigo-500/30 bg-indigo-500/15 text-indigo-400'
                    : 'border border-brand-border bg-brand-surface text-brand-text-muted',
                )}
              >
                {tab === 'topology'
                  ? 'Topology'
                  : 'Traces'}
              </button>
            ))}
          </div>

          {activeTab ===
          'topology' ? (
            <div className="h-[380px] overflow-hidden rounded-xl border border-brand-border">
              <MobileTopology
                nodes={lensNodes}
                edges={lensEdges}
                mode={displayMode}
                lens={activeLens}
              />
            </div>
          ) : (
            <div className="min-h-[380px] overflow-hidden rounded-xl border border-brand-border bg-brand-surface">
              <ErrorBoundary name="Digital Twin">
                <DigitalTwin />
              </ErrorBoundary>
            </div>
          )}
        </div>
      </Panel>

      {/* ═══════════════════════════════════════════════════════════════════
          INFRASTRUCTURE
          ═══════════════════════════════════════════════════════════════════ */}

      <Panel color="#06b6d4">
        <div className="hidden min-h-[350px] xl:block">
          <ErrorBoundary name="Infra Map">
            <Suspense
              fallback={
                <div className="flex min-h-[350px] items-center justify-center">
                  <RotatingSignal
                    color="#06b6d4"
                    size={70}
                  />
                </div>
              }
            >
              <InfraMap3D />
            </Suspense>
          </ErrorBoundary>
        </div>

        <div className="xl:hidden">
          <MobileInfra
            metrics={infraMetrics}
          />
        </div>
      </Panel>

      {/* ═══════════════════════════════════════════════════════════════════
          SYSTEM CHANNEL FOOTER
          ═══════════════════════════════════════════════════════════════════ */}

      <div className="relative overflow-hidden rounded-xl border border-brand-border bg-brand-bg/80 px-3 py-2">
        <motion.div
          className="absolute inset-y-0 w-20 bg-gradient-to-r from-transparent via-indigo-500/[0.04] to-transparent"
          animate={{
            x: ['-100px', 'calc(100vw + 100px)'],
          }}
          transition={{
            duration: 8,
            repeat: Infinity,
            ease: 'linear',
            repeatDelay: 1,
          }}
        />

        <div className="relative flex flex-wrap items-center justify-between gap-2 text-[10px] font-mono text-brand-text-muted">
          <div className="flex flex-wrap items-center gap-3">
            <span>v12.2.0</span>

            <span>
              LENS:{' '}
              <span className="text-brand-text-muted">
                {activeLens}
              </span>
            </span>

            <span>
              DEPTH:{' '}
              <span className="text-brand-text-muted">
                {DepthController.label(
                  depthLevel,
                )}
              </span>
            </span>

            <span>
              MODE:{' '}
              <span
                className={cn(
                  displayMode ===
                    'VIRTUALIZED'
                    ? 'text-indigo-400'
                    : 'text-amber-400',
                )}
              >
                {displayMode}
              </span>
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span>
              WS:{' '}
              <span
                className={cn(
                  dataChannelStatus.socketIO ===
                    'connected'
                    ? 'text-emerald-400'
                    : 'text-red-400',
                )}
              >
                {
                  dataChannelStatus.socketIO
                }
              </span>
            </span>

            <span>
              REST:{' '}
              <span
                className={cn(
                  dataChannelStatus.restPolling ===
                    'active'
                    ? 'text-emerald-400'
                    : 'text-brand-text-muted',
                )}
              >
                {
                  dataChannelStatus.restPolling
                }
              </span>
            </span>

            <span>
              DB:{' '}
              <span
                className={cn(
                  dataChannelStatus.supabaseRealtime ===
                    'subscribed'
                    ? 'text-emerald-400'
                    : 'text-brand-text-muted',
                )}
              >
                {
                  dataChannelStatus.supabaseRealtime
                }
              </span>
            </span>

            <span className="flex items-center gap-1">
              <motion.span
                className="h-1 w-1 rounded-full bg-emerald-400"
                animate={{
                  scale: [0.7, 1.3, 0.7],
                  opacity: [
                    0.4,
                    1,
                    0.4,
                  ],
                }}
                transition={{
                  duration: 1.4,
                  repeat: Infinity,
                }}
              />

              UPDATED{' '}
              {lastUpdated.toLocaleTimeString(
                [],
                {
                  hour: '2-digit',
                  minute: '2-digit',
                  second: '2-digit',
                },
              )}
            </span>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
