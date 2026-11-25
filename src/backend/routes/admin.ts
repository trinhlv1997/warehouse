import { Hono } from "hono";
import { paginationQuery, tenantSettingsSchema, userCreateSchema, userUpdateSchema } from "../../shared/schemas";
import { actorOf, parseBody, parseQuery, requirePermission, type AppEnv } from "../middleware";
import { toCsv } from "../services/dashboard";
import { auditQuery, reportQuery } from "../validators/queries";
import { ok, paged } from "./helpers";

export const adminRoutes = new Hono<AppEnv>()
  // dashboard & reports
  .get("/dashboard", requirePermission("dashboard.view"), async (c) => ok(c, await c.var.container.dashboard.dashboard(actorOf(c))))
  .get("/reports/:type", requirePermission("report.view"), async (c) => {
    const { format, ...filter } = parseQuery(c, reportQuery);
    const report = await c.var.container.dashboard.report(actorOf(c), c.req.param("type"), filter);
    if (format === "csv") {
      const header = (c.req.query("labels") ?? "").split("|");
      const columns = report.columns.map((col, i) => ({ key: col.key, label: header[i] || col.key }));
      return c.body(toCsv(columns, report.rows), 200, {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="report-${report.type}.csv"`,
      });
    }
    return ok(c, report);
  })

  // users (ADMIN)
  .get("/users", requirePermission("user.manage"), async (c) => paged(c, await c.var.container.users.list(actorOf(c), parseQuery(c, paginationQuery))))
  .get("/users/:id", requirePermission("user.manage"), async (c) => ok(c, await c.var.container.users.get(actorOf(c), c.req.param("id"))))
  .post("/users", requirePermission("user.manage"), async (c) => ok(c, await c.var.container.users.create(actorOf(c), await parseBody(c, userCreateSchema)), 201))
  .put("/users/:id", requirePermission("user.manage"), async (c) => ok(c, await c.var.container.users.update(actorOf(c), c.req.param("id"), await parseBody(c, userUpdateSchema))))

  // audit log
  .get("/audit-logs", requirePermission("audit.view"), async (c) => paged(c, await c.var.container.users.listAudit(actorOf(c), parseQuery(c, auditQuery))))

  // settings
  .get("/settings", requirePermission("dashboard.view"), async (c) => ok(c, await c.var.container.settings.getDto(actorOf(c))))
  .put("/settings", requirePermission("settings.manage"), async (c) => ok(c, await c.var.container.settings.update(actorOf(c), await parseBody(c, tenantSettingsSchema))))
  .post("/demo/reset", requirePermission("settings.manage"), async (c) => ok(c, await c.var.container.demo.reset(actorOf(c))));
