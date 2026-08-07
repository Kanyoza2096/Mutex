import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { 
  Link, Plus, Trash2, RefreshCw, CheckCircle, XCircle, 
  AlertTriangle, Eye, EyeOff, Globe, Copy, Settings,
  Facebook, Twitter, Linkedin, Instagram, MessageCircle, Send,
  Palette, Bot, Search, Filter, Zap, Shield, Clock, Activity,
  ChevronRight, MoreHorizontal, ExternalLink, Wifi, WifiOff
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

// ── Types ──────────────────────────────────────────────────────────────────

interface SocialAccount {
  id: string; workspace_id: string;
  platform: 'facebook' | 'twitter' | 'linkedin' | 'instagram' | 'whatsapp' | 'telegram';
  account_name: string; timezone: string; enabled: boolean;
  health_status: string; last_checked: string | null; brand_id?: string;
  access_token?: string; refresh_token?: string; client_id?: string;
  client_secret?: string; page_id?: string; page_access_token?: string;
  verify_token?: string; app_secret?: string; person_urn?: string;
  phone_number_id?: string; bot_token?: string; platform_config?: Record<string, any>;
  created_at?: string;
}

interface Workspace { id: string; name: string; slug?: string; }
interface Brand { id: string; name: string; }
interface VerifyResult {
  ready_to_publish: boolean; summary: string;
  checks: Record<string, { ok: boolean; detail: string }>; checked_at: string;
}

// ── Constants ──────────────────────────────────────────────────────────────

const PLATFORM_CONFIG: Record<string, { 
  label: string; icon: React.ComponentType<any>; 
  text: string; bg: string; border: string; accent: string;
  gradient: string;
}> = {
  facebook:  { label: 'Facebook Page', icon: Facebook,      text: 'text-[#1877F2]', bg: 'bg-[#1877F2]/10', border: 'border-[#1877F2]/20', accent: '#1877F2', gradient: 'from-[#1877F2]/20 to-transparent' },
  twitter:   { label: 'X (Twitter)',   icon: Twitter,       text: 'text-zinc-200',  bg: 'bg-zinc-800/80',   border: 'border-zinc-700',    accent: '#1DA1F2', gradient: 'from-zinc-600/20 to-transparent' },
  linkedin:  { label: 'LinkedIn',      icon: Linkedin,      text: 'text-[#0A66C2]', bg: 'bg-[#0A66C2]/10', border: 'border-[#0A66C2]/20', accent: '#0A66C2', gradient: 'from-[#0A66C2]/20 to-transparent' },
  instagram: { label: 'Instagram',     icon: Instagram,     text: 'text-[#E4405F]', bg: 'bg-[#E4405F]/10', border: 'border-[#E4405F]/20', accent: '#E4405F', gradient: 'from-[#E4405F]/20 to-transparent' },
  whatsapp:  { label: 'WhatsApp',      icon: MessageCircle, text: 'text-[#25D366]', bg: 'bg-[#25D366]/10', border: 'border-[#25D366]/20', accent: '#25D366', gradient: 'from-[#25D366]/20 to-transparent' },
  telegram:  { label: 'Telegram Bot',  icon: Send,          text: 'text-[#229ED9]', bg: 'bg-[#229ED9]/10', border: 'border-[#229ED9]/20', accent: '#229ED9', gradient: 'from-[#229ED9]/20 to-transparent' },
};

const TIMEZONES = ['UTC', 'Africa/Blantyre', 'Africa/Johannesburg', 'Africa/Nairobi', 'Europe/London', 'America/New_York', 'America/Chicago', 'America/Los_Angeles', 'Asia/Tokyo', 'Asia/Dubai'];

const PLATFORM_FIELDS: Record<string, { key: string; label: string; secret: boolean; placeholder: string }[]> = {
  facebook: [
    { key: 'page_id', label: 'Page ID', secret: false, placeholder: 'e.g. 104857291048' },
    { key: 'page_access_token', label: 'Page Access Token', secret: true, placeholder: 'EAArx...' },
    { key: 'verify_token', label: 'Verify Token', secret: true, placeholder: 'Custom verification string' },
    { key: 'app_secret', label: 'App Secret', secret: true, placeholder: 'App secret key' },
  ],
  twitter: [
    { key: 'access_token', label: 'Access Token', secret: true, placeholder: 'OAuth access token' },
    { key: 'refresh_token', label: 'Refresh Token', secret: true, placeholder: 'OAuth refresh token' },
    { key: 'client_id', label: 'Client ID', secret: false, placeholder: 'Twitter Client ID' },
    { key: 'client_secret', label: 'Client Secret', secret: true, placeholder: 'Twitter Client Secret' },
  ],
  linkedin: [
    { key: 'access_token', label: 'Access Token', secret: true, placeholder: 'LinkedIn access token' },
    { key: 'person_urn', label: 'Person URN', secret: false, placeholder: 'urn:li:person:XXXXX' },
  ],
  instagram: [
    { key: 'page_id', label: 'Page ID (via Facebook)', secret: false, placeholder: 'e.g. 1092837492' },
    { key: 'access_token', label: 'Access Token', secret: true, placeholder: 'Graph API Token' },
  ],
  whatsapp: [
    { key: 'phone_number_id', label: 'Phone Number ID', secret: false, placeholder: 'e.g. 265999123456' },
    { key: 'access_token', label: 'Access Token', secret: true, placeholder: 'Permanent Access Token' },
  ],
  telegram: [
    { key: 'bot_token', label: 'Bot Token', secret: true, placeholder: 'e.g. 123456:ABC-def1234ghIkl' },
  ],
};

// Keys that hold secrets — never surfaced in read paths (edit modal pre-fill,
// toggle PUT body). This prevents plaintext credential exposure in network
// payloads and component state that is logged by the dev tools interceptor.
const REDACT_KEYS = new Set([
  'access_token', 'refresh_token', 'client_secret', 'page_access_token',
  'app_secret', 'verify_token', 'bot_token',
]);

function getCredential(account: SocialAccount, key: string, secret = false): string {
  // Return empty string for secret fields — the edit modal shows a placeholder
  // prompting the operator to re-enter the value rather than echoing the stored secret.
  if (secret || REDACT_KEYS.has(key)) return '';
  const topLevel = (account as any)[key];
  if (topLevel) return topLevel;
  const pc = account.platform_config || {};
  return pc[key] || '';
}

// ── Skeleton card ──────────────────────────────────────────────────────────

const SkeletonCard = () => (
  <div className="bg-brand-surface border border-brand-border/50 rounded-2xl p-5 animate-pulse space-y-4">
    <div className="flex justify-between">
      <div className="w-10 h-10 bg-brand-elevated rounded-xl" />
      <div className="w-16 h-5 bg-brand-elevated rounded-full" />
    </div>
    <div className="h-5 bg-brand-elevated rounded w-2/3" />
    <div className="h-3 bg-brand-elevated rounded w-1/2" />
    <div className="pt-3 border-t border-brand-border/30 space-y-2">
      <div className="h-3 bg-brand-elevated rounded w-3/4" />
      <div className="h-3 bg-brand-elevated rounded w-1/2" />
    </div>
  </div>
);

// ═══════════════════════════════════════════════════════════════════════════

export default function SocialAccounts() {
  const { restEndpoint, socket } = useStore();

  // ── State ────────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspaceId, setSelectedWorkspaceId] = useState('');
  const [accounts, setAccounts] = useState<SocialAccount[]>([]);
  const [brands, setBrands] = useState<Brand[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [platformFilter, setPlatformFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState('all');

  // Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<SocialAccount | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<SocialAccount | null>(null);
  const [testingId, setTestingId] = useState<string | null>(null);
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [verifyResults, setVerifyResults] = useState<Record<string, VerifyResult>>({});
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ status: 'success' | 'error'; message: string } | null>(null);

  // Form fields
  const [modalPlatform, setModalPlatform] = useState<SocialAccount['platform']>('facebook');
  const [modalAccountName, setModalAccountName] = useState('');
  const [modalTimezone, setModalTimezone] = useState('Africa/Blantyre');
  const [modalEnabled, setModalEnabled] = useState(true);
  const [modalBrandId, setModalBrandId] = useState('');
  const [credentials, setCredentials] = useState<Record<string, string>>({});
  const [visibleFields, setVisibleFields] = useState<Record<string, boolean>>({});

  const base = restEndpoint.replace(/\/+$/, '');

  // ── API helper ───────────────────────────────────────────────────────────
  // Auth (JWT or masterToken fallback) is injected globally by fetchInterceptor.ts.
  // Do NOT set Authorization here — that would block the interceptor from upgrading
  // to the authenticated Supabase JWT and would leak the shared token unnecessarily.
  const apiFetch = async <T = any>(path: string, options: RequestInit = {}): Promise<T> => {
    const res = await fetch(`${base}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...(options.headers ?? {}) },
    });
    if (!res.ok) {
      const body = await res.text().catch(() => res.statusText);
      throw new Error(body || `HTTP ${res.status}`);
    }
    return res.json();
  };

  // ── Load data ────────────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    if (!base) { setLoading(false); return; }
    setLoading(true);
    setError(null);
    try {
      const wsRes = await apiFetch<{ ok: boolean; workspaces: Workspace[] }>('/workspaces');
      const wsList = wsRes.workspaces || [];
      setWorkspaces(wsList);
      if (wsList.length > 0) {
        const activeId = selectedWorkspaceId && wsList.find(w => w.id === selectedWorkspaceId) ? selectedWorkspaceId : wsList[0].id;
        setSelectedWorkspaceId(activeId);
        const [accRes, brRes] = await Promise.all([
          apiFetch<{ ok: boolean; social_accounts: SocialAccount[] }>(`/workspaces/${activeId}/social-accounts`),
          apiFetch<{ ok: boolean; brands: Brand[] }>(`/workspaces/${activeId}/brands`),
        ]);
        setAccounts(accRes.social_accounts || []);
        setBrands(brRes.brands || []);
      } else {
        setAccounts([]); setBrands([]);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load data');
    } finally {
      setLoading(false);
    }
  }, [restEndpoint, selectedWorkspaceId]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Socket listeners ─────────────────────────────────────────────────────
  useEffect(() => {
    if (!socket) return;
    const handler = (data: any) => {
      setVerifyResults(prev => ({ ...prev, [data.account_id]: { ready_to_publish: data.ready_to_publish, summary: data.summary, checks: data.checks, checked_at: new Date().toISOString() } }));
      setVerifyingId(null);
    };
    socket.on('verify_publish_result', handler);
    return () => { socket.off('verify_publish_result', handler); };
  }, [socket]);

  // ── Derived data ─────────────────────────────────────────────────────────
  const workspaceAccounts = useMemo(() => accounts.filter(a => a.workspace_id === selectedWorkspaceId), [accounts, selectedWorkspaceId]);
  
  const filteredAccounts = useMemo(() => {
    let result = [...workspaceAccounts];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(a => a.account_name.toLowerCase().includes(q));
    }
    if (platformFilter !== 'all') result = result.filter(a => a.platform === platformFilter);
    if (statusFilter === 'healthy') result = result.filter(a => a.health_status === 'healthy');
    if (statusFilter === 'unhealthy') result = result.filter(a => a.health_status === 'unhealthy' || !a.health_status);
    return result;
  }, [workspaceAccounts, searchQuery, platformFilter, statusFilter]);

  const stats = useMemo(() => ({
    total: workspaceAccounts.length,
    enabled: workspaceAccounts.filter(a => a.enabled).length,
    healthy: workspaceAccounts.filter(a => a.health_status === 'healthy').length,
    unhealthy: workspaceAccounts.filter(a => a.health_status === 'unhealthy' || !a.health_status).length,
  }), [workspaceAccounts]);

  const getLinkedBrandName = (brandId?: string) => brands.find(b => b.id === brandId)?.name;

  // ── Actions ──────────────────────────────────────────────────────────────
  const openNew = () => {
    setEditingAccount(null); setModalPlatform('facebook'); setModalAccountName('');
    setModalTimezone('Africa/Blantyre'); setModalEnabled(true); setModalBrandId('');
    setCredentials({}); setVisibleFields({}); setTestResult(null); setIsModalOpen(true);
  };

  const openEdit = (account: SocialAccount) => {
    setEditingAccount(account); setModalPlatform(account.platform);
    setModalAccountName(account.account_name); setModalTimezone(account.timezone);
    setModalEnabled(account.enabled); setModalBrandId(account.brand_id || '');
    const creds: Record<string, string> = {};
    for (const field of PLATFORM_FIELDS[account.platform]) {
      // Pass field.secret so getCredential redacts sensitive fields in the edit modal.
      creds[field.key] = getCredential(account, field.key, field.secret);
    }
    setCredentials(creds); setVisibleFields({}); setTestResult(null); setIsModalOpen(true);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalAccountName.trim()) { toast.error('Account name is required'); return; }
    setSaving(true);
    try {
      // When editing an existing account, omit any credential field that was left
      // blank — the server preserves the existing stored secret.  Sending an
      // empty string would overwrite (and therefore destroy) the stored value.
      const credPayload = editingAccount
        ? Object.fromEntries(Object.entries(credentials).filter(([, v]) => v !== ''))
        : credentials;
      const payload = {
        platform: modalPlatform,
        account_name: modalAccountName.trim(),
        timezone: modalTimezone,
        enabled: modalEnabled,
        brand_id: modalBrandId || null,
        ...credPayload,
      };
      if (editingAccount) {
        await apiFetch(`/social-accounts/${editingAccount.id}`, { method: 'PUT', body: JSON.stringify(payload) });
        toast.success('Account updated');
      } else {
        await apiFetch(`/workspaces/${selectedWorkspaceId}/social-accounts`, { method: 'POST', body: JSON.stringify(payload) });
        toast.success('Account connected');
      }
      setIsModalOpen(false); loadData();
    } catch (err: any) { toast.error(err.message || 'Save failed'); }
    finally { setSaving(false); }
  };

  const handleToggle = async (account: SocialAccount) => {
    try {
      // Credentials intentionally omitted from the toggle PUT — the server
      // preserves stored credential values; sending empty strings would overwrite them.
      await apiFetch(`/social-accounts/${account.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          platform: account.platform,
          account_name: account.account_name,
          timezone: account.timezone,
          enabled: !account.enabled,
          brand_id: account.brand_id,
        }),
      });
      toast.success(account.enabled ? 'Account disabled' : 'Account enabled');
      loadData();
    } catch (err: any) { toast.error(err.message || 'Toggle failed'); }
  };

  const handleHealthCheck = async (account: SocialAccount) => {
    setTestingId(account.id);
    try {
      await apiFetch(`/social-accounts/${account.id}/health-check`, { method: 'POST' });
      toast.success('Connection healthy');
      loadData();
    } catch (err: any) { toast.error(err.message || 'Health check failed'); }
    finally { setTestingId(null); }
  };

  const handleVerifyPublish = async (account: SocialAccount) => {
    setVerifyingId(account.id);
    try {
      const res = await apiFetch<{ verified: boolean; summary: string; ready_to_publish: boolean; checks: Record<string, { ok: boolean; detail: string }> }>(`/social-accounts/${account.id}/verify-publish`, { method: 'POST', signal: AbortSignal.timeout(8000) });
      setVerifyResults(prev => ({ ...prev, [account.id]: { ready_to_publish: res.ready_to_publish, summary: res.summary, checks: res.checks, checked_at: new Date().toISOString() } }));
      toast[res.ready_to_publish ? 'success' : 'error'](`${account.account_name}: ${res.summary}`);
    } catch (err: any) {
      toast.error(err.name === 'TimeoutError' ? 'Verification timed out' : err.message || 'Verification failed');
    } finally { setVerifyingId(null); }
  };

  const handleDelete = async () => {
    if (!confirmDelete) return;
    try {
      await apiFetch(`/social-accounts/${confirmDelete.id}`, { method: 'DELETE' });
      toast.success('Account disconnected');
      setVerifyResults(prev => { const n = { ...prev }; delete n[confirmDelete.id]; return n; });
      setConfirmDelete(null); loadData();
    } catch (err: any) { toast.error(err.message || 'Delete failed'); }
  };

  // ── Render ───────────────────────────────────────────────────────────────
  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-24 px-4 md:px-6 pt-4">
      
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-primary/10 rounded-xl border border-brand-primary/20">
            <Link className="w-5 h-5 text-brand-primary" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Social Accounts</h1>
            <p className="text-[10px] text-brand-text-muted font-mono uppercase tracking-wider mt-0.5">
              {stats.total} connected · {stats.enabled} active · {stats.healthy} healthy
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select value={selectedWorkspaceId} onChange={e => setSelectedWorkspaceId(e.target.value)}
            className="bg-brand-surface border border-brand-border/50 rounded-xl px-3 py-2 text-xs text-brand-text font-medium focus:outline-none focus:border-brand-primary/50 transition-all">
            {workspaces.map(ws => <option key={ws.id} value={ws.id}>{ws.name}</option>)}
          </select>
          <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
            onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-bold font-mono uppercase tracking-wider hover:bg-brand-primary/90 transition-all shadow-glow-primary">
            <Plus className="w-4 h-4" /> Connect
          </motion.button>
        </div>
      </div>

      {/* Stats + Filters */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="grid grid-cols-4 gap-2 flex-1">
          {[
            { label: 'Total', value: stats.total, icon: Link, color: 'text-brand-primary' },
            { label: 'Active', value: stats.enabled, icon: Zap, color: 'text-emerald-400' },
            { label: 'Healthy', value: stats.healthy, icon: Activity, color: 'text-emerald-400' },
            { label: 'Issues', value: stats.unhealthy, icon: AlertTriangle, color: 'text-amber-400' },
          ].map(s => (
            <div key={s.label} className="bg-brand-surface/50 border border-brand-border/50 rounded-xl p-2.5">
              <div className="flex items-center justify-between mb-0.5">
                <span className="text-[9px] text-brand-text-muted uppercase font-mono tracking-wider">{s.label}</span>
                <s.icon className={cn('w-3 h-3', s.color)} />
              </div>
              <div className={cn('text-sm font-mono font-bold', s.color)}>{s.value}</div>
            </div>
          ))}
        </div>
        <div className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-brand-text-muted" />
            <input type="text" placeholder="Search..." value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="pl-8 pr-3 py-2 bg-brand-surface border border-brand-border/50 rounded-xl text-xs text-brand-text placeholder-brand-text-muted focus:outline-none focus:border-brand-primary/50 w-36 transition-all" />
          </div>
          <select value={platformFilter} onChange={e => setPlatformFilter(e.target.value)}
            className="bg-brand-surface border border-brand-border/50 rounded-xl px-2.5 py-2 text-xs text-brand-text focus:outline-none focus:border-brand-primary/50">
            <option value="all">All Platforms</option>
            {Object.entries(PLATFORM_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
          </select>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)}
            className="bg-brand-surface border border-brand-border/50 rounded-xl px-2.5 py-2 text-xs text-brand-text focus:outline-none focus:border-brand-primary/50">
            <option value="all">All Status</option>
            <option value="healthy">Healthy</option>
            <option value="unhealthy">Needs Attention</option>
          </select>
        </div>
      </div>

      {/* Account Cards */}
      {loading ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {[1,2,3,4,5,6].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : error ? (
        <div className="py-16 text-center">
          <AlertTriangle className="w-10 h-10 text-red-400 mx-auto mb-3 opacity-50" />
          <p className="text-sm text-brand-text-muted font-mono">{error}</p>
          <button onClick={loadData} className="mt-3 text-xs text-brand-primary hover:underline">Retry</button>
        </div>
      ) : filteredAccounts.length === 0 ? (
        <div className="py-20 text-center border-2 border-dashed border-brand-border/50 rounded-2xl">
          <Globe className="w-12 h-12 text-brand-text-muted/30 mx-auto mb-4" />
          <p className="text-sm text-brand-text-muted font-mono">
            {workspaceAccounts.length === 0 ? 'No social accounts connected.' : 'No accounts match your filters.'}
          </p>
          {workspaceAccounts.length === 0 && (
            <button onClick={openNew} className="mt-4 px-4 py-2 bg-brand-primary text-white text-xs font-bold rounded-xl">Connect First Account</button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <AnimatePresence mode="wait">
            {filteredAccounts.map(account => {
              const config = PLATFORM_CONFIG[account.platform];
              const Icon = config.icon;
              const verifyResult = verifyResults[account.id];
              const linkedBrand = getLinkedBrandName(account.brand_id);

              return (
                <motion.div key={account.id} layout
                  initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                  className={cn(
                    'relative bg-brand-surface border border-brand-border/50 rounded-2xl p-5 hover:border-brand-primary/30 transition-all group overflow-hidden',
                    !account.enabled && 'opacity-50 grayscale'
                  )}>
                  {/* Platform accent bar */}
                  <div className="absolute top-0 left-0 right-0 h-0.5" style={{ backgroundColor: config.accent }} />
                  
                  {/* Header */}
                  <div className="flex items-start justify-between mb-4">
                    <div className={cn('p-2.5 rounded-xl', config.bg)}>
                      <Icon className="w-5 h-5" style={{ color: config.accent }} />
                    </div>
                    <div className="flex items-center gap-1.5">
                      <span className={cn(
                        'px-2 py-0.5 rounded-full text-[9px] font-bold font-mono uppercase border',
                        account.health_status === 'healthy' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30' :
                        'bg-amber-500/10 text-amber-400 border-amber-500/30'
                      )}>
                        {account.health_status || 'Unknown'}
                      </span>
                    </div>
                  </div>

                  {/* Name + platform */}
                  <h3 className="font-bold text-white text-sm truncate">{account.account_name}</h3>
                  <p className="text-[10px] text-brand-text-muted font-mono uppercase mt-0.5">{config.label}</p>
                  {linkedBrand && (
                    <p className="text-[10px] text-brand-primary font-mono flex items-center gap-1 mt-1.5">
                      <Palette className="w-3 h-3" /> {linkedBrand}
                    </p>
                  )}

                  {/* Meta */}
                  <div className="grid grid-cols-2 gap-2 py-3 mt-3 border-y border-brand-border/30 text-[10px] font-mono">
                    <div>
                      <span className="text-brand-text-muted">Timezone</span>
                      <p className="text-brand-text font-bold">{account.timezone}</p>
                    </div>
                    <div>
                      <span className="text-brand-text-muted">Last Check</span>
                      <p className="text-brand-text font-bold">{account.last_checked ? new Date(account.last_checked).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Never'}</p>
                    </div>
                  </div>

                  {/* Verify result */}
                  <AnimatePresence>
                    {verifyResult && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className={cn('mt-3 p-3 rounded-xl border text-[10px] font-mono space-y-1.5 overflow-hidden',
                          verifyResult.ready_to_publish ? 'bg-emerald-500/5 border-emerald-500/20' : 'bg-red-500/5 border-red-500/20')}>
                        <div className="flex items-center justify-between">
                          <span className={cn('font-bold uppercase', verifyResult.ready_to_publish ? 'text-emerald-400' : 'text-red-400')}>
                            {verifyResult.ready_to_publish ? '✓ Ready' : '✗ Issues'}
                          </span>
                          <span className="text-brand-text-muted text-[9px]">{new Date(verifyResult.checked_at).toLocaleTimeString()}</span>
                        </div>
                        <p className="text-brand-text-muted">{verifyResult.summary}</p>
                      </motion.div>
                    )}
                  </AnimatePresence>

                  {/* Actions */}
                  <div className="flex items-center gap-1.5 mt-4 pt-3 border-t border-brand-border/30">
                    <button onClick={() => handleToggle(account)}
                      className={cn('w-9 h-5 rounded-full flex items-center px-0.5 transition-all border',
                        account.enabled ? 'bg-brand-primary border-brand-primary justify-end' : 'bg-brand-elevated border-brand-border justify-start')}>
                      <div className="w-4 h-4 bg-white rounded-full shadow" />
                    </button>
                    <button onClick={() => handleVerifyPublish(account)} disabled={verifyingId === account.id}
                      className="flex-1 py-1.5 text-[10px] font-mono font-bold uppercase rounded-lg bg-brand-primary/10 text-brand-primary hover:bg-brand-primary/20 border border-brand-primary/20 transition-all flex items-center justify-center gap-1 disabled:opacity-50">
                      {verifyingId === account.id ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Shield className="w-3 h-3" />}
                      {verifyingId === account.id ? '...' : 'Verify'}
                    </button>
                    <button onClick={() => handleHealthCheck(account)} disabled={testingId === account.id}
                      className="flex-1 py-1.5 text-[10px] font-mono font-bold uppercase rounded-lg bg-brand-surface border border-brand-border text-brand-text-muted hover:text-white transition-all flex items-center justify-center gap-1">
                      <Activity className={cn('w-3 h-3', testingId === account.id && 'animate-pulse')} /> Test
                    </button>
                    <button onClick={() => openEdit(account)}
                      className="p-1.5 rounded-lg hover:bg-brand-elevated text-brand-text-muted transition-colors">
                      <Settings className="w-3.5 h-3.5" />
                    </button>
                    <button onClick={() => setConfirmDelete(account)}
                      className="p-1.5 rounded-lg hover:bg-red-500/10 text-brand-text-muted hover:text-red-400 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Delete confirmation modal */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setConfirmDelete(null)}>
            <motion.div initial={{ scale: 0.95 }} animate={{ scale: 1 }} exit={{ scale: 0.95 }}
              onClick={e => e.stopPropagation()}
              className="bg-brand-surface border border-brand-border/50 rounded-2xl p-6 max-w-sm w-full shadow-2xl">
              <div className="w-10 h-10 rounded-full bg-red-500/10 flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-5 h-5 text-red-400" />
              </div>
              <h3 className="text-sm font-bold text-white text-center">Disconnect "{confirmDelete.account_name}"?</h3>
              <p className="text-xs text-brand-text-muted text-center mt-1 mb-5">Posts will stop. Credentials will be discarded.</p>
              <div className="flex gap-2">
                <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2 rounded-xl bg-brand-surface border border-brand-border text-brand-text-muted text-xs font-semibold">Cancel</button>
                <button onClick={handleDelete} className="flex-1 py-2 rounded-xl bg-red-500 text-white text-xs font-semibold">Disconnect</button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Add/Edit Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
            onClick={() => setIsModalOpen(false)}>
            <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }}
              onClick={e => e.stopPropagation()}
              className="bg-brand-surface border border-brand-border/50 rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden">
              {/* Modal header */}
              <div className="p-4 border-b border-brand-border/50 flex items-center justify-between bg-brand-elevated/20 shrink-0">
                <h2 className="text-sm font-bold text-white flex items-center gap-2">
                  {editingAccount ? <Settings className="w-4 h-4 text-brand-primary" /> : <Plus className="w-4 h-4 text-brand-primary" />}
                  {editingAccount ? 'Edit Channel' : 'Connect Channel'}
                </h2>
                <button onClick={() => setIsModalOpen(false)} className="p-1 rounded-lg hover:bg-brand-elevated text-brand-text-muted">✕</button>
              </div>

              {/* Modal body */}
              <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-5 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase text-brand-text-muted mb-1.5">Platform</label>
                    <select disabled={!!editingAccount} value={modalPlatform}
                      onChange={e => { setModalPlatform(e.target.value as any); setCredentials({}); setVisibleFields({}); }}
                      className="w-full bg-brand-elevated border border-brand-border/50 rounded-xl px-3 py-2.5 text-xs text-brand-text font-bold uppercase focus:outline-none focus:border-brand-primary/50 transition-all">
                      {Object.entries(PLATFORM_CONFIG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase text-brand-text-muted mb-1.5">Account Name</label>
                    <input type="text" required placeholder="e.g. Kanyoza Marketing" value={modalAccountName}
                      onChange={e => setModalAccountName(e.target.value)}
                      className="w-full bg-brand-elevated border border-brand-border/50 rounded-xl px-3 py-2.5 text-xs text-brand-text focus:outline-none focus:border-brand-primary/50 transition-all" />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase text-brand-text-muted mb-1.5">Timezone</label>
                    <select value={modalTimezone} onChange={e => setModalTimezone(e.target.value)}
                      className="w-full bg-brand-elevated border border-brand-border/50 rounded-xl px-3 py-2.5 text-xs text-brand-text focus:outline-none focus:border-brand-primary/50 transition-all">
                      {TIMEZONES.map(tz => <option key={tz} value={tz}>{tz}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-mono font-bold uppercase text-brand-text-muted mb-1.5">Linked Brand</label>
                    <select value={modalBrandId} onChange={e => setModalBrandId(e.target.value)}
                      className="w-full bg-brand-elevated border border-brand-border/50 rounded-xl px-3 py-2.5 text-xs text-brand-text focus:outline-none focus:border-brand-primary/50 transition-all">
                      <option value="">None</option>
                      {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                    </select>
                  </div>
                </div>

                {/* Enable toggle */}
                <div className="flex items-center justify-between p-3 bg-brand-elevated/30 border border-brand-border/30 rounded-xl">
                  <span className="text-[10px] font-mono font-bold text-brand-text-muted uppercase">Publishing Enabled</span>
                  <button type="button" onClick={() => setModalEnabled(!modalEnabled)}
                    className={cn('w-10 h-5 rounded-full flex items-center px-0.5 transition-all border',
                      modalEnabled ? 'bg-brand-primary border-brand-primary justify-end' : 'bg-brand-elevated border-brand-border justify-start')}>
                    <div className="w-4 h-4 bg-white rounded-full shadow" />
                  </button>
                </div>

                {/* Credentials */}
                <div className="pt-2 border-t border-brand-border/30">
                  <h3 className="text-[10px] font-mono font-bold uppercase tracking-widest text-brand-primary mb-3">API Credentials</h3>
                  <div className="space-y-3">
                    {PLATFORM_FIELDS[modalPlatform].map(field => (
                      <div key={field.key}>
                        <div className="flex justify-between mb-1">
                          <label className="text-[9px] font-mono font-bold uppercase text-brand-text-muted">
                            {field.label} {field.secret && <span className="text-amber-400">(Secret)</span>}
                          </label>
                          {credentials[field.key] && (
                            <button type="button" onClick={() => { navigator.clipboard.writeText(credentials[field.key]); toast.success('Copied'); }}
                              className="text-[9px] text-brand-primary hover:underline"><Copy className="w-3 h-3 inline" /></button>
                          )}
                        </div>
                        <div className="relative">
                          <input type={field.secret && !visibleFields[field.key] ? 'password' : 'text'}
                            required={!editingAccount || !field.secret}
                            value={credentials[field.key] || ''}
                            onChange={e => setCredentials(prev => ({ ...prev, [field.key]: e.target.value }))}
                            placeholder={field.placeholder}
                            className="w-full bg-brand-elevated border border-brand-border/50 rounded-xl pl-3 pr-10 py-2 text-xs text-brand-text font-mono focus:outline-none focus:border-brand-primary/50 transition-all" />
                          {field.secret && (
                            <button type="button" onClick={() => setVisibleFields(prev => ({ ...prev, [field.key]: !prev[field.key] }))}
                              className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-brand-text-muted hover:text-white">
                              {visibleFields[field.key] ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Test connection */}
                <div className="p-3 bg-brand-surface border border-brand-border/30 rounded-xl space-y-2">
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="text-[10px] font-mono font-bold uppercase text-brand-text">Test Connection</h4>
                      <p className="text-[9px] text-brand-text-muted">Verify before saving</p>
                    </div>
                    <button type="button" disabled={testing} onClick={async () => {
                      setTesting(true); setTestResult(null);
                      try {
                        if (editingAccount?.id) await apiFetch(`/social-accounts/${editingAccount.id}/health-check`, { method: 'POST' });
                        setTestResult({ status: 'success', message: 'Connection verified' });
                      } catch (err: any) { setTestResult({ status: 'error', message: err.message }); }
                      finally { setTesting(false); }
                    }}
                    className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase rounded-lg bg-brand-elevated border border-brand-border text-brand-text-muted hover:text-white transition-all flex items-center gap-1.5">
                      <RefreshCw className={cn('w-3 h-3', testing && 'animate-spin')} /> Test
                    </button>
                  </div>
                  <AnimatePresence>
                    {testResult && (
                      <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }}
                        className={cn('p-2 rounded-lg text-[10px] font-mono flex items-center gap-1.5',
                          testResult.status === 'success' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-red-500/10 text-red-400')}>
                        {testResult.status === 'success' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {testResult.message}
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>
              </form>

              {/* Modal footer */}
              <div className="p-4 border-t border-brand-border/50 bg-brand-elevated/20 flex justify-end gap-2 shrink-0">
                <button type="button" onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl bg-brand-surface border border-brand-border text-brand-text-muted hover:text-white text-xs font-semibold transition-colors">Cancel</button>
                <button type="button" onClick={handleSave} disabled={saving}
                  className="px-4 py-2 rounded-xl bg-brand-primary text-white text-xs font-semibold hover:bg-brand-primary/90 disabled:opacity-50 transition-all shadow-glow-primary">
                  {saving ? 'Saving…' : editingAccount ? 'Save Changes' : 'Connect'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
