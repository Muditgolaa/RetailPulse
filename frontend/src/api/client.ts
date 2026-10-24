import axios from "axios";
import { useAuth } from "../store/auth";

// All requests go to /api; the Vite dev proxy forwards them to the backend.
export const api = axios.create({ baseURL: "/api", timeout: 15000 });

// Attach the JWT to every request.
api.interceptors.request.use((config) => {
  const token = useAuth.getState().token;
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// An expired or revoked token signs the user out; route guards then send them to /login.
api.interceptors.response.use(
  (res) => res,
  (err: unknown) => {
    if (axios.isAxiosError(err)) {
      const url = err.config?.url ?? "";
      const isLogin = url.startsWith("/auth/login") || url.startsWith("/auth/demo");
      if (err.response?.status === 401 && !isLogin && useAuth.getState().token) useAuth.getState().signOut();
    }
    return Promise.reject(err);
  },
);

type ApiErrorBody = { error?: string; detail?: string; message?: string; details?: Record<string, string[]> };

export const httpStatus = (err: unknown) => (axios.isAxiosError(err) ? err.response?.status : undefined);

const BACKEND_DOWN = "Can't reach the backend. Start it with `npm run dev` in backend/ (port 4000).";

// Turns any API error into one sentence a person can act on.
export function errorMessage(err: unknown): string {
  if (!axios.isAxiosError<ApiErrorBody>(err) || !err.response) return BACKEND_DOWN;
  const { status, data } = err.response;
  // The Vite dev proxy answers 502/503/504 when nothing is listening on port 4000.
  if (status >= 502 && status <= 504) return BACKEND_DOWN;
  if (status === 404 && data?.error === "Not found") return "This feature isn't connected to the server yet.";
  if (status === 401) return data?.error === "Invalid email or password" ? data.error : "Your session has ended. Please sign in again.";
  if (status === 403) return "Your account isn't allowed to do this.";
  if (status === 400 && data?.details) {
    const [field, messages] = Object.entries(data.details)[0] ?? [];
    if (field) return `${field}: ${messages?.[0] ?? "invalid value"}`;
  }
  return data?.detail || data?.error || data?.message || `Request failed (${status}).`;
}
