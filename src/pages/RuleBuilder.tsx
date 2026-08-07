// ═══════════════════════════════════════════════════════════════════════════
// RULE BUILDER — Mission Control Autonomous Rules Console
// ═══════════════════════════════════════════════════════════════════════════
//
// Purpose:
//   Visual control plane for the Condition Engine.
//
// Capabilities:
//   • Rule CRUD
//   • Rule activation / pausing / disabling
//   • Multi-condition logic
//   • Rich operators
//   • Action configuration
//   • Cooldowns / rate limits
//   • Rule validation
//   • Dry-run testing
//   • Event simulation
//   • Execution history
//   • Engine health
//   • Rule statistics
//   • Search / filtering
//   • Rule duplication
//
// Expected backend endpoints:
//
//   GET    /rules
//   POST   /rules
//   PUT    /rules/:id
//   DELETE /rules/:id
//   POST   /rules/:id/toggle
//   POST   /rules/:id/test
//   POST   /rules/test
//   GET    /rules/history?limit=50
//   GET    /rules/metrics
//   GET    /rules/health
//   GET    /rules/events?limit=30
//   POST   /rules/events/simulate
//
// The UI gracefully falls back to local/demo data when the backend
// is unavailable.
//
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { motion, AnimatePresence } from 'motion/react';

import {
  Activity,
  AlertTriangle,
  BarChart3,
  Check,
  CheckCircle,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  CircleDot,
  Clock,
  Copy,
  Edit3,
  Eye,
  EyeOff,
  Filter,
  FlaskConical,
  GitBranch,
  History,
  Info,
  Loader2,
  Pause,
  Play,
  Plus,
  RefreshCw,
  Save,
  Search,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  TestTube2,
  ToggleLeft,
  ToggleRight,
  Trash,
  X,
  Zap,
} from 'lucide-react';

import { cn, vibrate } from '../lib/utils';
import { toast } from 'sonner';


// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

type Operator =
  | 'eq'
  | 'neq'
  | 'gt'
  | 'gte'
  | 'lt'
  | 'lte'
  | 'in'
  | 'not_in'
  | 'contains'
  | 'not_contains'
  | 'starts_with'
  | 'ends_with'
  | 'between'
  | 'exists'
  | 'not_exists'
  | 'regex';

type RulePriority =
  | 'critical'
  | 'high'
  | 'medium'
  | 'low';

type RuleStatus =
  | 'active'
  | 'paused'
  | 'disabled';

type ConditionLogic =
  | 'all'
  | 'any';

interface Condition {
  id?: string;
  field: string;
  op: Operator;
  value: any;
}

interface ConditionGroup {
  all?: Condition[];
  any?: Condition[];
}

interface RuleAction {
  id?: string;
  action: string;
  value?: any;
  params?: Record<string, any>;
}

interface Rule {
  id: string;
  name: string;
  description: string;
  priority: RulePriority;
  status: RuleStatus;

  when: ConditionGroup;

  then: RuleAction[];

  cooldown_seconds: number;

  max_firings_per_hour?: number;

  max_firings_per_day?: number;

  enabled?: boolean;

  tags?: string[];

  created_at?: string;

  updated_at?: string;

  last_fired_at?: string;

  firing_count?: number;

  success_count?: number;

  failure_count?: number;
}

interface RuleFiring {
  id?: string;

  rule_id: string;

  rule_name: string;

  fired_at: string;

  actions_executed: string[];

  success: boolean;

  execution_ms?: number;

  event?: string;

  error?: string;

  context?: Record<string, any>;
}

interface RuleMetrics {
  total_rules: number;

  active_rules: number;

  paused_rules: number;

  disabled_rules: number;

  firings_24h: number;

  successful_firings_24h: number;

  failed_firings_24h: number;

  success_rate: number;

  avg_execution_ms: number;

  last_execution_at?: string;

  events_processed_24h?: number;
}

interface EngineHealth {
  status: 'healthy' | 'degraded' | 'offline' | 'unknown';

  version?: string;

  uptime_seconds?: number;

  rules_loaded?: number;

  events_processed?: number;

  last_cycle_at?: string;

  queue_depth?: number;

  error_count?: number;
}

interface EngineEvent {
  id: string;

  event: string;

  brand_id?: string;

  post_id?: string;

  timestamp: string;

  processed?: boolean;

  matched_rules?: number;

  context?: Record<string, any>;
}

interface TestResult {
  matched: boolean;

  rule_id?: string;

  rule_name?: string;

  conditions?: {
    field: string;
    operator: string;
    expected: any;
    actual: any;
    matched: boolean;
  }[];

  actions?: RuleAction[];

  execution_ms?: number;

  explanation?: string;

  error?: string;
}


// ═══════════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════════

const OPERATOR_LABELS: Record<Operator, string> = {
  eq: '=',
  neq: '≠',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  in: 'IN',
  not_in: 'NOT IN',
  contains: 'CONTAINS',
  not_contains: 'NOT CONTAINS',
  starts_with: 'STARTS WITH',
  ends_with: 'ENDS WITH',
  between: 'BETWEEN',
  exists: 'EXISTS',
  not_exists: 'NOT EXISTS',
  regex: 'REGEX',
};

const PRIORITY_COLORS: Record<RulePriority, string> = {
  critical:
    'text-red-400 bg-red-500/10 border-red-500/20',

  high:
    'text-amber-400 bg-amber-500/10 border-amber-500/20',

  medium:
    'text-blue-400 bg-blue-500/10 border-blue-500/20',

  low:
    'text-zinc-400 bg-zinc-500/10 border-zinc-500/20',
};

const STATUS_COLORS: Record<RuleStatus, string> = {
  active:
    'text-emerald-400 bg-emerald-500/10 border-emerald-500/20',

  paused:
    'text-amber-400 bg-amber-500/10 border-amber-500/20',

  disabled:
    'text-zinc-500 bg-zinc-500/10 border-zinc-500/20',
};

const AVAILABLE_FIELDS = [
  'event',

  'brand_id',
  'brand_name',
  'brand_archetype',
  'brand_age_hours',
  'brand_configured',

  'current_day',
  'current_hour',
  'current_minute',
  'current_month',

  'sentiment',
  'topic_flagged',
  'topic',
  'content_type',

  'engagement_ratio',
  'engagement_rate',
  'total_engagement',
  'likes',
  'comments',
  'shares',
  'impressions',
  'clicks',

  'error_count_10min',
  'error_count_1h',

  'days_since_last_post',
  'posts_today',
  'posts_this_week',

  'provider_latency_ms',
  'provider_error_rate',
  'provider_health',

  'active_brands_count',
  'active_jobs_count',
  'queue_depth',

  'is_duplicate',
  'image_size_kb',
  'image_width',
  'image_height',

  'days_until_trial_end',

  'system_health',
  'memory_usage_percent',
  'cpu_usage_percent',

  'hourly_post_count',
  'daily_post_count',
];

const AVAILABLE_ACTIONS = [
  'set_content_type',
  'set_layout',
  'set_caption_prefix',
  'set_caption_suffix',

  'force_topic',
  'block_topic',

  'notify_admin',
  'notify_operator',

  'switch_ai_provider',
  'switch_image_provider',

  'pause_posting',
  'resume_posting',

  'change_schedule',
  'increase_post_frequency',
  'decrease_post_frequency',

  'clear_cache',

  'regenerate_content',
  'regenerate_image',

  'retry_job',
  'cancel_job',

  'create_followup_post',

  'mark_for_review',
  'approve_content',
  'reject_content',

  'disable_rule',
  'enable_rule',

  'set_system_mode',

  'record_learning_signal',
];

const EVENT_TYPES = [
  'engagement_analyzed',
  'post_published',
  'post_failed',
  'scheduled_tick',
  'render_failed',
  'ai_provider_failed',
  'image_generation_failed',
  'duplicate_detected',
  'content_generated',
  'brand_inactive',
  'system_health_changed',
  'trial_expiring',
  'manual_test',
];

const DEMO_CONTEXT: Record<string, any> = {
  event: 'engagement_analyzed',

  brand_id: 'demo_brand',
  brand_name: 'Demo Brand',
  brand_archetype: 'ministry',

  current_day: 'Sunday',
  current_hour: 9,
  current_minute: 30,
  current_month: 'August',

  sentiment: 'positive',
  topic_flagged: false,
  topic: 'community',
  content_type: 'educational',

  engagement_ratio: 2.4,
  engagement_rate: 8.7,
  total_engagement: 240,
  likes: 150,
  comments: 30,
  shares: 40,
  impressions: 2750,
  clicks: 20,

  error_count_10min: 0,
  error_count_1h: 1,

  days_since_last_post: 1,
  posts_today: 3,
  posts_this_week: 18,

  provider_latency_ms: 420,
  provider_error_rate: 0.02,
  provider_health: 'healthy',

  active_brands_count: 5,
  active_jobs_count: 2,
  queue_depth: 1,

  is_duplicate: false,
  image_size_kb: 380,
  image_width: 1200,
  image_height: 630,

  days_until_trial_end: 20,

  system_health: 'healthy',
  memory_usage_percent: 54,
  cpu_usage_percent: 32,

  hourly_post_count: 2,
  daily_post_count: 8,
};


// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function getRestEndpoint(): string {
  return (
    (window as any).__REST_ENDPOINT__ ||
    ''
  ).replace(/\/$/, '');
}

function getToken(): string {
  return (
    localStorage.getItem('master_token') ||
    localStorage.getItem('access_token') ||
    ''
  );
}

function getHeaders(): HeadersInit {
  const token = getToken();

  return {
    'Content-Type': 'application/json',

    ...(token
      ? {
          Authorization: `Bearer ${token}`,
        }
      : {}),
  };
}

async function apiRequest<T = any>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const endpoint = getRestEndpoint();

  const response = await fetch(
    `${endpoint}${path}`,
    {
      ...options,

      headers: {
        ...getHeaders(),
        ...(options.headers || {}),
      },
    },
  );

  if (!response.ok) {
    let message = `HTTP ${response.status}`;

    try {
      const data = await response.json();

      message =
        data?.detail ||
        data?.message ||
        data?.error ||
        message;
    } catch {
      // ignore JSON parsing failure
    }

    throw new Error(message);
  }

  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}

function createCondition(): Condition {
  return {
    id: `condition_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 7)}`,

    field: '',

    op: 'eq',

    value: '',
  };
}

function createAction(): RuleAction {
  return {
    id: `action_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 7)}`,

    action: 'notify_admin',

    value: '',

    params: {},
  };
}

function createEmptyRule(): Rule {
  return {
    id: `rule_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2, 7)}`,

    name: '',

    description: '',

    priority: 'medium',

    status: 'active',

    when: {
      all: [createCondition()],
    },

    then: [createAction()],

    cooldown_seconds: 0,

    max_firings_per_hour: undefined,

    max_firings_per_day: undefined,

    tags: [],
  };
}

function normalizeRule(rule: Rule): Rule {
  return {
    ...rule,

    when: {
      all: rule.when?.all || [],
      any: rule.when?.any || [],
    },

    then: Array.isArray(rule.then)
      ? rule.then
      : [],

    cooldown_seconds:
      Number(rule.cooldown_seconds) || 0,
  };
}

