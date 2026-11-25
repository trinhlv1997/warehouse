import { Hono } from "hono";
import { lotListQuery, lotStatusUpdateSchema } from "../../shared/schemas";
import { AppError } from "../domain/errors";
import { actorOf, parseBody, parseQuery, requirePermission, type AppEnv } from "../middleware";
import type { AlertType } from "../services/inventory";
import { locationSearchQuery, positionsQuery, transactionsQuery } from "../validators/queries";
import { ok, paged } from "./helpers";

const view = requirePermission("inventory.view");

export const inventoryRoutes = new Hono<AppEnv>()
  /** Inventory positions: product + lot + bin. */
  .get("/inventory", view, async (c) => paged(c, await c.var.container.inventory.listPositions(actorOf(c), parseQuery(c, positionsQuery))))
  .get("/inventory/lots", view, async (c) => {
    const q = parseQuery(c, lotListQuery);
    return paged(c, await c.var.container.inventory.listLots(actorOf(c), { ...q, hasStock: q.hasStock === "1" }));
  })
  .get("/inventory/lots/:id", view, async (c) => ok(c, await c.var.container.inventory.getLot(actorOf(c), c.req.param("id"))))
  .patch("/inventory/lots/:id/status", requirePermission("lot.manage"), async (c) => {
    const input = await parseBody(c, lotStatusUpdateSchema);
    return ok(c, await c.var.container.inventory.updateLotStatus(actorOf(c), c.req.param("id"), input.status, input.notes));
  })
  .get("/inventory/locations", view, async (c) => ok(c, await c.var.container.inventory.searchLocations(actorOf(c), parseQuery(c, locationSearchQuery).search)))
  .get("/inventory/transactions", view, async (c) => paged(c, await c.var.container.inventory.listTransactions(actorOf(c), parseQuery(c, transactionsQuery))))

  /** Alerts are computed when queried (Vietnam business date), not by a scheduled job. */
  .get("/alerts/:type", view, async (c) => {
    const type = c.req.param("type") as AlertType;
    if (!["expired", "expiring", "slow-moving"].includes(type)) throw new AppError("NOT_FOUND", "Unknown alert type");
    return paged(c, await c.var.container.inventory.alerts(actorOf(c), type, parseQuery(c, positionsQuery)));
  });
