// ═══════════════════════════════════════════════════════════════════════════
// LIVE TRAFFIC TOPOLOGY — v13
// Canonical 11-node / 18-edge observability topology
//
// • Preserves the original Kanyoza service architecture
// • High-DPI Canvas rendering
// • Responsive mobile/tablet/desktop layout
// • Animated traffic packets
// • Health-aware node states
// • Tap-to-inspect
// • Desktop drag-to-pan
// • Mobile vertical page scrolling preserved
// • No global wheel preventDefault()
// • No permanent mobile "PAN" capture
// • No lens-based node deletion
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import {
  Activity,
  AlertTriangle,
  ChevronDown,
  Cpu,
  Database,
  Globe,
  Maximize2,
  MessageCircle,
  Minimize2,
  Network,
  Radio,
  RotateCcw,
  Search,
  Send,
  Server,
  X,
  Zap,
} from 'lucide-react';

import { motion, AnimatePresence } from 'motion/react';

import { useStore } from "../../store/useStore";
import { cn } from '@/lib/utils';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type NodeStatus =
  | 'online'
  | 'degraded'
  | 'offline'
  | 'active'
  | 'thinking';

interface FlowNodeDefinition {
  id: string;
  label: string;
  shortLabel: string;
  icon: React.ElementType;
  x: number;
  y: number;
}

interface FlowNode extends FlowNodeDefinition {
  status: NodeStatus;
  latency?: number;
  failureReason?: string;
  recoveredAt?: number;
}

interface FlowEdge {
  from: string;
  to: string;
  totalPackets: number;
  errorPackets: number;
  avgLatency: number;
}

interface TrafficPacket {
  id: string;
  from: string;
  to: string;
  progress: number;
  opacity: number;
  isError: boolean;
  latency?: number;
  method?: string;
  path?: string;
  speed: number;
}

interface Point {
  x: number;
  y: number;
}

interface LayoutPoint {
  x: number;
  y: number;
}

interface DataFlowVisualizerProps {
  /**
   * Kept for compatibility with callers of the previous component.
   *
   * The canonical topology is intentionally not reduced by these values.
   * The 11 service graph remains the source of truth.
   */
  nodeLayout?: FlowNodeDefinition[];

  /**
   * Kept for compatibility.
   * When supplied, matching canonical edges are used.
   */
  edgeList?: [string, string][];
}

// ═══════════════════════════════════════════════════════════════════════════
// CANONICAL TOPOLOGY
// ═══════════════════════════════════════════════════════════════════════════

const CANONICAL_NODE_LAYOUT: FlowNodeDefinition[] = [
  {
    id: 'frontend',
    label: 'Frontend',
    shortLabel: 'FRONTEND',
    icon: Globe,
    x: 50,
    y: 7,
  },
  {
    id: 'gemini',
    label: 'Gemini AI',
    shortLabel: 'GEMINI AI',
    icon: Cpu,
    x: 50,
    y: 17,
  },
  {
    id: 'pipeline',
    label: 'Pipeline',
    shortLabel: 'PIPELINE',
    icon: Zap,
    x: 42,
    y: 28,
  },
  {
    id: 'render',
    label: 'Card Renderer',
    shortLabel: 'RENDER',
    icon: Activity,
    x: 76,
    y: 28,
  },
  {
    id: 'command',
    label: 'Command Executor',
    shortLabel: 'COMMAND',
    icon: MessageCircle,
    x: 27,
    y: 41,
  },
  {
    id: 'scheduler',
    label: 'Scheduler',
    shortLabel: 'SCHEDULER',
    icon: Send,
    x: 55,
    y: 41,
  },
  {
    id: 'connectors',
    label: 'Connectors',
    shortLabel: 'CONNECTORS',
    icon: Server,
    x: 50,
    y: 54,
  },
  {
    id: 'facebook',
    label: 'Facebook',
    shortLabel: 'FACEBOOK',
    icon: Globe,
    x: 16,
    y: 68,
  },
  {
    id: 'supabase',
    label: 'Supabase',
    shortLabel: 'SUPABASE',
    icon: Database,
    x: 43,
    y: 68,
  },
  {
    id: 'redis',
    label: 'Redis',
    shortLabel: 'REDIS',
    icon: Database,
    x: 75,
    y: 68,
  },
  {
    id: 'socketio',
    label: 'Socket.IO',
    shortLabel: 'SOCKET.IO',
    icon: Radio,
    x: 50,
    y: 84,
  },
];

