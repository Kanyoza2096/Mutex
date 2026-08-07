// ═══════════════════════════════════════════════════════════════════════════
// KANYOZA META ENGINE — THE OVERSEER
// ═══════════════════════════════════════════════════════════════════════════
//
// Autonomous system intelligence / observability console.
//
// Designed for the Kanyoza MetaEngine backend.
//
// Supported backend endpoints:
//   GET  /meta/status
//   GET  /meta/engines
//   GET  /meta/engines/:engine
//   GET  /meta/diagnoses
//   GET  /meta/dependency-graph
//   GET  /meta/snapshots
//   GET  /meta/healing-history
//   POST /meta/diagnose
//   POST /meta/heal
//   POST /meta/engines/:engine/restart
//   POST /meta/engines/:engine/recover
//
// Also understands the simpler endpoints exposed by the current Python
// MetaEngine:
//   GET /meta/status
//   GET /meta/engines/:engine
//   GET /meta/dependency-graph
//
// Single-file implementation.
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { motion, AnimatePresence } from "motion/react";

import {
  Activity,
  AlertCircle,
  AlertTriangle,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Brain,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  CircleDot,
  Clock3,
  Cpu,
  Database,
  Download,
  ExternalLink,
  Eye,
  GitBranch,
  HardDrive,
  HeartPulse,
  History,
  Info,
  Layers,
  Loader2,
  Maximize2,
  MemoryStick,
  Network,
  Pause,
  Play,
  RefreshCw,
  RotateCcw,
  Search,
  Server,
  Shield,
  Sparkles,
  Terminal,
  Timer,
  TrendingDown,
  TrendingUp,
  TriangleAlert,
  Wrench,
  X,
  Zap,
} from "lucide-react";

import { cn, vibrate } from "../lib/utils";
import { useStore } from "../store/useStore";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type EngineStatus =
  | "nominal"
  | "degraded"
  | "stale"
  | "offline"
  | "unknown";

type AlertLevel =
  | "info"
  | "warning"
  | "critical";

type Tab =
  | "overview"
  | "engines"
  | "diagnoses"
  | "graph"
  | "healing"
  | "history";

interface EngineHealth {
  name: string;
  status: EngineStatus;

  last_active?: string | null;

  error_count_1h: number;
  error_count_24h?: number;
  success_count_1h?: number;

  throughput_1h: number;
  avg_latency_ms: number;

  queue_depth?: number;
  memory_mb?: number;

  dependencies: string[];
  dependents: string[];

  restart_count?: number;
  last_restart?: string | null;

  version?: string;
}

interface Diagnosis {
  id: string;
  engine: string;
  symptom: string;
  root_cause: string;
  severity: AlertLevel;

  affected_engines: string[];

  recommended_action: string;

  auto_fixable: boolean;

  detected_at: string;
  resolved_at?: string | null;
}

interface Snapshot {
  timestamp: string;
  overall: EngineStatus;
  uptime_hours?: number;
  uptime_seconds?: number;

  engines?: Record<string, EngineHealth>;

  active_alerts: number;
  critical_alerts: number;
}

interface HealingEvent {
  id?: string;
  engine: string;
  action?: string;
  diagnosis?: string;
  status?: "success" | "failed" | "running";
  success?: boolean;

  executed_at?: string;
  timestamp?: string;

  message?: string;
}

interface MetaStatus {
  timestamp: string;

  overall:
    | EngineStatus
    | string;

  uptime_hours?: number;

  engines: Record<
    string,
    EngineHealth | {
      status: EngineStatus;
      error_rate_1h: number;
      throughput_1h: number;
      avg_latency_ms: number;
      dependents: string[];
    }
  >;

  active_diagnoses: number;
  critical_alerts: number;
}

interface DependencyGraph {
  edges: Record<string, string[]>;
  reverse: Record<string, string[]>;
  leaf_nodes: string[];
  root_nodes: string[];
}

interface ActivityEvent {
  id: string;
  type:
    | "status"
    | "diagnosis"
    | "healing"
    | "alert"
    | "refresh";

  engine?: string;

  title: string;
  message: string;

  severity?: AlertLevel;

  timestamp: string;
}

interface EngineDetail {
  engine: string;

  current: {
    status: EngineStatus;

    error_count_1h: number;
    error_count_24h?: number;

    success_count_1h?: number;

    throughput_1h: number;

    avg_latency_ms: number;
  };

  dependencies: string[];
  dependents: string[];

  history: Array<{
    status: EngineStatus;
    errors: number;
    timestamp?: string | null;
  }>;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const REFRESH_INTERVAL = 15_000;

const STATUS_META: Record<
  EngineStatus,
  {
    label: string;
    description: string;
    icon: React.ComponentType<{ className?: string }>;
  }
> = {
  nominal: {
    label: "NOMINAL",
    description: "Operating normally",
    icon: CheckCircle2,
  },

  degraded: {
    label: "DEGRADED",
    description: "Performance or reliability reduced",
    icon: TriangleAlert,
  },

  stale: {
    label: "STALE",
    description: "No recent activity detected",
    icon: Clock3,
  },

  offline: {
    label: "OFFLINE",
    description: "Engine is unavailable",
    icon: X,
  },

  unknown: {
    label: "UNKNOWN",
    description: "Health state unavailable",
    icon: CircleDot,
  },
};

const ENGINE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  content_engine: Layers,
  card_renderer: Sparkles,
  condition_engine: GitBranch,
  engagement_tracker: TrendingUp,
  email_service: Activity,
  guardian: Shield,
  ai_orchestrator: Brain,
  scheduler: Timer,
  job_service: Server,
  health_monitor: HeartPulse,
  plugin_registry: Network,
  event_bus: Zap,
  render_queue: Activity,
  image_engine: Sparkles,
  topic_selector: Brain,
  prompt_builder: Terminal,
  meta_engine: Cpu,
  supabase: Database,
  gemini: Brain,
  facebook_plugin: Network,
  twitter_plugin: Network,
  github: GitBranch,
};

const FALLBACK_ENGINES: EngineHealth[] = [
  {
    name: "meta_engine",
    status: "nominal",
    error_count_1h: 0,
    error_count_24h: 0,
    success_count_1h: 0,
    throughput_1h: 0,
    avg_latency_ms: 0,
    dependencies: [],
    dependents: [],
    version: "1.0",
  },
];

const FALLBACK_GRAPH: DependencyGraph = {
  edges: {
    content_engine: [
      "ai_orchestrator",
      "prompt_builder",
      "topic_selector",
    ],

    condition_engine: [
      "event_bus",
      "engagement_tracker",
    ],

    engagement_tracker: [
      "supabase",
      "facebook_plugin",
    ],

    ai_orchestrator: [
      "gemini",
    ],

    scheduler: [
      "job_service",
      "content_engine",
    ],

    job_service: [
      "supabase",
    ],

    guardian: [
      "github",
    ],

    render_queue: [
      "card_renderer",
      "supabase",
    ],

    topic_selector: [
      "supabase",
    ],

    plugin_registry: [
      "facebook_plugin",
      "twitter_plugin",
    ],

    meta_engine: [],
  },

  reverse: {},

  leaf_nodes: [
    "meta_engine",
  ],

  root_nodes: [
    "content_engine",
    "condition_engine",
    "scheduler",
    "guardian",
    "render_queue",
    "plugin_registry",
    "meta_engine",
  ],
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getRestEndpoint(): string {
  try {
    const fromStore = useStore.getState().restEndpoint;
    if (fromStore) return fromStore.replace(/\/+$/, '');
  } catch {}
  return (
    (window as any).__REST_ENDPOINT__ ||
    localStorage.getItem("rest_endpoint") ||
    ""
  ).replace(/\/+$/, "");
}

function getToken(): string {
  try {
    const fromStore = useStore.getState().masterToken;
    if (fromStore) return fromStore;
  } catch {}
  return (
    localStorage.getItem("master_token") ||
    localStorage.getItem("access_token") ||
    ""
  );
}

function apiUrl(path: string): string {
  const base = getRestEndpoint();

  if (!base) {
    return "";
  }

  return `${base}${path.startsWith("/") ? path : `/${path}`}`;
}

async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const base = getRestEndpoint();
  if (!base) {
    throw new Error('API endpoint is not configured. Please set the REST Base URL in System Config.');
  }

  const token = getToken();

  const headers: Record<string, string> = {
    Accept: "application/json",
    ...(options.body
      ? { "Content-Type": "application/json" }
      : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers || {}) as Record<string, string>),
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(apiUrl(path), {
    ...options,
    headers,
  });

  if (!response.ok) {
    let message = `HTTP ${response.status}`;

    try {
      const body = await response.json();

      message =
        body?.detail ||
        body?.message ||
        body?.error ||
        message;
    } catch {
      // Ignore malformed response.
    }

    throw new Error(message);
  }

  return response.json();
}

function isAbortError(error: unknown): boolean {
  return (
    (error instanceof DOMException && error.name === "AbortError") ||
    (error instanceof Error && error.name === "AbortError")
  );
}

function safeDate(value?: string | null): Date | null {
  if (!value) return null;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
}

function relativeTime(value?: string | null): string {
  const date = safeDate(value);

  if (!date) {
    return "—";
  }

  const seconds =
    Math.max(0, Date.now() - date.getTime()) / 1000;

  if (seconds < 5) return "just now";

  if (seconds < 60) {
    return `${Math.floor(seconds)}s ago`;
  }

  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ago`;
  }

  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h ago`;
  }

  return `${Math.floor(seconds / 86400)}d ago`;
}

function formatUptime(hours = 0): string {
  if (hours < 1) {
    return `${Math.round(hours * 60)}m`;
  }

  const days = Math.floor(hours / 24);
  const remainingHours = Math.floor(hours % 24);

  if (days > 0) {
    return `${days}d ${remainingHours}h`;
  }

  return `${Math.floor(hours)}h ${Math.round((hours % 1) * 60)}m`;
}

function engineIcon(name: string): React.ComponentType<{ className?: string }> {
  return (
    ENGINE_ICONS[name] ||
    Cpu
  );
}

function normalizeStatus(
  value: any,
): EngineStatus {
  const status = String(value || "unknown").toLowerCase();

  if (
    status === "healthy" ||
    status === "ok"
  ) {
    return "nominal";
  }

  if (
    status === "nominal" ||
    status === "degraded" ||
    status === "stale" ||
    status === "offline"
  ) {
    return status;
  }

  return "unknown";
}

function statusClasses(
  status: EngineStatus,
): string {
  switch (status) {
    case "nominal":
      return "text-emerald-400 bg-emerald-500/10 border-emerald-500/20";

    case "degraded":
      return "text-amber-400 bg-amber-500/10 border-amber-500/20";

    case "stale":
      return "text-orange-400 bg-orange-500/10 border-orange-500/20";

    case "offline":
      return "text-red-400 bg-red-500/10 border-red-500/20";

    default:
      return "text-brand-text-secondary bg-brand-text-muted/10 border-brand-border";
  }
}

