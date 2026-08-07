export interface ServiceCatalogEntry {
  id: string;
  label: string;
  description: string;
  healthKeys: string[];
  connectorKeys?: string[];
  logKeywords: string[];
}

export const SERVICE_CATALOG: ServiceCatalogEntry[] = [
  {
    id: 'frontend',
    label: 'Frontend',
    description: 'Operator shell, dashboard surfaces, and real-time control views.',
    healthKeys: ['frontend', 'ui', 'web'],
    logKeywords: ['frontend', 'react', 'ui', 'dashboard'],
  },
  {
    id: 'auth',
    label: 'Authentication',
    description: 'Authentication, session handling, and access enforcement.',
    healthKeys: ['auth', 'authentication'],
    logKeywords: ['auth', 'authentication', 'session', 'login'],
  },
  {
    id: 'api',
    label: 'API Gateway',
    description: 'Primary REST entrypoint coordinating backend services and workflows.',
    healthKeys: ['api', 'flask'],
    logKeywords: ['api', 'flask', 'gateway', 'request'],
  },
  {
    id: 'socket',
    label: 'Socket.IO',
    description: 'Real-time event transport for live telemetry and operator updates.',
    healthKeys: ['socket', 'socketio', 'ws'],
    logKeywords: ['socket', 'socket.io', 'websocket', 'event'],
  },
  {
    id: 'workflow',
    label: 'Workflow Engine',
    description: 'Workflow orchestration, queue progression, and automated execution.',
    healthKeys: ['workflow', 'workers'],
    logKeywords: ['workflow', 'worker', 'queue', 'job', 'run'],
  },
  {
    id: 'ai',
    label: 'AI Engine',
    description: 'Model routing, prompt execution, and content generation services.',
    healthKeys: ['ai', 'gemini'],
    logKeywords: ['ai', 'gemini', 'model', 'prompt', 'generation'],
  },
  {
    id: 'plugins',
    label: 'Plugin Manager',
    description: 'Connector orchestration and third-party integration management.',
    healthKeys: ['plugins', 'plugin'],
    logKeywords: ['plugin', 'connector', 'integration', 'provider'],
  },
  {
    id: 'browser',
    label: 'Browser Pool',
    description: 'Automated browser execution for rendering, capture, and publishing flows.',
    healthKeys: ['browser', 'play'],
    logKeywords: ['browser', 'playwright', 'render', 'headless'],
  },
  {
    id: 'redis',
    label: 'Redis Cache',
    description: 'Low-latency caching and transient state for workflow and runtime coordination.',
    healthKeys: ['redis'],
    logKeywords: ['redis', 'cache'],
  },
  {
    id: 'supabase',
    label: 'Supabase DB',
    description: 'Persistent data, operator state, and platform records.',
    healthKeys: ['supabase', 'supa', 'db', 'database'],
    logKeywords: ['supabase', 'database', 'db', 'postgres'],
  },
  {
    id: 'kb',
    label: 'Knowledge Base',
    description: 'Knowledge retrieval, context enrichment, and reference sources.',
    healthKeys: ['kb', 'knowledge-base', 'knowledge'],
    logKeywords: ['kb', 'knowledge', 'retrieval', 'context'],
  },
  {
    id: 'fb',
    label: 'Facebook',
    description: 'Facebook publishing and connector delivery path.',
    healthKeys: ['facebook', 'fb'],
    connectorKeys: ['facebook', 'fb'],
    logKeywords: ['facebook', 'fb', 'meta'],
  },
  {
    id: 'tw',
    label: 'Twitter',
    description: 'Twitter or X publishing connector and delivery status.',
    healthKeys: ['twitter', 'tw', 'x'],
    connectorKeys: ['twitter', 'tw', 'x'],
    logKeywords: ['twitter', 'tweet', 'x'],
  },
  {
    id: 'wa',
    label: 'WhatsApp',
    description: 'WhatsApp messaging connector and outbound transport.',
    healthKeys: ['whatsapp', 'wa'],
    connectorKeys: ['whatsapp', 'wa'],
    logKeywords: ['whatsapp', 'wa', 'message'],
  },
];

export const SERVICE_CATALOG_MAP = Object.fromEntries(
  SERVICE_CATALOG.map((entry) => [entry.id, entry])
) as Record<string, ServiceCatalogEntry>;

export function getServiceCatalogEntry(serviceId?: string | null) {
  if (!serviceId) return null;
  return SERVICE_CATALOG_MAP[serviceId] ?? null;
}

export function resolveServiceId(value?: string | null) {
  if (!value) return null;
  const normalized = value.toLowerCase();
  const exact = SERVICE_CATALOG.find((entry) => entry.id === normalized);
  if (exact) return exact.id;

  const match = SERVICE_CATALOG.find((entry) =>
    [...entry.healthKeys, ...(entry.connectorKeys ?? [])].some(
      (key) => key.toLowerCase() === normalized || normalized.includes(key.toLowerCase())
    )
  );

  return match?.id ?? null;
}
