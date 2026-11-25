// HTTP client. The API base URL is configurable (VITE_API_BASE_URL); empty = same origin (relative /api).
import type { ErrorCode } from "@/shared/constants";
import type { PageMeta } from "@/shared/types";

const BASE = (import.meta.env.VITE_API_BASE_URL ?? "").replace(/\/$/, "");

let csrfToken: string | null = null;
export function setCsrfToken(token: string | null) {
  csrfToken = token;
}

let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(handler: () => void) {
  onUnauthorized = handler;
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: ErrorCode,
    message: string,
    readonly details?: unknown,
  ) {
    super(message);
  }
}

type Query = Record<string, string | number | boolean | null | undefined>;

export function buildQuery(query?: Query): string {
  if (!query) return "";
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === "" || v === false) continue;
    params.set(k, v === true ? "1" : String(v));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function apiUrl(path: string, query?: Query) {
  return `${BASE}${path}${buildQuery(query)}`;
}

async function request<T>(method: string, path: string, options: { query?: Query; body?: unknown; raw?: boolean } = {}): Promise<{ data: T; meta?: PageMeta }> {
  const headers: Record<string, string> = { Accept: "application/json" };
  let body: BodyInit | undefined;
  if (options.body instanceof FormData) body = options.body;
  else if (options.body !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.body);
  }
  if (method !== "GET" && csrfToken) headers["X-CSRF-Token"] = csrfToken;

  let res: Response;
  try {
    res = await fetch(apiUrl(path, options.query), { method, headers, body, credentials: "include" });
  } catch {
    throw new ApiError(0, "INTERNAL_ERROR", "Network error");
  }
  const json = (await res.json().catch(() => null)) as { data?: T; meta?: PageMeta; error?: { code: ErrorCode; message: string; details?: unknown } } | null;
  if (!res.ok) {
    const err = json?.error;
    if (res.status === 401 && path !== "/api/auth/login" && path !== "/api/auth/me") onUnauthorized?.();
    throw new ApiError(res.status, err?.code ?? "INTERNAL_ERROR", err?.message ?? res.statusText, err?.details);
  }
  return { data: json?.data as T, meta: json?.meta };
}

export const api = {
  get: async <T>(path: string, query?: Query) => (await request<T>("GET", path, { query })).data,
  getPaged: async <T>(path: string, query?: Query) => {
    const r = await request<T[]>("GET", path, { query });
    return { items: r.data, meta: r.meta! };
  },
  post: async <T>(path: string, body?: unknown) => (await request<T>("POST", path, { body: body ?? {} })).data,
  put: async <T>(path: string, body?: unknown) => (await request<T>("PUT", path, { body })).data,
  patch: async <T>(path: string, body?: unknown) => (await request<T>("PATCH", path, { body })).data,
  delete: async <T>(path: string) => (await request<T>("DELETE", path)).data,
  upload: async <T>(path: string, form: FormData) => (await request<T>("POST", path, { body: form })).data,
};
