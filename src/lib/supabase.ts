import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const getSupabaseUrl = () => 
  localStorage.getItem('supabase_url') || import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-url.supabase.co';

export const getSupabaseKey = () => 
  localStorage.getItem('supabase_anon_key') || import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key';

const isRealValue = (val: string | undefined) =>
  !!val && !val.includes('placeholder') && val !== 'placeholder-key';

/**
 * Returns true if Supabase credentials are available (env vars OR localStorage).
 * Used for data-layer decisions (querying tables, etc.).
 */
export const isSupabaseConfigured = () => {
  const url = getSupabaseUrl();
  const key = getSupabaseKey();
  return isRealValue(url) && isRealValue(key);
};

/**
 * Returns true ONLY when Supabase credentials were baked in at build time via env vars.
 * Used for auth-gating decisions — NOT affected by user-editable localStorage so it
 * cannot be bypassed by a client manipulating their own storage.
 */
export const isSupabaseConfiguredFromEnv = () => {
  const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
  const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
  return isRealValue(url) && isRealValue(key);
};

let currentClient: SupabaseClient = createClient(getSupabaseUrl(), getSupabaseKey());

export const refreshSupabaseClient = () => {
  currentClient = createClient(getSupabaseUrl(), getSupabaseKey());
  return currentClient;
};

export const supabase = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    const client = currentClient as any;
    const value = client[prop];
    if (typeof value === 'function') {
      return value.bind(client);
    }
    return value;
  }
});

