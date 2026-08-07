// ═══════════════════════════════════════════════════════════════════════════
// VIRTUALIZATION ENGINE — Mission Control Core
// 
// Abstracts raw backend services into conceptual operational domains.
// Powers the Dataflow Lens, Depth Controller, and SEMANTIC toggle.
//
// Architecture:
//   VirtualizationMapper → maps real services → virtual domains
//   DataflowLens        → filters topology by perspective
//   DepthController     → L0/L1/L2 information density
//   SignalVirtualizer   → transforms raw events → virtualized signal feed
// ═══════════════════════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type VirtualDomain =
  | 'CONTROL_PLANE'
  | 'EXECUTION_PLANE'
  | 'DISPATCH_PLANE'
  | 'MEMORY_PLANE';

export type VirtualService =
  | 'CONTROL_GATEWAY'
  | 'SIGNAL_BUS'
  | 'COGNITIVE_ENGINE'
  | 'ORCHESTRATOR'
  | 'POLICY_ENGINE'
  | 'TEMPORAL_ENGINE'
  | 'MEDIA_FABRIC'
  | 'STREAM_FABRIC'
  | 'WORKFLOW_FABRIC'
  | 'GUARDIAN_FABRIC'
  | 'DISPATCH_FABRIC'
  | 'MEMORY_FABRIC'
  | 'CACHE_FABRIC';

export type DataflowLensType =
  | 'SYSTEM'
  | 'AI'
  | 'MEDIA'
  | 'SECURITY'
  | 'WORKFLOW'
  | 'MEMORY'
  | 'NETWORK';

export type DepthLevel = 'L0_EXECUTIVE' | 'L1_OPERATIONAL' | 'L2_INFRASTRUCTURE';

export type DisplayMode = 'VIRTUALIZED' | 'RAW';

export interface VirtualNode {
  id: string;
  virtualId: string;
  rawLabel: string;
  domain: VirtualDomain;
  plane: string;
  status: string;
  latency?: number;
  throughput?: number;
  pressure: number;
  children?: VirtualNode[];
}

export interface VirtualEdge {
  from: string;
  to: string;
  virtualFrom: string;
  virtualTo: string;
  packets: number;
  errors: number;
  avgLatency: number;
  pressure: number;
}

export interface VirtualizedSignal {
  id: string;
  timestamp: number;
  virtualSource: string;
  virtualTarget: string;
  rawSource: string;
  rawTarget: string;
  type: string;
  traceId: string;
  severity: 'info' | 'notice' | 'warning' | 'critical';
  latency?: number;
}

