// EmailService.tsx
// ═══════════════════════════════════════════════════════════════════════════
// KANYOZA EMAIL SERVICE — Dashboard Control Panel
// Production-connected frontend
//
// Existing backend endpoints:
// GET    /email/stats
// GET    /email/logs
// POST   /email/test
// GET    /email/templates
// POST   /email/templates
// PUT    /email/templates/{template_id}
// DELETE /email/templates/{template_id}
// GET    /email/config
//
// No additional backend endpoints are required.
//
// IMPORTANT:
// If the backend is mounted under /api/v1, set:
//     API_BASE = '/api/v1'
//
// If another frontend API helper/proxy already adds /api/v1,
// leave API_BASE as ''.
// ═══════════════════════════════════════════════════════════════════════════

import React, {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { useStore } from '../store/useStore';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mail,
  Send,
  CheckCircle,
  XCircle,
  Clock,
  RefreshCw,
  Settings,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  Edit3,
  History,
  AlertTriangle,
  Info,
  Zap,
  ExternalLink,
  Copy,
  Check,
  Save,
  X,
  Server,
  ShieldCheck,
  Activity,
  ChevronRight,
  Code2,
  Wifi,
  WifiOff,
} from 'lucide-react';
import { cn, vibrate } from '../lib/utils';
import { toast } from 'sonner';

// ═══════════════════════════════════════════════════════════════════════════
// API CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════════
//
// IMPORTANT:
//
// If your backend routes are:
//
//   /api/v1/email/stats
//   /api/v1/email/logs
//   /api/v1/email/test
//   ...
//
// change this to:
//
//   const API_BASE = '/api/v1';
//
// If the routes really are:
//
//   /email/stats
//   /email/logs
//   ...
//
// leave it as:
//
//   const API_BASE = '';
//
// ═══════════════════════════════════════════════════════════════════════════

// Dynamic resolution — reads from Zustand store / localStorage
function getEmailApiBase(): string {
  try {
    const fromStore = useStore.getState().restEndpoint;
    if (fromStore) return fromStore.replace(/\/+$/, '');
  } catch {}
  return (localStorage.getItem('rest_endpoint') || '').replace(/\/+$/, '');
}

function getEmailToken(): string {
  try {
    const fromStore = useStore.getState().masterToken;
    if (fromStore) return fromStore;
  } catch {}
  return localStorage.getItem('master_token') || '';
}

// ═══════════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════════

interface EmailLog {
  id: string;
  to: string;
  subject: string;
  template: string;
  status: 'sent' | 'failed' | 'queued' | string;
  sent_at: string;
  error?: string | null;
  provider: 'smtp' | 'sendgrid' | string;
}

interface EmailTemplate {
  id: string;
  name: string;
  subject: string;
  description: string;
  html_body?: string;
  variables: string[];
  last_used?: string;
  created_at?: string;
  updated_at?: string;
}

interface EmailStats {
  sent_24h: number;
  failed_24h: number;
  queued: number;
  success_rate: number;
  provider: string;
  daily_limit: number;
  used_today: number;
}

interface TestResult {
  success: boolean;
  message: string;
  provider: string;
  latency_ms: number;
}

interface EmailConfig {
  smtp: {
    configured: boolean;
    host: string;
    port: number;
    username: string;
    from: string;
  };
  sendgrid: {
    configured: boolean;
    active: boolean;
  };
  admin_emails: string[];
  templates_available: boolean;
}

interface TemplateForm {
  name: string;
  subject: string;
  description: string;
  html_body: string;
  variables: string;
}

interface ApiErrorPayload {
  detail?: string;
  message?: string;
  error?: string;
}

interface ApiRequestError extends Error {
  status?: number;
  contentType?: string;
  responseText?: string;
  url?: string;
}

// ═══════════════════════════════════════════════════════════════════════════
// DEFAULTS
// ═══════════════════════════════════════════════════════════════════════════

const EMPTY_STATS: EmailStats = {
  sent_24h: 0,
  failed_24h: 0,
  queued: 0,
  success_rate: 100,
  provider: 'Unknown',
  daily_limit: 0,
  used_today: 0,
};

const EMPTY_CONFIG: EmailConfig = {
  smtp: {
    configured: false,
    host: '',
    port: 0,
    username: '',
    from: '',
  },
  sendgrid: {
    configured: false,
    active: false,
  },
  admin_emails: [],
  templates_available: false,
};

const EMPTY_FORM: TemplateForm = {
  name: '',
  subject: '',
  description: '',
  html_body: '',
  variables: '',
};

// ═══════════════════════════════════════════════════════════════════════════
// API HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function buildApiUrl(path: string): string {
  const base = getEmailApiBase();
  const normalizedPath = path.startsWith('/')
    ? path
    : `/${path}`;

  return `${base}${normalizedPath}`;
}

/**
 * Safely extracts a useful error message from a non-JSON response.
 *
 * This is important because response.json() throws:
 *
 *   JSON.parse: unexpected character at line 1 column 1
 *
 * when the backend/proxy returns HTML or plain text.
 */
function extractTextError(
  text: string,
  status: number,
  contentType: string,
): string {
  const trimmed = text.trim();

  if (!trimmed) {
    return `Request failed with HTTP ${status}`;
  }

  // HTML usually means that the request reached a web server,
  // SPA fallback, reverse proxy, login page, or incorrect route.
  if (
    contentType.includes('text/html') ||
    /^<!doctype html/i.test(trimmed) ||
    /^<html/i.test(trimmed)
  ) {
    return `API returned HTML instead of JSON (HTTP ${status}). Check the API_BASE/path and backend route.`;
  }

  // Avoid displaying an enormous HTML/text response in the UI.
  if (trimmed.length > 500) {
    return `${trimmed.slice(0, 500)}…`;
  }

  return trimmed;
}

/**
 * Production-safe JSON API helper.
 *
 * The previous implementation blindly executed response.json().
 * That caused:
 *
 *   JSON.parse: unexpected character at line 1 column 1
 *
 * whenever the server returned non-JSON.
 */
async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = buildApiUrl(path);

  let response: Response;

  const token = getEmailToken();

  try {
    response = await fetch(url, {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body
          ? {
            'Content-Type': 'application/json',
          }
          : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(options.headers || {}),
      },
      credentials: 'include',
    });
  } catch (error) {
    const networkError = new Error(
      error instanceof Error
        ? error.message
        : 'Network request failed',
    ) as ApiRequestError;

    networkError.url = url;

    throw networkError;
  }

  const contentType =
    response.headers.get('content-type') || '';

  const responseText = await response.text();

  if (!response.ok) {
    let message = '';

    if (
      contentType.includes('application/json') &&
      responseText.trim()
    ) {
      try {
        const payload =
          JSON.parse(responseText) as ApiErrorPayload;

        message =
          payload.detail ||
          payload.message ||
          payload.error ||
          '';
      } catch {
        // Fall back to text below.
      }
    }

    if (!message) {
      message = extractTextError(
        responseText,
        response.status,
        contentType,
      );
    }

    const error = new Error(
      message,
    ) as ApiRequestError;

    error.status = response.status;
    error.contentType = contentType;
    error.responseText = responseText;
    error.url = url;

    throw error;
  }

  // Some DELETE/POST endpoints may legitimately return 204.
  if (
    response.status === 204 ||
    !responseText.trim()
  ) {
    return undefined as T;
  }

  if (!contentType.includes('application/json')) {
    const error = new Error(
      extractTextError(
        responseText,
        response.status,
        contentType,
      ),
    ) as ApiRequestError;

    error.status = response.status;
    error.contentType = contentType;
    error.responseText = responseText;
    error.url = url;

    throw error;
  }

  try {
    return JSON.parse(responseText) as T;
  } catch {
    const error = new Error(
      `API returned invalid JSON from ${url}.`,
    ) as ApiRequestError;

    error.status = response.status;
    error.contentType = contentType;
    error.responseText = responseText;
    error.url = url;

    throw error;
  }
}

