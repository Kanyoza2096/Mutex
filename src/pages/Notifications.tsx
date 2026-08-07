import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useStore } from '../store/useStore';
import { 
  Bell, Check, RefreshCw, AlertTriangle, CheckCheck, Info, AlertCircle, 
  Zap, Clock, Filter, Trash2, Mail, MailOpen
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

interface NotificationEntry {
  id: string | number;
  title?: string; message?: string; type?: string;
  read?: boolean; created_at?: string;
}

const TYPE_CONFIG: Record<string, { icon: React.ComponentType<any>; color: string; bg: string; border: string; label: string }> = {
  error:   { icon: AlertCircle,  color: 'text-red-400',    bg: 'bg-red-500/10',    border: 'border-red-500/20',    label: 'Error' },
  warning: { icon: AlertTriangle, color: 'text-amber-400',  bg: 'bg-amber-500/10',  border: 'border-amber-500/20',  label: 'Warning' },
  success: { icon: Check,        color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20', label: 'Success' },
  info:    { icon: Info,         color: 'text-sky-400',    bg: 'bg-sky-500/10',    border: 'border-sky-500/20',    label: 'Info' },
};

const DEFAULT_TYPE = { icon: Zap, color: 'text-brand-primary', bg: 'bg-brand-primary/10', border: 'border-brand-primary/20', label: 'System' };

function timeAgo(dateStr?: string) {
  if (!dateStr) return '';
  const diff = Math.max(0, Date.now() - new Date(dateStr).getTime());
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  return `${Math.floor(hrs / 24)}d ago`;
}

const SkeletonRow = () => (
  <div className="flex items-start gap-4 p-4 rounded-xl border border-brand-border/30 bg-brand-surface animate-pulse">
    <div className="w-8 h-8 bg-brand-elevated rounded-full" />
    <div className="flex-1 space-y-2">
      <div className="h-4 w-48 bg-brand-elevated rounded" />
      <div className="h-3 w-full bg-brand-elevated rounded" />
      <div className="h-3 w-24 bg-brand-elevated rounded" />
    </div>
  </div>
);

export default function Notifications() {
  const { restEndpoint, masterToken } = useStore();
  const headers: Record<string, string> = masterToken ? { Authorization: `Bearer ${masterToken}` } : {};
  const base = restEndpoint.replace(/\/+$/, '');

  const [notifications, setNotifications] = useState<NotificationEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<'all' | 'unread'>('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  const fetchNotifs = async () => {
    setLoading(true); setError(null);
    try {
      const res = await fetch(`${base}/notifications?limit=50`, { headers });
      if (res.ok) {
        const data = await res.json();
        setNotifications(data.notifications || []);
      } else throw new Error('Failed to fetch');
    } catch (err: any) { setError(err.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { fetchNotifs(); }, [restEndpoint]);

  const markRead = async (id: string | number) => {
    setActionLoading(String(id));
    try {
      await fetch(`${base}/notifications/${id}/read`, { method: 'POST', headers });
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, read: true } : n));
      toast.success('Marked as read');
    } catch { toast.error('Failed to mark as read'); }
    finally { setActionLoading(null); }
  };

  const markAllRead = async () => {
    setActionLoading('all');
    try {
      await Promise.all(unread.map(n => fetch(`${base}/notifications/${n.id}/read`, { method: 'POST', headers })));
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      toast.success('All marked as read');
    } catch { toast.error('Failed to mark all'); }
    finally { setActionLoading(null); }
  };

  const unread = notifications.filter(n => !n.read);
  const displayed = useMemo(() => {
    let result = filter === 'unread' ? unread : notifications;
    if (typeFilter !== 'all') result = result.filter(n => (n.type || 'system') === typeFilter);
    return result;
  }, [notifications, filter, typeFilter, unread]);

  const typeCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    notifications.forEach(n => {
      const t = n.type || 'system';
      counts[t] = (counts[t] || 0) + 1;
    });
    return counts;
  }, [notifications]);

  return (
    <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5 pb-24 max-w-3xl mx-auto">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-brand-primary/10 rounded-xl border border-brand-primary/20 relative">
            <Bell className="w-5 h-5 text-brand-primary" />
            {unread.length > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-[8px] font-bold text-white ring-2 ring-brand-surface">
                {unread.length > 9 ? '9+' : unread.length}
              </span>
            )}
          </div>
          <div>
            <h1 className="text-xl font-bold text-white tracking-tight">Notifications</h1>
            <p className="text-[10px] text-brand-text-muted font-mono uppercase tracking-wider mt-0.5">
              {notifications.length} total · {unread.length} unread
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {unread.length > 0 && (
            <button onClick={markAllRead} disabled={actionLoading === 'all'}
              className="flex items-center gap-2 px-3.5 py-2 rounded-xl bg-brand-surface border border-brand-border hover:border-brand-primary/30 text-brand-text-muted hover:text-white text-xs font-bold font-mono uppercase tracking-wider transition-all disabled:opacity-50">
              {actionLoading === 'all' ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <CheckCheck className="w-3.5 h-3.5" />}
              Mark All Read
            </button>
          )}
          <button onClick={fetchNotifs} className="p-2 rounded-xl bg-brand-surface border border-brand-border hover:border-brand-primary/30 text-brand-text-muted hover:text-white transition-all">
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-2 flex-wrap">
        <div className="flex gap-0.5 p-0.5 bg-brand-surface border border-brand-border/50 rounded-xl">
          {(['all', 'unread'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className={cn('px-3.5 py-1.5 rounded-lg text-[10px] font-mono font-bold uppercase transition-all',
                filter === f ? 'bg-brand-primary text-white shadow-glow-primary' : 'text-brand-text-muted hover:text-white')}>
              {f === 'all' ? `All (${notifications.length})` : `Unread (${unread.length})`}
            </button>
          ))}
        </div>
        <div className="flex gap-0.5 p-0.5 bg-brand-surface border border-brand-border/50 rounded-xl">
          {['all', 'error', 'warning', 'success', 'info'].map(t => {
            const config = t === 'all' ? { icon: Bell, label: 'All' } : (TYPE_CONFIG[t] || DEFAULT_TYPE);
            const Icon = config.icon;
            return (
              <button key={t} onClick={() => setTypeFilter(t)}
                className={cn('px-2.5 py-1.5 rounded-lg text-[9px] font-mono font-bold uppercase transition-all flex items-center gap-1.5',
                  typeFilter === t ? 'bg-brand-primary text-white' : 'text-brand-text-muted hover:text-white')}>
                <Icon className="w-3 h-3" /> {config.label}
                {t !== 'all' && typeCounts[t] ? <span className="opacity-60">({typeCounts[t]})</span> : null}
              </button>
            );
          })}
        </div>
      </div>

      {/* List */}
      {loading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <SkeletonRow key={i} />)}</div>
      ) : error ? (
        <div className="py-16 text-center">
          <AlertCircle className="w-10 h-10 text-red-400 mx-auto mb-3 opacity-50" />
          <p className="text-sm text-brand-text-muted font-mono">{error}</p>
          <button onClick={fetchNotifs} className="mt-3 text-xs text-brand-primary hover:underline">Retry</button>
        </div>
      ) : displayed.length === 0 ? (
        <div className="py-16 text-center border-2 border-dashed border-brand-border/50 rounded-2xl">
          <Bell className="w-10 h-10 text-brand-text-muted/30 mx-auto mb-3" />
          <p className="text-sm text-brand-text-muted font-mono">
            {filter === 'unread' ? 'No unread notifications.' : 'No notifications yet.'}
          </p>
        </div>
      ) : (
        <AnimatePresence mode="wait">
          {displayed.map((n, idx) => {
            const config = TYPE_CONFIG[n.type || ''] || DEFAULT_TYPE;
            const Icon = config.icon;
            return (
              <motion.div key={n.id} layout
                initial={{ opacity: 0, x: -12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 12 }}
                transition={{ delay: idx * 0.02 }}
                className={cn(
                  'flex items-start gap-4 p-4 rounded-xl border transition-all group',
                  config.bg, config.border,
                  n.read && 'opacity-50 hover:opacity-80'
                )}>
                <div className={cn('p-2 rounded-full flex-shrink-0', config.bg)}>
                  <Icon className={cn('w-4 h-4', config.color)} />
                </div>
                <div className="flex-1 min-w-0">
                  {n.title && <p className="text-sm font-bold text-white mb-0.5">{n.title}</p>}
                  {n.message && <p className="text-xs text-brand-text-muted leading-relaxed">{n.message}</p>}
                  <div className="flex items-center gap-3 mt-2">
                    <span className="text-[9px] font-mono text-brand-text-muted flex items-center gap-1">
                      <Clock className="w-3 h-3" /> {timeAgo(n.created_at)}
                    </span>
                    <span className={cn('px-1.5 py-0.5 rounded text-[8px] font-mono font-bold uppercase', config.bg, config.color, config.border)}>
                      {config.label}
                    </span>
                  </div>
                </div>
                {!n.read && (
                  <button onClick={() => markRead(n.id)} disabled={actionLoading === String(n.id)}
                    className="p-1.5 rounded-lg hover:bg-brand-elevated text-brand-text-muted hover:text-emerald-400 transition-all flex-shrink-0 opacity-0 group-hover:opacity-100 disabled:opacity-50"
                    title="Mark as read">
                    {actionLoading === String(n.id) ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <MailOpen className="w-3.5 h-3.5" />}
                  </button>
                )}
                {n.read && (
                  <div className="p-1.5 flex-shrink-0 opacity-0 group-hover:opacity-100">
                    <Mail className="w-3.5 h-3.5 text-brand-text-muted/50" />
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      )}
    </motion.div>
  );
}
