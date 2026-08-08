import { useStore, type HttpLog } from '../store/useStore';
import { supabase, isSupabaseConfigured } from './supabase';

// Guard against double-patching (React StrictMode / HMR re-evaluation)
if (!(window.fetch as any).__kanyozaPatched) {
  const originalFetch = window.fetch;

  const patchedFetch = async function (this: any, input: RequestInfo | URL, init?: RequestInit) {
    const url = typeof input === 'string' ? input : (input instanceof Request ? input.url : String(input));
    const method = init?.method || 'GET';
    const timestamp = Date.now();
    const id = `http_${timestamp}_${Math.floor(Math.random() * 10000)}`;
    const page = window.location.pathname;

    const state = useStore.getState();
    const restEndpoint = state.restEndpoint || '';
    const masterToken = state.masterToken || localStorage.getItem('master_token') || '';
    const cleanBase = restEndpoint.replace(/\/+$/, '');

    // Determine if this is a call to our backend
    const backendHost = cleanBase ? new URL(cleanBase).host : '';
    const requestHost = url.startsWith('http') ? new URL(url).host : '';
    const isSameOrigin = !url.startsWith('http') || requestHost === backendHost;

    // Intercept all requests to our backend, including non-/api/v1 routes
    // like /director, /meta, /email, /health
    const isApiCall =
      isSameOrigin && (
        url.includes('/api/v1') ||
        url.startsWith('/api/') ||
        url.startsWith('/director') ||
        url.startsWith('/meta') ||
        url.startsWith('/email') ||
        url.startsWith('/health') ||
        url.startsWith('/monitoring') ||
        url.startsWith('/logs') ||
        url.startsWith('/metrics') ||
        url.startsWith('/workflow') ||
        url.startsWith('/guardian') ||
        url.startsWith('/system') ||
        url.startsWith('/persona') ||
        (cleanBase !== '' && url.startsWith(cleanBase))
      );

    if (!isApiCall) {
      return originalFetch.apply(this, [input, init] as any);
    }

    // Prefer the authenticated user's Supabase JWT over the shared master token.
    let bearerToken = masterToken;
    if (isSupabaseConfigured()) {
      try {
        const { data } = await supabase.auth.getSession();
        const jwt = data.session?.access_token;
        if (jwt) bearerToken = jwt;
      } catch { /* fall through to masterToken */ }
    }

    // Inject auth header automatically
    const headers = new Headers(init?.headers);
    if (bearerToken && !headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${bearerToken}`);
    }
    // Only inject Content-Type for non-multipart requests
    const existingCT = headers.get('Content-Type') || '';
    if (!existingCT && !String(init?.body instanceof FormData ? 'multipart' : '').includes('multipart')) {
      headers.set('Content-Type', 'application/json');
    }

    const modifiedInit: RequestInit = { ...init, headers };

    const log: HttpLog = { id, timestamp, url, method, page };

    try {
      const response = await originalFetch.apply(this, [input, modifiedInit] as any);
      log.status = response.status;
      log.statusText = response.statusText;
      if (!response.ok) {
        log.error = `HTTP Error ${response.status}: ${response.statusText || 'Error response'}`;
      }
      useStore.getState().addHttpLog(log);
      return response;
    } catch (err: any) {
      const errMsg = err?.message || String(err) || 'Failed to fetch / Connection Error';
      log.error = errMsg;
      useStore.getState().addHttpLog(log);
      throw err;
    }
  } as typeof fetch;

  (patchedFetch as any).__kanyozaPatched = true;
  window.fetch = patchedFetch;
}
