// ═══════════════════════════════════════════════════════════════════════════
// KANYOZA STATE STORE — v4.0
// Centralized state management for the Enterprise Dashboard.
//
// Architecture:
//   • Zustand core — single store with sliced concerns
//   • Socket.IO — singleton connection lifecycle
//   • Polling — visibility-aware REST fallback
//   • Supabase — realtime subscription management
//   • Normalizers — defensive data transformation
//   • Deduplication — per-type event ID tracking
//
// Principles:
//   • Never crash on bad backend data
//   • Never leak timers, listeners, or subscriptions
//   • Never trust localStorage (private browsing, quota)
//   • Always clean up before reinitializing
// ═══════════════════════════════════════════════════════════════════════════

import { create } from 'zustand';
import { io, Socket } from 'socket.io-client';
import {
  supabase,
  isSupabaseConfigured,
  refreshSupabaseClient,
} from '../lib/supabase';

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

export type ServiceStatus = 'online' | 'degraded' | 'offline';

export interface LiveNotification {
  id: string;
  type: 'alert' | 'post' | 'message' | 'payload';
  title: string;
  subtitle?: string;
  severity?: string;
}

export interface TriggerNotificationInput {
  type: 'alert' | 'post' | 'message' | 'payload' | 'success' | 'warning' | 'info';
  title: string;
  subtitle?: string;
  message?: string;
  severity?: string;
}

export interface HttpLog {
  id: string;
  timestamp: number;
  url: string;
  method: string;
  status?: number;
  statusText?: string;
  error?: string;
  page?: string;
}

export interface SystemHealth {
  id: string;
  name: string;
  status: ServiceStatus;
  latency: number;
  lastChecked: number;
  uptime: number;
}

export interface LiveMessage {
  id: string;
  user: string;
  avatar: string;
  message: string;
  time: number;
  sentiment: 'positive' | 'neutral' | 'negative';
}

export interface GuardianAlert {
  id: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM';
  title: string;
  time: number;
}

export interface Post {
  id: string;
  title: string;
  platform: 'facebook' | 'twitter' | 'linkedin';
  time: number;
  engagement: number;
  thumbnail: string;
}

export interface PayloadLog {
  id: string;
  time: string;
  method: string;
  endpoint: string;
  status: number;
  latency: string;
  type: 'inbound' | 'outbound';
  request: unknown;
  response: unknown;
}

export interface PluginStatus {
  name: string;
  commands: number;
  webhooks: number;
  status: 'active' | 'degraded' | 'inactive';
}

export interface AIProviderHealth {
  provider: string;
  model: string;
  available: boolean;
  latency_ms: number;
  last_checked: string;
}

export interface AIDecision {
  topic: string;
  confidence: number;
  engagement_score: number;
  estimated_reach: string;
  brand_id?: string;
  brand_name?: string;
  job_id?: string;
  timestamp?: string;
}

export interface MissionStatus {
  goal: string;
  stage: string;
  progress: number;
  active_agent: string;
  is_active: boolean;
  brand_id?: string;
  brand_name?: string;
  source?: string;
  job_id?: string;
  timestamp?: string;
}

export interface WorkflowMetrics {
  running: number;
  queued: number;
  failed_today: number;
  completed_today: number;
}

export interface SystemResources {
  cpu_percent: number;
  memory_percent: number;
  disk_percent: number;
}

export interface IntegrationStatus {
  id: string;
  platform: string;
  account_name: string;
  healthy: boolean;
  mode?: string;
  accounts_configured?: number;
  last_check?: string;
}

export interface DataChannelStatus {
  socketIO: 'connected' | 'disconnected' | 'reconnecting';
  restPolling: 'active' | 'paused' | 'error';
  supabaseRealtime: 'subscribed' | 'unsubscribed' | 'error';
  lastEventTimestamp: number | null;
}

// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const POLLING_INTERVAL = 300_000;
const ENTERPRISE_POLL_INTERVAL = 300_000;
const REQUEST_TIMEOUT = 20_000;

const MAX_MESSAGES = 20;
const MAX_POSTS = 20;
const MAX_ALERTS = 50;
const MAX_PAYLOADS = 50;
const MAX_LATENCY_HISTORY = 60;
const MAX_HTTP_LOGS = 50;
const MAX_HEALTH_MATRIX = 20;
const MAX_SEEN_IDS_PER_TYPE = 200;

const SOCKET_NAMESPACE = '/dashboard';

// ═══════════════════════════════════════════════════════════════════════════
// STORAGE HELPERS
// ═══════════════════════════════════════════════════════════════════════════

const storage = {
  get(key: string): string {
    try { return localStorage.getItem(key) || ''; } catch { return ''; }
  },
  set(key: string, value: string): void {
    try { localStorage.setItem(key, value); } catch { /* quota or private */ }
  },
  remove(key: string): void {
    try { localStorage.removeItem(key); } catch { /* ignore */ }
  },
};

// ═══════════════════════════════════════════════════════════════════════════
// URL HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function normalizeRestEndpoint(raw: string): string {
  let url = (raw || '').trim().replace(/\/+$/, '');
  if (!url) return '';
  url = url.replace(/^ws:\/\//i, 'http://').replace(/^wss:\/\//i, 'https://');
  if (!/\/api\/v1$/i.test(url)) url = `${url}/api/v1`;
  return url;
}

