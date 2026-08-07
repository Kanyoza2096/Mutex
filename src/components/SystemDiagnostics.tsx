import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useStore, type HttpLog } from '../store/useStore';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  CheckCircle,
  RefreshCw,
  XCircle,
  Database,
  ShieldAlert,
  Activity,
  Key,
  Wifi,
  Server,
  Clock3,
  Trash2,
  HelpCircle,
  ExternalLink,
  Search,
  ChevronDown,
  Copy,
  Check,
  Zap,
  CircleDot,
  Radio,
  Globe,
  LockKeyhole,
  Bug,
  RotateCcw,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

/* ============================================================================
 * TYPES
 * ========================================================================== */

type DiagnosticSeverity =
  | 'success'
  | 'info'
  | 'warning'
  | 'error'
  | 'critical';

type DiagnosticCategory =
  | 'network'
  | 'authentication'
  | 'client'
  | 'server'
  | 'timeout'
  | 'unknown';

type ConnectionState =
  | 'unknown'
  | 'healthy'
  | 'degraded'
  | 'offline';

interface NormalizedLog extends HttpLog {
  normalizedStatus: number | null;
  normalizedError: string;
  pathname: string;
  isFailed: boolean;
  isPending: boolean;
  category: DiagnosticCategory;
  severity: DiagnosticSeverity;
  timestampMs: number;
}

/* ============================================================================
 * SAFE HELPERS
 * ========================================================================== */

function safePathname(url: string | undefined | null): string {
  if (!url) return '';

  try {
    if (/^https?:\/\//i.test(url)) {
      return new URL(url).pathname || '/';
    }

    return url;
  } catch {
    return url;
  }
}

function safeTimestamp(value: unknown): number {
  if (!value) return 0;

  const timestamp = new Date(String(value)).getTime();

  return Number.isFinite(timestamp) ? timestamp : 0;
}

function safeTime(value: unknown): string {
  const timestamp = safeTimestamp(value);

  if (!timestamp) return '--:--:--';

  try {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return '--:--:--';
  }
}

