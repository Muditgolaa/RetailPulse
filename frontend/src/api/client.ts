import axios, { type InternalAxiosRequestConfig } from "axios";
import { useAuth } from "../store/auth";

// All requests go to /api; the Vite dev proxy forwards them to the backend.
export const api = axios.create({ baseURL: "/api", timeout: 15000 });

// Attach the JWT to every request.
api.interceptors.request.use((config) => {
  const token = useAuth.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// True when the server never answered: offline, timed out, or a proxy saying the backend is down
// (the hosted server sleeps when idle and takes up to a minute to wake).
export function isNoReply(err: unknown): boolean {
  if (!axios.isAxiosError(err)) return false;
  const status = err.response?.status;
  return status === undefined || (status >= 502 && status <= 504);
}

const READ_RETRY_DELAYS_MS = [2000, 5000, 10000];
type RetryConfig = InternalAxiosRequestConfig & { retryCount?: number };
const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

api.interceptors.response.use(
  (res) => res,
  async (err: unknown) => {
    if (axios.isAxiosError(err)) {
      // Reads are safe to repeat, so retry them while the server wakes up. Writes are never retried,
      // because a request that timed out may still have been carried out (an order, an approval).
      const config = err.config as RetryConfig | undefined;
      const attempt = config?.retryCount ?? 0;
      if (config && config.method === "get" && isNoReply(err) && attempt < READ_RETRY_DELAYS_MS.length) {
        config.retryCount = attempt + 1;
        await wait(READ_RETRY_DELAYS_MS[attempt]);
        return api.request(config);
      }

      // An expired or revoked token signs the user out; route guards then send them to /login.
      const url = config?.url ?? "";
      const isLogin = url.startsWith("/auth/login") || url.startsWith("/auth/demo");
      if (err.response?.status === 401 && !isLogin && useAuth.getState().token) useAuth.getState().signOut();
    }
    return Promise.reject(err);
  },
);

type ApiErrorBody = { error?: string; detail?: string; message?: string; details?: Record<string, string[]> };

export const httpStatus = (err: unknown) => (axios.isAxiosError(err) ? err.response?.status : undefined);

const BACKEND_DOWN = import.meta.env.DEV
  ? "Can't reach the backend. Start it with `npm run dev` in backend/ (port 4000)."
  : "The server didn't respond. It may be waking up after being idle, which takes up to a minute. Please try again shortly.";

// Turns any API error into one sentence a person can act on.
export function errorMessage(err: unknown): string {
  if (!axios.isAxiosError<ApiErrorBody>(err) || !err.response || isNoReply(err)) return BACKEND_DOWN;
  const { status, data } = err.response;
  if (status === 404 && data?.error === "Not found") return "This feature isn't connected to the server yet.";
  if (status === 401) return data?.error === "Invalid email or password" ? data.error : "Your session has ended. Please sign in again.";
  if (status === 403) return "Your account isn't allowed to do this.";
  if (status === 400 && data?.details) {
    const [field, messages] = Object.entries(data.details)[0] ?? [];
    if (field) return `${field}: ${messages?.[0] ?? "invalid value"}`;
  }
  return data?.detail || data?.error || data?.message || `Request failed (${status}).`;
}