// ═══════════════════════════════════════════════════════════════════════════
// API FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

async function fetchStats(): Promise<EmailStats> {
  const response = await apiRequest<Partial<EmailStats>>(
    '/email/stats',
  );

  return {
    ...EMPTY_STATS,
    ...(response || {}),
  };
}

async function fetchLogs(
  limit = 100,
): Promise<EmailLog[]> {
  const response = await apiRequest<{
    logs?: EmailLog[];
  }>(`/email/logs?limit=${limit}`);

  return Array.isArray(response?.logs)
    ? response.logs
    : [];
}

async function fetchTemplates(): Promise<EmailTemplate[]> {
  const response = await apiRequest<{
    templates?: EmailTemplate[];
  }>('/email/templates');

  return Array.isArray(response?.templates)
    ? response.templates
    : [];
}

async function fetchConfig(): Promise<EmailConfig> {
  const response =
    await apiRequest<Partial<EmailConfig>>(
      '/email/config',
    );

  return {
    ...EMPTY_CONFIG,
    ...(response || {}),
    smtp: {
      ...EMPTY_CONFIG.smtp,
      ...(response?.smtp || {}),
    },
    sendgrid: {
      ...EMPTY_CONFIG.sendgrid,
      ...(response?.sendgrid || {}),
    },
    admin_emails: Array.isArray(
      response?.admin_emails,
    )
      ? response.admin_emails
      : [],
  };
}

