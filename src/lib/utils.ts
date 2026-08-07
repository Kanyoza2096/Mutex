import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function vibrate(pattern: number | number[] = 50) {
  if (typeof navigator !== 'undefined' && navigator.vibrate) {
    navigator.vibrate(pattern);
  }
}

export async function nativeShare(title: string, text: string, url: string) {
  if (typeof navigator !== 'undefined' && navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return true;
    } catch (err) {
      console.log('Share failed:', err);
      return false;
    }
  }
  return false;
}

/**
 * fetch() with a hard timeout so a cold-starting/unreachable backend
 * (e.g. free-tier Render services) fails fast with a clear error
 * instead of hanging the UI in a perpetual loading state.
 */
export async function fetchWithTimeout(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 15000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: init.signal ?? controller.signal });
  } catch (err: any) {
    if (err?.name === 'AbortError') {
      throw new Error(`Request timed out after ${Math.round(timeoutMs / 1000)}s — the server may be cold-starting.`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

export function setAppBadge(count: number) {
  if (typeof navigator !== 'undefined' && 'setAppBadge' in navigator) {
    if (count > 0) {
      (navigator as any).setAppBadge(count).catch(console.error);
    } else if ('clearAppBadge' in navigator) {
      (navigator as any).clearAppBadge().catch(console.error);
    }
  }
}
