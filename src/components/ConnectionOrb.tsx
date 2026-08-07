import React, {
  memo,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertTriangle, RotateCw, Activity, Wifi, Server } from 'lucide-react';
import { cn } from '../lib/utils';

export type OrbState =
  | 'live'
  | 'partial'
  | 'offline'
  | 'connecting';

interface OrbConfig {
  color: string;
  glowColor: string;
  label: string;
  sublabel: string;
  r1Duration: number;
  pulseDuration: number;
}

const CFG: Record<OrbState, OrbConfig> = {
  live: {
    color: '#22C55E',
    glowColor: 'rgba(34,197,94,0.65)',
    label: 'ENGINE LIVE',
    sublabel: 'All systems nominal',
    r1Duration: 7,
    pulseDuration: 2.2,
  },

  partial: {
    color: '#F59E0B',
    glowColor: 'rgba(245,158,11,0.6)',
    label: 'UPLINK PARTIAL',
    sublabel: 'One or more services degraded',
    r1Duration: 11,
    pulseDuration: 1.8,
  },

  offline: {
    color: '#EF4444',
    glowColor: 'rgba(239,68,68,0.55)',
    label: 'ENGINE OFFLINE',
    sublabel: 'Check backend configuration',
    r1Duration: 0,
    pulseDuration: 2.8,
  },

  connecting: {
    color: '#818CF8',
    glowColor: 'rgba(129,140,248,0.75)',
    label: 'CONNECTING…',
    sublabel: 'Establishing uplink',
    r1Duration: 3.5,
    pulseDuration: 1.4,
  },
};

/* ============================================================================
 * Types
 * ========================================================================== */

export interface ConnectionTelemetry {
  socketConnected: boolean;
  backendHealthy: boolean;

  transport?: 'polling' | 'websocket' | null;

  latencyMs?: number | null;
  latencyHistory?: number[];

  reconnectAttempts?: number;

  socketError?: string | null;

  lastConnectedAt?: number | null;
  lastHeartbeatAt?: number | null;
}

/* ============================================================================
 * State derivation
 * ========================================================================== */

export function deriveState(
  socketConnected: boolean,
  backendHealthy: boolean,
  booting: boolean,
  reconnectAttempts = 0,
): OrbState {
  if (booting) {
    return 'connecting';
  }

  if (!socketConnected && reconnectAttempts > 0) {
    return 'connecting';
  }

  if (socketConnected && backendHealthy) {
    return 'live';
  }

  if (socketConnected || backendHealthy) {
    return 'partial';
  }

  return 'offline';
}

/* ============================================================================
 * Telemetry helpers
 * ========================================================================== */

function calculateAverage(values: number[]): number | null {
  if (!values.length) {
    return null;
  }

  return Math.round(
    values.reduce((sum, value) => sum + value, 0) / values.length,
  );
}

function calculateJitter(values: number[]): number | null {
  if (values.length < 2) {
    return null;
  }

  const differences = values
    .slice(1)
    .map((value, index) => Math.abs(value - values[index]));

  return Math.round(
    differences.reduce((sum, value) => sum + value, 0) /
      differences.length,
  );
}

function calculateStability(values: number[]): number | null {
  if (values.length < 2) {
    return null;
  }

  const average = calculateAverage(values);

  if (average === null || average === 0) {
    return null;
  }

  const jitter = calculateJitter(values);

  if (jitter === null) {
    return null;
  }

  return Math.max(
    0,
    Math.min(100, Math.round(100 - (jitter / average) * 100)),
  );
}

/* ============================================================================
 * Sparkline
 * ========================================================================== */

interface SparklineProps {
  history: number[];
  color: string;
  id: string;
}

