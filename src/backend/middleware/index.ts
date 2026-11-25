import type { Context, MiddlewareHandler } from "hono";
import { deleteCookie, getCookie } from "hono/cookie";
import type { ZodType } from "zod";
import type { Permission } from "../../shared/constants";
import type { SessionUser } from "../../shared/types";
import type { Container } from "../container";
import { AppError } from "../domain/errors";
import type { Actor } from "../services/context";
import { timingSafeEqual } from "../services/crypto";

export const SESSION_COOKIE = "wms_session";

export type AppEnv = {
  Bindings: Env;
  Variables: {
    container: Container;
    user?: SessionUser;
    sessionId?: string;
    csrfToken?: string;
  };
};
export type AppContext = Context<AppEnv>;

export function clientIp(c: Context): string | null {
  return c.req.header("cf-connecting-ip") ?? c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ?? null;
}

/** Loads the session (if any) from the HttpOnly cookie. Does not reject anonymous requests. */
export const sessionMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const token = getCookie(c, SESSION_COOKIE);
  if (token) {
    const session = await c.var.container.auth.authenticate(token);
    if (session) {
      c.set("user", session.user);
      c.set("sessionId", session.sessionId);
      c.set("csrfToken", session.csrfToken);
    } else {
      deleteCookie(c, SESSION_COOKIE, { path: "/" });
    }
  }
  await next();
};

export const requireAuth: MiddlewareHandler<AppEnv> = async (c, next) => {
  if (!c.var.user) throw new AppError("UNAUTHORIZED", "Authentication required");
  await next();
};

/**
 * CSRF protection for cookie-authenticated mutations:
 * 1) synchronizer token: X-CSRF-Token must equal the token bound to the server-side session;
 * 2) Origin check: browsers send Origin on cross-site requests; it must be same-origin or allow-listed.
 */
export const csrfMiddleware: MiddlewareHandler<AppEnv> = async (c, next) => {
  const method = c.req.method;
  if (method === "GET" || method === "HEAD" || method === "OPTIONS") return next();

  const origin = c.req.header("origin");
  if (origin) {
    const self = new URL(c.req.url).origin;
    const allowed = [self, ...c.var.container.config.corsAllowedOrigins];
    if (c.var.container.config.appBaseUrl) allowed.push(new URL(c.var.container.config.appBaseUrl).origin);
    if (!allowed.includes(origin)) throw new AppError("CSRF_INVALID", "Origin not allowed");
  }
  if (c.var.sessionId) {
    const header = c.req.header("x-csrf-token") ?? "";
    if (!c.var.csrfToken || !timingSafeEqual(header, c.var.csrfToken)) throw new AppError("CSRF_INVALID", "Invalid CSRF token");
  }
  await next();
};

/** Server-side RBAC. The SPA hides UI by permission too, but this is the enforcement point. */
export function requirePermission(...permissions: Permission[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.var.user;
    if (!user) throw new AppError("UNAUTHORIZED", "Authentication required");
    if (!permissions.some((p) => user.permissions.includes(p))) throw new AppError("FORBIDDEN", "Missing permission", { required: permissions });
    await next();
  };
}

export function actorOf(c: AppContext): Actor {
  const user = c.var.user;
  if (!user) throw new AppError("UNAUTHORIZED", "Authentication required");
  return { userId: user.id, tenantId: user.tenantId, permissions: user.permissions, ipAddress: clientIp(c) };
}

function zodDetails(error: { issues: { path: PropertyKey[]; message: string; code: string }[] }) {
  return error.issues.map((i) => ({ field: i.path.map(String).join("."), message: i.message, code: i.code }));
}

export async function parseBody<T>(c: Context, schema: ZodType<T>): Promise<T> {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    throw new AppError("VALIDATION_ERROR", "Invalid JSON body");
  }
  const result = schema.safeParse(body);
  if (!result.success) throw new AppError("VALIDATION_ERROR", "Invalid request body", zodDetails(result.error));
  return result.data;
}

export function parseQuery<T>(c: Context, schema: ZodType<T>): T {
  const result = schema.safeParse(c.req.query());
  if (!result.success) throw new AppError("VALIDATION_ERROR", "Invalid query parameters", zodDetails(result.error));
  return result.data;
}