function statusDotClasses(
  status: EngineStatus,
): string {
  switch (status) {
    case "nominal":
      return "bg-emerald-400";

    case "degraded":
      return "bg-amber-400";

    case "stale":
      return "bg-orange-400";

    case "offline":
      return "bg-red-400";

    default:
      return "bg-brand-text-muted";
  }
}

function severityClasses(
  severity: AlertLevel,
): string {
  switch (severity) {
    case "critical":
      return "text-red-400 bg-red-500/10 border-red-500/20";

    case "warning":
      return "text-amber-400 bg-amber-500/10 border-amber-500/20";

    default:
      return "text-blue-400 bg-blue-500/10 border-blue-500/20";
  }
}

function finiteNumber(
  value: unknown,
  fallback = 0,
): number {
  const number = Number(value);
  return Number.isFinite(number)
    ? number
    : fallback;
}

function normalizeEngine(
  name: string,
  value: any,
): EngineHealth {
  return {
    name,

    status: normalizeStatus(value?.status),

    last_active:
      value?.last_active ??
      value?.last_activity ??
      null,

    error_count_1h:
      Number(
        value?.error_count_1h ??
        value?.errors_1h ??
        0,
      ),

    error_count_24h:
      Number(
        value?.error_count_24h ??
        value?.errors_24h ??
        0,
      ),

    success_count_1h:
      Number(
        value?.success_count_1h ??
        value?.successes_1h ??
        0,
      ),

    throughput_1h:
      Number(
        value?.throughput_1h ??
        value?.throughput ??
        0,
      ),

    avg_latency_ms:
      Number(
        value?.avg_latency_ms ??
        value?.latency_ms ??
        0,
      ),

    queue_depth:
      finiteNumber(value?.queue_depth),

    memory_mb:
      finiteNumber(value?.memory_mb),

    dependencies:
      Array.isArray(value?.dependencies)
        ? value.dependencies
        : [],

    dependents:
      Array.isArray(value?.dependents)
        ? value.dependents
        : [],

    restart_count:
      finiteNumber(value?.restart_count),

    last_restart:
      value?.last_restart ??
      null,

    version:
      String(value?.version ?? ""),
  };
}

function normalizeGraph(
  data: any,
): DependencyGraph {
  const rawEdges =
    data?.edges ||
    data?.graph ||
    {};

  const rawReverse =
    data?.reverse ||
    {};

  const edges: Record<string, string[]> =
    rawEdges &&
    typeof rawEdges === "object" &&
    !Array.isArray(rawEdges)
      ? Object.fromEntries(
          Object.entries(rawEdges).map(
            ([name, deps]) => [
              name,
              Array.isArray(deps)
                ? deps.map(String)
                : [],
            ],
          ),
        )
      : {};

  const reverse: Record<string, string[]> =
    rawReverse &&
    typeof rawReverse === "object" &&
    !Array.isArray(rawReverse)
      ? Object.fromEntries(
          Object.entries(rawReverse).map(
            ([name, deps]) => [
              name,
              Array.isArray(deps)
                ? deps.map(String)
                : [],
            ],
          ),
        )
      : {};

  return {
    edges,
    reverse,

    leaf_nodes:
      Array.isArray(data?.leaf_nodes)
        ? data.leaf_nodes
        : Object.keys(edges).filter(
            name =>
              !edges[name] ||
              edges[name].length === 0,
          ),

    root_nodes:
      Array.isArray(data?.root_nodes)
        ? data.root_nodes
        : Object.keys(edges).filter(
            name =>
              !Object.values(edges).some(
                deps =>
                  Array.isArray(deps) &&
                  deps.includes(name),
              ),
          ),
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// SMALL UI COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function GlassCard({
  children,
  className,
  onClick,
}: {
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className={cn(
        "rounded-2xl border border-brand-border",
        "bg-brand-surface/80 backdrop-blur-xl",
        "shadow-[0_20px_60px_rgba(0,0,0,0.18)]",
        className,
      )}
    >
      {children}
    </div>
  );
}

function StatusBadge({
  status,
}: {
  status: EngineStatus;
}) {
  const meta = STATUS_META[status];
  const Icon = meta.icon;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5",
        "px-2 py-1 rounded-lg border",
        "text-[11px] font-mono font-bold",
        "tracking-wider",
        statusClasses(status),
      )}
    >
      <Icon className="w-3 h-3" />
      {meta.label}
    </span>
  );
}