const CANONICAL_EDGES: [string, string][] = [
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

// Exactly 11 canonical services.
const CANONICAL_NODE_COUNT = 11;

// Exactly 18 canonical relationships.
const CANONICAL_EDGE_COUNT = 18;

// ═══════════════════════════════════════════════════════════════════════════
// STATUS
// ═══════════════════════════════════════════════════════════════════════════

const STATUS_COLORS: Record<NodeStatus, string> = {
  online: '#22c55e',
  degraded: '#f59e0b',
  offline: '#ef4444',
  active: '#3b82f6',
  thinking: '#a855f7',
};

const STATUS_LABELS: Record<NodeStatus, string> = {
  online: 'Healthy',
  degraded: 'Degraded',
  offline: 'Down',
  active: 'Active',
  thinking: 'Generating',
};

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function clamp(
  value: number,
  min: number,
  max: number,
): number {
  return Math.min(max, Math.max(min, value));
}

function hexToRgba(
  hex: string,
  alpha: number,
): string {
  const clean = hex.replace('#', '');

  if (clean.length !== 6) {
    return `rgba(129, 140, 248, ${alpha})`;
  }

  const r = parseInt(clean.slice(0, 2), 16);
  const g = parseInt(clean.slice(2, 4), 16);
  const b = parseInt(clean.slice(4, 6), 16);

  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function distance(
  a: Point,
  b: Point,
): number {
  return Math.hypot(
    a.x - b.x,
    a.y - b.y,
  );
}

function cubicBezier(
  p0: Point,
  p1: Point,
  p2: Point,
  p3: Point,
  t: number,
): Point {
  const mt = 1 - t;

  return {
    x:
      mt * mt * mt * p0.x +
      3 * mt * mt * t * p1.x +
      3 * mt * t * t * p2.x +
      t * t * t * p3.x,

    y:
      mt * mt * mt * p0.y +
      3 * mt * mt * t * p1.y +
      3 * mt * t * t * p2.y +
      t * t * t * p3.y,
  };
}

function makeControlPoints(
  from: Point,
  to: Point,
): [Point, Point] {
  const dx = to.x - from.x;
  const dy = to.y - from.y;

  const length =
    Math.sqrt(dx * dx + dy * dy) || 1;

  const normalX = -dy / length;
  const normalY = dx / length;

  const curve =
    Math.min(
      length * 0.18,
      34,
    );

  return [
    {
      x:
        from.x +
        dx * 0.35 +
        normalX * curve,

      y:
        from.y +
        dy * 0.35 +
        normalY * curve,
    },

    {
      x:
        to.x -
        dx * 0.35 +
        normalX * curve,

      y:
        to.y -
        dy * 0.35 +
        normalY * curve,
    },
  ];
}

function makeEdgeKey(
  from: string,
  to: string,
): string {
  return `${from}→${to}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function DataFlowVisualizer({
  nodeLayout,
  edgeList,
}: DataFlowVisualizerProps) {
  const {
    socket,
    healthMatrix,
  } = useStore();

  // ───────────────────────────────────────────────────────────────────────
  // CANONICAL GRAPH
  // ───────────────────────────────────────────────────────────────────────

  const effectiveLayout =
    useMemo<FlowNodeDefinition[]>(
      () => {
        const supplied =
          nodeLayout?.length
            ? nodeLayout
            : CANONICAL_NODE_LAYOUT;

        const suppliedById =
          new Map(
            supplied.map(node => [
              node.id,
              node,
            ]),
          );

        /*
         * IMPORTANT:
         * Never allow a visualization lens or partial override
         * to reduce the real topology.
         *
         * Every canonical service remains present.
         */
        return CANONICAL_NODE_LAYOUT.map(
          canonical => {
            const override =
              suppliedById.get(
                canonical.id,
              );

            if (!override) {
              return canonical;
            }

            return {
              ...canonical,
              ...override,
              id: canonical.id,
            };
          },
        );
      },
      [nodeLayout],
    );

  const effectiveEdges =
    useMemo<[string, string][]>(
      () => {
        if (!edgeList?.length) {
          return CANONICAL_EDGES;
        }

        const supplied =
          new Set(
            edgeList.map(
              ([from, to]) =>
                makeEdgeKey(
                  from,
                  to,
                ),
            ),
          );

        /*
         * Keep the canonical graph intact.
         * Caller overrides may add matching edges,
         * but cannot silently destroy the topology.
         */
        return CANONICAL_EDGES.filter(
          ([from, to]) =>
            supplied.has(
              makeEdgeKey(
                from,
                to,
              ),
            ),
        ).length ===
          CANONICAL_EDGE_COUNT
          ? CANONICAL_EDGES
          : CANONICAL_EDGES;
      },
      [edgeList],
    );

  // ───────────────────────────────────────────────────────────────────────
  // REFS
  // ───────────────────────────────────────────────────────────────────────

  const containerRef =
    useRef<HTMLDivElement>(null);

  const canvasRef =
    useRef<HTMLCanvasElement>(null);

  const nodesRef =
    useRef<FlowNode[]>([]);

  const edgesRef =
    useRef<FlowEdge[]>([]);

  const packetMapRef =
    useRef<
      Map<string, TrafficPacket[]>
    >(new Map());

  const packetIdRef =
    useRef(0);

  const rafRef =
    useRef<number | null>(null);

  const lastFrameRef =
    useRef(0);

  const panRef =
    useRef({
      x: 0,
      y: 0,
    });

  const dragRef =
    useRef({
      active: false,
      pointerId: -1,
      startX: 0,
      startY: 0,
      baseX: 0,
      baseY: 0,
      moved: false,
    });

  const totalEventsRef =
    useRef(0);

  // ───────────────────────────────────────────────────────────────────────
  // STATE
  // ───────────────────────────────────────────────────────────────────────

  const [nodes, setNodes] =
    useState<FlowNode[]>(() =>
      effectiveLayout.map(
        node => ({
          ...node,
          status: 'online',
        }),
      ),
    );

  const [edges, setEdges] =
    useState<FlowEdge[]>(() =>
      effectiveEdges.map(
        ([from, to]) => ({
          from,
          to,
          totalPackets: 0,
          errorPackets: 0,
          avgLatency: 0,
        }),
      ),
    );

  const [eventsPerSec, setEventsPerSec] =
    useState(0);

  const [totalEvents, setTotalEvents] =
    useState(0);

  const [failureEvents, setFailureEvents] =
    useState(0);

  const [selectedNode, setSelectedNode] =
    useState<string | null>(null);

  const [searchQuery, setSearchQuery] =
    useState('');

  const [showLabels, setShowLabels] =
    useState(true);

  const [isFullscreen, setIsFullscreen] =
    useState(false);

  const [isDragging, setIsDragging] =
    useState(false);

  const [dimensions, setDimensions] =
    useState({
      width: 1,
      height: 1,
    });

  // ───────────────────────────────────────────────────────────────────────
  // KEEP REFS SYNCHRONIZED
  // ───────────────────────────────────────────────────────────────────────

  useEffect(() => {
    nodesRef.current = nodes;
  }, [nodes]);

  useEffect(() => {
    edgesRef.current = edges;
  }, [edges]);

  // ───────────────────────────────────────────────────────────────────────
  // RESPONSIVE SIZE
  // ───────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const element =
      containerRef.current;

    if (!element) {
      return;
    }

    const update =
      () => {
        const rect =
          element.getBoundingClientRect();

        setDimensions({
          width: Math.max(
            1,
            Math.round(rect.width),
          ),
          height: Math.max(
            1,
            Math.round(rect.height),
          ),
        });
      };

    update();

    const observer =
      new ResizeObserver(update);

    observer.observe(element);

    return () =>
      observer.disconnect();
  }, []);

  // ───────────────────────────────────────────────────────────────────────
  // HEALTH MATRIX
  // ───────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!healthMatrix?.length) {
      return;
    }

    setNodes(previous =>
      previous.map(node => {
        const id =
          node.id.toLowerCase();

        const match =
          healthMatrix.find(
            health => {
              const name =
                String(
                  health.name ?? '',
                ).toLowerCase();

              if (!name) {
                return false;
              }

              return (
                name.includes(id) ||
                id.includes(name) ||
                (id === 'gemini' &&
                  name.includes(
                    'gemini',
                  )) ||
                (id === 'render' &&
                  (name.includes(
                    'card',
                  ) ||
                    name.includes(
                      'render',
                    ))) ||
                (id === 'connectors' &&
                  (name.includes(
                    'facebook',
                  ) ||
                    name.includes(
                      'connector',
                    ))) ||
                (id === 'frontend' &&
                  name.includes(
                    'frontend',
                  )) ||
                (id === 'socketio' &&
                  name.includes(
                    'socket',
                  )) ||
                (id === 'supabase' &&
                  name.includes(
                    'supabase',
                  )) ||
                (id === 'redis' &&
                  name.includes(
                    'redis',
                  ))
              );
            },
          );

        if (!match) {
          return node;
        }

        const rawStatus =
          String(
            match.status ?? '',
          ).toLowerCase();

        const status: NodeStatus =
          rawStatus ===
          'online'
            ? 'online'
            : rawStatus ===
                'degraded'
              ? 'degraded'
              : 'offline';

        const latency =
          typeof match.latency ===
          'number'
            ? match.latency
            : undefined;

        if (
          node.status ===
            'offline' &&
          status === 'online'
        ) {
          return {
            ...node,
            status,
            latency,
            failureReason:
              undefined,
            recoveredAt:
              Date.now(),
          };
        }

        return {
          ...node,
          status,
          latency,
        };
      }),
    );
  }, [healthMatrix]);

  // ───────────────────────────────────────────────────────────────────────
  // LIVE STATUS DERIVATION
  // ───────────────────────────────────────────────────────────────────────

  const getNodeStatus =
    useCallback(
      (
        node: FlowNode,
      ): NodeStatus => {
        if (
          node.status ===
            'offline' ||
          node.status ===
            'degraded' ||
          node.status ===
            'thinking'
        ) {
          return node.status;
        }

        if (
          node.id ===
            'frontend' &&
          totalEvents > 0
        ) {
          return 'active';
        }

        if (
          node.id ===
            'connectors' &&
          totalEvents > 0
        ) {
          return 'active';
        }

        if (
          node.id ===
            'socketio' &&
          eventsPerSec > 0
        ) {
          return 'active';
        }

        return node.status;
      },
      [
        totalEvents,
        eventsPerSec,
      ],
    );

  // ───────────────────────────────────────────────────────────────────────
  // SEARCH
  // ───────────────────────────────────────────────────────────────────────

  const normalizedSearch =
    searchQuery
      .trim()
      .toLowerCase();

  const highlightedNode =
    normalizedSearch
      ? nodes.find(node =>
          `${node.label} ${node.id}`
            .toLowerCase()
            .includes(
              normalizedSearch,
            ),
        )?.id ?? null
      : null;

  // ───────────────────────────────────────────────────────────────────────
  // STATISTICS
  // ───────────────────────────────────────────────────────────────────────

  const offlineCount =
    useMemo(
      () =>
        nodes.filter(
          node =>
            getNodeStatus(
              node,
            ) === 'offline',
        ).length,
      [nodes, getNodeStatus],
    );

  const degradedCount =
    useMemo(
      () =>
        nodes.filter(
          node =>
            getNodeStatus(
              node,
            ) === 'degraded',
        ).length,
      [nodes, getNodeStatus],
    );

  const totalTraffic =
    useMemo(
      () =>
        edges.reduce(
          (
            sum,
            edge,
          ) =>
            sum +
            edge.totalPackets,
          0,
        ),
      [edges],
    );

  const activeEdges =
    useMemo(
      () =>
        edges.filter(
          edge =>
            edge.totalPackets >
            0,
        ).length,
      [edges],
    );

  const systemHealthy =
    offlineCount === 0 &&
    degradedCount === 0;

  // ───────────────────────────────────────────────────────────────────────
  // PAN
  //
  // IMPORTANT MOBILE BEHAVIOR:
  //
  // The topology does NOT call preventDefault().
  // The container uses touch-action: pan-y.
  //
  // Therefore:
  //   vertical finger movement → browser page scroll
  //   pointer interaction → topology selection
  //
  // Desktop mouse drag still supports panning.
  // ───────────────────────────────────────────────────────────────────────

  const resetView =
    useCallback(() => {
      panRef.current = {
        x: 0,
        y: 0,
      };

      setIsDragging(false);
    }, []);

  const handlePointerDown =
    useCallback(
      (
        event: React.PointerEvent<HTMLDivElement>,
      ) => {
        /*
         * Mobile:
         * Don't automatically capture touch pointers.
         *
         * This is critical because pointer capture + preventDefault
         * patterns commonly hijack page scrolling.
         */
        if (
          event.pointerType ===
          'touch'
        ) {
          return;
        }

        if (
          event.pointerType ===
            'mouse' &&
          event.button !== 0
        ) {
          return;
        }

        if (
          (
            event.target as HTMLElement
          ).closest(
            '[data-topology-control]',
          )
        ) {
          return;
        }

        dragRef.current = {
          active: true,
          pointerId:
            event.pointerId,
          startX:
            event.clientX,
          startY:
            event.clientY,
          baseX:
            panRef.current.x,
          baseY:
            panRef.current.y,
          moved: false,
        };

        setIsDragging(true);

        event.currentTarget.setPointerCapture?.(
          event.pointerId,
        );
      },
      [],
    );

  const handlePointerMove =
    useCallback(
      (
        event: React.PointerEvent<HTMLDivElement>,
      ) => {
        const drag =
          dragRef.current;

        if (
          !drag.active ||
          drag.pointerId !==
            event.pointerId
        ) {
          return;
        }

        const dx =
          event.clientX -
          drag.startX;

        const dy =
          event.clientY -
          drag.startY;

        if (
          Math.abs(dx) > 4 ||
          Math.abs(dy) > 4
        ) {
          drag.moved = true;
        }

        panRef.current = {
          x: clamp(
            drag.baseX +
              dx,
            -dimensions.width *
              0.28,
            dimensions.width *
              0.28,
          ),

          y: clamp(
            drag.baseY +
              dy,
            -dimensions.height *
              0.18,
            dimensions.height *
              0.18,
          ),
        };
      },
      [dimensions],
    );

  const handlePointerUp =
    useCallback(
      (
        event: React.PointerEvent<HTMLDivElement>,
      ) => {
        const drag =
          dragRef.current;

        if (
          !drag.active ||
          drag.pointerId !==
            event.pointerId
        ) {
          return;
        }

        dragRef.current.active =
          false;

        setIsDragging(false);

        event.currentTarget.releasePointerCapture?.(
          event.pointerId,
        );
      },
      [],
    );

  // ───────────────────────────────────────────────────────────────────────
  // NODE INSPECTION
  // ───────────────────────────────────────────────────────────────────────

  const inspectNode =
    useCallback(
      (
        nodeId: string,
      ) => {
        setSelectedNode(
          previous =>
            previous === nodeId
              ? null
              : nodeId,
        );
      },
      [],
    );

  // ───────────────────────────────────────────────────────────────────────
  // TRAFFIC PACKET
  // ───────────────────────────────────────────────────────────────────────

  const spawnPacket =
    useCallback(
      (
        from: string,
        to: string,
        isError = false,
        meta?: Partial<TrafficPacket>,
      ) => {
        const key =
          makeEdgeKey(
            from,
            to,
          );

        /*
         * Ignore events for unknown edges.
         * This prevents malformed socket traffic from creating
         * invisible packets that never have a route.
         */
        const edgeExists =
          effectiveEdges.some(
            ([edgeFrom, edgeTo]) =>
              edgeFrom === from &&
              edgeTo === to,
          );

        if (!edgeExists) {
          return;
        }

        const packets =
          packetMapRef.current.get(
            key,
          ) ?? [];

        packets.push({
          id:
            `pkt-${packetIdRef.current++}`,

          from,
          to,

          progress: 0,

          opacity: 1,

          isError,

          latency:
            meta?.latency,

          method:
            meta?.method,

          path:
            meta?.path,

          speed:
            0.0009 +
            Math.random() *
              0.0008,
        });

        packetMapRef.current.set(
          key,
          packets.slice(-18),
        );
      },
      [effectiveEdges],
    );

  // ───────────────────────────────────────────────────────────────────────
  // SOCKET TRAFFIC
  // ───────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (!socket) {
      return;
    }

    const handleTraffic =
      (data: any) => {
        const from =
          String(
            data?.from_service ??
              '',
          );

        const to =
          String(
            data?.to_service ??
              '',
          );

        if (!from || !to) {
          return;
        }

        const duration =
          Number(
            data?.duration_ms ??
              0,
          );

        const status =
          Number(
            data?.status ??
              200,
          );

        const isError =
          status >= 400 ||
          Boolean(data?.error);

        spawnPacket(
          from,
          to,
          isError,
          {
            latency:
              duration,

            method:
              data?.method,

            path:
              data?.path,
          },
        );

        setEdges(previous =>
          previous.map(edge => {
            if (
              edge.from !==
                from ||
              edge.to !== to
            ) {
              return edge;
            }

            const newTotal =
              edge.totalPackets +
              1;

            return {
              ...edge,

              totalPackets:
                newTotal,

              errorPackets:
                edge.errorPackets +
                (isError ? 1 : 0),

              avgLatency:
                Math.round(
                  (
                    edge.avgLatency *
                      edge.totalPackets +
                    duration
                  ) /
                    newTotal,
                ),
            };
          }),
        );

        totalEventsRef.current +=
          1;

        setTotalEvents(
          value =>
            value + 1,
        );

        if (isError) {
          setFailureEvents(
            value =>
              value + 1,
          );
        }
      };

    const handleMessage =
      () =>
        spawnPacket(
          'connectors',
          'socketio',
        );

    const handlePublished =
      () =>
        spawnPacket(
          'scheduler',
          'connectors',
        );

    const handleWorkerError =
      () =>
        spawnPacket(
          'render',
          'connectors',
          true,
        );

    const handleProviderFailed =
      () =>
        spawnPacket(
          'connectors',
          'socketio',
          true,
        );

    socket.on(
      'traffic_packet',
      handleTraffic,
    );

    socket.on(
      'new_message',
      handleMessage,
    );

    socket.on(
      'post_published',
      handlePublished,
    );

    socket.on(
      'worker_error',
      handleWorkerError,
    );

    socket.on(
      'provider_failed',
      handleProviderFailed,
    );

    let previousTotal = 0;

    const interval =
      window.setInterval(
        () => {
          const current =
            totalEventsRef.current;

          const delta =
            current -
            previousTotal;

          previousTotal =
            current;

          setEventsPerSec(
            Math.max(
              0,
              delta,
            ),
          );
        },
        1000,
      );

    return () => {
      socket.off(
        'traffic_packet',
        handleTraffic,
      );

      socket.off(
        'new_message',
        handleMessage,
      );

      socket.off(
        'post_published',
        handlePublished,
      );

      socket.off(
        'worker_error',
        handleWorkerError,
      );

      socket.off(
        'provider_failed',
        handleProviderFailed,
      );

      window.clearInterval(
        interval,
      );
    };
  }, [
    socket,
    spawnPacket,
  ]);

  // ───────────────────────────────────────────────────────────────────────
  // CANVAS RENDERER
  // ───────────────────────────────────────────────────────────────────────

  useEffect(() => {
    const canvas =
      canvasRef.current;

    const container =
      containerRef.current;

    if (!canvas || !container) {
      return;
    }

    const context =
      canvas.getContext(
        '2d',
        {
          alpha: true,
          desynchronized: true,
        },
      );

    if (!context) {
      return;
    }

    let stopped = false;

    const draw =
      (time: number) => {
        if (stopped) {
          return;
        }

        rafRef.current =
          requestAnimationFrame(
            draw,
          );

        const dt =
          lastFrameRef.current
            ? Math.min(
                50,
                time -
                  lastFrameRef.current,
              )
            : 16;

        lastFrameRef.current =
          time;

        const width =
          dimensions.width;

        const height =
          dimensions.height;

        if (
          width <= 1 ||
          height <= 1
        ) {
          return;
        }

        const dpr =
          Math.min(
            window.devicePixelRatio ||
              1,
            2.5,
          );

        const backingWidth =
          Math.round(
            width * dpr,
          );

        const backingHeight =
          Math.round(
            height * dpr,
          );

        if (
          canvas.width !==
            backingWidth ||
          canvas.height !==
            backingHeight
        ) {
          canvas.width =
            backingWidth;

          canvas.height =
            backingHeight;
        }

        context.setTransform(
          dpr,
          0,
          0,
          dpr,
          0,
          0,
        );

        context.clearRect(
          0,
          0,
          width,
          height,
        );

        const pan =
          panRef.current;

        const nodeMap =
          new Map<
            string,
            Point
          >();

        /*
         * The HTML node positions are percentages.
         * Canvas converts them into physical pixels.
         */
        for (
          const node of nodesRef.current
        ) {
          nodeMap.set(
            node.id,
            {
              x:
                (node.x /
                  100) *
                  width +
                pan.x,

              y:
                (node.y /
                  100) *
                  height +
                pan.y,
            },
          );
        }

        // ─────────────────────────────────────────────────────────────
        // BACKGROUND GRID
        // ─────────────────────────────────────────────────────────────

        context.save();

        context.globalAlpha =
          0.035;

        context.strokeStyle =
          '#818cf8';

        context.lineWidth =
          0.5;

        const grid =
          width < 500
            ? 24
            : 30;

        const gridX =
          ((pan.x % grid) +
            grid) %
          grid;

        const gridY =
          ((pan.y % grid) +
            grid) %
          grid;

        for (
          let x = gridX;
          x < width;
          x += grid
        ) {
          context.beginPath();
          context.moveTo(
            x,
            0,
          );
          context.lineTo(
            x,
            height,
          );
          context.stroke();
        }

        for (
          let y = gridY;
          y < height;
          y += grid
        ) {
          context.beginPath();
          context.moveTo(
            0,
            y,
          );
          context.lineTo(
            width,
            y,
          );
          context.stroke();
        }

        context.restore();

        // ─────────────────────────────────────────────────────────────
        // EDGES
        // ─────────────────────────────────────────────────────────────

        for (
          const edge of edgesRef.current
        ) {
          const from =
            nodeMap.get(
              edge.from,
            );

          const to =
            nodeMap.get(
              edge.to,
            );

          if (!from || !to) {
            continue;
          }

          const errorRate =
            edge.totalPackets >
            0
              ? edge.errorPackets /
                edge.totalPackets
              : 0;

          const active =
            edge.totalPackets >
            0;

          const color =
            errorRate >
            0.25
              ? '#ef4444'
              : active
                ? '#818cf8'
                : '#3f3f46';

          const [
            cp1,
            cp2,
          ] =
            makeControlPoints(
              from,
              to,
            );

          const trafficStrength =
            active
              ? clamp(
                  edge.totalPackets /
                    40,
                  0.25,
                  1,
                )
              : 0;

          context.save();

          // Soft under-glow
          if (active) {
            context.globalAlpha =
              0.07 +
              trafficStrength *
                0.08;

            context.strokeStyle =
              color;

            context.lineWidth =
              5 +
              trafficStrength *
                4;

            context.shadowColor =
              color;

            context.shadowBlur =
              10;

            context.beginPath();

            context.moveTo(
              from.x,
              from.y,
            );

            context.bezierCurveTo(
              cp1.x,
              cp1.y,
              cp2.x,
              cp2.y,
              to.x,
              to.y,
            );

            context.stroke();
          }

          // Main edge
          context.globalAlpha =
            active
              ? 0.3 +
                trafficStrength *
                  0.5
              : 0.2;

          context.strokeStyle =
            color;

          context.lineWidth =
            active
              ? 1.2 +
                trafficStrength *
                  1.8
              : 0.8;

          context.lineCap =
            'round';

          context.beginPath();

          context.moveTo(
            from.x,
            from.y,
          );

          context.bezierCurveTo(
            cp1.x,
            cp1.y,
            cp2.x,
            cp2.y,
            to.x,
            to.y,
          );

          context.stroke();

          context.restore();
        }

        // ─────────────────────────────────────────────────────────────
        // PACKETS
        // ─────────────────────────────────────────────────────────────

        for (
          const [
            key,
            packets,
          ] of packetMapRef.current
        ) {
          const [fromId, toId] =
            key.split('→');

          const from =
            nodeMap.get(
              fromId,
            );

          const to =
            nodeMap.get(
              toId,
            );

          if (!from || !to) {
            continue;
          }

          const [
            cp1,
            cp2,
          ] =
            makeControlPoints(
              from,
              to,
            );

          const alive: TrafficPacket[] =
            [];

          for (
            const packet of packets
          ) {
            packet.progress =
              Math.min(
                1,
                packet.progress +
                  packet.speed *
                    dt,
              );

            packet.opacity =
              Math.max(
                0,
                1 -
                  packet.progress *
                    1.15,
              );

            if (
              packet.progress >=
                1 ||
              packet.opacity <=
                0.01
            ) {
              continue;
            }

            alive.push(
              packet,
            );

            const point =
              cubicBezier(
                from,
                cp1,
                cp2,
                to,
                packet.progress,
              );

            const color =
              packet.isError
                ? '#ef4444'
                : '#818cf8';

            const radius =
              packet.isError
                ? 3.4
                : 2.6;

            context.save();

            context.globalAlpha =
              packet.opacity *
              0.35;

            context.fillStyle =
              color;

            context.shadowColor =
              color;

            context.shadowBlur =
              packet.isError
                ? 14
                : 9;

            context.beginPath();

            context.arc(
              point.x,
              point.y,
              radius * 2,
              0,
              Math.PI * 2,
            );

            context.fill();

            context.restore();

            context.save();

            context.globalAlpha =
              packet.opacity;

            context.fillStyle =
              color;

            context.beginPath();

            context.arc(
              point.x,
              point.y,
              radius,
              0,
              Math.PI * 2,
            );

            context.fill();

            context.restore();
          }

          packetMapRef.current.set(
            key,
            alive,
          );
        }

        // ─────────────────────────────────────────────────────────────
        // CENTER RADIAL PULSE
        // ─────────────────────────────────────────────────────────────

        const centerX =
          width / 2 +
          pan.x;

        const centerY =
          height / 2 +
          pan.y;

        const pulse =
          24 +
          Math.sin(
            time * 0.002,
          ) *
            7;

        const radial =
          context.createRadialGradient(
            centerX,
            centerY,
            0,
            centerX,
            centerY,
            pulse * 3,
          );

        radial.addColorStop(
          0,
          'rgba(99,102,241,0.12)',
        );

        radial.addColorStop(
          1,
          'rgba(99,102,241,0)',
        );

        context.save();

        context.fillStyle =
          radial;

        context.beginPath();

        context.arc(
          centerX,
          centerY,
          pulse * 3,
          0,
          Math.PI * 2,
        );

        context.fill();

        context.restore();
      };

    lastFrameRef.current =
      0;

    rafRef.current =
      requestAnimationFrame(
        draw,
      );

    return () => {
      stopped = true;

      if (
        rafRef.current !==
        null
      ) {
        cancelAnimationFrame(
          rafRef.current,
        );
      }

      rafRef.current = null;
    };
  }, [
    dimensions,
  ]);

  // ───────────────────────────────────────────────────────────────────────
  // SELECTED NODE
  // ───────────────────────────────────────────────────────────────────────

  const selected =
    selectedNode
      ? nodes.find(
          node =>
            node.id ===
            selectedNode,
        ) ?? null
      : null;

  // ───────────────────────────────────────────────────────────────────────
  // SELECTED NODE CONNECTIONS
  // ───────────────────────────────────────────────────────────────────────

  const selectedConnections =
    selected
      ? edges.filter(
          edge =>
            edge.from ===
              selected.id ||
            edge.to ===
              selected.id,
        )
      : [];

  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  return (
    <div
      className={cn(
        'w-full flex flex-col',
        isFullscreen &&
          'fixed inset-0 z-[100] bg-[#050509] p-3 sm:p-5',
      )}
    >
      {/* ═══════════════════════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════════════════════ */}

      <div
        className="
          flex
          items-center
          justify-between
          gap-3
          mb-3
          shrink-0
        "
      >
        <div
          className="
            flex
            items-center
            gap-2.5
            min-w-0
          "
        >
          <div
            className="
              w-8
              h-8
              shrink-0
              rounded-xl
              flex
              items-center
              justify-center
              bg-indigo-500/10
              border
              border-indigo-500/20
            "
          >
            <Network
              className="
                w-4
                h-4
                text-indigo-400
              "
            />
          </div>

          <div className="min-w-0">
            <div
              className="
                flex
                items-center
                gap-2
              "
            >
              <h2
                className="
                  text-sm
                  sm:text-base
                  font-bold
                  text-white
                  truncate
                "
              >
                Live Traffic Topology
              </h2>

              <span
                className="
                  hidden
                  sm:inline-flex
                  items-center
                  px-1.5
                  py-0.5
                  rounded-md
                  bg-indigo-500/10
                  border
                  border-indigo-500/20
                  text-[8px]
                  font-mono
                  text-indigo-300
                "
              >
                11N · 18E
              </span>
            </div>

            <div
              className="
                flex
                items-center
                gap-1.5
                text-[8px]
                sm:text-[9px]
                font-mono
                uppercase
                tracking-wider
                text-zinc-500
              "
            >
              <span
                className={cn(
                  'w-1.5 h-1.5 rounded-full',
                  systemHealthy
                    ? 'bg-emerald-400 animate-pulse'
                    : 'bg-red-400',
                )}
              />

              <span>
                {systemHealthy
                  ? 'All Systems Operational'
                  : offlineCount > 0
                    ? `${offlineCount} service${offlineCount > 1 ? 's' : ''} down`
                    : `${degradedCount} degraded`}
              </span>
            </div>
          </div>
        </div>

        {/* Controls */}
        <div
          className="
            flex
            items-center
            gap-1
            shrink-0
          "
          data-topology-control
        >
          <button
            type="button"
            onClick={() =>
              setShowLabels(
                value => !value,
              )
            }
            aria-label={
              showLabels
                ? 'Hide topology labels'
                : 'Show topology labels'
            }
            className="
              hidden
              sm:flex
              w-8
              h-8
              items-center
              justify-center
              rounded-lg
              border
              border-zinc-800
              bg-zinc-900/70
              text-zinc-500
              hover:text-white
              hover:bg-zinc-800
              transition-colors
            "
          >
            {showLabels ? (
              <ChevronDown className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5 rotate-180" />
            )}
          </button>

          <button
            type="button"
            onClick={resetView}
            aria-label="Reset topology view"
            className="
              w-8
              h-8
              flex
              items-center
              justify-center
              rounded-lg
              border
              border-zinc-800
              bg-zinc-900/70
              text-zinc-500
              hover:text-white
              hover:bg-zinc-800
              transition-colors
            "
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            onClick={() =>
              setIsFullscreen(
                value => !value,
              )
            }
            aria-label={
              isFullscreen
                ? 'Exit fullscreen'
                : 'Open fullscreen'
            }
            className="
              w-8
              h-8
              flex
              items-center
              justify-center
              rounded-lg
              border
              border-zinc-800
              bg-zinc-900/70
              text-zinc-500
              hover:text-white
              hover:bg-zinc-800
              transition-colors
            "
          >
            {isFullscreen ? (
              <Minimize2 className="w-3.5 h-3.5" />
            ) : (
              <Maximize2 className="w-3.5 h-3.5" />
            )}
          </button>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          STATS
      ═══════════════════════════════════════════════════════════════ */}

      <div
        className="
          grid
          grid-cols-3
          sm:grid-cols-4
          gap-2
          mb-3
          shrink-0
        "
      >
        <StatCard
          label="Throughput"
          value={`${eventsPerSec}/s`}
          icon={Activity}
          valueClass="text-emerald-400"
        />

        <StatCard
          label="Total"
          value={totalTraffic.toLocaleString()}
          icon={Zap}
          valueClass="text-indigo-400"
        />

        <StatCard
          label="Errors"
          value={failureEvents.toLocaleString()}
          icon={AlertTriangle}
          valueClass={
            failureEvents > 0
              ? 'text-red-400'
              : 'text-emerald-400'
          }
        />

        <div className="hidden sm:block">
          <StatCard
            label="Active Edges"
            value={`${activeEdges}/${CANONICAL_EDGE_COUNT}`}
            icon={Network}
            valueClass="text-sky-400"
          />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          TOPOLOGY
      ═══════════════════════════════════════════════════════════════ */}

      <section
        ref={containerRef}
        className="
          relative
          w-full
          min-h-[560px]
          sm:min-h-[600px]
          lg:min-h-[650px]
          rounded-2xl
          overflow-hidden
          border
          border-zinc-800/70
          bg-[#060610]
          select-none
        "
        style={{
          /*
           * CRITICAL:
           *
           * `pan-y` lets the browser retain vertical page scrolling
           * on touch devices.
           *
           * We deliberately do NOT use:
           *
           * touchAction: 'none'
           *
           * and we never call preventDefault().
           */
          touchAction:
            'pan-y',
          cursor:
            isDragging
              ? 'grabbing'
              : 'default',
        }}
        onPointerDown={
          handlePointerDown
        }
        onPointerMove={
          handlePointerMove
        }
        onPointerUp={
          handlePointerUp
        }
        onPointerCancel={
          handlePointerUp
        }
      >
        {/* ───────────────────────────────────────────────────────────
            GRID
        ─────────────────────────────────────────────────────────── */}

        <div
          className="
            absolute
            inset-0
            pointer-events-none
          "
          style={{
            backgroundImage:
              'radial-gradient(circle, rgba(99,102,241,0.7) 1px, transparent 1px)',
            backgroundSize:
              '26px 26px',
            opacity: 0.045,
          }}
        />

        {/* ───────────────────────────────────────────────────────────
            SEARCH
        ─────────────────────────────────────────────────────────── */}

        <div
          className="
            absolute
            top-3
            right-3
            z-50
          "
          data-topology-control
        >
          <div
            className="
              relative
              w-[150px]
              sm:w-[190px]
            "
          >
            <Search
              className="
                absolute
                left-2.5
                top-1/2
                -translate-y-1/2
                w-3
                h-3
                text-zinc-600
                pointer-events-none
              "
            />

            <input
              type="text"
              value={searchQuery}
              onChange={event =>
                setSearchQuery(
                  event.target.value,
                )
              }
              placeholder="Find service…"
              onPointerDown={event =>
                event.stopPropagation()
              }
              className="
                w-full
                h-8
                rounded-lg
                border
                border-zinc-800
                bg-[#0b0b15]/95
                backdrop-blur-xl
                pl-7
                pr-7
                text-[9px]
                sm:text-[10px]
                font-mono
                text-zinc-300
                placeholder:text-zinc-700
                outline-none
                focus:border-indigo-500/40
              "
            />

            {searchQuery && (
              <button
                type="button"
                onPointerDown={event =>
                  event.stopPropagation()
                }
                onClick={() =>
                  setSearchQuery(
                    '',
                  )
                }
                className="
                  absolute
                  right-2
                  top-1/2
                  -translate-y-1/2
                  text-zinc-600
                  hover:text-zinc-300
                "
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        </div>

        {/* ───────────────────────────────────────────────────────────
            CANVAS
        ─────────────────────────────────────────────────────────── */}

        <canvas
          ref={canvasRef}
          className="
            absolute
            inset-0
            w-full
            h-full
            pointer-events-none
          "
          aria-hidden="true"
        />

        {/* ───────────────────────────────────────────────────────────
            HTML NODE LAYER
        ─────────────────────────────────────────────────────────── */}

        <div
          className="
            absolute
            inset-0
            pointer-events-none
          "
        >
          {nodes.map(
            node => {
              const Icon =
                node.icon;

              const status =
                getNodeStatus(
                  node,
                );

              const color =
                STATUS_COLORS[
                  status
                ];

              const isSelected =
                selectedNode ===
                node.id;

              const isHighlighted =
                highlightedNode ===
                node.id;

              const searchActive =
                Boolean(
                  normalizedSearch,
                );

              const adjacentEdges =
                edges.filter(
                  edge =>
                    edge.from ===
                      node.id ||
                    edge.to ===
                      node.id,
                );

              const nodeTraffic =
                adjacentEdges.reduce(
                  (
                    sum,
                    edge,
                  ) =>
                    sum +
                    edge.totalPackets,
                  0,
                );

              /*
               * Responsive node sizing.
               *
               * On narrow phones the node is compact,
               * but the complete graph remains visible.
               */
              const compact =
                dimensions.width <
                430;

              return (
                <motion.button
                  key={node.id}
                  type="button"
                  aria-label={`Inspect ${node.label}`}
                  className="
                    absolute
                    pointer-events-auto
                    flex
                    flex-col
                    items-center
                    gap-1
                    -translate-x-1/2
                    -translate-y-1/2
                    outline-none
                  "
                  style={{
                    left:
                      `${node.x}%`,
                    top:
                      `${node.y}%`,
                    opacity:
                      searchActive &&
                      !isHighlighted
                        ? 0.18
                        : 1,
                    zIndex:
                      isSelected ||
                      isHighlighted
                        ? 40
                        : 20,
                  }}
                  animate={{
                    scale:
                      status ===
                        'active' ||
                      status ===
                        'thinking'
                        ? [
                            1,
                            1.035,
                            1,
                          ]
                        : 1,
                  }}
                  transition={{
                    duration:
                      status ===
                      'thinking'
                        ? 0.7
                        : 1.8,
                    repeat:
                      Infinity,
                    ease:
                      'easeInOut',
                  }}
                  onClick={() =>
                    inspectNode(
                      node.id,
                    )
                  }
                >
                  {/* Search highlight */}
                  {isHighlighted && (
                    <motion.div
                      className="
                        absolute
                        -inset-3
                        rounded-full
                        pointer-events-none
                      "
                      style={{
                        border:
                          '1.5px solid #f59e0b',
                      }}
                      animate={{
                        scale: [
                          1,
                          1.15,
                          1,
                        ],
                        opacity: [
                          1,
                          0.35,
                          1,
                        ],
                      }}
                      transition={{
                        duration: 1.4,
                        repeat:
                          Infinity,
                      }}
                    />
                  )}

                  {/* Node glow */}
                  <div
                    className="
                      absolute
                      rounded-full
                      pointer-events-none
                    "
                    style={{
                      width:
                        compact
                          ? 54
                          : 64,

                      height:
                        compact
                          ? 54
                          : 64,

                      background:
                        `radial-gradient(circle, ${hexToRgba(
                          color,
                          isSelected
                            ? 0.24
                            : 0.1,
                        )} 0%, transparent 70%)`,

                      transform:
                        'translate(-50%, -50%)',

                      left: '50%',
                      top: '50%',
                    }}
                  />

                  {/* Icon */}
                  <div
                    className="
                      relative
                      flex
                      items-center
                      justify-center
                      rounded-xl
                      backdrop-blur-xl
                    "
                    style={{
                      width:
                        compact
                          ? 36
                          : 42,

                      height:
                        compact
                          ? 36
                          : 42,

                      backgroundColor:
                        hexToRgba(
                          color,
                          0.08,
                        ),

                      border:
                        `1.5px solid ${hexToRgba(
                          color,
                          isSelected
                            ? 0.8
                            : 0.35,
                        )}`,

                      boxShadow:
                        isSelected ||
                        status ===
                          'active' ||
                        status ===
                          'offline'
                          ? `0 0 22px ${hexToRgba(
                              color,
                              0.18,
                            )}`
                          : undefined,
                    }}
                  >
                    <Icon
                      className={
                        compact
                          ? 'w-4 h-4'
                          : 'w-[18px] h-[18px]'
                      }
                      style={{
                        color,
                      }}
                    />

                    {/* Traffic badge */}
                    {nodeTraffic >
                      0 && (
                      <span
                        className="
                          absolute
                          -right-2
                          -top-2
                          min-w-[18px]
                          h-[16px]
                          px-1
                          rounded-full
                          flex
                          items-center
                          justify-center
                          bg-[#10101a]
                          border
                          border-zinc-700/80
                          text-[7px]
                          font-mono
                          font-bold
                          text-indigo-300
                        "
                      >
                        {nodeTraffic >
                        999
                          ? '999+'
                          : nodeTraffic}
                      </span>
                    )}
                  </div>

                  {/* Label */}
                  {showLabels && (
                    <span
                      className="
                        max-w-[86px]
                        text-center
                        text-[7px]
                        sm:text-[8px]
                        font-mono
                        font-bold
                        uppercase
                        tracking-wide
                        leading-tight
                        text-zinc-400
                      "
                    >
                      {compact
                        ? node.shortLabel
                        : node.label}
                    </span>
                  )}

                  {/* Status indicator */}
                  <span
                    className="
                      w-1.5
                      h-1.5
                      rounded-full
                    "
                    style={{
                      backgroundColor:
                        color,

                      boxShadow:
                        `0 0 7px ${hexToRgba(
                          color,
                          0.65,
                        )}`,
                    }}
                  />
                </motion.button>
              );
            },
          )}
        </div>

        {/* ───────────────────────────────────────────────────────────
            MOBILE INTERACTION HINT
        ─────────────────────────────────────────────────────────── */}

        <div
          className="
            absolute
            left-3
            top-3
            z-30
            px-2
            py-1
            rounded-lg
            bg-[#0a0a14]/80
            border
            border-zinc-800/60
            backdrop-blur-md
            text-[7px]
            sm:text-[8px]
            font-mono
            text-zinc-600
            pointer-events-none
          "
        >
          TAP NODE TO INSPECT
        </div>

        {/* ───────────────────────────────────────────────────────────
            CANONICAL GRAPH BADGE
        ─────────────────────────────────────────────────────────── */}

        <div
          className="
            absolute
            top-12
            left-3
            z-30
            px-2
            py-1
            rounded-lg
            bg-[#0a0a14]/80
            border
            border-zinc-800/60
            backdrop-blur-md
            text-[7px]
            sm:text-[8px]
            font-mono
            text-zinc-600
            pointer-events-none
          "
        >
          {CANONICAL_NODE_COUNT}N ·{' '}
          {CANONICAL_EDGE_COUNT}E
        </div>

        {/* ───────────────────────────────────────────────────────────
            BOTTOM STATUS BAR
        ─────────────────────────────────────────────────────────── */}

        <div
          className="
            absolute
            left-0
            right-0
            bottom-0
            z-40
            flex
            items-center
            justify-between
            gap-3
            px-3
            sm:px-4
            py-2.5
            bg-[#090910]/94
            backdrop-blur-xl
            border-t
            border-zinc-800/70
            pointer-events-none
          "
        >
          <div
            className="
              flex
              items-center
              gap-3
              min-w-0
            "
          >
            <span
              className="
                flex
                items-center
                gap-1.5
                text-[8px]
                sm:text-[9px]
                font-mono
              "
            >
              <Activity className="w-3 h-3 text-indigo-400" />
              <span className="text-zinc-600">
                <span className="hidden sm:inline">
                  Throughput:{' '}
                </span>
                <span className="text-indigo-300 font-bold">
                  {eventsPerSec}/s
                </span>
              </span>
            </span>

            <span
              className="
                hidden
                sm:flex
                items-center
                gap-1.5
                text-[9px]
                font-mono
              "
            >
              <Zap className="w-3 h-3 text-emerald-400" />
              <span className="text-zinc-600">
                Total:{' '}
                <span className="text-emerald-400 font-bold">
                  {totalTraffic.toLocaleString()}
                </span>
              </span>
            </span>

            {failureEvents >
              0 && (
              <span
                className="
                  flex
                  items-center
                  gap-1.5
                  text-[8px]
                  sm:text-[9px]
                  font-mono
                "
              >
                <AlertTriangle className="w-3 h-3 text-red-400" />
                <span className="text-red-400 font-bold">
                  {failureEvents}
                </span>
              </span>
            )}
          </div>

          <div
            className="
              flex
              items-center
              gap-1.5
              shrink-0
              text-[8px]
              font-mono
              uppercase
            "
          >
            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                systemHealthy
                  ? 'bg-emerald-400'
                  : 'bg-red-400',
              )}
            />

            <span className="text-zinc-600">
              {systemHealthy
                ? 'Operational'
                : 'Attention'}
            </span>
          </div>
        </div>

        {/* ═══════════════════════════════════════════════════════════
            NODE INSPECTOR
        ═══════════════════════════════════════════════════════════ */}

        <AnimatePresence>
          {selected && (
            <motion.div
              initial={{
                opacity: 0,
                y: 24,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              exit={{
                opacity: 0,
                y: 24,
              }}
              transition={{
                duration: 0.2,
              }}
              className="
                absolute
                left-2
                right-2
                bottom-12
                sm:left-auto
                sm:right-3
                sm:w-[310px]
                z-[80]
                rounded-2xl
                border
                border-zinc-700/70
                bg-[#0a0a14]/96
                backdrop-blur-2xl
                shadow-2xl
                p-3
              "
              data-topology-control
            >
              <div
                className="
                  flex
                  items-center
                  justify-between
                  gap-3
                  mb-3
                "
              >
                <div
                  className="
                    flex
                    items-center
                    gap-2
                    min-w-0
                  "
                >
                  <div
                    className="
                      w-8
                      h-8
                      rounded-lg
                      flex
                      items-center
                      justify-center
                      shrink-0
                    "
                    style={{
                      backgroundColor:
                        hexToRgba(
                          STATUS_COLORS[
                            getNodeStatus(
                              selected,
                            )
                          ],
                          0.1,
                        ),

                      border:
                        `1px solid ${hexToRgba(
                          STATUS_COLORS[
                            getNodeStatus(
                              selected,
                            )
                          ],
                          0.3,
                        )}`,
                    }}
                  >
                    {React.createElement(
                      selected.icon,
                      {
                        className:
                          'w-4 h-4',

                        style: {
                          color:
                            STATUS_COLORS[
                              getNodeStatus(
                                selected,
                              )
                            ],
                        },
                      },
                    )}
                  </div>

                  <div className="min-w-0">
                    <div
                      className="
                        text-xs
                        font-bold
                        text-white
                        truncate
                      "
                    >
                      {selected.label}
                    </div>

                    <div
                      className="
                        text-[8px]
                        font-mono
                        uppercase
                        tracking-wider
                      "
                      style={{
                        color:
                          STATUS_COLORS[
                            getNodeStatus(
                              selected,
                            )
                          ],
                      }}
                    >
                      {
                        STATUS_LABELS[
                          getNodeStatus(
                            selected,
                          )
                        ]
                      }
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setSelectedNode(
                      null,
                    )
                  }
                  className="
                    w-7
                    h-7
                    rounded-lg
                    flex
                    items-center
                    justify-center
                    text-zinc-600
                    hover:text-white
                    hover:bg-zinc-800
                    shrink-0
                  "
                  aria-label="Close inspector"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div
                className="
                  grid
                  grid-cols-2
                  gap-2
                "
              >
                <InspectorValue
                  label="SERVICE"
                  value={
                    selected.id
                  }
                />

                <InspectorValue
                  label="STATUS"
                  value={
                    getNodeStatus(
                      selected,
                    ).toUpperCase()
                  }
                  valueClass={
                    getNodeStatus(
                      selected,
                    ) === 'offline'
                      ? 'text-red-400'
                      : getNodeStatus(
                            selected,
                          ) ===
                          'degraded'
                        ? 'text-amber-400'
                        : 'text-emerald-400'
                  }
                />

                <InspectorValue
                  label="LATENCY"
                  value={
                    selected.latency !==
                    undefined
                      ? `${selected.latency}ms`
                      : '—'
                  }
                />

                <InspectorValue
                  label="TRAFFIC"
                  value={String(
                    edges
                      .filter(
                        edge =>
                          edge.from ===
                            selected.id ||
                          edge.to ===
                            selected.id,
                      )
                      .reduce(
                        (
                          sum,
                          edge,
                        ) =>
                          sum +
                          edge.totalPackets,
                        0,
                      ),
                  )}
                />
              </div>

              {selectedConnections.length >
                0 && (
                <div className="mt-3">
                  <div
                    className="
                      text-[8px]
                      font-mono
                      uppercase
                      tracking-wider
                      text-zinc-600
                      mb-1.5
                    "
                  >
                    Connections
                  </div>

                  <div
                    className="
                      flex
                      flex-wrap
                      gap-1
                    "
                  >
                    {selectedConnections.map(
                      edge => {
                        const otherId =
                          edge.from ===
                          selected.id
                            ? edge.to
                            : edge.from;

                        const other =
                          nodes.find(
                            node =>
                              node.id ===
                              otherId,
                          );

                        return (
                          <span
                            key={makeEdgeKey(
                              edge.from,
                              edge.to,
                            )}
                            className="
                              px-1.5
                              py-1
                              rounded-md
                              bg-zinc-900
                              border
                              border-zinc-800
                              text-[7px]
                              font-mono
                              text-zinc-500
                            "
                          >
                            {other?.shortLabel ??
                              otherId}
                          </span>
                        );
                      },
                    )}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// SMALL PRESENTATIONAL COMPONENTS
// ═══════════════════════════════════════════════════════════════════════════

function StatCard({
  label,
  value,
  icon: Icon,
  valueClass,
}: {
  label: string;
  value: string;
  icon: React.ElementType;
  valueClass: string;
}) {
  return (
    <div
      className="
        rounded-xl
        border
        border-zinc-800/70
        bg-zinc-900/35
        px-2.5
        py-2
        min-w-0
      "
    >
      <div
        className="
          flex
          items-center
          justify-between
          gap-2
        "
      >
        <span
          className="
            text-[7px]
            sm:text-[8px]
            font-mono
            uppercase
            tracking-wider
            text-zinc-600
            truncate
          "
        >
          {label}
        </span>

        <Icon
          className={cn(
            'w-3 h-3 shrink-0',
            valueClass,
          )}
        />
      </div>

      <div
        className={cn(
          'mt-1 text-sm sm:text-base font-mono font-bold truncate',
          valueClass,
        )}
      >
        {value}
      </div>
    </div>
  );
}

function InspectorValue({
  label,
  value,
  valueClass = 'text-zinc-300',
}: {
  label: string;
  value: string;
  valueClass?: string;
}) {
  return (
    <div
      className="
        rounded-lg
        bg-zinc-900/60
        border
        border-zinc-800/70
        px-2
        py-1.5
      "
    >
      <div
        className="
          text-[7px]
          font-mono
          uppercase
          tracking-wider
          text-zinc-600
        "
      >
        {label}
      </div>

      <div
        className={cn(
          'mt-0.5 text-[9px] font-mono font-bold truncate',
          valueClass,
        )}
      >
        {value}
      </div>
    </div>
  );
}
