import { BUSINESS_TIMEZONE } from "../shared/constants";

/** Runtime configuration resolved from environment variables. No domain names are hard-coded. */
export interface AppConfig {
  appEnv: string;
  appBaseUrl: string | null;
  corsAllowedOrigins: string[];
  databaseProvider: string;
  storageProvider: string;
  timezone: string;
  demoMode: boolean;
  sessionSecret: string;
  sessionTtlHours: number;
  secureCookies: boolean;
  /** PBKDF2 iterations for new hashes. 50k fits the free-plan CPU budget; raise to 100k on paid plans. */
  passwordIterations: number;
}

export interface RuntimeEnv {
  DB?: D1Database;
  STORAGE?: R2Bucket;
  APP_ENV?: string;
  APP_BASE_URL?: string;
  CORS_ALLOWED_ORIGINS?: string;
  DATABASE_PROVIDER?: string;
  STORAGE_PROVIDER?: string;
  DEFAULT_TIMEZONE?: string;
  DEMO_MODE?: string;
  SESSION_SECRET?: string;
  SESSION_TTL_HOURS?: string;
  PASSWORD_HASH_ITERATIONS?: string;
}

export function loadConfig(env: RuntimeEnv): AppConfig {
  const appEnv = env.APP_ENV || "production";
  const sessionSecret = env.SESSION_SECRET ?? "";
  if (appEnv !== "development" && appEnv !== "test" && sessionSecret.length < 32) {
    throw new Error("SESSION_SECRET must be set (>= 32 chars). Run: npx wrangler secret put SESSION_SECRET");
  }
  return {
    appEnv,
    appBaseUrl: env.APP_BASE_URL?.trim() || null,
    corsAllowedOrigins: (env.CORS_ALLOWED_ORIGINS ?? "")
      .split(",")
      .map((s) => s.trim().replace(/\/$/, ""))
      .filter(Boolean),
    databaseProvider: env.DATABASE_PROVIDER || "d1",
    storageProvider: env.STORAGE_PROVIDER || "r2",
    timezone: env.DEFAULT_TIMEZONE || BUSINESS_TIMEZONE,
    demoMode: env.DEMO_MODE === "true",
    sessionSecret: sessionSecret || "insecure-development-secret-do-not-use-in-production",
    sessionTtlHours: Number(env.SESSION_TTL_HOURS) || 12,
    secureCookies: appEnv !== "development" && appEnv !== "test",
    passwordIterations: Math.min(100_000, Math.max(10_000, Number(env.PASSWORD_HASH_ITERATIONS) || 50_000)),
  };
}