function MiniSparkline({
  values,
  height = 34,
}: {
  values: number[];
  height?: number;
}) {
  if (!values.length) {
    return (
      <div
        className="w-full flex items-center"
        style={{ height }}
      >
        <div className="h-px bg-brand-elevated w-full" />
      </div>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values
    .map((value, index) => {
      const x =
        values.length === 1
          ? 0
          : (index / (values.length - 1)) * 100;

      const y =
        100 -
        ((value - min) / range) * 80 -
        10;

      return `${x},${y}`;
    })
    .join(" ");

  return (
    <svg
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
      className="w-full"
      style={{ height }}
    >
      <polyline
        points={points}
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        vectorEffect="non-scaling-stroke"
      />
    </svg>
  );
}

function MetricCard({
  label,
  value,
  sub,
  icon: Icon,
  trend,
  onClick,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon: React.ComponentType<{ className?: string }>;
  trend?: "up" | "down" | "neutral";
  onClick?: () => void;
}) {
  return (
    <GlassCard
      onClick={onClick}
      className={cn(
        "p-4",
        onClick &&
          "cursor-pointer hover:border-indigo-500/30 transition-colors",
      )}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-[11px] uppercase tracking-[0.18em] font-mono text-brand-text-muted">
            {label}
          </p>

          <div className="flex items-end gap-2 mt-2">
            <span className="text-2xl font-bold text-brand-text font-mono tracking-tight">
              {value}
            </span>

            {trend && (
              <span
                className={cn(
                  "mb-1",
                  trend === "up"
                    ? "text-emerald-400"
                    : trend === "down"
                    ? "text-red-400"
                    : "text-brand-text-muted",
                )}
              >
                {trend === "up" ? (
                  <TrendingUp className="w-3.5 h-3.5" />
                ) : trend === "down" ? (
                  <TrendingDown className="w-3.5 h-3.5" />
                ) : (
                  <ArrowRight className="w-3.5 h-3.5" />
                )}
              </span>
            )}
          </div>

          {sub && (
            <p className="text-[12px] text-brand-text-muted font-mono mt-1">
              {sub}
            </p>
          )}
        </div>

        <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/15">
          <Icon className="w-4 h-4 text-indigo-400" />
        </div>
      </div>
    </GlassCard>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between gap-3 mb-3">
      <div className="flex items-center gap-2">
        <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
          <Icon className="w-3.5 h-3.5 text-indigo-400" />
        </div>

        <div>
          <h2 className="text-[13px] font-mono font-bold uppercase tracking-[0.14em] text-brand-text-secondary">
            {title}
          </h2>

          {subtitle && (
            <p className="text-[11px] font-mono text-brand-text-muted/80 mt-0.5">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {action}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="py-16 flex flex-col items-center justify-center text-center">
      <div className="p-4 rounded-2xl bg-brand-elevated border border-brand-border">
        <Icon className="w-6 h-6 text-brand-text-muted/80" />
      </div>

      <p className="text-[13px] font-mono font-bold uppercase text-brand-text-muted mt-4">
        {title}
      </p>

      <p className="text-[12px] font-mono text-brand-text-muted/80 max-w-sm mt-1">
        {description}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE ROW
// ═══════════════════════════════════════════════════════════════════════════

function EngineRow({
  engine,
  selected,
  onSelect,
}: {
  engine: EngineHealth;
  selected: boolean;
  onSelect: () => void;
}) {
  const Icon = engineIcon(engine.name);

  const total =
    engine.error_count_1h +
    (engine.success_count_1h || 0);

  const errorRate =
    total > 0
      ? engine.error_count_1h / total
      : 0;

  return (
    <motion.button
      layout
      onClick={onSelect}
      className={cn(
        "w-full text-left p-3 rounded-xl border",
        "transition-all",
        selected
          ? "bg-indigo-500/10 border-indigo-500/30"
          : "bg-brand-bg/60 border-brand-border hover:border-brand-border",
      )}
    >
      <div className="flex items-center gap-3">
        <div className="relative">
          <div className="p-2 rounded-xl bg-brand-elevated border border-brand-border">
            <Icon className="w-4 h-4 text-brand-text-secondary" />
          </div>

          <span
            className={cn(
              "absolute -right-0.5 -bottom-0.5",
              "w-2 h-2 rounded-full",
              "border-2 border-brand-surface",
              statusDotClasses(engine.status),
              engine.status === "nominal" &&
                "animate-pulse",
            )}
          />
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="text-[14px] font-mono font-bold text-brand-text truncate">
              {engine.name}
            </span>

            <StatusBadge status={engine.status} />
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1 mt-2">
            <span className="text-[11px] font-mono text-brand-text-muted">
              ERR{" "}
              <span className="text-brand-text-secondary">
                {engine.error_count_1h}
              </span>
            </span>

            <span className="text-[11px] font-mono text-brand-text-muted">
              LAT{" "}
              <span className="text-brand-text-secondary">
                {engine.avg_latency_ms.toFixed(0)}ms
              </span>
            </span>

            <span className="text-[11px] font-mono text-brand-text-muted">
              TPS{" "}
              <span className="text-brand-text-secondary">
                {engine.throughput_1h.toFixed(2)}
              </span>
            </span>

            <span className="text-[11px] font-mono text-brand-text-muted">
              DEP{" "}
              <span className="text-brand-text-secondary">
                {engine.dependencies.length}
              </span>
            </span>
          </div>
        </div>

        <div className="hidden md:block w-24">
          <div className="flex justify-between text-[10px] font-mono text-brand-text-muted/80 mb-1">
            <span>ERROR RATE</span>
            <span>
              {(errorRate * 100).toFixed(1)}%
            </span>
          </div>

          <div className="h-1 rounded-full bg-brand-elevated overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: `${Math.min(
                  100,
                  errorRate * 100,
                )}%`,
              }}
              className={cn(
                "h-full rounded-full",
                errorRate > 0.5
                  ? "bg-red-400"
                  : errorRate > 0.1
                  ? "bg-amber-400"
                  : "bg-emerald-400",
              )}
            />
          </div>
        </div>

        <ChevronRight className="w-4 h-4 text-brand-text-muted/80" />
      </div>
    </motion.button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ENGINE DETAIL PANEL
// ═══════════════════════════════════════════════════════════════════════════

function EngineDetailPanel({
  engine,
  detail,
  loading,
  onClose,
  onRefresh,
  onDiagnose,
  onHeal,
  onRestart,
}: {
  engine: EngineHealth;
  detail: EngineDetail | null;
  loading: boolean;
  onClose: () => void;
  onRefresh: () => void;
  onDiagnose: () => void;
  onHeal: () => void;
  onRestart: () => void;
}) {
  const Icon = engineIcon(engine.name);

  const current =
    detail?.current || {
      status: engine.status,
      error_count_1h: engine.error_count_1h,
      error_count_24h: engine.error_count_24h,
      success_count_1h: engine.success_count_1h,
      throughput_1h: engine.throughput_1h,
      avg_latency_ms: engine.avg_latency_ms,
    };

  const history =
    detail?.history || [];

  return (
    <AnimatePresence>
      <motion.div
        initial={{
          opacity: 0,
          x: 40,
        }}
        animate={{
          opacity: 1,
          x: 0,
        }}
        exit={{
          opacity: 0,
          x: 40,
        }}
        className="fixed inset-y-0 right-0 z-50 w-full max-w-md bg-brand-surface border-l border-brand-border shadow-2xl overflow-y-auto"
      >
        <div className="sticky top-0 z-10 bg-brand-surface/95 backdrop-blur-xl border-b border-brand-border">
          <div className="p-4 flex items-center gap-3">
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-brand-elevated text-brand-text-muted"
            >
              <X className="w-4 h-4" />
            </button>

            <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/20">
              <Icon className="w-4 h-4 text-indigo-400" />
            </div>

            <div className="flex-1 min-w-0">
              <h2 className="text-sm font-bold font-mono text-brand-text truncate">
                {engine.name}
              </h2>

              <p className="text-[11px] font-mono text-brand-text-muted uppercase">
                Engine diagnostics
              </p>
            </div>

            <button
              onClick={onRefresh}
              className="p-2 rounded-lg text-brand-text-muted hover:text-brand-text-secondary hover:bg-brand-elevated"
            >
              <RefreshCw
                className={cn(
                  "w-4 h-4",
                  loading && "animate-spin",
                )}
              />
            </button>
          </div>
        </div>

        <div className="p-4 space-y-4">
          <div className="flex items-center justify-between">
            <StatusBadge
              status={normalizeStatus(current.status)}
            />

            {engine.version && (
              <span className="text-[11px] font-mono text-brand-text-muted/80">
                v{engine.version}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <MetricCard
              label="Errors / 1h"
              value={current.error_count_1h}
              icon={AlertTriangle}
            />

            <MetricCard
              label="Success / 1h"
              value={current.success_count_1h || 0}
              icon={CheckCircle2}
            />

            <MetricCard
              label="Throughput"
              value={current.throughput_1h.toFixed(2)}
              sub="ops/sec"
              icon={Activity}
            />

            <MetricCard
              label="Latency"
              value={`${current.avg_latency_ms.toFixed(0)}ms`}
              icon={Timer}
            />
          </div>

          <GlassCard className="p-4">
            <SectionHeader
              icon={GitBranch}
              title="Dependency topology"
            />

            <div className="space-y-2">
              <p className="text-[11px] uppercase font-mono text-brand-text-muted/80">
                Depends on
              </p>

              {engine.dependencies.length === 0 ? (
                <span className="text-[12px] font-mono text-brand-text-muted">
                  No upstream dependencies
                </span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {engine.dependencies.map(dep => (
                    <span
                      key={dep}
                      className="px-2 py-1 rounded-lg bg-brand-elevated border border-brand-border text-[11px] font-mono text-brand-text-secondary"
                    >
                      {dep}
                    </span>
                  ))}
                </div>
              )}

              <p className="text-[11px] uppercase font-mono text-brand-text-muted/80 pt-2">
                Dependents
              </p>

              {engine.dependents.length === 0 ? (
                <span className="text-[12px] font-mono text-brand-text-muted">
                  No downstream dependents
                </span>
              ) : (
                <div className="flex flex-wrap gap-1.5">
                  {engine.dependents.map(dep => (
                    <span
                      key={dep}
                      className="px-2 py-1 rounded-lg bg-indigo-500/5 border border-indigo-500/15 text-[11px] font-mono text-indigo-300"
                    >
                      {dep}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </GlassCard>

          <GlassCard className="p-4">
            <SectionHeader
              icon={Activity}
              title="Health history"
              subtitle="Recent engine health snapshots"
            />

            {history.length === 0 ? (
              <EmptyState
                icon={Activity}
                title="No historical data"
                description="The backend has not supplied health snapshots for this engine."
              />
            ) : (
              <div className="space-y-1">
                {history.map((point, index) => (
                  <div
                    key={`${point.timestamp}-${index}`}
                    className="flex items-center gap-2 py-1.5"
                  >
                    <span
                      className={cn(
                        "w-1.5 h-1.5 rounded-full",
                        statusDotClasses(
                          normalizeStatus(
                            point.status,
                          ),
                        ),
                      )}
                    />

                    <span className="text-[11px] font-mono text-brand-text-muted">
                      {point.timestamp
                        ? relativeTime(
                            point.timestamp,
                          )
                        : "—"}
                    </span>

                    <span className="ml-auto text-[11px] font-mono text-brand-text-muted/80">
                      {point.errors} errors
                    </span>
                  </div>
                ))}
              </div>
            )}
          </GlassCard>

          <div className="grid grid-cols-3 gap-2">
            <button
              onClick={onDiagnose}
              className="py-2.5 rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-400 text-[11px] font-mono font-bold uppercase hover:bg-indigo-500/20"
            >
              <Brain className="w-3.5 h-3.5 mx-auto mb-1" />
              Diagnose
            </button>

            <button
              onClick={onHeal}
              className="py-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-[11px] font-mono font-bold uppercase hover:bg-emerald-500/20"
            >
              <Wrench className="w-3.5 h-3.5 mx-auto mb-1" />
              Heal
            </button>

            <button
              onClick={onRestart}
              className="py-2.5 rounded-xl border border-amber-500/20 bg-amber-500/10 text-amber-400 text-[11px] font-mono font-bold uppercase hover:bg-amber-500/20"
            >
              <RotateCcw className="w-3.5 h-3.5 mx-auto mb-1" />
              Restart
            </button>
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DIAGNOSIS CARD
// ═══════════════════════════════════════════════════════════════════════════

function DiagnosisCard({
  diagnosis,
  onHeal,
  onInspect,
}: {
  diagnosis: Diagnosis;
  onHeal: () => void;
  onInspect: () => void;
}) {
  const unresolved =
    !diagnosis.resolved_at;

  return (
    <motion.div
      layout
      initial={{
        opacity: 0,
        y: 8,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      className="p-4 rounded-2xl border border-brand-border bg-brand-bg/60"
    >
      <div className="flex items-start gap-3">
        <div
          className={cn(
            "p-2 rounded-xl border",
            severityClasses(
              diagnosis.severity,
            ),
          )}
        >
          {diagnosis.severity ===
          "critical" ? (
            <AlertCircle className="w-4 h-4" />
          ) : (
            <AlertTriangle className="w-4 h-4" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[14px] font-mono font-bold text-brand-text">
              {diagnosis.engine}
            </span>

            <span
              className={cn(
                "px-1.5 py-0.5 rounded border text-[10px] font-mono uppercase font-bold",
                severityClasses(
                  diagnosis.severity,
                ),
              )}
            >
              {diagnosis.severity}
            </span>

            {diagnosis.auto_fixable && (
              <span className="px-1.5 py-0.5 rounded border text-[10px] font-mono uppercase font-bold text-emerald-400 bg-emerald-500/10 border-emerald-500/20">
                AUTO-FIXABLE
              </span>
            )}
          </div>

          <p className="text-[13px] text-brand-text-secondary mt-2">
            {diagnosis.symptom}
          </p>

          <div className="mt-3 p-3 rounded-xl bg-brand-elevated/70 border border-brand-border">
            <p className="text-[10px] uppercase tracking-wider font-mono text-brand-text-muted/80">
              Root cause
            </p>

            <p className="text-[12px] font-mono text-brand-text-secondary mt-1">
              {diagnosis.root_cause}
            </p>
          </div>

          <div className="mt-2 p-3 rounded-xl bg-brand-elevated/50 border border-brand-border/40">
            <p className="text-[10px] uppercase tracking-wider font-mono text-brand-text-muted/80">
              Recommended action
            </p>

            <p className="text-[12px] font-mono text-brand-text-muted mt-1">
              {diagnosis.recommended_action}
            </p>
          </div>

          {diagnosis.affected_engines.length > 0 && (
            <div className="mt-3">
              <p className="text-[10px] uppercase tracking-wider font-mono text-brand-text-muted/80 mb-1">
                Affected engines
              </p>

              <div className="flex flex-wrap gap-1">
                {diagnosis.affected_engines.map(
                  engine => (
                    <span
                      key={engine}
                      className="px-1.5 py-0.5 rounded bg-brand-elevated border border-brand-border text-[10px] font-mono text-brand-text-muted"
                    >
                      {engine}
                    </span>
                  ),
                )}
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 mt-4">
            <span className="text-[10px] font-mono text-brand-text-muted/80">
              DETECTED{" "}
              {relativeTime(
                diagnosis.detected_at,
              )}
            </span>

            {diagnosis.resolved_at && (
              <span className="text-[10px] font-mono text-emerald-500">
                RESOLVED{" "}
                {relativeTime(
                  diagnosis.resolved_at,
                )}
              </span>
            )}
          </div>
        </div>

        <div className="flex flex-col gap-1">
          <button
            onClick={onInspect}
            title="Inspect"
            className="p-2 rounded-lg text-brand-text-muted hover:text-brand-text-secondary hover:bg-brand-elevated"
          >
            <Eye className="w-3.5 h-3.5" />
          </button>

          {unresolved &&
            diagnosis.auto_fixable && (
              <button
                onClick={onHeal}
                title="Auto-heal"
                className="p-2 rounded-lg text-emerald-500 hover:bg-emerald-500/10"
              >
                <Wrench className="w-3.5 h-3.5" />
              </button>
            )}
        </div>
      </div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// DEPENDENCY GRAPH
// ═══════════════════════════════════════════════════════════════════════════

function DependencyGraphView({
  graph,
  engines,
  onEngineClick,
}: {
  graph: DependencyGraph;
  engines: EngineHealth[];
  onEngineClick: (name: string) => void;
}) {
  const engineMap = useMemo(
    () =>
      Object.fromEntries(
        engines.map(engine => [
          engine.name,
          engine,
        ]),
      ),
    [engines],
  );

  const allNodes = useMemo(() => {
    const set = new Set<string>();

    Object.keys(graph.edges).forEach(name =>
      set.add(name),
    );

    Object.values(graph.edges).forEach(deps =>
      deps.forEach(dep => set.add(dep)),
    );

    return [...set];
  }, [graph]);

  return (
    <GlassCard className="p-4 overflow-hidden">
      <SectionHeader
        icon={GitBranch}
        title="Dependency Graph"
        subtitle="Runtime engine topology and failure propagation"
      />

      <div className="relative overflow-auto rounded-xl bg-brand-bg border border-brand-border min-h-[480px] p-6">
        <div className="min-w-[800px]">
          <div className="grid grid-cols-4 gap-8 items-start">
            {[
              "root",
              "orchestrator",
              "processing",
              "infrastructure",
            ].map((layer, layerIndex) => {
              const nodes = allNodes.filter(
                node => {
                  const deps =
                    graph.edges[node] ||
                    [];

                  if (layerIndex === 0) {
                    return (
                      deps.length > 0 &&
                      !Object.values(
                        graph.edges,
                      ).some(
                        list =>
                          list.includes(node),
                      )
                    );
                  }

                  if (layerIndex === 1) {
                    return [
                      "ai_orchestrator",
                      "condition_engine",
                      "scheduler",
                      "guardian",
                      "plugin_registry",
                    ].includes(node);
                  }

                  if (layerIndex === 2) {
                    return [
                      "content_engine",
                      "render_queue",
                      "engagement_tracker",
                      "topic_selector",
                      "image_engine",
                      "card_renderer",
                    ].includes(node);
                  }

                  return [
                    "supabase",
                    "gemini",
                    "facebook_plugin",
                    "twitter_plugin",
                    "github",
                    "event_bus",
                  ].includes(node);
                },
              );

              return (
                <div key={layer}>
                  <div className="text-[10px] font-mono uppercase tracking-widest text-brand-text-muted/50 mb-3">
                    {layer}
                  </div>

                  <div className="space-y-2">
                    {nodes.map(node => {
                      const health =
                        engineMap[node];

                      const Icon =
                        engineIcon(node);

                      return (
                        <motion.button
                          key={node}
                          onClick={() =>
                            onEngineClick(node)
                          }
                          whileHover={{
                            scale: 1.02,
                          }}
                          className="w-full text-left p-3 rounded-xl bg-brand-elevated/70 border border-brand-border hover:border-indigo-500/30 transition-all"
                        >
                          <div className="flex items-center gap-2">
                            <Icon className="w-3.5 h-3.5 text-indigo-400" />

                            <span className="text-[11px] font-mono font-bold text-brand-text-secondary truncate">
                              {node}
                            </span>

                            <span
                              className={cn(
                                "ml-auto w-1.5 h-1.5 rounded-full",
                                statusDotClasses(
                                  health?.status ||
                                    "unknown",
                                ),
                              )}
                            />
                          </div>

                          {health && (
                            <div className="mt-2 text-[10px] font-mono text-brand-text-muted/80">
                              {health.dependencies.length} upstream ·{" "}
                              {health.dependents.length} downstream
                            </div>
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>

          <div className="mt-8 pt-5 border-t border-brand-border">
            <div className="flex flex-wrap items-center gap-5">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-400" />
                <span className="text-[10px] font-mono text-brand-text-muted">
                  NOMINAL
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-400" />
                <span className="text-[10px] font-mono text-brand-text-muted">
                  DEGRADED
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-400" />
                <span className="text-[10px] font-mono text-brand-text-muted">
                  OFFLINE
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ACTIVITY STREAM
// ═══════════════════════════════════════════════════════════════════════════

function ActivityStream({
  events,
}: {
  events: ActivityEvent[];
}) {
  return (
    <GlassCard className="p-4">
      <SectionHeader
        icon={Activity}
        title="Live Activity"
        subtitle="Recent Meta Engine events"
      />

      {events.length === 0 ? (
        <EmptyState
          icon={Activity}
          title="No recent activity"
          description="The Overseer has not reported any events yet."
        />
      ) : (
        <div className="space-y-1">
          <AnimatePresence initial={false}>
            {events.slice(0, 12).map(event => (
              <motion.div
                key={event.id}
                initial={{
                  opacity: 0,
                  x: -10,
                }}
                animate={{
                  opacity: 1,
                  x: 0,
                }}
                className="flex items-start gap-2 py-2 border-b border-brand-border last:border-0"
              >
                <div
                  className={cn(
                    "mt-0.5 w-1.5 h-1.5 rounded-full shrink-0",
                    event.severity ===
                      "critical"
                      ? "bg-red-400"
                      : event.severity ===
                        "warning"
                      ? "bg-amber-400"
                      : event.type ===
                        "healing"
                      ? "bg-emerald-400"
                      : "bg-indigo-400",
                  )}
                />

                <div className="min-w-0 flex-1">
                  <div className="flex gap-2">
                    <span className="text-[11px] font-mono font-bold text-brand-text-secondary truncate">
                      {event.title}
                    </span>

                    {event.engine && (
                      <span className="text-[10px] font-mono text-brand-text-muted/80 truncate">
                        {event.engine}
                      </span>
                    )}
                  </div>

                  <p className="text-[11px] font-mono text-brand-text-muted truncate mt-0.5">
                    {event.message}
                  </p>
                </div>

                <span className="text-[10px] font-mono text-brand-text-muted/50 whitespace-nowrap">
                  {relativeTime(
                    event.timestamp,
                  )}
                </span>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      )}
    </GlassCard>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function MetaEngine() {
  const [tab, setTab] =
    useState<Tab>("overview");

  const [status, setStatus] =
    useState<MetaStatus | null>(null);

  const [engines, setEngines] =
    useState<EngineHealth[]>(
      FALLBACK_ENGINES,
    );

  const [graph, setGraph] =
    useState<DependencyGraph>(
      FALLBACK_GRAPH,
    );

  const [diagnoses, setDiagnoses] =
    useState<Diagnosis[]>([]);

  const [healing, setHealing] =
    useState<HealingEvent[]>([]);

  const [snapshots, setSnapshots] =
    useState<Snapshot[]>([]);

  const [events, setEvents] =
    useState<ActivityEvent[]>([]);

  const [selectedEngine, setSelectedEngine] =
    useState<string | null>(null);

  const [selectedDetail, setSelectedDetail] =
    useState<EngineDetail | null>(null);

  const [detailLoading, setDetailLoading] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [search, setSearch] =
    useState("");

  const [engineFilter, setEngineFilter] =
    useState<EngineStatus | "all">(
      "all",
    );

  const [showResolved, setShowResolved] =
    useState(false);

  const [lastUpdated, setLastUpdated] =
    useState<Date | null>(null);

  const [diagnosing, setDiagnosing] =
    useState(false);

  const [healingNow, setHealingNow] =
    useState(false);

  const mountedRef =
    useRef(true);

  const refreshInFlightRef =
    useRef(false);

  const refreshAbortRef =
    useRef<AbortController | null>(null);

  // ═══════════════════════════════════════════════════════════════════════
  // EVENT HELPERS
  // ═══════════════════════════════════════════════════════════════════════

  const pushEvent = useCallback(
    (
      event: Omit<ActivityEvent, "id">,
    ) => {
      setEvents(prev => [
        {
          ...event,
          id: `${Date.now()}-${Math.random()}`,
        },
        ...prev,
      ].slice(0, 50));
    },
    [],
  );

  // ═══════════════════════════════════════════════════════════════════════
  // LOAD STATUS
  // ═══════════════════════════════════════════════════════════════════════

  const loadStatus = useCallback(
    async (
      silent = false,
      signal?: AbortSignal,
    ) => {
      if (!silent) {
        setRefreshing(true);
      }

      try {
        const data =
          await apiFetch<MetaStatus>(
            "/meta/status",
            { signal },
          );

        if (!mountedRef.current) {
          return;
        }

        setStatus(data);

        const normalized =
          Object.entries(
            data.engines || {},
          ).map(
            ([name, value]) =>
              normalizeEngine(
                name,
                value,
              ),
          );

        if (normalized.length) {
          setEngines(normalized);
        }

        setLastUpdated(
          new Date(),
        );

        pushEvent({
          type: "refresh",
          title: "SYSTEM SNAPSHOT",
          message:
            "Meta Engine health state refreshed",
          timestamp:
            new Date().toISOString(),
        });
      } catch (error) {
        if (isAbortError(error)) {
          return;
        }

        console.warn(
          "MetaEngine status unavailable:",
          error,
        );

        if (!silent) {
          toast.error(
            "Unable to reach Meta Engine",
          );
        }
      } finally {
        if (mountedRef.current) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [pushEvent],
  );

  // ═══════════════════════════════════════════════════════════════════════
  // LOAD ENGINES
  // ═══════════════════════════════════════════════════════════════════════

  const loadEngines = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data =
          await apiFetch<any>(
            "/meta/engines",
            { signal },
          );

        const source =
          data?.engines ||
          data?.data ||
          data;

        if (
          source &&
          typeof source === "object"
        ) {
          const normalized =
            Object.entries(
              source,
            ).map(
              ([name, value]) =>
                normalizeEngine(
                  name,
                  value,
                ),
            );

          if (normalized.length) {
            setEngines(normalized);
          }
        }
      } catch {
        // /meta/status already provides
        // engine data in the current backend.
      }
    },
    [],
  );

  // ═══════════════════════════════════════════════════════════════════════
  // LOAD GRAPH
  // ═══════════════════════════════════════════════════════════════════════

  const loadGraph = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data =
          await apiFetch<any>(
            "/meta/dependency-graph",
            { signal },
          );

        if (data) {
          setGraph(
            normalizeGraph(data),
          );
        }
      } catch {
        // Keep fallback graph.
      }
    },
    [],
  );

  // ═══════════════════════════════════════════════════════════════════════
  // LOAD DIAGNOSES
  // ═══════════════════════════════════════════════════════════════════════

  const loadDiagnoses = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data =
          await apiFetch<any>(
            "/meta/diagnoses",
            { signal },
          );

        const list =
          data?.diagnoses ||
          data?.items ||
          [];

        if (Array.isArray(list)) {
          setDiagnoses(list);
        }
      } catch {
        // Current backend can generate
        // diagnoses through POST /meta/diagnose.
      }
    },
    [],
  );

  // ═══════════════════════════════════════════════════════════════════════
  // LOAD HEALING HISTORY
  // ═══════════════════════════════════════════════════════════════════════

  const loadHealing = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data =
          await apiFetch<any>(
            "/meta/healing-history",
            { signal },
          );

        const list =
          data?.history ||
          data?.healing ||
          data?.events ||
          [];

        if (Array.isArray(list)) {
          setHealing(list);
        }
      } catch {
        // Optional endpoint.
      }
    },
    [],
  );

  // ═══════════════════════════════════════════════════════════════════════
  // LOAD SNAPSHOTS
  // ═══════════════════════════════════════════════════════════════════════

  const loadSnapshots = useCallback(
    async (signal?: AbortSignal) => {
      try {
        const data =
          await apiFetch<any>(
            "/meta/snapshots",
            { signal },
          );

        const list =
          data?.snapshots ||
          data?.items ||
          [];

        if (Array.isArray(list)) {
          setSnapshots(list);
        }
      } catch {
        // Optional endpoint.
      }
    },
    [],
  );

  // ═══════════════════════════════════════════════════════════════════════
  // FULL REFRESH
  // ═══════════════════════════════════════════════════════════════════════

  const refreshAll = useCallback(
    async (
      silent = false,
    ) => {
      if (!mountedRef.current || refreshInFlightRef.current) {
        return;
      }

      refreshInFlightRef.current = true;

      const controller = new AbortController();
      refreshAbortRef.current = controller;

      try {
        await Promise.allSettled([
          loadStatus(silent, controller.signal),
          loadEngines(controller.signal),
          loadGraph(controller.signal),
          loadDiagnoses(controller.signal),
          loadHealing(controller.signal),
          loadSnapshots(controller.signal),
        ]);
      } finally {
        if (refreshAbortRef.current === controller) {
          refreshAbortRef.current = null;
        }

        refreshInFlightRef.current = false;
      }
    },
    [
      loadStatus,
      loadEngines,
      loadGraph,
      loadDiagnoses,
      loadHealing,
      loadSnapshots,
    ],
  );

  useEffect(() => {
    mountedRef.current = true;

    refreshAll();

    const interval =
      window.setInterval(
        () => {
          refreshAll(true);
        },
        REFRESH_INTERVAL,
      );

    return () => {
      mountedRef.current = false;
      refreshAbortRef.current?.abort();
      refreshAbortRef.current = null;
      window.clearInterval(
        interval,
      );
    };
  }, [refreshAll]);

  // ═══════════════════════════════════════════════════════════════════════
  // ENGINE DETAIL
  // ═══════════════════════════════════════════════════════════════════════

  const openEngine = useCallback(
    async (name: string) => {
      vibrate(5);

      setSelectedEngine(name);
      setDetailLoading(true);

      try {
        const data =
          await apiFetch<EngineDetail>(
            `/meta/engines/${encodeURIComponent(
              name,
            )}`,
          );

        setSelectedDetail(data);
      } catch {
        const local =
          engines.find(
            engine =>
              engine.name === name,
          );

        if (local) {
          setSelectedDetail({
            engine: name,
            current: {
              status: local.status,
              error_count_1h:
                local.error_count_1h,
              error_count_24h:
                local.error_count_24h,
              success_count_1h:
                local.success_count_1h,
              throughput_1h:
                local.throughput_1h,
              avg_latency_ms:
                local.avg_latency_ms,
            },
            dependencies:
              local.dependencies,
            dependents:
              local.dependents,
            history: [],
          });
        }
      } finally {
        setDetailLoading(false);
      }
    },
    [engines],
  );

  const closeEngine = () => {
    setSelectedEngine(null);
    setSelectedDetail(null);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // DIAGNOSE
  // ═══════════════════════════════════════════════════════════════════════

  const runDiagnosis = useCallback(
    async (
      engineName?: string,
    ) => {
      setDiagnosing(true);
      vibrate(5);

      try {
        const data =
          await apiFetch<any>(
            "/meta/diagnose",
            {
              method: "POST",
              body: JSON.stringify(
                engineName
                  ? {
                      engine:
                        engineName,
                    }
                  : {},
              ),
            },
          );

        const newDiagnoses =
          data?.diagnoses ||
          data?.items ||
          [];

        if (
          Array.isArray(
            newDiagnoses,
          )
        ) {
          setDiagnoses(
            newDiagnoses,
          );

          newDiagnoses.forEach(
            (diagnosis: Diagnosis) => {
              pushEvent({
                type: "diagnosis",
                engine:
                  diagnosis.engine,
                title:
                  "NEW DIAGNOSIS",
                message:
                  diagnosis.symptom,
                severity:
                  diagnosis.severity,
                timestamp:
                  diagnosis.detected_at ||
                  new Date().toISOString(),
              });
            },
          );
        }

        toast.success(
          "System diagnosis completed",
        );
      } catch (error: any) {
        toast.error(
          error?.message ||
            "Diagnosis request failed",
        );
      } finally {
        setDiagnosing(false);
      }
    },
    [pushEvent],
  );

  // ═══════════════════════════════════════════════════════════════════════
  // AUTO HEAL
  // ═══════════════════════════════════════════════════════════════════════

  const runAutoHeal = useCallback(
    async () => {
      setHealingNow(true);
      vibrate(10);

      try {
        const data =
          await apiFetch<any>(
            "/meta/heal",
            {
              method: "POST",
              body: JSON.stringify({}),
            },
          );

        const actions =
          data?.actions ||
          data?.healing_actions ||
          [];

        if (Array.isArray(actions)) {
          actions.forEach(
            (action: any) => {
              pushEvent({
                type: "healing",
                engine:
                  action.engine,
                title:
                  "AUTO-HEAL EXECUTED",
                message:
                  typeof action ===
                  "string"
                    ? action
                    : action.message ||
                      action.action ||
                      "Recovery action executed",
                severity:
                  "info",
                timestamp:
                  new Date().toISOString(),
              });
            },
          );
        }

        toast.success(
          "Auto-healing cycle completed",
        );

        await refreshAll(
          true,
        );
      } catch (error: any) {
        toast.error(
          error?.message ||
            "Auto-healing failed",
        );
      } finally {
        setHealingNow(false);
      }
    },
    [pushEvent, refreshAll],
  );

  // ═══════════════════════════════════════════════════════════════════════
  // RESTART ENGINE
  // ═══════════════════════════════════════════════════════════════════════

  const restartEngine = useCallback(
    async (name: string) => {
      if (
        !window.confirm(
          `Restart ${name}?`,
        )
      ) {
        return;
      }

      try {
        await apiFetch(
          `/meta/engines/${encodeURIComponent(
            name,
          )}/restart`,
          {
            method: "POST",
          },
        );

        toast.success(
          `${name} restart requested`,
        );

        pushEvent({
          type: "healing",
          engine: name,
          title:
            "ENGINE RESTART REQUESTED",
          message:
            `${name} restart was requested from Overseer`,
          severity: "info",
          timestamp:
            new Date().toISOString(),
        });

        await refreshAll(
          true,
        );
      } catch (error: any) {
        toast.error(
          error?.message ||
            `Unable to restart ${name}`,
        );
      }
    },
    [pushEvent, refreshAll],
  );

  // ═══════════════════════════════════════════════════════════════════════
  // RECOVER ENGINE
  // ═══════════════════════════════════════════════════════════════════════

  const recoverEngine = useCallback(
    async (name: string) => {
      try {
        await apiFetch(
          `/meta/engines/${encodeURIComponent(
            name,
          )}/recover`,
          {
            method: "POST",
          },
        );

        toast.success(
          `${name} recovery requested`,
        );

        pushEvent({
          type: "healing",
          engine: name,
          title:
            "ENGINE RECOVERY REQUESTED",
          message:
            `Recovery handler invoked for ${name}`,
          severity: "info",
          timestamp:
            new Date().toISOString(),
        });

        await refreshAll(
          true,
        );
      } catch (error: any) {
        toast.error(
          error?.message ||
            `Unable to recover ${name}`,
        );
      }
    },
    [pushEvent, refreshAll],
  );

  // ═══════════════════════════════════════════════════════════════════════
  // DERIVED DATA
  // ═══════════════════════════════════════════════════════════════════════

  const nominalCount =
    engines.filter(
      engine =>
        engine.status === "nominal",
    ).length;

  const degradedCount =
    engines.filter(
      engine =>
        engine.status === "degraded",
    ).length;

  const offlineCount =
    engines.filter(
      engine =>
        engine.status === "offline",
    ).length;

  const staleCount =
    engines.filter(
      engine =>
        engine.status === "stale",
    ).length;

  const systemStatus =
    status
      ? normalizeStatus(
          status.overall ||
            (offlineCount > 0
              ? "offline"
              : degradedCount > 0 ||
                staleCount > 0
              ? "degraded"
              : "nominal"),
        )
      : "unknown";

  const activeDiagnoses =
    diagnoses.filter(
      diagnosis =>
        !diagnosis.resolved_at,
    );

  const criticalDiagnoses =
    activeDiagnoses.filter(
      diagnosis =>
        diagnosis.severity ===
        "critical",
    );

  const autoFixable =
    activeDiagnoses.filter(
      diagnosis =>
        diagnosis.auto_fixable,
    );

  const filteredEngines =
    engines.filter(engine => {
      const matchesSearch =
        !search ||
        engine.name
          .toLowerCase()
          .includes(
            search.toLowerCase(),
          );

      const matchesFilter =
        engineFilter === "all" ||
        engine.status ===
          engineFilter;

      return (
        matchesSearch &&
        matchesFilter
      );
    });

  const filteredDiagnoses =
    diagnoses.filter(diagnosis => {
      const matchesSearch =
        !search ||
        diagnosis.engine
          .toLowerCase()
          .includes(
            search.toLowerCase(),
          ) ||
        diagnosis.symptom
          .toLowerCase()
          .includes(
            search.toLowerCase(),
          ) ||
        diagnosis.root_cause
          .toLowerCase()
          .includes(
            search.toLowerCase(),
          );

      const matchesResolved =
        showResolved ||
        !diagnosis.resolved_at;

      return (
        matchesSearch &&
        matchesResolved
      );
    });

  const errorRate =
    engines.reduce(
      (sum, engine) => {
        const total =
          engine.error_count_1h +
          (engine.success_count_1h ||
            0);

        return (
          sum +
          (total > 0
            ? engine.error_count_1h /
              total
            : 0)
        );
      },
      0,
    ) /
    Math.max(
      engines.length,
      1,
    );

  const avgLatency =
    engines.reduce(
      (sum, engine) =>
        sum +
        engine.avg_latency_ms,
      0,
    ) /
    Math.max(
      engines.length,
      1,
    );

  const throughput =
    engines.reduce(
      (sum, engine) =>
        sum +
        engine.throughput_1h,
      0,
    );

  const uptimeHours =
    status?.uptime_hours ??
    snapshots[0]?.uptime_hours ??
    0;

  // ═══════════════════════════════════════════════════════════════════════
  // TAB NAVIGATION
  // ═══════════════════════════════════════════════════════════════════════

  const tabs: Array<{
    id: Tab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    count?: number;
  }> = [
    {
      id: "overview",
      label: "Overview",
      icon: Activity,
    },
    {
      id: "engines",
      label: "Engines",
      icon: Cpu,
      count: engines.length,
    },
    {
      id: "diagnoses",
      label: "Diagnoses",
      icon: Brain,
      count:
        activeDiagnoses.length ||
        undefined,
    },
    {
      id: "graph",
      label: "Graph",
      icon: GitBranch,
    },
    {
      id: "healing",
      label: "Auto-Heal",
      icon: Wrench,
      count:
        healing.length ||
        undefined,
    },
    {
      id: "history",
      label: "History",
      icon: History,
      count:
        snapshots.length ||
        undefined,
    },
  ];

  // ═══════════════════════════════════════════════════════════════════════
  // LOADING SCREEN
  // ═══════════════════════════════════════════════════════════════════════

  if (
    loading &&
    engines.length === 1 &&
    engines[0].name ===
      "meta_engine"
  ) {
    return (
      <div className="min-h-[70vh] flex items-center justify-center">
        <div className="text-center">
          <div className="relative mx-auto w-16 h-16">
            <div className="absolute inset-0 rounded-full border border-indigo-500/20 animate-ping" />

            <div className="absolute inset-2 rounded-full border border-indigo-500/30" />

            <div className="absolute inset-4 rounded-xl bg-indigo-500/10 border border-indigo-500/30 flex items-center justify-center">
              <Cpu className="w-5 h-5 text-indigo-400 animate-pulse" />
            </div>
          </div>

          <p className="text-[13px] font-mono font-bold uppercase tracking-[0.2em] text-brand-text-secondary mt-5">
            INITIALIZING OVERSEER
          </p>

          <p className="text-[11px] font-mono text-brand-text-muted/80 mt-2">
            Discovering engines · Building topology · Collecting health
          </p>
        </div>
      </div>
    );
  }

  // ═══════════════════════════════════════════════════════════════════════
  // MAIN RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <motion.div
      initial={{
        opacity: 0,
      }}
      animate={{
        opacity: 1,
      }}
      className="space-y-3 pb-24 md:pb-6"
    >
      {/* ═══════════════════════════════════════════════════════════════
          COMMAND HEADER
      ═══════════════════════════════════════════════════════════════ */}

      <div className="relative overflow-hidden rounded-2xl border border-brand-border bg-brand-surface/90">
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute -top-32 -right-32 w-72 h-72 bg-indigo-500/10 blur-3xl rounded-full" />

          <div className="absolute -bottom-40 -left-20 w-64 h-64 bg-blue-500/5 blur-3xl rounded-full" />
        </div>

        <div className="relative p-4 md:p-5">
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="relative">
                <div
                  className={cn(
                    "p-3 rounded-2xl border",
                    statusClasses(
                      systemStatus,
                    ),
                  )}
                >
                  <Cpu className="w-5 h-5" />
                </div>

                {systemStatus ===
                  "nominal" && (
                  <span className="absolute -right-1 -bottom-1 w-3 h-3 rounded-full bg-emerald-400 border-2 border-brand-surface animate-pulse" />
                )}
              </div>

              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-lg md:text-xl font-bold font-mono tracking-tight text-brand-text">
                    KANYOZA{" "}
                    <span className="text-indigo-400">
                      OVERSEER
                    </span>
                  </h1>

                  <span className="hidden sm:inline px-1.5 py-0.5 rounded border border-indigo-500/20 bg-indigo-500/10 text-[10px] font-mono text-indigo-400">
                    META ENGINE
                  </span>
                </div>

                <p className="text-[11px] md:text-[12px] font-mono uppercase tracking-[0.16em] text-brand-text-muted mt-1">
                  Autonomous system intelligence · diagnosis · healing
                </p>

                <div className="flex items-center gap-3 mt-2">
                  <StatusBadge
                    status={systemStatus}
                  />

                  <span className="text-[10px] font-mono text-brand-text-muted/80">
                    {lastUpdated
                      ? `UPDATED ${relativeTime(
                          lastUpdated.toISOString(),
                        )}`
                      : "WAITING FOR TELEMETRY"}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-1.5">
              <button
                onClick={() =>
                  refreshAll()
                }
                disabled={refreshing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-brand-border bg-brand-bg/50 text-[11px] font-mono font-bold uppercase text-brand-text-muted hover:text-brand-text-secondary hover:border-brand-border disabled:opacity-50"
              >
                <RefreshCw
                  className={cn(
                    "w-3.5 h-3.5",
                    refreshing &&
                      "animate-spin",
                  )}
                />
                Refresh
              </button>

              <button
                onClick={() =>
                  runDiagnosis()
                }
                disabled={diagnosing}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-[11px] font-mono font-bold uppercase text-indigo-400 hover:bg-indigo-500/20 disabled:opacity-50"
              >
                {diagnosing ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Brain className="w-3.5 h-3.5" />
                )}
                Diagnose
              </button>

              <button
                onClick={() =>
                  runAutoHeal()
                }
                disabled={healingNow}
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-[11px] font-mono font-bold uppercase text-emerald-400 hover:bg-emerald-500/20 disabled:opacity-50"
              >
                {healingNow ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Wrench className="w-3.5 h-3.5" />
                )}
                Auto-Heal
              </button>
            </div>
          </div>

          {/* SYSTEM BAR */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mt-5">
            <div className="p-3 rounded-xl bg-black/20 border border-brand-border">
              <div className="flex justify-between">
                <span className="text-[10px] font-mono uppercase text-brand-text-muted/80">
                  Engine fleet
                </span>

                <Server className="w-3 h-3 text-brand-text-muted/80" />
              </div>

              <p className="text-sm font-mono font-bold text-brand-text mt-1">
                {engines.length}
              </p>

              <p className="text-[10px] font-mono text-brand-text-muted/80 mt-0.5">
                {nominalCount} nominal
              </p>
            </div>

            <div className="p-3 rounded-xl bg-black/20 border border-brand-border">
              <div className="flex justify-between">
                <span className="text-[10px] font-mono uppercase text-brand-text-muted/80">
                  Incidents
                </span>

                <AlertTriangle className="w-3 h-3 text-brand-text-muted/80" />
              </div>

              <p className="text-sm font-mono font-bold text-brand-text mt-1">
                {activeDiagnoses.length}
              </p>

              <p className="text-[10px] font-mono text-brand-text-muted/80 mt-0.5">
                {criticalDiagnoses.length} critical
              </p>
            </div>

            <div className="p-3 rounded-xl bg-black/20 border border-brand-border">
              <div className="flex justify-between">
                <span className="text-[10px] font-mono uppercase text-brand-text-muted/80">
                  Uptime
                </span>

                <Clock3 className="w-3 h-3 text-brand-text-muted/80" />
              </div>

              <p className="text-sm font-mono font-bold text-brand-text mt-1">
                {formatUptime(
                  uptimeHours,
                )}
              </p>

              <p className="text-[10px] font-mono text-brand-text-muted/80 mt-0.5">
                system runtime
              </p>
            </div>

            <div className="p-3 rounded-xl bg-black/20 border border-brand-border">
              <div className="flex justify-between">
                <span className="text-[10px] font-mono uppercase text-brand-text-muted/80">
                  Auto-fixable
                </span>

                <Wrench className="w-3 h-3 text-brand-text-muted/80" />
              </div>

              <p className="text-sm font-mono font-bold text-brand-text mt-1">
                {autoFixable.length}
              </p>

              <p className="text-[10px] font-mono text-brand-text-muted/80 mt-0.5">
                recovery candidates
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          TAB BAR
      ═══════════════════════════════════════════════════════════════ */}

      <div className="flex gap-1 p-1 rounded-2xl bg-brand-surface border border-brand-border overflow-x-auto">
        {tabs.map(item => {
          const Icon = item.icon;
          const active =
            tab === item.id;

          return (
            <button
              key={item.id}
              onClick={() => {
                setTab(item.id);
                vibrate(3);
              }}
              className={cn(
                "flex items-center gap-1.5",
                "px-3 py-2 rounded-xl",
                "text-[11px] font-mono font-bold uppercase",
                "whitespace-nowrap transition-all",
                active
                  ? "bg-indigo-500/10 text-indigo-400 border border-indigo-500/20"
                  : "text-brand-text-muted border border-transparent hover:text-brand-text-secondary",
              )}
            >
              <Icon className="w-3.5 h-3.5" />

              {item.label}

              {item.count !==
                undefined && (
                <span
                  className={cn(
                    "px-1.5 py-0.5 rounded",
                    active
                      ? "bg-indigo-500/10"
                      : "bg-brand-elevated",
                    "text-[10px]",
                  )}
                >
                  {item.count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          GLOBAL SEARCH
      ═══════════════════════════════════════════════════════════════ */}

      {(tab === "engines" ||
        tab === "diagnoses" ||
        tab === "healing" ||
        tab === "history") && (
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-text-muted/80" />

            <input
              value={search}
              onChange={e =>
                setSearch(
                  e.target.value,
                )
              }
              placeholder="Search Overseer telemetry..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-brand-surface border border-brand-border text-[12px] font-mono text-brand-text-secondary placeholder-brand-text-muted/70 focus:outline-none focus:border-indigo-500/30"
            />
          </div>

          {tab === "engines" && (
            <select
              value={engineFilter}
              onChange={e =>
                setEngineFilter(
                  e.target.value as
                    | EngineStatus
                    | "all",
                )
              }
              className="px-3 py-2.5 rounded-xl bg-brand-surface border border-brand-border text-[11px] font-mono text-brand-text-muted focus:outline-none"
            >
              <option value="all">
                ALL
              </option>

              <option value="nominal">
                NOMINAL
              </option>

              <option value="degraded">
                DEGRADED
              </option>

              <option value="stale">
                STALE
              </option>

              <option value="offline">
                OFFLINE
              </option>
            </select>
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          OVERVIEW
      ═══════════════════════════════════════════════════════════════ */}

      <AnimatePresence mode="wait">
        {tab === "overview" && (
          <motion.div
            key="overview"
            initial={{
              opacity: 0,
              y: 8,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: -8,
            }}
            className="space-y-3"
          >
            {/* METRICS */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
              <MetricCard
                label="Healthy Engines"
                value={`${nominalCount}/${engines.length}`}
                sub={
                  offlineCount > 0
                    ? `${offlineCount} offline`
                    : degradedCount > 0
                    ? `${degradedCount} degraded`
                    : "fleet nominal"
                }
                icon={HeartPulse}
                trend={
                  offlineCount ||
                  degradedCount
                    ? "down"
                    : "up"
                }
              />

              <MetricCard
                label="Error Rate"
                value={`${(
                  errorRate * 100
                ).toFixed(1)}%`}
                sub="last hour"
                icon={AlertTriangle}
                trend={
                  errorRate > 0.1
                    ? "down"
                    : "up"
                }
              />

              <MetricCard
                label="Throughput"
                value={throughput.toFixed(
                  2,
                )}
                sub="aggregate ops/sec"
                icon={Activity}
              />

              <MetricCard
                label="Avg Latency"
                value={`${avgLatency.toFixed(
                  0,
                )}ms`}
                sub="engine average"
                icon={Timer}
              />
            </div>

            {/* SYSTEM HEALTH */}
            <div className="grid lg:grid-cols-3 gap-3">
              <GlassCard className="lg:col-span-2 p-4">
                <SectionHeader
                  icon={HeartPulse}
                  title="System Health"
                  subtitle="Live state across registered engines"
                  action={
                    <button
                      onClick={() =>
                        setTab(
                          "engines",
                        )
                      }
                      className="text-[11px] font-mono text-indigo-400 hover:text-indigo-300"
                    >
                      VIEW ALL →
                    </button>
                  }
                />

                <div className="grid sm:grid-cols-2 gap-2">
                  {engines
                    .slice(0, 8)
                    .map(engine => (
                      <EngineRow
                        key={
                          engine.name
                        }
                        engine={
                          engine
                        }
                        selected={
                          selectedEngine ===
                          engine.name
                        }
                        onSelect={() =>
                          openEngine(
                            engine.name,
                          )
                        }
                      />
                    ))}
                </div>

                {engines.length >
                  8 && (
                  <button
                    onClick={() =>
                      setTab(
                        "engines",
                      )
                    }
                    className="w-full mt-2 py-2 text-[11px] font-mono uppercase text-brand-text-muted hover:text-brand-text-secondary"
                  >
                    +{" "}
                    {engines.length -
                      8}{" "}
                    more engines
                  </button>
                )}
              </GlassCard>

              {/* INCIDENTS */}
              <GlassCard className="p-4">
                <SectionHeader
                  icon={AlertCircle}
                  title="Active Incidents"
                  subtitle="Problems requiring attention"
                  action={
                    <span
                      className={cn(
                        "px-1.5 py-0.5 rounded",
                        "text-[10px] font-mono",
                        criticalDiagnoses.length >
                        0
                          ? "text-red-400 bg-red-500/10"
                          : "text-emerald-400 bg-emerald-500/10",
                      )}
                    >
                      {
                        activeDiagnoses.length
                      }
                    </span>
                  }
                />

                {activeDiagnoses.length ===
                0 ? (
                  <div className="py-12 flex flex-col items-center text-center">
                    <div className="p-3 rounded-2xl bg-emerald-500/5 border border-emerald-500/10">
                      <CheckCircle2 className="w-6 h-6 text-emerald-400/70" />
                    </div>

                    <p className="text-[12px] font-mono uppercase font-bold text-emerald-400/70 mt-3">
                      NO ACTIVE INCIDENTS
                    </p>

                    <p className="text-[11px] font-mono text-brand-text-muted/80 mt-1">
                      The Overseer currently has nothing requiring intervention.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    {activeDiagnoses
                      .slice(0, 5)
                      .map(
                        diagnosis => (
                          <button
                            key={
                              diagnosis.id
                            }
                            onClick={() =>
                              setTab(
                                "diagnoses",
                              )
                            }
                            className="w-full text-left p-3 rounded-xl bg-brand-bg/50 border border-brand-border hover:border-brand-border"
                          >
                            <div className="flex items-center gap-2">
                              <span
                                className={cn(
                                  "w-1.5 h-1.5 rounded-full",
                                  diagnosis.severity ===
                                    "critical"
                                    ? "bg-red-400"
                                    : "bg-amber-400",
                                )}
                              />

                              <span className="text-[12px] font-mono font-bold text-brand-text-secondary truncate">
                                {
                                  diagnosis.engine
                                }
                              </span>

                              <span className="ml-auto text-[10px] font-mono text-brand-text-muted/80">
                                {relativeTime(
                                  diagnosis.detected_at,
                                )}
                              </span>
                            </div>

                            <p className="text-[11px] font-mono text-brand-text-muted mt-1 truncate">
                              {
                                diagnosis.symptom
                              }
                            </p>
                          </button>
                        ),
                      )}

                    {activeDiagnoses.length >
                      5 && (
                      <button
                        onClick={() =>
                          setTab(
                            "diagnoses",
                          )
                        }
                        className="w-full py-2 text-[11px] font-mono text-indigo-400"
                      >
                        VIEW ALL INCIDENTS →
                      </button>
                    )}
                  </div>
                )}
              </GlassCard>
            </div>

            {/* SECONDARY ROW */}
            <div className="grid lg:grid-cols-2 gap-3">
              <ActivityStream
                events={events}
              />

              <GlassCard className="p-4">
                <SectionHeader
                  icon={GitBranch}
                  title="Dependency Intelligence"
                  subtitle="Failure propagation surface"
                  action={
                    <button
                      onClick={() =>
                        setTab(
                          "graph",
                        )
                      }
                      className="text-[11px] font-mono text-indigo-400"
                    >
                      OPEN GRAPH →
                    </button>
                  }
                />

                <div className="grid grid-cols-2 gap-2">
                  <div className="p-3 rounded-xl bg-brand-bg/50 border border-brand-border">
                    <p className="text-[10px] uppercase font-mono text-brand-text-muted/80">
                      Nodes
                    </p>

                    <p className="text-lg font-mono font-bold text-brand-text mt-1">
                      {
                        Object.keys(
                          graph.edges,
                        ).length
                      }
                    </p>
                  </div>

                  <div className="p-3 rounded-xl bg-brand-bg/50 border border-brand-border">
                    <p className="text-[10px] uppercase font-mono text-brand-text-muted/80">
                      Edges
                    </p>

                    <p className="text-lg font-mono font-bold text-brand-text mt-1">
                      {Object.values(
                        graph.edges,
                      ).reduce(
                        (
                          sum,
                          deps,
                        ) =>
                          sum +
                          deps.length,
                        0,
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-3 p-3 rounded-xl bg-indigo-500/5 border border-indigo-500/10">
                  <div className="flex items-start gap-2">
                    <Info className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />

                    <p className="text-[11px] font-mono leading-relaxed text-brand-text-muted">
                      The Overseer traces upstream dependency failures before treating downstream engines as independent incidents.
                    </p>
                  </div>
                </div>

                <div className="mt-3 space-y-1">
                  {[
                    "content_engine",
                    "ai_orchestrator",
                    "condition_engine",
                  ].map(name => (
                    <div
                      key={name}
                      className="flex items-center gap-2 py-1.5"
                    >
                      <span className="text-[11px] font-mono text-brand-text-muted">
                        {name}
                      </span>

                      <ArrowRight className="w-3 h-3 text-brand-text-muted/50" />

                      <span className="text-[11px] font-mono text-indigo-400">
                        {
                          graph.edges[
                            name
                          ]?.length ||
                          0
                        }{" "}
                        dependencies
                      </span>
                    </div>
                  ))}
                </div>
              </GlassCard>
            </div>

            {/* AUTO HEAL CTA */}
            {(autoFixable.length >
              0 ||
              criticalDiagnoses.length >
                0) && (
              <GlassCard className="p-4 border-amber-500/20 bg-amber-500/[0.025]">
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <Wrench className="w-5 h-5 text-amber-400" />
                  </div>

                  <div className="flex-1">
                    <p className="text-[13px] font-mono font-bold uppercase text-amber-400">
                      Overseer intervention recommended
                    </p>

                    <p className="text-[11px] font-mono text-brand-text-muted mt-1">
                      {autoFixable.length} diagnosis(es) are marked auto-fixable.
                    </p>
                  </div>

                  <button
                    onClick={() =>
                      runAutoHeal()
                    }
                    disabled={
                      healingNow
                    }
                    className="px-4 py-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-400 text-[11px] font-mono font-bold uppercase hover:bg-amber-500/20"
                  >
                    {healingNow
                      ? "HEALING..."
                      : "EXECUTE AUTO-HEAL"}
                  </button>
                </div>
              </GlassCard>
            )}
          </motion.div>
        )}

        {/* ═════════════════════════════════════════════════════════════
            ENGINES
        ═════════════════════════════════════════════════════════════ */}

        {tab === "engines" && (
          <motion.div
            key="engines"
            initial={{
              opacity: 0,
              y: 8,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: -8,
            }}
            className="space-y-3"
          >
            <GlassCard className="p-4">
              <SectionHeader
                icon={Cpu}
                title="Engine Fleet"
                subtitle={`${engines.length} registered engines under observation`}
                action={
                  <div className="flex gap-2 text-[10px] font-mono">
                    <span className="text-emerald-400">
                      {nominalCount} OK
                    </span>

                    <span className="text-amber-400">
                      {degradedCount} DEG
                    </span>

                    <span className="text-red-400">
                      {offlineCount} OFF
                    </span>
                  </div>
                }
              />

              <div className="space-y-1.5">
                {filteredEngines.map(
                  engine => (
                    <EngineRow
                      key={
                        engine.name
                      }
                      engine={
                        engine
                      }
                      selected={
                        selectedEngine ===
                        engine.name
                      }
                      onSelect={() =>
                        openEngine(
                          engine.name,
                        )
                      }
                    />
                  ),
                )}
              </div>

              {filteredEngines.length ===
                0 && (
                <EmptyState
                  icon={Search}
                  title="No engines found"
                  description="No registered engine matches the current search or status filter."
                />
              )}
            </GlassCard>
          </motion.div>
        )}

        {/* ═════════════════════════════════════════════════════════════
            DIAGNOSES
        ═════════════════════════════════════════════════════════════ */}

        {tab === "diagnoses" && (
          <motion.div
            key="diagnoses"
            initial={{
              opacity: 0,
              y: 8,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: -8,
            }}
            className="space-y-3"
          >
            <GlassCard className="p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap mb-4">
                <div>
                  <h2 className="text-sm font-bold font-mono text-brand-text">
                    System Diagnoses
                  </h2>

                  <p className="text-[11px] font-mono text-brand-text-muted/80 mt-1">
                    Root cause analysis generated by the Overseer
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    onClick={() =>
                      setShowResolved(
                        !showResolved,
                      )
                    }
                    className={cn(
                      "px-2.5 py-2 rounded-xl border text-[11px] font-mono uppercase",
                      showResolved
                        ? "text-indigo-400 bg-indigo-500/10 border-indigo-500/20"
                        : "text-brand-text-muted border-brand-border",
                    )}
                  >
                    {showResolved
                      ? "Showing resolved"
                      : "Hide resolved"}
                  </button>

                  <button
                    onClick={() =>
                      runDiagnosis()
                    }
                    disabled={
                      diagnosing
                    }
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-indigo-500/20 bg-indigo-500/10 text-indigo-400 text-[11px] font-mono uppercase"
                  >
                    {diagnosing ? (
                      <Loader2 className="w-3 h-3 animate-spin" />
                    ) : (
                      <Brain className="w-3 h-3" />
                    )}
                    Run Diagnosis
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2 mb-4">
                <MetricCard
                  label="Active"
                  value={
                    activeDiagnoses.length
                  }
                  icon={AlertTriangle}
                />

                <MetricCard
                  label="Critical"
                  value={
                    criticalDiagnoses.length
                  }
                  icon={AlertCircle}
                />

                <MetricCard
                  label="Auto-Fixable"
                  value={
                    autoFixable.length
                  }
                  icon={Wrench}
                />
              </div>

              <div className="space-y-2">
                {filteredDiagnoses.map(
                  diagnosis => (
                    <DiagnosisCard
                      key={
                        diagnosis.id
                      }
                      diagnosis={
                        diagnosis
                      }
                      onHeal={() =>
                        runAutoHeal()
                      }
                      onInspect={() =>
                        openEngine(
                          diagnosis.engine,
                        )
                      }
                    />
                  ),
                )}
              </div>

              {filteredDiagnoses.length ===
                0 && (
                <EmptyState
                  icon={CheckCircle2}
                  title="No matching diagnoses"
                  description="The Overseer currently has no diagnoses matching the selected filters."
                />
              )}
            </GlassCard>
          </motion.div>
        )}

        {/* ═════════════════════════════════════════════════════════════
            GRAPH
        ═════════════════════════════════════════════════════════════ */}

        {tab === "graph" && (
          <motion.div
            key="graph"
            initial={{
              opacity: 0,
              y: 8,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: -8,
            }}
            className="space-y-3"
          >
            <DependencyGraphView
              graph={graph}
              engines={engines}
              onEngineClick={
                openEngine
              }
            />

            <div className="grid md:grid-cols-3 gap-2">
              <GlassCard className="p-4">
                <p className="text-[10px] uppercase font-mono text-brand-text-muted/80">
                  ROOT NODES
                </p>

                <p className="text-xl font-mono font-bold text-brand-text mt-1">
                  {
                    graph.root_nodes
                      .length
                  }
                </p>

                <div className="mt-3 space-y-1">
                  {graph.root_nodes
                    .slice(0, 5)
                    .map(name => (
                      <button
                        key={name}
                        onClick={() =>
                          openEngine(
                            name,
                          )
                        }
                        className="block text-[11px] font-mono text-brand-text-muted hover:text-indigo-400"
                      >
                        {name}
                      </button>
                    ))}
                </div>
              </GlassCard>

              <GlassCard className="p-4">
                <p className="text-[10px] uppercase font-mono text-brand-text-muted/80">
                  LEAF NODES
                </p>

                <p className="text-xl font-mono font-bold text-brand-text mt-1">
                  {
                    graph.leaf_nodes
                      .length
                  }
                </p>

                <div className="mt-3 space-y-1">
                  {graph.leaf_nodes
                    .slice(0, 5)
                    .map(name => (
                      <button
                        key={name}
                        onClick={() =>
                          openEngine(
                            name,
                          )
                        }
                        className="block text-[11px] font-mono text-brand-text-muted hover:text-indigo-400"
                      >
                        {name}
                      </button>
                    ))}
                </div>
              </GlassCard>

              <GlassCard className="p-4">
                <p className="text-[10px] uppercase font-mono text-brand-text-muted/80">
                  DEPENDENCY EDGES
                </p>

                <p className="text-xl font-mono font-bold text-brand-text mt-1">
                  {Object.values(
                    graph.edges,
                  ).reduce(
                    (sum, deps) =>
                      sum +
                      deps.length,
                    0,
                  )}
                </p>

                <p className="text-[11px] font-mono text-brand-text-muted/80 mt-3">
                  Upstream/downstream relationships currently known to the Overseer.
                </p>
              </GlassCard>
            </div>
          </motion.div>
        )}

        {/* ═════════════════════════════════════════════════════════════
            HEALING
        ═════════════════════════════════════════════════════════════ */}

        {tab === "healing" && (
          <motion.div
            key="healing"
            initial={{
              opacity: 0,
              y: 8,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: -8,
            }}
            className="space-y-3"
          >
            <GlassCard className="p-4">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h2 className="text-sm font-bold font-mono text-brand-text">
                    Autonomous Recovery
                  </h2>

                  <p className="text-[11px] font-mono text-brand-text-muted/80 mt-1">
                    Recovery actions executed by the Meta Engine
                  </p>
                </div>

                <button
                  onClick={() =>
                    runAutoHeal()
                  }
                  disabled={
                    healingNow
                  }
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 text-[11px] font-mono uppercase"
                >
                  {healingNow ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Wrench className="w-3.5 h-3.5" />
                  )}
                  Run Recovery Cycle
                </button>
              </div>

              <div className="grid grid-cols-3 gap-2 mt-4">
                <MetricCard
                  label="Actions"
                  value={
                    healing.length
                  }
                  icon={Wrench}
                />

                <MetricCard
                  label="Successful"
                  value={
                    healing.filter(
                      item =>
                        item.success ||
                        item.status ===
                          "success",
                    ).length
                  }
                  icon={CheckCircle2}
                />

                <MetricCard
                  label="Failed"
                  value={
                    healing.filter(
                      item =>
                        item.success ===
                          false ||
                        item.status ===
                          "failed",
                    ).length
                  }
                  icon={AlertTriangle}
                />
              </div>

              {healing.length ===
              0 ? (
                <EmptyState
                  icon={Wrench}
                  title="No healing history"
                  description="No autonomous recovery actions have been returned by the backend yet."
                />
              ) : (
                <div className="mt-4 space-y-2">
                  {healing.map(
                    (item, index) => {
                      const success =
                        item.success ??
                        item.status ===
                          "success";

                      return (
                        <div
                          key={
                            item.id ||
                            `${item.engine}-${index}`
                          }
                          className="p-3 rounded-xl border border-brand-border bg-brand-bg/60"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={cn(
                                "p-2 rounded-xl border",
                                success
                                  ? "text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                  : item.status ===
                                    "running"
                                  ? "text-amber-400 bg-amber-500/10 border-amber-500/20"
                                  : "text-red-400 bg-red-500/10 border-red-500/20",
                              )}
                            >
                              {success ? (
                                <CheckCircle2 className="w-4 h-4" />
                              ) : item.status ===
                                "running" ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <AlertTriangle className="w-4 h-4" />
                              )}
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center gap-2">
                                <span className="text-[13px] font-mono font-bold text-brand-text-secondary">
                                  {
                                    item.engine
                                  }
                                </span>

                                <span className="text-[10px] font-mono uppercase text-brand-text-muted/80">
                                  {item.status ||
                                    (success
                                      ? "success"
                                      : "failed")}
                                </span>
                              </div>

                              <p className="text-[11px] font-mono text-brand-text-muted mt-1 truncate">
                                {item.action ||
                                  item.message ||
                                  item.diagnosis ||
                                  "Recovery action"}
                              </p>
                            </div>

                            <span className="text-[10px] font-mono text-brand-text-muted/50">
                              {relativeTime(
                                item.executed_at ||
                                  item.timestamp,
                              )}
                            </span>
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              )}
            </GlassCard>

            <GlassCard className="p-4">
              <SectionHeader
                icon={Shield}
                title="Recovery Philosophy"
                subtitle="How the Overseer approaches autonomous healing"
              />

              <div className="grid md:grid-cols-4 gap-2">
                {[
                  {
                    icon: Eye,
                    title: "OBSERVE",
                    text: "Collect health, error, latency and dependency telemetry.",
                  },
                  {
                    icon: Brain,
                    title: "DIAGNOSE",
                    text: "Trace symptoms through dependency relationships.",
                  },
                  {
                    icon: Wrench,
                    title: "HEAL",
                    text: "Execute registered recovery handlers when safe.",
                  },
                  {
                    icon: AlertCircle,
                    title: "ESCALATE",
                    text: "Surface unresolved critical problems for humans.",
                  },
                ].map(item => {
                  const Icon =
                    item.icon;

                  return (
                    <div
                      key={
                        item.title
                      }
                      className="p-3 rounded-xl bg-brand-bg/50 border border-brand-border"
                    >
                      <Icon className="w-4 h-4 text-indigo-400" />

                      <p className="text-[11px] font-mono font-bold text-brand-text-secondary mt-2">
                        {item.title}
                      </p>

                      <p className="text-[11px] font-mono leading-relaxed text-brand-text-muted/80 mt-1">
                        {item.text}
                      </p>
                    </div>
                  );
                })}
              </div>
            </GlassCard>
          </motion.div>
        )}

        {/* ═════════════════════════════════════════════════════════════
            HISTORY
        ═════════════════════════════════════════════════════════════ */}

        {tab === "history" && (
          <motion.div
            key="history"
            initial={{
              opacity: 0,
              y: 8,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            exit={{
              opacity: 0,
              y: -8,
            }}
            className="space-y-3"
          >
            <GlassCard className="p-4">
              <SectionHeader
                icon={History}
                title="System History"
                subtitle="Historical Overseer snapshots"
              />

              {snapshots.length ===
              0 ? (
                <EmptyState
                  icon={History}
                  title="No snapshots available"
                  description="The backend has not exposed historical snapshots yet. Current health is still available through Overview and Engines."
                />
              ) : (
                <div className="space-y-2">
                  {snapshots.map(
                    (
                      snapshot,
                      index,
                    ) => (
                      <div
                        key={`${snapshot.timestamp}-${index}`}
                        className="p-3 rounded-xl border border-brand-border bg-brand-bg/60"
                      >
                        <div className="flex items-center gap-3">
                          <span
                            className={cn(
                              "w-2 h-2 rounded-full",
                              statusDotClasses(
                                normalizeStatus(
                                  snapshot.overall,
                                ),
                              ),
                            )}
                          />

                          <span className="text-[12px] font-mono font-bold text-brand-text-secondary">
                            {normalizeStatus(
                              snapshot.overall,
                            ).toUpperCase()}
                          </span>

                          <span className="text-[10px] font-mono text-brand-text-muted/80">
                            {snapshot.timestamp
                              ? new Date(
                                  snapshot.timestamp,
                                ).toLocaleString()
                              : "—"}
                          </span>

                          <span className="ml-auto text-[10px] font-mono text-brand-text-muted/80">
                            {snapshot.critical_alerts} critical ·{" "}
                            {snapshot.active_alerts} active
                          </span>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              )}
            </GlassCard>

            <ActivityStream
              events={events}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════
          ENGINE DETAIL OVERLAY
      ═══════════════════════════════════════════════════════════════ */}

      {selectedEngine && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px]"
            onClick={
              closeEngine
            }
          />

          <EngineDetailPanel
            engine={
              engines.find(
                engine =>
                  engine.name ===
                  selectedEngine,
              ) || {
                name: selectedEngine,
                status: "unknown",
                error_count_1h: 0,
                throughput_1h: 0,
                avg_latency_ms: 0,
                dependencies: [],
                dependents: [],
              }
            }
            detail={
              selectedDetail
            }
            loading={
              detailLoading
            }
            onClose={
              closeEngine
            }
            onRefresh={() =>
              openEngine(
                selectedEngine,
              )
            }
            onDiagnose={() =>
              runDiagnosis(
                selectedEngine,
              )
            }
            onHeal={() =>
              runAutoHeal()
            }
            onRestart={() =>
              restartEngine(
                selectedEngine,
              )
            }
          />
        </>
      )}
    </motion.div>
  );
}
