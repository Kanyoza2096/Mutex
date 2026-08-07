import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { useStore } from '../store/useStore';
import ParticleBackground from '../components/ParticleBackground';
import {
  Shield, Fingerprint, AlertCircle, Zap, Eye, EyeOff,
  ChevronRight, Hexagon, Key, Mail,
} from 'lucide-react';
import { cn } from '../lib/utils';
import { toast } from 'sonner';

// ── Hex grid pattern ────────────────────────────────────────────────────────

function HexGrid() {
  return (
    <div className="absolute inset-0 pointer-events-none overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.025]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M30 5L55 20v30L30 65 5 50V20L30 5z' fill='none' stroke='%234F46E5' stroke-width='0.8'/%3E%3C/svg%3E")`,
          backgroundSize: '42px 42px',
        }}
      />
    </div>
  );
}

// ── Typing animation with proper cleanup ────────────────────────────────────

function useTypingPlaceholder(text: string, speed = 80) {
  const [display, setDisplay] = useState('');
  const indexRef = useRef(0);
  const pauseRef = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    const interval = setInterval(() => {
      setDisplay(text.slice(0, indexRef.current + 1));
      indexRef.current++;
      if (indexRef.current >= text.length) {
        clearInterval(interval);
        pauseRef.current = setTimeout(() => {
          indexRef.current = 0;
          setDisplay('');
        }, 2200);
      }
    }, speed);

    return () => {
      clearInterval(interval);
      if (pauseRef.current) clearTimeout(pauseRef.current);
    };
  }, [text, speed]);

  return display;
}

// ═══════════════════════════════════════════════════════════════════════════

export default function Login() {
  const { login } = useStore();
  const [email,          setEmail]          = useState('');
  const [password,       setPassword]       = useState('');
  const [showPassword,   setShowPassword]   = useState(false);
  const [isShake,        setIsShake]        = useState(false);
  const [loading,        setLoading]        = useState(false);
  const [error,          setError]          = useState<string | null>(null);
  const [step,           setStep]           = useState<'idle' | 'validating' | 'success' | 'error'>('idle');
  const [failedAttempts, setFailedAttempts] = useState(0);
  const passwordRef = useRef<HTMLInputElement>(null);
  const mountedRef = useRef(true);

  const typingPlaceholder = useTypingPlaceholder('operator@kanyoza.com', 65);

  // Cleanup on unmount
  useEffect(() => {
    return () => { mountedRef.current = false; };
  }, []);

  // Auto-clear error after timeout
  useEffect(() => {
    if (!error) return;
    const t = setTimeout(() => {
      if (mountedRef.current) { setError(null); setStep('idle'); }
    }, 5500);
    return () => clearTimeout(t);
  }, [error]);

  const handleEmailKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') { e.preventDefault(); passwordRef.current?.focus(); }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!email || !password) {
      setError('Operator ID and Passkey are required.');
      setIsShake(true);
      setTimeout(() => { if (mountedRef.current) setIsShake(false); }, 500);
      return;
    }

    setLoading(true);
    setError(null);
    setStep('validating');

    // Dev bypass — Supabase not configured
    if (!isSupabaseConfigured()) {
      localStorage.setItem('kanyoza_authenticated', 'true');
      setStep('success');
      setFailedAttempts(0);
      toast.success('Dev mode — access granted');
      setTimeout(() => { if (mountedRef.current) login(); }, 650);
      return;
    }

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({ email, password });

      if (authError) {
        const newAttempts = failedAttempts + 1;
        setFailedAttempts(newAttempts);

        if (authError.message.includes('Failed to fetch')) {
          setError('Authentication server unreachable. Please retry.');
        } else if (newAttempts >= 3) {
          setError('Multiple failed attempts. Verify credentials or reset your passkey.');
        } else {
          setError(authError.message);
        }

        setStep('error');
        setIsShake(true);
        setTimeout(() => { if (mountedRef.current) setIsShake(false); }, 500);
        return;
      }

      localStorage.setItem('kanyoza_authenticated', 'true');
      setFailedAttempts(0);
      setStep('success');
      toast.success('Access granted — welcome back');
      setTimeout(() => { if (mountedRef.current) login(); }, 800);
    } catch (err: any) {
      setError(err.message || 'Authentication failed.');
      setStep('error');
      setIsShake(true);
      setTimeout(() => { if (mountedRef.current) setIsShake(false); }, 500);
    } finally {
      if (mountedRef.current) setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-brand-bg">
      <ParticleBackground />
      <HexGrid />

      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_70%_at_50%_60%,transparent_40%,rgba(8,12,20,0.95)_100%)]" />

      {/* Ambient glow orbs — CSS-only for GPU performance */}
      <div className="absolute top-1/3 left-1/4 w-72 h-72 bg-brand-primary/8 rounded-full blur-3xl pointer-events-none animate-pulse" />
      <div className="absolute bottom-1/3 right-1/4 w-56 h-56 bg-brand-accent/8 rounded-full blur-3xl pointer-events-none animate-pulse" style={{ animationDelay: '1.5s', animationDuration: '6s' }} />

      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.65, ease: [0.25, 0.46, 0.45, 0.94] }}
        className="relative z-10 w-full max-w-md px-5"
      >
        <motion.div
          animate={isShake ? { x: [-10, 10, -7, 7, -3, 3, 0] } : {}}
          transition={{ duration: 0.45, ease: 'easeOut' }}
          className="rounded-3xl border border-brand-border/50 p-8 relative overflow-hidden"
          style={{
            backgroundColor: 'rgba(15, 22, 41, 0.96)',
            boxShadow: '0 0 80px rgba(79,70,229,0.08), 0 24px 64px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.04)',
          }}
        >
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-brand-primary/60 to-transparent" />

          {/* Logo */}
          <div className="flex flex-col items-center mb-8">
            <div
              className="w-20 h-20 bg-brand-elevated/60 rounded-2xl flex items-center justify-center mb-5
                         border border-brand-primary/25 relative overflow-hidden transition-shadow duration-500"
              style={{
                boxShadow: step === 'validating' ? '0 0 40px rgba(79,70,229,0.5)' :
                           step === 'success' ? '0 0 50px rgba(16,185,129,0.6)' :
                           '0 0 24px rgba(79,70,229,0.25)',
              }}
            >
              <div className={cn(
                'absolute inset-0 flex items-center justify-center opacity-20',
                step === 'validating' && 'animate-spin'
              )}
              style={{ animationDuration: '3.5s' }}
            >
                <Hexagon className="w-14 h-14 text-brand-primary" />
              </div>
              <Shield
                className={cn(
                  'w-9 h-9 relative z-10 transition-colors duration-300',
                  step === 'success' ? 'text-brand-success' : 'text-brand-primary'
                )}
              />
            </div>

            <h1 className="text-2xl font-bold text-white tracking-tight">
              Kanyoza<span className="text-brand-primary">Command</span>
            </h1>
            <p className="text-brand-text-muted text-[10px] mt-2 font-mono tracking-[0.2em] uppercase flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-brand-danger animate-pulse" />
              Authorized Personnel Only
            </p>
          </div>

          {/* Error banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0, marginBottom: 0 }}
                animate={{ opacity: 1, height: 'auto', marginBottom: 20 }}
                exit={{ opacity: 0, height: 0, marginBottom: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-brand-danger/5 border border-brand-danger/20 rounded-xl p-3.5 flex items-start gap-3 relative overflow-hidden">
                  <div className="absolute left-0 top-0 bottom-0 w-0.5 bg-brand-danger/70 rounded-l-xl" />
                  <AlertCircle className="w-4 h-4 text-brand-danger mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-[10px] font-bold text-brand-danger uppercase tracking-wider mb-0.5">Authentication Failed</p>
                    <p className="text-xs text-brand-text-muted font-mono">{error}</p>
                  </div>
                  <button onClick={() => { setError(null); setStep('idle'); }}
                    className="text-brand-text-muted/50 hover:text-brand-text-muted transition-colors flex-shrink-0 mt-0.5">
                    <ChevronRight className="w-4 h-4 rotate-45" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="flex items-center gap-1.5 text-[10px] font-bold text-brand-text-muted uppercase tracking-[0.15em] mb-2">
                <Mail className="w-3 h-3" /> Operator ID
              </label>
              <div className="relative group">
                <input
                  type="email" value={email}
                  onChange={e => { setEmail(e.target.value); setError(null); setStep('idle'); }}
                  onKeyDown={handleEmailKeyDown}
                  className="w-full border border-brand-border/60 rounded-xl px-4 py-3.5 pr-10 text-brand-text placeholder-brand-text-muted/35 font-mono text-sm focus:outline-none focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/15 transition-all"
                  style={{ backgroundColor: 'rgba(8,12,20,0.7)' }}
                  placeholder={typingPlaceholder || 'operator@kanyoza.com'}
                  autoComplete="email" autoFocus required
                />
                <ChevronRight className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-brand-text-muted/20 group-focus-within:text-brand-primary/40 transition-colors" />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-2">
                <label className="flex items-center gap-1.5 text-[10px] font-bold text-brand-text-muted uppercase tracking-[0.15em]">
                  <Key className="w-3 h-3" /> Passkey
                </label>
                <button type="button" tabIndex={-1}
                  className="text-[10px] text-brand-primary/60 hover:text-brand-primary transition-colors font-semibold">
                  Reset Protocol?
                </button>
              </div>
              <div className="relative group">
                <input
                  ref={passwordRef} type={showPassword ? 'text' : 'password'}
                  value={password} onChange={e => { setPassword(e.target.value); setError(null); setStep('idle'); }}
                  className="w-full border border-brand-border/60 rounded-xl px-4 py-3.5 pr-12 text-brand-text placeholder-brand-text-muted/35 font-mono text-sm focus:outline-none focus:border-brand-primary/60 focus:ring-2 focus:ring-brand-primary/15 transition-all"
                  style={{ backgroundColor: 'rgba(8,12,20,0.7)' }}
                  placeholder="••••••••••••" autoComplete="current-password" required
                />
                <button type="button" onClick={() => setShowPassword(v => !v)} tabIndex={-1}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-brand-text-muted/40 hover:text-brand-text-muted transition-colors">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input type="checkbox" defaultChecked
                  className="w-4 h-4 rounded border-brand-border bg-brand-bg text-brand-primary focus:ring-brand-primary focus:ring-offset-0 cursor-pointer" />
                <span className="text-xs text-brand-text-muted group-hover:text-brand-text transition-colors font-medium">Maintain active session</span>
              </label>
              <div className="text-[9px] font-mono text-brand-text-muted/40 flex items-center gap-1.5">
                <span className="w-1.5 h-1.5 rounded-full bg-brand-success/50" />
                Secured by Supabase
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className={cn(
                'w-full rounded-xl py-3.5 px-4 font-bold tracking-wider transition-all flex items-center justify-center relative overflow-hidden text-sm uppercase text-white',
                step === 'success' ? 'bg-brand-success' : 'bg-brand-primary hover:bg-brand-primary/90'
              )}
              style={{
                boxShadow: step === 'success'
                  ? '0 0 32px rgba(16,185,129,0.4)'
                  : '0 0 32px rgba(79,70,229,0.35)',
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/8 to-transparent -translate-x-full hover:translate-x-full transition-transform duration-1000" />
              <span className="relative z-10 flex items-center gap-2.5">
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/25 border-t-white rounded-full animate-spin" />
                    Authenticating…
                  </>
                ) : step === 'success' ? (
                  <>
                    <div className="w-5 h-5 bg-white rounded-full flex items-center justify-center">
                      <ChevronRight className="w-3 h-3 text-brand-success" />
                    </div>
                    Access Granted
                  </>
                ) : (
                  <>
                    <Fingerprint className="w-5 h-5 opacity-70" />
                    Enter Command Center
                    <ChevronRight className="w-4 h-4" />
                  </>
                )}
              </span>
            </button>
          </form>

          <p className="mt-5 text-[10px] text-brand-text-muted/25 text-center font-mono tracking-wide">
            Press <kbd className="px-1.5 py-0.5 bg-brand-elevated/50 border border-brand-border/50 rounded text-brand-text-muted/40 font-mono">Enter</kbd> to authenticate
          </p>

          <div className="absolute bottom-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-brand-border/60 to-transparent" />
        </motion.div>
      </motion.div>

      {/* Footer */}
      <div className="absolute bottom-5 left-0 w-full flex flex-col items-center gap-1.5 text-brand-text-muted/25 font-mono text-[9px] tracking-widest pointer-events-none select-none">
        <div className="flex items-center gap-2">
          <Zap className="w-3 h-3 text-brand-primary/40" />
          <span className="uppercase">Kanyoza Systems AI Platform v12</span>
        </div>
        <span>End-to-End Encrypted · Zero-Trust Architecture</span>
      </div>
    </div>
  );
}
