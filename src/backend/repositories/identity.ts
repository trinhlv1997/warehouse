import type { ActiveStatus, RoleCode } from "../../shared/constants";
import type { AuditLogDto, PageMeta, UserDto } from "../../shared/types";
import type { SqlDatabase, SqlStatement } from "../adapters/db/types";
import { newId } from "../domain/ids";
import { NOW_SQL, Where, likePattern, paginate, type PageRequest } from "./base";

export interface UserAuthRecord {
  id: string;
  tenantId: string;
  tenantName: string;
  tenantStatus: string;
  email: string;
  fullName: string;
  passwordHash: string;
  status: ActiveStatus;
  roles: RoleCode[];
}

export interface SessionRecord {
  id: string;
  userId: string;
  tenantId: string;
  csrfToken: string;
  expiresAt: string;
  lastSeenAt: string;
}

export interface LoginAttemptRecord {
  attemptKey: string;
  attempts: number;
  windowStart: string;
  lockedUntil: string | null;
}

export interface TenantRecord {
  id: string;
  code: string;
  name: string;
  settings: string;
}

/** Identity, sessions, users, tenants and audit log persistence. */
export interface IdentityRepository {
  findUserForLogin(email: string): Promise<UserAuthRecord | null>;
  findUserById(userId: string): Promise<UserAuthRecord | null>;
  updateLastLogin(userId: string): Promise<void>;
  setPasswordHash(userId: string, passwordHash: string): Promise<void>;
  createSession(session: SessionRecord & { ipAddress: string | null; userAgent: string | null }): Promise<void>;
  findSession(id: string): Promise<SessionRecord | null>;
  touchSession(id: string, expiresAt: string): Promise<void>;
  deleteSession(id: string): Promise<void>;
  deleteUserSessions(userId: string): Promise<void>;
  deleteExpiredSessions(): Promise<void>;
  getLoginAttempt(key: string): Promise<LoginAttemptRecord | null>;
  saveLoginAttempt(record: LoginAttemptRecord): Promise<void>;
  clearLoginAttempt(key: string): Promise<void>;
  listUsers(tenantId: string, filter: { search?: string } & PageRequest): Promise<{ items: UserDto[]; meta: PageMeta }>;
  getUser(tenantId: string, id: string): Promise<UserDto | null>;
  createUser(tenantId: string, input: { email: string; fullName: string; phone: string | null; passwordHash: string; status: ActiveStatus; roles: RoleCode[] }): Promise<string>;
  updateUser(tenantId: string, id: string, input: { fullName: string; phone: string | null; status: ActiveStatus; roles: RoleCode[]; passwordHash: string | null }): Promise<void>;
  getTenant(tenantId: string): Promise<TenantRecord | null>;
  updateTenant(tenantId: string, name: string, settings: string): Promise<void>;
  insertAudit(entry: AuditEntry): Promise<void>;
  auditStatement(entry: AuditEntry): SqlStatement;
  listAudit(tenantId: string, filter: { search?: string; entityType?: string } & PageRequest): Promise<{ items: AuditLogDto[]; meta: PageMeta }>;
}

export interface AuditEntry {
  tenantId: string | null;
  userId: string | null;
  action: string;
  entityType: string;
  entityId?: string | null;
  details?: unknown;
  ipAddress?: string | null;
}

const ROLE_ID: Record<RoleCode, string> = {
  ADMIN: "role_admin",
  WAREHOUSE_MANAGER: "role_manager",
  WAREHOUSE_STAFF: "role_staff",
};

export class SqlIdentityRepository implements IdentityRepository {
  constructor(private readonly db: SqlDatabase) {}

  private async loadAuthUser(where: string, value: string): Promise<UserAuthRecord | null> {
    const row = await this.db.first<Omit<UserAuthRecord, "roles"> & { roles: string | null }>(
      `SELECT u.id, u.tenant_id AS tenantId, t.name AS tenantName, t.status AS tenantStatus, u.email,
              u.full_name AS fullName, u.password_hash AS passwordHash, u.status,
              (SELECT GROUP_CONCAT(r.code) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id) AS roles
         FROM users u JOIN tenants t ON t.id = u.tenant_id
        WHERE ${where} AND u.deleted_at IS NULL`,
      [value],
    );
    if (!row) return null;
    return { ...row, roles: (row.roles ? row.roles.split(",") : []) as RoleCode[] };
  }