function formatDuration(seconds?: number): string {
  if (!seconds && seconds !== 0) {
    return '—';
  }

  if (seconds < 60) {
    return `${seconds}s`;
  }

  if (seconds < 3600) {
    return `${Math.round(seconds / 60)}m`;
  }

  if (seconds < 86400) {
    return `${Math.round(seconds / 3600)}h`;
  }

  return `${Math.round(seconds / 86400)}d`;
}

function formatTime(date?: string): string {
  if (!date) return '—';

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return parsed.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatDateTime(date?: string): string {
  if (!date) return '—';

  const parsed = new Date(date);

  if (Number.isNaN(parsed.getTime())) {
    return '—';
  }

  return parsed.toLocaleString();
}

function safeStringify(value: any): string {
  if (typeof value === 'string') {
    return value;
  }

  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

function parseInputValue(
  value: string,
  operator: Operator,
): any {
  const trimmed = value.trim();

  if (
    operator === 'exists' ||
    operator === 'not_exists'
  ) {
    return true;
  }

  if (
    operator === 'in' ||
    operator === 'not_in' ||
    operator === 'between'
  ) {
    try {
      return JSON.parse(trimmed);
    } catch {
      return trimmed
        .split(',')
        .map(v => v.trim())
        .filter(Boolean);
    }
  }

  if (trimmed === 'true') return true;

  if (trimmed === 'false') return false;

  if (trimmed === 'null') return null;

  if (
    trimmed !== '' &&
    !Number.isNaN(Number(trimmed))
  ) {
    return Number(trimmed);
  }

  return value;
}

function getAllConditions(rule: Rule): Condition[] {
  return [
    ...(rule.when?.all || []),
    ...(rule.when?.any || []),
  ];
}

function countConditions(rule: Rule): number {
  return getAllConditions(rule).length;
}

function countActions(rule: Rule): number {
  return rule.then?.length || 0;
}


// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function RuleBuilder() {
  const [rules, setRules] = useState<Rule[]>([]);

  const [history, setHistory] = useState<RuleFiring[]>([]);

  const [events, setEvents] = useState<EngineEvent[]>([]);

  const [metrics, setMetrics] = useState<RuleMetrics>({
    total_rules: 0,
    active_rules: 0,
    paused_rules: 0,
    disabled_rules: 0,
    firings_24h: 0,
    successful_firings_24h: 0,
    failed_firings_24h: 0,
    success_rate: 0,
    avg_execution_ms: 0,
  });

  const [health, setHealth] =
    useState<EngineHealth>({
      status: 'unknown',
    });

  const [editingRule, setEditingRule] =
    useState<Rule | null>(null);

  const [showEditor, setShowEditor] =
    useState(false);

  const [showHistory, setShowHistory] =
    useState(false);

  const [showEvents, setShowEvents] =
    useState(false);

  const [showMetrics, setShowMetrics] =
    useState(false);

  const [showSimulator, setShowSimulator] =
    useState(false);

  const [expandedRule, setExpandedRule] =
    useState<string | null>(null);

  const [search, setSearch] =
    useState('');

  const [statusFilter, setStatusFilter] =
    useState<'all' | RuleStatus>('all');

  const [priorityFilter, setPriorityFilter] =
    useState<'all' | RulePriority>('all');

  const [isLoading, setIsLoading] =
    useState(true);

  const [isRefreshing, setIsRefreshing] =
    useState(false);

  const [savingRuleId, setSavingRuleId] =
    useState<string | null>(null);

  const refreshTimer =
    useRef<ReturnType<typeof setInterval> | null>(
      null,
    );


  // ═══════════════════════════════════════════════════════════════════════
  // FETCH RULES
  // ═══════════════════════════════════════════════════════════════════════

  const fetchRules = useCallback(
    async (silent = false) => {
      if (!silent) {
        setIsRefreshing(true);
      }

      try {
        const data = await apiRequest<{
          rules?: Rule[];
        }>('/rules');

        setRules(
          (data.rules || []).map(normalizeRule),
        );
      } catch (error) {
        console.warn(
          'Rule API unavailable:',
          error,
        );

        if (!silent) {
          setRules(getDemoRules());

          toast.info(
            'Backend unavailable — showing local rules',
          );
        }
      } finally {
        setIsLoading(false);
        setIsRefreshing(false);
      }
    },
    [],
  );


  // ═══════════════════════════════════════════════════════════════════════
  // FETCH HISTORY
  // ═══════════════════════════════════════════════════════════════════════

  const fetchHistory = useCallback(
    async () => {
      try {
        const data = await apiRequest<{
          firings?: RuleFiring[];
        }>('/rules/history?limit=50');

        setHistory(data.firings || []);
      } catch {
        setHistory([]);
      }
    },
    [],
  );


  // ═══════════════════════════════════════════════════════════════════════
  // FETCH METRICS
  // ═══════════════════════════════════════════════════════════════════════

  const fetchMetrics = useCallback(
    async () => {
      try {
        const data =
          await apiRequest<RuleMetrics>(
            '/rules/metrics',
          );

        setMetrics(prev => ({
          ...prev,
          ...data,
        }));
      } catch {
        // Derive local metrics.
        setMetrics(prev => ({
          ...prev,

          total_rules: rules.length,

          active_rules: rules.filter(
            r => r.status === 'active',
          ).length,

          paused_rules: rules.filter(
            r => r.status === 'paused',
          ).length,

          disabled_rules: rules.filter(
            r => r.status === 'disabled',
          ).length,
        }));
      }
    },
    [rules],
  );


  // ═══════════════════════════════════════════════════════════════════════
  // FETCH HEALTH
  // ═══════════════════════════════════════════════════════════════════════

  const fetchHealth = useCallback(
    async () => {
      try {
        const data =
          await apiRequest<EngineHealth>(
            '/rules/health',
          );

        setHealth(data);
      } catch {
        setHealth({
          status: 'unknown',
          rules_loaded: rules.length,
        });
      }
    },
    [rules.length],
  );


  // ═══════════════════════════════════════════════════════════════════════
  // FETCH EVENTS
  // ═══════════════════════════════════════════════════════════════════════

  const fetchEvents = useCallback(
    async () => {
      try {
        const data =
          await apiRequest<{
            events?: EngineEvent[];
          }>('/rules/events?limit=30');

        setEvents(data.events || []);
      } catch {
        setEvents([]);
      }
    },
    [],
  );


  // ═══════════════════════════════════════════════════════════════════════
  // INITIAL LOAD
  // ═══════════════════════════════════════════════════════════════════════

  useEffect(() => {
    let mounted = true;

    const boot = async () => {
      await fetchRules();

      if (!mounted) return;

      await Promise.all([
        fetchHistory(),
        fetchEvents(),
        fetchHealth(),
      ]);
    };

    boot();

    return () => {
      mounted = false;
    };
  }, [
    fetchRules,
    fetchHistory,
    fetchEvents,
    fetchHealth,
  ]);


  // ═══════════════════════════════════════════════════════════════════════
  // PERIODIC REFRESH
  // ═══════════════════════════════════════════════════════════════════════

  useEffect(() => {
    refreshTimer.current =
      setInterval(() => {
        fetchRules(true);
        fetchHistory();
        fetchEvents();
        fetchHealth();
      }, 30000);

    return () => {
      if (refreshTimer.current) {
        clearInterval(refreshTimer.current);
      }
    };
  }, [
    fetchRules,
    fetchHistory,
    fetchEvents,
    fetchHealth,
  ]);


  // ═══════════════════════════════════════════════════════════════════════
  // LOCAL FILTERING
  // ═══════════════════════════════════════════════════════════════════════

  const filteredRules = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return rules.filter(rule => {
      if (
        statusFilter !== 'all' &&
        rule.status !== statusFilter
      ) {
        return false;
      }

      if (
        priorityFilter !== 'all' &&
        rule.priority !== priorityFilter
      ) {
        return false;
      }

      if (!query) return true;

      const searchable = [
        rule.name,
        rule.description,
        rule.id,
        rule.priority,
        rule.status,
        ...(rule.tags || []),
      ]
        .join(' ')
        .toLowerCase();

      return searchable.includes(query);
    });
  }, [
    rules,
    search,
    statusFilter,
    priorityFilter,
  ]);


  // ═══════════════════════════════════════════════════════════════════════
  // TOGGLE STATUS
  // ═══════════════════════════════════════════════════════════════════════

  const toggleRuleStatus = async (
    rule: Rule,
  ) => {
    const nextStatus: RuleStatus =
      rule.status === 'active'
        ? 'paused'
        : 'active';

    const previous = [...rules];

    setRules(prev =>
      prev.map(r =>
        r.id === rule.id
          ? {
              ...r,
              status: nextStatus,
            }
          : r,
      ),
    );

    vibrate(5);

    try {
      await apiRequest(
        `/rules/${encodeURIComponent(
          rule.id,
        )}/toggle`,
        {
          method: 'POST',

          body: JSON.stringify({
            status: nextStatus,
          }),
        },
      );

      toast.success(
        `Rule ${
          nextStatus === 'active'
            ? 'activated'
            : 'paused'
        }`,
      );
    } catch {
      setRules(previous);

      toast.error(
        'Could not synchronize rule status',
      );
    }
  };


  // ═══════════════════════════════════════════════════════════════════════
  // DELETE RULE
  // ═══════════════════════════════════════════════════════════════════════

  const deleteRule = async (
    rule: Rule,
  ) => {
    const confirmed =
      window.confirm(
        `Delete "${rule.name}"?\n\nThis cannot be undone.`,
      );

    if (!confirmed) return;

    const previous = [...rules];

    setRules(prev =>
      prev.filter(r => r.id !== rule.id),
    );

    try {
      await apiRequest(
        `/rules/${encodeURIComponent(
          rule.id,
        )}`,
        {
          method: 'DELETE',
        },
      );

      vibrate(10);

      toast.success(
        'Rule permanently deleted',
      );
    } catch {
      setRules(previous);

      toast.error(
        'Failed to delete rule',
      );
    }
  };


  // ═══════════════════════════════════════════════════════════════════════
  // DUPLICATE RULE
  // ═══════════════════════════════════════════════════════════════════════

  const duplicateRule = (
    rule: Rule,
  ) => {
    const duplicated: Rule = {
      ...rule,

      id: `rule_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2, 7)}`,

      name: `${rule.name} — Copy`,

      status: 'paused',

      created_at: undefined,

      updated_at: undefined,

      firing_count: 0,

      success_count: 0,

      failure_count: 0,
    };

    setEditingRule(duplicated);

    setShowEditor(true);

    vibrate(5);
  };


  // ═══════════════════════════════════════════════════════════════════════
  // SAVE RULE
  // ═══════════════════════════════════════════════════════════════════════

  const saveRule = async (
    rule: Rule,
  ) => {
    setSavingRuleId(rule.id);

    const exists =
      rules.some(r => r.id === rule.id);

    const previous = [...rules];

    if (exists) {
      setRules(prev =>
        prev.map(r =>
          r.id === rule.id
            ? normalizeRule(rule)
            : r,
        ),
      );
    } else {
      setRules(prev => [
        ...prev,
        normalizeRule(rule),
      ]);
    }

    try {
      await apiRequest(
        exists
          ? `/rules/${encodeURIComponent(
              rule.id,
            )}`
          : '/rules',
        {
          method: exists
            ? 'PUT'
            : 'POST',

          body: JSON.stringify(rule),
        },
      );

      toast.success(
        exists
          ? 'Rule updated successfully'
          : 'Rule created successfully',
      );

      vibrate(10);

      setShowEditor(false);

      setEditingRule(null);

      await Promise.all([
        fetchRules(true),
        fetchMetrics(),
      ]);
    } catch (error) {
      console.warn(
        'Rule persistence failed:',
        error,
      );

      // Keep local state if API isn't available.
      // This makes the console usable during
      // development / offline environments.

      setRules(prev => {
        if (exists) {
          return prev.map(r =>
            r.id === rule.id
              ? rule
              : r,
          );
        }

        return prev;
      });

      toast.warning(
        'Rule saved locally — backend synchronization unavailable',
      );

      setShowEditor(false);

      setEditingRule(null);
    } finally {
      setSavingRuleId(null);
    }
  };


  // ═══════════════════════════════════════════════════════════════════════
  // TEST RULE
  // ═══════════════════════════════════════════════════════════════════════

  const testRule = async (
    rule: Rule,
    context: Record<string, any>,
  ): Promise<TestResult> => {
    try {
      const result =
        await apiRequest<TestResult>(
          `/rules/${encodeURIComponent(
            rule.id,
          )}/test`,
          {
            method: 'POST',

            body: JSON.stringify({
              context,
              dry_run: true,
            }),
          },
        );

      return result;
    } catch {
      return evaluateRuleLocally(
        rule,
        context,
      );
    }
  };


  // ═══════════════════════════════════════════════════════════════════════
  // SIMULATE EVENT
  // ═══════════════════════════════════════════════════════════════════════

  const simulateEvent = async (
    event: string,
    context: Record<string, any>,
  ) => {
    try {
      const result =
        await apiRequest<TestResult>(
          '/rules/events/simulate',
          {
            method: 'POST',

            body: JSON.stringify({
              event,

              context: {
                ...context,

                event,
              },

              dry_run: true,
            }),
          },
        );

      toast.success(
        result.matched
          ? 'Event matched one or more rules'
          : 'Event processed — no rules matched',
      );

      await Promise.all([
        fetchHistory(),
        fetchEvents(),
        fetchMetrics(),
      ]);

      return result;
    } catch {
      let matched = 0;

      for (const rule of rules) {
        if (rule.status !== 'active') {
          continue;
        }

        const result =
          evaluateRuleLocally(
            rule,
            {
              ...context,
              event,
            },
          );

        if (result.matched) {
          matched++;
        }
      }

      toast.info(
        `Simulation complete — ${matched} rule${
          matched === 1
            ? ''
            : 's'
        } matched`,
      );

      return {
        matched: matched > 0,

        explanation:
          `${matched} rule(s) matched locally.`,
      };
    }
  };


  // ═══════════════════════════════════════════════════════════════════════
  // ENGINE HEALTH LABEL
  // ═══════════════════════════════════════════════════════════════════════

  const healthLabel =
    health.status === 'healthy'
      ? 'HEALTHY'
      : health.status === 'degraded'
      ? 'DEGRADED'
      : health.status === 'offline'
      ? 'OFFLINE'
      : 'UNKNOWN';


  // ═══════════════════════════════════════════════════════════════════════
  // RENDER
  // ═══════════════════════════════════════════════════════════════════════

  if (isLoading) {
    return (
      <div className="space-y-3 pb-20 animate-pulse">

        <div className="h-20 rounded-2xl bg-[#0a0a14]/80 border border-zinc-800/50" />

        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {[1, 2, 3, 4].map(i => (
            <div
              key={i}
              className="h-20 rounded-xl bg-[#0a0a14]/70 border border-zinc-800/40"
            />
          ))}
        </div>

        {[1, 2, 3, 4].map(i => (
          <div
            key={i}
            className="h-24 rounded-2xl bg-[#0a0a14]/60 border border-zinc-800/30"
          />
        ))}
      </div>
    );
  }


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

      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* HEADER                                                           */}
      {/* ═════════════════════════════════════════════════════════════════ */}

      <div className="rounded-2xl border border-zinc-800/60 bg-[#0a0a14]/90 p-4">

        <div className="flex items-center justify-between gap-3 flex-wrap">

          <div className="flex items-center gap-3">

            <div className="relative">

              <div className="p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20">
                <GitBranch className="w-5 h-5 text-indigo-400" />
              </div>

              {health.status === 'healthy' && (
                <span className="absolute -right-1 -top-1 w-2.5 h-2.5 rounded-full bg-emerald-400 border-2 border-[#0a0a14] animate-pulse" />
              )}

            </div>

            <div>

              <div className="flex items-center gap-2">

                <h1 className="text-lg font-bold text-white tracking-wider font-mono">
                  RULE
                  <span className="text-zinc-600">
                    _ENGINE
                  </span>
                </h1>

                <span
                  className={cn(
                    'px-1.5 py-0.5 rounded text-[7px] font-mono font-bold border',
                    health.status === 'healthy'
                      ? 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20'
                      : health.status === 'degraded'
                      ? 'text-amber-400 bg-amber-500/10 border-amber-500/20'
                      : 'text-zinc-500 bg-zinc-500/10 border-zinc-800',
                  )}
                >
                  {healthLabel}
                </span>

              </div>

              <p className="text-[8px] text-zinc-600 font-mono uppercase tracking-[0.15em] mt-1">
                Autonomous Decision Control Plane
              </p>

            </div>

          </div>


          <div className="flex items-center gap-1.5 flex-wrap">

            <button
              onClick={() => {
                setShowMetrics(v => !v);
                vibrate(3);
              }}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[8px] font-mono font-bold uppercase border transition-all',
                showMetrics
                  ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                  : 'text-zinc-500 border-zinc-800 hover:text-zinc-300',
              )}
            >
              <BarChart3 className="w-3 h-3" />
              Metrics
            </button>


            <button
              onClick={() => {
                setShowHistory(v => !v);
                vibrate(3);
              }}
              className={cn(
                'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[8px] font-mono font-bold uppercase border transition-all',
                showHistory
                  ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
                  : 'text-zinc-500 border-zinc-800 hover:text-zinc-300',
              )}
            >
              <History className="w-3 h-3" />
              History
            </button>


            <button
              onClick={() => {
                setShowSimulator(true);
                vibrate(5);
              }}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[8px] font-mono font-bold uppercase border border-zinc-800 text-zinc-500 hover:text-zinc-300 transition-all"
            >
              <FlaskConical className="w-3 h-3" />
              Simulate
            </button>


            <button
              onClick={() => {
                setEditingRule(null);
                setShowEditor(true);
                vibrate(5);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[8px] font-mono font-bold uppercase bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/30 transition-all"
            >
              <Plus className="w-3 h-3" />
              New Rule
            </button>

          </div>

        </div>


        {/* Rule summary */}

        <div className="mt-4 grid grid-cols-2 md:grid-cols-5 gap-2">

          <MetricCard
            label="Rules"
            value={rules.length}
            icon={<GitBranch className="w-3 h-3" />}
          />

          <MetricCard
            label="Active"
            value={
              rules.filter(
                r => r.status === 'active',
              ).length
            }
            icon={<Zap className="w-3 h-3" />}
            positive
          />

          <MetricCard
            label="Paused"
            value={
              rules.filter(
                r => r.status === 'paused',
              ).length
            }
            icon={<Pause className="w-3 h-3" />}
          />

          <MetricCard
            label="Firings 24h"
            value={metrics.firings_24h}
            icon={<Activity className="w-3 h-3" />}
          />

          <MetricCard
            label="Success"
            value={`${metrics.success_rate || 0}%`}
            icon={<CheckCircle className="w-3 h-3" />}
            positive={
              Number(metrics.success_rate || 0) >= 90
            }
          />

        </div>

      </div>


      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* METRICS PANEL                                                    */}
      {/* ═════════════════════════════════════════════════════════════════ */}

      <AnimatePresence>
        {showMetrics && (
          <MetricsPanel
            metrics={metrics}
            health={health}
            onRefresh={async () => {
              await Promise.all([
                fetchMetrics(),
                fetchHealth(),
              ]);
            }}
          />
        )}
      </AnimatePresence>


      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* FILTER BAR                                                       */}
      {/* ═════════════════════════════════════════════════════════════════ */}

      <div className="rounded-2xl border border-zinc-800/60 bg-[#0a0a14]/80 p-2">

        <div className="flex items-center gap-2 flex-wrap">

          <div className="relative flex-1 min-w-[180px]">

            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-zinc-600" />

            <input
              value={search}
              onChange={e =>
                setSearch(e.target.value)
              }
              placeholder="Search rules..."
              className="w-full bg-zinc-900/50 border border-zinc-800/60 rounded-lg pl-8 pr-3 py-2 text-[10px] font-mono text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-indigo-500/40"
            />

          </div>


          <div className="flex items-center gap-1">

            <Filter className="w-3 h-3 text-zinc-700" />

            {(
              [
                'all',
                'active',
                'paused',
                'disabled',
              ] as const
            ).map(status => (
              <button
                key={status}
                onClick={() =>
                  setStatusFilter(status)
                }
                className={cn(
                  'px-2 py-1.5 rounded-lg text-[8px] font-mono uppercase transition-all',
                  statusFilter === status
                    ? 'bg-indigo-500/15 text-indigo-400'
                    : 'text-zinc-600 hover:text-zinc-400',
                )}
              >
                {status}
              </button>
            ))}

          </div>


          <select
            value={priorityFilter}
            onChange={e =>
              setPriorityFilter(
                e.target.value as
                  | 'all'
                  | RulePriority,
              )
            }
            className="bg-zinc-900/50 border border-zinc-800/60 rounded-lg px-2 py-1.5 text-[8px] font-mono text-zinc-500 focus:outline-none"
          >
            <option value="all">
              All priorities
            </option>

            <option value="critical">
              Critical
            </option>

            <option value="high">
              High
            </option>

            <option value="medium">
              Medium
            </option>

            <option value="low">
              Low
            </option>
          </select>


          <button
            onClick={() => {
              fetchRules();
              fetchHistory();
              fetchEvents();
              fetchHealth();
              vibrate(3);
            }}
            className="p-2 rounded-lg border border-zinc-800 text-zinc-600 hover:text-zinc-300 transition-colors"
            title="Refresh"
          >
            <RefreshCw
              className={cn(
                'w-3 h-3',
                isRefreshing &&
                  'animate-spin',
              )}
            />
          </button>

        </div>

      </div>


      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* RULE LIST                                                         */}
      {/* ═════════════════════════════════════════════════════════════════ */}

      <div className="space-y-2">

        {filteredRules.length === 0 ? (

          <div className="rounded-2xl border border-dashed border-zinc-800 bg-[#0a0a14]/60 py-14 text-center">

            <GitBranch className="w-7 h-7 text-zinc-800 mx-auto mb-3" />

            <p className="text-[10px] font-mono text-zinc-600">
              No rules match the current filters.
            </p>

            <button
              onClick={() => {
                setSearch('');
                setStatusFilter('all');
                setPriorityFilter('all');
              }}
              className="mt-3 text-[9px] font-mono text-indigo-400 hover:text-indigo-300"
            >
              Clear filters
            </button>

          </div>

        ) : (

          filteredRules.map(rule => (
            <RuleCard
              key={rule.id}
              rule={rule}
              expanded={
                expandedRule === rule.id
              }
              saving={
                savingRuleId === rule.id
              }
              onExpand={() =>
                setExpandedRule(
                  expandedRule === rule.id
                    ? null
                    : rule.id,
                )
              }
              onToggle={() =>
                toggleRuleStatus(rule)
              }
              onEdit={() => {
                setEditingRule(rule);
                setShowEditor(true);
              }}
              onDelete={() =>
                deleteRule(rule)
              }
              onDuplicate={() =>
                duplicateRule(rule)
              }
              onTest={() => {
                setEditingRule(rule);
                setShowSimulator(true);
              }}
            />
          ))

        )}

      </div>


      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* HISTORY                                                          */}
      {/* ═════════════════════════════════════════════════════════════════ */}

      <AnimatePresence>
        {showHistory && (
          <HistoryPanel
            history={history}
            onClose={() =>
              setShowHistory(false)
            }
          />
        )}
      </AnimatePresence>


      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* EVENTS                                                            */}
      {/* ═════════════════════════════════════════════════════════════════ */}

      <AnimatePresence>
        {showEvents && (
          <EventsPanel
            events={events}
            onClose={() =>
              setShowEvents(false)
            }
          />
        )}
      </AnimatePresence>


      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* RULE EDITOR                                                       */}
      {/* ═════════════════════════════════════════════════════════════════ */}

      <AnimatePresence>
        {showEditor && (
          <RuleEditorModal
            rule={editingRule}
            onSave={saveRule}
            onClose={() => {
              setShowEditor(false);
              setEditingRule(null);
            }}
            onTest={testRule}
          />
        )}
      </AnimatePresence>


      {/* ═════════════════════════════════════════════════════════════════ */}
      {/* SIMULATOR                                                         */}
      {/* ═════════════════════════════════════════════════════════════════ */}

      <AnimatePresence>
        {showSimulator && (
          <RuleSimulatorModal
            rule={editingRule}
            rules={rules}
            onSimulate={simulateEvent}
            onTest={testRule}
            onClose={() =>
              setShowSimulator(false)
            }
          />
        )}
      </AnimatePresence>

    </motion.div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// METRIC CARD
