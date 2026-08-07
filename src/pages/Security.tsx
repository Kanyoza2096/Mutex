import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { 
  ShieldAlert, Bug, Activity, AlertTriangle, FileText, RefreshCw, 
  Play, Check, Server, Clock, Link, Search, Filter, ChevronDown,
  Shield, Zap, Eye, ExternalLink, Copy, TrendingUp, TrendingDown,
  Wifi, WifiOff, Radio
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────────

interface GuardianStatus {
  configured?: boolean; last_scan_at?: string; total_findings?: number;
  critical?: number; high?: number; medium?: number; low?: number;
  last_scan?: string; issues?: any[];
}

interface GuardianIssue {
  id: string; title: string; severity: string; repo?: string; status?: string;
}

interface AuditLogEntry {
  id: string; action?: string; user?: string; resource?: string;
  status?: string; created_at?: string; timestamp?: string;
}

interface SystemHealthEntry {
  status?: string; latency_ms?: number; ok?: boolean; page_name?: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const SEVERITY_CONFIG: Record<string, { color: string; bg: string; border: string; icon: React.ComponentType<any> }> = {
  critical: { color: 'text-red-400',   bg: 'bg-red-500/10',   border: 'border-red-500/30',   icon: Bug },
  high:     { color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/30', icon: AlertTriangle },
  medium:   { color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/30',  icon: AlertTriangle },
  low:      { color: 'text-zinc-400',   bg: 'bg-zinc-500/10',   border: 'border-zinc-500/30',   icon: Activity },
};

// ── Security score gauge ───────────────────────────────────────────────────

function ScoreGauge({ score, label, lastScan }: { score: number; label: string; lastScan?: string }) {
  const circumference = 2 * Math.PI * 42;
  const dashArray = `${(score / 100) * circumference} ${circumference}`;
  const color = score > 80 ? '#34d399' : score > 60 ? '#f59e0b' : '#ef4444';
  const grade = score > 90 ? 'A' : score > 80 ? 'B' : score > 65 ? 'C' : score > 50 ? 'D' : 'F';

  return (
    <div className="flex items-center gap-5">
      <div className="relative w-24 h-24 flex items-center justify-center flex-shrink-0">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="42" fill="none" stroke="#27272a" strokeWidth="6" />
          <circle cx="50" cy="50" r="42" fill="none" stroke={color} strokeWidth="6"
            strokeLinecap="round" strokeDasharray={dashArray}
            className="transition-all duration-1000 ease-out" />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl font-bold" style={{ color }}>{grade}</span>
          <span className="text-[9px] text-brand-text-muted font-mono">{score}%</span>
        </div>
      </div>
      <div>
        <p className="text-[10px] text-brand-text-muted font-mono uppercase tracking-wider">{label}</p>
        <p className="text-sm font-bold text-white mt-0.5">{score > 80 ? 'Strong' : score > 60 ? 'Fair' : 'At Risk'}</p>
        {lastScan && <p className="text-[9px] text-brand-text-muted font-mono mt-1">Last scan: {lastScan}</p>}
      </div>
    </div>
  );
}

// ── Stat card ──────────────────────────────────────────────────────────────

function StatCard({ label, value, icon: Icon, color, subtitle }: {
  label: string; value: string | number; icon: React.ComponentType<any>; color: string; subtitle?: string;
}) {
  return (
    <div className="bg-brand-surface/50 border border-brand-border/50 rounded-2xl p-4 hover:border-brand-border transition-colors">
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted">{label}</span>
        <Icon className={cn('w-4 h-4', color)} />
      </div>
      <div className={cn('text-2xl font-mono font-bold', color)}>{value}</div>
      {subtitle && <p className="text-[10px] text-brand-text-muted mt-1 font-mono">{subtitle}</p>}
    </div>
  );
}

// ── Skeleton ───────────────────────────────────────────────────────────────

const SkeletonBlock = ({ height = 'h-28' }: { height?: string }) => (
  <div className={cn('bg-brand-surface/50 border border-brand-border/50 rounded-2xl animate-pulse', height)} />
);

// ═══════════════════════════════════════════════════════════════════════════

export default function Security() {
  const { restEndpoint, masterToken } = useStore();

  const [status, setStatus] = useState<GuardianStatus | null>(null);
  const [issues, setIssues] = useState<GuardianIssue[]>([]);
  const [logs, setLogs] = useState<AuditLogEntry[]>([]);
  const [systemHealth, setSystemHealth] = useState<Record<string, SystemHealthEntry>>({});
  const [connectors, setConnectors] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [scanning, setScanning] = useState(false);
  const [severityFilter, setSeverityFilter] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [auditSearch, setAuditSearch] = useState('');

  const headers: Record<string, string> = masterToken ? { Authorization: `Bearer ${masterToken}` } : {};
  const base = restEndpoint.replace(/\/+$/, '');

  const fetchAll = async () => {
    setLoading(true);
    try {
      const [statusRes, issuesRes, logsRes, healthRes, connRes] = await Promise.all([
        fetch(`${base}/guardian/status`, { headers }),
        fetch(`${base}/guardian/issues${severityFilter ? `?severity=${severityFilter}` : ''}`, { headers }),
        fetch(`${base}/audit-logs?limit=100`, { headers }),
        fetch(`${base}/system/health`, { headers }),
        fetch(`${base}/system/connectors`, { headers }),
      ]);
      if (statusRes.ok) setStatus(await statusRes.json());
      if (issuesRes.ok) { const d = await issuesRes.json(); setIssues(d.issues || []); }
      if (logsRes.ok) { const d = await logsRes.json(); setLogs(d.logs || []); }
      if (healthRes.ok) { const d = await healthRes.json(); setSystemHealth(d.connectors || d.services || {}); }
      if (connRes.ok) { const d = await connRes.json(); setConnectors(d.supported_connectors || []); }
    } catch {
      toast.error('Failed to load security data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchAll(); }, [restEndpoint, severityFilter]);

  const handleScan = async () => {
    setScanning(true);
    try {
      const res = await fetch(`${base}/guardian/scan`, { method: 'POST', headers });
      const d = await res.json();
      toast.success(d.message || 'Scan started');
      setTimeout(fetchAll, 3000);
    } catch (err: any) {
      toast.error(err.message || 'Scan failed');
    } finally {
      setScanning(false);
    }
  };

  // ── Derived data ─────────────────────────────────────────────────────────

  const total = status?.total_findings ?? issues.length;
  const critical = status?.critical ?? issues.filter(i => i.severity === 'critical').length;
  const high = status?.high ?? issues.filter(i => i.severity === 'high').length;
  const score = Math.max(0, 100 - critical * 15 - high * 8 - Math.max(0, total - critical - high) * 2);

  const healthServices = Object.entries(systemHealth);
  const onlineHealth = healthServices.filter(([_, s]) => s.status === 'healthy' || s.status === 'ok').length;

  const filteredLogs = useMemo(() => {
    let result = [...logs];
    if (auditActionFilter) result = result.filter(l => (l.action || '').toLowerCase().includes(auditActionFilter.toLowerCase()));
    if (auditSearch.trim()) {
      const q = auditSearch.toLowerCase();
      result = result.filter(l => 
        (l.action || '').toLowerCase().includes(q) ||
        (l.user || '').toLowerCase().includes(q) ||
        (l.resource || '').toLowerCase().includes(q)
      );
    }
    return result;
  }, [logs, auditActionFilter, auditSearch]);

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-20 md:pb-0">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
            <ShieldAlert className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Security Center</h1>
            <p className="text-[10px] text-brand-text-muted font-mono uppercase tracking-wider mt-0.5">
              Guardian · Audit Trail · System Health
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={fetchAll} className="p-2.5 rounded-xl bg-brand-surface border border-brand-border hover:border-brand-primary/30 text-brand-text-muted hover:text-white transition-all">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={handleScan} disabled={scanning}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-brand-primary text-white text-xs font-bold font-mono uppercase tracking-wider hover:bg-brand-primary/90 transition-all shadow-glow-primary disabled:opacity-50">
            {scanning ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
            {scanning ? 'Scanning…' : 'Run Guardian Scan'}
          </motion.button>
        </div>
      </div>

      {/* Score + Stats */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {[1,2,3,4].map(i => <SkeletonBlock key={i} />)}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="md:col-span-1 bg-brand-surface border border-brand-border/50 rounded-2xl p-5 flex items-center">
            <ScoreGauge score={score} label="Security Grade" lastScan={status?.last_scan} />
          </div>
          <StatCard label="Critical" value={critical} icon={Bug} color="text-red-400" subtitle="Requires immediate action" />
          <StatCard label="Total Issues" value={total} icon={AlertTriangle} color="text-amber-400" subtitle={`${high} high · ${total - critical - high} other`} />
          <StatCard label="Guardian" value={status?.configured ? 'Active' : 'Inactive'} icon={Shield}
            color={status?.configured ? 'text-emerald-400' : 'text-zinc-400'}
            subtitle={status?.configured ? 'Monitoring enabled' : 'Not configured'} />
        </div>
      )}

      {/* System Health + Connectors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Health */}
        <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted flex items-center gap-2">
              <Radio className="w-3.5 h-3.5 text-emerald-400" /> System Health
            </h2>
            <span className="text-[9px] font-mono text-brand-text-muted">{onlineHealth}/{healthServices.length} online</span>
          </div>
          {healthServices.length === 0 ? (
            <p className="text-xs text-brand-text-muted font-mono py-4 text-center">No health data</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {healthServices.map(([name, svc]) => (
                <div key={name} className="flex items-center justify-between p-2.5 rounded-xl bg-brand-elevated/30 border border-brand-border/30">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-white truncate">{svc.page_name || name}</p>
                    {svc.latency_ms !== undefined && <p className="text-[9px] font-mono text-brand-text-muted">{svc.latency_ms}ms</p>}
                  </div>
                  <div className={cn(
                    'px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase flex-shrink-0',
                    svc.status === 'healthy' || svc.status === 'ok' ? 'bg-emerald-500/10 text-emerald-400' :
                    svc.status === 'degraded' ? 'bg-amber-500/10 text-amber-400' : 'bg-red-500/10 text-red-400'
                  )}>
                    {svc.status || 'unknown'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Connectors */}
        <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-4">
          <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted mb-3 flex items-center gap-2">
            <Link className="w-3.5 h-3.5 text-brand-primary" /> Platform Connectors
          </h2>
          {connectors.length === 0 ? (
            <p className="text-xs text-brand-text-muted font-mono py-4 text-center">No connectors registered</p>
          ) : (
            <div className="grid grid-cols-2 gap-2">
              {connectors.map((name, i) => (
                <div key={i} className="flex items-center gap-2 p-2.5 rounded-xl bg-brand-elevated/30 border border-brand-border/30">
                  <div className="w-2 h-2 rounded-full bg-emerald-400 flex-shrink-0" />
                  <span className="text-xs font-bold text-white capitalize">{name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Guardian Findings */}
      <div className="bg-brand-surface border border-brand-border/50 rounded-2xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-3 border-b border-brand-border/30 bg-brand-elevated/10">
          <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted flex items-center gap-2">
            <Bug className="w-3.5 h-3.5 text-red-400" /> Guardian Findings
          </h2>
          <select value={severityFilter} onChange={e => setSeverityFilter(e.target.value)}
            className="bg-brand-elevated border border-brand-border/50 rounded-lg px-2.5 py-1.5 text-[10px] font-mono text-brand-text focus:outline-none focus:border-brand-primary/50">
            <option value="">All Severities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-brand-border/30 text-[9px] font-mono font-bold text-brand-text-muted uppercase tracking-widest">
                <th className="py-2.5 px-4">Issue</th>
                <th className="py-2.5 px-4 hidden md:table-cell">Repo</th>
                <th className="py-2.5 px-4">Severity</th>
                <th className="py-2.5 px-4 hidden sm:table-cell">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/20">
              {issues.map(issue => {
                const sev = SEVERITY_CONFIG[issue.severity] || SEVERITY_CONFIG.low;
                const SevIcon = sev.icon;
                return (
                  <tr key={issue.id} className="hover:bg-brand-elevated/20 transition-colors group">
                    <td className="py-3 px-4">
                      <p className="text-xs font-bold text-white">{issue.title || 'Untitled'}</p>
                    </td>
                    <td className="py-3 px-4 hidden md:table-cell text-[10px] font-mono text-brand-text-muted">{issue.repo || '—'}</td>
                    <td className="py-3 px-4">
                      <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase border', sev.bg, sev.color, sev.border)}>
                        <SevIcon className="w-2.5 h-2.5" /> {issue.severity}
                      </span>
                    </td>
                    <td className="py-3 px-4 hidden sm:table-cell text-[10px] text-brand-text-muted font-mono">{issue.status || 'open'}</td>
                  </tr>
                );
              })}
              {issues.length === 0 && (
                <tr><td colSpan={4} className="py-12 text-center text-brand-text-muted font-mono text-xs">No security findings — system is clean.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Audit Log */}
      <div className="bg-brand-surface border border-brand-border/50 rounded-2xl overflow-hidden">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 px-5 py-3 border-b border-brand-border/30 bg-brand-elevated/10">
          <h2 className="text-[10px] font-mono font-bold uppercase tracking-wider text-brand-text-muted flex items-center gap-2">
            <FileText className="w-3.5 h-3.5 text-brand-primary" /> Audit Trail
          </h2>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-initial">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3 h-3 text-brand-text-muted" />
              <input type="text" placeholder="Search..." value={auditSearch}
                onChange={e => setAuditSearch(e.target.value)}
                className="w-full sm:w-36 pl-7 pr-3 py-1.5 bg-brand-elevated border border-brand-border/50 rounded-lg text-[10px] font-mono text-brand-text placeholder-brand-text-muted focus:outline-none focus:border-brand-primary/50" />
            </div>
            <select value={auditActionFilter} onChange={e => setAuditActionFilter(e.target.value)}
              className="bg-brand-elevated border border-brand-border/50 rounded-lg px-2 py-1.5 text-[10px] font-mono text-brand-text focus:outline-none focus:border-brand-primary/50">
              <option value="">All Actions</option>
              <option value="workspace">Workspace</option>
              <option value="brand">Brand</option>
              <option value="api_key">API Key</option>
              <option value="social_account">Social</option>
              <option value="webhook">Webhook</option>
              <option value="ai">AI</option>
            </select>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="border-b border-brand-border/30 text-[9px] font-mono font-bold text-brand-text-muted uppercase tracking-widest">
                <th className="py-2.5 px-4">Time</th>
                <th className="py-2.5 px-4">Action</th>
                <th className="py-2.5 px-4 hidden md:table-cell">User</th>
                <th className="py-2.5 px-4 hidden lg:table-cell">Resource</th>
                <th className="py-2.5 px-4">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-brand-border/20">
              {filteredLogs.map(log => (
                <tr key={log.id} className="hover:bg-brand-elevated/20 transition-colors group">
                  <td className="py-2.5 px-4 text-[10px] font-mono text-brand-text-muted whitespace-nowrap">
                    {(log.created_at || log.timestamp || '').substring(0, 19) || '—'}
                  </td>
                  <td className="py-2.5 px-4">
                    <span className="text-xs font-bold text-white">{log.action || '—'}</span>
                  </td>
                  <td className="py-2.5 px-4 hidden md:table-cell text-[10px] font-mono text-brand-text-muted">{log.user || '—'}</td>
                  <td className="py-2.5 px-4 hidden lg:table-cell text-[10px] font-mono text-brand-text-muted truncate max-w-[200px]">{log.resource || '—'}</td>
                  <td className="py-2.5 px-4">
                    <span className={cn(
                      'px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase',
                      log.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-zinc-500/10 text-zinc-400'
                    )}>
                      {log.status || '—'}
                    </span>
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && (
                <tr><td colSpan={5} className="py-12 text-center text-brand-text-muted font-mono text-xs">No audit events match your filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4 py-2 border-t border-brand-border/30 bg-brand-elevated/10 flex items-center justify-between">
          <span className="text-[9px] text-brand-text-muted font-mono">{filteredLogs.length} of {logs.length} entries</span>
        </div>
      </div>
    </motion.div>
  );
}