async function sendTestEmail(payload: {
  to: string;
  subject: string;
  template?: string;
  context?: Record<string, unknown>;
}): Promise<TestResult> {
  return apiRequest<TestResult>('/email/test', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function createTemplate(payload: {
  name: string;
  subject: string;
  description: string;
  html_body: string;
  variables: string[];
}): Promise<{
  ok: boolean;
  template: EmailTemplate;
}> {
  return apiRequest('/email/templates', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

async function updateTemplate(
  templateId: string,
  payload: {
    name?: string;
    subject?: string;
    description?: string;
    html_body?: string;
    variables?: string[];
  },
): Promise<{
  ok: boolean;
  template_id: string;
}> {
  return apiRequest(
    `/email/templates/${encodeURIComponent(
      templateId,
    )}`,
    {
      method: 'PUT',
      body: JSON.stringify(payload),
    },
  );
}

async function deleteTemplate(
  templateId: string,
): Promise<{ ok: boolean }> {
  return apiRequest(
    `/email/templates/${encodeURIComponent(
      templateId,
    )}`,
    {
      method: 'DELETE',
    },
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════

function formatDateTime(date?: string): string {
  if (!date) return '—';

  const d = new Date(date);

  if (Number.isNaN(d.getTime())) {
    return '—';
  }

  return d.toLocaleString();
}

function relativeTime(date?: string): string {
  if (!date) return '—';

  const d = new Date(date);
  const timestamp = d.getTime();

  if (Number.isNaN(timestamp)) {
    return '—';
  }

  const seconds =
    Math.max(0, Date.now() - timestamp) / 1000;

  if (seconds < 60) {
    return 'just now';
  }

  if (seconds < 3600) {
    return `${Math.floor(seconds / 60)}m ago`;
  }

  if (seconds < 86400) {
    return `${Math.floor(seconds / 3600)}h ago`;
  }

  return `${Math.floor(seconds / 86400)}d ago`;
}

function providerLabel(provider?: string): string {
  if (!provider) return 'Unknown';

  const normalized = provider.toLowerCase();

  if (normalized === 'sendgrid') {
    return 'SendGrid';
  }

  if (normalized === 'smtp') {
    return 'SMTP';
  }

  return provider;
}

function statusLabel(status?: string): string {
  if (!status) return 'UNKNOWN';

  return status
    .replace(/_/g, ' ')
    .toUpperCase();
}

function parseVariables(value: string): string[] {
  return value
    .split(',')
    .map(item => item.trim())
    .filter(Boolean)
    .filter(
      (item, index, array) =>
        array.indexOf(item) === index,
    );
}

function variablesToString(
  variables?: string[],
): string {
  return variables?.join(', ') || '';
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(
    value.trim(),
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════════════════

export default function EmailService() {
  const [activeTab, setActiveTab] = useState<
    'overview' | 'templates' | 'logs' | 'test'
  >('overview');

  const [stats, setStats] =
    useState<EmailStats>(EMPTY_STATS);

  const [logs, setLogs] = useState<EmailLog[]>([]);

  const [templates, setTemplates] = useState<
    EmailTemplate[]
  >([]);

  const [config, setConfig] =
    useState<EmailConfig>(EMPTY_CONFIG);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] = useState<string | null>(
    null,
  );

  const [testTo, setTestTo] = useState('');
  const [testSubject, setTestSubject] = useState(
    'Kanyoza Email Test',
  );

  const [testTemplate, setTestTemplate] =
    useState('');

  const [testing, setTesting] = useState(false);

  const [testResult, setTestResult] =
    useState<TestResult | null>(null);

  const [showPreview, setShowPreview] =
    useState<string | null>(null);

  const [showTemplateEditor, setShowTemplateEditor] =
    useState(false);

  const [editingTemplateId, setEditingTemplateId] =
    useState<string | null>(null);

  const [templateForm, setTemplateForm] =
    useState<TemplateForm>(EMPTY_FORM);

  const [savingTemplate, setSavingTemplate] =
    useState(false);

  const [deletingTemplateId, setDeletingTemplateId] =
    useState<string | null>(null);

  const [copied, setCopied] =
    useState<string | null>(null);

  // ═══════════════════════════════════════════════════════════════════════
  // DATA LOADING
  // ═══════════════════════════════════════════════════════════════════════

  const loadDashboard = useCallback(
    async (silent = false) => {
      if (!silent) {
        setLoading(true);
      }

      setError(null);

      try {
        const [
          statsData,
          logsData,
          templatesData,
          configData,
        ] = await Promise.all([
          fetchStats(),
          fetchLogs(100),
          fetchTemplates(),
          fetchConfig(),
        ]);

        setStats(statsData);
        setLogs(logsData);
        setTemplates(templatesData);
        setConfig(configData);
      } catch (err) {
        const apiError =
          err as ApiRequestError;

        let message =
          err instanceof Error
            ? err.message
            : 'Failed to load email service data';

        if (
          apiError.status === 404
        ) {
          message =
            `Email API route not found (${apiError.url || 'unknown URL'}). ` +
            'Verify API_BASE and the backend route prefix.';
        }

        if (
          apiError.contentType?.includes(
            'text/html',
          )
        ) {
          message =
            `The email API returned HTML instead of JSON. ` +
            `The frontend requested ${apiError.url || 'the email API'}. ` +
            'Check API_BASE, /api/v1 mounting, and reverse-proxy routing.';
        }

        setError(message);

        if (!silent) {
          toast.error(message);
        }
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [],
  );

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void loadDashboard(true);
    }, 60_000);

    return () => {
      window.clearInterval(interval);
    };
  }, [loadDashboard]);

  const refreshLogs = async () => {
    setRefreshing(true);
    vibrate(3);

    await loadDashboard(true);

    if (!error) {
      toast.success('Email service refreshed');
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // TEST EMAIL
  // ═══════════════════════════════════════════════════════════════════════

  const sendTest = async () => {
    const recipient = testTo.trim();

    if (!recipient) {
      toast.error(
        'Please enter a recipient email',
      );
      return;
    }

    if (!isValidEmail(recipient)) {
      toast.error(
        'Please enter a valid email address',
      );
      return;
    }

    setTesting(true);
    setTestResult(null);

    try {
      const result = await sendTestEmail({
        to: recipient,
        subject:
          testSubject.trim() ||
          'Kanyoza Email Test',
        template:
          testTemplate || undefined,
      });

      setTestResult(result);
      vibrate(5);

      if (result.success) {
        toast.success(
          'Test email sent successfully',
        );

        await loadDashboard(true);
      } else {
        toast.error(
          result.message ||
          'Test email failed',
        );
      }
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to send test email';

      setTestResult({
        success: false,
        message,
        provider: providerLabel(
          config.sendgrid.active
            ? 'sendgrid'
            : 'smtp',
        ),
        latency_ms: 0,
      });

      toast.error(message);
    } finally {
      setTesting(false);
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // TEMPLATE CRUD
  // ═══════════════════════════════════════════════════════════════════════

  const openCreateTemplate = () => {
    setEditingTemplateId(null);
    setTemplateForm(EMPTY_FORM);
    setShowTemplateEditor(true);
    vibrate(3);
  };

  const openEditTemplate = (
    template: EmailTemplate,
  ) => {
    setEditingTemplateId(template.id);

    setTemplateForm({
      name: template.name || '',
      subject: template.subject || '',
      description:
        template.description || '',
      html_body: template.html_body || '',
      variables: variablesToString(
        template.variables,
      ),
    });

    setShowTemplateEditor(true);
    vibrate(3);
  };

  const closeTemplateEditor = () => {
    if (savingTemplate) return;

    setShowTemplateEditor(false);
    setEditingTemplateId(null);
    setTemplateForm(EMPTY_FORM);
  };

  const saveTemplate = async () => {
    const name = templateForm.name.trim();
    const subject =
      templateForm.subject.trim();

    if (!name) {
      toast.error(
        'Template name is required',
      );
      return;
    }

    if (!subject) {
      toast.error(
        'Template subject is required',
      );
      return;
    }

    setSavingTemplate(true);

    try {
      const payload = {
        name,
        subject,
        description:
          templateForm.description.trim(),
        html_body: templateForm.html_body,
        variables: parseVariables(
          templateForm.variables,
        ),
      };

      if (editingTemplateId) {
        await updateTemplate(
          editingTemplateId,
          payload,
        );

        toast.success(
          'Template updated',
        );
      } else {
        await createTemplate(payload);

        toast.success(
          'Template created',
        );
      }

      vibrate(5);

      closeTemplateEditor();

      await loadDashboard(true);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to save template';

      toast.error(message);
    } finally {
      setSavingTemplate(false);
    }
  };

  const removeTemplate = async (
    template: EmailTemplate,
  ) => {
    const confirmed = window.confirm(
      `Delete "${template.name}"?\n\nThis action cannot be undone.`,
    );

    if (!confirmed) return;

    setDeletingTemplateId(template.id);

    try {
      await deleteTemplate(template.id);

      toast.success(
        'Template deleted',
      );

      vibrate(5);

      if (showPreview === template.id) {
        setShowPreview(null);
      }

      await loadDashboard(true);
    } catch (err) {
      const message =
        err instanceof Error
          ? err.message
          : 'Failed to delete template';

      toast.error(message);
    } finally {
      setDeletingTemplateId(null);
    }
  };

  const useTemplateForTest = (
    template: EmailTemplate,
  ) => {
    setTestTemplate(template.id);

    setTestSubject(
      template.subject ||
      'Kanyoza Email Test',
    );

    setActiveTab('test');

    vibrate(3);
  };

  // ═══════════════════════════════════════════════════════════════════════
  // COPY
  // ═══════════════════════════════════════════════════════════════════════

  const copyText = async (
    value: string,
    key: string,
  ) => {
    try {
      await navigator.clipboard.writeText(
        value,
      );

      setCopied(key);

      vibrate(2);

      window.setTimeout(() => {
        setCopied(current =>
          current === key
            ? null
            : current,
        );
      }, 1500);
    } catch {
      toast.error(
        'Unable to copy',
      );
    }
  };

  // ═══════════════════════════════════════════════════════════════════════
  // DERIVED VALUES
  // ═══════════════════════════════════════════════════════════════════════

  const providerStatus = useMemo(() => {
    if (config.sendgrid.active) {
      return {
        label: 'SendGrid',
        configured: true,
      };
    }

    if (config.smtp.configured) {
      return {
        label: 'SMTP',
        configured: true,
      };
    }

    return {
      label: 'Not configured',
      configured: false,
    };
  }, [config]);

  const usagePercentage = useMemo(() => {
    if (!stats.daily_limit) return 0;

    return Math.min(
      100,
      Math.round(
        (stats.used_today /
          stats.daily_limit) *
        100,
      ),
    );
  }, [
    stats.daily_limit,
    stats.used_today,
  ]);

  const successRate = Math.max(
    0,
    Math.min(
      100,
      Number(stats.success_rate) || 0,
    ),
  );

  // ═══════════════════════════════════════════════════════════════════════
  // LOADING
  // ═══════════════════════════════════════════════════════════════════════

  if (loading) {
    return <EmailServiceSkeleton />;
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-3 pb-24 md:pb-6"
    >
      {/* ═══════════════════════════════════════════════════════════════
          HEADER
      ═══════════════════════════════════════════════════════════════ */}

      <div className="rounded-2xl border border-zinc-800/60 bg-brand-elevated/90 p-4 shadow-[0_8px_30px_rgba(0,0,0,0.12)]">
        <div className="flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="relative p-2.5 bg-indigo-500/10 rounded-xl border border-indigo-500/20 shrink-0">
              <Mail className="w-5 h-5 text-indigo-400" />

              <span
                className={cn(
                  'absolute -right-0.5 -top-0.5 w-2 h-2 rounded-full',
                  providerStatus.configured
                    ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.55)]'
                    : 'bg-red-400',
                )}
              />
            </div>

            <div className="min-w-0">
              <h1 className="text-lg font-bold text-white tracking-wider font-mono truncate">
                EMAIL
                <span className="text-zinc-600">
                  _SERVICE
                </span>
              </h1>

              <p className="text-[8px] text-zinc-600 font-mono uppercase tracking-[0.15em] mt-1 truncate">
                Transactional Notifications &amp; Alerts
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <ProviderBadge
              label={providerStatus.label}
              configured={
                providerStatus.configured
              }
            />

            <button
              type="button"
              onClick={() =>
                void refreshLogs()
              }
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[8px] font-mono font-bold uppercase border border-zinc-800 text-zinc-500 hover:text-zinc-200 hover:bg-zinc-900/70 transition-all disabled:opacity-50"
              aria-label="Refresh email service"
            >
              <RefreshCw
                className={cn(
                  'w-3 h-3',
                  refreshing &&
                  'animate-spin',
                )}
              />
              Refresh
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab('test');
                vibrate(3);
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[8px] font-mono font-bold uppercase bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 hover:bg-indigo-500/30 hover:border-indigo-500/40 transition-all"
            >
              <Send className="w-3 h-3" />
              Send Test
            </button>
          </div>
        </div>

        {/* ERROR */}
        {error && (
          <motion.div
            initial={{
              opacity: 0,
              y: -4,
            }}
            animate={{
              opacity: 1,
              y: 0,
            }}
            className="mt-3 rounded-xl border border-red-500/20 bg-red-500/[0.06] p-3"
          >
            <div className="flex items-start gap-2">
              <div className="p-1.5 rounded-lg bg-red-500/10 border border-red-500/10 shrink-0">
                <AlertTriangle className="w-3.5 h-3.5 text-red-400" />
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[9px] font-mono font-bold text-red-400 uppercase tracking-wider">
                    API Error
                  </p>

                  <span className="text-[7px] font-mono uppercase text-red-500/50">
                    Connection failed
                  </span>
                </div>

                <p className="text-[9px] font-mono text-zinc-500 mt-1 break-words leading-relaxed">
                  {error}
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  void loadDashboard()
                }
                className="shrink-0 px-2 py-1 rounded-md text-[7px] font-mono uppercase border border-zinc-800 text-zinc-500 hover:text-white hover:bg-zinc-900 transition-colors"
              >
                Retry
              </button>
            </div>
          </motion.div>
        )}

        {/* STATS */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mt-4">
          <StatsCard
            label="Sent / 24h"
            value={stats.sent_24h}
            icon={CheckCircle}
            color="text-emerald-400"
          />

          <StatsCard
            label="Failed / 24h"
            value={stats.failed_24h}
            icon={XCircle}
            color="text-red-400"
          />

          <StatsCard
            label="Queued"
            value={stats.queued}
            icon={Clock}
            color="text-amber-400"
          />

          <StatsCard
            label="Success Rate"
            value={`${successRate}%`}
            icon={Zap}
            color="text-indigo-400"
          />

          <StatsCard
            label="Provider"
            value={providerLabel(
              stats.provider,
            )}
            icon={ExternalLink}
            color="text-zinc-400"
          />

          <StatsCard
            label="Daily Usage"
            value={`${stats.used_today}/${stats.daily_limit}`}
            icon={Activity}
            color="text-amber-400"
          />
        </div>

        {/* USAGE */}
        <div className="mt-3 rounded-xl border border-zinc-800/50 bg-zinc-950/40 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-2">
              <Activity className="w-3 h-3 text-zinc-600" />

              <span className="text-[8px] font-mono uppercase tracking-wider text-zinc-600">
                Daily Provider Usage
              </span>
            </div>

            <span className="text-[8px] font-mono text-zinc-500">
              {usagePercentage}%
            </span>
          </div>

          <div className="h-1.5 rounded-full bg-zinc-900 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{
                width: `${usagePercentage}%`,
              }}
              transition={{
                duration: 0.6,
                ease: 'easeOut',
              }}
              className={cn(
                'h-full rounded-full',
                usagePercentage >= 90
                  ? 'bg-red-400'
                  : usagePercentage >= 70
                    ? 'bg-amber-400'
                    : 'bg-indigo-400',
              )}
            />
          </div>
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          TAB BAR
      ═══════════════════════════════════════════════════════════════ */}

      <div className="flex gap-1 p-1 rounded-xl bg-brand-elevated border border-zinc-800/50 overflow-x-auto">
        {(
          [
            'overview',
            'templates',
            'logs',
            'test',
          ] as const
        ).map(tab => (
          <button
            key={tab}
            type="button"
            onClick={() => {
              setActiveTab(tab);
              vibrate(3);
            }}
            className={cn(
              'relative flex-1 min-w-[90px] py-2 rounded-lg text-[8px] font-mono font-bold uppercase tracking-wider transition-all',
              activeTab === tab
                ? 'bg-indigo-500/20 text-indigo-400 shadow-sm'
                : 'text-zinc-600 hover:text-zinc-400 hover:bg-zinc-900/40',
            )}
          >
            {tab === 'overview'
              ? 'Overview'
              : tab === 'templates'
                ? 'Templates'
                : tab === 'logs'
                  ? 'Logs'
                  : 'Test'}

            {tab === 'templates' &&
              templates.length > 0 && (
                <span className="ml-1.5 text-[7px] text-zinc-600">
                  {templates.length}
                </span>
              )}

            {tab === 'logs' &&
              logs.length > 0 && (
                <span className="ml-1.5 text-[7px] text-zinc-600">
                  {logs.length}
                </span>
              )}
          </button>
        ))}
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          CONTENT
      ═══════════════════════════════════════════════════════════════ */}

      <AnimatePresence mode="wait">
        {/* ============================================================
            OVERVIEW
        ============================================================ */}

        {activeTab === 'overview' && (
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
            {/* PROVIDERS */}
            <div className="grid md:grid-cols-2 gap-3">
              {/* SMTP */}
              <ProviderCard
                title="SMTP Configuration"
                icon={Server}
                active={
                  config.smtp.configured
                }
              >
                <ConfigRow
                  label="Host"
                  value={
                    config.smtp.host || '—'
                  }
                />

                <ConfigRow
                  label="Port"
                  value={
                    config.smtp.port || '—'
                  }
                />

                <ConfigRow
                  label="Username"
                  value={
                    config.smtp.username ||
                    'Not configured'
                  }
                  masked
                />

                <ConfigRow
                  label="From"
                  value={
                    config.smtp.from || '—'
                  }
                />

                <ConfigRow
                  label="Status"
                  value={
                    config.smtp.configured
                      ? 'CONFIGURED'
                      : 'NOT CONFIGURED'
                  }
                  status={
                    config.smtp.configured
                      ? 'success'
                      : 'error'
                  }
                />
              </ProviderCard>

              {/* SENDGRID */}
              <ProviderCard
                title="SendGrid Configuration"
                icon={Zap}
                active={
                  config.sendgrid.active
                }
              >
                <ConfigRow
                  label="API Key"
                  value={
                    config.sendgrid.configured
                      ? 'SG.•••••••••••••••'
                      : 'Not configured'
                  }
                  masked
                />

                <ConfigRow
                  label="Configured"
                  value={
                    config.sendgrid.configured
                      ? 'YES'
                      : 'NO'
                  }
                  status={
                    config.sendgrid.configured
                      ? 'success'
                      : 'error'
                  }
                />

                <ConfigRow
                  label="Active"
                  value={
                    config.sendgrid.active
                      ? 'ACTIVE'
                      : 'INACTIVE'
                  }
                  status={
                    config.sendgrid.active
                      ? 'success'
                      : 'error'
                  }
                />

                <ConfigRow
                  label="Daily Limit"
                  value={`${stats.daily_limit} emails`}
                />

                <ConfigRow
                  label="Used Today"
                  value={String(
                    stats.used_today,
                  )}
                />
              </ProviderCard>
            </div>

            {/* TEMPLATE ENGINE */}
            <div className="rounded-2xl border border-zinc-800/60 bg-brand-elevated/80 p-4 hover:border-zinc-700/60 transition-colors">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="p-2 rounded-xl bg-indigo-500/10 border border-indigo-500/10 shrink-0">
                    <Code2 className="w-3.5 h-3.5 text-indigo-400" />
                  </div>

                  <div className="min-w-0">
                    <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                      Template Engine
                    </h3>

                    <p className="text-[8px] font-mono text-zinc-600 mt-1 leading-relaxed">
                      {config.templates_available
                        ? 'Template rendering is available on the backend.'
                        : 'Template rendering is not currently available.'}
                    </p>
                  </div>
                </div>

                <StatusDot
                  active={
                    config.templates_available
                  }
                />
              </div>
            </div>

            {/* ADMIN EMAILS */}
            {config.admin_emails.length >
              0 && (
                <div className="rounded-2xl border border-zinc-800/60 bg-brand-elevated/80 p-4">
                  <div className="flex items-center gap-2 mb-3">
                    <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                      <Settings className="w-3 h-3 text-zinc-500" />
                    </div>

                    <div>
                      <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                        Administrative Recipients
                      </h3>

                      <p className="text-[7px] font-mono text-zinc-700 mt-0.5">
                        {config.admin_emails.length}{' '}
                        configured recipient
                        {config.admin_emails.length ===
                          1
                          ? ''
                          : 's'}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-1">
                    {config.admin_emails.map(
                      (email, index) => (
                        <div
                          key={`${email}-${index}`}
                          className="group flex items-center gap-2 rounded-lg border border-zinc-800/40 bg-zinc-950/40 px-3 py-2 hover:border-zinc-700/50 transition-colors"
                        >
                          <Mail className="w-3 h-3 text-zinc-700 shrink-0" />

                          <span className="text-[9px] font-mono text-zinc-400 flex-1 truncate">
                            {email}
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              void copyText(
                                email,
                                `admin-${index}`,
                              )
                            }
                            className="opacity-60 group-hover:opacity-100 text-zinc-600 hover:text-zinc-300 transition-opacity"
                            aria-label={`Copy ${email}`}
                          >
                            {copied ===
                              `admin-${index}` ? (
                              <Check className="w-3 h-3 text-emerald-400" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                          </button>
                        </div>
                      ),
                    )}
                  </div>
                </div>
              )}

            {/* RECENT ACTIVITY */}
            <div className="rounded-2xl border border-zinc-800/60 bg-brand-elevated/80 overflow-hidden">
              <div className="p-4 border-b border-zinc-800/50 flex items-center justify-between mb-0">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                    <History className="w-3 h-3 text-zinc-500" />
                  </div>

                  <div>
                    <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                      Recent Activity
                    </h3>

                    <p className="text-[7px] font-mono text-zinc-700 mt-0.5">
                      Latest transactional email events
                    </p>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setActiveTab('logs')
                  }
                  className="flex items-center gap-1 text-[8px] font-mono uppercase text-indigo-400 hover:text-indigo-300"
                >
                  View all
                  <ChevronRight className="w-3 h-3" />
                </button>
              </div>

              {logs.length === 0 ? (
                <EmptyState
                  icon={Mail}
                  title="No email activity"
                  description="The backend has not returned any email logs yet."
                />
              ) : (
                <div className="px-4">
                  {logs
                    .slice(0, 6)
                    .map(log => (
                      <EmailLogRow
                        key={log.id}
                        log={log}
                        compact
                      />
                    ))}
                </div>
              )}
            </div>
          </motion.div>
        )}

        {/* ============================================================
            TEMPLATES
        ============================================================ */}

        {activeTab === 'templates' && (
          <motion.div
            key="templates"
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
            className="space-y-2"
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                  Email Templates
                </h2>

                <p className="text-[8px] font-mono text-zinc-600 mt-1">
                  {templates.length} template
                  {templates.length ===
                    1
                    ? ''
                    : 's'} available
                </p>
              </div>

              <button
                type="button"
                onClick={
                  openCreateTemplate
                }
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-[8px] font-mono font-bold uppercase hover:bg-indigo-500/30 hover:border-indigo-500/40 transition-all"
              >
                <Plus className="w-3 h-3" />
                New Template
              </button>
            </div>

            {templates.length === 0 ? (
              <EmptyState
                icon={Mail}
                title="No templates"
                description="Create your first transactional email template."
                action={
                  <button
                    type="button"
                    onClick={
                      openCreateTemplate
                    }
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 text-[8px] font-mono uppercase"
                  >
                    <Plus className="w-3 h-3" />
                    Create Template
                  </button>
                }
              />
            ) : (
              templates.map(
                (template, index) => (
                  <motion.div
                    key={template.id}
                    initial={{
                      opacity: 0,
                      y: 8,
                    }}
                    animate={{
                      opacity: 1,
                      y: 0,
                    }}
                    transition={{
                      delay:
                        index * 0.025,
                    }}
                    className="rounded-2xl border border-zinc-800/60 bg-brand-elevated/80 overflow-hidden hover:border-zinc-700/70 transition-colors"
                  >
                    <div className="p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/10 shrink-0">
                              <Mail className="w-3.5 h-3.5 text-indigo-400" />
                            </div>

                            <h3 className="text-sm font-bold text-white font-mono truncate">
                              {template.name}
                            </h3>
                          </div>

                          <p className="text-[10px] font-mono text-zinc-500 mt-2 leading-relaxed">
                            {template.description ||
                              'No description'}
                          </p>

                          <div className="mt-2 text-[9px] font-mono">
                            <span className="text-zinc-600">
                              Subject:
                            </span>{' '}
                            <span className="text-zinc-300">
                              {template.subject ||
                                'No subject'}
                            </span>
                          </div>

                          <div className="flex flex-wrap gap-1 mt-2">
                            {(
                              template.variables ||
                              []
                            ).map(
                              variable => (
                                <span
                                  key={
                                    variable
                                  }
                                  className="px-1.5 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/10 text-indigo-400 text-[8px] font-mono"
                                >
                                  {`{{ ${variable} }}`}
                                </span>
                              ),
                            )}
                          </div>
                        </div>

                        <div className="flex items-center gap-1 shrink-0">
                          <IconButton
                            label={
                              showPreview ===
                                template.id
                                ? 'Hide preview'
                                : 'Preview template'
                            }
                            onClick={() =>
                              setShowPreview(
                                showPreview ===
                                  template.id
                                  ? null
                                  : template.id,
                              )
                            }
                          >
                            {showPreview ===
                              template.id ? (
                              <EyeOff className="w-3.5 h-3.5" />
                            ) : (
                              <Eye className="w-3.5 h-3.5" />
                            )}
                          </IconButton>

                          <IconButton
                            label="Use template for test"
                            tone="indigo"
                            onClick={() =>
                              useTemplateForTest(
                                template,
                              )
                            }
                          >
                            <Send className="w-3.5 h-3.5" />
                          </IconButton>

                          <IconButton
                            label="Edit template"
                            tone="amber"
                            onClick={() =>
                              openEditTemplate(
                                template,
                              )
                            }
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </IconButton>

                          <IconButton
                            label="Delete template"
                            tone="red"
                            disabled={
                              deletingTemplateId ===
                              template.id
                            }
                            onClick={() =>
                              void removeTemplate(
                                template,
                              )
                            }
                          >
                            {deletingTemplateId ===
                              template.id ? (
                              <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                            ) : (
                              <Trash2 className="w-3.5 h-3.5" />
                            )}
                          </IconButton>
                        </div>
                      </div>
                    </div>

                    <AnimatePresence>
                      {showPreview ===
                        template.id && (
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
                            className="border-t border-zinc-800/50 p-4 bg-zinc-950/40"
                          >
                            <div className="rounded-xl border border-zinc-800/50 overflow-hidden">
                              <div className="px-3 py-2 bg-zinc-900/80 border-b border-zinc-800/50 flex items-center justify-between">
                                <span className="text-[8px] font-mono uppercase tracking-wider text-zinc-600">
                                  Template Preview
                                </span>

                                <span className="text-[7px] font-mono text-zinc-700">
                                  HTML
                                </span>
                              </div>

                              <div className="p-4 max-h-72 overflow-y-auto bg-zinc-950">
                                <p className="text-[9px] font-mono text-zinc-300 mb-3">
                                  Subject:{' '}
                                  <strong>
                                    {
                                      template.subject
                                    }
                                  </strong>
                                </p>

                                {template.html_body ? (
                                  <div
                                    className="rounded-lg border border-zinc-800/50 bg-white text-black p-4 overflow-x-auto"
                                    dangerouslySetInnerHTML={{
                                      __html:
                                        template.html_body,
                                    }}
                                  />
                                ) : (
                                  <div className="space-y-2">
                                    <div className="h-4 bg-zinc-800 rounded w-3/4" />
                                    <div className="h-4 bg-zinc-800 rounded w-1/2" />
                                    <div className="h-4 bg-zinc-800 rounded w-5/6" />
                                    <div className="h-4 bg-zinc-800 rounded w-1/3 mt-3" />
                                    <div className="h-4 bg-zinc-800 rounded w-2/3" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                    </AnimatePresence>
                  </motion.div>
                ),
              )
            )}
          </motion.div>
        )}

        {/* ============================================================
            LOGS
        ============================================================ */}

        {activeTab === 'logs' && (
          <motion.div
            key="logs"
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
          >
            <div className="rounded-2xl border border-zinc-800/60 bg-brand-elevated/80 overflow-hidden">
              <div className="p-4 border-b border-zinc-800/50 flex items-center justify-between gap-3">
                <div>
                  <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                    Email Log
                    <span className="text-zinc-700 ml-1.5">
                      {logs.length}
                    </span>
                  </h3>

                  <p className="text-[8px] font-mono text-zinc-700 mt-1">
                    Data supplied by GET
                    /email/logs
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    void refreshLogs()
                  }
                  disabled={refreshing}
                  className="p-2 rounded-lg border border-zinc-800/50 text-zinc-600 hover:text-zinc-300 hover:bg-zinc-900 transition-colors disabled:opacity-50"
                  aria-label="Refresh email logs"
                >
                  <RefreshCw
                    className={cn(
                      'w-3.5 h-3.5',
                      refreshing &&
                      'animate-spin',
                    )}
                  />
                </button>
              </div>

              <div className="max-h-[600px] overflow-y-auto">
                {logs.length === 0 ? (
                  <EmptyState
                    icon={History}
                    title="No email logs"
                    description="The backend returned an empty email log."
                  />
                ) : (
                  logs.map(log => (
                    <EmailLogRow
                      key={log.id}
                      log={log}
                    />
                  ))
                )}
              </div>
            </div>
          </motion.div>
        )}

        {/* ============================================================
            TEST
        ============================================================ */}

        {activeTab === 'test' && (
          <motion.div
            key="test"
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
          >
            <div className="grid lg:grid-cols-[minmax(0,1fr)_320px] gap-3">
              {/* FORM */}
              <div className="rounded-2xl border border-zinc-800/60 bg-brand-elevated/80 p-4">
                <div className="flex items-center gap-2 mb-4">
                  <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/10">
                    <Send className="w-3.5 h-3.5 text-indigo-400" />
                  </div>

                  <div>
                    <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                      Send Test Email
                    </h3>

                    <p className="text-[7px] font-mono text-zinc-700 mt-0.5">
                      Send a real message through the active provider
                    </p>
                  </div>
                </div>

                <div className="space-y-3 max-w-lg">
                  <FormField label="Recipient">
                    <input
                      type="email"
                      value={testTo}
                      onChange={event =>
                        setTestTo(
                          event.target.value,
                        )
                      }
                      placeholder="admin@yourorg.org"
                      autoComplete="email"
                      className={cn(
                        inputClass,
                        testTo &&
                        !isValidEmail(
                          testTo,
                        ) &&
                        'border-red-500/30',
                      )}
                    />

                    {testTo &&
                      !isValidEmail(
                        testTo,
                      ) && (
                        <p className="mt-1 text-[7px] font-mono text-red-400">
                          Enter a valid email address.
                        </p>
                      )}
                  </FormField>

                  <FormField label="Template">
                    <select
                      value={testTemplate}
                      onChange={event => {
                        const value =
                          event.target
                            .value;

                        setTestTemplate(
                          value,
                        );

                        const selected =
                          templates.find(
                            template =>
                              template.id ===
                              value,
                          );

                        if (
                          selected?.subject
                        ) {
                          setTestSubject(
                            selected.subject,
                          );
                        }
                      }}
                      className={selectClass}
                    >
                      <option value="">
                        Test Email
                      </option>

                      {templates.map(
                        template => (
                          <option
                            key={
                              template.id
                            }
                            value={
                              template.id
                            }
                          >
                            {template.name}
                          </option>
                        ),
                      )}
                    </select>
                  </FormField>

                  <FormField label="Subject">
                    <input
                      type="text"
                      value={testSubject}
                      onChange={event =>
                        setTestSubject(
                          event.target
                            .value,
                        )
                      }
                      className={inputClass}
                      placeholder="Kanyoza Email Test"
                    />
                  </FormField>

                  <button
                    type="button"
                    onClick={() =>
                      void sendTest()
                    }
                    disabled={
                      testing ||
                      !testTo.trim() ||
                      !isValidEmail(
                        testTo,
                      )
                    }
                    className="flex items-center justify-center gap-2 w-full sm:w-auto px-4 py-2.5 rounded-xl bg-indigo-500/20 text-indigo-400 border border-indigo-500/30 text-[9px] font-mono font-bold uppercase hover:bg-indigo-500/30 hover:border-indigo-500/40 disabled:opacity-40 transition-all"
                  >
                    {testing ? (
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Send className="w-3.5 h-3.5" />
                    )}

                    {testing
                      ? 'Sending...'
                      : 'Send Test Email'}
                  </button>
                </div>

                {/* TEST RESULT */}
                <AnimatePresence>
                  {testResult && (
                    <motion.div
                      initial={{
                        opacity: 0,
                        y: 8,
                      }}
                      animate={{
                        opacity: 1,
                        y: 0,
                      }}
                      className={cn(
                        'mt-4 p-3 rounded-xl border',
                        testResult.success
                          ? 'border-emerald-500/20 bg-emerald-500/5'
                          : 'border-red-500/20 bg-red-500/5',
                      )}
                    >
                      <div className="flex items-center gap-2">
                        {testResult.success ? (
                          <CheckCircle className="w-4 h-4 text-emerald-400" />
                        ) : (
                          <XCircle className="w-4 h-4 text-red-400" />
                        )}

                        <span className="text-[10px] font-mono font-bold text-zinc-300">
                          {testResult.success
                            ? 'Sent Successfully'
                            : 'Send Failed'}
                        </span>
                      </div>

                      <div className="mt-2 space-y-1 text-[8px] font-mono text-zinc-500">
                        <p>
                          {
                            testResult.message
                          }
                        </p>

                        <p>
                          Provider:{' '}
                          {providerLabel(
                            testResult.provider,
                          )}
                        </p>

                        {testResult.latency_ms >
                          0 && (
                            <p>
                              Latency:{' '}
                              {
                                testResult.latency_ms
                              }
                              ms
                            </p>
                          )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* SERVICE INFORMATION */}
              <div className="rounded-2xl border border-zinc-800/60 bg-brand-elevated/80 p-4 h-fit">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
                    <Info className="w-3.5 h-3.5 text-zinc-500" />
                  </div>

                  <div>
                    <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400">
                      Service Information
                    </h3>
                  </div>
                </div>

                <div className="space-y-2.5">
                  <InfoRow
                    label="Active Provider"
                    value={providerLabel(
                      stats.provider,
                    )}
                  />

                  <InfoRow
                    label="SMTP"
                    value={
                      config.smtp
                        .configured
                        ? 'Configured'
                        : 'Not configured'
                    }
                    status={
                      config.smtp
                        .configured
                    }
                  />

                  <InfoRow
                    label="SendGrid"
                    value={
                      config.sendgrid
                        .active
                        ? 'Active'
                        : config.sendgrid
                          .configured
                          ? 'Configured'
                          : 'Not configured'
                    }
                    status={
                      config.sendgrid
                        .active
                    }
                  />

                  <InfoRow
                    label="Templates"
                    value={String(
                      templates.length,
                    )}
                  />

                  <InfoRow
                    label="Queue"
                    value={String(
                      stats.queued,
                    )}
                  />
                </div>

                <div className="mt-4 p-3 rounded-xl border border-indigo-500/10 bg-indigo-500/5">
                  <div className="flex items-start gap-2">
                    <ShieldCheck className="w-3.5 h-3.5 text-indigo-400 shrink-0 mt-0.5" />

                    <p className="text-[8px] font-mono text-zinc-500 leading-relaxed">
                      The test request is sent directly to the Kanyoza backend. No simulated delivery is performed by this dashboard.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ═══════════════════════════════════════════════════════════════
          TEMPLATE EDITOR
      ═══════════════════════════════════════════════════════════════ */}

      <AnimatePresence>
        {showTemplateEditor && (
          <TemplateEditor
            form={templateForm}
            editing={Boolean(
              editingTemplateId,
            )}
            saving={savingTemplate}
            onChange={
              setTemplateForm
            }
            onSave={() =>
              void saveTemplate()
            }
            onClose={
              closeTemplateEditor
            }
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EMAIL LOG ROW
// ═══════════════════════════════════════════════════════════════════════════

function EmailLogRow({
  log,
  compact = false,
}: {
  log: EmailLog;
  compact?: boolean;
}) {
  const status =
    log.status?.toLowerCase() ||
    'unknown';

  const isSent = status === 'sent';
  const isFailed =
    status === 'failed';

  return (
    <div
      className={cn(
        'border-b border-zinc-800/30 last:border-0 hover:bg-zinc-900/20 transition-colors',
        compact
          ? 'py-2'
          : 'p-3',
      )}
    >
      <div className="flex items-center gap-2 min-w-0">
        {isSent ? (
          <CheckCircle className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        ) : isFailed ? (
          <XCircle className="w-3.5 h-3.5 text-red-400 shrink-0" />
        ) : (
          <Clock className="w-3.5 h-3.5 text-amber-400 shrink-0" />
        )}

        <span
          className={cn(
            'font-mono font-bold text-zinc-300 truncate',
            compact
              ? 'text-[9px]'
              : 'text-[10px]',
          )}
          title={
            log.subject ||
            '(No subject)'
          }
        >
          {log.subject ||
            '(No subject)'}
        </span>

        <span
          className={cn(
            'ml-auto px-1.5 py-0.5 rounded-md text-[7px] font-mono uppercase shrink-0 border',
            log.provider?.toLowerCase() ===
              'sendgrid'
              ? 'bg-indigo-500/10 text-indigo-400 border-indigo-500/10'
              : 'bg-zinc-500/10 text-zinc-500 border-zinc-800/50',
          )}
        >
          {providerLabel(
            log.provider,
          )}
        </span>
      </div>

      <div
        className={cn(
          'flex gap-3 font-mono text-zinc-600 ml-6',
          compact
            ? 'items-center text-[7px] mt-0.5'
            : 'flex-wrap items-center text-[8px] mt-1',
        )}
      >
        <span
          className="truncate max-w-[260px]"
          title={log.to || undefined}
        >
          To: {log.to || '—'}
        </span>

        <span className="truncate max-w-[180px]">
          Template:{' '}
          {log.template || '—'}
        </span>

        <span className="shrink-0">
          {compact
            ? relativeTime(
              log.sent_at,
            )
            : formatDateTime(
              log.sent_at,
            )}
        </span>

        {!compact && (
          <span
            className={cn(
              'px-1.5 py-0.5 rounded-md',
              isSent
                ? 'text-emerald-500 bg-emerald-500/5'
                : isFailed
                  ? 'text-red-500 bg-red-500/5'
                  : 'text-amber-500 bg-amber-500/5',
            )}
          >
            {statusLabel(
              log.status,
            )}
          </span>
        )}
      </div>

      {!compact && log.error && (
        <p className="text-[8px] font-mono text-red-400 mt-2 ml-6 break-words leading-relaxed">
          {log.error}
        </p>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// TEMPLATE EDITOR
// ═══════════════════════════════════════════════════════════════════════════

function TemplateEditor({
  form,
  editing,
  saving,
  onChange,
  onSave,
  onClose,
}: {
  form: TemplateForm;
  editing: boolean;
  saving: boolean;
  onChange: React.Dispatch<
    React.SetStateAction<TemplateForm>
  >;
  onSave: () => void;
  onClose: () => void;
}) {
  const variables =
    parseVariables(form.variables);

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5"
      role="dialog"
      aria-modal="true"
      aria-labelledby="email-template-editor-title"
      onMouseDown={event => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <motion.div
        initial={{
          opacity: 0,
          scale: 0.97,
          y: 10,
        }}
        animate={{
          opacity: 1,
          scale: 1,
          y: 0,
        }}
        exit={{
          opacity: 0,
          scale: 0.97,
          y: 10,
        }}
        className="w-full max-w-2xl max-h-[92vh] overflow-y-auto rounded-2xl border border-zinc-800 bg-brand-surface shadow-2xl shadow-black/40"
      >
        {/* HEADER */}
        <div className="sticky top-0 z-10 flex items-center justify-between gap-3 p-4 border-b border-zinc-800 bg-brand-surface/95 backdrop-blur">
          <div>
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-indigo-500/10 border border-indigo-500/10">
                <Code2 className="w-3.5 h-3.5 text-indigo-400" />
              </div>

              <h2
                id="email-template-editor-title"
                className="text-sm font-bold font-mono text-white"
              >
                {editing
                  ? 'EDIT_EMAIL_TEMPLATE'
                  : 'CREATE_EMAIL_TEMPLATE'}
              </h2>
            </div>

            <p className="text-[8px] font-mono text-zinc-600 mt-1">
              Saved through
              /email/templates
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="p-2 rounded-lg text-zinc-500 hover:text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            aria-label="Close template editor"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* BODY */}
        <div className="p-4 space-y-3">
          <FormField label="Name">
            <input
              value={form.name}
              onChange={event =>
                onChange(
                  current => ({
                    ...current,
                    name: event.target
                      .value,
                  }),
                )
              }
              placeholder="Render Failure Alert"
              autoFocus
              className={inputClass}
            />
          </FormField>

          <FormField label="Subject">
            <input
              value={form.subject}
              onChange={event =>
                onChange(
                  current => ({
                    ...current,
                    subject:
                      event.target
                        .value,
                  }),
                )
              }
              placeholder="Render Failure Detected"
              className={inputClass}
            />
          </FormField>

          <FormField label="Description">
            <input
              value={form.description}
              onChange={event =>
                onChange(
                  current => ({
                    ...current,
                    description:
                      event.target
                        .value,
                  }),
                )
              }
              placeholder="Describe when this template is used..."
              className={inputClass}
            />
          </FormField>

          <FormField
            label="Variables"
            hint="Comma-separated values"
          >
            <input
              value={form.variables}
              onChange={event =>
                onChange(
                  current => ({
                    ...current,
                    variables:
                      event.target
                        .value,
                  }),
                )
              }
              placeholder="brand_name, timestamp, error_count"
              className={inputClass}
            />

            {variables.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {variables.map(
                  variable => (
                    <span
                      key={variable}
                      className="px-1.5 py-0.5 rounded-md bg-indigo-500/10 border border-indigo-500/10 text-indigo-400 text-[8px] font-mono"
                    >
                      {`{{ ${variable} }}`}
                    </span>
                  ),
                )}
              </div>
            )}
          </FormField>

          <FormField
            label="HTML Body"
            hint="Optional HTML email content"
          >
            <textarea
              value={form.html_body}
              onChange={event =>
                onChange(
                  current => ({
                    ...current,
                    html_body:
                      event.target
                        .value,
                  }),
                )
              }
              placeholder="<div><h1>Hello {{ brand_name }}</h1></div>"
              rows={12}
              spellCheck={false}
              className={cn(
                inputClass,
                'resize-y min-h-[180px] leading-relaxed',
              )}
            />
          </FormField>

          <div className="rounded-xl border border-amber-500/10 bg-amber-500/5 p-3">
            <div className="flex items-start gap-2">
              <AlertTriangle className="w-3.5 h-3.5 text-amber-400 shrink-0 mt-0.5" />

              <div>
                <p className="text-[8px] font-mono font-bold text-amber-400/80 uppercase">
                  Trusted HTML only
                </p>

                <p className="text-[8px] font-mono text-zinc-500 leading-relaxed mt-1">
                  Template HTML is stored by the backend. Only insert trusted HTML and template variables.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* FOOTER */}
        <div className="sticky bottom-0 flex items-center justify-end gap-2 p-4 border-t border-zinc-800 bg-brand-surface/95 backdrop-blur">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-3 py-2 rounded-lg border border-zinc-800 text-zinc-500 hover:text-zinc-300 hover:bg-zinc-900 text-[8px] font-mono uppercase disabled:opacity-50 transition-colors"
          >
            Cancel
          </button>

          <button
            type="button"
            onClick={onSave}
            disabled={saving}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-indigo-500/20 border border-indigo-500/30 text-indigo-400 hover:bg-indigo-500/30 text-[8px] font-mono font-bold uppercase disabled:opacity-50 transition-all"
          >
            {saving ? (
              <RefreshCw className="w-3 h-3 animate-spin" />
            ) : (
              <Save className="w-3 h-3" />
            )}

            {saving
              ? 'Saving...'
              : editing
                ? 'Update'
                : 'Create'}
          </button>
        </div>
      </motion.div>
    </motion.div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER CARD
// ═══════════════════════════════════════════════════════════════════════════

function ProviderCard({
  title,
  icon: Icon,
  active,
  children,
}: {
  title: string;
  icon: React.ComponentType<{
    className?: string;
  }>;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-zinc-800/60 bg-brand-elevated/80 p-4 hover:border-zinc-700/60 transition-colors">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 min-w-0">
          <div className="p-1.5 rounded-lg bg-zinc-900 border border-zinc-800">
            <Icon className="w-3 h-3 text-zinc-500" />
          </div>

          <h3 className="text-[10px] font-mono font-bold uppercase tracking-wider text-zinc-400 truncate">
            {title}
          </h3>
        </div>

        <StatusDot active={active} />
      </div>

      <div className="space-y-2 text-[9px] font-mono">
        {children}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// FORM FIELD
// ═══════════════════════════════════════════════════════════════════════════

const inputClass =
  'w-full bg-zinc-900/50 border border-zinc-800/60 rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-zinc-700 focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/10 transition-all';

const selectClass =
  'w-full bg-zinc-900/50 border border-zinc-800/60 rounded-lg px-3 py-2 text-sm text-zinc-300 font-mono focus:outline-none focus:border-indigo-500/50 focus:ring-1 focus:ring-indigo-500/10 transition-all';

function FormField({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="flex items-center justify-between gap-2 mb-1">
        <label className="text-[8px] font-mono uppercase tracking-wider text-zinc-600">
          {label}
        </label>

        {hint && (
          <span className="text-[7px] font-mono text-zinc-700">
            {hint}
          </span>
        )}
      </div>

      {children}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// ICON BUTTON
// ═══════════════════════════════════════════════════════════════════════════

function IconButton({
  label,
  children,
  onClick,
  disabled = false,
  tone = 'default',
}: {
  label: string;
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone?:
  | 'default'
  | 'indigo'
  | 'amber'
  | 'red';
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={label}
      aria-label={label}
      className={cn(
        'p-1.5 rounded-lg text-zinc-600 hover:bg-zinc-800 disabled:opacity-40 transition-colors',
        tone === 'indigo' &&
        'hover:text-indigo-400 hover:bg-indigo-500/10',
        tone === 'amber' &&
        'hover:text-amber-400 hover:bg-amber-500/10',
        tone === 'red' &&
        'hover:text-red-400 hover:bg-red-500/10',
        tone === 'default' &&
        'hover:text-zinc-300',
      )}
    >
      {children}
    </button>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STATS CARD
// ═══════════════════════════════════════════════════════════════════════════

function StatsCard({
  label,
  value,
  icon: Icon,
  color,
}: {
  label: string;
  value: string | number;
  icon: React.ComponentType<{
    className?: string;
  }>;
  color: string;
}) {
  return (
    <div className="group rounded-xl border border-zinc-800/50 bg-zinc-900/30 px-3 py-2.5 hover:bg-zinc-900/50 hover:border-zinc-700/60 transition-all">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[7px] font-mono uppercase tracking-wider text-zinc-600 truncate">
          {label}
        </span>

        <Icon
          className={cn(
            'w-3 h-3 shrink-0 opacity-80 group-hover:opacity-100',
            color,
          )}
        />
      </div>

      <p
        className={cn(
          'mt-1 text-sm font-bold font-mono truncate',
          color,
        )}
      >
        {value}
      </p>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// CONFIG ROW
// ═══════════════════════════════════════════════════════════════════════════

function ConfigRow({
  label,
  value,
  masked = false,
  status,
}: {
  label: string;
  value: string | number;
  masked?: boolean;
  status?:
  | 'success'
  | 'error'
  | 'info';
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-zinc-600 shrink-0">
        {label}
      </span>

      <div className="flex items-center gap-1.5 min-w-0">
        <span
          className={cn(
            'text-zinc-400 truncate text-right',
            masked &&
            'text-zinc-600 italic',
          )}
          title={String(value)}
        >
          {value}
        </span>

        {status && (
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full shrink-0',
              status === 'success'
                ? 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.35)]'
                : status === 'error'
                  ? 'bg-red-400'
                  : 'bg-indigo-400',
            )}
          />
        )}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// PROVIDER BADGE
// ═══════════════════════════════════════════════════════════════════════════

function ProviderBadge({
  label,
  configured,
}: {
  label: string;
  configured: boolean;
}) {
  return (
    <div
      className={cn(
        'flex items-center gap-1.5 px-2 py-1 rounded-lg border text-[7px] font-mono uppercase',
        configured
          ? 'border-emerald-500/20 bg-emerald-500/5 text-emerald-400'
          : 'border-red-500/20 bg-red-500/5 text-red-400',
      )}
    >
      <span
        className={cn(
          'w-1.5 h-1.5 rounded-full',
          configured
            ? 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.45)]'
            : 'bg-red-400',
        )}
      />

      {label}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// STATUS DOT
// ═══════════════════════════════════════════════════════════════════════════

function StatusDot({
  active,
}: {
  active: boolean;
}) {
  return (
    <span
      className={cn(
        'w-2 h-2 rounded-full shrink-0',
        active
          ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.45)]'
          : 'bg-red-400',
      )}
      title={
        active
          ? 'Active'
          : 'Inactive'
      }
    />
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// INFO ROW
// ═══════════════════════════════════════════════════════════════════════════

function InfoRow({
  label,
  value,
  status,
}: {
  label: string;
  value: string;
  status?: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3 text-[8px] font-mono">
      <span className="text-zinc-600">
        {label}
      </span>

      <div className="flex items-center gap-1.5 min-w-0">
        {status !== undefined && (
          <span
            className={cn(
              'w-1.5 h-1.5 rounded-full shrink-0',
              status
                ? 'bg-emerald-400 shadow-[0_0_5px_rgba(52,211,153,0.35)]'
                : 'bg-zinc-700',
            )}
          />
        )}

        <span className="text-zinc-400 truncate">
          {value}
        </span>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// EMPTY STATE
// ═══════════════════════════════════════════════════════════════════════════

function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: React.ComponentType<{
    className?: string;
  }>;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="py-12 px-4 flex flex-col items-center justify-center text-center">
      <div className="p-3 rounded-xl border border-zinc-800/60 bg-zinc-900/30">
        <Icon className="w-5 h-5 text-zinc-700" />
      </div>

      <p className="mt-3 text-[10px] font-mono font-bold uppercase text-zinc-500">
        {title}
      </p>

      <p className="mt-1 max-w-sm text-[8px] font-mono text-zinc-700 leading-relaxed">
        {description}
      </p>

      {action && (
        <div className="mt-3">
          {action}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// LOADING SKELETON
// ═══════════════════════════════════════════════════════════════════════════

function EmailServiceSkeleton() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="space-y-3 pb-24 md:pb-6"
    >
      <div className="rounded-2xl border border-zinc-800/60 bg-brand-elevated/90 p-4">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-zinc-900 animate-pulse" />

            <div className="space-y-2">
              <div className="h-4 w-40 rounded bg-zinc-900 animate-pulse" />

              <div className="h-2 w-56 rounded bg-zinc-900 animate-pulse" />
            </div>
          </div>

          <div className="h-7 w-24 rounded-lg bg-zinc-900 animate-pulse" />
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-2 mt-4">
          {Array.from({
            length: 6,
          }).map((_, index) => (
            <div
              key={index}
              className="h-16 rounded-xl bg-zinc-900/60 animate-pulse"
            />
          ))}
        </div>

        <div className="mt-3 h-12 rounded-xl bg-zinc-900/60 animate-pulse" />
      </div>

      <div className="h-10 rounded-xl bg-zinc-900/60 animate-pulse" />

      <div className="grid md:grid-cols-2 gap-3">
        <div className="h-48 rounded-2xl bg-zinc-900/60 animate-pulse" />

        <div className="h-48 rounded-2xl bg-zinc-900/60 animate-pulse" />
      </div>
    </motion.div>
  );
}