function normalizeSocketUrl(raw: string): string {
  let url = (raw || '').trim().replace(/\/+$/, '');
  if (!url) return '';
  url = url.replace(/^wss:\/\//i, 'https://').replace(/^ws:\/\//i, 'http://');
  return url.replace(/\/api\/v1$/i, '');
}

function buildUrl(base: string, path: string): string {
  return `${base.replace(/\/+$/, '')}/${(path || '').replace(/^\/+/, '')}`;
}

// ═══════════════════════════════════════════════════════════════════════════
// FETCH HELPERS
// ═══════════════════════════════════════════════════════════════════════════

async function apiGet(
  baseUrl: string,
  path: string,
  token: string,
): Promise<{ ok: boolean; status: number; data: any; error?: string }> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT);

  try {
    const headers: Record<string, string> = { Accept: 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;

    const res = await fetch(buildUrl(baseUrl, path), {
      headers,
      signal: controller.signal,
    });

    let data: any = null;
    const ct = res.headers.get('content-type') || '';
    if (ct.includes('json')) {
      try { data = await res.json(); } catch { data = null; }
    }

    if (!res.ok) {
      return {
        ok: false,
        status: res.status,
        data,
        error: data?.detail || data?.message || `HTTP ${res.status}`,
      };
    }

    return { ok: true, status: res.status, data };
  } catch (err: any) {
    return {
      ok: false,
      status: 0,
      data: null,
      error: err?.name === 'AbortError' ? 'Timeout' : err?.message || 'Network error',
    };
  } finally {
    clearTimeout(timer);
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// DEDUPLICATION
// ═══════════════════════════════════════════════════════════════════════════

const seenIds = new Map<string, Set<string>>();

function isDuplicate(type: string, id: string): boolean {
  const key = String(id || '').trim();
  if (!key) return false;
  let bucket = seenIds.get(type);
  if (!bucket) { bucket = new Set(); seenIds.set(type, bucket); }
  if (bucket.has(key)) return true;
  bucket.add(key);
  if (bucket.size > MAX_SEEN_IDS_PER_TYPE) {
    const it = bucket.values();
    for (let i = 0; i < 50; i++) { const n = it.next(); if (n.done) break; bucket.delete(n.value); }
  }
  return false;
}

function clearSeenEvents(): void { seenIds.clear(); }

// ═══════════════════════════════════════════════════════════════════════════
// DATA NORMALIZERS
// ═══════════════════════════════════════════════════════════════════════════

function toNum(v: unknown, fallback = 0): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function toStr(v: unknown, fallback = ''): string {
  if (typeof v === 'string') return v;
  if (v === null || v === undefined) return fallback;
  return String(v);
}

function ts(v: unknown, fallback = Date.now()): number {
  if (typeof v === 'number' && Number.isFinite(v)) return v < 10_000_000_000 ? v * 1000 : v;
  if (typeof v === 'string') {
    const n = Number(v);
    if (Number.isFinite(n)) return n < 10_000_000_000 ? n * 1000 : n;
    const d = Date.parse(v);
    if (!Number.isNaN(d)) return d;
  }
  return fallback;
}

function buildHealthMatrix(services: Record<string, any>): SystemHealth[] {
  if (!services || typeof services !== 'object') return [];
  return Object.entries(services).slice(0, MAX_HEALTH_MATRIX).map(([name, svc]) => {
    const raw = String(svc?.status || '').toLowerCase();
    return {
      id: toStr(svc?.id || name),
      name: toStr(svc?.page_name || svc?.display_name || svc?.name || name),
      status: (raw === 'ok' || raw === 'online' || raw === 'healthy') ? 'online'
        : (raw === 'degraded' || raw === 'warning') ? 'degraded' : 'offline',
      latency: toNum(svc?.latency_ms ?? svc?.latency),
      lastChecked: Date.now(),
      uptime: svc?.uptime_seconds !== undefined
        ? Math.round((toNum(svc.uptime_seconds) / 86400) * 1000) / 10
        : toNum(svc?.uptime),
    };
  });
}

function normMessage(row: any): LiveMessage {
  const user = toStr(row?.sender_name || row?.sender_id || row?.user, 'User');
  return {
    id: toStr(row?.id || row?.message_id, `msg_${Date.now()}`),
    user,
    avatar: toStr(row?.avatar) || `https://ui-avatars.com/api/?name=${encodeURIComponent(user)}&background=4F46E5&color=fff`,
    message: toStr(row?.content || row?.text || row?.message),
    time: ts(row?.created_at || row?.timestamp || row?.time),
    sentiment: (['positive','negative'].includes(String(row?.sentiment).toLowerCase()) ? String(row?.sentiment).toLowerCase() : 'neutral') as LiveMessage['sentiment'],
  };
}

function normPost(row: any): Post {
  const platform = String(row?.platform || '').toLowerCase();
  return {
    id: toStr(row?.id || row?.post_id, `post_${Date.now()}`),
    title: toStr(row?.title || row?.content || row?.message, 'New Post'),
    platform: platform === 'linkedin' ? 'linkedin' : platform === 'twitter' || platform === 'x' ? 'twitter' : 'facebook',
    time: ts(row?.created_at || row?.timestamp || row?.time),
    engagement: toNum(row?.engagement ?? row?.engagement_score ?? row?.likes),
    thumbnail: toStr(row?.thumbnail || row?.image_url || row?.image),
  };
}

function normAlert(row: any): GuardianAlert {
  const sev = String(row?.severity || '').toUpperCase();
  return {
    id: toStr(row?.id || row?.alert_id, `alert_${Date.now()}`),
    severity: sev === 'CRITICAL' ? 'CRITICAL' : sev === 'HIGH' ? 'HIGH' : 'MEDIUM',
    title: toStr(row?.title || row?.message || row?.description, 'Security Alert'),
    time: ts(row?.created_at || row?.timestamp || row?.time),
  };
}

function normPayload(row: any): PayloadLog {
  return {
    id: toStr(row?.id || row?.request_id, `req_${Date.now()}_${Math.random().toString(36).slice(2,7)}`),
    time: toStr(row?.time || row?.created_at, new Date().toLocaleTimeString()),
    method: toStr(row?.method, 'POST').toUpperCase(),
    endpoint: toStr(row?.endpoint || row?.path, '/api/v1/webhook'),
    status: toNum(row?.status, 200),
    latency: toStr(row?.latency ?? row?.latency_ms, 'unknown'),
    type: row?.type === 'outbound' ? 'outbound' : 'inbound',
    request: row?.request ?? row?.payload ?? {},
    response: row?.response ?? {},
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE INTERFACE
// ═══════════════════════════════════════════════════════════════════════════

interface AppState {
  // Auth
  isAuthenticated: boolean;
  login: () => void;
  logout: () => void;

  // Theme
  theme: 'dark' | 'light';
  toggleTheme: () => void;

  // Tenancy
  currentTenant: string;
  setCurrentTenant: (t: string) => void;
  selectedWorkspaceId: string | number | null;
  setSelectedWorkspaceId: (id: string | number | null) => void;
  selectedBrandId: string | number | null;
  setSelectedBrandId: (id: string | number | null) => void;

  // Connection
  wsEndpoint: string;
  restEndpoint: string;
  masterToken: string;
  setConnectionParams: (p: { wsEndpoint?: string; restEndpoint?: string; masterToken?: string }) => void;

  // Service keys
  supabaseUrl: string;
  supabaseAnonKey: string;
  geminiKey: string;
  githubToken: string;
  githubRepo: string;
  githubBranch: string;
  fbPageId: string;
  fbVerifyToken: string;
  fbPageAccessToken: string;
  fbAppSecret: string;
  isUsingLiveBackendData: boolean;
  setServiceKeys: (keys: Record<string, string>) => void;

  // Socket
  socket: Socket | null;
  socketConnected: boolean;
  socketTransport: 'polling' | 'websocket' | null;
  socketError: string | null;
  socketReconnectAttempts: number;
  socketLastEventAt: number | null;
  connectSocket: () => void;
  disconnectSocket: () => void;

  // Live data
  messages: LiveMessage[];
  addMessage: (m: LiveMessage) => void;
  isStreamPaused: boolean;
  setStreamPaused: (p: boolean) => void;
  healthMatrix: SystemHealth[];
  updateHealth: (h: SystemHealth[]) => void;
  guardianAlerts: GuardianAlert[];
  addAlert: (a: GuardianAlert) => void;
  recentPosts: Post[];
  addPost: (p: Post) => void;
  payloads: PayloadLog[];
  addPayload: (p: PayloadLog) => void;

  // Enterprise
  pluginStatus: PluginStatus[];
  updatePluginStatus: (p: PluginStatus[]) => void;
  aiProviderHealth: AIProviderHealth[];
  updateAIProviderHealth: (p: AIProviderHealth[]) => void;
  aiDecision: AIDecision | null;
  updateAIDecision: (d: AIDecision) => void;
  missionStatus: MissionStatus | null;
  updateMissionStatus: (s: MissionStatus) => void;
  workflowMetrics: WorkflowMetrics;
  updateWorkflowMetrics: (m: Partial<WorkflowMetrics>) => void;
  systemResources: SystemResources;
  updateSystemResources: (r: SystemResources) => void;
  integrationStatus: IntegrationStatus[];
  updateIntegrationStatus: (i: IntegrationStatus[]) => void;
  dataChannelStatus: DataChannelStatus;
  updateDataChannelStatus: (p: Partial<DataChannelStatus>) => void;

  // Notifications
  lastNotification: LiveNotification | null;
  dismissNotification: () => void;
  triggerNotification: (n: TriggerNotificationInput) => void;

  // Stats
  stats: { messagesToday: number; postsPublished: number; activeUsers: number; apiCalls: number; guardianIssues: number; revenueMonthly: number };
  updateStats: (p: Partial<AppState['stats']>) => void;

  // UI
  isTerminalOpen: boolean;
  toggleTerminal: () => void;
  pendingCommand: string | null;
  setPendingCommand: (c: string | null) => void;
  personaMood: 'analytical' | 'professional' | 'creative' | 'urgent';
  setPersonaMood: (m: AppState['personaMood']) => void;

  // Latency
  latencyHistory: number[];
  pushLatency: (ms: number) => void;

  // HTTP logs
  httpLogs: HttpLog[];
  addHttpLog: (l: HttpLog) => void;
  clearHttpLogs: () => void;

  // Lifecycle
  fetchInitialData: () => Promise<void>;
  fetchEnterpriseData: () => Promise<void>;
  startRealtimeSubscriptions: () => void;
  stopRealtimeSubscriptions: () => void;
  resetData: () => void;

  // Backend config (from /status endpoint)
  backendConfig: unknown;

  // Internal (not exposed to components)
  _pollingTimer: ReturnType<typeof setInterval> | null;
  _enterpriseTimer: ReturnType<typeof setInterval> | null;
  _realtimeChannel: any;
}

// ═══════════════════════════════════════════════════════════════════════════
// STORE
// ═══════════════════════════════════════════════════════════════════════════

export const useStore = create<AppState>((set, get) => {

  // ── Internal helpers ──────────────────────────────────────────────────

  function logHttp(url: string, method: string, status: number | undefined, error: string | undefined, page: string) {
    set(s => ({
      httpLogs: [{ id: `http_${Date.now()}_${Math.random().toString(36).slice(2,7)}`, timestamp: Date.now(), url, method, status, statusText: error, error, page }, ...s.httpLogs].slice(0, MAX_HTTP_LOGS),
    }));
  }

  function buildQuery(): string {
    const wid = get().selectedWorkspaceId;
    const bid = get().selectedBrandId;
    const parts: string[] = [];
    if (wid) parts.push(`workspace_id=${encodeURIComponent(String(wid))}`);
    if (bid) parts.push(`brand_id=${encodeURIComponent(String(bid))}`);
    return parts.length ? `?${parts.join('&')}` : '';
  }

  async function pollDashboard(): Promise<void> {
    const { restEndpoint, masterToken } = get();
    if (!restEndpoint) return;
    const base = normalizeRestEndpoint(restEndpoint);
    const q = buildQuery();

    const res = await apiGet(base, `/dashboard/live${q}`, masterToken);
    logHttp(buildUrl(base, `/dashboard/live${q}`), 'GET', res.status || undefined, res.error, 'poll.dashboard');
    if (!res.ok || !res.data) return;

    const d = res.data;
    get().updateStats({
      messagesToday: toNum(d.messages_today ?? d.counters?.messages_today, get().stats.messagesToday),
      postsPublished: toNum(d.posts_published ?? d.counters?.posts_today, get().stats.postsPublished),
      activeUsers: toNum(d.active_users ?? d.counters?.active_connections, get().stats.activeUsers),
      apiCalls: toNum(d.api_calls_today ?? d.counters?.events_emitted, get().stats.apiCalls),
      guardianIssues: toNum(d.guardian_issues, get().stats.guardianIssues),
    });
    if (d.services) get().updateHealth(buildHealthMatrix(d.services));
    if (Array.isArray(d.integration_status)) {
      get().updateIntegrationStatus(d.integration_status.map((i: any) => ({
        id: toStr(i.id || i.platform),
        platform: toStr(i.platform, 'unknown'),
        account_name: toStr(i.account_name || i.platform, 'Unknown'),
        healthy: Boolean(i.healthy ?? i.connected),
        mode: i.mode,
        accounts_configured: i.accounts_configured,
        last_check: i.last_check,
      })));
    }
    get().updateDataChannelStatus({ lastEventTimestamp: Date.now() });
  }

  async function pollEnterprise(): Promise<void> {
    const { restEndpoint, masterToken } = get();
    if (!restEndpoint) return;
    const base = normalizeRestEndpoint(restEndpoint);
    const q = buildQuery();
    const token = masterToken;

    const endpoints: Array<{ path: string; handler: (d: any) => void }> = [
      {
        path: `/plugins${q}`,
        handler: (d) => {
          const list = Array.isArray(d) ? d : d?.plugins;
          if (!Array.isArray(list)) return;
          get().updatePluginStatus(list.map((p: any) => ({
            name: toStr(p.name, 'Unknown'),
            commands: Array.isArray(p.commands) ? p.commands.length : toNum(p.commands),
            webhooks: Array.isArray(p.webhooks) ? p.webhooks.length : toNum(p.webhooks),
            status: p.status === 'inactive' ? 'inactive' : p.status === 'degraded' ? 'degraded' : 'active',
          })));
        },
      },
      {
        path: `/ai/config${q}`,
        handler: (d) => {
          if (!d) return;
          get().updateAIProviderHealth([{
            provider: toStr(d.provider, 'gemini'),
            model: toStr(d.model, 'unknown'),
            available: d.available !== undefined ? Boolean(d.available) : true,
            latency_ms: toNum(d.latency_ms),
            last_checked: toStr(d.last_checked, new Date().toISOString()),
          }]);
        },
      },
      {
        path: `/workflow/status${q}`,
        handler: (d) => {
          if (!d) return;
          get().updateWorkflowMetrics({
            running: d.running !== undefined ? toNum(d.running) : get().workflowMetrics.running,
            queued: d.queued !== undefined ? toNum(d.queued) : get().workflowMetrics.queued,
            failed_today: d.failed_today !== undefined ? toNum(d.failed_today) : get().workflowMetrics.failed_today,
            completed_today: d.completed_today !== undefined ? toNum(d.completed_today) : get().workflowMetrics.completed_today,
          });
        },
      },
      {
        path: `/metrics/resources${q}`,
        handler: (d) => {
          if (!d) return;
          get().updateSystemResources({
            cpu_percent: toNum(d.cpu_percent),
            memory_percent: toNum(d.memory_percent),
            disk_percent: toNum(d.disk_percent),
          });
        },
      },
      {
        path: `/integrations${q}`,
        handler: (d) => {
          const list = Array.isArray(d) ? d : d?.integrations;
          if (!Array.isArray(list)) return;
          get().updateIntegrationStatus(list.map((i: any) => ({
            id: toStr(i.id || i.platform),
            platform: toStr(i.platform, 'unknown'),
            account_name: toStr(i.account_name || i.name || i.platform, 'Unknown'),
            healthy: Boolean(i.healthy ?? i.connected),
            mode: i.mode,
            accounts_configured: i.accounts_configured,
            last_check: i.last_check,
          })));
        },
      },
    ];

    let success = false;
    for (const ep of endpoints) {
      const res = await apiGet(base, ep.path, token);
      logHttp(buildUrl(base, ep.path), 'GET', res.status || undefined, res.error, 'poll.enterprise');
      if (res.ok) { ep.handler(res.data); success = true; }
    }
    get().updateDataChannelStatus({ restPolling: success ? 'active' : 'error' });
  }

  // ── Socket connection (singleton lifecycle) ───────────────────────────

  function connect(): void {
    const existing = get().socket;
    if (existing?.connected) return;
    if (existing) { try { existing.removeAllListeners(); existing.io.removeAllListeners(); existing.disconnect(); } catch { /* */ } }

    const base = normalizeSocketUrl(get().wsEndpoint || get().restEndpoint);
    if (!base) {
      set({ socketConnected: false, socketError: 'No endpoint configured' });
      return;
    }

    const token = get().masterToken;
    const socket = io(`${base}${SOCKET_NAMESPACE}`, {
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionDelay: 2000,
      reconnectionDelayMax: 30000,
      reconnectionAttempts: Infinity,
      timeout: 20000,
      auth: token ? { token } : undefined,
      extraHeaders: token ? { Authorization: `Bearer ${token}` } : undefined,
    });

    socket.on('connect', () => {
      const now = Date.now();
      set({ socketConnected: true, socketError: null, socketReconnectAttempts: 0, socketLastEventAt: now });
      const t = socket.io.engine?.transport?.name;
      if (t === 'websocket' || t === 'polling') set({ socketTransport: t });
      get().updateDataChannelStatus({ socketIO: 'connected', lastEventTimestamp: now });
    });

    socket.on('disconnect', (reason) => {
      const now = Date.now();
      set({ socketConnected: false, socketTransport: null, socketError: `Disconnected: ${reason}`, socketLastEventAt: now });
      get().updateDataChannelStatus({ socketIO: 'disconnected', lastEventTimestamp: now });
    });

    socket.on('connect_error', (err: any) => {
      set({ socketConnected: false, socketError: err?.message || 'Connection failed', socketLastEventAt: Date.now() });
    });

    socket.io.on('reconnect_attempt', (n: number) => {
      set({ socketReconnectAttempts: n, socketLastEventAt: Date.now() });
      get().updateDataChannelStatus({ socketIO: 'reconnecting', lastEventTimestamp: Date.now() });
    });

    socket.io.on('reconnect', () => {
      const now = Date.now();
      set({ socketConnected: true, socketError: null, socketReconnectAttempts: 0, socketLastEventAt: now });
      get().updateDataChannelStatus({ socketIO: 'connected', lastEventTimestamp: now });
    });

    socket.io.on('reconnect_error', (err: any) => {
      set({ socketError: err?.message || 'Reconnection failed', socketLastEventAt: Date.now() });
    });

    socket.io.on('reconnect_failed', () => {
      set({ socketError: 'Reconnection exhausted', socketLastEventAt: Date.now() });
      get().updateDataChannelStatus({ socketIO: 'disconnected' });
    });

    // ── Core events ──────────────────────────────────────────────────

    socket.on('stats', (d: any) => {
      if (!d || typeof d !== 'object') return;
      get().updateStats({
        messagesToday: toNum(d.messages_today ?? d.counters?.messages_today, get().stats.messagesToday),
        postsPublished: toNum(d.posts_published ?? d.counters?.posts_today, get().stats.postsPublished),
        activeUsers: toNum(d.active_users ?? d.counters?.active_connections, get().stats.activeUsers),
        apiCalls: toNum(d.api_calls_today ?? d.counters?.events_emitted, get().stats.apiCalls),
        guardianIssues: toNum(d.guardian_issues, get().stats.guardianIssues),
      });
      if (d.services) get().updateHealth(buildHealthMatrix(d.services));
      if (Array.isArray(d.integration_status)) {
        get().updateIntegrationStatus(d.integration_status.map((i: any) => ({
          id: toStr(i.id || i.platform), platform: toStr(i.platform, 'unknown'),
          account_name: toStr(i.account_name || i.platform, 'Unknown'),
          healthy: Boolean(i.healthy ?? i.connected), mode: i.mode,
          accounts_configured: i.accounts_configured, last_check: i.last_check,
        })));
      }
      get().updateDataChannelStatus({ lastEventTimestamp: Date.now() });
    });

    socket.on('new_message', (raw: any) => {
      if (!raw) return;
      const m = normMessage(raw);
      if (isDuplicate('new_message', m.id)) return;
      set(s => ({ stats: { ...s.stats, messagesToday: s.stats.messagesToday + 1 } }));
      if (!get().isStreamPaused) get().addMessage(m);
      get().updateDataChannelStatus({ lastEventTimestamp: Date.now() });
    });

    socket.on('post_published', (raw: any) => {
      if (!raw) return;
      const p = normPost(raw);
      if (isDuplicate('post_published', p.id)) return;
      get().addPost(p);
      set(s => ({ stats: { ...s.stats, postsPublished: s.stats.postsPublished + 1 } }));
      get().updateDataChannelStatus({ lastEventTimestamp: Date.now() });
    });

    const handlePayload = (raw: any) => {
      if (!raw) return;
      const cid = raw?.id || raw?.request_id;
      if (cid && isDuplicate('api_payload', String(cid))) return;
      set(s => ({ stats: { ...s.stats, apiCalls: s.stats.apiCalls + 1 } }));
      get().addPayload(normPayload(raw));
      get().updateDataChannelStatus({ lastEventTimestamp: Date.now() });
    };
    socket.on('api_payload', handlePayload);
    socket.on('api_call', handlePayload);
    socket.on('payload', handlePayload);
    socket.on('traffic', handlePayload);
    socket.on('payload_inbound', (d: any) => { if (d) handlePayload({ ...d, type: 'inbound', endpoint: d.endpoint || '/webhook/facebook' }); });

    socket.on('service_status', (list: any) => {
      if (!Array.isArray(list)) return;
      get().updateHealth(list.map((i: any) => ({
        id: toStr(i?.id || i?.name, `svc_${Date.now()}`),
        name: toStr(i?.name || i?.page_name, 'Service'),
        status: i?.status === 'online' ? 'online' : i?.status === 'degraded' ? 'degraded' : 'offline',
        latency: toNum(i?.latency), lastChecked: Date.now(), uptime: toNum(i?.uptime),
      })));
    });

    socket.on('scan_complete', (d: any) => {
      if (!d) return;
      const findings = toNum(d.findings ?? d.total_findings);
      if (findings <= 0) { get().updateDataChannelStatus({ lastEventTimestamp: Date.now() }); return; }
      const a = normAlert({ ...d, id: d.id || `scan_${Date.now()}`, title: d.title || `Scan — ${findings} findings`, severity: d.severity || (d.critical > 0 ? 'CRITICAL' : d.high > 0 ? 'HIGH' : 'MEDIUM') });
      if (isDuplicate('scan_complete', a.id)) return;
      get().addAlert(a);
      set(s => ({ stats: { ...s.stats, guardianIssues: s.stats.guardianIssues + 1 } }));
      get().updateDataChannelStatus({ lastEventTimestamp: Date.now() });
    });

    // ── Enterprise events ────────────────────────────────────────────

    socket.on('plugin_status', (d: any) => {
      if (Array.isArray(d?.plugins)) { get().updatePluginStatus(d.plugins); get().updateDataChannelStatus({ lastEventTimestamp: Date.now() }); }
    });

    socket.on('ai_provider_health', (d: any) => {
      if (Array.isArray(d?.providers)) { get().updateAIProviderHealth(d.providers); get().updateDataChannelStatus({ lastEventTimestamp: Date.now() }); }
    });

    socket.on('ai_decision', (d: any) => {
      if (!d) return;
      get().updateAIDecision({ topic: toStr(d.topic, 'Unknown'), confidence: toNum(d.confidence), engagement_score: toNum(d.engagement_score), estimated_reach: toStr(d.estimated_reach, '0'), brand_id: d.brand_id, brand_name: d.brand_name, job_id: d.job_id, timestamp: d.timestamp });
      get().updateDataChannelStatus({ lastEventTimestamp: Date.now() });
    });

    socket.on('mission_status', (d: any) => {
      if (!d) return;
      get().updateMissionStatus({ goal: toStr(d.goal), stage: toStr(d.stage, 'Idle'), progress: toNum(d.progress), active_agent: toStr(d.active_agent, 'Standby'), is_active: Boolean(d.is_active), brand_id: d.brand_id, brand_name: d.brand_name, source: d.source, job_id: d.job_id, timestamp: d.timestamp });
      get().updateDataChannelStatus({ lastEventTimestamp: Date.now() });
    });

    socket.on('workflow_status', (d: any) => {
      if (!d) return;
      get().updateWorkflowMetrics({
        running: d.running !== undefined ? toNum(d.running) : get().workflowMetrics.running,
        queued: d.queued !== undefined ? toNum(d.queued) : get().workflowMetrics.queued,
        failed_today: d.failed_today !== undefined ? toNum(d.failed_today) : get().workflowMetrics.failed_today,
        completed_today: d.completed_today !== undefined ? toNum(d.completed_today) : get().workflowMetrics.completed_today,
      });
      get().updateDataChannelStatus({ lastEventTimestamp: Date.now() });
    });

    socket.on('system_resources', (d: any) => {
      if (!d) return;
      get().updateSystemResources({ cpu_percent: toNum(d.cpu_percent, get().systemResources.cpu_percent), memory_percent: toNum(d.memory_percent, get().systemResources.memory_percent), disk_percent: toNum(d.disk_percent, get().systemResources.disk_percent) });
      get().updateDataChannelStatus({ lastEventTimestamp: Date.now() });
    });

    set({ socket });
  }

  function disconnect(): void {
    const socket = get().socket;
    if (socket) { try { socket.removeAllListeners(); socket.io.removeAllListeners(); socket.disconnect(); } catch { /* */ } }
    set({ socket: null, socketConnected: false, socketTransport: null, socketError: null, socketReconnectAttempts: 0, socketLastEventAt: null });
    get().updateDataChannelStatus({ socketIO: 'disconnected' });
  }

  // ── Subscription lifecycle ──────────────────────────────────────────

  function startSubscriptions(): void {
    stopSubscriptions();
    const { restEndpoint, masterToken } = get();
    const base = normalizeRestEndpoint(restEndpoint);

    // Status bootstrap
    if (base) {
      apiGet(base, '/status', masterToken).then(res => { if (res.ok) set({ backendConfig: res.data }); }).catch(() => {});
    }

    // REST polling
    if (base) {
      const pt = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
        pollDashboard();
      }, POLLING_INTERVAL);
      const et = setInterval(() => {
        if (typeof document !== 'undefined' && document.visibilityState !== 'visible') return;
        pollEnterprise();
      }, ENTERPRISE_POLL_INTERVAL);
      set({ _pollingTimer: pt, _enterpriseTimer: et });
      get().updateDataChannelStatus({ restPolling: 'active' });
    } else {
      get().updateDataChannelStatus({ restPolling: 'paused' });
    }

    // Supabase realtime
    if (!isSupabaseConfigured()) { get().updateDataChannelStatus({ supabaseRealtime: 'unsubscribed' }); return; }
    const wid = get().selectedWorkspaceId;
    const filter = wid ? { filter: `workspace_id=eq.${String(wid)}` } : {};
    const ch = supabase
      .channel(`kanyoza-${String(wid || 'global')}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages', ...filter }, ({ new: row }: any) => {
        const m = normMessage(row);
        if (isDuplicate('message', m.id)) return;
        if (!get().isStreamPaused) get().addMessage(m);
        set(s => ({ stats: { ...s.stats, messagesToday: s.stats.messagesToday + 1 } }));
        get().updateDataChannelStatus({ lastEventTimestamp: Date.now() });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'posts', ...filter }, ({ new: row }: any) => {
        const p = normPost(row);
        if (isDuplicate('post', p.id)) return;
        get().addPost(p);
        set(s => ({ stats: { ...s.stats, postsPublished: s.stats.postsPublished + 1 } }));
        get().updateDataChannelStatus({ lastEventTimestamp: Date.now() });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'alerts', ...filter }, ({ new: row }: any) => {
        const a = normAlert(row);
        if (isDuplicate('alert', a.id)) return;
        get().addAlert(a);
        set(s => ({ stats: { ...s.stats, guardianIssues: s.stats.guardianIssues + 1 } }));
        get().updateDataChannelStatus({ lastEventTimestamp: Date.now() });
      })
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'payloads', ...filter }, ({ new: row }: any) => {
        get().addPayload(normPayload(row));
        get().updateDataChannelStatus({ lastEventTimestamp: Date.now() });
      })
      .subscribe((status: string) => {
        if (status === 'SUBSCRIBED') get().updateDataChannelStatus({ supabaseRealtime: 'subscribed', lastEventTimestamp: Date.now() });
        else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') get().updateDataChannelStatus({ supabaseRealtime: 'error' });
        else if (status === 'CLOSED') get().updateDataChannelStatus({ supabaseRealtime: 'unsubscribed' });
      });
    set({ _realtimeChannel: ch });
  }

  function stopSubscriptions(): void {
    const { _pollingTimer: pt, _enterpriseTimer: et, _realtimeChannel: ch } = get();
    if (pt) clearInterval(pt);
    if (et) clearInterval(et);
    if (ch) { try { supabase.removeChannel(ch); } catch { /* */ } }
    set({ _pollingTimer: null, _enterpriseTimer: null, _realtimeChannel: null });
    get().updateDataChannelStatus({ restPolling: 'paused', supabaseRealtime: 'unsubscribed' });
  }

  // ── Data fetching ────────────────────────────────────────────────────

  async function fetchInitialData(): Promise<void> {
    const { restEndpoint, masterToken } = get();
    const base = normalizeRestEndpoint(restEndpoint);
    const q = buildQuery();
    const token = masterToken;
    let loaded = false;

    // Supabase bootstrap
    if (isSupabaseConfigured()) {
      const wid = get().selectedWorkspaceId;
      for (const table of ['messages', 'posts', 'alerts', 'payloads'] as const) {
        try {
          let query = supabase.from(table).select('*').limit(20);
          if (wid) query = query.eq('workspace_id', wid);
          const { data, error } = await query;
          if (error || !data?.length) continue;
          if (table === 'messages' && get().messages.length === 0) { set({ messages: data.map(normMessage).slice(0, MAX_MESSAGES) }); loaded = true; }
          if (table === 'posts' && get().recentPosts.length === 0) { set({ recentPosts: data.map(normPost).slice(0, MAX_POSTS) }); loaded = true; }
          if (table === 'alerts' && get().guardianAlerts.length === 0) { set({ guardianAlerts: data.map(normAlert).slice(0, MAX_ALERTS) }); loaded = true; }
          if (table === 'payloads' && get().payloads.length === 0) { set({ payloads: data.map(normPayload).slice(0, MAX_PAYLOADS) }); loaded = true; }
        } catch { /* */ }
      }
    }

    // REST bootstrap
    if (base) {
      for (const ep of [
        { path: `/dashboard/live${q}`, handler: (d: any) => {
          if (!d) return;
          get().updateStats({
            messagesToday: toNum(d.messages_today ?? d.counters?.messages_today, get().stats.messagesToday),
            postsPublished: toNum(d.posts_published ?? d.counters?.posts_today, get().stats.postsPublished),
            activeUsers: toNum(d.active_users ?? d.counters?.active_connections, get().stats.activeUsers),
            apiCalls: toNum(d.api_calls_today ?? d.counters?.events_emitted, get().stats.apiCalls),
            guardianIssues: toNum(d.guardian_issues, get().stats.guardianIssues),
          });
          if (d.services) get().updateHealth(buildHealthMatrix(d.services));
          if (Array.isArray(d.integration_status)) {
            get().updateIntegrationStatus(d.integration_status.map((i: any) => ({
              id: toStr(i.id || i.platform), platform: toStr(i.platform, 'unknown'),
              account_name: toStr(i.account_name || i.platform, 'Unknown'),
              healthy: Boolean(i.healthy ?? i.connected), mode: i.mode,
              accounts_configured: i.accounts_configured, last_check: i.last_check,
            })));
          }
        }},
        { path: `/messages${q}&limit=50`, handler: (d: any) => {
          const rows = Array.isArray(d) ? d : d?.messages;
          if (Array.isArray(rows) && rows.length) { set({ messages: rows.map(normMessage).slice(0, MAX_MESSAGES) }); loaded = true; }
        }},
        { path: `/posts${q}`, handler: (d: any) => {
          const rows = Array.isArray(d) ? d : d?.posts;
          if (Array.isArray(rows) && rows.length) { set({ recentPosts: rows.map(normPost).slice(0, MAX_POSTS) }); loaded = true; }
        }},
        { path: `/health/deep${q}`, handler: (d: any) => {
          if (d?.services) get().updateHealth(buildHealthMatrix(d.services));
        }},
      ]) {
        const res = await apiGet(base, ep.path, token);
        logHttp(buildUrl(base, ep.path), 'GET', res.status || undefined, res.error, 'fetch.initial');
        if (res.ok) { ep.handler(res.data); loaded = true; }
      }
    }

    set({ isUsingLiveBackendData: loaded });
    await pollEnterprise();
  }

  async function fetchEnterpriseData(): Promise<void> {
    await pollEnterprise();
  }

  // ── Reset ────────────────────────────────────────────────────────────

  function resetData(): void {
    clearSeenEvents();
    set({
      messages: [], recentPosts: [], guardianAlerts: [], payloads: [], healthMatrix: [],
      pluginStatus: [], aiProviderHealth: [], aiDecision: null, missionStatus: null,
      workflowMetrics: { running: 0, queued: 0, failed_today: 0, completed_today: 0 },
      systemResources: { cpu_percent: 0, memory_percent: 0, disk_percent: 0 },
      integrationStatus: [],
      stats: { messagesToday: 0, postsPublished: 0, activeUsers: 0, apiCalls: 0, guardianIssues: 0, revenueMonthly: 0 },
      latencyHistory: [], httpLogs: [], lastNotification: null, backendConfig: null,
      dataChannelStatus: {
        socketIO: get().socketConnected ? 'connected' : 'disconnected',
        restPolling: get().restEndpoint ? 'active' : 'paused',
        supabaseRealtime: get()._realtimeChannel ? 'subscribed' : 'unsubscribed',
        lastEventTimestamp: null,
      },
    });
  }

  // ═════════════════════════════════════════════════════════════════════
  // INITIAL STATE
  // ═════════════════════════════════════════════════════════════════════

  return {
    // Auth — never trust localStorage for initial auth state; session is verified async in App.tsx
    isAuthenticated: false,
    login: () => {
      const rest = get().restEndpoint;
      if (rest) storage.set('rest_endpoint', normalizeRestEndpoint(rest));
      storage.set('kanyoza_authenticated', 'true');
      set({ isAuthenticated: true, restEndpoint: rest ? normalizeRestEndpoint(rest) : rest });
      fetchInitialData().catch(() => {});
      connect();
      startSubscriptions();
    },
    logout: () => {
      disconnect();
      stopSubscriptions();
      clearSeenEvents();
      ['master_token', 'supabase_url', 'supabase_anon_key', 'kanyoza_authenticated'].forEach(storage.remove);
      set({ isAuthenticated: false, masterToken: '', supabaseUrl: '', supabaseAnonKey: '', isUsingLiveBackendData: false });
      resetData();
    },

    // Theme
    theme: storage.get('theme') === 'light' ? 'light' : 'dark',
    toggleTheme: () => {
      const next = get().theme === 'dark' ? 'light' : 'dark';
      storage.set('theme', next);
      set({ theme: next });
    },

    // Tenancy
    currentTenant: storage.get('current_tenant') || 'Kanyoza Systems',
    setCurrentTenant: (t) => { storage.set('current_tenant', t); set({ currentTenant: t }); },
    selectedWorkspaceId: storage.get('selected_workspace_id') || null,
    setSelectedWorkspaceId: (id) => {
      if (id === null) storage.remove('selected_workspace_id'); else storage.set('selected_workspace_id', String(id));
      storage.remove('selected_brand_id');
      set({ selectedWorkspaceId: id, selectedBrandId: null });
      if (get().isAuthenticated) {
        stopSubscriptions();
        fetchInitialData().finally(() => {
          startSubscriptions();
        });
      }
    },
    selectedBrandId: storage.get('selected_brand_id') || null,
    setSelectedBrandId: (id) => {
      if (id === null) storage.remove('selected_brand_id'); else storage.set('selected_brand_id', String(id));
      set({ selectedBrandId: id });
      if (get().isAuthenticated) fetchInitialData().catch(() => {});
    },

    // Connection
    wsEndpoint: storage.get('ws_endpoint') || '',
    restEndpoint: normalizeRestEndpoint(storage.get('rest_endpoint') || ''),
    masterToken: storage.get('master_token') || '',
    setConnectionParams: (p) => {
      const prevWs = get().wsEndpoint, prevRest = get().restEndpoint, prevToken = get().masterToken;
      const nw = p.wsEndpoint !== undefined ? normalizeSocketUrl(p.wsEndpoint) : prevWs;
      const nr = p.restEndpoint !== undefined ? normalizeRestEndpoint(p.restEndpoint) : prevRest;
      const nt = p.masterToken !== undefined ? p.masterToken.trim() : prevToken;
      if (p.wsEndpoint !== undefined) storage.set('ws_endpoint', nw);
      if (p.restEndpoint !== undefined) storage.set('rest_endpoint', nr);
      if (p.masterToken !== undefined) storage.set('master_token', nt);
      set({ wsEndpoint: nw, restEndpoint: nr, masterToken: nt });
      if (nw !== prevWs || nr !== prevRest || nt !== prevToken) {
        disconnect(); stopSubscriptions();
        if (get().isAuthenticated) { fetchInitialData().catch(() => {}); connect(); startSubscriptions(); }
      }
    },

    // Service keys (secrets never stored in localStorage)
    supabaseUrl: storage.get('supabase_url') || '',
    supabaseAnonKey: storage.get('supabase_anon_key') || '',
    geminiKey: '', githubToken: '', githubRepo: '', githubBranch: 'main',
    fbPageId: '', fbVerifyToken: '', fbPageAccessToken: '', fbAppSecret: '',
    isUsingLiveBackendData: false,
    setServiceKeys: (keys) => {
      if (keys.supabase_url) storage.set('supabase_url', keys.supabase_url.trim());
      if (keys.supabase_anon_key) storage.set('supabase_anon_key', keys.supabase_anon_key.trim());
      set(s => ({ ...s, supabaseUrl: keys.supabase_url?.trim() || s.supabaseUrl, supabaseAnonKey: keys.supabase_anon_key?.trim() || s.supabaseAnonKey }));
      refreshSupabaseClient();
      if (get().isAuthenticated) { stopSubscriptions(); fetchInitialData().catch(() => {}); startSubscriptions(); }
    },

    // Socket
    socket: null, socketConnected: false, socketTransport: null, socketError: null, socketReconnectAttempts: 0, socketLastEventAt: null,
    connectSocket: connect,
    disconnectSocket: disconnect,

    // Live data
    messages: [], addMessage: (m) => set(s => ({ messages: [m, ...s.messages.filter(x => x.id !== m.id)].slice(0, MAX_MESSAGES) })),
    isStreamPaused: false, setStreamPaused: (p) => set({ isStreamPaused: p }),
    healthMatrix: [],
    updateHealth: (updates) => set(s => {
      const h = [...s.healthMatrix];
      for (const u of updates) {
        const idx = h.findIndex(x => x.id === u.id);
        const item = { ...u, lastChecked: Date.now() };
        if (idx >= 0) h[idx] = { ...h[idx], ...item }; else h.push(item);
      }
      return { healthMatrix: h.slice(0, MAX_HEALTH_MATRIX) };
    }),
    guardianAlerts: [],
    addAlert: (a) => set(s => ({ guardianAlerts: [a, ...s.guardianAlerts.filter(x => x.id !== a.id)].slice(0, MAX_ALERTS), lastNotification: { id: `n_${Date.now()}`, type: 'alert', title: a.title, subtitle: a.severity, severity: a.severity } })),
    recentPosts: [],
    addPost: (p) => set(s => ({ recentPosts: [p, ...s.recentPosts.filter(x => x.id !== p.id)].slice(0, MAX_POSTS), lastNotification: { id: `n_${Date.now()}`, type: 'post', title: p.title, subtitle: p.platform } })),
    payloads: [],
    addPayload: (p) => set(s => ({ payloads: [p, ...s.payloads.filter(x => x.id !== p.id)].slice(0, MAX_PAYLOADS) })),

    // Enterprise
    pluginStatus: [], updatePluginStatus: (p) => set({ pluginStatus: p }),
    aiProviderHealth: [], updateAIProviderHealth: (p) => set({ aiProviderHealth: p }),
    aiDecision: null, updateAIDecision: (d) => set({ aiDecision: d }),
    missionStatus: null, updateMissionStatus: (s) => set({ missionStatus: s }),
    workflowMetrics: { running: 0, queued: 0, failed_today: 0, completed_today: 0 },
    updateWorkflowMetrics: (m) => set(s => ({ workflowMetrics: { ...s.workflowMetrics, ...m } })),
    systemResources: { cpu_percent: 0, memory_percent: 0, disk_percent: 0 },
    updateSystemResources: (r) => set({ systemResources: r }),
    integrationStatus: [], updateIntegrationStatus: (i) => set({ integrationStatus: i }),
    dataChannelStatus: { socketIO: 'disconnected', restPolling: 'paused', supabaseRealtime: 'unsubscribed', lastEventTimestamp: null },
    updateDataChannelStatus: (p) => set(s => ({ dataChannelStatus: { ...s.dataChannelStatus, ...p } })),

    // Notifications
    lastNotification: null, dismissNotification: () => set({ lastNotification: null }),
    triggerNotification: (n) => set({ lastNotification: { id: Math.random().toString(36).slice(2), type: (['success','info','warning'].includes(n.type) ? 'message' : n.type) as LiveNotification['type'], title: n.title, subtitle: n.subtitle || n.message || '', severity: n.severity } }),

    // Stats
    stats: { messagesToday: 0, postsPublished: 0, activeUsers: 0, apiCalls: 0, guardianIssues: 0, revenueMonthly: 0 },
    updateStats: (p) => set(s => ({ stats: { ...s.stats, ...p } })),

    // UI
    isTerminalOpen: false, toggleTerminal: () => set(s => ({ isTerminalOpen: !s.isTerminalOpen })),
    pendingCommand: null, setPendingCommand: (c) => set({ pendingCommand: c }),
    personaMood: (storage.get('persona_mood') as AppState['personaMood']) || 'analytical',
    setPersonaMood: (m) => { storage.set('persona_mood', m); set({ personaMood: m }); },

    // Latency
    latencyHistory: [],
    pushLatency: (ms) => set(s => ({ latencyHistory: [...s.latencyHistory.slice(-(MAX_LATENCY_HISTORY - 1)), Math.max(0, toNum(ms))] })),

    // HTTP logs
    httpLogs: [], addHttpLog: (l) => set(s => ({ httpLogs: [l, ...s.httpLogs].slice(0, MAX_HTTP_LOGS) })), clearHttpLogs: () => set({ httpLogs: [] }),

    // Lifecycle
    fetchInitialData, fetchEnterpriseData,
    startRealtimeSubscriptions: startSubscriptions,
    stopRealtimeSubscriptions: stopSubscriptions,
    resetData,

    // Backend config
    backendConfig: null,

    // Internal
    _pollingTimer: null, _enterpriseTimer: null, _realtimeChannel: null,
  };
});

// ── Normalize stored endpoint on load ────────────────────────────────────
const init = useStore.getState();
if (init.restEndpoint) {
  const normalized = normalizeRestEndpoint(init.restEndpoint);
  if (normalized !== init.restEndpoint) {
    storage.set('rest_endpoint', normalized);
    useStore.setState({ restEndpoint: normalized });
  }
}
