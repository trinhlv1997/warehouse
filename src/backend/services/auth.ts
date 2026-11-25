import { permissionsForRoles } from "../../shared/constants";
import type { SessionUser } from "../../shared/types";
import type { AppConfig } from "../config";
import { AppError } from "../domain/errors";
import type { IdentityRepository } from "../repositories/identity";
import { hashIterations, hashPassword, hmacSha256, randomToken, verifyPassword } from "./crypto";

const MAX_ATTEMPTS = 5;
const WINDOW_MINUTES = 15;
const LOCK_MINUTES = 15;
/** Refresh the sliding expiry at most once every 5 minutes to save D1 writes. */
const TOUCH_INTERVAL_MS = 5 * 60_000;

export interface AuthenticatedSession {
  sessionId: string;
  csrfToken: string;
  user: SessionUser;
}

// Precomputed hash used to keep timing similar when the email does not exist.
let dummyHash: Promise<string> | null = null;

export class AuthService {
  constructor(
    private readonly identity: IdentityRepository,
    private readonly config: AppConfig,
  ) {}

  private sessionId(token: string) {
    return hmacSha256(token, this.config.sessionSecret);
  }

  private expiry(from = Date.now()) {
    return new Date(from + this.config.sessionTtlHours * 3_600_000).toISOString();
  }

  private async checkRateLimit(keys: string[]) {
    const now = Date.now();
    for (const key of keys) {
      const rec = await this.identity.getLoginAttempt(key);
      if (rec?.lockedUntil && Date.parse(rec.lockedUntil) > now) {
        throw new AppError("RATE_LIMITED", "Too many login attempts", { retryAfterSeconds: Math.ceil((Date.parse(rec.lockedUntil) - now) / 1000) });
      }
    }
  }

  private async recordFailure(keys: string[]) {
    const now = Date.now();
    for (const key of keys) {
      const rec = await this.identity.getLoginAttempt(key);
      const windowExpired = !rec || now - Date.parse(rec.windowStart) > WINDOW_MINUTES * 60_000;
      const attempts = windowExpired ? 1 : rec.attempts + 1;
      await this.identity.saveLoginAttempt({
        attemptKey: key,
        attempts,
        windowStart: windowExpired ? new Date(now).toISOString() : rec.windowStart,
        lockedUntil: attempts >= MAX_ATTEMPTS ? new Date(now + LOCK_MINUTES * 60_000).toISOString() : null,
      });
    }
  }

  async login(email: string, password: string, ipAddress: string | null, userAgent: string | null): Promise<AuthenticatedSession & { token: string }> {
    const keys = [`email:${email.toLowerCase()}`, ...(ipAddress ? [`ip:${ipAddress}`] : [])];
    await this.checkRateLimit(keys);

    const user = await this.identity.findUserForLogin(email);
    if (!user) {
      dummyHash ??= hashPassword("dummy-password", this.config.passwordIterations);
      await verifyPassword(password, await dummyHash);
      await this.recordFailure(keys);
      throw new AppError("INVALID_CREDENTIALS", "Invalid email or password");
    }
    const ok = await verifyPassword(password, user.passwordHash);
    if (!ok) {
      await this.recordFailure(keys);
      await this.identity.insertAudit({ tenantId: user.tenantId, userId: user.id, action: "auth.login_failed", entityType: "user", entityId: user.id, ipAddress });
      throw new AppError("INVALID_CREDENTIALS", "Invalid email or password");
    }
    if (user.status !== "ACTIVE" || user.tenantStatus !== "ACTIVE") throw new AppError("ACCOUNT_DISABLED", "Account disabled");

    for (const key of keys) await this.identity.clearLoginAttempt(key);
    // transparently upgrade hashes when the configured work factor changes
    if (hashIterations(user.passwordHash) !== this.config.passwordIterations) {
      await this.identity.setPasswordHash(user.id, await hashPassword(password, this.config.passwordIterations));
    }
    const token = randomToken(32);
    const csrfToken = randomToken(24);
    const sessionId = await this.sessionId(token);
    const nowIso = new Date().toISOString();
    await this.identity.createSession({
      id: sessionId,
      userId: user.id,
      tenantId: user.tenantId,
      csrfToken,
      expiresAt: this.expiry(),
      lastSeenAt: nowIso,
      ipAddress,
      userAgent: userAgent?.slice(0, 300) ?? null,
    });
    await this.identity.updateLastLogin(user.id);
    await this.identity.insertAudit({ tenantId: user.tenantId, userId: user.id, action: "auth.login", entityType: "user", entityId: user.id, ipAddress });
    // opportunistic cleanup instead of a cron job
    if (Math.random() < 0.05) await this.identity.deleteExpiredSessions();

    return { token, sessionId, csrfToken, user: this.toSessionUser(user) };
  }

  async authenticate(token: string): Promise<AuthenticatedSession | null> {
    if (!/^[a-f0-9]{64}$/.test(token)) return null;
    const sessionId = await this.sessionId(token);
    const session = await this.identity.findSession(sessionId);
    if (!session) return null;
    const now = Date.now();
    if (Date.parse(session.expiresAt) <= now) {
      await this.identity.deleteSession(sessionId);
      return null;
    }
    const user = await this.identity.findUserById(session.userId);
    if (!user || user.status !== "ACTIVE" || user.tenantStatus !== "ACTIVE" || user.tenantId !== session.tenantId) {
      await this.identity.deleteSession(sessionId);
      return null;
    }
    if (now - Date.parse(session.lastSeenAt) > TOUCH_INTERVAL_MS) await this.identity.touchSession(sessionId, this.expiry(now));
    return { sessionId, csrfToken: session.csrfToken, user: this.toSessionUser(user) };
  }

  async logout(sessionId: string, user: SessionUser, ipAddress: string | null) {
    await this.identity.deleteSession(sessionId);
    await this.identity.insertAudit({ tenantId: user.tenantId, userId: user.id, action: "auth.logout", entityType: "user", entityId: user.id, ipAddress });
  }

  async changePassword(user: SessionUser, currentPassword: string, newPassword: string, ipAddress: string | null) {
    const record = await this.identity.findUserById(user.id);
    if (!record || !(await verifyPassword(currentPassword, record.passwordHash))) throw new AppError("INVALID_CREDENTIALS", "Current password is incorrect");
    const profile = await this.identity.getUser(user.tenantId, user.id);
    await this.identity.updateUser(user.tenantId, user.id, {
      fullName: record.fullName,
      phone: profile?.phone ?? null,
      status: record.status,
      roles: record.roles,
      passwordHash: await hashPassword(newPassword, this.config.passwordIterations),
    });
    await this.identity.insertAudit({ tenantId: user.tenantId, userId: user.id, action: "auth.password_changed", entityType: "user", entityId: user.id, ipAddress });
  }

  private toSessionUser(u: { id: string; email: string; fullName: string; tenantId: string; tenantName: string; roles: SessionUser["roles"] }): SessionUser {
    return { id: u.id, email: u.email, fullName: u.fullName, tenantId: u.tenantId, tenantName: u.tenantName, roles: u.roles, permissions: permissionsForRoles(u.roles) };
  }
}