// ═══════════════════════════════════════════════════════════════════════════

function MetricCard({
  label,
  value,
  icon,
  positive = false,
}: {
  label: string;
  value: React.ReactNode;
  icon: React.ReactNode;
  positive?: boolean;
}) {
  return (
    <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/30 px-3 py-2.5">

      <div className="flex items-center justify-between">

        <span className="text-[8px] font-mono uppercase tracking-wider text-zinc-600">
          {label}
        </span>

        <span
          className={
            positive
              ? 'text-emerald-400'
              : 'text-zinc-700'
          }
        >
          {icon}
        </span>

      </div>

      <div
        className={cn(
          'mt-1 text-sm font-bold font-mono',
          positive
            ? 'text-emerald-400'
            : 'text-zinc-300',
        )}
      >
        {value}
      </div>

    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// RULE CARD
// ═══════════════════════════════════════════════════════════════════════════

function RuleCard({
  rule,
  expanded,
  saving,
  onExpand,
  onToggle,
  onEdit,
  onDelete,
  onDuplicate,
  onTest,
}: {
  rule: Rule;
  expanded: boolean;
  saving: boolean;
  onExpand: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onDuplicate: () => void;
  onTest: () => void;
}) {
  const conditions =
    getAllConditions(rule);

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
      className="rounded-2xl border border-zinc-800/60 bg-[#0a0a14]/80 overflow-hidden"
    >

      {/* Header */}

      <div
        className="flex items-center gap-3 px-4 py-3 cursor-pointer"
        onClick={onExpand}
      >

        <div className="flex-1 min-w-0">

          <div className="flex items-center gap-2 flex-wrap">

            <span
              className={cn(
                'px-1.5 py-0.5 rounded text-[7px] font-mono font-bold uppercase border',
                PRIORITY_COLORS[
                  rule.priority
                ],
              )}
            >
              {rule.priority}
            </span>


            <span
              className={cn(
                'px-1.5 py-0.5 rounded text-[7px] font-mono font-bold uppercase border',
                STATUS_COLORS[
                  rule.status
                ],
              )}
            >
              {rule.status}
            </span>


            <span
              className={cn(
                'w-1.5 h-1.5 rounded-full',
                rule.status === 'active'
                  ? 'bg-emerald-400 animate-pulse'
                  : rule.status === 'paused'
                  ? 'bg-amber-400'
                  : 'bg-zinc-600',
              )}
            />

            <h3 className="text-sm font-bold text-white truncate">
              {rule.name ||
                'Untitled Rule'}
            </h3>

          </div>


          <p className="text-[9px] text-zinc-600 font-mono truncate mt-1">
            {rule.description ||
              'No description'}
          </p>

        </div>


        <div className="hidden sm:flex items-center gap-3 text-[8px] font-mono text-zinc-700">

          <span>
            {conditions.length}{' '}
            condition
            {conditions.length === 1
              ? ''
              : 's'}
          </span>

          <span>
            {countActions(rule)} actions
          </span>

          <span>
            <Clock className="w-3 h-3 inline mr-1" />
            {formatDuration(
              rule.cooldown_seconds,
            )}
          </span>

        </div>


        <div
          className="flex items-center gap-0.5"
          onClick={e =>
            e.stopPropagation()
          }
        >

          <button
            onClick={onTest}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-cyan-400 hover:bg-cyan-500/10 transition-colors"
            title="Test rule"
          >
            <TestTube2 className="w-3.5 h-3.5" />
          </button>


          <button
            onClick={onToggle}
            className={cn(
              'p-1.5 rounded-lg transition-colors',
              rule.status === 'active'
                ? 'text-emerald-400 hover:bg-emerald-500/10'
                : 'text-amber-400 hover:bg-amber-500/10',
            )}
            title={
              rule.status === 'active'
                ? 'Pause'
                : 'Activate'
            }
          >
            {rule.status === 'active' ? (
              <Pause className="w-3.5 h-3.5" />
            ) : (
              <Play className="w-3.5 h-3.5" />
            )}
          </button>


          <button
            onClick={onEdit}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
            title="Edit"
          >
            <Edit3 className="w-3.5 h-3.5" />
          </button>


          <button
            onClick={onDuplicate}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-indigo-400 hover:bg-indigo-500/10 transition-colors"
            title="Duplicate"
          >
            <Copy className="w-3.5 h-3.5" />
          </button>


          <button
            onClick={onDelete}
            className="p-1.5 rounded-lg text-zinc-600 hover:text-red-400 hover:bg-red-500/10 transition-colors"
            title="Delete"
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>


          {expanded ? (
            <ChevronUp className="w-3.5 h-3.5 text-zinc-700 ml-1" />
          ) : (
            <ChevronDown className="w-3.5 h-3.5 text-zinc-700 ml-1" />
          )}

        </div>

      </div>


      {/* Expanded */}

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{
              height: 0,
              opacity: 0,
            }}
            animate={{
              height: 'auto',
              opacity: 1,
            }}
            exit={{
              height: 0,
              opacity: 0,
            }}
            className="border-t border-zinc-800/50"
          >

            <div className="p-4 space-y-4">

              {/* Conditions */}

              <RuleSection
                title="WHEN"
                icon={
                  <Filter className="w-3 h-3" />
                }
              >

                <div className="space-y-1.5">

                  {(rule.when.all || []).map(
                    (condition, index) => (
                      <ConditionPreview
                        key={
                          condition.id ||
                          index
                        }
                        condition={
                          condition
                        }
                      />
                    ),
                  )}


                  {(rule.when.any || []).map(
                    (condition, index) => (
                      <ConditionPreview
                        key={
                          condition.id ||
                          index
                        }
                        condition={
                          condition
                        }
                        isOr
                      />
                    ),
                  )}

                </div>

              </RuleSection>


              {/* Actions */}

              <RuleSection
                title="THEN"
                icon={
                  <Zap className="w-3 h-3" />
                }
              >

                <div className="space-y-1.5">

                  {rule.then.map(
                    (action, index) => (
                      <ActionPreview
                        key={
                          action.id ||
                          index
                        }
                        action={action}
                      />
                    ),
                  )}

                </div>

              </RuleSection>


              {/* Runtime */}

              <RuleSection
                title="RUNTIME POLICY"
                icon={
                  <Settings2 className="w-3 h-3" />
                }
              >

                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">

                  <RuntimeItem
                    label="Cooldown"
                    value={formatDuration(
                      rule.cooldown_seconds,
                    )}
                  />

                  <RuntimeItem
                    label="Max / hour"
                    value={
                      rule.max_firings_per_hour ??
                      '∞'
                    }
                  />

                  <RuntimeItem
                    label="Max / day"
                    value={
                      rule.max_firings_per_day ??
                      '∞'
                    }
                  />

                  <RuntimeItem
                    label="Firings"
                    value={
                      rule.firing_count ??
                      0
                    }
                  />

                </div>

              </RuleSection>


              {/* Stats */}

              <div className="flex items-center justify-between flex-wrap gap-3 pt-1">

                <div className="flex items-center gap-3 text-[8px] font-mono text-zinc-600">

                  <span>
                    ID: {rule.id}
                  </span>

                  {rule.last_fired_at && (
                    <span>
                      Last fired:{' '}
                      {formatDateTime(
                        rule.last_fired_at,
                      )}
                    </span>
                  )}

                </div>


                <div className="flex items-center gap-3 text-[8px] font-mono">

                  <span className="text-emerald-500">
                    ✓{' '}
                    {rule.success_count ||
                      0}
                  </span>

                  <span className="text-red-500">
                    ×{' '}
                    {rule.failure_count ||
                      0}
                  </span>

                </div>

              </div>

            </div>

          </motion.div>
        )}
      </AnimatePresence>


      {saving && (
        <div className="absolute" />
      )}

    </motion.div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// RULE SECTION