const Sparkline = memo(function Sparkline({
  history,
  color,
  id,
}: SparklineProps) {
  const W = 88;
  const H = 22;
  const PAD = 2;

  const data = history.slice(-30);

  if (data.length < 2) {
    return null;
  }

  const max = Math.max(...data, 50);

  const pts = data
    .map((value, index) => {
      const x =
        PAD +
        (index / (data.length - 1)) *
          (W - PAD * 2);

      const y =
        H -
        PAD -
        (value / max) *
          (H - PAD * 2);

      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(' ');

  const firstX = PAD;
  const lastX = PAD + (W - PAD * 2);

  const areaD =
    `M${firstX},${H - PAD} ` +
    `L${pts.split(' ').join(' L')} ` +
    `L${lastX},${H - PAD} Z`;

  const gradId = `spark-fill-${id}`;

  const last = pts.split(' ').pop();

  let lastPoint: { x: number; y: number } | null = null;

  if (last) {
    const [x, y] = last.split(',').map(Number);

    if (Number.isFinite(x) && Number.isFinite(y)) {
      lastPoint = { x, y };
    }
  }

  return (
    <svg
      width={W}
      height={H}
      viewBox={`0 0 ${W} ${H}`}
      className="overflow-visible"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={gradId}
          x1="0"
          y1="0"
          x2="0"
          y2="1"
        >
          <stop
            offset="0%"
            stopColor={color}
            stopOpacity="0.35"
          />

          <stop
            offset="100%"
            stopColor={color}
            stopOpacity="0.02"
          />
        </linearGradient>
      </defs>

      <path
        d={areaD}
        fill={`url(#${gradId})`}
      />

      <polyline
        points={pts}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {lastPoint && (
        <circle
          cx={lastPoint.x}
          cy={lastPoint.y}
          r="2.5"
          fill={color}
          className="animate-pulse"
        />
      )}
    </svg>
  );
});

/* ============================================================================
 * Orb ring
 * ========================================================================== */

interface RingProps {
  cx: number;
  cy: number;
  r: number;
  strokeW: number;
  dashFrac: number;
  gapFrac: number;
  color: string;
  duration: number;
}

const Ring = memo(function Ring({
  cx,
  cy,
  r,
  strokeW,
  dashFrac,
  gapFrac,
  color,
  duration,
}: RingProps) {
  const circumference = 2 * Math.PI * r;

  const dash = circumference * dashFrac;
  const gap = circumference * gapFrac;

  const spinning = duration !== 0;

  const circle = (
    <circle
      cx={cx}
      cy={cy}
      r={r}
      fill="none"
      strokeWidth={strokeW}
      strokeDasharray={`${dash.toFixed(2)} ${gap.toFixed(2)}`}
      strokeLinecap="round"
      stroke={color}
      style={{
        transition: 'stroke 0.8s ease-in-out',
      }}
    />
  );

  if (!spinning) {
    return circle;
  }

  return (
    <g
      className="animate-spin"
      style={{
        transformOrigin: `${cx}px ${cy}px`,
        animationDuration: `${Math.abs(duration)}s`,
        animationDirection:
          duration > 0 ? 'normal' : 'reverse',
      }}
    >
      {circle}
    </g>
  );
});

/* ============================================================================
 * Connection Orb
 * ========================================================================== */

export interface ConnectionOrbProps {
  socketConnected: boolean;
  isUsingLiveBackendData: boolean;

  latencyHistory?: number[];

  compact?: boolean;

  className?: string;

  socketError?: string | null;

  socketReconnectAttempts?: number;

  socketTransport?: 'polling' | 'websocket' | null;
}

export const ConnectionOrb = memo(function ConnectionOrb({
  socketConnected,
  isUsingLiveBackendData,
  latencyHistory = [],
  compact = false,
  className,
  socketError = null,
  socketReconnectAttempts = 0,
  socketTransport = null,
}: ConnectionOrbProps) {
  const [booting, setBooting] = useState(true);

  const uniqueId = useId().replace(/:/g, '');

  /*
   * One boot timer.
   */
  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBooting(false);
    }, 2500);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  const state = deriveState(
    socketConnected,
    isUsingLiveBackendData,
    booting,
    socketReconnectAttempts,
  );

  const cfg = CFG[state];

  const data = useMemo(() => {
    const history = latencyHistory.slice(-30);

    const latest =
      history.length > 0
        ? history[history.length - 1]
        : null;

    return {
      latest,
      average: calculateAverage(history),
      jitter: calculateJitter(history),
      stability: calculateStability(history),
      count: history.length,
    };
  }, [latencyHistory]);

  const ariaLabel = useMemo(() => {
    const transport = socketTransport
      ? ` using ${socketTransport}`
      : '';

    return `${cfg.label}: ${cfg.sublabel}${transport}`;
  }, [cfg, socketTransport]);

  /* --------------------------------------------------------------------------
   * Compact orb
   * ------------------------------------------------------------------------ */

  if (compact) {
    const cx = 14;
    const cy = 14;

    return (
      <svg
        width="28"
        height="28"
        viewBox="0 0 28 28"
        role="img"
        aria-label={ariaLabel}
        style={{
          filter: `drop-shadow(0 0 5px ${cfg.glowColor})`,
          transition: 'filter 0.8s',
        }}
      >
        <circle
          cx={cx}
          cy={cy}
          r="13"
          fill="none"
          strokeWidth="0.5"
          stroke={cfg.color}
          opacity="0.2"
          className="animate-pulse"
          style={{
            transformOrigin: `${cx}px ${cy}px`,
          }}
        />

        <Ring
          cx={cx}
          cy={cy}
          r={11}
          strokeW={1.5}
          dashFrac={0.72}
          gapFrac={0.28}
          color={cfg.color}
          duration={cfg.r1Duration}
        />

        <circle
          cx={cx}
          cy={cy}
          r="5"
          fill={cfg.color}
          opacity="0.15"
          className="animate-pulse"
        />

        <circle
          cx={cx}
          cy={cy}
          r="2.5"
          fill={cfg.color}
          className="animate-pulse"
          style={{
            transformOrigin: `${cx}px ${cy}px`,
          }}
        />

        {(state === 'live' ||
          state === 'connecting') && (
          <g
            className="animate-spin"
            style={{
              transformOrigin: `${cx}px ${cy}px`,
              animationDuration:
                state === 'live'
                  ? '3s'
                  : '2s',
            }}
          >
            <circle
              cx={cx + 9}
              cy={cy}
              r="1.5"
              fill={cfg.color}
              className="animate-pulse"
            />
          </g>
        )}
      </svg>
    );
  }

  /* --------------------------------------------------------------------------
   * Full orb
   * ------------------------------------------------------------------------ */

  const cx = 44;
  const cy = 44;

  const isReducedMotion =
    typeof window !== 'undefined' &&
    window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    ).matches;

  const shouldAnimate =
    !isReducedMotion;

  return (
    <div
      className={cn(
        'flex flex-col items-center gap-2.5',
        className,
      )}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      <div className="relative">
        <svg
          width="88"
          height="88"
          viewBox="0 0 88 88"
          aria-hidden="true"
          style={{
            filter: `drop-shadow(0 0 10px ${cfg.glowColor}) drop-shadow(0 0 3px ${cfg.glowColor})`,
            transition:
              'filter 0.9s ease',
          }}
        >
          <circle
            cx={cx}
            cy={cy}
            r="42"
            fill="none"
            strokeWidth="1"
            stroke={cfg.color}
            opacity="0.18"
            className={
              shouldAnimate
                ? 'animate-pulse'
                : undefined
            }
            style={{
              transformOrigin:
                `${cx}px ${cy}px`,
              animationDuration: '3s',
            }}
          />

          <circle
            cx={cx}
            cy={cy}
            r="38"
            fill="none"
            strokeWidth="0.5"
            stroke={cfg.color}
            opacity="0.1"
            className={
              shouldAnimate
                ? 'animate-pulse'
                : undefined
            }
            style={{
              animationDuration: '2s',
              animationDelay: '0.5s',
            }}
          />

          <Ring
            cx={cx}
            cy={cy}
            r={36}
            strokeW={2}
            dashFrac={0.72}
            gapFrac={0.28}
            color={cfg.color}
            duration={
              shouldAnimate
                ? cfg.r1Duration
                : 0
            }
          />

          <circle
            cx={cx}
            cy={cy}
            r="10"
            fill={cfg.color}
            opacity="0.12"
            className={
              shouldAnimate
                ? 'animate-pulse'
                : undefined
            }
            style={{
              animationDuration: '2.5s',
            }}
          />

          <circle
            cx={cx}
            cy={cy}
            r="14"
            fill={cfg.color}
            opacity="0.06"
            className={
              shouldAnimate
                ? 'animate-pulse'
                : undefined
            }
            style={{
              animationDuration: '3.2s',
              animationDelay: '0.3s',
            }}
          />

          <circle
            cx={cx}
            cy={cy}
            r="5"
            fill={cfg.color}
            className={
              shouldAnimate
                ? 'animate-pulse'
                : undefined
            }
            style={{
              transformOrigin:
                `${cx}px ${cy}px`,
              animationDuration:
                `${cfg.pulseDuration}s`,
            }}
          />

          {(state === 'live' ||
            state === 'connecting') && (
            <g
              className={
                shouldAnimate
                  ? 'animate-spin'
                  : undefined
              }
              style={{
                transformOrigin:
                  `${cx}px ${cy}px`,
                animationDuration:
                  state === 'live'
                    ? '4s'
                    : '2.5s',
              }}
            >
              <circle
                cx={cx + 30}
                cy={cy}
                r="2.5"
                fill={cfg.color}
                className={
                  shouldAnimate
                    ? 'animate-pulse'
                    : undefined
                }
                style={{
                  animationDuration:
                    '0.7s',
                }}
              />
            </g>
          )}

          {state === 'connecting' && (
            <g
              className={
                shouldAnimate
                  ? 'animate-spin'
                  : undefined
              }
              style={{
                transformOrigin:
                  `${cx}px ${cy}px`,
                animationDuration: '3.5s',
                animationDirection:
                  'reverse',
              }}
            >
              <circle
                cx={cx - 25}
                cy={cy}
                r="2"
                fill={cfg.color}
                className={
                  shouldAnimate
                    ? 'animate-pulse'
                    : undefined
                }
                style={{
                  animationDuration:
                    '0.7s',
                  animationDelay:
                    '0.2s',
                }}
              />
            </g>
          )}
        </svg>

        {data.latest !== null &&
          state === 'live' && (
            <div
              className="absolute -top-1 -right-1 bg-brand-surface border border-emerald-500/30 rounded-full px-1.5 py-0.5 text-[9px] font-mono font-bold text-emerald-400 leading-none shadow-lg"
              title={`Latest latency: ${data.latest}ms`}
            >
              {data.latest}ms
            </div>
          )}
      </div>

      {/* --------------------------------------------------------------------
       * State label
       * ------------------------------------------------------------------ */}

      <AnimatePresence mode="wait">
        <motion.div
          key={state}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="flex flex-col items-center gap-0.5"
        >
          <p
            className="text-[10px] font-bold uppercase tracking-[0.15em] font-mono"
            style={{
              color: cfg.color,
            }}
          >
            {cfg.label}
          </p>

          <p className="text-[9px] text-brand-text-muted font-mono tracking-wider">
            {!socketConnected &&
            socketReconnectAttempts > 0
              ? `Retrying… attempt ${socketReconnectAttempts}`
              : cfg.sublabel}
          </p>

          {socketTransport && (
            <p className="text-[8px] text-brand-text-muted/60 font-mono uppercase tracking-widest">
              {socketTransport}
            </p>
          )}

          {socketError && (
            <p className="text-[8px] text-red-400 font-mono text-center max-w-[160px] leading-snug mt-1 flex items-center gap-1">
              <AlertTriangle className="w-2.5 h-2.5 flex-shrink-0" />
              {socketError}
            </p>
          )}
        </motion.div>
      </AnimatePresence>

      {/* --------------------------------------------------------------------
       * Telemetry
       * ------------------------------------------------------------------ */}

      <AnimatePresence>
        {data.count >= 2 && (
          <motion.div
            initial={{
              opacity: 0,
              height: 0,
            }}
            animate={{
              opacity: 1,
              height: 'auto',
            }}
            exit={{
              opacity: 0,
              height: 0,
            }}
            className="flex flex-col items-center gap-1"
          >
            <Sparkline
              history={latencyHistory}
              color={cfg.color}
              id={uniqueId}
            />

            <div className="flex items-center gap-2 text-[8px] font-mono text-brand-text-muted/50">
              {data.average !== null && (
                <span>
                  AVG {data.average}ms
                </span>
              )}

              {data.jitter !== null && (
                <span>
                  JIT {data.jitter}ms
                </span>
              )}
            </div>

            <p className="text-[8px] text-brand-text-muted/40 font-mono uppercase tracking-widest">
              Last {Math.min(data.count, 30)} pings
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

/* ============================================================================
 * Badge
 * ========================================================================== */

const PILL_COLOR: Record<OrbState, string> = {
  live:
    'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',

  partial:
    'bg-amber-500/10 text-amber-400 border-amber-500/30',

  offline:
    'bg-red-500/10 text-red-400 border-red-500/30',

  connecting:
    'bg-violet-500/10 text-violet-400 border-violet-500/30',
};

export interface ConnectionBadgeProps {
  socketConnected: boolean;

  isUsingLiveBackendData: boolean;

  socketError?: string | null;

  socketReconnectAttempts?: number;

  socketTransport?:
    | 'polling'
    | 'websocket'
    | null;

  latencyHistory?: number[];
}

export const ConnectionBadge = memo(function ConnectionBadge({
  socketConnected,
  isUsingLiveBackendData,
  socketError = null,
  socketReconnectAttempts = 0,
  socketTransport = null,
  latencyHistory = [],
}: ConnectionBadgeProps) {
  const [booting, setBooting] = useState(true);
  const [isOpen, setIsOpen] = useState(false);

  const wrapperRef =
    useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setBooting(false);
    }, 2500);

    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (
        wrapperRef.current &&
        !wrapperRef.current.contains(
          event.target as Node,
        )
      ) {
        setIsOpen(false);
      }
    };

    document.addEventListener(
      'mousedown',
      handler,
    );

    return () => {
      document.removeEventListener(
        'mousedown',
        handler,
      );
    };
  }, []);

  const state = deriveState(
    socketConnected,
    isUsingLiveBackendData,
    booting,
    socketReconnectAttempts,
  );

  const history = latencyHistory.slice(-30);

  const latest =
    history.length > 0
      ? history[history.length - 1]
      : null;

  const average =
    calculateAverage(history);

  const jitter =
    calculateJitter(history);

  const stability =
    calculateStability(history);

  const isRetrying =
    !socketConnected &&
    !booting &&
    socketReconnectAttempts > 0;

  const hasIssue =
    !!socketError ||
    isRetrying ||
    state === 'partial' ||
    state === 'offline';

  const handleToggle = () => {
    if (hasIssue) {
      setIsOpen((value) => !value);
    }
  };

  return (
    <div
      className="relative"
      ref={wrapperRef}
    >
      <button
        type="button"
        onClick={handleToggle}
        aria-expanded={
          hasIssue ? isOpen : undefined
        }
        aria-haspopup={
          hasIssue ? 'dialog' : undefined
        }
        aria-label={
          hasIssue
            ? `Connection status: ${CFG[state].label}. Open diagnostics.`
            : `Connection status: ${CFG[state].label}`
        }
        className={cn(
          'px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider flex items-center border gap-2 transition-all',
          PILL_COLOR[state],
          hasIssue &&
            'cursor-pointer hover:brightness-110',
          !hasIssue &&
            'cursor-default',
        )}
      >
        <ConnectionOrb
          socketConnected={
            socketConnected
          }
          isUsingLiveBackendData={
            isUsingLiveBackendData
          }
          compact
          socketError={socketError}
          socketReconnectAttempts={
            socketReconnectAttempts
          }
          socketTransport={
            socketTransport
          }
        />

        <span className="whitespace-nowrap">
          {isRetrying
            ? `Reconnecting (${socketReconnectAttempts})`
            : CFG[state].label}
        </span>

        {hasIssue && (
          <span
            className={
              isRetrying
                ? 'animate-spin'
                : undefined
            }
            style={
              isRetrying
                ? {
                    animationDuration:
                      '1.4s',
                  }
                : undefined
            }
          >
            {isRetrying ? (
              <RotateCw className="w-3 h-3" />
            ) : (
              <AlertTriangle className="w-3 h-3" />
            )}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && hasIssue && (
          <motion.div
            role="dialog"
            aria-label="Connection diagnostics"
            initial={{
              opacity: 0,
              y: -4,
              scale: 0.98,
            }}
            animate={{
              opacity: 1,
              y: 0,
              scale: 1,
            }}
            exit={{
              opacity: 0,
              y: -4,
              scale: 0.98,
            }}
            className="absolute left-0 mt-2 w-80 bg-brand-surface/95 backdrop-blur-xl border border-brand-border/50 rounded-2xl shadow-2xl p-4 z-50 font-mono"
          >
            {/* Header */}

            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Activity
                  className={cn(
                    'w-4 h-4',
                    state === 'offline'
                      ? 'text-red-400'
                      : state === 'partial'
                        ? 'text-amber-400'
                        : 'text-violet-400',
                  )}
                />

                <h3 className="text-xs font-bold uppercase text-white">
                  Connection Diagnostics
                </h3>
              </div>

              <span
                className="w-2 h-2 rounded-full animate-pulse"
                style={{
                  backgroundColor:
                    CFG[state].color,
                  boxShadow:
                    `0 0 8px ${CFG[state].color}`,
                }}
              />
            </div>

            {/* Health */}

            <div className="grid grid-cols-2 gap-2 mb-4">
              <div className="rounded-xl border border-brand-border/40 bg-black/10 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Wifi className="w-3 h-3 text-brand-text-muted" />
                  <span className="text-[9px] text-brand-text-muted uppercase">
                    Socket
                  </span>
                </div>

                <span
                  className={cn(
                    'text-[10px] font-bold',
                    socketConnected
                      ? 'text-emerald-400'
                      : 'text-red-400',
                  )}
                >
                  {socketConnected
                    ? 'CONNECTED'
                    : 'DISCONNECTED'}
                </span>
              </div>

              <div className="rounded-xl border border-brand-border/40 bg-black/10 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <Server className="w-3 h-3 text-brand-text-muted" />
                  <span className="text-[9px] text-brand-text-muted uppercase">
                    Backend
                  </span>
                </div>

                <span
                  className={cn(
                    'text-[10px] font-bold',
                    isUsingLiveBackendData
                      ? 'text-emerald-400'
                      : 'text-red-400',
                  )}
                >
                  {isUsingLiveBackendData
                    ? 'HEALTHY'
                    : 'UNAVAILABLE'}
                </span>
              </div>
            </div>

            {/* Metrics */}

            <div className="space-y-2 text-[10px]">
              <div className="flex justify-between">
                <span className="text-brand-text-muted">
                  Transport
                </span>

                <span className="text-white">
                  {socketTransport || '—'}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-brand-text-muted">
                  Latest latency
                </span>

                <span className="text-white">
                  {latest !== null
                    ? `${latest}ms`
                    : '—'}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-brand-text-muted">
                  Average latency
                </span>

                <span className="text-white">
                  {average !== null
                    ? `${average}ms`
                    : '—'}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-brand-text-muted">
                  Jitter
                </span>

                <span className="text-white">
                  {jitter !== null
                    ? `${jitter}ms`
                    : '—'}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-brand-text-muted">
                  Stability
                </span>

                <span
                  className={cn(
                    'font-bold',
                    stability === null
                      ? 'text-white'
                      : stability >= 95
                        ? 'text-emerald-400'
                        : stability >= 80
                          ? 'text-amber-400'
                          : 'text-red-400',
                  )}
                >
                  {stability !== null
                    ? `${stability}%`
                    : '—'}
                </span>
              </div>

              <div className="flex justify-between">
                <span className="text-brand-text-muted">
                  Reconnect attempts
                </span>

                <span className="text-white tabular-nums">
                  {socketReconnectAttempts}
                </span>
              </div>
            </div>

            {/* Error */}

            {socketError && (
              <div className="mt-3 px-3 py-2 bg-red-500/5 border border-red-500/20 rounded-lg text-[10px] text-red-400 leading-relaxed break-words">
                {socketError}
              </div>
            )}

            <p className="mt-4 text-[9px] text-brand-text-muted leading-relaxed">
              {state === 'offline'
                ? 'The real-time uplink is unavailable. Check the backend service, WebSocket endpoint, and authentication configuration.'
                : state === 'partial'
                  ? 'The platform is reachable, but one or more real-time services are degraded.'
                  : 'Real-time communication is operating normally.'}
            </p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});
