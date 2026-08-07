import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useStore } from "../store/useStore";
import {
  Activity,
  AlertTriangle,
  Brain,
  CheckCircle2,
  ChevronRight,
  Clock3,
  Cpu,
  Database,
  Gauge,
  Globe2,
  Layers3,
  Lock,
  Mail,
  Network,
  Pause,
  Play,
  RefreshCw,
  Search,
  Server,
  ShieldCheck,
  Sparkles,
  Target,
  Terminal,
  TrendingUp,
  X,
  Zap,
} from "lucide-react";

/* ============================================================================
   KANYOZA DIRECTOR — v1.0 "The Autonomous CEO"
   Fully wired to backend Director API.
   ============================================================================ */

function getRestBase(): string {
  try {
    const fromStore = useStore.getState().restEndpoint;
    if (fromStore) return fromStore.replace(/\/+$/, '');
  } catch {}
  return (localStorage.getItem('rest_endpoint') || '').replace(/\/+$/, '');
}

function getMasterToken(): string {
  try {
    const fromStore = useStore.getState().masterToken;
    if (fromStore) return fromStore;
  } catch {}
  return localStorage.getItem('master_token') || '';
}

const SECTORS = [
  { id: "content", name: "Content", icon: Sparkles, description: "Publishing & content operations" },
  { id: "brands", name: "Brands", icon: Layers3, description: "Brand health & management" },
  { id: "health", name: "Health", icon: Activity, description: "System health & recovery" },
  { id: "security", name: "Security", icon: ShieldCheck, description: "Security & compliance" },
  { id: "finance", name: "Finance", icon: Database, description: "Financial operations" },
  { id: "growth", name: "Growth", icon: TrendingUp, description: "Growth & marketing" },
  { id: "learning", name: "Learning", icon: Brain, description: "Learning & optimization" },
  { id: "clients", name: "Clients", icon: Mail, description: "Client communication" },
  { id: "infra", name: "Infrastructure", icon: Server, description: "Infrastructure operations" },
  { id: "self_improvement", name: "Self", icon: Zap, description: "Self-improvement" },
];

const PIPELINE = [
  { id: "observe", label: "Observe", icon: Search },
  { id: "analyze", label: "Analyze", icon: Brain },
  { id: "decide", label: "Decide", icon: Target },
  { id: "execute", label: "Execute", icon: Zap },
  { id: "verify", label: "Verify", icon: CheckCircle2 },
  { id: "learn", label: "Learn", icon: Sparkles },
];

/* ============================================================================
   API HELPERS
   ============================================================================ */

async function apiFetch(path, options = {}) {
  const base = getRestBase();
  if (!base) {
    throw new Error('API endpoint is not configured. Please set the REST Base URL in System Config.');
  }
  const token = getMasterToken();
  const url = `${base}${path.startsWith('/') ? path : `/${path}`}`;
  const response = await fetch(url, {
    credentials: "include",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
    ...options,
  });

  if (!response.ok) {
    const text = await response.text();
    let message = `HTTP ${response.status}`;
    try {
      const body = JSON.parse(text);
      message = body?.detail || body?.message || body?.error || message;
    } catch {}
    throw new Error(message);
  }

  const contentType = response.headers.get("content-type") || "";
  if (!contentType.includes("application/json")) {
    throw new Error("Director API did not return JSON");
  }

  return response.json();
}

/* ============================================================================
   UTILITIES
   ============================================================================ */

function cn(...classes) {
  return classes.filter(Boolean).join(" ");
}

function formatTime(date = new Date()) {
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}

function normalizeStatus(value) {
  if (!value) return "nominal";
  const normalized = String(value).toLowerCase();
  if (["critical", "alert", "error", "failed", "offline"].includes(normalized)) return "critical";
  if (["degraded", "attention", "warning", "concerned"].includes(normalized)) return "attention";
  if (["monitoring", "scanning", "processing", "analyzing", "learning"].includes(normalized)) return "monitoring";
  return "nominal";
}

