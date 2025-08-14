// Resolve API base URL at build-time via Vite/SvelteKit public env
// Prefer PUBLIC_API_BASE_URL, then VITE_API_BASE_URL, with sensible fallbacks

// NOTE: In static deployments, $env/dynamic/public is not available at runtime,
// so we rely on import.meta.env which is replaced at build-time.
const PUBLIC_API_BASE_URL = (import.meta as any)?.env?.PUBLIC_API_BASE_URL as string | undefined;
const VITE_API_BASE_URL = (import.meta as any)?.env?.VITE_API_BASE_URL as string | undefined;

export const isDevelopment = typeof window !== 'undefined' && window.location.hostname === 'localhost';
export const isProduction = !isDevelopment;

export const getApiBase = () => {
  const fromEnv = PUBLIC_API_BASE_URL || VITE_API_BASE_URL;
  if (fromEnv && typeof fromEnv === 'string' && fromEnv.startsWith('http')) {
    return fromEnv;
  }
  // Development fallback
  if (isDevelopment) {
    return 'http://localhost:3001/api';
  }
  // Production fallback (will be overridden by build arg in CI)
  return 'https://garage-door-backend-341270520862.us-central1.run.app/api';
};

export const API_BASE = getApiBase();
