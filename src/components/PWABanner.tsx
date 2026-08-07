import React, { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{
    outcome: 'accepted' | 'dismissed';
    platform: string;
  }>;
  prompt(): Promise<void>;
}

export function PWABanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return;

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
      if (!localStorage.getItem('pwa_prompt_dismissed')) setShow(true);
    };

    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setShow(false);
      setDeferredPrompt(null);
    }
  };

  const handleDismiss = () => {
    setShow(false);
    localStorage.setItem('pwa_prompt_dismissed', 'true');
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.95 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="fixed bottom-24 md:bottom-5 left-1/2 -translate-x-1/2 z-[999] 
                     flex items-center gap-3 px-4 py-3 bg-brand-surface/97 
                     border border-brand-primary/40 rounded-2xl shadow-2xl 
                     text-[11px] font-mono whitespace-nowrap"
        >
          <div className="w-8 h-8 rounded-full bg-brand-primary/20 flex items-center justify-center flex-shrink-0">
            <Download className="w-4 h-4 text-brand-primary" />
          </div>
          
          <div className="flex flex-col mr-2">
            <span className="font-bold text-white tracking-wide uppercase">Install Native App</span>
            <span className="text-[9px] text-brand-text-muted">Launch directly from homescreen</span>
          </div>

          <div className="flex items-center gap-2 ml-2 pl-3 border-l border-brand-border/50">
            <button onClick={handleDismiss} className="px-2 py-1.5 text-brand-text-muted hover:text-white transition-colors">
              <X className="w-4 h-4" />
            </button>
            <button onClick={handleInstall} className="px-3 py-1.5 bg-brand-primary text-white font-bold rounded-lg hover:bg-brand-primary/90 active:scale-95 transition-all shadow-lg">
              INSTALL
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
