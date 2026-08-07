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

    // Only intercept requests targeting our REST backend API.
    // IMPORTANT: `url.includes(cleanBase)` was intentionally removed — when
    // cleanBase is '' (restEndpoint not configured) that expression evaluates
    // to true for every URL, which would leak the Bearer token to CDNs,
    // Supabase, and any other external service the app calls.
    const isApiCall =
      url.includes('/api/v1') ||
      url.startsWith('/api/') ||
      (cleanBase !== '' && url.startsWith(cleanBase));

    if (!isApiCall) {
      return originalFetch.apply(this, [input, init] as any);
    }

    // Prefer the authenticated user's Supabase JWT over the shared master token.
    // This scopes backend requests to the authenticated operator rather than
    // relying on a single shared admin credential for all users of the console.
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
    // Only inject Content-Type for non-multipart requests — let the browser set
    // the boundary automatically for multipart/form-data file uploads.
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