function safeStatus(status: unknown): number | null {
  if (typeof status === 'number' && Number.isFinite(status)) {
    return status;
  }

  if (typeof status === 'string' && status.trim()) {
    const parsed = Number(status);

    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return null;
}

function safeError(error: unknown): string {
  if (!error) return '';

  if (typeof error === 'string') {
    return error.trim();
  }

  try {
    return String(error);
  } catch {
    return 'Unknown error';
  }
}

function classifyError(
  status: number | null,
  error: string,
): {
  category: DiagnosticCategory;
  severity: DiagnosticSeverity;
} {
  const normalized = error.toLowerCase();

  /*
   * IMPORTANT:
   *
   * We deliberately distinguish:
   *
   * 401/403       -> authentication/authorization
   * 408/429       -> request throttling/timeouts
   * 5xx           -> backend/server
   * 4xx           -> client/API request
   * fetch/network -> network
   *
   * This prevents a 500 from being incorrectly reported as
   * "server unreachable".
   */

  if (
    normalized.includes('failed to fetch') ||
    normalized.includes('network error') ||
    normalized.includes('network request failed') ||
    normalized.includes('load failed') ||
    normalized.includes('connection refused') ||
    normalized.includes('err_connection') ||
    normalized.includes('econnrefused') ||
    normalized.includes('enotfound') ||
    normalized.includes('offline')
  ) {
    return {
      category: 'network',
      severity: 'critical',
    };
  }

  if (
    normalized.includes('timeout') ||
    normalized.includes('timed out') ||
    normalized.includes('abort')
  ) {
    return {
      category: 'timeout',
      severity: 'warning',
    };
  }

  if (status === 401) {
    return {
      category: 'authentication',
      severity: 'critical',
    };
  }

  if (status === 403) {
    return {
      category: 'authentication',
      severity: 'error',
    };
  }

  if (status === 408 || status === 429) {
    return {
      category: 'timeout',
      severity: 'warning',
    };
  }

  if (status !== null && status >= 500) {
    return {
      category: 'server',
      severity: 'critical',
    };
  }

  if (status !== null && status >= 400) {
    return {
      category: 'client',
      severity: 'error',
    };
  }

  if (error) {
    return {
      category: 'unknown',
      severity: 'warning',
    };
  }

  return {
    category: 'unknown',
    severity: 'success',
  };
}

function getStatusLabel(status: number | null): string {
  if (status === null) return 'PENDING';

  if (status >= 200 && status < 300) return 'SUCCESS';
  if (status >= 300 && status < 400) return 'REDIRECT';
  if (status === 401) return 'UNAUTHORIZED';
  if (status === 403) return 'FORBIDDEN';
  if (status === 404) return 'NOT FOUND';
  if (status === 408) return 'TIMEOUT';
  if (status === 429) return 'RATE LIMITED';
  if (status >= 400 && status < 500) return 'CLIENT ERROR';
  if (status >= 500) return 'SERVER ERROR';

  return 'UNKNOWN';
}

function getCategoryLabel(category: DiagnosticCategory): string {
  switch (category) {
    case 'network':
      return 'Network';
    case 'authentication':
      return 'Authentication';
    case 'client':
      return 'Client/API';
    case 'server':
      return 'Backend';
    case 'timeout':
      return 'Timeout';
    default:
      return 'Unknown';
  }
}

function getCategoryIcon(category: DiagnosticCategory) {
  switch (category) {
    case 'network':
      return Wifi;

    case 'authentication':
      return LockKeyhole;

    case 'server':
      return Server;

    case 'timeout':
      return Clock3;

    case 'client':
      return Bug;

    default:
      return AlertTriangle;
  }
}

function normalizeLog(log: HttpLog): NormalizedLog {
  const normalizedStatus = safeStatus(log.status);
  const normalizedError = safeError(log.error);

  const classification = classifyError(
    normalizedStatus,
    normalizedError,
  );

  return {
    ...log,
    normalizedStatus,
    normalizedError,
    pathname: safePathname(log.url),
    isFailed:
      Boolean(normalizedError) ||
      (normalizedStatus !== null && normalizedStatus >= 400),
    isPending:
      normalizedStatus === null &&
      !normalizedError,
    category: classification.category,
    severity: classification.severity,
    timestampMs: safeTimestamp(log.timestamp),
  };
}

/* ============================================================================
 * SMALL UI COMPONENTS
 * ========================================================================== */

interface StatusDotProps {
  state: 'healthy' | 'warning' | 'error' | 'unknown';
}

function StatusDot({ state }: StatusDotProps) {
  return (
    <span className="relative flex h-2.5 w-2.5 shrink-0">
      {state === 'error' && (
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-50" />
      )}

      <span
        className={cn(
          'relative inline-flex h-2.5 w-2.5 rounded-full',
          state === 'healthy' && 'bg-emerald-400',
          state === 'warning' && 'bg-amber-400',
          state === 'error' && 'bg-red-400',
          state === 'unknown' && 'bg-zinc-500',
        )}
      />
    </span>
  );
}

interface StatusCardProps {
  title: string;
  value: string;
  description?: string;
  icon: React.ElementType;
  state: 'healthy' | 'warning' | 'error' | 'unknown';
}

function StatusCard({
  title,
  value,
  description,
  icon: Icon,
  state,
}: StatusCardProps) {
  return (
    <div className="rounded-xl border border-brand-border/30 bg-brand-surface/50 p-3 transition-all hover:border-brand-border/60">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[8px] font-bold uppercase tracking-wider text-brand-text-muted">
          {title}
        </span>

        <Icon
          className={cn(
            'h-3.5 w-3.5',
            state === 'healthy' && 'text-emerald-400',
            state === 'warning' && 'text-amber-400',
            state === 'error' && 'text-red-400',
            state === 'unknown' && 'text-zinc-500',
          )}
        />
      </div>

      <div className="flex items-center gap-2">
        <StatusDot state={state} />

        <p
          className={cn(
            'truncate text-[10px] font-bold uppercase',
            state === 'healthy' && 'text-emerald-400',
            state === 'warning' && 'text-amber-400',
            state === 'error' && 'text-red-400',
            state === 'unknown' && 'text-zinc-500',
          )}
        >
          {value}
        </p>
      </div>

      {description && (
        <p className="mt-1 truncate text-[8px] text-brand-text-muted">
          {description}
        </p>
      )}
    </div>
  );
}

/* ============================================================================
 * MAIN COMPONENT
 * ========================================================================== */

export default function SystemDiagnostics() {
  const navigate = useNavigate();

  const {
    httpLogs,
    clearHttpLogs,
    fetchInitialData,
    restEndpoint,
    masterToken,
  } = useStore();

  const [isOpen, setIsOpen] = useState(false);
  const [isBannerDismissed, setIsBannerDismissed] = useState(false);
  const [isRetrying, setIsRetrying] = useState(false);
  const [search, setSearch] = useState('');
  const [expandedLogId, setExpandedLogId] = useState<string | number | null>(
    null,
  );
  const [copied, setCopied] = useState(false);
  const [lastRetryAt, setLastRetryAt] = useState<number | null>(null);
  const [retryHealthy, setRetryHealthy] = useState<boolean | null>(null);

  /* --------------------------------------------------------------------------
   * NORMALIZE + SORT LOGS
   * ------------------------------------------------------------------------ */

  const normalizedLogs = useMemo<NormalizedLog[]>(() => {
    return httpLogs
      .map(normalizeLog)
      .sort((a, b) => b.timestampMs - a.timestampMs);
  }, [httpLogs]);

  /* --------------------------------------------------------------------------
   * FAILED REQUESTS
   * ------------------------------------------------------------------------ */

  const failedLogs = useMemo(() => {
    return normalizedLogs.filter((log) => log.isFailed);
  }, [normalizedLogs]);

  const pendingLogs = useMemo(() => {
    return normalizedLogs.filter((log) => log.isPending);
  }, [normalizedLogs]);

  /*
   * IMPORTANT:
   *
   * The previous implementation used failedLogs[0] without guaranteeing
   * chronological ordering.
   *
   * normalizedLogs is explicitly sorted newest-first, so this is now
   * reliably the most recent failure.
   */

  const lastError = failedLogs[0] ?? null;

  /* --------------------------------------------------------------------------
   * ERROR CATEGORIES
   * ------------------------------------------------------------------------ */

  const authenticationErrors = useMemo(
    () =>
      failedLogs.filter(
        (log) =>
          log.category === 'authentication' ||
          log.normalizedStatus === 401 ||
          log.normalizedStatus === 403,
      ),
    [failedLogs],
  );

  const networkErrors = useMemo(
    () => failedLogs.filter((log) => log.category === 'network'),
    [failedLogs],
  );

  const serverErrors = useMemo(
    () => failedLogs.filter((log) => log.category === 'server'),
    [failedLogs],
  );

  const timeoutErrors = useMemo(
    () => failedLogs.filter((log) => log.category === 'timeout'),
    [failedLogs],
  );

  /* --------------------------------------------------------------------------
   * CONNECTION STATE
   * ------------------------------------------------------------------------ */

  const connectionState = useMemo<ConnectionState>(() => {
    if (retryHealthy === true) {
      return 'healthy';
    }

    if (networkErrors.length > 0) {
      return 'offline';
    }

    if (serverErrors.length > 0 || timeoutErrors.length > 0) {
      return 'degraded';
    }

    if (failedLogs.length === 0 && normalizedLogs.length > 0) {
      return 'healthy';
    }

    return 'unknown';
  }, [
    retryHealthy,
    networkErrors.length,
    serverErrors.length,
    timeoutErrors.length,
    failedLogs.length,
    normalizedLogs.length,
  ]);

  /* --------------------------------------------------------------------------
   * TOKEN STATE
   *
   * We don't claim "invalid" merely because a token exists.
   *
   * 401 means the server rejected credentials for that request.
   * It does NOT automatically prove that the master token is malformed.
   * ------------------------------------------------------------------------ */

  const tokenState = useMemo(() => {
    if (authenticationErrors.length > 0) {
      return {
        state: 'error' as const,
        label: 'Rejected',
        description:
          authenticationErrors[0]?.normalizedStatus === 403
            ? 'Authorization denied'
            : 'Authentication rejected',
      };
    }

    if (masterToken) {
      return {
        state: 'healthy' as const,
        label: 'Loaded',
        description: 'Credential configured',
      };
    }

    return {
      state: 'warning' as const,
      label: 'Missing',
      description: 'No credential configured',
    };
  }, [authenticationErrors, masterToken]);

  /* --------------------------------------------------------------------------
   * FILTER
   * ------------------------------------------------------------------------ */

  const filteredLogs = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) {
      return normalizedLogs;
    }

    return normalizedLogs.filter((log) => {
      const haystack = [
        log.method,
        log.pathname,
        log.normalizedError,
        String(log.normalizedStatus ?? ''),
        log.page,
        getCategoryLabel(log.category),
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return haystack.includes(query);
    });
  }, [normalizedLogs, search]);

  /* --------------------------------------------------------------------------
   * RETRY
   * ------------------------------------------------------------------------ */

  const handleRetry = useCallback(async () => {
    if (isRetrying) return;

    setIsRetrying(true);
    setRetryHealthy(null);

    toast.info('Testing backend connection…');

    try {
      await fetchInitialData();

      /*
       * fetchInitialData() completing without throwing means the frontend
       * reached the backend/data layer successfully enough for the store
       * operation to complete.
       *
       * It is still not proof that every backend endpoint is healthy.
       */

      setRetryHealthy(true);
      setLastRetryAt(Date.now());

      toast.success('Backend connection test completed');

      /*
       * Bring the banner back if a previous error had been dismissed.
       * The user should be able to see the new state after a retry.
       */
      setIsBannerDismissed(false);
    } catch (error) {
      setRetryHealthy(false);
      setLastRetryAt(Date.now());

      const message =
        error instanceof Error
          ? error.message
          : 'Backend connection test failed';

      toast.error(`Backend test failed: ${message}`);

      setIsBannerDismissed(false);
    } finally {
      setIsRetrying(false);
    }
  }, [fetchInitialData, isRetrying]);

  /* --------------------------------------------------------------------------
   * COPY DIAGNOSTIC INFORMATION
   * ------------------------------------------------------------------------ */

  const handleCopyDiagnostics = useCallback(async () => {
    const payload = {
      endpoint: restEndpoint || null,
      requests: normalizedLogs.length,
      failures: failedLogs.length,
      networkErrors: networkErrors.length,
      authenticationErrors: authenticationErrors.length,
      serverErrors: serverErrors.length,
      timeoutErrors: timeoutErrors.length,
      connectionState,
      lastError: lastError
        ? {
            method: lastError.method,
            status: lastError.normalizedStatus,
            path: lastError.pathname,
            error: lastError.normalizedError,
            category: lastError.category,
            timestamp: lastError.timestamp,
          }
        : null,
      generatedAt: new Date().toISOString(),
    };

    try {
      await navigator.clipboard.writeText(
        JSON.stringify(payload, null, 2),
      );

      setCopied(true);

      toast.success('Diagnostic report copied');

      window.setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {
      toast.error('Unable to copy diagnostics');
    }
  }, [
    restEndpoint,
    normalizedLogs.length,
    failedLogs.length,
    networkErrors.length,
    authenticationErrors.length,
    serverErrors.length,
    timeoutErrors.length,
    connectionState,
    lastError,
  ]);

  /* --------------------------------------------------------------------------
   * CLEAR
   * ------------------------------------------------------------------------ */

  const handleClear = useCallback(() => {
    clearHttpLogs();
    setSearch('');
    setExpandedLogId(null);
    setRetryHealthy(null);
    setIsBannerDismissed(false);

    toast.success('HTTP diagnostics cleared');
  }, [clearHttpLogs]);

  /* --------------------------------------------------------------------------
   * RESET BANNER WHEN NEW FAILURE APPEARS
   * ------------------------------------------------------------------------ */

  useEffect(() => {
    if (failedLogs.length > 0) {
      setIsBannerDismissed(false);
    }
  }, [failedLogs.length]);

  /* --------------------------------------------------------------------------
   * DON'T RENDER IF THERE IS ABSOLUTELY NOTHING TO DIAGNOSE
   * ------------------------------------------------------------------------ */

  if (httpLogs.length === 0) {
    return null;
  }

  /* --------------------------------------------------------------------------
   * PRESENTATION HELPERS
   * ------------------------------------------------------------------------ */

  const hasFailures = failedLogs.length > 0;

  const primaryProblem = lastError
    ? {
        title:
          lastError.category === 'network'
            ? 'Backend unreachable'
            : lastError.category === 'authentication'
              ? 'Authentication rejected'
              : lastError.category === 'server'
                ? 'Backend returned an error'
                : lastError.category === 'timeout'
                  ? 'Backend request timed out'
                  : 'API request failed',

        description:
          lastError.category === 'network'
            ? `The browser could not establish a connection to ${restEndpoint || 'the backend'}.`
            : lastError.category === 'authentication'
              ? `The backend rejected credentials for ${lastError.pathname || 'the requested endpoint'}.`
              : lastError.category === 'server'
                ? `The backend responded with HTTP ${lastError.normalizedStatus}.`
                : lastError.category === 'timeout'
                  ? 'The backend did not respond within the expected time.'
                  : `The API returned ${getStatusLabel(lastError.normalizedStatus)}.`,
      }
    : null;

  return (
    <div className="w-full font-mono">
      {/* ======================================================================
       * WARNING BANNER
       * ==================================================================== */}

      <AnimatePresence initial={false}>
        {hasFailures && !isBannerDismissed && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="relative overflow-hidden border-b border-red-500/20 bg-red-500/[0.04] px-5 py-2.5 text-red-400"
          >
            <div className="pointer-events-none absolute right-0 top-0 h-full w-64 bg-red-500/[0.04] blur-3xl" />

            <div className="relative z-10 flex min-w-0 items-center justify-between gap-4">
              <div className="flex min-w-0 flex-1 items-center gap-2.5">
                <div className="relative shrink-0">
                  <AlertTriangle className="h-4 w-4 animate-pulse" />
                </div>

                <div className="min-w-0 truncate text-[10px]">
                  <span className="font-bold uppercase tracking-wide">
                    {primaryProblem?.title || 'API failure'}:
                  </span>{' '}

                  <span className="text-red-300/80">
                    {lastError?.pathname || restEndpoint || 'backend'}
                  </span>

                  {lastError?.normalizedStatus !== null &&
                    lastError?.normalizedStatus !== undefined && (
                      <>
                        {' '}
                        <span className="rounded bg-red-500/10 px-1.5 py-0.5 font-bold">
                          HTTP {lastError.normalizedStatus}
                        </span>
                      </>
                    )}
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsOpen(true)}
                  className="rounded-lg border border-red-500/20 bg-red-500/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-red-400 transition-all hover:bg-red-500/20"
                >
                  Inspect ({failedLogs.length})
                </button>

                <button
                  type="button"
                  onClick={() => setIsBannerDismissed(true)}
                  aria-label="Dismiss diagnostics warning"
                  className="rounded p-0.5 text-red-400/50 transition-colors hover:text-red-400"
                >
                  <XCircle className="h-3.5 w-3.5" />
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ======================================================================
       * DISMISSED WARNING TRIGGER
       * ==================================================================== */}

      <AnimatePresence>
        {hasFailures && isBannerDismissed && (
          <motion.button
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            type="button"
            onClick={() => setIsOpen(true)}
            className="fixed bottom-20 left-6 z-50 flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-red-400 shadow-lg backdrop-blur-sm transition-all hover:bg-red-500/20"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-60" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-red-400" />
            </span>

            {failedLogs.length} Warning
            {failedLogs.length === 1 ? '' : 's'}
          </motion.button>
        )}
      </AnimatePresence>

      {/* ======================================================================
       * DIAGNOSTICS DRAWER
       * ==================================================================== */}

      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.18 }}
              onClick={() => setIsOpen(false)}
              className="fixed inset-0 z-[100] bg-black/70 backdrop-blur-sm"
            />

            {/* Drawer */}
            <motion.aside
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{
                type: 'spring',
                damping: 30,
                stiffness: 240,
              }}
              role="dialog"
              aria-modal="true"
              aria-label="System diagnostics"
              className="fixed right-0 top-0 bottom-0 z-[101] flex w-full max-w-2xl flex-col overflow-hidden border-l border-brand-border/50 bg-brand-surface shadow-2xl"
            >
              {/* ==============================================================
               * HEADER
               * ============================================================ */}

              <header className="shrink-0 border-b border-brand-border/30 bg-brand-elevated/10">
                <div className="flex items-center justify-between gap-4 p-5">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="rounded-xl border border-brand-primary/20 bg-brand-primary/10 p-2.5">
                      <Activity className="h-4 w-4 text-brand-primary" />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-xs font-bold uppercase tracking-wider text-white">
                          System Diagnostics
                        </h2>

                        {connectionState === 'healthy' && (
                          <span className="rounded-full bg-emerald-500/10 px-1.5 py-0.5 text-[7px] font-bold uppercase text-emerald-400">
                            Healthy
                          </span>
                        )}

                        {connectionState === 'offline' && (
                          <span className="rounded-full bg-red-500/10 px-1.5 py-0.5 text-[7px] font-bold uppercase text-red-400">
                            Offline
                          </span>
                        )}

                        {connectionState === 'degraded' && (
                          <span className="rounded-full bg-amber-500/10 px-1.5 py-0.5 text-[7px] font-bold uppercase text-amber-400">
                            Degraded
                          </span>
                        )}
                      </div>

                      <p className="mt-0.5 text-[9px] text-brand-text-muted">
                        {normalizedLogs.length} HTTP request
                        {normalizedLogs.length === 1 ? '' : 's'} tracked
                        {lastRetryAt
                          ? ` · Last test ${safeTime(lastRetryAt)}`
                          : ''}
                      </p>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    aria-label="Close diagnostics"
                    className="rounded-lg p-1.5 text-brand-text-muted transition-colors hover:bg-brand-elevated hover:text-white"
                  >
                    <XCircle className="h-4 w-4" />
                  </button>
                </div>

                {/* ============================================================
                 * ENDPOINT STRIP
                 * ========================================================== */}

                <div className="flex items-center gap-2 border-t border-brand-border/20 px-5 py-2.5">
                  <Globe className="h-3 w-3 shrink-0 text-brand-text-muted" />

                  <span className="truncate text-[9px] text-brand-text-muted">
                    Backend:
                  </span>

                  <code className="truncate rounded bg-brand-elevated/50 px-1.5 py-0.5 text-[9px] text-brand-primary">
                    {restEndpoint || 'Not configured'}
                  </code>

                  {restEndpoint && (
                    <button
                      type="button"
                      onClick={() => {
                        try {
                          window.open(restEndpoint, '_blank', 'noopener,noreferrer');
                        } catch {
                          toast.error('Unable to open backend endpoint');
                        }
                      }}
                      className="ml-auto shrink-0 text-brand-text-muted transition-colors hover:text-brand-primary"
                      aria-label="Open backend endpoint"
                    >
                      <ExternalLink className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </header>

              {/* ==============================================================
               * STATUS CARDS
               * ============================================================ */}

              <section className="grid shrink-0 grid-cols-2 gap-2 border-b border-brand-border/30 bg-brand-bg/30 p-4 sm:grid-cols-4">
                <StatusCard
                  title="Network"
                  value={
                    connectionState === 'healthy'
                      ? 'Active'
                      : connectionState === 'offline'
                        ? 'Offline'
                        : connectionState === 'degraded'
                          ? 'Degraded'
                          : 'Unknown'
                  }
                  description={`${networkErrors.length} network error${networkErrors.length === 1 ? '' : 's'}`}
                  icon={Wifi}
                  state={
                    connectionState === 'healthy'
                      ? 'healthy'
                      : connectionState === 'offline'
                        ? 'error'
                        : connectionState === 'degraded'
                          ? 'warning'
                          : 'unknown'
                  }
                />

                <StatusCard
                  title="Credentials"
                  value={tokenState.label}
                  description={tokenState.description}
                  icon={Key}
                  state={tokenState.state}
                />

                <StatusCard
                  title="Backend"
                  value={
                    serverErrors.length > 0
                      ? 'Errors'
                      : timeoutErrors.length > 0
                        ? 'Slow'
                        : 'Responsive'
                  }
                  description={`${serverErrors.length} server error${serverErrors.length === 1 ? '' : 's'}`}
                  icon={Server}
                  state={
                    serverErrors.length > 0
                      ? 'error'
                      : timeoutErrors.length > 0
                        ? 'warning'
                        : 'healthy'
                  }
                />

                <StatusCard
                  title="Failures"
                  value={String(failedLogs.length)}
                  description={`${pendingLogs.length} pending request${pendingLogs.length === 1 ? '' : 's'}`}
                  icon={AlertTriangle}
                  state={
                    failedLogs.length === 0
                      ? 'healthy'
                      : failedLogs.length < 3
                        ? 'warning'
                        : 'error'
                  }
                />
              </section>

              {/* ==============================================================
               * PRIMARY DIAGNOSTIC
               * ============================================================ */}

              {primaryProblem && (
                <section className="shrink-0 border-b border-brand-border/30 bg-red-500/[0.025] px-4 py-3">
                  <div className="flex items-start gap-2.5">
                    <div className="mt-0.5 rounded-lg bg-red-500/10 p-1.5">
                      <ShieldAlert className="h-3.5 w-3.5 text-red-400" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <p className="text-[9px] font-bold uppercase tracking-wider text-red-400">
                        Primary diagnostic
                      </p>

                      <p className="mt-1 text-[10px] font-semibold text-white">
                        {primaryProblem.title}
                      </p>

                      <p className="mt-1 text-[9px] leading-relaxed text-brand-text-muted">
                        {primaryProblem.description}
                      </p>

                      {lastError?.normalizedError && (
                        <div className="mt-2 rounded-lg border border-red-500/10 bg-black/20 p-2 text-[9px] leading-relaxed text-red-300">
                          {lastError.normalizedError}
                        </div>
                      )}
                    </div>
                  </div>
                </section>
              )}

              {/* ==============================================================
               * TROUBLESHOOTING
               * ============================================================ */}

              {hasFailures && (
                <section className="shrink-0 border-b border-brand-border/30 px-4 py-3">
                  <div className="mb-2 flex items-center gap-1.5">
                    <HelpCircle className="h-3 w-3 text-brand-primary" />

                    <p className="text-[9px] font-bold uppercase tracking-wider text-brand-primary">
                      Troubleshooting
                    </p>
                  </div>

                  <div className="space-y-1.5 text-[9px] leading-relaxed text-brand-text-muted">
                    {networkErrors.length > 0 && (
                      <div className="flex gap-2">
                        <span className="text-red-400">•</span>
                        <span>
                          <strong className="text-white">Network:</strong>{' '}
                          The browser could not reach the configured backend.
                          Check Render/server availability, DNS, TLS, CORS, or
                          the configured REST endpoint.
                        </span>
                      </div>
                    )}

                    {authenticationErrors.length > 0 && (
                      <div className="flex gap-2">
                        <span className="text-red-400">•</span>
                        <span>
                          <strong className="text-white">
                            Authentication:
                          </strong>{' '}
                          The backend rejected credentials. Verify the token
                          and the backend authentication middleware.
                        </span>
                      </div>
                    )}

                    {serverErrors.length > 0 && (
                      <div className="flex gap-2">
                        <span className="text-red-400">•</span>
                        <span>
                          <strong className="text-white">Backend:</strong>{' '}
                          The server was reachable but returned a 5xx error.
                          Inspect backend logs before changing frontend
                          configuration.
                        </span>
                      </div>
                    )}

                    {timeoutErrors.length > 0 && (
                      <div className="flex gap-2">
                        <span className="text-amber-400">•</span>
                        <span>
                          <strong className="text-white">Timeout:</strong>{' '}
                          The request did not complete within the expected
                          window. Investigate slow queries, cold starts,
                          upstream APIs, or worker saturation.
                        </span>
                      </div>
                    )}

                    {authenticationErrors.length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          setIsOpen(false);
                          navigate('/settings');
                        }}
                        className="mt-1 inline-flex items-center gap-1 text-[9px] font-bold text-brand-primary hover:underline"
                      >
                        <SettingsIcon className="h-3 w-3" />
                        Open Settings
                      </button>
                    )}
                  </div>
                </section>
              )}

              {/* ==============================================================
               * TOOLBAR
               * ============================================================ */}

              <section className="flex shrink-0 flex-col gap-2 border-b border-brand-border/30 bg-brand-elevated/5 px-4 py-2.5 sm:flex-row sm:items-center sm:justify-between">
                <div className="relative min-w-0 flex-1">
                  <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-brand-text-muted" />

                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Filter requests, paths, errors..."
                    className="w-full rounded-lg border border-brand-border/40 bg-brand-surface/70 py-1.5 pl-8 pr-3 text-[9px] text-white outline-none transition-colors placeholder:text-brand-text-muted focus:border-brand-primary/40"
                  />
                </div>

                <div className="flex shrink-0 items-center gap-1.5">
                  <button
                    type="button"
                    onClick={handleRetry}
                    disabled={isRetrying}
                    className={cn(
                      'flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider transition-all',
                      isRetrying
                        ? 'cursor-not-allowed border-brand-border/30 bg-brand-surface/40 text-brand-text-muted'
                        : 'border-brand-border/50 bg-brand-surface text-brand-text-muted hover:border-brand-primary/30 hover:text-white',
                    )}
                  >
                    <RefreshCw
                      className={cn(
                        'h-3 w-3',
                        isRetrying && 'animate-spin',
                      )}
                    />
                    {isRetrying ? 'Testing' : 'Retry'}
                  </button>

                  <button
                    type="button"
                    onClick={handleCopyDiagnostics}
                    className="flex items-center gap-1.5 rounded-lg border border-brand-border/50 bg-brand-surface px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-brand-text-muted transition-all hover:border-brand-primary/30 hover:text-white"
                  >
                    {copied ? (
                      <Check className="h-3 w-3 text-emerald-400" />
                    ) : (
                      <Copy className="h-3 w-3" />
                    )}
                    {copied ? 'Copied' : 'Report'}
                  </button>

                  <button
                    type="button"
                    onClick={handleClear}
                    className="flex items-center gap-1.5 rounded-lg border border-brand-border/50 bg-brand-surface px-3 py-1.5 text-[9px] font-bold uppercase tracking-wider text-brand-text-muted transition-all hover:border-red-500/30 hover:text-red-400"
                  >
                    <Trash2 className="h-3 w-3" />
                    Clear
                  </button>
                </div>
              </section>

              {/* ==============================================================
               * RESULT SUMMARY
               * ============================================================ */}

              <div className="flex shrink-0 items-center justify-between border-b border-brand-border/20 px-4 py-2">
                <div className="flex items-center gap-3 text-[8px] uppercase tracking-wider text-brand-text-muted">
                  <span>
                    Showing {filteredLogs.length}/{normalizedLogs.length}
                  </span>

                  {failedLogs.length > 0 && (
                    <span className="text-red-400">
                      {failedLogs.length} failed
                    </span>
                  )}

                  {pendingLogs.length > 0 && (
                    <span className="text-amber-400">
                      {pendingLogs.length} pending
                    </span>
                  )}
                </div>

                {retryHealthy === true && (
                  <div className="flex items-center gap-1 text-[8px] font-bold uppercase text-emerald-400">
                    <CheckCircle className="h-3 w-3" />
                    Connection test passed
                  </div>
                )}

                {retryHealthy === false && (
                  <div className="flex items-center gap-1 text-[8px] font-bold uppercase text-red-400">
                    <XCircle className="h-3 w-3" />
                    Connection test failed
                  </div>
                )}
              </div>

              {/* ==============================================================
               * LOG LIST
               * ============================================================ */}

              <div className="min-h-0 flex-1 overflow-y-auto p-3">
                {filteredLogs.length === 0 ? (
                  <div className="flex h-full min-h-40 flex-col items-center justify-center text-center">
                    <Search className="mb-2 h-5 w-5 text-brand-text-muted" />

                    <p className="text-[10px] font-bold uppercase text-brand-text-muted">
                      No matching requests
                    </p>

                    <button
                      type="button"
                      onClick={() => setSearch('')}
                      className="mt-2 text-[9px] font-bold text-brand-primary hover:underline"
                    >
                      Clear filter
                    </button>
                  </div>
                ) : (
                  <div className="space-y-1.5">
                    {filteredLogs.map((log, index) => {
                      const isExpanded = expandedLogId === log.id;
                      const CategoryIcon = getCategoryIcon(log.category);

                      /*
                       * A defensive fallback key prevents React warnings
                       * if an upstream logger accidentally creates duplicate
                       * or missing IDs.
                       */
                      const stableKey =
                        log.id !== undefined && log.id !== null
                          ? String(log.id)
                          : `${log.timestamp}-${log.method}-${log.url}-${index}`;

                      return (
                        <motion.div
                          key={stableKey}
                          initial={false}
                          className={cn(
                            'overflow-hidden rounded-xl border transition-all',
                            log.isFailed
                              ? 'border-red-500/20 bg-red-500/[0.035]'
                              : log.isPending
                                ? 'border-amber-500/20 bg-amber-500/[0.035]'
                                : 'border-brand-border/30 bg-brand-surface/30',
                          )}
                        >
                          {/* ==================================================
                           * LOG SUMMARY
                           * ================================================ */}

                          <button
                            type="button"
                            onClick={() =>
                              setExpandedLogId(
                                isExpanded ? null : log.id,
                              )
                            }
                            className="w-full p-3 text-left transition-colors hover:bg-brand-elevated/10"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0 flex-1">
                                <div className="mb-1.5 flex flex-wrap items-center gap-1.5">
                                  {/* Method */}
                                  <span
                                    className={cn(
                                      'rounded px-1.5 py-0.5 text-[8px] font-bold uppercase',
                                      log.method === 'GET' &&
                                        'bg-sky-500/15 text-sky-400',
                                      log.method === 'POST' &&
                                        'bg-emerald-500/15 text-emerald-400',
                                      log.method === 'PUT' &&
                                        'bg-amber-500/15 text-amber-400',
                                      log.method === 'PATCH' &&
                                        'bg-orange-500/15 text-orange-400',
                                      log.method === 'DELETE' &&
                                        'bg-red-500/15 text-red-400',
                                      ![
                                        'GET',
                                        'POST',
                                        'PUT',
                                        'PATCH',
                                        'DELETE',
                                      ].includes(log.method) &&
                                        'bg-zinc-500/15 text-zinc-400',
                                    )}
                                  >
                                    {log.method || 'HTTP'}
                                  </span>

                                  {/* Status */}
                                  <span
                                    className={cn(
                                      'rounded px-1.5 py-0.5 text-[8px] font-bold',
                                      log.isFailed &&
                                        'bg-red-500/15 text-red-400',
                                      log.isPending &&
                                        'bg-amber-500/15 text-amber-400',
                                      !log.isFailed &&
                                        !log.isPending &&
                                        'bg-emerald-500/15 text-emerald-400',
                                    )}
                                  >
                                    {log.normalizedStatus ?? '...'}
                                  </span>

                                  {/* Category */}
                                  {log.isFailed && (
                                    <span className="flex items-center gap-1 rounded bg-brand-elevated/50 px-1.5 py-0.5 text-[7px] font-bold uppercase text-brand-text-muted">
                                      <CategoryIcon className="h-2.5 w-2.5" />
                                      {getCategoryLabel(log.category)}
                                    </span>
                                  )}
                                </div>

                                <p className="truncate text-[10px] font-medium text-white/85">
                                  {log.pathname || log.url || 'Unknown endpoint'}
                                </p>

                                <div className="mt-1 flex min-w-0 items-center gap-2 text-[8px] text-brand-text-muted">
                                  <span>{safeTime(log.timestamp)}</span>

                                  {log.page && (
                                    <>
                                      <span>•</span>

                                      <span className="truncate">
                                        {log.page === '/'
                                          ? '/dashboard'
                                          : log.page}
                                      </span>
                                    </>
                                  )}
                                </div>
                              </div>

                              <div className="flex shrink-0 items-center gap-2">
                                {log.isFailed ? (
                                  <XCircle className="h-3.5 w-3.5 text-red-400" />
                                ) : log.isPending ? (
                                  <Clock3 className="h-3.5 w-3.5 animate-pulse text-amber-400" />
                                ) : (
                                  <CheckCircle className="h-3.5 w-3.5 text-emerald-400" />
                                )}

                                <ChevronDown
                                  className={cn(
                                    'h-3.5 w-3.5 text-brand-text-muted transition-transform',
                                    isExpanded && 'rotate-180',
                                  )}
                                />
                              </div>
                            </div>
                          </button>

                          {/* ==================================================
                           * EXPANDED DETAILS
                           * ================================================ */}

                          <AnimatePresence initial={false}>
                            {isExpanded && (
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                className="border-t border-brand-border/20"
                              >
                                <div className="space-y-2.5 p-3">
                                  {/* Endpoint */}
                                  <div>
                                    <p className="mb-1 text-[7px] font-bold uppercase tracking-wider text-brand-text-muted">
                                      Endpoint
                                    </p>

                                    <code className="block break-all rounded-lg bg-black/20 p-2 text-[9px] text-brand-primary">
                                      {log.url || 'Unknown'}
                                    </code>
                                  </div>

                                  {/* Status */}
                                  <div className="grid grid-cols-2 gap-2">
                                    <div className="rounded-lg border border-brand-border/20 bg-black/10 p-2">
                                      <p className="text-[7px] uppercase text-brand-text-muted">
                                        Status
                                      </p>

                                      <p
                                        className={cn(
                                          'mt-1 text-[9px] font-bold',
                                          log.isFailed
                                            ? 'text-red-400'
                                            : log.isPending
                                              ? 'text-amber-400'
                                              : 'text-emerald-400',
                                        )}
                                      >
                                        {log.normalizedStatus ??
                                          'Pending'}
                                      </p>
                                    </div>

                                    <div className="rounded-lg border border-brand-border/20 bg-black/10 p-2">
                                      <p className="text-[7px] uppercase text-brand-text-muted">
                                        Classification
                                      </p>

                                      <p className="mt-1 text-[9px] font-bold text-white">
                                        {log.isFailed
                                          ? getCategoryLabel(log.category)
                                          : getStatusLabel(
                                              log.normalizedStatus,
                                            )}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Error */}
                                  {log.normalizedError && (
                                    <div>
                                      <p className="mb-1 text-[7px] font-bold uppercase tracking-wider text-red-400">
                                        Error
                                      </p>

                                      <div className="flex items-start gap-2 rounded-lg border border-red-500/10 bg-red-500/[0.035] p-2">
                                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-red-400" />

                                        <p className="break-all text-[9px] leading-relaxed text-red-300">
                                          {log.normalizedError}
                                        </p>
                                      </div>
                                    </div>
                                  )}

                                  {/* Page */}
                                  {log.page && (
                                    <div>
                                      <p className="mb-1 text-[7px] font-bold uppercase tracking-wider text-brand-text-muted">
                                        Origin Page
                                      </p>

                                      <code className="block rounded-lg bg-black/20 p-2 text-[9px] text-white/70">
                                        {log.page}
                                      </code>
                                    </div>
                                  )}

                                  {/* Timestamp */}
                                  <div>
                                    <p className="mb-1 text-[7px] font-bold uppercase tracking-wider text-brand-text-muted">
                                      Timestamp
                                    </p>

                                    <code className="block rounded-lg bg-black/20 p-2 text-[9px] text-white/70">
                                      {log.timestamp
                                        ? String(log.timestamp)
                                        : 'Unknown'}
                                    </code>
                                  </div>
                                </div>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </motion.div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* ==============================================================
               * FOOTER
               * ============================================================ */}

              <footer className="shrink-0 border-t border-brand-border/30 bg-brand-elevated/5 px-4 py-2.5">
                <div className="flex items-center justify-between gap-3 text-[8px] text-brand-text-muted">
                  <div className="flex min-w-0 items-center gap-2">
                    <Radio className="h-3 w-3 shrink-0" />

                    <span className="truncate">
                      Diagnostics monitor frontend HTTP activity. It does not
                      replace backend logs.
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => {
                      setSearch('');
                      setExpandedLogId(null);
                    }}
                    className="flex shrink-0 items-center gap-1 text-brand-text-muted hover:text-white"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </button>
                </div>
              </footer>
            </motion.aside>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