export interface LensView {
  nodes: string[];
  edges: [string, string][];
  centerNode: string;
  label: string;
  description: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// SERVICE → VIRTUAL MAPPING
// ═══════════════════════════════════════════════════════════════════════════

const SERVICE_MAP: Record<string, { virtualId: string; domain: VirtualDomain; plane: string }> = {
  frontend:   { virtualId: 'CONTROL_GATEWAY',  domain: 'CONTROL_PLANE',    plane: 'EDGE' },
  api:        { virtualId: 'CONTROL_GATEWAY',  domain: 'CONTROL_PLANE',    plane: 'EDGE' },
  rest:       { virtualId: 'CONTROL_GATEWAY',  domain: 'CONTROL_PLANE',    plane: 'EDGE' },
  socketio:   { virtualId: 'SIGNAL_BUS',       domain: 'DISPATCH_PLANE',   plane: 'IO' },
  websocket:  { virtualId: 'SIGNAL_BUS',       domain: 'DISPATCH_PLANE',   plane: 'IO' },
  gemini:     { virtualId: 'COGNITIVE_ENGINE', domain: 'EXECUTION_PLANE',  plane: 'COMPUTE' },
  ai:         { virtualId: 'COGNITIVE_ENGINE', domain: 'EXECUTION_PLANE',  plane: 'COMPUTE' },
  pipeline:   { virtualId: 'ORCHESTRATOR',     domain: 'EXECUTION_PLANE',  plane: 'COMPUTE' },
  orchestrator: { virtualId: 'ORCHESTRATOR',   domain: 'EXECUTION_PLANE',  plane: 'COMPUTE' },
  guardian:   { virtualId: 'POLICY_ENGINE',    domain: 'EXECUTION_PLANE',  plane: 'CONTROL' },
  security:   { virtualId: 'POLICY_ENGINE',    domain: 'EXECUTION_PLANE',  plane: 'CONTROL' },
  scheduler:  { virtualId: 'TEMPORAL_ENGINE',  domain: 'EXECUTION_PLANE',  plane: 'CONTROL' },
  render:     { virtualId: 'MEDIA_FABRIC',     domain: 'DISPATCH_PLANE',   plane: 'COMPUTE' },
  card_renderer: { virtualId: 'MEDIA_FABRIC',  domain: 'DISPATCH_PLANE',   plane: 'COMPUTE' },
  connectors: { virtualId: 'DISPATCH_FABRIC',  domain: 'DISPATCH_PLANE',   plane: 'IO' },
  facebook:   { virtualId: 'DISPATCH_FABRIC',  domain: 'DISPATCH_PLANE',   plane: 'EXTERNAL' },
  twitter:    { virtualId: 'DISPATCH_FABRIC',  domain: 'DISPATCH_PLANE',   plane: 'EXTERNAL' },
  supabase:   { virtualId: 'MEMORY_FABRIC',    domain: 'MEMORY_PLANE',     plane: 'STORAGE' },
  database:   { virtualId: 'MEMORY_FABRIC',    domain: 'MEMORY_PLANE',     plane: 'STORAGE' },
  redis:      { virtualId: 'CACHE_FABRIC',     domain: 'MEMORY_PLANE',     plane: 'STORAGE' },
  cache:      { virtualId: 'CACHE_FABRIC',     domain: 'MEMORY_PLANE',     plane: 'STORAGE' },
  command:    { virtualId: 'ORCHESTRATOR',     domain: 'EXECUTION_PLANE',  plane: 'CONTROL' },
  workflow:   { virtualId: 'WORKFLOW_FABRIC',  domain: 'EXECUTION_PLANE',  plane: 'CONTROL' },
  stream:     { virtualId: 'STREAM_FABRIC',    domain: 'DISPATCH_PLANE',   plane: 'IO' },
  eventbus:   { virtualId: 'STREAM_FABRIC',    domain: 'DISPATCH_PLANE',   plane: 'IO' },
};

// ═══════════════════════════════════════════════════════════════════════════
// DATAFLOW LENS DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

const LENS_DEFINITIONS: Record<DataflowLensType, LensView> = {
  SYSTEM: {
    nodes: [
      'CONTROL_GATEWAY', 'SIGNAL_BUS', 'COGNITIVE_ENGINE',
      'ORCHESTRATOR', 'POLICY_ENGINE', 'TEMPORAL_ENGINE',
      'MEDIA_FABRIC', 'STREAM_FABRIC', 'WORKFLOW_FABRIC',
      'GUARDIAN_FABRIC', 'DISPATCH_FABRIC',
      'MEMORY_FABRIC', 'CACHE_FABRIC',
    ],
    edges: [
      ['CONTROL_GATEWAY', 'ORCHESTRATOR'],
      ['CONTROL_GATEWAY', 'SIGNAL_BUS'],
      ['ORCHESTRATOR', 'COGNITIVE_ENGINE'],
      ['ORCHESTRATOR', 'TEMPORAL_ENGINE'],
      ['ORCHESTRATOR', 'POLICY_ENGINE'],
      ['ORCHESTRATOR', 'WORKFLOW_FABRIC'],
      ['ORCHESTRATOR', 'STREAM_FABRIC'],
      ['COGNITIVE_ENGINE', 'MEDIA_FABRIC'],
      ['WORKFLOW_FABRIC', 'MEDIA_FABRIC'],
      ['TEMPORAL_ENGINE', 'WORKFLOW_FABRIC'],
      ['MEDIA_FABRIC', 'DISPATCH_FABRIC'],
      ['POLICY_ENGINE', 'GUARDIAN_FABRIC'],
      ['STREAM_FABRIC', 'SIGNAL_BUS'],
      ['SIGNAL_BUS', 'DISPATCH_FABRIC'],
      ['DISPATCH_FABRIC', 'MEMORY_FABRIC'],
      ['DISPATCH_FABRIC', 'CACHE_FABRIC'],
      ['MEMORY_FABRIC', 'SIGNAL_BUS'],
      ['CACHE_FABRIC', 'SIGNAL_BUS'],
    ],
    centerNode: 'ORCHESTRATOR',
    label: 'SYSTEM OVERVIEW',
    description: 'Complete operational topology across all domains',
  },
  AI: {
    nodes: [
      'CONTROL_GATEWAY', 'COGNITIVE_ENGINE', 'ORCHESTRATOR',
      'MEDIA_FABRIC', 'MEMORY_FABRIC', 'CACHE_FABRIC',
    ],
    edges: [
      ['CONTROL_GATEWAY', 'ORCHESTRATOR'],
      ['ORCHESTRATOR', 'COGNITIVE_ENGINE'],
      ['COGNITIVE_ENGINE', 'MEDIA_FABRIC'],
      ['COGNITIVE_ENGINE', 'MEMORY_FABRIC'],
      ['COGNITIVE_ENGINE', 'CACHE_FABRIC'],
      ['MEDIA_FABRIC', 'MEMORY_FABRIC'],
    ],
    centerNode: 'COGNITIVE_ENGINE',
    label: 'AI COGNITIVE LENS',
    description: 'Content generation, prompt construction, model orchestration',
  },
  MEDIA: {
    nodes: [
      'CONTROL_GATEWAY', 'ORCHESTRATOR', 'COGNITIVE_ENGINE',
      'MEDIA_FABRIC', 'DISPATCH_FABRIC', 'MEMORY_FABRIC',
    ],
    edges: [
      ['CONTROL_GATEWAY', 'ORCHESTRATOR'],
      ['ORCHESTRATOR', 'COGNITIVE_ENGINE'],
      ['COGNITIVE_ENGINE', 'MEDIA_FABRIC'],
      ['ORCHESTRATOR', 'MEDIA_FABRIC'],
      ['MEDIA_FABRIC', 'DISPATCH_FABRIC'],
      ['MEDIA_FABRIC', 'MEMORY_FABRIC'],
      ['DISPATCH_FABRIC', 'MEMORY_FABRIC'],
    ],
    centerNode: 'MEDIA_FABRIC',
    label: 'MEDIA FABRIC LENS',
    description: 'Card rendering, image generation, media artifact pipeline',
  },
  SECURITY: {
    nodes: [
      'CONTROL_GATEWAY', 'POLICY_ENGINE', 'GUARDIAN_FABRIC',
      'MEMORY_FABRIC', 'SIGNAL_BUS',
    ],
    edges: [
      ['CONTROL_GATEWAY', 'POLICY_ENGINE'],
      ['POLICY_ENGINE', 'GUARDIAN_FABRIC'],
      ['GUARDIAN_FABRIC', 'MEMORY_FABRIC'],
      ['GUARDIAN_FABRIC', 'SIGNAL_BUS'],
      ['POLICY_ENGINE', 'SIGNAL_BUS'],
      ['POLICY_ENGINE', 'MEMORY_FABRIC'],
    ],
    centerNode: 'POLICY_ENGINE',
    label: 'SECURITY LENS',
    description: 'Code scanning, vulnerability detection, audit trail, access control',
  },
  WORKFLOW: {
    nodes: [
      'CONTROL_GATEWAY', 'TEMPORAL_ENGINE', 'WORKFLOW_FABRIC',
      'ORCHESTRATOR', 'MEDIA_FABRIC', 'DISPATCH_FABRIC', 'SIGNAL_BUS',
    ],
    edges: [
      ['CONTROL_GATEWAY', 'TEMPORAL_ENGINE'],
      ['TEMPORAL_ENGINE', 'WORKFLOW_FABRIC'],
      ['WORKFLOW_FABRIC', 'ORCHESTRATOR'],
      ['ORCHESTRATOR', 'MEDIA_FABRIC'],
      ['MEDIA_FABRIC', 'DISPATCH_FABRIC'],
      ['WORKFLOW_FABRIC', 'SIGNAL_BUS'],
      ['DISPATCH_FABRIC', 'SIGNAL_BUS'],
    ],
    centerNode: 'WORKFLOW_FABRIC',
    label: 'WORKFLOW LENS',
    description: 'Job scheduling, task execution, publishing pipeline',
  },
  MEMORY: {
    nodes: [
      'CONTROL_GATEWAY', 'MEMORY_FABRIC', 'CACHE_FABRIC',
      'SIGNAL_BUS', 'ORCHESTRATOR',
    ],
    edges: [
      ['CONTROL_GATEWAY', 'MEMORY_FABRIC'],
      ['CONTROL_GATEWAY', 'CACHE_FABRIC'],
      ['MEMORY_FABRIC', 'SIGNAL_BUS'],
      ['CACHE_FABRIC', 'SIGNAL_BUS'],
      ['ORCHESTRATOR', 'MEMORY_FABRIC'],
      ['ORCHESTRATOR', 'CACHE_FABRIC'],
      ['MEMORY_FABRIC', 'CACHE_FABRIC'],
    ],
    centerNode: 'MEMORY_FABRIC',
    label: 'MEMORY LENS',
    description: 'Database, caching, persistent storage, data fabric',
  },
  NETWORK: {
    nodes: [
      'CONTROL_GATEWAY', 'SIGNAL_BUS', 'STREAM_FABRIC',
      'DISPATCH_FABRIC', 'ORCHESTRATOR',
    ],
    edges: [
      ['CONTROL_GATEWAY', 'SIGNAL_BUS'],
      ['CONTROL_GATEWAY', 'STREAM_FABRIC'],
      ['SIGNAL_BUS', 'STREAM_FABRIC'],
      ['SIGNAL_BUS', 'DISPATCH_FABRIC'],
      ['STREAM_FABRIC', 'ORCHESTRATOR'],
      ['ORCHESTRATOR', 'SIGNAL_BUS'],
      ['DISPATCH_FABRIC', 'SIGNAL_BUS'],
    ],
    centerNode: 'SIGNAL_BUS',
    label: 'NETWORK LENS',
    description: 'WebSocket, SSE, HTTP, real-time communication fabric',
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// DEPTH LEVEL DEFINITIONS
// ═══════════════════════════════════════════════════════════════════════════

const DEPTH_FIELDS: Record<DepthLevel, string[]> = {
  L0_EXECUTIVE: ['status', 'health', 'eventCount', 'errorRate'],
  L1_OPERATIONAL: ['status', 'health', 'eventCount', 'errorRate', 'latency', 'throughput', 'queueDepth', 'failureRate'],
  L2_INFRASTRUCTURE: ['status', 'health', 'eventCount', 'errorRate', 'latency', 'throughput', 'queueDepth', 'failureRate', 'components', 'dependencies', 'config'],
};

const VIRTUAL_SERVICE_CHILDREN: Record<string, string[]> = {
  'COGNITIVE_ENGINE': ['provider-router', 'prompt-cache', 'policy-gate', 'memory-resolver', 'retry-controller', 'output-normalizer'],
  'ORCHESTRATOR': ['content-engine', 'visual-strategy', 'prompt-builder', 'command-executor'],
  'MEDIA_FABRIC': ['card-renderer', 'render-queue', 'image-engine', 'hcti-fallback'],
  'POLICY_ENGINE': ['code-scanner', 'vulnerability-detector', 'audit-logger', 'access-controller'],
  'TEMPORAL_ENGINE': ['brand-scheduler', 'scan-scheduler', 'cron-manager', 'job-service'],
  'MEMORY_FABRIC': ['supabase-client', 'query-optimizer', 'migration-runner', 'backup-agent'],
  'CACHE_FABRIC': ['redis-client', 'cache-invalidator', 'prompt-cache', 'render-cache'],
  'SIGNAL_BUS': ['socket-io', 'sse-stream', 'event-bus', 'message-queue'],
  'DISPATCH_FABRIC': ['facebook-plugin', 'twitter-plugin', 'connector-registry', 'webhook-handler'],
  'STREAM_FABRIC': ['event-bus', 'event-recorder', 'log-stream', 'analytics-pipeline'],
  'WORKFLOW_FABRIC': ['workflow-engine', 'task-queue', 'job-state-machine', 'retry-controller'],
  'GUARDIAN_FABRIC': ['scan-engine', 'report-generator', 'alert-dispatcher', 'remediation-runner'],
  'CONTROL_GATEWAY': ['rate-limiter', 'auth-gate', 'request-router', 'cors-handler'],
};

// ═══════════════════════════════════════════════════════════════════════════
// VIRTUALIZATION MAPPER
// ═══════════════════════════════════════════════════════════════════════════

export class VirtualizationMapper {
  /**
   * Map a raw service name to its virtual identity.
   * Falls back to uppercase raw name if no mapping exists.
   */
  static service(rawName: string): { virtualId: string; domain: VirtualDomain; plane: string } {
    const key = rawName.toLowerCase().replace(/[^a-z0-9]/g, '');
    return SERVICE_MAP[key] || {
      virtualId: rawName.toUpperCase().replace(/\s+/g, '_'),
      domain: 'EXECUTION_PLANE',
      plane: 'UNKNOWN',
    };
  }

  /**
   * Map a raw service name to just the virtual ID string.
   */
  static virtualId(rawName: string): string {
    return VirtualizationMapper.service(rawName).virtualId;
  }

  /**
   * Map a raw service name to its domain.
   */
  static domain(rawName: string): VirtualDomain {
    return VirtualizationMapper.service(rawName).domain;
  }

  /**
   * Virtualize a full health matrix entry.
   */
  static healthEntry(entry: { name: string; status: string; latency?: number; uptime?: number }): VirtualNode {
    const mapping = VirtualizationMapper.service(entry.name);
    return {
      id: mapping.virtualId,
      virtualId: mapping.virtualId,
      rawLabel: entry.name,
      domain: mapping.domain,
      plane: mapping.plane,
      status: entry.status,
      latency: entry.latency,
      throughput: 0,
      pressure: 0,
    };
  }

  /**
   * Virtualize an edge between two raw services.
   */
  static edge(from: string, to: string): VirtualEdge {
    return {
      from,
      to,
      virtualFrom: VirtualizationMapper.virtualId(from),
      virtualTo: VirtualizationMapper.virtualId(to),
      packets: 0,
      errors: 0,
      avgLatency: 0,
      pressure: 0,
    };
  }

  /**
   * Get the children/sub-components of a virtual service.
   */
  static children(virtualId: string): string[] {
    return VIRTUAL_SERVICE_CHILDREN[virtualId] || [];
  }

  /**
   * Virtualize a raw event into a signal.
   */
  static signal(event: {
    id: string;
    timestamp: number;
    source: string;
    target: string;
    type: string;
    traceId?: string;
    latency?: number;
    isError?: boolean;
  }): VirtualizedSignal {
    return {
      id: event.id,
      timestamp: event.timestamp,
      virtualSource: VirtualizationMapper.virtualId(event.source),
      virtualTarget: VirtualizationMapper.virtualId(event.target),
      rawSource: event.source,
      rawTarget: event.target,
      type: event.type,
      traceId: event.traceId || `trace_${Date.now().toString(36)}`,
      severity: event.isError ? 'critical' : 'info',
      latency: event.latency,
    };
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DATAFLOW LENS
// ═══════════════════════════════════════════════════════════════════════════

export class DataflowLens {
  /**
   * Get the lens definition for a given perspective.
   */
  static getLens(lens: DataflowLensType): LensView {
    return LENS_DEFINITIONS[lens] || LENS_DEFINITIONS.SYSTEM;
  }

  /**
   * Get all available lenses.
   */
  static getAllLenses(): DataflowLensType[] {
    return ['SYSTEM', 'AI', 'MEDIA', 'SECURITY', 'WORKFLOW', 'MEMORY', 'NETWORK'];
  }

  /**
   * Filter nodes by the active lens.
   */
  static filterNodes(allNodes: VirtualNode[], lens: DataflowLensType): VirtualNode[] {
    const lensDef = DataflowLens.getLens(lens);
    const lensNodeIds = new Set(lensDef.nodes);
    return allNodes.filter(n => lensNodeIds.has(n.virtualId));
  }

  /**
   * Filter edges by the active lens.
   */
  static filterEdges(allEdges: VirtualEdge[], lens: DataflowLensType): VirtualEdge[] {
    const lensDef = DataflowLens.getLens(lens);
    const edgeSet = new Set(lensDef.edges.map(([f, t]) => `${f}->${t}`));
    return allEdges.filter(e => edgeSet.has(`${e.virtualFrom}->${e.virtualTo}`));
  }

  /**
   * Get a human-readable label for a lens.
   */
  static label(lens: DataflowLensType): string {
    return LENS_DEFINITIONS[lens]?.label || lens;
  }

  /**
   * Get a description for a lens.
   */
  static description(lens: DataflowLensType): string {
    return LENS_DEFINITIONS[lens]?.description || '';
  }

  /**
   * Get the center/focus node for a lens.
   */
  static centerNode(lens: DataflowLensType): string {
    return LENS_DEFINITIONS[lens]?.centerNode || 'ORCHESTRATOR';
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DEPTH CONTROLLER
// ═══════════════════════════════════════════════════════════════════════════

export class DepthController {
  /**
   * Get the fields visible at a given depth level.
   */
  static fields(level: DepthLevel): string[] {
    return DEPTH_FIELDS[level] || DEPTH_FIELDS.L0_EXECUTIVE;
  }

  /**
   * Check if a field should be visible at a given depth.
   */
  static isVisible(field: string, level: DepthLevel): boolean {
    return DepthController.fields(level).includes(field);
  }

  /**
   * Get the next deeper level.
   */
  static deeper(current: DepthLevel): DepthLevel {
    const order: DepthLevel[] = ['L0_EXECUTIVE', 'L1_OPERATIONAL', 'L2_INFRASTRUCTURE'];
    const idx = order.indexOf(current);
    return order[Math.min(idx + 1, order.length - 1)];
  }

  /**
   * Get the next shallower level.
   */
  static shallower(current: DepthLevel): DepthLevel {
    const order: DepthLevel[] = ['L0_EXECUTIVE', 'L1_OPERATIONAL', 'L2_INFRASTRUCTURE'];
    const idx = order.indexOf(current);
    return order[Math.max(idx - 1, 0)];
  }

  /**
   * Get the label for a depth level.
   */
  static label(level: DepthLevel): string {
    switch (level) {
      case 'L0_EXECUTIVE': return 'EXECUTIVE';
      case 'L1_OPERATIONAL': return 'OPERATIONAL';
      case 'L2_INFRASTRUCTURE': return 'INFRASTRUCTURE';
    }
  }

  /**
   * Expand a virtual service into its sub-components (L2 only).
   */
  static expand(virtualId: string): VirtualNode[] {
    const children = VirtualizationMapper.children(virtualId);
    return children.map(childId => ({
      id: childId,
      virtualId: childId.toUpperCase().replace(/-/g, '_'),
      rawLabel: childId,
      domain: 'EXECUTION_PLANE' as VirtualDomain,
      plane: 'SUBCOMPONENT',
      status: 'online',
      pressure: 0,
    }));
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// SIGNAL VIRTUALIZER
// ═══════════════════════════════════════════════════════════════════════════

export class SignalVirtualizer {
  /**
   * Virtualize a batch of raw events.
   */
  static virtualizeBatch(
    events: Array<{
      id: string;
      timestamp: number;
      source: string;
      target: string;
      type: string;
      traceId?: string;
      latency?: number;
      isError?: boolean;
    }>,
  ): VirtualizedSignal[] {
    return events.map(e => VirtualizationMapper.signal(e));
  }

  /**
   * Get abbreviated signal type label.
   */
  static typeLabel(type: string): string {
    const labels: Record<string, string> = {
      'request': 'REQ',
      'response': 'RES',
      'publish': 'PUB',
      'failure': 'ERR',
      'provider': 'PRV',
      'worker': 'WRK',
      'message': 'MSG',
      'scan': 'SCN',
      'alert': 'ALT',
    };
    return labels[type] || type.toUpperCase().slice(0, 3);
  }

  /**
   * Get severity color for a signal.
   */
  static severityColor(severity: string): string {
    switch (severity) {
      case 'critical': return '#ef4444';
      case 'warning': return '#f59e0b';
      case 'notice': return '#3b82f6';
      default: return '#818cf8';
    }
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DISPLAY MODE HELPER
// ═══════════════════════════════════════════════════════════════════════════

export function resolveLabel(
  rawLabel: string,
  mode: DisplayMode,
): string {
  if (mode === 'RAW') return rawLabel;
  return VirtualizationMapper.virtualId(rawLabel);
}

export function resolveNodeLabel(
  node: VirtualNode,
  mode: DisplayMode,
): string {
  return mode === 'RAW' ? node.rawLabel : node.virtualId;
}

export function resolveEdgeLabel(
  edge: VirtualEdge,
  mode: DisplayMode,
): { from: string; to: string } {
  return mode === 'RAW'
    ? { from: edge.from, to: edge.to }
    : { from: edge.virtualFrom, to: edge.virtualTo };
}