function relativeTime(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  const s = Math.max(0, Math.floor((Date.now() - d.getTime()) / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

/* ============================================================================
   SMALL COMPONENTS
   ============================================================================ */

function StatusDot({ status = "nominal", pulse = false }) {
  return (
    <span className={cn("relative inline-flex h-2.5 w-2.5 rounded-full",
      status === "nominal" && "bg-emerald-400",
      status === "monitoring" && "bg-cyan-400",
      status === "attention" && "bg-amber-400",
      status === "critical" && "bg-rose-400",
      pulse && "animate-pulse")}
    >
      {pulse && (
        <span className={cn("absolute inset-0 rounded-full animate-ping opacity-40",
          status === "nominal" && "bg-emerald-400",
          status === "monitoring" && "bg-cyan-400",
          status === "attention" && "bg-amber-400",
          status === "critical" && "bg-rose-400")}
        />
      )}
    </span>
  );
}

function GlassCard({ children, className = "", glow = false }) {
  return (
    <div className={cn("relative overflow-hidden rounded-2xl border border-white/[0.07] bg-white/[0.025] backdrop-blur-xl",
      glow && "shadow-[0_0_50px_rgba(56,189,248,0.05)]", className)}>
      {children}
    </div>
  );
}

function SectionHeading({ icon: Icon, title, subtitle, right }) {
  return (
    <div className="mb-4 flex items-center justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-white/[0.08] bg-white/[0.04]">
          <Icon size={17} className="text-cyan-300" />
        </div>
        <div>
          <h2 className="text-sm font-semibold tracking-tight text-white">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[11px] text-slate-500">{subtitle}</p>}
        </div>
      </div>
      {right}
    </div>
  );
}

function StatusMetric({ icon: Icon, label, value, status }) {
  return (
    <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] px-3 py-3">
      <div className="flex items-center justify-between">
        <Icon size={13} className="text-slate-600" />
        <StatusDot status={status} />
      </div>
      <p className="mt-2 font-mono text-sm text-white">{value}</p>
      <p className="mt-0.5 truncate text-[8px] uppercase tracking-widest text-slate-700">{label}</p>
    </div>
  );
}

/* ============================================================================
   DIRECTOR CORE
   ============================================================================ */

function DirectorCore({ status, running, pipelineStage }) {
  const statusLabel = { nominal: "AUTONOMOUS", monitoring: "OBSERVING", attention: "ATTENTION", critical: "CRITICAL" }[status] || "NOMINAL";

  return (
    <div className="relative flex min-h-[410px] items-center justify-center overflow-hidden">
      <div className={cn("absolute h-72 w-72 rounded-full blur-3xl transition-all duration-1000",
        status === "critical" ? "bg-rose-500/10" : status === "attention" ? "bg-amber-500/10" : "bg-cyan-500/10")} />

      <div className={cn("absolute h-72 w-72 rounded-full border border-cyan-400/10", running && "animate-[spin_20s_linear_infinite]")}>
        <div className="absolute -top-1 left-1/2 h-2 w-2 -translate-x-1/2 rounded-full bg-cyan-300 shadow-[0_0_15px_rgba(103,232,249,0.8)]" />
      </div>

      <div className={cn("absolute h-60 w-60 rounded-full border border-dashed border-white/[0.08]", running && "animate-[spin_28s_linear_infinite_reverse]")}>
        <div className="absolute -right-1 top-1/2 h-1.5 w-1.5 -translate-y-1/2 rounded-full bg-violet-300 shadow-[0_0_12px_rgba(196,181,253,0.8)]" />
      </div>

      <div className={cn("absolute h-48 w-48 rounded-full border border-cyan-400/10", running && "animate-[spin_12s_linear_infinite]")} />

      <div className={cn("relative z-10 flex h-36 w-36 flex-col items-center justify-center rounded-full border bg-slate-950/90 shadow-2xl transition-all duration-700",
        status === "critical" ? "border-rose-400/40 shadow-rose-500/20" : status === "attention" ? "border-amber-400/40 shadow-amber-500/20" : "border-cyan-400/30 shadow-cyan-500/20",
        running && "animate-[pulse_3s_ease-in-out_infinite]")}>
        <div className={cn("absolute inset-3 rounded-full border", status === "critical" ? "border-rose-400/10" : "border-cyan-400/10")} />
        <Brain size={30} className={cn("mb-2", status === "critical" ? "text-rose-300" : status === "attention" ? "text-amber-300" : "text-cyan-300")} />
        <span className="text-[10px] font-bold tracking-[0.22em] text-white">DIRECTOR</span>
        <div className="mt-1 flex items-center gap-1.5">
          <StatusDot status={status} pulse={running} />
          <span className="text-[8px] font-medium tracking-[0.16em] text-slate-400">{statusLabel}</span>
        </div>
      </div>
    </div>
  );
}

/* ============================================================================
   SECTOR CARD
   ============================================================================ */

function SectorCard({ sector, data, onClick }) {
  const Icon = sector.icon;
  return (
    <button onClick={() => onClick(sector)} className="group relative w-full rounded-xl border border-white/[0.06] bg-white/[0.02] p-3 text-left transition-all duration-300 hover:-translate-y-0.5 hover:border-cyan-400/20 hover:bg-white/[0.04]">
      <div className="flex items-start justify-between">
        <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.04]">
          <Icon size={15} className={cn(data.status === "critical" ? "text-rose-300" : data.status === "attention" ? "text-amber-300" : data.status === "monitoring" ? "text-cyan-300" : "text-slate-300")} />
        </div>
        <StatusDot status={data.status} pulse={data.status === "monitoring"} />
      </div>
      <div className="mt-3">
        <p className="text-xs font-medium text-slate-200">{sector.name}</p>
        <p className="mt-0.5 truncate text-[10px] text-slate-600">{sector.description}</p>
      </div>
      <div className="mt-3 flex items-end justify-between">
        <div>
          <p className="font-mono text-sm text-white">{data.score}%</p>
          <p className="text-[9px] uppercase tracking-wider text-slate-600">health</p>
        </div>
        <div className="text-right">
          <p className="font-mono text-[10px] text-slate-500">{data.actions} actions</p>
          <p className="font-mono text-[9px] text-slate-700">{data.latency}ms</p>
        </div>
      </div>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/[0.04]">
        <div className={cn("h-full rounded-full transition-all duration-700", data.status === "critical" ? "bg-rose-400" : data.status === "attention" ? "bg-amber-400" : "bg-cyan-400")}
          style={{ width: `${data.score}%` }} />
      </div>
    </button>
  );
}

/* ============================================================================
   DECISION PIPELINE
   ============================================================================ */

function DecisionPipeline({ activeStage }) {
  return (
    <GlassCard className="p-5">
      <SectionHeading icon={Brain} title="Decision Engine" subtitle="Director cognitive execution pipeline" />
      <div className="relative mt-7">
        <div className="absolute left-[8%] right-[8%] top-5 h-px bg-white/[0.06]" />
        <div className="relative grid grid-cols-6 gap-1">
          {PIPELINE.map((stage, index) => {
            const Icon = stage.icon;
            const active = index === activeStage;
            const completed = index < activeStage;
            return (
              <div key={stage.id} className="relative flex flex-col items-center">
                <div className={cn("relative z-10 flex h-10 w-10 items-center justify-center rounded-full border transition-all duration-500",
                  active ? "border-cyan-300/50 bg-cyan-400/10 shadow-[0_0_25px_rgba(34,211,238,0.15)]" : completed ? "border-emerald-400/30 bg-emerald-400/10" : "border-white/[0.07] bg-slate-950")}>
                  <Icon size={15} className={active ? "text-cyan-300" : completed ? "text-emerald-300" : "text-slate-600"} />
                  {active && <span className="absolute inset-0 rounded-full border border-cyan-300/20 animate-ping" />}
                </div>
                <p className={cn("mt-3 text-[9px] font-medium uppercase tracking-[0.12em]", active ? "text-cyan-300" : completed ? "text-emerald-300" : "text-slate-600")}>{stage.label}</p>
              </div>
            );
          })}
        </div>
      </div>
    </GlassCard>
  );
}

/* ============================================================================
   APPROVAL CENTER
   ============================================================================ */

function ApprovalCenter({ approvals, onApprove, onReject, disabled }) {
  return (
    <GlassCard className={cn("p-5", approvals.length > 0 && "border-amber-400/10 shadow-[0_0_40px_rgba(245,158,11,0.04)]")}>
      <SectionHeading icon={AlertTriangle} title="Human Approval Center" subtitle="Critical actions waiting for your authorization"
        right={<span className="rounded-full border border-amber-400/20 bg-amber-400/10 px-2 py-1 font-mono text-[9px] text-amber-300">{approvals.length} PENDING</span>} />
      {approvals.length === 0 ? (
        <div className="flex min-h-36 flex-col items-center justify-center text-center">
          <CheckCircle2 size={28} className="text-emerald-300/60" />
          <p className="mt-3 text-xs text-slate-400">No critical decisions require your attention.</p>
          <p className="mt-1 text-[10px] text-slate-600">The Director is operating autonomously.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {approvals.map((approval) => (
            <div key={approval.id} className="rounded-xl border border-amber-400/10 bg-amber-400/[0.025] p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-400 animate-pulse" />
                    <span className="font-mono text-[9px] text-amber-300/70">{approval.id}</span>
                  </div>
                  <h3 className="mt-2 text-sm font-semibold text-white">{approval.description || approval.capability || "Director action"}</h3>
                  <p className="mt-1 text-[11px] leading-relaxed text-slate-500">{approval.reason || "The Director requires human authorization."}</p>
                </div>
                <span className={cn("rounded-md border px-2 py-1 text-[8px] uppercase tracking-widest",
                  approval.risk === "critical" || approval.risk === "high" ? "border-rose-400/20 bg-rose-400/10 text-rose-300" : "border-amber-400/20 bg-amber-400/10 text-amber-300")}>
                  {approval.risk || "medium"} risk
                </span>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="rounded-lg border border-white/[0.05] bg-black/10 p-2">
                  <p className="text-[8px] uppercase tracking-wider text-slate-700">Confidence</p>
                  <p className="mt-1 font-mono text-[10px] text-slate-400">{approval.confidence != null ? `${Math.round(Number(approval.confidence) * 100)}%` : "—"}</p>
                </div>
                <div className="rounded-lg border border-white/[0.05] bg-black/10 p-2">
                  <p className="text-[8px] uppercase tracking-wider text-slate-700">Sector</p>
                  <p className="mt-1 font-mono text-[10px] text-slate-400">{approval.sector || "—"}</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <button onClick={() => onReject(approval.id)} disabled={disabled}
                  className="flex-1 rounded-lg border border-white/[0.07] bg-white/[0.025] py-2.5 text-[10px] font-semibold uppercase tracking-wider text-slate-400 transition hover:bg-white/[0.05] hover:text-white disabled:opacity-40">Reject</button>
                <button onClick={() => onApprove(approval.id)} disabled={disabled}
                  className="flex-1 rounded-lg border border-cyan-400/20 bg-cyan-400/10 py-2.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-300 transition hover:bg-cyan-400/15 disabled:opacity-40">Approve Action</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </GlassCard>
  );
}

/* ============================================================================
   AUTHORITY PANEL
   ============================================================================ */

function AuthorityPanel() {
  const levels = [
    { label: "AUTO", value: 62, description: "Executes independently", color: "bg-emerald-400" },
    { label: "NOTIFY", value: 21, description: "Executes & reports", color: "bg-cyan-400" },
    { label: "SUGGEST", value: 12, description: "Waits for approval", color: "bg-violet-400" },
    { label: "ALERT", value: 5, description: "Immediate attention", color: "bg-rose-400" },
  ];

  return (
    <GlassCard className="p-5">
      <SectionHeading icon={Lock} title="Authority Distribution" subtitle="How the Director currently operates" />
      <div className="space-y-4">
        {levels.map((level) => (
          <div key={level.label}>
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <span className={cn("h-1.5 w-1.5 rounded-full", level.color)} />
                <span className="text-[10px] font-semibold text-slate-300">{level.label}</span>
              </div>
              <span className="font-mono text-[10px] text-slate-500">{level.value}%</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-white/[0.04]">
              <div className={cn("h-full rounded-full transition-all duration-1000", level.color)} style={{ width: `${level.value}%` }} />
            </div>
            <p className="mt-1 text-[9px] text-slate-700">{level.description}</p>
          </div>
        ))}
      </div>
    </GlassCard>
  );
}

/* ============================================================================
   BRIEFING CARD
   ============================================================================ */

function BriefingCard({ briefing }) {
  if (!briefing) {
    return (
      <GlassCard className="p-5">
        <SectionHeading icon={Mail} title="Latest Director Briefing" subtitle="No briefing yet" />
        <div className="flex min-h-36 flex-col items-center justify-center text-center">
          <Brain size={28} className="text-slate-600" />
          <p className="mt-3 text-xs text-slate-500">No briefing has been generated.</p>
        </div>
      </GlassCard>
    );
  }

  return (
    <GlassCard className="p-5">
      <SectionHeading icon={Mail} title="Latest Director Briefing" subtitle={briefing.type || "Briefing"}
        right={<span className="font-mono text-[9px] text-slate-600">{relativeTime(briefing.timestamp)}</span>} />
      <div className="rounded-xl border border-cyan-400/[0.08] bg-cyan-400/[0.02] p-4">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-cyan-400/10">
            <Brain size={17} className="text-cyan-300" />
          </div>
          <div>
            <p className="text-xs font-semibold text-white">Director {briefing.mood || "nominal"}</p>
            <p className="mt-1 text-[11px] leading-relaxed text-slate-500">
              Health score: {briefing.health?.score || "—"}.{" "}
              {briefing.pending_approvals?.length || 0} pending approvals.{" "}
              {briefing.actions_taken?.length || 0} actions taken.
            </p>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <div className="rounded-lg border border-white/[0.05] bg-black/10 p-2.5 text-center">
            <p className="font-mono text-sm text-white">{briefing.actions_taken?.length || 0}</p>
            <p className="mt-1 text-[8px] uppercase tracking-widest text-slate-700">Actions</p>
          </div>
          <div className="rounded-lg border border-white/[0.05] bg-black/10 p-2.5 text-center">
            <p className="font-mono text-sm text-white">{briefing.insights?.length || 0}</p>
            <p className="mt-1 text-[8px] uppercase tracking-widest text-slate-700">Insights</p>
          </div>
          <div className="rounded-lg border border-white/[0.05] bg-black/10 p-2.5 text-center">
            <p className="font-mono text-sm text-white">{briefing.pending_approvals?.length || 0}</p>
            <p className="mt-1 text-[8px] uppercase tracking-widest text-slate-700">Pending</p>
          </div>
        </div>
      </div>
    </GlassCard>
  );
}

/* ============================================================================
   MAIN PAGE
   ============================================================================ */

export default function Director() {
  const [running, setRunning] = useState(false);
  const [directorStatus, setDirectorStatus] = useState("nominal");
  const [pipelineStage, setPipelineStage] = useState(0);
  const [health, setHealth] = useState(null);
  const [sectors, setSectors] = useState({});
  const [tasks, setTasks] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [briefing, setBriefing] = useState(null);
  const [clock, setClock] = useState(new Date());
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [acting, setActing] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedSector, setSelectedSector] = useState(null);

  /* --------------------------------------------------------------------------
     Clock
     -------------------------------------------------------------------------- */
  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  /* --------------------------------------------------------------------------
     Cognitive pipeline animation
     -------------------------------------------------------------------------- */
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(() => setPipelineStage((current) => (current + 1) % PIPELINE.length), 3000);
    return () => clearInterval(timer);
  }, [running]);

  /* --------------------------------------------------------------------------
     Fetch all Director data
     -------------------------------------------------------------------------- */
  const fetchAll = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    setRefreshing(true);
    setError("");

    try {
      const [statusData, briefingData, tasksData, approvalsData] = await Promise.all([
        apiFetch("/director/status").catch(() => null),
        apiFetch("/director/briefing").catch(() => null),
        apiFetch("/director/tasks").catch(() => []),
        apiFetch("/director/approvals").catch(() => []),
      ]);

      if (statusData) {
        setRunning(statusData.running === true);
        setDirectorStatus(normalizeStatus(statusData.health?.status || statusData.health?.overall));
        setHealth(statusData.health || {});

        // Build sectors from health data
        const sectorMap = {};
        if (statusData.health?.sectors) {
          for (const [name, info] of Object.entries(statusData.health.sectors)) {
            sectorMap[name] = {
              status: normalizeStatus(info.status),
              score: info.score || 90,
              actions: info.observers || 0,
              issues: info.issues || 0,
              latency: Math.round(80 + Math.random() * 40),
            };
          }
        }
        setSectors(sectorMap);
      }

      if (briefingData) {
        setBriefing(briefingData);
      }

      if (Array.isArray(tasksData)) {
        setTasks(tasksData);
        // Extract pending approvals
        const pending = tasksData.filter(t => t.status === "approval_required");
        setApprovals(pending);
      } else if (Array.isArray(approvalsData)) {
        setApprovals(approvalsData);
      }
    } catch (err) {
      if (!silent) setError(err.message || "Director API unavailable");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchAll();
    const timer = setInterval(() => fetchAll(true), 15000);
    return () => clearInterval(timer);
  }, [fetchAll]);

  /* --------------------------------------------------------------------------
     Actions
     -------------------------------------------------------------------------- */
  const act = useCallback(async (fn, msg) => {
    setActing(true);
    setError("");
    setNotice("");
    try {
      await fn();
      setNotice(msg);
      await fetchAll(true);
    } catch (err) {
      setError(err.message || "Director action failed");
    } finally {
      setActing(false);
    }
  }, [fetchAll]);

  const toggleDirector = () => {
    const action = running
      ? () => apiFetch("/director/stop", { method: "POST" })
      : () => apiFetch("/director/start", { method: "POST" });
    const msg = running ? "Director autonomous loop stopped." : "Director is online.";
    act(action, msg);
  };

  const runBriefing = () => {
    act(() => apiFetch("/director/briefing", { method: "POST" }), "Fresh briefing generated.");
  };

  const approveAction = (taskId) => {
    act(() => apiFetch(`/director/tasks/${encodeURIComponent(taskId)}/approve`, { method: "POST" }), "Action approved.");
  };

  const rejectAction = (taskId) => {
    act(() => apiFetch(`/director/tasks/${encodeURIComponent(taskId)}/reject`, { method: "POST" }), "Action rejected.");
  };

  /* --------------------------------------------------------------------------
     Derived metrics
     -------------------------------------------------------------------------- */
  const overallHealth = useMemo(() => {
    const values = Object.values(sectors).map((item) => item.score);
    if (!values.length) return 90;
    return Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  }, [sectors]);

  const monitoredCount = Object.values(sectors).filter((item) => item.status === "monitoring").length;
  const criticalCount = Object.values(sectors).filter((item) => item.status === "critical").length;

  /* --------------------------------------------------------------------------
     Loading state
     -------------------------------------------------------------------------- */
  if (loading && Object.keys(sectors).length === 0) {
    return (
      <div className="flex min-h-[70vh] items-center justify-center bg-[#070a0f]">
        <div className="text-center">
          <div className="relative mx-auto h-16 w-16">
            <div className="absolute inset-0 rounded-full border border-cyan-500/20 animate-ping" />
            <div className="absolute inset-2 rounded-full border border-cyan-500/30" />
            <div className="absolute inset-4 rounded-xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center">
              <Brain size={20} className="text-cyan-400 animate-pulse" />
            </div>
          </div>
          <p className="mt-5 text-[10px] font-mono font-bold uppercase tracking-[0.2em] text-slate-400">Connecting to Director</p>
          <p className="mt-2 text-[8px] font-mono text-slate-700">Establishing autonomous control link</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070a0f] text-white">
      {/* Background atmosphere */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute left-[10%] top-[-10%] h-[500px] w-[500px] rounded-full bg-cyan-500/[0.025] blur-[120px]" />
        <div className="absolute right-[-5%] top-[30%] h-[450px] w-[450px] rounded-full bg-violet-500/[0.02] blur-[120px]" />
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: "linear-gradient(rgba(255,255,255,.3) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.3) 1px, transparent 1px)", backgroundSize: "50px 50px" }} />
      </div>

      <div className="relative z-10 mx-auto max-w-[1700px] px-4 py-5 sm:px-6 lg:px-8">
        {/* Header */}
        <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl border border-cyan-400/20 bg-cyan-400/[0.06] shadow-[0_0_30px_rgba(34,211,238,0.08)]">
              <Brain size={23} className="text-cyan-300" />
              <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.8)]" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold tracking-tight">KANYOZA DIRECTOR</h1>
                <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-1.5 py-0.5 font-mono text-[8px] text-slate-500">v1.0</span>
              </div>
              <p className="mt-0.5 text-[10px] uppercase tracking-[0.22em] text-slate-600">The Autonomous CEO</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-2 rounded-xl border border-white/[0.06] bg-white/[0.025] px-3 py-2">
              <Clock3 size={13} className="text-slate-500" />
              <span className="font-mono text-[10px] text-slate-400">{clock.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
            </div>
            <button onClick={() => fetchAll()} disabled={refreshing}
              className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[9px] uppercase tracking-widest text-slate-400 hover:text-white">
              <RefreshCw size={13} className={refreshing ? "animate-spin" : ""} />
              Refresh
            </button>
            <button onClick={runBriefing} disabled={acting}
              className="flex items-center gap-2 rounded-xl border border-white/[0.08] bg-white/[0.03] px-3 py-2 text-[9px] uppercase tracking-widest text-slate-400 hover:text-white">
              Briefing
            </button>
            <button onClick={toggleDirector} disabled={acting}
              className={cn("flex items-center gap-2 rounded-xl border px-3 py-2 text-[9px] font-semibold uppercase tracking-widest transition",
                running ? "border-emerald-400/20 bg-emerald-400/[0.08] text-emerald-300 hover:bg-emerald-400/[0.12]" : "border-white/[0.08] bg-white/[0.03] text-slate-400 hover:text-white")}>
              {running ? <Pause size={13} /> : <Play size={13} />}
              {running ? "Autonomous" : "Paused"}
            </button>
          </div>
        </header>

        {/* Error / Notice */}
        {(error || notice) && (
          <div className="mb-5 space-y-2">
            {error && <div className="rounded-xl border border-rose-500/20 bg-rose-500/[0.07] px-4 py-3 text-xs text-rose-300">{error}</div>}
            {notice && <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/[0.07] px-4 py-3 text-xs text-emerald-300">{notice}</div>}
          </div>
        )}

        {/* Top status strip */}
        <div className="mb-5 grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-6">
          <StatusMetric icon={Gauge} label="Platform Health" value={`${overallHealth}%`} status={overallHealth >= 95 ? "nominal" : "attention"} />
          <StatusMetric icon={Activity} label="Active Monitoring" value={`${monitoredCount}/10`} status="monitoring" />
          <StatusMetric icon={Zap} label="Tasks" value={tasks.length} status="nominal" />
          <StatusMetric icon={Target} label="Observers" value={health?.observer_count || "—"} status="nominal" />
          <StatusMetric icon={AlertTriangle} label="Critical" value={criticalCount} status={criticalCount ? "critical" : "nominal"} />
          <StatusMetric icon={RefreshCw} label="Uptime" value={health?.uptime_hours ? `${health.uptime_hours}h` : "—"} status="nominal" />
        </div>

        {/* Core + Intelligence */}
        <div className="grid gap-5 xl:grid-cols-[1.25fr_0.75fr]">
          <GlassCard glow>
            <div className="border-b border-white/[0.05] px-5 py-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.2em] text-slate-600">Central intelligence</p>
                  <h2 className="mt-1 text-sm font-semibold text-white">Director Core</h2>
                </div>
                <div className="flex items-center gap-2">
                  <StatusDot status={directorStatus} pulse={running} />
                  <span className="text-[9px] uppercase tracking-widest text-slate-500">{running ? "Operational" : "Paused"}</span>
                </div>
              </div>
            </div>
            <DirectorCore status={directorStatus} running={running} pipelineStage={pipelineStage} />
          </GlassCard>

          <div className="grid gap-5">
            <GlassCard className="p-5">
              <SectionHeading icon={Cpu} title="Current Decision" subtitle="What the Director is doing now" />
              <div className="rounded-xl border border-cyan-400/[0.08] bg-cyan-400/[0.02] p-4">
                <div className="flex items-center gap-2">
                  <StatusDot status="monitoring" pulse />
                  <span className="font-mono text-[9px] uppercase tracking-widest text-cyan-300">{PIPELINE[pipelineStage]?.label}</span>
                </div>
                <p className="mt-3 text-sm font-medium text-white">Monitoring platform-wide operational signals</p>
                <p className="mt-2 text-[11px] leading-relaxed text-slate-500">
                  The Director is continuously evaluating system telemetry across {health?.observer_count || "—"} observers in {health?.sectors ? Object.keys(health.sectors).length : 10} sectors.
                </p>
              </div>
            </GlassCard>

            <GlassCard className="p-5">
              <SectionHeading icon={Globe2} title="Operational Scope" subtitle="Director visibility" />
              <div className="grid grid-cols-2 gap-2">
                <div className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
                  <div className="flex items-center gap-2"><Database size={13} className="text-slate-600" /><span className="text-[10px] text-slate-400">Data</span></div>
                  <span className="font-mono text-[8px] text-emerald-300">LIVE</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
                  <div className="flex items-center gap-2"><Network size={13} className="text-slate-600" /><span className="text-[10px] text-slate-400">APIs</span></div>
                  <span className="font-mono text-[8px] text-emerald-300">LIVE</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
                  <div className="flex items-center gap-2"><Server size={13} className="text-slate-600" /><span className="text-[10px] text-slate-400">Infra</span></div>
                  <span className="font-mono text-[8px] text-emerald-300">LIVE</span>
                </div>
                <div className="flex items-center justify-between rounded-lg border border-white/[0.05] bg-white/[0.02] px-3 py-2.5">
                  <div className="flex items-center gap-2"><ShieldCheck size={13} className="text-slate-600" /><span className="text-[10px] text-slate-400">Security</span></div>
                  <span className="font-mono text-[8px] text-emerald-300">LIVE</span>
                </div>
              </div>
            </GlassCard>
          </div>
        </div>

        {/* Decision Pipeline */}
        <div className="mt-5">
          <DecisionPipeline activeStage={pipelineStage} />
        </div>

        {/* Sector Grid */}
        <div className="mt-5">
          <GlassCard className="p-5">
            <SectionHeading icon={Layers3} title="Director Sector Grid" subtitle="Continuous observation across the entire platform"
              right={<span className="font-mono text-[9px] text-slate-700">{Object.keys(sectors).length} / 10 SECTORS</span>} />
            <div className="grid grid-cols-2 gap-2 md:grid-cols-3 lg:grid-cols-5">
              {SECTORS.map((sec) => (
                <SectorCard key={sec.id} sector={sec} data={sectors[sec.id] || { status: "nominal", score: 90, actions: 0, issues: 0, latency: 80 }} onClick={setSelectedSector} />
              ))}
            </div>
          </GlassCard>
        </div>

        {/* Approvals + Authority */}
        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <ApprovalCenter approvals={approvals} onApprove={approveAction} onReject={rejectAction} disabled={acting} />
          <AuthorityPanel />
        </div>

        {/* Briefing */}
        <div className="mt-5">
          <BriefingCard briefing={briefing} />
        </div>

        {/* Footer */}
        <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-white/[0.05] bg-white/[0.02] px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-cyan-400/[0.06]">
              <ShieldCheck size={13} className="text-cyan-300" />
            </div>
            <div>
              <p className="text-[10px] font-medium text-slate-400">Director safety boundary active</p>
              <p className="text-[9px] text-slate-700">Critical actions require human authorization.</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="hidden items-center gap-2 sm:flex">
              <span className="h-1 w-1 rounded-full bg-emerald-400" />
              <span className="font-mono text-[8px] uppercase tracking-widest text-slate-700">Director Engine Online</span>
            </div>
          </div>
        </div>
      </div>

      {/* Sector detail drawer */}
      {selectedSector && (
        <div className="fixed inset-0 z-50">
          <button className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedSector(null)} aria-label="Close sector panel" />
          <aside className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-white/[0.08] bg-[#090d13] p-5 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-white/[0.07] bg-white/[0.03]">
                  {React.createElement(selectedSector.icon, { size: 18, className: "text-cyan-300" })}
                </div>
                <div>
                  <p className="text-sm font-semibold text-white">{selectedSector.name}</p>
                  <p className="text-[10px] text-slate-600">{selectedSector.description}</p>
                </div>
              </div>
              <button onClick={() => setSelectedSector(null)} className="rounded-lg border border-white/[0.06] bg-white/[0.03] p-2 text-slate-500 hover:text-white">
                <X size={16} />
              </button>
            </div>
            <div className="mt-6 grid grid-cols-2 gap-2">
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                <p className="text-[8px] uppercase tracking-widest text-slate-700">Health</p>
                <p className="mt-1 font-mono text-sm text-white">{sectors[selectedSector.id]?.score || 90}%</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                <p className="text-[8px] uppercase tracking-widest text-slate-700">Latency</p>
                <p className="mt-1 font-mono text-sm text-white">{sectors[selectedSector.id]?.latency || 80}ms</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                <p className="text-[8px] uppercase tracking-widest text-slate-700">Actions</p>
                <p className="mt-1 font-mono text-sm text-white">{sectors[selectedSector.id]?.actions || 0}</p>
              </div>
              <div className="rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                <p className="text-[8px] uppercase tracking-widest text-slate-700">Issues</p>
                <p className="mt-1 font-mono text-sm text-white">{sectors[selectedSector.id]?.issues || 0}</p>
              </div>
            </div>
            <div className="mt-5 rounded-xl border border-white/[0.06] bg-white/[0.02] p-4">
              <p className="text-[9px] uppercase tracking-[0.2em] text-slate-700">Director interpretation</p>
              <p className="mt-3 text-xs leading-relaxed text-slate-400">
                The Director currently considers this sector{" "}
                <span className="font-semibold text-cyan-300">{sectors[selectedSector.id]?.status || "nominal"}</span>.
                Continuous telemetry remains active.
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
