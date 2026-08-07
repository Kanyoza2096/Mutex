// ═══════════════════════════════════════════════════════════════════════════
// DATA FLOW VISUALIZER — v13
// v12 bezier edges + v12.1 polish + new features · no search box · thin status bar
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from 'react';
import { LazyMotion, domAnimation, m, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import {
  Cpu, Zap, Activity, MessageCircle, Send, Globe, Server, Database,
  AlertTriangle, Maximize2, Minimize2, RotateCcw, Network,
  Eye, EyeOff, Map as MapIcon, ZoomIn, ZoomOut,
} from 'lucide-react';
import { cn } from '../lib/utils';

// ── Icon registry ──────────────────────────────────────────────────────────
// Keep icon component refs out of React state to prevent "F is not a constructor"
// in production builds where chunk init order may leave a ref undefined.

type IconComponent = React.ComponentType<{ className?: string; style?: React.CSSProperties }>;

const ICON_MAP: Record<string, IconComponent> = {
  Globe, Cpu, Zap, Activity, MessageCircle, Send, Server, Database,
  AlertTriangle, Network,
};

function resolveIcon(iconId: string): IconComponent {
  return (ICON_MAP[iconId] ?? Activity) as IconComponent;
}

// ── Types ──────────────────────────────────────────────────────────────────

export interface FlowNode {
  id: string;
  label: string;
  // Store icon string ID — resolved at render time via resolveIcon()
  iconId: string;
  x: number;
  y: number;
  status: 'online' | 'degraded' | 'offline' | 'active' | 'thinking';
  failureReason?: string;
  recoveredAt?: number;
  latency?: number;
}

interface TrafficPacket {
  id: string;
  progress: number;
  opacity: number;
  isError: boolean;
  latency?: number;
  method?: string;
  path?: string;
  trail: { x: number; y: number; opacity: number }[];
}

interface FlowEdge {
  from: string;
  to: string;
  totalPackets: number;
  errorPackets: number;
  avgLatency: number;
}

type PacketMap = Map<string, TrafficPacket[]>;

interface ControlPoints {
  cx1: number; cy1: number;
  cx2: number; cy2: number;
}

// ── Default layouts ────────────────────────────────────────────────────────

export const DEFAULT_NODE_LAYOUT: Omit<FlowNode, 'status'>[] = [
  { id: 'frontend',   label: 'Frontend',         iconId: 'Globe',         x: 50,  y: 5  },
  { id: 'gemini',     label: 'Gemini AI',        iconId: 'Cpu',           x: 50,  y: 17 },
  { id: 'pipeline',   label: 'Pipeline',         iconId: 'Zap',           x: 50,  y: 29 },
  { id: 'render',     label: 'Card Renderer',    iconId: 'Activity',      x: 80,  y: 29 },
  { id: 'command',    label: 'Command Executor', iconId: 'MessageCircle', x: 16,  y: 43 },
  { id: 'scheduler',  label: 'Scheduler',        iconId: 'Send',          x: 50,  y: 43 },
  { id: 'connectors', label: 'Connectors',       iconId: 'Server',        x: 50,  y: 57 },
  { id: 'supabase',   label: 'Supabase',         iconId: 'Database',      x: 28,  y: 73 },
  { id: 'redis',      label: 'Redis',            iconId: 'Database',      x: 72,  y: 73 },
  { id: 'socketio',   label: 'Socket.IO',        iconId: 'Activity',      x: 50,  y: 85 },
  { id: 'facebook',   label: 'Facebook',         iconId: 'Globe',         x: 16,  y: 57 },
];

export const DEFAULT_EDGES: [string, string][] = [
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

// ── Status maps ────────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  online:   '#22c55e',
  degraded: '#f59e0b',
  offline:  '#ef4444',
  active:   '#3b82f6',
  thinking: '#a855f7',
};

const STATUS_LABELS: Record<string, string> = {
  online:   'Healthy',
  degraded: 'Degraded',
  offline:  'Down',
  active:   'Active',
  thinking: 'Generating',
};

// ── Bezier helpers (v12 proven math) ──────────────────────────────────────

function computeControlPoints(x1: number, y1: number, x2: number, y2: number): ControlPoints {
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

function bezierPath(x1: number, y1: number, x2: number, y2: number, cp: ControlPoints): string {
  return `M${x1},${y1} C${cp.cx1},${cp.cy1} ${cp.cx2},${cp.cy2} ${x2},${y2}`;
}

function bezierAt(x1: number, y1: number, x2: number, y2: number, cp: ControlPoints, t: number): { x: number; y: number } {
  const mt = 1 - t;
  return {
    x: mt * mt * mt * x1 + 3 * mt * mt * t * cp.cx1 + 3 * mt * t * t * cp.cx2 + t * t * t * x2,
    y: mt * mt * mt * y1 + 3 * mt * mt * t * cp.cy1 + 3 * mt * t * t * cp.cy2 + t * t * t * y2,
  };
}

// ═══════════════════════════════════════════════════════════════════════════

export interface DataFlowVisualizerProps {
  nodeLayout?: Omit<FlowNode, 'status'>[];
  edgeList?: [string, string][];
}

export default function DataFlowVisualizer({
  nodeLayout = DEFAULT_NODE_LAYOUT,
  edgeList = DEFAULT_EDGES,
}: DataFlowVisualizerProps) {
  const { socket, healthMatrix } = useStore();

  const [nodes, setNodes] = useState<FlowNode[]>([]);
  const [edges, setEdges] = useState<FlowEdge[]>([]);
  const [eventsPerSec, setEventsPerSec] = useState(0);
  const [totalEvents, setTotalEvents] = useState(0);
  const [failureEvents, setFailureEvents] = useState(0);
  const [hoveredNode, setHoveredNode] = useState<string | null>(null);
  const [scale, setScale] = useState(1);
  const [panOffset, setPanOffset] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [showLabels, setShowLabels] = useState(true);
  const [showMinimap, setShowMinimap] = useState(true);
  const [selectedEdge, setSelectedEdge] = useState<{ from: string; to: string } | null>(null);

  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef    = useRef<HTMLCanvasElement>(null);
  const minimapRef   = useRef<HTMLCanvasElement>(null);
  const packetIdRef  = useRef(0);
  const totalEventsRef = useRef(0);
  const packetsByEdgeRef = useRef<PacketMap>(new Map());
  const nodesRef     = useRef<FlowNode[]>([]);
  const cpMapRef     = useRef<Map<string, ControlPoints>>(new Map());
  const panRef       = useRef({ isDragging: false, startX: 0, startY: 0, basePanX: 0, basePanY: 0 });
  const panOffsetRef = useRef({ x: 0, y: 0 });
  const scaleRef     = useRef(1);

  useEffect(() => { nodesRef.current = nodes; }, [nodes]);
  useEffect(() => { panOffsetRef.current = panOffset; }, [panOffset]);
  useEffect(() => { scaleRef.current = scale; }, [scale]);

  // ── Init ──────────────────────────────────────────────────────────────
  useEffect(() => {
    const initNodes = nodeLayout.map(n => ({ ...n, status: 'online' as const }));
    setNodes(initNodes);
    nodesRef.current = initNodes;
    setEdges(edgeList.map(([from, to]) => ({
      from, to, totalPackets: 0, errorPackets: 0, avgLatency: 0,
    })));
  }, []);

  const cpMap = useMemo(() => {
    const map = new Map<string, ControlPoints>();
    edgeList.forEach(([fromId, toId]) => {
      const fn = nodesRef.current.find(n => n.id === fromId);
      const tn = nodesRef.current.find(n => n.id === toId);
      if (fn && tn) map.set(`${fromId}-${toId}`, computeControlPoints(fn.x, fn.y, tn.x, tn.y));
    });
    return map;
  }, []);
  
  useEffect(() => { cpMapRef.current = cpMap; }, [cpMap]);

  // ── Health matrix → node status ───────────────────────────────────────
  useEffect(() => {
    if (!healthMatrix.length) return;
    setNodes(prev => prev.map(node => {
      const match = healthMatrix.find(h => {
        const name = (h.name || '').toLowerCase();
        const id   = node.id.toLowerCase();
        return name.includes(id) || id.includes(name) ||
          (id === 'gemini' && name.includes('gemini')) ||
          (id === 'render' && (name.includes('card') || name.includes('render'))) ||
          (id === 'connectors' && (name.includes('facebook') || name.includes('connector'))) ||
          (id === 'frontend' && name.includes('frontend'));
      });
      if (!match) return node;
      const newStatus = match.status === 'online' ? 'online' : match.status === 'degraded' ? 'degraded' : 'offline';
      if (node.status === 'offline' && newStatus === 'online') {
        return { ...node, status: 'online' as const, failureReason: undefined, recoveredAt: Date.now(), latency: match.latency };
      }
      return { ...node, status: newStatus as FlowNode['status'], latency: match.latency };
    }));
  }, [healthMatrix]);

  // ── rAF canvas animation ──────────────────────────────────────────────
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    let rafId: number;
    let lastTime = 0;

    const drawFrame = (time: number) => {
      rafId = requestAnimationFrame(drawFrame);
      const dt = Math.min(time - lastTime, 50);
      lastTime = time;
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

      const toDelete: string[] = [];
      const speed = 0.022 * (dt / 30);
      const currentScale = scaleRef.current;
      const currentPan = panOffsetRef.current;

      packetsByEdgeRef.current.forEach((packets, edgeKey) => {
        const sep = edgeKey.indexOf('-');
        const fromId = edgeKey.slice(0, sep);
        const toId = edgeKey.slice(sep + 1);
        const fn = nodesRef.current.find(n => n.id === fromId);
        const tn = nodesRef.current.find(n => n.id === toId);
        if (!fn || !tn) return;

        const cp = cpMapRef.current.get(edgeKey);

        for (const p of packets) {
          p.progress = Math.min(1, p.progress + speed);
          p.opacity = Math.max(0, 1 - p.progress * 1.3);
        }

        const alive = packets.filter(p => p.progress < 1 && p.opacity > 0.02);
        if (alive.length === 0) { toDelete.push(edgeKey); return; }
        packetsByEdgeRef.current.set(edgeKey, alive);

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

          const cx = W / 2;
          const cy = H / 2;
          const px = cx + (rawX - cx + currentPan.x) * currentScale;
          const py = cy + (rawY - cy + currentPan.y) * currentScale;

          const r = p.isError ? 3.5 : 2.5;
          const color = p.isError ? '#ef4444' : '#818cf8';

          // Trail effect
          if (!p.trail) p.trail = [];
          p.trail.push({ x: px, y: py, opacity: p.opacity });
          if (p.trail.length > 6) p.trail.shift();

          // Draw trail
          for (let i = 0; i < p.trail.length - 1; i++) {
            const t = p.trail[i];
            ctx.save();
            ctx.globalAlpha = t.opacity * 0.15 * (i / p.trail.length);
            ctx.fillStyle = color;
            ctx.beginPath();
            ctx.arc(t.x, t.y, r * 0.8, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
          }

          // Glow
          ctx.save();
          ctx.globalAlpha = p.opacity * 0.3;
          ctx.shadowColor = color;
          ctx.shadowBlur = p.isError ? 12 : 8;
          ctx.beginPath();
          ctx.arc(px, py, r * 1.5, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.restore();

          // Core dot
          ctx.save();
          ctx.globalAlpha = p.opacity;
          ctx.beginPath();
          ctx.arc(px, py, r, 0, Math.PI * 2);
          ctx.fillStyle = color;
          ctx.fill();
          ctx.restore();
        }
      });

      toDelete.forEach(k => packetsByEdgeRef.current.delete(k));

      // Draw minimap
      drawMinimap(ctx, W, H);
    };

    rafId = requestAnimationFrame(drawFrame);
    return () => cancelAnimationFrame(rafId);
  }, []);

  // ── Minimap ───────────────────────────────────────────────────────────
  const drawMinimap = (ctx: CanvasRenderingContext2D, W: number, H: number) => {
    if (!showMinimap) return;
    const mw = 100, mh = 70, mx = W - mw - 10, my = 10;
    
    ctx.save();
    ctx.fillStyle = 'rgba(24, 24, 27, 0.85)';
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(mx, my, mw, mh, 8);
    ctx.fill();
    ctx.stroke();

    // Mini nodes
    nodesRef.current.forEach(node => {
      const nx = mx + (node.x / 100) * mw;
      const ny = my + (node.y / 100) * mh;
      const color = STATUS_COLORS[node.status] || '#52525b';
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(nx, ny, 2, 0, Math.PI * 2);
      ctx.fill();
    });

    // Viewport indicator
    const vx = mx + (50 / 100) * mw - (mw / scaleRef.current) / 2;
    const vy = my + (50 / 100) * mh - (mh / scaleRef.current) / 2;
    ctx.strokeStyle = 'rgba(129, 140, 248, 0.5)';
    ctx.lineWidth = 1;
    ctx.strokeRect(vx, vy, mw / scaleRef.current, mh / scaleRef.current);

    ctx.restore();
  };

  // ── Socket traffic handler ────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;

    const spawnPacket = (fromId: string, toId: string, isError = false, meta?: Partial<TrafficPacket>) => {
      const key = `${fromId}-${toId}`;
      const existing = packetsByEdgeRef.current.get(key) || [];
      packetsByEdgeRef.current.set(key, [
        ...existing.slice(-12),
        { id: `pkt_${packetIdRef.current++}`, progress: 0, opacity: 1, isError, trail: [], ...meta },
      ]);
    };

    const handleTraffic = (data: any) => {
      const { from_service, to_service, duration_ms, status, error } = data;
      if (!from_service || !to_service) return;
      const isError = (status && status >= 400) || !!error;
      spawnPacket(from_service, to_service, isError, { latency: duration_ms });

      setEdges(prev => prev.map(edge => {
        if (edge.from !== from_service || edge.to !== to_service) return edge;
        const newTotal = edge.totalPackets + 1;
        return {
          ...edge,
          totalPackets: newTotal,
          errorPackets: edge.errorPackets + (isError ? 1 : 0),
          avgLatency: Math.round((edge.avgLatency * edge.totalPackets + (duration_ms || 0)) / newTotal),
        };
      }));

      totalEventsRef.current += 1;
      setTotalEvents(p => p + 1);
      if (isError) setFailureEvents(p => p + 1);
    };

    // Cache handler instances — socket.off must receive the exact same reference
    // that was passed to socket.on or the listener is never actually removed.
    const onNewMessage   = () => spawnPacket('connectors', 'socketio');
    const onPostPublish  = () => spawnPacket('scheduler', 'connectors');
    const onWorkerError  = () => spawnPacket('render', 'connectors', true);
    const onProviderFail = () => spawnPacket('connectors', 'socketio', true);

    socket.on('traffic_packet',  handleTraffic);
    socket.on('new_message',     onNewMessage);
    socket.on('post_published',  onPostPublish);
    socket.on('worker_error',    onWorkerError);
    socket.on('provider_failed', onProviderFail);

    let lastTotal = 0;
    const epsInterval = setInterval(() => {
      const diff = totalEventsRef.current - lastTotal;
      lastTotal = totalEventsRef.current;
      setEventsPerSec(Math.max(0, diff));
    }, 1000);

    return () => {
      socket.off('traffic_packet',  handleTraffic);
      socket.off('new_message',     onNewMessage);
      socket.off('post_published',  onPostPublish);
      socket.off('worker_error',    onWorkerError);
      socket.off('provider_failed', onProviderFail);
      clearInterval(epsInterval);
    };
  }, [socket]);

  // ── Zoom ──────────────────────────────────────────────────────────────
  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    setScale(prev => Math.min(2.5, Math.max(0.4, prev - e.deltaY * 0.001)));
  }, []);

  const zoomIn = () => setScale(prev => Math.min(2.5, prev + 0.2));
  const zoomOut = () => setScale(prev => Math.max(0.4, prev - 0.2));

  // ── Pan ───────────────────────────────────────────────────────────────
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

  const getNodeStatus = useCallback((node: FlowNode): string => {
    if (node.status === 'offline' || node.status === 'degraded' || node.status === 'thinking') return node.status;
    if ((node.id === 'frontend' || node.id === 'connectors') && totalEvents > 0) return 'active';
    if (node.id === 'socketio' && eventsPerSec > 0) return 'active';
    return node.status;
  }, [totalEvents, eventsPerSec]);

  const offlineCount = useMemo(() => nodes.filter(n => getNodeStatus(n) === 'offline').length, [nodes, getNodeStatus]);
  const totalTraffic = useMemo(() => edges.reduce((s, e) => s + e.totalPackets, 0), [edges]);
  const systemHealthy = offlineCount === 0;

  const selectedEdgeData = selectedEdge ? edges.find(e => e.from === selectedEdge.from && e.to === selectedEdge.to) : null;

  return (
    <LazyMotion features={domAnimation} strict>
    <div className={cn(
      "flex flex-col gap-2",
      isFullscreen ? "fixed inset-0 z-50 bg-brand-bg/95 backdrop-blur-sm p-4" : "w-full h-full",
    )}>
      {/* Header */}
      <div className="flex items-center justify-between gap-3 shrink-0">
        <div className="flex items-center gap-2">
          <div className="p-1.5 bg-brand-primary/10 rounded-lg border border-brand-primary/20">
            <Network className="w-3.5 h-3.5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xs font-bold text-white">Live Traffic Topology</h1>
            <p className="text-[8px] text-brand-text-muted font-mono uppercase tracking-wider">
              {systemHealthy ? 'All Systems Operational' : `${offlineCount} down`}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <span className="text-[9px] font-mono text-brand-text-muted">{eventsPerSec}/s · {totalTraffic}</span>
          <button onClick={zoomOut} className="p-1 rounded hover:bg-brand-elevated text-brand-text-muted"><ZoomOut className="w-3 h-3" /></button>
          <span className="text-[9px] font-mono text-brand-text-muted w-8 text-center">{Math.round(scale * 100)}%</span>
          <button onClick={zoomIn} className="p-1 rounded hover:bg-brand-elevated text-brand-text-muted"><ZoomIn className="w-3 h-3" /></button>
          <button onClick={() => setShowLabels(p => !p)} className="p-1 rounded hover:bg-brand-elevated text-brand-text-muted">{showLabels ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}</button>
          <button onClick={() => setShowMinimap(p => !p)} className="p-1 rounded hover:bg-brand-elevated text-brand-text-muted"><MapIcon className="w-3 h-3" /></button>
          <button onClick={resetView} className="p-1 rounded hover:bg-brand-elevated text-brand-text-muted"><RotateCcw className="w-3 h-3" /></button>
          <button onClick={() => setIsFullscreen(p => !p)} className="p-1 rounded hover:bg-brand-elevated text-brand-text-muted">{isFullscreen ? <Minimize2 className="w-3 h-3" /> : <Maximize2 className="w-3 h-3" />}</button>
        </div>
      </div>

      {/* Topology canvas */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        className="relative flex-1 bg-brand-surface/30 border border-brand-border/50 rounded-2xl overflow-hidden select-none"
        style={{ cursor: isDragging ? 'grabbing' : 'grab', minHeight: '480px' }}
      >
        <div className="absolute inset-0 pointer-events-none" style={{
          backgroundImage: 'radial-gradient(circle, #6366f1 1px, transparent 1px)',
          backgroundSize: '24px 24px', opacity: 0.04,
        }} />

        {!systemHealthy && (
          <div className="absolute inset-0 pointer-events-none rounded-2xl animate-pulse"
            style={{ boxShadow: 'inset 0 0 40px rgba(239,68,68,0.06)' }}
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
          <svg
            className="absolute inset-0 w-full h-full pointer-events-none"
            viewBox="0 0 100 100"
            preserveAspectRatio="xMidYMid meet"
          >
            <defs>
              <filter id="dfv13-glow">
                <feGaussianBlur stdDeviation="0.8" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
              <style>{`
                @keyframes dfv13-flow {
                  from { stroke-dashoffset: 20; }
                  to   { stroke-dashoffset:  0; }
                }
              `}</style>
            </defs>

            {edges.map(edge => {
              const fn = nodes.find(n => n.id === edge.from);
              const tn = nodes.find(n => n.id === edge.to);
              if (!fn || !tn) return null;

              const cp = cpMapRef.current.get(`${edge.from}-${edge.to}`)
                ?? computeControlPoints(fn.x, fn.y, tn.x, tn.y);
              const d = bezierPath(fn.x, fn.y, tn.x, tn.y, cp);

              const hasTraffic = edge.totalPackets > 0;
              const errorRate = edge.totalPackets > 0 ? edge.errorPackets / edge.totalPackets : 0;
              const isSelected = selectedEdge?.from === edge.from && selectedEdge?.to === edge.to;
              const strokeColor = errorRate > 0.3 ? '#ef4444' : hasTraffic ? '#818cf8' : '#27272a';
              const strokeW = hasTraffic ? Math.min(3, 1 + edge.totalPackets / 80) : 0.7;
              const opacity = isSelected ? 1 : hasTraffic ? Math.min(1, 0.3 + edge.totalPackets / 120) : 0.18;

              const mx = (fn.x + tn.x) / 2;
              const my = (fn.y + tn.y) / 2 - 2;

              return (
                <g key={`${edge.from}-${edge.to}`}>
                  {/* Clickable wider invisible path */}
                  <path d={d} fill="none" stroke="transparent" strokeWidth="12"
                    style={{ cursor: 'pointer', pointerEvents: 'auto' }}
                    onClick={() => setSelectedEdge(selectedEdge?.from === edge.from && selectedEdge?.to === edge.to ? null : { from: edge.from, to: edge.to })} />
                  
                  <path d={d} fill="none" stroke={strokeColor} strokeWidth={strokeW}
                    opacity={opacity} strokeLinecap="round" />
                  {hasTraffic && (
                    <path d={d} fill="none" stroke={strokeColor}
                      strokeWidth={strokeW * 0.5} opacity={opacity * 0.5}
                      strokeLinecap="round" strokeDasharray="3 17"
                      style={{ animation: 'dfv13-flow 1.4s linear infinite' }} />
                  )}
                  {hasTraffic && showLabels && (
                    <g transform={`translate(${mx},${my})`}>
                      <rect x={-22} y={-5.5} width={44} height={11} rx={5.5}
                        fill="#18181b" stroke="#27272a" strokeWidth="0.3" opacity={0.85} />
                      <text x="0" y="2" textAnchor="middle" fill="#a1a1aa" fontSize="4.8" fontFamily="monospace">
                        {edge.totalPackets}·{edge.avgLatency}ms
                      </text>
                    </g>
                  )}
                </g>
              );
            })}
          </svg>

          <canvas
            ref={canvasRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ zIndex: 10 }}
          />

          {nodes.map(node => {
            const Icon = resolveIcon(node.iconId);
            const status = getNodeStatus(node);
            const color = STATUS_COLORS[status];
            const isHov = hoveredNode === node.id;
            const nEdges = edges.filter(e => e.from === node.id || e.to === node.id);
            const nTraf = nEdges.reduce((s, e) => s + e.totalPackets, 0);

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
                {/* Offline ring */}
                {status === 'offline' && (
                  <div className="absolute -inset-1 rounded-full animate-ping opacity-30"
                    style={{ border: `2px solid ${color}` }} />
                )}

                <div
                  className="p-2.5 rounded-xl cursor-pointer relative transition-transform duration-150 hover:scale-110 active:scale-90"
                  style={{
                    backgroundColor: `${color}15`,
                    border: `1.5px solid ${color}40`,
                    boxShadow: (status === 'offline' || status === 'active') ? `0 0 16px ${color}20` : undefined,
                  }}
                >
                  <Icon className="w-4 h-4" style={{ color }} />
                  {nTraf > 0 && (
                    <div className="absolute -top-1.5 -right-1.5 px-1.5 py-0.5 rounded-full bg-brand-surface border border-brand-border/50 text-[7px] font-mono font-bold text-brand-primary leading-none">
                      {nTraf}
                    </div>
                  )}
                </div>

                {showLabels && (
                  <span className="text-[8px] font-mono font-bold uppercase text-brand-text-muted text-center leading-tight max-w-[65px]">
                    {node.label}
                  </span>
                )}

                <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{
                  backgroundColor: color,
                  boxShadow: `0 0 5px ${color}55`,
                }} />

                <AnimatePresence>
                  {isHov && (
                    <m.div
                      initial={{ opacity: 0, y: 4 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 4 }}
                      transition={{ duration: 0.15 }}
                      className="absolute bottom-full mb-2 bg-brand-surface/96 backdrop-blur-xl border border-brand-border/60 rounded-xl px-3 py-2.5 shadow-2xl whitespace-nowrap z-50 pointer-events-none"
                      style={{ left: '50%', transform: 'translateX(-50%)' }}
                    >
                      <p className="text-xs font-bold text-white">{node.label}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color }} />
                        <p className="text-[10px] font-mono" style={{ color }}>{STATUS_LABELS[status]}</p>
                      </div>
                      {node.latency !== undefined && (
                        <p className="text-[10px] text-brand-text-muted mt-0.5 font-mono">Latency: <span className="text-brand-primary font-bold">{node.latency}ms</span></p>
                      )}
                      {nTraf > 0 && (
                        <p className="text-[10px] text-brand-text-muted font-mono">Traffic: <span className="text-emerald-400 font-bold">{nTraf} req</span></p>
                      )}
                      {node.failureReason && (
                        <p className="text-[9px] text-red-400 mt-1 max-w-[190px] whitespace-normal leading-relaxed">{node.failureReason}</p>
                      )}
                    </m.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>

        {/* Edge detail popup */}
        <AnimatePresence>
          {selectedEdgeData && selectedEdge && (
            <m.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="absolute top-2 left-1/2 -translate-x-1/2 bg-brand-surface/96 backdrop-blur-xl border border-brand-border/60 rounded-xl px-3 py-2 shadow-2xl z-40 pointer-events-auto"
            >
              <div className="flex items-center gap-3 text-[10px] font-mono">
                <span className="text-brand-text-muted">{selectedEdge.from} → {selectedEdge.to}</span>
                <span className="text-brand-primary font-bold">{selectedEdgeData.totalPackets} req</span>
                <span className="text-emerald-400 font-bold">{selectedEdgeData.avgLatency}ms</span>
                {selectedEdgeData.errorPackets > 0 && (
                  <span className="text-red-400 font-bold">{selectedEdgeData.errorPackets} err</span>
                )}
                <button onClick={() => setSelectedEdge(null)} className="text-brand-text-muted hover:text-white">✕</button>
              </div>
            </m.div>
          )}
        </AnimatePresence>

        {/* Status bar — ultra thin */}
        <div className="absolute bottom-0 left-0 right-0 flex items-center justify-between bg-brand-surface/96 backdrop-blur-xl border-t border-brand-border/50 px-2.5 py-1 text-[9px] font-mono z-30 pointer-events-none rounded-b-2xl">
          <div className="flex items-center gap-2">
            <span className="text-brand-text-muted">{eventsPerSec}/s</span>
            <span className="text-brand-primary font-bold">{totalTraffic.toLocaleString()}</span>
            {failureEvents > 0 && <span className="text-red-400 font-bold">{failureEvents} err</span>}
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden sm:block text-brand-text-muted/40 text-[7px] uppercase">scroll zoom · drag pan</span>
            <span className={cn('w-1 h-1 rounded-full', systemHealthy ? 'bg-emerald-400' : 'bg-red-400')} />
            <span className="text-brand-text-muted uppercase text-[8px]">{systemHealthy ? 'Operational' : `${offlineCount} down`}</span>
          </div>
        </div>
      </div>
    </div>
    </LazyMotion>
  );
}
