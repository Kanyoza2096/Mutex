import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import './lib/fetchInterceptor.ts';
import App from './App.tsx';
import './index.css';

const isDev = import.meta.env.DEV;

// ── Visible error overlay (shows on screen — works without DevTools) ─────────
function showFatalError(message: string, detail?: string) {
  const el = document.createElement('div');
  el.style.cssText = [
    'position:fixed', 'inset:0', 'z-index:99999',
    'background:#0a0e17', 'color:#f87171',
    'font-family:monospace', 'font-size:13px',
    'padding:24px', 'overflow:auto',
    'white-space:pre-wrap', 'word-break:break-all',
  ].join(';');
  el.textContent = `[Kanyoza] STARTUP ERROR\n\n${message}${detail ? '\n\n' + detail : ''}`;
  document.body.appendChild(el);
}

window.onerror = (_msg, _src, _line, _col, err) => {
  showFatalError(String(_msg), err?.stack);
  return false;
};

window.onunhandledrejection = (e) => {
  const reason = e.reason instanceof Error
    ? `${e.reason.message}\n${e.reason.stack}`
    : String(e.reason);
  showFatalError('Unhandled promise rejection', reason);
};
// ─────────────────────────────────────────────────────────────────────────────

if (isDev) {
  console.log('[Kanyoza v12] Bootstrap starting. ReadyState:', document.readyState);
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 2,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 15_000),
      staleTime: 15_000,
      refetchOnWindowFocus: false,
    },
  },
});

const rootElement = document.getElementById('root');

if (!rootElement) {
  showFatalError('Root element #root not found in DOM.');
} else {
  try {
    createRoot(rootElement).render(
      <StrictMode>
        <QueryClientProvider client={queryClient}>
          <App />
        </QueryClientProvider>
      </StrictMode>,
    );
    if (isDev) {
      console.log('[Kanyoza v12] Application mounted successfully.');
    }
  } catch (err: unknown) {
    const e = err instanceof Error ? err : new Error(String(err));
    showFatalError(e.message, e.stack);
  }
}
