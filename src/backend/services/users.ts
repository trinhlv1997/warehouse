import type { ActiveStatus, RoleCode } from "../../shared/constants";
import { AppError } from "../domain/errors";
import type { Repositories } from "../repositories";
import type { Actor } from "./context";
import { hashPassword } from "./crypto";
import { guarded } from "./tx";

/** User administration (ADMIN only, enforced in routes). */
export class UserService {
  constructor(
    private readonly repos: Repositories,
    private readonly passwordIterations: number,
  ) {}

  list(actor: Actor, filter: { search?: string; page: number; pageSize: number }) {
    return this.repos.identity.listUsers(actor.tenantId, filter);
  }

  async get(actor: Actor, id: string) {
    const user = await this.repos.identity.getUser(actor.tenantId, id);
    if (!user) throw new AppError("NOT_FOUND", "User not found");
    return user;
  }

  async create(actor: Actor, input: { email: string; fullName: string; phone: string | null; password: string; roles: RoleCode[]; status: ActiveStatus }) {
    const passwordHash = await hashPassword(input.password, this.passwordIterations);
    const id = await guarded(() => this.repos.identity.createUser(actor.tenantId, { ...input, passwordHash }));
    await this.repos.identity.insertAudit({ tenantId: actor.tenantId, userId: actor.userId, action: "user.created", entityType: "user", entityId: id, details: { email: input.email, roles: input.roles }, ipAddress: actor.ipAddress });
    return this.get(actor, id);
  }

  async update(actor: Actor, id: string, input: { fullName: string; phone: string | null; roles: RoleCode[]; status: ActiveStatus; password: string | null }) {
    const existing = await this.get(actor, id);
    if (id === actor.userId && (input.status !== "ACTIVE" || !input.roles.includes("ADMIN"))) {
      throw new AppError("VALIDATION_ERROR", "You cannot remove your own admin access", { field: "roles" });
    }
    const passwordHash = input.password ? await hashPassword(input.password, this.passwordIterations) : null;
    await this.repos.identity.updateUser(actor.tenantId, id, { ...input, passwordHash });
    await this.repos.identity.insertAudit({
      tenantId: actor.tenantId, userId: actor.userId, action: "user.updated", entityType: "user", entityId: id,
      details: { from: { roles: existing.roles, status: existing.status }, to: { roles: input.roles, status: input.status }, passwordReset: !!passwordHash },
      ipAddress: actor.ipAddress,
    });
    return this.get(actor, id);
  }

  listAudit(actor: Actor, filter: { search?: string; entityType?: string; page: number; pageSize: number }) {
    return this.repos.identity.listAudit(actor.tenantId, filter);
  }
}
