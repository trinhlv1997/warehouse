import { Hono } from "hono";
import { binUpdateSchema, rackCreateSchema, rackUpdateSchema, warehouseUpdateSchema, zoneInputSchema } from "../../shared/schemas";
import { actorOf, parseBody, parseQuery, requirePermission, type AppEnv } from "../middleware";
import { binsQuery, searchQuery } from "../validators/queries";
import { ok, paged } from "./helpers";

const view = requirePermission("warehouse.view");
const manage = requirePermission("warehouse.manage");

export const warehouseRoutes = new Hono<AppEnv>()
  // warehouses
  .get("/warehouses", view, async (c) => ok(c, await c.var.container.warehouse.listWarehouses(actorOf(c))))
  .put("/warehouses/:id", manage, async (c) => {
    const input = await parseBody(c, warehouseUpdateSchema);
    return ok(c, await c.var.container.warehouse.updateWarehouse(actorOf(c), c.req.param("id"), input));
  })
  .get("/warehouse-map", view, async (c) => ok(c, await c.var.container.warehouse.map(actorOf(c))))

  // zones
  .get("/zones", view, async (c) => ok(c, await c.var.container.warehouse.listZones(actorOf(c))))
  .get("/zones/:id", view, async (c) => ok(c, await c.var.container.warehouse.getZone(actorOf(c), c.req.param("id"))))
  .post("/zones", manage, async (c) => ok(c, await c.var.container.warehouse.createZone(actorOf(c), await parseBody(c, zoneInputSchema)), 201))
  .put("/zones/:id", manage, async (c) => ok(c, await c.var.container.warehouse.updateZone(actorOf(c), c.req.param("id"), await parseBody(c, zoneInputSchema))))
  .delete("/zones/:id", manage, async (c) => {
    await c.var.container.warehouse.deleteZone(actorOf(c), c.req.param("id"));
    return ok(c, { success: true });
  })

  // racks (creating a rack generates its levels and bins)
  .get("/racks", view, async (c) => ok(c, await c.var.container.warehouse.listRacks(actorOf(c), c.req.query("zoneId") || undefined)))
  .get("/racks/:id", view, async (c) => ok(c, await c.var.container.warehouse.getRack(actorOf(c), c.req.param("id"))))
  .get("/racks/:id/layout", view, async (c) => ok(c, await c.var.container.warehouse.rackLayout(actorOf(c), c.req.param("id"))))
  .post("/racks", manage, async (c) => ok(c, await c.var.container.warehouse.createRack(actorOf(c), await parseBody(c, rackCreateSchema)), 201))
  .put("/racks/:id", manage, async (c) => {
    const input = await parseBody(c, rackUpdateSchema);
    return ok(c, await c.var.container.warehouse.updateRack(actorOf(c), c.req.param("id"), input.name, input.status));
  })
  .delete("/racks/:id", manage, async (c) => {
    await c.var.container.warehouse.deleteRack(actorOf(c), c.req.param("id"));
    return ok(c, { success: true });
  })

  // bins
  .get("/bins", view, async (c) => paged(c, await c.var.container.warehouse.listBins(actorOf(c), parseQuery(c, binsQuery))))
  .get("/bins/options", view, async (c) => ok(c, await c.var.container.warehouse.binOptions(actorOf(c), parseQuery(c, searchQuery).search)))
  .get("/bins/:id", view, async (c) => ok(c, await c.var.container.warehouse.binDetail(actorOf(c), c.req.param("id"))))
  .put("/bins/:id", manage, async (c) => {
    const input = await parseBody(c, binUpdateSchema);
    return ok(c, await c.var.container.warehouse.updateBin(actorOf(c), c.req.param("id"), input.capacity, input.status));
  });