// ═══════════════════════════════════════════════════════════════════════════

function RuleSection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div>

      <div className="flex items-center gap-1.5 mb-2 text-zinc-600">

        {icon}

        <span className="text-[8px] font-mono font-bold uppercase tracking-wider">
          {title}
        </span>

      </div>

      {children}

    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// CONDITION PREVIEW
// ═══════════════════════════════════════════════════════════════════════════

function ConditionPreview({
  condition,
  isOr = false,
}: {
  condition: Condition;
  isOr?: boolean;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[9px] font-mono bg-zinc-900/50 rounded-lg px-2.5 py-1.5 border border-zinc-800/40">

      {isOr && (
        <span className="text-amber-400 font-bold">
          OR
        </span>
      )}

      <span className="text-zinc-400">
        {condition.field}
      </span>

      <span className="text-indigo-400 font-bold">
        {OPERATOR_LABELS[
          condition.op
        ] || condition.op}
      </span>

      <span className="text-zinc-300 truncate">
        {safeStringify(
          condition.value,
        )}
      </span>

    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// ACTION PREVIEW
// ═══════════════════════════════════════════════════════════════════════════

function ActionPreview({
  action,
}: {
  action: RuleAction;
}) {
  return (
    <div className="flex items-center gap-1.5 text-[9px] font-mono bg-zinc-900/50 rounded-lg px-2.5 py-1.5 border border-zinc-800/40">

      <Zap className="w-2.5 h-2.5 text-amber-400" />

      <span className="text-zinc-300">
        {action.action}
      </span>

      {action.value !==
        undefined &&
        action.value !== '' && (
          <span className="text-zinc-500 truncate">
            →{' '}
            {safeStringify(
              action.value,
            )}
          </span>
        )}

    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// RUNTIME ITEM
// ═══════════════════════════════════════════════════════════════════════════

function RuntimeItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-lg bg-zinc-900/40 border border-zinc-800/40 p-2">

      <p className="text-[7px] font-mono uppercase text-zinc-700">
        {label}
      </p>

      <p className="text-[10px] font-mono text-zinc-300 mt-0.5">
        {value}
      </p>

    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// METRICS PANEL
// ═══════════════════════════════════════════════════════════════════════════

function MetricsPanel({
  metrics,
  health,
  onRefresh,
}: {
  metrics: RuleMetrics;
  health: EngineHealth;
  onRefresh: () => Promise<void>;
}) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: -10,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      exit={{
        opacity: 0,
        y: -10,
      }}
      className="rounded-2xl border border-zinc-800/60 bg-[#0a0a14]/80 p-4"
    >

      <div className="flex items-center justify-between mb-4">

        <div>

          <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
            Engine Telemetry
          </h3>

          <p className="text-[8px] font-mono text-zinc-700 mt-0.5">
            Autonomous decision engine runtime
          </p>

        </div>

        <button
          onClick={onRefresh}
          className="p-1.5 text-zinc-600 hover:text-zinc-300"
        >
          <RefreshCw className="w-3 h-3" />
        </button>

      </div>


      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">

        <TelemetryItem
          label="Firings / 24h"
          value={metrics.firings_24h}
        />

        <TelemetryItem
          label="Events / 24h"
          value={
            metrics.events_processed_24h ??
            0
          }
        />

        <TelemetryItem
          label="Success rate"
          value={`${metrics.success_rate || 0}%`}
        />

        <TelemetryItem
          label="Avg execution"
          value={`${metrics.avg_execution_ms || 0}ms`}
        />

        <TelemetryItem
          label="Active rules"
          value={metrics.active_rules}
        />

        <TelemetryItem
          label="Failed executions"
          value={
            metrics.failed_firings_24h
          }
        />

        <TelemetryItem
          label="Queue depth"
          value={
            health.queue_depth ??
            0
          }
        />

        <TelemetryItem
          label="Loaded rules"
          value={
            health.rules_loaded ??
            metrics.total_rules
          }
        />

      </div>

    </motion.div>
  );
}


function TelemetryItem({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-zinc-800/50 bg-zinc-900/30 p-3">

      <p className="text-[7px] font-mono uppercase text-zinc-700">
        {label}
      </p>

      <p className="text-sm font-bold font-mono text-zinc-300 mt-1">
        {value}
      </p>

    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// HISTORY PANEL
// ═══════════════════════════════════════════════════════════════════════════

function HistoryPanel({
  history,
  onClose,
}: {
  history: RuleFiring[];
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 20,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      exit={{
        opacity: 0,
        y: 20,
      }}
      className="rounded-2xl border border-zinc-800/60 bg-[#0a0a14]/80 p-4"
    >

      <div className="flex items-center justify-between mb-3">

        <div>

          <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
            Rule Execution History
          </h3>

          <p className="text-[8px] font-mono text-zinc-700">
            Recent autonomous decisions
          </p>

        </div>

        <button
          onClick={onClose}
          className="text-zinc-600 hover:text-zinc-300"
        >
          <X className="w-4 h-4" />
        </button>

      </div>


      {history.length === 0 ? (

        <div className="py-10 text-center">

          <History className="w-6 h-6 text-zinc-800 mx-auto mb-2" />

          <p className="text-[9px] text-zinc-600 font-mono">
            No rule executions recorded.
          </p>

        </div>

      ) : (

        <div className="space-y-1 max-h-80 overflow-y-auto">

          {history.map(
            (firing, index) => (
              <div
                key={
                  firing.id ||
                  `${firing.rule_id}-${index}`
                }
                className="flex items-center gap-2 text-[9px] font-mono py-2 px-2 rounded-lg hover:bg-zinc-900/50"
              >

                <span className="text-zinc-700 w-14 shrink-0">
                  {formatTime(
                    firing.fired_at,
                  )}
                </span>


                {firing.success ? (
                  <CheckCircle className="w-3 h-3 text-emerald-400 shrink-0" />
                ) : (
                  <AlertTriangle className="w-3 h-3 text-red-400 shrink-0" />
                )}


                <span className="text-zinc-400 truncate flex-1">
                  {firing.rule_name}
                </span>


                <span className="text-zinc-700 hidden md:block">
                  {firing.actions_executed.length}{' '}
                  actions
                </span>


                {firing.execution_ms !==
                  undefined && (
                  <span className="text-zinc-700 hidden md:block">
                    {firing.execution_ms}ms
                  </span>
                )}

              </div>
            ),
          )}

        </div>

      )}

    </motion.div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// EVENTS PANEL
// ═══════════════════════════════════════════════════════════════════════════

function EventsPanel({
  events,
  onClose,
}: {
  events: EngineEvent[];
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{
        opacity: 0,
        y: 20,
      }}
      animate={{
        opacity: 1,
        y: 0,
      }}
      exit={{
        opacity: 0,
        y: 20,
      }}
      className="rounded-2xl border border-zinc-800/60 bg-[#0a0a14]/80 p-4"
    >

      <div className="flex items-center justify-between mb-3">

        <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
          Event Stream
        </h3>

        <button
          onClick={onClose}
          className="text-zinc-600 hover:text-zinc-300"
        >
          <X className="w-4 h-4" />
        </button>

      </div>


      {events.length === 0 ? (

        <p className="text-center py-8 text-[9px] font-mono text-zinc-700">
          No recent events.
        </p>

      ) : (

        <div className="space-y-1">

          {events.map(event => (
            <div
              key={event.id}
              className="flex items-center gap-2 px-2 py-2 rounded-lg bg-zinc-900/30"
            >

              <CircleDot className="w-3 h-3 text-indigo-400" />

              <span className="text-[9px] font-mono text-zinc-400 flex-1">
                {event.event}
              </span>

              <span className="text-[8px] font-mono text-zinc-700">
                {event.matched_rules ??
                  0}{' '}
                matched
              </span>

              <span className="text-[8px] font-mono text-zinc-700">
                {formatTime(
                  event.timestamp,
                )}
              </span>

            </div>
          ))}

        </div>

      )}

    </motion.div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// RULE EDITOR MODAL
// ═══════════════════════════════════════════════════════════════════════════

function RuleEditorModal({
  rule,
  onSave,
  onClose,
  onTest,
}: {
  rule: Rule | null;
  onSave: (rule: Rule) => Promise<void>;
  onClose: () => void;
  onTest: (
    rule: Rule,
    context: Record<string, any>,
  ) => Promise<TestResult>;
}) {
  const [name, setName] =
    useState(rule?.name || '');

  const [description, setDescription] =
    useState(
      rule?.description || '',
    );

  const [priority, setPriority] =
    useState<RulePriority>(
      rule?.priority || 'medium',
    );

  const initialLogic: ConditionLogic =
    rule?.when?.all
      ? 'all'
      : 'any';

  const [conditionLogic, setConditionLogic] =
    useState<ConditionLogic>(
      initialLogic,
    );

  const [conditions, setConditions] =
    useState<Condition[]>(
      rule
        ? getAllConditions(rule)
        : [createCondition()],
    );

  const [actions, setActions] =
    useState<RuleAction[]>(
      rule?.then?.length
        ? rule.then
        : [createAction()],
    );

  const [cooldown, setCooldown] =
    useState(
      rule?.cooldown_seconds || 0,
    );

  const [maxPerHour, setMaxPerHour] =
    useState<number | undefined>(
      rule?.max_firings_per_hour,
    );

  const [maxPerDay, setMaxPerDay] =
    useState<number | undefined>(
      rule?.max_firings_per_day,
    );

  const [tags, setTags] =
    useState(
      rule?.tags?.join(', ') || '',
    );

  const [validationErrors, setValidationErrors] =
    useState<string[]>([]);

  const [testing, setTesting] =
    useState(false);

  const [testResult, setTestResult] =
    useState<TestResult | null>(null);

  const [advancedOpen, setAdvancedOpen] =
    useState(false);


  // ═══════════════════════════════════════════════════════════════════════
  // VALIDATION
  // ═══════════════════════════════════════════════════════════════════════

  const validate = (): string[] => {
    const errors: string[] = [];

    if (!name.trim()) {
      errors.push(
        'Rule name is required.',
      );
    }

    const validConditions =
      conditions.filter(
        c => c.field.trim(),
      );

    if (validConditions.length === 0) {
      errors.push(
        'At least one condition is required.',
      );
    }

    const validActions =
      actions.filter(
        a => a.action.trim(),
      );

    if (validActions.length === 0) {
      errors.push(
        'At least one action is required.',
      );
    }

    if (cooldown < 0) {
      errors.push(
        'Cooldown cannot be negative.',
      );
    }

    if (
      maxPerHour !== undefined &&
      maxPerHour < 1
    ) {
      errors.push(
        'Max firings per hour must be at least 1.',
      );
    }

    if (
      maxPerDay !== undefined &&
      maxPerDay < 1
    ) {
      errors.push(
        'Max firings per day must be at least 1.',
      );
    }

    return errors;
  };


  // ═══════════════════════════════════════════════════════════════════════
  // BUILD RULE
  // ═══════════════════════════════════════════════════════════════════════

  const buildRule = (): Rule => {
    const cleanConditions =
      conditions.filter(
        c => c.field.trim(),
      );

    const cleanActions =
      actions.filter(
        a => a.action.trim(),
      );

    return {
      id:
        rule?.id ||
        `rule_${Date.now()}_${Math.random()
          .toString(36)
          .slice(2, 7)}`,

      name:
        name.trim() ||
        'Untitled Rule',

      description:
        description.trim(),

      priority,

      status:
        rule?.status ||
        'active',

      when:
        conditionLogic === 'all'
          ? {
              all: cleanConditions,
            }
          : {
              any: cleanConditions,
            },

      then: cleanActions,

      cooldown_seconds:
        Number(cooldown) || 0,

      max_firings_per_hour:
        maxPerHour || undefined,

      max_firings_per_day:
        maxPerDay || undefined,

      tags: tags
        .split(',')
        .map(tag => tag.trim())
        .filter(Boolean),

      created_at:
        rule?.created_at,

      updated_at:
        new Date().toISOString(),

      firing_count:
        rule?.firing_count,

      success_count:
        rule?.success_count,

      failure_count:
        rule?.failure_count,

      last_fired_at:
        rule?.last_fired_at,
    };
  };


  // ═══════════════════════════════════════════════════════════════════════
  // SAVE
  // ═══════════════════════════════════════════════════════════════════════

  const handleSave = async () => {
    const errors = validate();

    setValidationErrors(errors);

    if (errors.length > 0) {
      toast.error(
        'Fix the validation errors first.',
      );
      return;
    }

    await onSave(buildRule());
  };


  // ═══════════════════════════════════════════════════════════════════════
  // TEST
  // ═══════════════════════════════════════════════════════════════════════

  const handleTest = async () => {
    const errors = validate();

    setValidationErrors(errors);

    if (errors.length > 0) {
      toast.error(
        'Fix validation errors before testing.',
      );
      return;
    }

    setTesting(true);

    try {
      const result =
        await onTest(
          buildRule(),
          DEMO_CONTEXT,
        );

      setTestResult(result);

      if (result.matched) {
        toast.success(
          'Rule matched the test context.',
        );
      } else {
        toast.info(
          'Rule did not match the test context.',
        );
      }
    } finally {
      setTesting(false);
    }
  };


  return (
    <motion.div
      initial={{
        opacity: 0,
      }}
      animate={{
        opacity: 1,
      }}
      exit={{
        opacity: 0,
      }}
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 md:p-5"
      onClick={onClose}
    >

      <motion.div
        initial={{
          scale: 0.96,
          opacity: 0,
        }}
        animate={{
          scale: 1,
          opacity: 1,
        }}
        exit={{
          scale: 0.96,
          opacity: 0,
        }}
        onClick={e =>
          e.stopPropagation()
        }
        className="w-full max-w-3xl max-h-[94vh] overflow-y-auto bg-[#090912] border border-zinc-700/60 rounded-2xl shadow-2xl"
      >

        {/* Modal header */}

        <div className="sticky top-0 z-10 bg-[#090912]/95 backdrop-blur border-b border-zinc-800/60 px-4 md:px-6 py-3">

          <div className="flex items-center justify-between">

            <div>

              <div className="flex items-center gap-2">

                <GitBranch className="w-4 h-4 text-indigo-400" />

                <h2 className="text-sm font-bold text-white font-mono">
                  {rule
                    ? 'EDIT RULE'
                    : 'NEW AUTONOMOUS RULE'}
                </h2>

              </div>

              <p className="text-[8px] text-zinc-700 font-mono mt-1">
                Define conditions → actions → runtime policy
              </p>

            </div>


            <button
              onClick={onClose}
              className="text-zinc-600 hover:text-zinc-300"
            >
              <X className="w-4 h-4" />
            </button>

          </div>

        </div>


        <div className="p-4 md:p-6 space-y-5">

          {/* Validation */}

          {validationErrors.length > 0 && (
            <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-3">

              <div className="flex items-center gap-2 text-red-400 mb-2">

                <AlertTriangle className="w-3.5 h-3.5" />

                <span className="text-[9px] font-mono font-bold uppercase">
                  Validation errors
                </span>

              </div>

              <ul className="space-y-1">

                {validationErrors.map(
                  (error, index) => (
                    <li
                      key={index}
                      className="text-[9px] font-mono text-red-300"
                    >
                      • {error}
                    </li>
                  ),
                )}

              </ul>

            </div>
          )}


          {/* Identity */}

          <div className="space-y-2">

            <SectionLabel>
              Rule Identity
            </SectionLabel>

            <input
              value={name}
              onChange={e =>
                setName(e.target.value)
              }
              placeholder="Rule name..."
              className="w-full bg-zinc-900/50 border border-zinc-800/60 rounded-lg px-3 py-2.5 text-sm text-white font-mono placeholder-zinc-700 focus:outline-none focus:border-indigo-500/50"
            />

            <input
              value={description}
              onChange={e =>
                setDescription(
                  e.target.value,
                )
              }
              placeholder="Describe what this rule should accomplish..."
              className="w-full bg-zinc-900/50 border border-zinc-800/60 rounded-lg px-3 py-2 text-[10px] text-zinc-400 font-mono placeholder-zinc-700 focus:outline-none focus:border-indigo-500/50"
            />

            <input
              value={tags}
              onChange={e =>
                setTags(e.target.value)
              }
              placeholder="Tags: engagement, recovery, ministry..."
              className="w-full bg-zinc-900/50 border border-zinc-800/60 rounded-lg px-3 py-2 text-[9px] text-zinc-500 font-mono placeholder-zinc-700 focus:outline-none focus:border-indigo-500/50"
            />

          </div>


          {/* Priority */}

          <div>

            <SectionLabel>
              Priority
            </SectionLabel>

            <div className="flex gap-1.5 flex-wrap">

              {(
                [
                  'critical',
                  'high',
                  'medium',
                  'low',
                ] as RulePriority[]
              ).map(p => (
                <button
                  key={p}
                  onClick={() =>
                    setPriority(p)
                  }
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-[8px] font-mono font-bold uppercase border transition-all',
                    priority === p
                      ? PRIORITY_COLORS[p]
                      : 'text-zinc-600 border-zinc-800 hover:text-zinc-400',
                  )}
                >
                  {p}
                </button>
              ))}

            </div>

          </div>


          {/* CONDITIONS */}

          <div>

            <div className="flex items-center justify-between mb-2">

              <SectionLabel>
                Conditions
              </SectionLabel>

              <div className="flex items-center gap-1 bg-zinc-900/60 rounded-lg p-0.5">

                <button
                  onClick={() =>
                    setConditionLogic(
                      'all',
                    )
                  }
                  className={cn(
                    'px-2 py-1 rounded text-[7px] font-mono uppercase',
                    conditionLogic ===
                      'all'
                      ? 'bg-indigo-500/20 text-indigo-400'
                      : 'text-zinc-600',
                  )}
                >
                  ALL / AND
                </button>

                <button
                  onClick={() =>
                    setConditionLogic(
                      'any',
                    )
                  }
                  className={cn(
                    'px-2 py-1 rounded text-[7px] font-mono uppercase',
                    conditionLogic ===
                      'any'
                      ? 'bg-amber-500/20 text-amber-400'
                      : 'text-zinc-600',
                  )}
                >
                  ANY / OR
                </button>

              </div>

            </div>


            <div className="space-y-2">

              {conditions.map(
                (condition, index) => (
                  <ConditionEditor
                    key={
                      condition.id ||
                      index
                    }
                    condition={
                      condition
                    }
                    onChange={next => {
                      setConditions(
                        prev =>
                          prev.map(
                            (item, i) =>
                              i === index
                                ? next
                                : item,
                          ),
                      );
                    }}
                    onDelete={() =>
                      setConditions(
                        prev =>
                          prev.filter(
                            (_, i) =>
                              i !== index,
                          ),
                      )
                    }
                    canDelete={
                      conditions.length >
                      1
                    }
                  />
                ),
              )}

            </div>


            <button
              onClick={() =>
                setConditions(
                  prev => [
                    ...prev,
                    createCondition(),
                  ],
                )
              }
              className="mt-2 text-[8px] font-mono text-indigo-400 hover:text-indigo-300"
            >
              + Add condition
            </button>

          </div>


          {/* ACTIONS */}

          <div>

            <SectionLabel>
              Actions
            </SectionLabel>

            <div className="space-y-2">

              {actions.map(
                (action, index) => (
                  <ActionEditor
                    key={
                      action.id ||
                      index
                    }
                    action={action}
                    onChange={next =>
                      setActions(
                        prev =>
                          prev.map(
                            (item, i) =>
                              i === index
                                ? next
                                : item,
                          ),
                      )
                    }
                    onDelete={() =>
                      setActions(
                        prev =>
                          prev.filter(
                            (_, i) =>
                              i !== index,
                          ),
                      )
                    }
                    canDelete={
                      actions.length > 1
                    }
                  />
                ),
              )}

            </div>


            <button
              onClick={() =>
                setActions(
                  prev => [
                    ...prev,
                    createAction(),
                  ],
                )
              }
              className="mt-2 text-[8px] font-mono text-indigo-400 hover:text-indigo-300"
            >
              + Add action
            </button>

          </div>


          {/* ADVANCED */}

          <div className="border border-zinc-800/60 rounded-xl overflow-hidden">

            <button
              onClick={() =>
                setAdvancedOpen(
                  v => !v,
                )
              }
              className="w-full flex items-center justify-between px-3 py-2.5"
            >

              <div className="flex items-center gap-2">

                <Settings2 className="w-3.5 h-3.5 text-zinc-600" />

                <span className="text-[9px] font-mono font-bold uppercase text-zinc-500">
                  Runtime Policy
                </span>

              </div>

              {advancedOpen ? (
                <ChevronUp className="w-3.5 h-3.5 text-zinc-700" />
              ) : (
                <ChevronDown className="w-3.5 h-3.5 text-zinc-700" />
              )}

            </button>


            <AnimatePresence>
              {advancedOpen && (
                <motion.div
                  initial={{
                    height: 0,
                    opacity: 0,
                  }}
                  animate={{
                    height: 'auto',
                    opacity: 1,
                  }}
                  exit={{
                    height: 0,
                    opacity: 0,
                  }}
                  className="border-t border-zinc-800/50 p-3"
                >

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-2">

                    <NumberField
                      label="Cooldown seconds"
                      value={cooldown}
                      onChange={value => setCooldown(Number(value))}
                    />

                    <NumberField
                      label="Maximum firings / hour"
                      value={
                        maxPerHour ??
                        ''
                      }
                      onChange={value =>
                        setMaxPerHour(
                          value === ''
                            ? undefined
                            : Number(
                                value,
                              ),
                        )
                      }
                    />

                    <NumberField
                      label="Maximum firings / day"
                      value={
                        maxPerDay ??
                        ''
                      }
                      onChange={value =>
                        setMaxPerDay(
                          value === ''
                            ? undefined
                            : Number(
                                value,
                              ),
                        )
                      }
                    />

                  </div>

                </motion.div>
              )}
            </AnimatePresence>

          </div>


          {/* TEST RESULT */}

          {testResult && (
            <div
              className={cn(
                'rounded-xl border p-3',
                testResult.matched
                  ? 'border-emerald-500/20 bg-emerald-500/5'
                  : 'border-amber-500/20 bg-amber-500/5',
              )}
            >

              <div className="flex items-center gap-2">

                {testResult.matched ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                )}

                <span className="text-[9px] font-mono font-bold uppercase text-zinc-300">
                  {testResult.matched
                    ? 'Rule would fire'
                    : 'Rule would not fire'}
                </span>

                {testResult.execution_ms !==
                  undefined && (
                  <span className="ml-auto text-[8px] font-mono text-zinc-600">
                    {testResult.execution_ms}ms
                  </span>
                )}

              </div>

              {testResult.explanation && (
                <p className="mt-2 text-[8px] font-mono text-zinc-500">
                  {testResult.explanation}
                </p>
              )}

            </div>
          )}


          {/* ACTIONS */}

          <div className="flex gap-2 pt-2">

            <button
              onClick={onClose}
              className="flex-1 py-2.5 rounded-lg text-[9px] font-mono font-bold uppercase border border-zinc-800 text-zinc-500 hover:text-zinc-300"
            >
              Cancel
            </button>


            <button
              onClick={handleTest}
              disabled={testing}
              className="flex-1 py-2.5 rounded-lg text-[9px] font-mono font-bold uppercase border border-cyan-500/20 text-cyan-400 bg-cyan-500/5 hover:bg-cyan-500/10 disabled:opacity-50"
            >

              {testing ? (
                <Loader2 className="w-3.5 h-3.5 inline animate-spin mr-1" />
              ) : (
                <TestTube2 className="w-3.5 h-3.5 inline mr-1" />
              )}

              Dry Run

            </button>


            <button
              onClick={handleSave}
              className="flex-1 py-2.5 rounded-lg text-[9px] font-mono font-bold uppercase bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/30"
            >
              <Save className="w-3.5 h-3.5 inline mr-1" />

              {rule
                ? 'Update Rule'
                : 'Create Rule'}

            </button>

          </div>

        </div>

      </motion.div>

    </motion.div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// CONDITION EDITOR
// ═══════════════════════════════════════════════════════════════════════════

function ConditionEditor({
  condition,
  onChange,
  onDelete,
  canDelete,
}: {
  condition: Condition;
  onChange: (
    condition: Condition,
  ) => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  const operator =
    condition.op;

  const requiresNoValue =
    operator === 'exists' ||
    operator === 'not_exists';

  return (
    <div className="grid grid-cols-1 md:grid-cols-[1fr_130px_1fr_auto] gap-1.5 p-2 rounded-xl border border-zinc-800/50 bg-zinc-900/20">

      <select
        value={condition.field}
        onChange={e =>
          onChange({
            ...condition,
            field: e.target.value,
          })
        }
        className="bg-zinc-900/60 border border-zinc-800/60 rounded-lg px-2 py-2 text-[9px] font-mono text-zinc-300 focus:outline-none focus:border-indigo-500/50"
      >

        <option value="">
          Select field...
        </option>

        {AVAILABLE_FIELDS.map(
          field => (
            <option
              key={field}
              value={field}
            >
              {field}
            </option>
          ),
        )}

      </select>


      <select
        value={condition.op}
        onChange={e =>
          onChange({
            ...condition,
            op: e.target
              .value as Operator,
          })
        }
        className="bg-zinc-900/60 border border-zinc-800/60 rounded-lg px-2 py-2 text-[9px] font-mono text-indigo-400 focus:outline-none focus:border-indigo-500/50"
      >

        {Object.entries(
          OPERATOR_LABELS,
        ).map(
          ([op, label]) => (
            <option
              key={op}
              value={op}
            >
              {label}
            </option>
          ),
        )}

      </select>


      <input
        disabled={
          requiresNoValue
        }
        value={
          typeof condition.value ===
          'string'
            ? condition.value
            : safeStringify(
                condition.value,
              )
        }
        onChange={e =>
          onChange({
            ...condition,

            value:
              requiresNoValue
                ? true
                : parseInputValue(
                    e.target.value,
                    condition.op,
                  ),
          })
        }
        placeholder={
          requiresNoValue
            ? 'No value required'
            : operator ===
                'between'
            ? '[min, max]'
            : operator ===
                  'in' ||
                operator ===
                  'not_in'
            ? '["a","b"]'
            : 'Value...'
        }
        className="bg-zinc-900/60 border border-zinc-800/60 rounded-lg px-2 py-2 text-[9px] font-mono text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-indigo-500/50 disabled:opacity-30"
      />


      <button
        onClick={onDelete}
        disabled={!canDelete}
        className="p-2 rounded-lg text-zinc-700 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-20"
      >
        <Trash2 className="w-3.5 h-3.5" />
      </button>

    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// ACTION EDITOR
// ═══════════════════════════════════════════════════════════════════════════

function ActionEditor({
  action,
  onChange,
  onDelete,
  canDelete,
}: {
  action: RuleAction;
  onChange: (
    action: RuleAction,
  ) => void;
  onDelete: () => void;
  canDelete: boolean;
}) {
  return (
    <div className="p-2 rounded-xl border border-zinc-800/50 bg-zinc-900/20">

      <div className="grid grid-cols-1 md:grid-cols-[1fr_1fr_auto] gap-1.5">

        <select
          value={action.action}
          onChange={e =>
            onChange({
              ...action,
              action: e.target.value,
            })
          }
          className="bg-zinc-900/60 border border-zinc-800/60 rounded-lg px-2 py-2 text-[9px] font-mono text-zinc-300 focus:outline-none focus:border-indigo-500/50"
        >

          <option value="">
            Select action...
          </option>

          {AVAILABLE_ACTIONS.map(
            item => (
              <option
                key={item}
                value={item}
              >
                {item}
              </option>
            ),
          )}

        </select>


        <input
          value={
            typeof action.value ===
            'string'
              ? action.value
              : safeStringify(
                  action.value,
                )
          }
          onChange={e =>
            onChange({
              ...action,
              value: e.target.value,
            })
          }
          placeholder="Action value..."
          className="bg-zinc-900/60 border border-zinc-800/60 rounded-lg px-2 py-2 text-[9px] font-mono text-zinc-300 placeholder-zinc-700 focus:outline-none focus:border-indigo-500/50"
        />


        <button
          onClick={onDelete}
          disabled={!canDelete}
          className="p-2 rounded-lg text-zinc-700 hover:text-red-400 hover:bg-red-500/10 disabled:opacity-20"
        >
          <Trash2 className="w-3.5 h-3.5" />
        </button>

      </div>


      {/* Optional params */}

      <div className="mt-1.5">

        <input
          value={JSON.stringify(
            action.params || {},
          )}
          onChange={e => {
            try {
              onChange({
                ...action,
                params:
                  JSON.parse(
                    e.target.value ||
                      '{}',
                  ),
              });
            } catch {
              // Keep current params while
              // user is typing invalid JSON.
            }
          }}
          placeholder='Optional params JSON: {"reason":"high_engagement"}'
          className="w-full bg-zinc-950/60 border border-zinc-800/40 rounded-lg px-2 py-1.5 text-[8px] font-mono text-zinc-600 placeholder-zinc-800 focus:outline-none focus:border-zinc-700"
        />

      </div>

    </div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// RULE SIMULATOR
// ═══════════════════════════════════════════════════════════════════════════

function RuleSimulatorModal({
  rule,
  rules,
  onSimulate,
  onTest,
  onClose,
}: {
  rule: Rule | null;
  rules: Rule[];
  onSimulate: (
    event: string,
    context: Record<string, any>,
  ) => Promise<any>;
  onTest: (
    rule: Rule,
    context: Record<string, any>,
  ) => Promise<TestResult>;
  onClose: () => void;
}) {
  const [event, setEvent] =
    useState(
      'engagement_analyzed',
    );

  const [contextText, setContextText] =
    useState(
      JSON.stringify(
        {
          ...DEMO_CONTEXT,
          ...(rule
            ? {}
            : {}),
        },
        null,
        2,
      ),
    );

  const [result, setResult] =
    useState<TestResult | null>(
      null,
    );

  const [running, setRunning] =
    useState(false);

  const [selectedRuleId, setSelectedRuleId] =
    useState(
      rule?.id ||
        rules[0]?.id ||
        '',
    );

  const selectedRule =
    rules.find(
      r =>
        r.id === selectedRuleId,
    ) || rule;


  const parseContext = () => {
    try {
      return JSON.parse(
        contextText,
      );
    } catch {
      toast.error(
        'Context must contain valid JSON.',
      );

      return null;
    }
  };


  const runTest = async () => {
    const context =
      parseContext();

    if (!context) return;

    if (!selectedRule) {
      toast.error(
        'Select a rule to test.',
      );

      return;
    }

    setRunning(true);

    try {
      const test =
        await onTest(
          selectedRule,
          {
            ...context,
            event,
          },
        );

      setResult(test);
    } finally {
      setRunning(false);
    }
  };


  const runSimulation = async () => {
    const context =
      parseContext();

    if (!context) return;

    setRunning(true);

    try {
      const simulation =
        await onSimulate(
          event,
          context,
        );

      setResult(
        simulation,
      );
    } finally {
      setRunning(false);
    }
  };


  return (
    <motion.div
      initial={{
        opacity: 0,
      }}
      animate={{
        opacity: 1,
      }}
      exit={{
        opacity: 0,
      }}
      className="fixed inset-0 z-[60] bg-black/80 backdrop-blur-sm flex items-center justify-center p-3"
      onClick={onClose}
    >

      <motion.div
        initial={{
          scale: 0.96,
          opacity: 0,
        }}
        animate={{
          scale: 1,
          opacity: 1,
        }}
        onClick={e =>
          e.stopPropagation()
        }
        className="w-full max-w-3xl max-h-[94vh] overflow-y-auto bg-[#090912] border border-zinc-700/60 rounded-2xl"
      >

        <div className="sticky top-0 z-10 bg-[#090912]/95 backdrop-blur border-b border-zinc-800/60 px-4 py-3">

          <div className="flex items-center justify-between">

            <div>

              <div className="flex items-center gap-2">

                <FlaskConical className="w-4 h-4 text-cyan-400" />

                <h2 className="text-sm font-bold font-mono text-white">
                  RULE SIMULATOR
                </h2>

              </div>

              <p className="text-[8px] font-mono text-zinc-700 mt-1">
                Dry-run events without executing real actions
              </p>

            </div>

            <button
              onClick={onClose}
              className="text-zinc-600 hover:text-zinc-300"
            >
              <X className="w-4 h-4" />
            </button>

          </div>

        </div>


        <div className="p-4 space-y-4">

          {/* Event */}

          <div>

            <SectionLabel>
              Event
            </SectionLabel>

            <select
              value={event}
              onChange={e =>
                setEvent(
                  e.target.value,
                )
              }
              className="w-full bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2 text-[9px] font-mono text-zinc-300 focus:outline-none"
            >

              {EVENT_TYPES.map(
                type => (
                  <option
                    key={type}
                    value={type}
                  >
                    {type}
                  </option>
                ),
              )}

            </select>

          </div>


          {/* Rule */}

          <div>

            <SectionLabel>
              Rule
            </SectionLabel>

            <select
              value={
                selectedRuleId
              }
              onChange={e =>
                setSelectedRuleId(
                  e.target.value,
                )
              }
              className="w-full bg-zinc-900/60 border border-zinc-800 rounded-lg px-3 py-2 text-[9px] font-mono text-zinc-300 focus:outline-none"
            >

              {rules.map(ruleItem => (
                <option
                  key={ruleItem.id}
                  value={
                    ruleItem.id
                  }
                >
                  {ruleItem.name}
                </option>
              ))}

            </select>

          </div>


          {/* Context */}

          <div>

            <div className="flex items-center justify-between mb-1">

              <SectionLabel>
                Event Context JSON
              </SectionLabel>

              <button
                onClick={() =>
                  setContextText(
                    JSON.stringify(
                      DEMO_CONTEXT,
                      null,
                      2,
                    ),
                  )
                }
                className="text-[8px] font-mono text-indigo-400"
              >
                Reset demo
              </button>

            </div>

            <textarea
              value={contextText}
              onChange={e =>
                setContextText(
                  e.target.value,
                )
              }
              rows={15}
              spellCheck={false}
              className="w-full bg-black/40 border border-zinc-800 rounded-xl px-3 py-3 text-[9px] font-mono text-zinc-400 focus:outline-none focus:border-cyan-500/30 resize-y"
            />

          </div>


          {/* Result */}

          {result && (
            <div
              className={cn(
                'rounded-xl border p-3',
                result.matched
                  ? 'border-emerald-500/20 bg-emerald-500/5'
                  : 'border-amber-500/20 bg-amber-500/5',
              )}
            >

              <div className="flex items-center gap-2">

                {result.matched ? (
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                ) : (
                  <AlertTriangle className="w-4 h-4 text-amber-400" />
                )}

                <span className="text-[9px] font-mono font-bold text-zinc-300">
                  {result.matched
                    ? 'MATCH'
                    : 'NO MATCH'}
                </span>

              </div>


              {result.explanation && (
                <p className="text-[9px] font-mono text-zinc-500 mt-2">
                  {result.explanation}
                </p>
              )}


              {result.conditions &&
                result.conditions.length >
                  0 && (
                  <div className="mt-3 space-y-1">

                    {result.conditions.map(
                      (
                        condition,
                        index,
                      ) => (
                        <div
                          key={
                            index
                          }
                          className="flex items-center gap-2 text-[8px] font-mono"
                        >

                          {condition.matched ? (
                            <Check className="w-3 h-3 text-emerald-400" />
                          ) : (
                            <X className="w-3 h-3 text-red-400" />
                          )}

                          <span className="text-zinc-500">
                            {condition.field}
                          </span>

                          <span className="text-indigo-400">
                            {
                              condition.operator
                            }
                          </span>

                          <span className="text-zinc-700">
                            actual:
                          </span>

                          <span className="text-zinc-400">
                            {safeStringify(
                              condition.actual,
                            )}
                          </span>

                        </div>
                      ),
                    )}

                  </div>
                )}

            </div>
          )}


          {/* Buttons */}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">

            <button
              onClick={runTest}
              disabled={running}
              className="py-2.5 rounded-lg border border-cyan-500/20 bg-cyan-500/5 text-cyan-400 text-[9px] font-mono font-bold uppercase disabled:opacity-50"
            >

              {running ? (
                <Loader2 className="w-3.5 h-3.5 inline animate-spin mr-1" />
              ) : (
                <TestTube2 className="w-3.5 h-3.5 inline mr-1" />
              )}

              Test Selected Rule

            </button>


            <button
              onClick={runSimulation}
              disabled={running}
              className="py-2.5 rounded-lg border border-indigo-500/20 bg-indigo-500/10 text-indigo-400 text-[9px] font-mono font-bold uppercase disabled:opacity-50"
            >

              {running ? (
                <Loader2 className="w-3.5 h-3.5 inline animate-spin mr-1" />
              ) : (
                <Zap className="w-3.5 h-3.5 inline mr-1" />
              )}

              Simulate Event

            </button>

          </div>

        </div>

      </motion.div>

    </motion.div>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// FORM HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function SectionLabel({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <span className="text-[8px] font-mono font-bold uppercase tracking-wider text-zinc-500 block mb-1.5">
      {children}
    </span>
  );
}


function NumberField({
  label,
  value,
  onChange,
}: {
  label: string;
  value: number | string;
  onChange: (
    value: number | string,
  ) => void;
}) {
  return (
    <label>

      <span className="text-[7px] font-mono text-zinc-600 uppercase block mb-1">
        {label}
      </span>

      <input
        type="number"
        min={0}
        value={value}
        onChange={e =>
          onChange(
            e.target.value === ''
              ? ''
              : Number(
                  e.target.value,
                ),
          )
        }
        className="w-full bg-zinc-900/60 border border-zinc-800 rounded-lg px-2 py-2 text-[9px] font-mono text-zinc-300 focus:outline-none focus:border-indigo-500/50"
      />

    </label>
  );
}


// ═══════════════════════════════════════════════════════════════════════════
// LOCAL CONDITION ENGINE
// Used only when backend test endpoint is unavailable.
// ═══════════════════════════════════════════════════════════════════════════

function evaluateRuleLocally(
  rule: Rule,
  context: Record<string, any>,
): TestResult {
  const conditions =
    getAllConditions(rule);

  const details =
    conditions.map(
      condition => {
        const actual =
          context[
            condition.field
          ];

        const matched =
          evaluateCondition(
            actual,
            condition.op,
            condition.value,
          );

        return {
          field:
            condition.field,

          operator:
            OPERATOR_LABELS[
              condition.op
            ] || condition.op,

          expected:
            condition.value,

          actual,

          matched,
        };
      },
    );

  const allMode =
    Boolean(rule.when?.all);

  const relevant =
    allMode
      ? details
      : details;

  const matched =
    allMode
      ? relevant.every(
          item =>
            item.matched,
        )
      : relevant.some(
          item =>
            item.matched,
        );

  return {
    matched,

    rule_id: rule.id,

    rule_name: rule.name,

    conditions: details,

    actions: matched
      ? rule.then
      : [],

    explanation: matched
      ? 'All required conditions matched.'
      : 'One or more required conditions did not match.',
  };
}


function evaluateCondition(
  actual: any,
  operator: Operator,
  expected: any,
): boolean {
  switch (operator) {
    case 'eq':
      return actual === expected;

    case 'neq':
      return actual !== expected;

    case 'gt':
      return (
        Number(actual) >
        Number(expected)
      );

    case 'gte':
      return (
        Number(actual) >=
        Number(expected)
      );

    case 'lt':
      return (
        Number(actual) <
        Number(expected)
      );

    case 'lte':
      return (
        Number(actual) <=
        Number(expected)
      );

    case 'in':
      return Array.isArray(
        expected,
      )
        ? expected.includes(
            actual,
          )
        : false;

    case 'not_in':
      return Array.isArray(
        expected,
      )
        ? !expected.includes(
            actual,
          )
        : true;

    case 'contains':
      if (
        Array.isArray(actual)
      ) {
        return actual.includes(
          expected,
        );
      }

      return String(actual ?? '')
        .toLowerCase()
        .includes(
          String(
            expected ?? '',
          ).toLowerCase(),
        );

    case 'not_contains':
      if (
        Array.isArray(actual)
      ) {
        return !actual.includes(
          expected,
        );
      }

      return !String(
        actual ?? '',
      )
        .toLowerCase()
        .includes(
          String(
            expected ?? '',
          ).toLowerCase(),
        );

    case 'starts_with':
      return String(
        actual ?? '',
      )
        .toLowerCase()
        .startsWith(
          String(
            expected ?? '',
          ).toLowerCase(),
        );

    case 'ends_with':
      return String(
        actual ?? '',
      )
        .toLowerCase()
        .endsWith(
          String(
            expected ?? '',
          ).toLowerCase(),
        );

    case 'between': {
      const range =
        Array.isArray(expected)
          ? expected
          : [];

      if (range.length < 2) {
        return false;
      }

      const value =
        Number(actual);

      return (
        value >=
          Number(range[0]) &&
        value <=
          Number(range[1])
      );
    }

    case 'exists':
      return (
        actual !== undefined &&
        actual !== null
      );

    case 'not_exists':
      return (
        actual === undefined ||
        actual === null
      );

    case 'regex':
      try {
        return new RegExp(
          String(expected),
          'i',
        ).test(
          String(actual ?? ''),
        );
      } catch {
        return false;
      }

    default:
      return false;
  }
}


// ═══════════════════════════════════════════════════════════════════════════
// DEMO RULES
// ═══════════════════════════════════════════════════════════════════════════

function getDemoRules(): Rule[] {
  return [
    {
      id: 'sunday_sermon_mode',

      name: 'Sunday Sermon Mode',

      description:
        'Ministry brands get scripture quote cards on Sunday mornings.',

      priority: 'medium',

      status: 'active',

      when: {
        all: [
          {
            field:
              'brand_archetype',

            op: 'eq',

            value: 'ministry',
          },

          {
            field:
              'current_day',

            op: 'eq',

            value: 'Sunday',
          },

          {
            field:
              'current_hour',

            op: 'between',

            value: [6, 12],
          },
        ],
      },

      then: [
        {
          action:
            'set_content_type',

          value:
            'scripture',
        },

        {
          action:
            'set_layout',

          value:
            'quote',
        },

        {
          action:
            'set_caption_prefix',

          value:
            'Sunday Blessings 🙏\n\n',
        },
      ],

      cooldown_seconds:
        3600,

      max_firings_per_hour:
        1,

      tags: [
        'ministry',
        'schedule',
        'content',
      ],

      firing_count: 18,

      success_count: 18,

      failure_count: 0,
    },


    {
      id: 'engagement_boost',

      name: 'Engagement Intelligence',

      description:
        'Detects unusually strong engagement and generates a follow-up content signal.',

      priority: 'high',

      status: 'active',

      when: {
        all: [
          {
            field:
              'engagement_ratio',

            op: 'gte',

            value: 2,
          },
        ],
      },

      then: [
        {
          action:
            'regenerate_content',

          value:
            'similar',

          params: {
            preserve_topic: true,
            variation: 'high',
          },
        },

        {
          action:
            'record_learning_signal',

          value:
            'high_engagement',
        },

        {
          action:
            'notify_admin',

          value:
            'High engagement detected.',
        },
      ],

      cooldown_seconds:
        7200,

      max_firings_per_hour:
        3,

      max_firings_per_day:
        10,

      tags: [
        'engagement',
        'learning',
        'growth',
      ],

      firing_count: 41,

      success_count: 40,

      failure_count: 1,
    },


    {
      id: 'render_failure_cascade',

      name: 'Render Failure Cascade',

      description:
        'Multiple rendering failures trigger automatic recovery behavior.',

      priority: 'critical',

      status: 'active',

      when: {
        all: [
          {
            field:
              'error_count_10min',

            op: 'gte',

            value: 3,
          },
        ],
      },

      then: [
        {
          action:
            'notify_admin',

          value:
            'Render failure cascade detected.',
        },

        {
          action:
            'switch_image_provider',

          value:
            'hcti_only',
        },

        {
          action:
            'record_learning_signal',

          value:
            'render_failure',
        },
      ],

      cooldown_seconds:
        600,

      max_firings_per_hour:
        5,

      tags: [
        'recovery',
        'reliability',
        'critical',
      ],

      firing_count: 4,

      success_count: 4,

      failure_count: 0,
    },


    {
      id: 'controversy_avoidance',

      name: 'Controversy Avoidance',

      description:
        'Blocks flagged negative topics and routes content toward safer themes.',

      priority: 'high',

      status: 'paused',

      when: {
        all: [
          {
            field:
              'sentiment',

            op: 'eq',

            value:
              'negative',
          },

          {
            field:
              'topic_flagged',

            op: 'eq',

            value: true,
          },
        ],
      },

      then: [
        {
          action:
            'force_topic',

          value:
            'safe',
        },

        {
          action:
            'mark_for_review',
        },

        {
          action:
            'notify_admin',

          value:
            'Potentially controversial content blocked.',
        },
      ],

      cooldown_seconds:
        604800,

      max_firings_per_day:
        1,

      tags: [
        'safety',
        'moderation',
      ],

      firing_count: 7,

      success_count: 7,

      failure_count: 0,
    },


    {
      id: 'dead_brand_revival',

      name: 'Dead Brand Revival',

      description:
        'Detects brands that have stopped posting and requests a controlled recovery cycle.',

      priority: 'high',

      status: 'active',

      when: {
        all: [
          {
            field:
              'days_since_last_post',

            op: 'gte',

            value: 3,
          },

          {
            field:
              'brand_configured',

            op: 'eq',

            value: true,
          },
        ],
      },

      then: [
        {
          action:
            'increase_post_frequency',

          value:
            'temporary',
        },

        {
          action:
            'notify_admin',

          value:
            'Brand inactivity detected.',
        },

        {
          action:
            'record_learning_signal',

          value:
            'brand_inactivity',
        },
      ],

      cooldown_seconds:
        86400,

      max_firings_per_day:
        1,

      tags: [
        'revival',
        'automation',
      ],

      firing_count: 12,

      success_count: 12,

      failure_count: 0,
    },
  ];
}
