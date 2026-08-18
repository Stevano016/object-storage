/**
 * In production the API is served from the same origin as the dashboard.
 * During development Vite runs on 5173 while the backend stays on 5000.
 * Lives outside AuthContext so anonymous pages (share links) can use it too.
 */
export function resolveApiUrl(): string {
  if (import.meta.env.VITE_API_URL) return import.meta.env.VITE_API_URL;
  return window.location.hostname === 'localhost' ? 'http://localhost:5000' : window.location.origin;
}