  findUserForLogin(email: string) {
    return this.loadAuthUser("u.email = ?", email);
  }

  findUserById(userId: string) {
    return this.loadAuthUser("u.id = ?", userId);
  }

  async updateLastLogin(userId: string) {
    await this.db.run(`UPDATE users SET last_login_at = ${NOW_SQL} WHERE id = ?`, [userId]);
  }

  async setPasswordHash(userId: string, passwordHash: string) {
    await this.db.run(`UPDATE users SET password_hash = ?, updated_at = ${NOW_SQL} WHERE id = ?`, [passwordHash, userId]);
  }

  async createSession(s: SessionRecord & { ipAddress: string | null; userAgent: string | null }) {
    await this.db.run(
      `INSERT INTO sessions (id, user_id, tenant_id, csrf_token, ip_address, user_agent, expires_at, last_seen_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [s.id, s.userId, s.tenantId, s.csrfToken, s.ipAddress, s.userAgent, s.expiresAt, s.lastSeenAt],
    );
  }

  findSession(id: string) {
    return this.db.first<SessionRecord>(
      `SELECT id, user_id AS userId, tenant_id AS tenantId, csrf_token AS csrfToken, expires_at AS expiresAt, last_seen_at AS lastSeenAt
         FROM sessions WHERE id = ?`,
      [id],
    );
  }

  async touchSession(id: string, expiresAt: string) {
    await this.db.run(`UPDATE sessions SET last_seen_at = ${NOW_SQL}, expires_at = ? WHERE id = ?`, [expiresAt, id]);
  }

  async deleteSession(id: string) {
    await this.db.run("DELETE FROM sessions WHERE id = ?", [id]);
  }

  async deleteUserSessions(userId: string) {
    await this.db.run("DELETE FROM sessions WHERE user_id = ?", [userId]);
  }

  async deleteExpiredSessions() {
    await this.db.run(`DELETE FROM sessions WHERE expires_at < ${NOW_SQL}`);
  }

  getLoginAttempt(key: string) {
    return this.db.first<LoginAttemptRecord>(
      "SELECT attempt_key AS attemptKey, attempts, window_start AS windowStart, locked_until AS lockedUntil FROM login_attempts WHERE attempt_key = ?",
      [key],
    );
  }

  async saveLoginAttempt(r: LoginAttemptRecord) {
    await this.db.run(
      `INSERT INTO login_attempts (attempt_key, attempts, window_start, locked_until) VALUES (?, ?, ?, ?)
       ON CONFLICT(attempt_key) DO UPDATE SET attempts = excluded.attempts, window_start = excluded.window_start, locked_until = excluded.locked_until`,
      [r.attemptKey, r.attempts, r.windowStart, r.lockedUntil],
    );
  }

  async clearLoginAttempt(key: string) {
    await this.db.run("DELETE FROM login_attempts WHERE attempt_key = ?", [key]);
  }

  private static userSelect = `u.id, u.email, u.full_name AS fullName, u.phone, u.status, u.last_login_at AS lastLoginAt, u.created_at AS createdAt,
     (SELECT GROUP_CONCAT(r.code) FROM user_roles ur JOIN roles r ON r.id = ur.role_id WHERE ur.user_id = u.id) AS roles`;

  private static mapUser(row: Omit<UserDto, "roles"> & { roles: string | null }): UserDto {
    return { ...row, roles: (row.roles ? row.roles.split(",") : []) as RoleCode[] };
  }

  async listUsers(tenantId: string, f: { search?: string } & PageRequest) {
    const where = new Where().add("u.tenant_id = ?", tenantId).add("u.deleted_at IS NULL");
    if (f.search) where.add("(u.email LIKE ? ESCAPE '\\' OR u.full_name LIKE ? ESCAPE '\\')", likePattern(f.search), likePattern(f.search));
    const res = await paginate<Omit<UserDto, "roles"> & { roles: string | null }>(
      this.db,
      SqlIdentityRepository.userSelect,
      `FROM users u ${where.toSql()}`,
      where.params,
      "u.created_at",
      f,
    );
    return { items: res.items.map(SqlIdentityRepository.mapUser), meta: res.meta };
  }

  async getUser(tenantId: string, id: string) {
    const row = await this.db.first<Omit<UserDto, "roles"> & { roles: string | null }>(
      `SELECT ${SqlIdentityRepository.userSelect} FROM users u WHERE u.tenant_id = ? AND u.id = ? AND u.deleted_at IS NULL`,
      [tenantId, id],
    );
    return row ? SqlIdentityRepository.mapUser(row) : null;
  }

  async createUser(tenantId: string, input: { email: string; fullName: string; phone: string | null; passwordHash: string; status: ActiveStatus; roles: RoleCode[] }) {
    const id = newId();
    await this.db.batch([
      {
        sql: "INSERT INTO users (id, tenant_id, email, full_name, phone, password_hash, status) VALUES (?, ?, ?, ?, ?, ?, ?)",
        params: [id, tenantId, input.email, input.fullName, input.phone, input.passwordHash, input.status],
      },
      ...input.roles.map((r) => ({ sql: "INSERT INTO user_roles (user_id, role_id) VALUES (?, ?)", params: [id, ROLE_ID[r]] })),
    ]);
    return id;
  }

  async updateUser(tenantId: string, id: string, input: { fullName: string; phone: string | null; status: ActiveStatus; roles: RoleCode[]; passwordHash: string | null }) {
    const statements: SqlStatement[] = [
      {
        sql: `UPDATE users SET full_name = ?, phone = ?, status = ?, password_hash = COALESCE(?, password_hash), updated_at = ${NOW_SQL}
               WHERE id = ? AND tenant_id = ?`,
        params: [input.fullName, input.phone, input.status, input.passwordHash, id, tenantId],
      },
      { sql: "DELETE FROM user_roles WHERE user_id = ? AND user_id IN (SELECT id FROM users WHERE tenant_id = ?)", params: [id, tenantId] },
      ...input.roles.map((r) => ({
        sql: "INSERT INTO user_roles (user_id, role_id) SELECT id, ? FROM users WHERE id = ? AND tenant_id = ?",
        params: [ROLE_ID[r], id, tenantId],
      })),
    ];
    if (input.status === "INACTIVE" || input.passwordHash) statements.push({ sql: "DELETE FROM sessions WHERE user_id = ?", params: [id] });
    await this.db.batch(statements);
  }

  getTenant(tenantId: string) {
    return this.db.first<TenantRecord>("SELECT id, code, name, settings FROM tenants WHERE id = ?", [tenantId]);
  }

  async updateTenant(tenantId: string, name: string, settings: string) {
    await this.db.run(`UPDATE tenants SET name = ?, settings = ?, updated_at = ${NOW_SQL} WHERE id = ?`, [name, settings, tenantId]);
  }

  auditStatement(e: AuditEntry): SqlStatement {
    return {
      sql: "INSERT INTO audit_logs (id, tenant_id, user_id, action, entity_type, entity_id, details, ip_address) VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
      params: [newId(), e.tenantId, e.userId, e.action, e.entityType, e.entityId ?? null, e.details === undefined ? null : JSON.stringify(e.details), e.ipAddress ?? null],
    };
  }

  async insertAudit(e: AuditEntry) {
    const s = this.auditStatement(e);
    await this.db.run(s.sql, s.params);
  }

  listAudit(tenantId: string, f: { search?: string; entityType?: string } & PageRequest) {
    const where = new Where().add("a.tenant_id = ?", tenantId).addIf(f.entityType, "a.entity_type = ?", f.entityType ?? null);
    if (f.search) where.add("(a.action LIKE ? ESCAPE '\\' OR a.details LIKE ? ESCAPE '\\')", likePattern(f.search), likePattern(f.search));
    return paginate<AuditLogDto>(
      this.db,
      `a.id, a.action, a.entity_type AS entityType, a.entity_id AS entityId, a.details, u.full_name AS userName, a.ip_address AS ipAddress, a.created_at AS createdAt`,
      `FROM audit_logs a LEFT JOIN users u ON u.id = a.user_id ${where.toSql()}`,
      where.params,
      "a.created_at DESC",
      f,
    );
  }
}
