import type { AppConfig } from "../config";
import { businessDate } from "../domain/dates";
import { AppError } from "../domain/errors";
import type { Repositories } from "../repositories";
import { DEMO_PASSWORD, DEMO_TENANT_ID, buildDemoStatements } from "../seed/demoData";
import type { Actor } from "./context";
import { hashPassword } from "./crypto";

const CHUNK = 400;

/** In-app demo reset (ADMIN + DEMO_MODE=true). Same generator as `npm run db:reset:*`. */
export class DemoService {
  constructor(
    private readonly repos: Repositories,
    private readonly config: AppConfig,
  ) {}

  async reset(actor: Actor) {
    if (!this.config.demoMode) throw new AppError("DEMO_DISABLED", "Demo mode is disabled");
    if (actor.tenantId !== DEMO_TENANT_ID) throw new AppError("FORBIDDEN", "Only the demo tenant can be reset");
    const today = businessDate(new Date(), this.config.timezone);
    const passwordHash = await hashPassword(DEMO_PASSWORD, this.config.passwordIterations);
    const statements = buildDemoStatements({ today, passwordHash, reset: true });
    // The delete phase is one atomic batch; inserts follow in chunks (D1 request size limits).
    for (let i = 0; i < statements.length; i += CHUNK) {
      await this.repos.db.batch(statements.slice(i, i + CHUNK));
    }
    return { businessDate: today, statements: statements.length };
  }
}
