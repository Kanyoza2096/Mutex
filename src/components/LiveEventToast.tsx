import React, { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { ShieldAlert, FileText, MessageSquare, Package, X, ExternalLink } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useStore } from '../store/useStore';
import { cn } from '../lib/utils';

export interface LiveNotification {
  id: string;
  type: 'alert' | 'post' | 'message' | 'payload';
  title: string;
  subtitle?: string;
  severity?: string;
}

const CONFIG = {
  alert: {
    icon: ShieldAlert,
    label: 'Security Alert',
    route: '/guardian',
    base: 'border-red-500/30 bg-gradient-to-br from-red-500/15 to-red-500/5',
    badge: 'bg-red-500/15 text-red-400 border-red-500/20',
    iconCls: 'text-red-400',
    progressBg: 'bg-red-400',
    glow: 'shadow-[0_0_30px_rgba(239,68,68,0.2)]',
  },
  post: {
    icon: FileText,
    label: 'Post Published',
    route: '/posts',
    base: 'border-violet-500/30 bg-gradient-to-br from-violet-500/15 to-violet-500/5',
    badge: 'bg-violet-500/15 text-violet-400 border-violet-500/20',
    iconCls: 'text-violet-400',
    progressBg: 'bg-violet-400',
    glow: 'shadow-[0_0_30px_rgba(139,92,246,0.2)]',
  },
  message: {
    icon: MessageSquare,
    label: 'New Message',
    route: '/messenger',
    base: 'border-sky-500/30 bg-gradient-to-br from-sky-500/15 to-sky-500/5',
    badge: 'bg-sky-500/15 text-sky-400 border-sky-500/20',
    iconCls: 'text-sky-400',
    progressBg: 'bg-sky-400',
    glow: 'shadow-[0_0_30px_rgba(14,165,233,0.2)]',
  },
  payload: {
    icon: Package,
    label: 'API Payload',
    route: '/payloads',
    base: 'border-amber-500/30 bg-gradient-to-br from-amber-500/15 to-amber-500/5',
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/20',
    iconCls: 'text-amber-400',
    progressBg: 'bg-amber-400',
    glow: 'shadow-[0_0_30px_rgba(245,158,11,0.2)]',
  },
} as const;

const AUTO_DISMISS_MS = 5000;

export default function LiveEventToast() {
  const notification = useStore(state => state.lastNotification);
  const dismiss = useStore(state => state.dismissNotification);
  const navigate = useNavigate();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!notification) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [notification?.id, dismiss]);

  const handleNavigate = () => {
    if (!notification) return;
    dismiss();
    navigate(CONFIG[notification.type].route);
  };

  const cfg = notification ? CONFIG[notification.type] : null;

  return (
    <AnimatePresence>
      {notification && cfg && (
        <motion.div
          key={notification.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.25, ease: [0.25, 0.1, 0.25, 1] }}
          className={cn(
            'fixed bottom-24 right-4 md:bottom-6 md:right-6 z-[100]',
            'w-[calc(100vw-2rem)] max-w-[360px]',
            'rounded-2xl border backdrop-blur-xl',
            'flex flex-col gap-3 p-4 font-mono text-xs',
            'cursor-pointer hover:brightness-110 transition-all',
            cfg.base, cfg.glow,
          )}
          onClick={handleNavigate}
        >
          {/* Header */}
          <div className="flex items-center justify-between">
            <span className={cn('px-2 py-0.5 rounded-full text-[8px] font-bold uppercase tracking-wider border', cfg.badge)}>
              {cfg.label}
            </span>
            <button
              onClick={e => { e.stopPropagation(); dismiss(); }}
              className="text-brand-text-muted/60 hover:text-white transition-colors p-1 rounded-lg hover:bg-white/5"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* Body */}
          <div className="flex items-start gap-3">
            <div className={cn('p-2 rounded-xl bg-white/5 flex-shrink-0', cfg.iconCls)}>
              <cfg.icon className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-bold text-white text-sm leading-snug">{notification.title}</p>
              {notification.subtitle && (
                <p className="text-[10px] text-brand-text-muted mt-1 uppercase tracking-wider">{notification.subtitle}</p>
              )}
            </div>
          </div>

          {/* Progress bar */}
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1 bg-white/5 rounded-full overflow-hidden">
              <motion.div
                className={cn('h-full rounded-full', cfg.progressBg)}
                initial={{ width: '100%' }}
                animate={{ width: '0%' }}
                transition={{ duration: AUTO_DISMISS_MS / 1000, ease: 'linear' }}
              />
            </div>
            <span className="text-[8px] font-mono text-brand-text-muted/50 flex items-center gap-1 flex-shrink-0">
              View <ExternalLink className="w-2.5 h-2.5" />
            </span>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
