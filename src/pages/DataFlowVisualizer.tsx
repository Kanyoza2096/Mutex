// ═══════════════════════════════════════════════════════════════════════════
// DATA FLOW VISUALIZER — v16 "Blackbox"
// Runtime telemetry instrument. Not an architecture diagram.
//
// Layers:
//   1. Telemetry field (spatial noise grid)
//   2. Opaque service nodes (NX-17, AI-42, PX-08...)
//   3. Trace ribbons (execution streams, not dots)
//   4. Anomaly distortion field
//   5. Semantic layer (revealed on hover)
//
// Architecture: RuntimeSignal → ExecutionTrace → NodePressure → AdaptiveTopology
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
// Use LazyMotion + m for safer production code-splitting (avoids "F is not a constructor")
import { LazyMotion, domAnimation, m, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import {
  Cpu, Zap, Activity, MessageCircle, Send, Globe, Server, Database,
  AlertTriangle, Maximize2, Minimize2, RotateCcw, Network,
  Eye, EyeOff, Map as MapIcon, ZoomIn, ZoomOut, Radio, Wifi,
} from 'lucide-react';
import { cn } from '../lib/utils';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type NodeStatus = 'online' | 'degraded' | 'offline' | 'active' | 'thinking';
type SignalType = 'request' | 'response' | 'publish' | 'failure' | 'provider' | 'worker' | 'message';
type SignalSeverity = 'info' | 'notice' | 'warning' | 'critical';

interface RuntimeSignal {
  id: string;
  timestamp: number;
  source: string;
  target: string;
  type: SignalType;
  latency?: number;
  status?: number;
  traceId: string;
  severity: SignalSeverity;
}

interface ExecutionTrace {
  traceId: string;
  signals: RuntimeSignal[];
  startTime: number;
  endTime: number;
  totalLatency: number;
  path: string[];
  status: 'active' | 'committed' | 'failed';
  ribbonProgress: number;
}

interface FlowNode {
  id: string;
  visualId: string;
  label: string;
  // Store icon ID string — NOT the component ref — to avoid "F is not a constructor"
  // when the module initialisation order differs in production chunks.
  iconId: string;
  x: number;
  y: number;
  status: NodeStatus;
  pressure: number;
  failureReason?: string;
  recoveredAt?: number;
  latency?: number;
  eventCount: number;
}

interface FlowEdge {
  from: string;
  to: string;
  totalPackets: number;
  errorPackets: number;
  avgLatency: number;
  pressure: number;
  lastActivity: number;
}

interface TraceParticle {
  id: string;
  traceId: string;
  progress: number;
  opacity: number;
  isError: boolean;
  latency?: number;
  ribbon: { x: number; y: number; opacity: number }[];
}

interface ControlPoints {
  cx1: number; cy1: number;
  cx2: number; cy2: number;
}

interface AnomalyPoint {
  x: number;
  y: number;
  intensity: number;
  decay: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// ICON REGISTRY — resolved at render time, NOT stored in state
// Keeping icon component refs out of React state prevents "F is not a
// constructor" crashes in production bundles where tree-shaking / chunk
// initialisation order may leave a ref undefined at module evaluation time.
// ═══════════════════════════════════════════════════════════════════════════

const ICON_MAP: Record<string, React.ElementType> = {
  Globe, Cpu, Zap, Activity, MessageCircle, Send, Server, Database,
  AlertTriangle, Network, Radio, Wifi,
};

// Return an explicitly typed component so JSX props (className, style) type-check
type IconComponent = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

function resolveIcon(iconId: string): IconComponent {
  const Icon = ICON_MAP[iconId] as IconComponent | undefined;
  if (!Icon) {
    // Fallback so an unknown id never crashes the renderer
    return Activity as IconComponent;
  }
  return Icon;
}

// ═══════════════════════════════════════════════════════════════════════════
// OPAQUE NODE IDENTITIES
// ═══════════════════════════════════════════════════════════════════════════

const NODE_VISUAL_IDS: Record<string, string> = {
  frontend:   'NX-17',
  gemini:     'AI-42',
  pipeline:   'PX-08',
  render:     'RN-31',
  command:    'CX-14',
  scheduler:  'SC-77',
  connectors: 'IO-52',
  supabase:   'DB-19',
  redis:      'KV-63',
  socketio:   'RT-91',
  facebook:   'GW-44',
};

const NODE_METADATA: Record<string, { domain: string; region: string }> = {
  frontend:   { domain: 'edge',    region: 'us-east' },
  gemini:     { domain: 'compute', region: 'us-central' },
  pipeline:   { domain: 'compute', region: 'us-central' },
  render:     { domain: 'compute', region: 'us-west' },
  command:    { domain: 'control', region: 'us-east' },
  scheduler:  { domain: 'control', region: 'us-east' },
  connectors: { domain: 'io',      region: 'multi' },
  supabase:   { domain: 'storage', region: 'us-east' },
  redis:      { domain: 'storage', region: 'us-east' },
  socketio:   { domain: 'io',      region: 'multi' },
  facebook:   { domain: 'external', region: 'external' },
};

// ═══════════════════════════════════════════════════════════════════════════
// NODE LAYOUT
// ═══════════════════════════════════════════════════════════════════════════

const DEFAULT_NODE_LAYOUT: Omit<FlowNode, 'status' | 'pressure' | 'eventCount'>[] = [
  { id: 'frontend',   visualId: 'NX-17', label: 'Frontend',         iconId: 'Globe',         x: 50, y: 5  },
  { id: 'gemini',     visualId: 'AI-42', label: 'Gemini AI',        iconId: 'Cpu',           x: 50, y: 17 },
  { id: 'pipeline',   visualId: 'PX-08', label: 'Pipeline',         iconId: 'Zap',           x: 50, y: 29 },
  { id: 'render',     visualId: 'RN-31', label: 'Card Renderer',    iconId: 'Activity',      x: 80, y: 29 },
  { id: 'command',    visualId: 'CX-14', label: 'Command Executor', iconId: 'MessageCircle', x: 16, y: 43 },
  { id: 'scheduler',  visualId: 'SC-77', label: 'Scheduler',        iconId: 'Send',          x: 50, y: 43 },
  { id: 'connectors', visualId: 'IO-52', label: 'Connectors',       iconId: 'Server',        x: 50, y: 57 },
  { id: 'supabase',   visualId: 'DB-19', label: 'Supabase',         iconId: 'Database',      x: 28, y: 73 },
  { id: 'redis',      visualId: 'KV-63', label: 'Redis',            iconId: 'Database',      x: 72, y: 73 },
  { id: 'socketio',   visualId: 'RT-91', label: 'Socket.IO',        iconId: 'Activity',      x: 50, y: 85 },
  { id: 'facebook',   visualId: 'GW-44', label: 'Facebook',         iconId: 'Globe',         x: 16, y: 57 },
];

const DEFAULT_EDGES: [string, string][] = [
  ['frontend', 'gemini'],
  ['frontend', 'scheduler'],
  ['frontend', 'supabase'],
  ['frontend', 'connectors'],
  ['frontend', 'command'],
  ['frontend', 'socketio'],
  ['gemini', 'pipeline'],
  ['pipeline', 'render'],
  ['pipeline', 'scheduler'],
  ['render', 'connectors'],
  ['command', 'connectors'],
  ['scheduler', 'connectors'],
  ['facebook', 'connectors'],
  ['connectors', 'supabase'],
  ['connectors', 'redis'],
  ['connectors', 'socketio'],
  ['supabase', 'socketio'],
  ['redis', 'socketio'],
];

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const STATUS_COLORS: Record<string, string> = {
  online:   '#22c55e',
  degraded: '#f59e0b',
  offline:  '#ef4444',
  active:   '#3b82f6',
  thinking: '#a855f7',
};

const STATUS_LABELS: Record<string, string> = {
  online:   'NOMINAL',
  degraded: 'DEGRADED',
  offline:  'OFFLINE',
  active:   'ACTIVE',
  thinking: 'EXECUTING',
};

const SEVERITY_COLORS: Record<SignalSeverity, string> = {
  info:     '#818cf8',
  notice:   '#f59e0b',
  warning:  '#f97316',
  critical: '#ef4444',
};

const TRACE_COLORS = ['#818cf8', '#6366f1', '#a78bfa', '#38bdf8', '#34d399'];

const EDGE_FADE_MS = 30_000;
const PRESSURE_DECAY = 0.95;
const MAX_TRACES = 15;
const RIBBON_LENGTH = 12;
const ANOMALY_MAX = 8;

// ═══════════════════════════════════════════════════════════════════════════
// BEZIER MATH
// ═══════════════════════════════════════════════════════════════════════════

function computeControlPoints(
  x1: number, y1: number, x2: number, y2: number,
): ControlPoints {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy) || 1;
  const curve = Math.min(len * 0.35, 7);
  const nx = -dy / len, ny = dx / len;
  return {
    cx1: x1 + dx * 0.3 + nx * curve * 0.5,
    cy1: y1 + dy * 0.3 + ny * curve * 0.5,
    cx2: x2 - dx * 0.3 + nx * curve * 0.5,
    cy2: y2 - dy * 0.3 + ny * curve * 0.5,
  };
}

function bezierPath(
  x1: number, y1: number, x2: number, y2: number, cp: ControlPoints,
): string {
  return `M${x1},${y1} C${cp.cx1},${cp.cy1} ${cp.cx2},${cp.cy2} ${x2},${y2}`;
}

function bezierAt(
  x1: number, y1: number, x2: number, y2: number,
  cp: ControlPoints, t: number,
): { x: number; y: number } {
  const mt = 1 - t;
  return {
    x: mt * mt * mt * x1 + 3 * mt * mt * t * cp.cx1 + 3 * mt * t * t * cp.cx2 + t * t * t * x2,
    y: mt * mt * mt * y1 + 3 * mt * mt * t * cp.cy1 + 3 * mt * t * t * cp.cy2 + t * t * t * y2,
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// RUNTIME SIGNAL NORMALIZER
// ═══════════════════════════════════════════════════════════════════════════

function normalizeSignal(
  eventName: string,
  data: any,
  traceIdCounter: { current: number },
): RuntimeSignal | null {
  const now = Date.now();
  const traceId = `trace_${traceIdCounter.current++}_${now.toString(36)}`;

  switch (eventName) {
    case 'traffic_packet': {
      const { from_service, to_service, duration_ms, status, error } = data || {};
      if (!from_service || !to_service) return null;
      return {
        id: `sig_${now}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: now,
        source: from_service,
        target: to_service,
        type: status && status >= 400 ? 'failure' : 'request',
        latency: duration_ms,
        status,
        traceId,
        severity: error ? 'critical' : status && status >= 400 ? 'warning' : 'info',
      };
    }
    case 'new_message':
      return {
        id: `sig_${now}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: now,
        source: 'connectors',
        target: 'socketio',
        type: 'message',
        traceId,
        severity: 'info',
      };
    case 'post_published':
      return {
        id: `sig_${now}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: now,
        source: 'scheduler',
        target: 'connectors',
        type: 'publish',
        traceId,
        severity: 'info',
      };
    case 'worker_error':
      return {
        id: `sig_${now}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: now,
        source: 'render',
        target: 'connectors',
        type: 'worker',
        traceId,
        severity: 'critical',
      };
    case 'provider_failed':
      return {
        id: `sig_${now}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: now,
        source: 'connectors',
        target: 'socketio',
        type: 'provider',
        traceId,
        severity: 'critical',
      };
    default:
      return null;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export interface DataFlowVisualizerProps {
  nodeLayout?: Omit<FlowNode, 'status' | 'pressure' | 'eventCount'>[];
  edgeList?: [string, string][];
}

export default function DataFlowVisualizer({
  nodeLayout = DEFAULT_NODE_LAYOUT,
  edgeList = DEFAULT_EDGES,
}: DataFlowVisualizerProps) {
  const { socket, healthMatrix } = useStore();

  // ── State ──────────────────────────────────────────────────────────
  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [eventsPerSec, setEventsPerSec] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const [failureEvents, setFailureEvents] = useState(0);
  const [activeTraces, setActiveTraces] = useState<number>(0);
  const [anomalyIndex, setAnomalyIndex] = useState(0);
  const [executionDrift, setExecutionDrift] = useState(0);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showSemantic, setShowSemantic] = useState(false);
  const [showMinimap, setShowMinimap] = useState(true);
  const [selectedTrace, setSelectedTrace] = useState<ExecutionTrace | null>(null);
  // anomalyPoints kept in state for UI re-renders, but ALSO mirrored to a ref
  // so the rAF loop (which closes over the initial value) always reads fresh data.
  const [anomalyPoints, setAnomalyPoints] = useState<AnomalyPoint[]>([]);

  // ── Refs ───────────────────────────────────────────────────────────
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const packetIdRef = useRef(0);
  const traceIdRef = useRef(0);
  const totalEventsRef = useRef(0);
  const particlesByEdgeRef = useRef<Map<string, TraceParticle[]>>(new Map());
  const tracesRef = useRef<Map<string, ExecutionTrace>>(new Map());
  const nodesRef = useRef<FlowNode[]>([]);
  const edgesRef = useRef<FlowEdge[]>([]);
  const cpMapRef = useRef<Map<string, ControlPoints>>(new Map());
  const panRef = useRef({
    isDragging: false, startX: 0, startY: 0, basePanX: 0, basePanY: 0,
  });
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const scaleRef = useRef(1);
  const animFrameRef = useRef<number>(0);
  const lastTimeRef = useRef(0);
  const pressureDecayRef = useRef<ReturnType<typeof setInterval> | null>(null);
  // Refs that mirror state values for use inside the rAF loop (which captures
  // stale closures when deps array is []). Always kept in sync via useEffect.
  const showMinimapRef = useRef(true);
  const anomalyPointsRef = useRef<AnomalyPoint[]>([]);

  // ── Sync refs ──────────────────────────────────────────────────────
  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { edgesRef.current = edges; }, [edges]);
  useEffect(() => { panOffsetRef.current = panOffset; }, [panOffset]);
  useEffect(() => { scaleRef.current = scale; }, [scale]);
  useEffect(() => { showMinimapRef.current = showMinimap; }, [showMinimap]);
  useEffect(() => { anomalyPointsRef.current = anomalyPoints; }, [anomalyPoints]);

  // ── Init nodes & edges ─────────────────────────────────────────────
  useEffect(() => {
    const initNodes: FlowNode[] = nodeLayout.map(n => ({
      ...n,
      status: 'online' as NodeStatus,
      pressure: 0,
      eventCount: 0,
    }));
    setNodes(initNodes);
    nodesRef.current = initNodes;

    setEdges(edgeList.map(([from, to]) => ({
      from, to,
      totalPackets: 0,
      errorPackets: 0,
      avgLatency: 0,
      pressure: 0,
      lastActivity: 0,
    })));
    edgesRef.current = edgeList.map(([from, to]) => ({
      from, to,
      totalPackets: 0,
      errorPackets: 0,
      avgLatency: 0,
      pressure: 0,
      lastActivity: 0,
    }));
  }, []);

  // ── Compute control points ─────────────────────────────────────────
  // Reads `nodes` directly (not nodesRef) so we never race with the ref
  // sync effect. Uses `nodes.length` as dep so it only recomputes when nodes
  // are added/removed (positions are set once at init and never change).
  const cpMap = useMemo(() => {
    const map = new Map<string, ControlPoints>();
    if (nodes.length === 0) return map;
    edgeList.forEach(([fromId, toId]) => {
      const fn = nodes.find(n => n.id === fromId);
      const tn = nodes.find(n => n.id === toId);
      if (fn && tn) {
        map.set(`${fromId}-${toId}`, computeControlPoints(fn.x, fn.y, tn.x, tn.y));
      }
    });
    return map;
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes.length]);

  useEffect(() => { cpMapRef.current = cpMap; }, [cpMap]);

  // ── Health matrix → node status ────────────────────────────────────
  useEffect(() => {
    if (!healthMatrix?.length) return;
    setNodes(prev => prev.map(node => {
      const match = healthMatrix.find(h => {
        const name = (h.name || '').toLowerCase();
        const id = node.id.toLowerCase();
        return name.includes(id) || id.includes(name) ||
          (id === 'gemini' && name.includes('gemini')) ||
          (id === 'render' && (name.includes('card') || name.includes('render'))) ||
          (id === 'connectors' && (name.includes('facebook') || name.includes('connector'))) ||
          (id === 'frontend' && name.includes('frontend'));
      });
      if (!match) return node;
      const newStatus: NodeStatus =
        match.status === 'online' ? 'online' :
        match.status === 'degraded' ? 'degraded' : 'offline';
      if (node.status === 'offline' && newStatus === 'online') {
        return {
          ...node,
          status: 'online' as NodeStatus,
          failureReason: undefined,
          recoveredAt: Date.now(),
          latency: match.latency,
        };
      }
      return { ...node, status: newStatus, latency: match.latency };
    }));
  }, [healthMatrix]);

  // ── Pressure decay loop ────────────────────────────────────────────
  useEffect(() => {
    pressureDecayRef.current = setInterval(() => {
      setNodes(prev => prev.map(n => ({
        ...n,
        pressure: Math.max(0, n.pressure * PRESSURE_DECAY),
      })));
      setEdges(prev => prev.map(e => ({
        ...e,
        pressure: Math.max(0, e.pressure * PRESSURE_DECAY),
      })));
      // Decay anomaly points; update both state (UI) and ref (rAF loop)
      setAnomalyPoints(prev => {
        const next = prev
          .map(a => ({ ...a, intensity: a.intensity * 0.92, decay: a.decay + 1 }))
          .filter(a => a.intensity > 0.01 && a.decay < 60);
        anomalyPointsRef.current = next;
        return next;
      });
    }, 2000);
    return () => {
      if (pressureDecayRef.current) clearInterval(pressureDecayRef.current);
    };
  }, []);

  // ── rAF canvas animation ───────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const drawFrame = (time: number) => {
      animFrameRef.current = requestAnimationFrame(drawFrame);
      const dt = Math.min(time - lastTimeRef.current, 50);
      lastTimeRef.current = time;
      if (dt <= 0) return;

      const W = canvas.offsetWidth;
      const H = canvas.offsetHeight;
      if (!W || !H) return;

      if (canvas.width !== W || canvas.height !== H) {
        canvas.width = W;
        canvas.height = H;
      }

      const ctx = canvas.getContext('2d', { alpha: true });
      if (!ctx) return;

      ctx.clearRect(0, 0, W, H);

      const speed = 0.025 * (dt / 30);
      const currentNodes = nodesRef.current;
      const toDelete: string[] = [];

      // ── Draw telemetry field ───────────────────────────────────
      drawTelemetryField(ctx, W, H, time);

      // ── Animate particles ──────────────────────────────────────
      particlesByEdgeRef.current.forEach((particles, edgeKey) => {
        const sep = edgeKey.indexOf('-');
        const fromId = edgeKey.slice(0, sep);
        const toId = edgeKey.slice(sep + 1);
        const fn = currentNodes.find(n => n.id === fromId);
        const tn = currentNodes.find(n => n.id === toId);
        if (!fn || !tn) return;

        const cp = cpMapRef.current.get(edgeKey);

        for (const p of particles) {
          p.progress = Math.min(1, p.progress + speed);
          p.opacity = Math.max(0, 1 - p.progress * 1.3);
        }

        const alive = particles.filter(p => p.progress < 1 && p.opacity > 0.02);
        if (alive.length === 0) { toDelete.push(edgeKey); return; }
        particlesByEdgeRef.current.set(edgeKey, alive);

        for (const p of alive) {
          let rawX: number, rawY: number;
          if (cp) {
            const pt = bezierAt(fn.x, fn.y, tn.x, tn.y, cp, p.progress);
            rawX = (pt.x / 100) * W;
            rawY = (pt.y / 100) * H;
          } else {
            rawX = ((fn.x + (tn.x - fn.x) * p.progress) / 100) * W;
            rawY = ((fn.y + (tn.y - fn.y) * p.progress) / 100) * H;
          }

          const px = rawX;
          const py = rawY;

          // Ribbon trail
          if (!p.ribbon) p.ribbon = [];
          p.ribbon.push({ x: px, y: py, opacity: p.opacity });
          if (p.ribbon.length > RIBBON_LENGTH) p.ribbon.shift();

          // Draw ribbon
          if (p.ribbon.length > 1) {
            ctx.save();
            for (let i = 0; i < p.ribbon.length - 1; i++) {
              const t = p.ribbon[i];
              ctx.globalAlpha = t.opacity * 0.2 * (i / p.ribbon.length);
              ctx.fillStyle = p.isError ? '#ef4444' : '#818cf8';
              ctx.beginPath();
              ctx.arc(t.x, t.y, 1.5, 0, Math.PI * 2);
              ctx.fill();
            }
            ctx.restore();
          }

          // Core particle
          ctx.save();
          ctx.globalAlpha = p.opacity * 0.8;
          ctx.shadowColor = p.isError ? '#ef4444' : '#818cf8';
          ctx.shadowBlur = p.isError ? 8 : 4;
          ctx.fillStyle = p.isError ? '#ef4444' : '#c7d2fe';
          ctx.beginPath();
          ctx.arc(px, py, p.isError ? 2 : 1.5, 0, Math.PI * 2);
          ctx.fill();
          ctx.restore();
        }
      });

      toDelete.forEach(k => particlesByEdgeRef.current.delete(k));

      // ── Draw anomaly points ────────────────────────────────────
      drawAnomalyField(ctx, W, H);

      // ── Draw minimap ───────────────────────────────────────────
      drawMinimap(ctx, W, H);
    };

    animFrameRef.current = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(animFrameRef.current);
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  // TELEMETRY FIELD
  // ═══════════════════════════════════════════════════════════════════

  const drawTelemetryField = (
    ctx: CanvasRenderingContext2D, W: number, H: number, time: number,
  ) => {
    ctx.save();
    ctx.globalAlpha = 0.03;
    const gridSize = 32;
    for (let x = 0; x < W; x += gridSize) {
      for (let y = 0; y < H; y += gridSize) {
        const noise = Math.sin(x * 0.01 + time * 0.001) * Math.cos(y * 0.01 + time * 0.0007) * 0.5 + 0.5;
        if (noise > 0.6) {
          ctx.fillStyle = '#6366f1';
          ctx.fillRect(x, y, 1, 1);
        }
      }
    }
    ctx.restore();
  };

  // ═══════════════════════════════════════════════════════════════════
  // ANOMALY FIELD
  // ═══════════════════════════════════════════════════════════════════

  const drawAnomalyField = (ctx: CanvasRenderingContext2D, W: number, H: number) => {
    // Read from ref so the rAF closure always sees up-to-date anomaly data
    const points = anomalyPointsRef.current;
    for (const pt of points) {
      ctx.save();
      const gradient = ctx.createRadialGradient(pt.x, pt.y, 0, pt.x, pt.y, 40 * pt.intensity);
      gradient.addColorStop(0, `rgba(239, 68, 68, ${pt.intensity * 0.3})`);
      gradient.addColorStop(1, 'rgba(239, 68, 68, 0)');
      ctx.fillStyle = gradient;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, 40 * pt.intensity, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  };

  // ═══════════════════════════════════════════════════════════════════
  // MINIMAP (abstract geometry only)
  // ═══════════════════════════════════════════════════════════════════

  const drawMinimap = (ctx: CanvasRenderingContext2D, W: number, H: number) => {
    // Read from ref so the rAF closure sees the current toggle value
    if (!showMinimapRef.current) return;
    const mw = 100, mh = 70, mx = W - mw - 10, my = 10;
    const r = 8;

    ctx.save();
    ctx.fillStyle = 'rgba(12, 12, 20, 0.9)';
    ctx.strokeStyle = 'rgba(99, 102, 241, 0.15)';
    ctx.lineWidth = 1;

    // Manual rounded rect (no roundRect dependency)
    ctx.beginPath();
    ctx.moveTo(mx + r, my);
    ctx.lineTo(mx + mw - r, my);
    ctx.arcTo(mx + mw, my, mx + mw, my + r, r);
    ctx.lineTo(mx + mw, my + mh - r);
    ctx.arcTo(mx + mw, my + mh, mx + mw - r, my + mh, r);
    ctx.lineTo(mx + r, my + mh);
    ctx.arcTo(mx, my + mh, mx, my + mh - r, r);
    ctx.lineTo(mx, my + r);
    ctx.arcTo(mx, my, mx + r, my, r);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Abstract node dots (no labels)
    nodesRef.current.forEach(node => {
      const nx = mx + (node.x / 100) * mw;
      const ny = my + (node.y / 100) * mh;
      const alpha = 0.3 + node.pressure * 0.7;
      ctx.fillStyle = STATUS_COLORS[node.status] || '#52525b';
      ctx.globalAlpha = alpha;
      ctx.beginPath();
      ctx.arc(nx, ny, 1.5 + node.pressure * 2, 0, Math.PI * 2);
      ctx.fill();
    });
    ctx.globalAlpha = 1;

    // Viewport indicator
    const vx = mx + (50 / 100) * mw - (mw / scaleRef.current) / 2;
    const vy = my + (50 / 100) * mh - (mh / scaleRef.current) / 2;
    ctx.strokeStyle = 'rgba(129, 140, 248, 0.4)';
    ctx.lineWidth = 1;
    ctx.strokeRect(vx, vy, mw / scaleRef.current, mh / scaleRef.current);

    ctx.restore();
  };

  // ═══════════════════════════════════════════════════════════════════
  // SOCKET HANDLERS (normalized through RuntimeSignal)
  // ═══════════════════════════════════════════════════════════════════

  useEffect(() => {
    if (!socket) return;

    const spawnParticle = (
      fromId: string, toId: string, isError: boolean, traceId: string, latency?: number,
    ) => {
      const key = `${fromId}-${toId}`;
      const existing = particlesByEdgeRef.current.get(key) || [];
      particlesByEdgeRef.current.set(key, [
        ...existing.slice(-20),
        {
          id: `pkt_${packetIdRef.current++}`,
          traceId,
          progress: 0,
          opacity: 1,
          isError,
          latency,
          ribbon: [],
        },
      ]);

      // Update edge stats
      setEdges(prev => prev.map(edge => {
        if (edge.from !== fromId || edge.to !== toId) return edge;
        const newTotal = edge.totalPackets + 1;
        return {
          ...edge,
          totalPackets: newTotal,
          errorPackets: edge.errorPackets + (isError ? 1 : 0),
          avgLatency: Math.round(
            (edge.avgLatency * edge.totalPackets + (latency || 0)) / newTotal,
          ),
          pressure: Math.min(1, edge.pressure + 0.15),
          lastActivity: Date.now(),
        };
      }));

      // Update node pressure
      setNodes(prev => prev.map(n => {
        if (n.id === fromId || n.id === toId) {
          return {
            ...n,
            pressure: Math.min(1, n.pressure + 0.1),
            eventCount: n.eventCount + 1,
          };
        }
        return n;
      }));

      totalEventsRef.current += 1;
      setTotalEvents(p => p + 1);
      if (isError) {
        setFailureEvents(p => p + 1);
        // Spawn anomaly point
        const fn = nodesRef.current.find(n => n.id === fromId);
        const tn = nodesRef.current.find(n => n.id === toId);
        if (fn && tn) {
          const ax = ((fn.x + tn.x) / 200) * (canvasRef.current?.offsetWidth || 1080);
          const ay = ((fn.y + tn.y) / 200) * (canvasRef.current?.offsetHeight || 1080);
          setAnomalyPoints(prev => [
            ...prev.slice(-ANOMALY_MAX),
            { x: ax, y: ay, intensity: 1, decay: 0 },
          ]);
        }
      }
    };

    const handleSignal = (eventName: string) => (data: any) => {
      const signal = normalizeSignal(eventName, data, traceIdRef);
      if (!signal) return;

      spawnParticle(
        signal.source, signal.target, signal.severity === 'critical',
        signal.traceId, signal.latency,
      );

      // Track trace
      const existing = tracesRef.current.get(signal.traceId);
      if (existing) {
        existing.signals.push(signal);
        existing.endTime = Date.now();
        existing.totalLatency += signal.latency || 0;
        existing.path.push(signal.target);
        if (signal.severity === 'critical') existing.status = 'failed';
      } else {
        tracesRef.current.set(signal.traceId, {
          traceId: signal.traceId,
          signals: [signal],
          startTime: Date.now(),
          endTime: Date.now(),
          totalLatency: signal.latency || 0,
          path: [signal.source, signal.target],
          status: signal.severity === 'critical' ? 'failed' : 'active',
          ribbonProgress: 0,
        });
      }

      // Cleanup old traces
      if (tracesRef.current.size > MAX_TRACES) {
        const oldest = [...tracesRef.current.entries()]
          .sort(([, a], [, b]) => a.startTime - b.startTime)[0];
        if (oldest) tracesRef.current.delete(oldest[0]);
      }

      setActiveTraces(tracesRef.current.size);
    };

    // Cache handler instances so socket.off receives the SAME function reference
    // that was passed to socket.on. Calling handleSignal() twice creates two
    // different closures — the original listener would never be removed.
    const handlers = {
      traffic_packet:  handleSignal('traffic_packet'),
      new_message:     handleSignal('new_message'),
      post_published:  handleSignal('post_published'),
      worker_error:    handleSignal('worker_error'),
      provider_failed: handleSignal('provider_failed'),
    };

    socket.on('traffic_packet',  handlers.traffic_packet);
    socket.on('new_message',     handlers.new_message);
    socket.on('post_published',  handlers.post_published);
    socket.on('worker_error',    handlers.worker_error);
    socket.on('provider_failed', handlers.provider_failed);

    // Bug fix: `let lastTotal = 0;` was accidentally commented out on the
    // same line as the comment, leaving the variable undeclared in the closure.
    let lastTotal = 0;
    const epsInterval = setInterval(() => {
      const diff = totalEventsRef.current - lastTotal;
      lastTotal = totalEventsRef.current;
      setEventsPerSec(Math.max(0, diff));

      // Calculate anomaly index
      const recentFailures = failureEvents;
      const recentTotal = totalEventsRef.current;
      setAnomalyIndex(recentTotal > 0 ? recentFailures / Math.max(recentTotal, 1) : 0);

      // Calculate execution drift
      const traces = [...tracesRef.current.values()];
      if (traces.length > 0) {
        const avgLatency = traces.reduce((s, t) => s + t.totalLatency, 0) / traces.length;
        setExecutionDrift(Math.round(avgLatency * 10) / 10);
      }
    }, 1000);

    return () => {
      socket.off('traffic_packet',  handlers.traffic_packet);
      socket.off('new_message',     handlers.new_message);
      socket.off('post_published',  handlers.post_published);
      socket.off('worker_error',    handlers.worker_error);
      socket.off('provider_failed', handlers.provider_failed);
      clearInterval(epsInterval);
    };
  }, [socket]);

  // ═══════════════════════════════════════════════════════════════════
  // EDGE FADE (adaptive topology)
  // ═══════════════════════════════════════════════════════════════════

  const getEdgeOpacity = useCallback((edge: FlowEdge): number => {
    const elapsed = Date.now() - edge.lastActivity;
    if (elapsed < 5000) return Math.min(1, 0.4 + edge.pressure);
    if (elapsed > EDGE_FADE_MS) return 0.06;
    return 0.4 - (0.34 * (elapsed - 5000)) / (EDGE_FADE_MS - 5000);
  }, []);

  // ═══════════════════════════════════════════════════════════════════
  // ZOOM / PAN
  // ═══════════════════════════════════════════════════════════════════

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale(prev => Math.min(2.5, Math.max(0.4, prev - e.deltaY * 0.001)));
  }, []);

  const zoomIn = () => setScale(prev => Math.min(2.5, prev + 0.2));
  const zoomOut = () => setScale(prev => Math.max(0.4, prev - 0.2));

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-pan]')) return;
    panRef.current = {
      isDragging: true, startX: e.clientX, startY: e.clientY,
      basePanX: panOffsetRef.current.x, basePanY: panOffsetRef.current.y,
    };
    setIsDragging(true);
  }, []);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!panRef.current.isDragging) return;
    setPanOffset({
      x: panRef.current.basePanX + (e.clientX - panRef.current.startX),
      y: panRef.current.basePanY + (e.clientY - panRef.current.startY),
    });
  }, []);

  const handleMouseUp = useCallback(() => {
    panRef.current.isDragging = false;
    setIsDragging(false);
  }, []);

  const resetView = useCallback(() => { setScale(1); setPanOffset({ x: 0, y: 0 }); }, []);

  // ═══════════════════════════════════════════════════════════════════
  // DERIVED
  // ═══════════════════════════════════════════════════════════════════

  const getNodeStatus = useCallback((node: FlowNode): string => {
    if (node.status === 'offline' || node.status === 'degraded' || node.status === 'thinking') {
      return node.status;
    }
    if (node.pressure > 0.3) return 'active';
    if (node.eventCount > 0) return 'active';
    return node.status;
  }, []);

  const offlineCount = useMemo(
    () => nodes.filter(n => getNodeStatus(n) === 'offline').length,
    [nodes, getNodeStatus],
  );
  const totalTraffic = useMemo(() => edges.reduce((s, e) => s + e.totalPackets, 0), [edges]);
  const systemHealthy = offlineCount === 0;

  // ═══════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════

  return (
    // LazyMotion loads the animation engine on demand in this code-split chunk.
    // This avoids the "F is not a constructor" crash that occurs when the `motion`
    // Proxy object is referenced before the animation feature bundle has fully
    // initialised in a Vite production chunk.
    <LazyMotion features={domAnimation} strict>
    <div className={cn(
      'flex flex-col gap-2',
      isFullscreen
        ? 'fixed inset-0 z-50 bg-[#060610]/98 backdrop-blur-sm p-4'
        : 'w-full h-full',
    )}>
      {/* ── Header ────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-indigo-500/10 rounded-lg border border-indigo-500/20">
            <Radio className="w-3.5 h-3.5 text-indigo-400" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-white tracking-widest uppercase">
              Runtime Fabric
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className={cn(
                'w-1.5 h-1.5 rounded-full',
                systemHealthy ? 'bg-emerald-400 animate-pulse' : 'bg-red-400 animate-pulse',
              )} />
              <p className="text-[8px] text-zinc-500 font-mono uppercase tracking-[0.15em]">
                {systemHealthy ? 'Nominal' : `${offlineCount} OFFLINE`}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1">
          <span className="text-[9px] font-mono text-zinc-600">
            {eventsPerSec.toFixed(1)}/s · {totalTraffic.toLocaleString()}
          </span>
          <button onClick={zoomOut} className="p-1 rounded hover:bg-zinc-800 text-zinc-500">
            <ZoomOut className="w-3 h-3" />
          </button>
          <span className="text-[9px] font-mono text-zinc-600 w-8 text-center">
            {Math.round(scale * 100)}%
          </span>
          <button onClick={zoomIn} className="p-1 rounded hover:bg-zinc-800 text-zinc-500">
            <ZoomIn className="w-3 h-3" />
          </button>
          <button
            onClick={() => setShowSemantic(p => !p)}
            className={cn(
              'px-2 py-1 rounded text-[9px] font-mono font-bold uppercase tracking-wider transition-all',
              showSemantic
                ? 'bg-indigo-500/20 text-indigo-400 border border-indigo-500/30'
                : 'text-zinc-600 border border-zinc-800 hover:text-zinc-400',
            )}
          >
            Semantic
          </button>
          <button
            onClick={() => setShowMinimap(p => !p)}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-500"
          >
            <MapIcon className="w-3 h-3" />
          </button>
          <button onClick={resetView} className="p-1 rounded hover:bg-zinc-800 text-zinc-500">
            <RotateCcw className="w-3 h-3" />
          </button>
          <button
            onClick={() => setIsFullscreen(p => !p)}
            className="p-1 rounded hover:bg-zinc-800 text-zinc-500"
          >
            {isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}
          </button>
        </div>
      </div>

      {/* ── Topology Canvas ────────────────────────────────────────── */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="relative flex-1 bg-[#060610]/80 border border-zinc-800/50 rounded-2xl overflow-hidden select-none"
        style={{
          cursor: isDragging ? 'grabbing' : 'grab',
          minHeight: '480px',
          boxShadow: 'inset 0 0 120px rgba(99, 102, 241, 0.03)',
        }}
      >
        {/* System status ring */}
        {!systemHealthy && (
          <div
            className="absolute inset-0 pointer-events-none rounded-2xl animate-pulse"
            style={{ boxShadow: 'inset 0 0 60px rgba(239, 68, 68, 0.08)' }}
          />
        )}

        <div
          className="absolute inset-0"
          style={{
            transform: `translate(${panOffset.x}px, ${panOffset.y}px) scale(${scale})`,
            transformOrigin: 'center center',
            transition: isDragging ? 'none' : 'transform 0.1s ease-out',
          }}
        >
          {/* ── SVG Edges ────────────────────────────────────────── */}
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <filter id="edge-glow">
                <feGaussianBlur stdDeviation="0.3" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {edges.map(edge => {
              const fn = nodes.find(n => n.id === edge.from);
              const tn = nodes.find(n => n.id === edge.to);
              if (!fn || !tn) return null;

              const cp = cpMapRef.current.get(`${edge.from}-${edge.to}`)
                ?? computeControlPoints(fn.x, fn.y, tn.x, tn.y);
              const d = bezierPath(fn.x, fn.y, tn.x, tn.y, cp);

              const hasTraffic = edge.totalPackets > 0;
              const errorRate = edge.totalPackets > 0
                ? edge.errorPackets / edge.totalPackets : 0;
              const opacity = getEdgeOpacity(edge);
              const strokeColor = errorRate > 0.3 ? '#ef4444'
                : hasTraffic ? '#818cf8' : '#27272a';
              const strokeW = hasTraffic
                ? Math.min(2.5, 0.8 + edge.pressure * 2) : 0.4;
              const edgePressure = edge.pressure;

              return (
                <g key={`${edge.from}-${edge.to}`}>
                  <path d={d} fill="none" stroke="transparent" strokeWidth="14"
                    style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                    onClick={() => {
                      const traces = [...tracesRef.current.values()]
                        .filter(t => t.path.includes(edge.from) && t.path.includes(edge.to))
                        .slice(-1);
                      setSelectedTrace(traces[0] || null);
                    }}
                  />
                  <path d={d} fill="none" stroke={strokeColor} strokeWidth={strokeW}
                    opacity={opacity} strokeLinecap="round" filter="url(#edge-glow)" />
                  {hasTraffic && edgePressure > 0.2 && (
                    <path d={d} fill="none" stroke={strokeColor}
                      strokeWidth={strokeW * 0.4} opacity={opacity * 0.4}
                      strokeLinecap="round" strokeDasharray={`${2 + edgePressure * 6} ${14 - edgePressure * 8}`}
                      style={{ animation: `dfv13-flow ${1.8 - edgePressure}s linear infinite` }} />
                  )}
                </g>
              );
            })}
          </svg>

          {/* ── Canvas (particles) ────────────────────────────────── */}
          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 10 }}
          />

          {/* ── Nodes ─────────────────────────────────────────────── */}
          {nodes.map(node => {
            // Resolve icon at render-time from the stable registry — never read
            // icon components from state to avoid "F is not a constructor".
            const Icon = resolveIcon(node.iconId);
            const status = getNodeStatus(node);
            const color = STATUS_COLORS[status] || '#52525b';
            const isHov = hoveredNode === node.id;
            const nodePressure = node.pressure;
            const displayLabel = showSemantic
              ? node.label
              : NODE_VISUAL_IDS[node.id] || node.id.toUpperCase();
            // Build a safe 2-digit hex alpha (0x00–0xff) for the boxShadow color.
            // Without padding, values < 16 would produce a single-digit hex,
            // making the color string invalid (e.g. "#22c55e8" instead of "#22c55e08").
            const pressureAlphaHex = Math.round(nodePressure * 40)
              .toString(16).padStart(2, '0');

            return (
              <div
                key={node.id}
                data-no-pan
                className="absolute flex flex-col items-center gap-0.5 pointer-events-auto z-20"
                style={{
                  left: `${node.x}%`,
                  top: `${node.y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
                onMouseEnter={() => setHoveredNode(node.id)}
                onMouseLeave={() => setHoveredNode(null)}
                onMouseDown={e => e.stopPropagation()}
              >
                {/* Pressure ring */}
                {nodePressure > 0.15 && (
                  <div
                    className="absolute -inset-2 rounded-full animate-pulse"
                    style={{
                      border: `1px solid ${color}`,
                      opacity: nodePressure * 0.5,
                      boxShadow: `0 0 ${12 * nodePressure}px ${color}${pressureAlphaHex}`,
                    }}
                  />
                )}

                <div
                  className="p-2.5 rounded-xl cursor-pointer relative transition-transform duration-150 hover:scale-110 active:scale-90"
                  style={{
                    backgroundColor: `${color}10`,
                    border: `1px solid ${color}30`,
                    boxShadow: nodePressure > 0.2
                      ? `0 0 ${10 * nodePressure}px ${color}20`
                      : undefined,
                  }}
                >
                  <Icon className="w-4 h-4" style={{ color }} />
                </div>

                <span className="text-[8px] font-mono font-bold text-zinc-500 text-center leading-tight max-w-[65px] tracking-wider">
                  {displayLabel}
                </span>

                <div className="w-1 h-1 rounded-full flex-shrink-0" style={{
                  backgroundColor: color,
                  boxShadow: `0 0 4px ${color}40`,
                }} />

                {/* ── Tooltip ────────────────────────────────────── */}
                <AnimatePresence>
                  {isHov && (
                    <m.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.12 }}
                      className="absolute bottom-full mb-2 bg-[#0a0a14]/98 backdrop-blur-xl border border-zinc-700/60 rounded-xl px-3.5 py-3 shadow-2xl z-50 pointer-events-none w-56"
                      style={{ left: '50%', transform: 'translateX(-50%)' }}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-bold text-white font-mono tracking-wider">
                          {displayLabel}
                        </p>
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                      </div>

                      <div className="border-t border-zinc-800/50 pt-2 space-y-1">
                        <div className="flex justify-between text-[9px] font-mono">
                          <span className="text-zinc-500">IDENTITY</span>
                          <span className="text-zinc-300">{node.label}</span>
                        </div>
                        <div className="flex justify-between text-[9px] font-mono">
                          <span className="text-zinc-500">DOMAIN</span>
                          <span className="text-zinc-400">
                            {NODE_METADATA[node.id]?.domain || '—'}
                          </span>
                        </div>
                        <div className="flex justify-between text-[9px] font-mono">
                          <span className="text-zinc-500">STATE</span>
                          <span style={{ color }}>{STATUS_LABELS[status]}</span>
                        </div>
                        {node.latency !== undefined && (
                          <div className="flex justify-between text-[9px] font-mono">
                            <span className="text-zinc-500">LATENCY</span>
                            <span className="text-indigo-400">{node.latency}ms</span>
                          </div>
                        )}
                        <div className="flex justify-between text-[9px] font-mono">
                          <span className="text-zinc-500">PRESSURE</span>
                          <span className="text-zinc-400">
                            {nodePressure.toFixed(2)}
                          </span>
                        </div>
                        <div className="flex justify-between text-[9px] font-mono">
                          <span className="text-zinc-500">EVENTS</span>
                          <span className="text-emerald-400">{node.eventCount}</span>
                        </div>
                      </div>
                    </m.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* ── Trace Inspector ─────────────────────────────────────── */}
        <AnimatePresence>
          {selectedTrace && (
            <m.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute top-2 left-1/2 -translate-x-1/2 bg-[#0a0a14]/98 backdrop-blur-xl border border-zinc-700/60 rounded-xl px-4 py-3 shadow-2xl z-40 pointer-events-auto max-w-md"
            >
              <div className="flex items-center justify-between mb-2">
                <p className="text-[10px] font-mono font-bold text-zinc-400 uppercase tracking-wider">
                  Trace Inspector
                </p>
                <button
                  onClick={() => setSelectedTrace(null)}
                  className="text-zinc-600 hover:text-zinc-300 text-xs"
                >
                  ✕
                </button>
              </div>
              <p className="text-[9px] font-mono text-zinc-600 mb-2 truncate">
                {selectedTrace.traceId}
              </p>
              <div className="space-y-0.5">
                {selectedTrace.path.map((nodeId, i) => (
                  <div key={i} className="flex items-center gap-2 text-[9px] font-mono">
                    <span className="text-zinc-500 w-6 text-right">
                      {NODE_VISUAL_IDS[nodeId] || nodeId}
                    </span>
                    {i < selectedTrace.path.length - 1 && (
                      <>
                        <span className="text-zinc-700">↓</span>
                        <span className="text-indigo-400">
                          {selectedTrace.signals[i]?.latency || '—'}ms
                        </span>
                      </>
                    )}
                  </div>
                ))}
              </div>
              <div className="border-t border-zinc-800/50 mt-2 pt-2 flex justify-between text-[9px] font-mono">
                <span className="text-zinc-500">TOTAL</span>
                <span className="text-indigo-400">{selectedTrace.totalLatency}ms</span>
                <span className={cn(
                  'uppercase font-bold',
                  selectedTrace.status === 'committed' ? 'text-emerald-400'
                    : selectedTrace.status === 'failed' ? 'text-red-400'
                    : 'text-amber-400',
                )}>
                  {selectedTrace.status}
                </span>
              </div>
            </m.div>
          )}
        </AnimatePresence>

        {/* ── Status Bar ──────────────────────────────────────────── */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-[#060610]/98 backdrop-blur-xl border-t border-zinc-800/50 px-3 py-1.5 text-[9px] font-mono z-30 pointer-events-none rounded-b-2xl">
          <div className="flex items-center gap-3">
            <span className="text-zinc-600">
              TRACE DENSITY <span className="text-zinc-400">{eventsPerSec.toFixed(1)}/s</span>
            </span>
            <span className="text-zinc-600">
              SPANS <span className="text-zinc-400">{activeTraces}</span>
            </span>
            <span className="text-zinc-600">
              ANOMALY{' '}
              <span className={cn(
                anomalyIndex > 0.1 ? 'text-red-400' : 'text-zinc-400',
              )}>
                {anomalyIndex.toFixed(2)}
              </span>
            </span>
            <span className="text-zinc-600">
              DRIFT{' '}
              <span className="text-zinc-400">+{executionDrift}ms</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-zinc-700 text-[7px] uppercase">scroll zoom · drag pan</span>
            <span className={cn(
              'w-1 h-1 rounded-full',
              systemHealthy ? 'bg-emerald-400' : 'bg-red-400',
            )} />
            <span className="text-zinc-500 uppercase text-[8px]">
              {systemHealthy ? 'Nominal' : `${offlineCount} Offline`}
            </span>
          </div>
        </div>
      </div>
    </div>
    </LazyMotion>
  );
}
