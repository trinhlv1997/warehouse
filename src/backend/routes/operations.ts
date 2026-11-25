import { Hono } from "hono";
import {
  documentListQuery,
  fefoPreviewSchema,
  issueConfirmSchema,
  receiptInputSchema,
  stocktakingCountSchema,
  stocktakingCreateSchema,
  transferInputSchema,
} from "../../shared/schemas";
import { actorOf, parseBody, parseQuery, requirePermission, type AppEnv } from "../middleware";
import { ok, paged } from "./helpers";

const viewOps = requirePermission("inventory.view");

export const operationsRoutes = new Hono<AppEnv>()
  // ---- stock receipts (Nhập kho)
  .get("/stock-receipts", viewOps, async (c) => paged(c, await c.var.container.receipts.list(actorOf(c), parseQuery(c, documentListQuery))))
  .get("/stock-receipts/:id", viewOps, async (c) => ok(c, await c.var.container.receipts.get(actorOf(c), c.req.param("id"))))
  .post("/stock-receipts", requirePermission("receipt.create"), async (c) =>
    ok(c, await c.var.container.receipts.create(actorOf(c), await parseBody(c, receiptInputSchema)), 201),
  )
  .put("/stock-receipts/:id", requirePermission("receipt.create"), async (c) =>
    ok(c, await c.var.container.receipts.update(actorOf(c), c.req.param("id"), await parseBody(c, receiptInputSchema))),
  )
  .post("/stock-receipts/:id/confirm", requirePermission("receipt.confirm"), async (c) => ok(c, await c.var.container.receipts.confirm(actorOf(c), c.req.param("id"))))
  .post("/stock-receipts/:id/cancel", requirePermission("receipt.create"), async (c) => ok(c, await c.var.container.receipts.cancel(actorOf(c), c.req.param("id"))))

  // ---- stock issues (Xuất kho — FEFO)
  .get("/stock-issues", viewOps, async (c) => paged(c, await c.var.container.issues.list(actorOf(c), parseQuery(c, documentListQuery))))
  .get("/stock-issues/:id", viewOps, async (c) => ok(c, await c.var.container.issues.get(actorOf(c), c.req.param("id"))))
  .post("/stock-issues/fefo-preview", requirePermission("issue.create"), async (c) => {
    const input = await parseBody(c, fefoPreviewSchema);
    return ok(c, await c.var.container.issues.preview(actorOf(c), input.lines));
  })
  .post("/stock-issues", requirePermission("issue.create"), async (c) => ok(c, await c.var.container.issues.confirm(actorOf(c), await parseBody(c, issueConfirmSchema)), 201))

  // ---- stock transfers (Điều chuyển)
  .get("/stock-transfers", viewOps, async (c) => paged(c, await c.var.container.transfers.list(actorOf(c), parseQuery(c, documentListQuery))))
  .get("/stock-transfers/:id", viewOps, async (c) => ok(c, await c.var.container.transfers.get(actorOf(c), c.req.param("id"))))
  .post("/stock-transfers", requirePermission("transfer.create"), async (c) =>
    ok(c, await c.var.container.transfers.create(actorOf(c), await parseBody(c, transferInputSchema)), 201),
  )
  .post("/stock-transfers/:id/confirm", requirePermission("transfer.confirm"), async (c) => ok(c, await c.var.container.transfers.confirm(actorOf(c), c.req.param("id"))))
  .post("/stock-transfers/:id/cancel", requirePermission("transfer.create"), async (c) => ok(c, await c.var.container.transfers.cancel(actorOf(c), c.req.param("id"))))

  // ---- stocktaking (Kiểm kê)
  .get("/stocktaking", viewOps, async (c) => paged(c, await c.var.container.stocktaking.list(actorOf(c), parseQuery(c, documentListQuery))))
  .get("/stocktaking/:id", viewOps, async (c) => ok(c, await c.var.container.stocktaking.get(actorOf(c), c.req.param("id"))))
  .post("/stocktaking", requirePermission("stocktaking.count"), async (c) =>
    ok(c, await c.var.container.stocktaking.create(actorOf(c), await parseBody(c, stocktakingCreateSchema)), 201),
  )
  .put("/stocktaking/:id/counts", requirePermission("stocktaking.count"), async (c) => {
    const input = await parseBody(c, stocktakingCountSchema);
    return ok(c, await c.var.container.stocktaking.recordCounts(actorOf(c), c.req.param("id"), input.counts));
  })
  .post("/stocktaking/:id/submit", requirePermission("stocktaking.count"), async (c) => ok(c, await c.var.container.stocktaking.submit(actorOf(c), c.req.param("id"))))
  .post("/stocktaking/:id/reopen", requirePermission("stocktaking.approve"), async (c) => ok(c, await c.var.container.stocktaking.reopen(actorOf(c), c.req.param("id"))))
  .post("/stocktaking/:id/approve", requirePermission("stocktaking.approve"), async (c) => ok(c, await c.var.container.stocktaking.approve(actorOf(c), c.req.param("id"))))
  .post("/stocktaking/:id/cancel", requirePermission("stocktaking.approve"), async (c) => ok(c, await c.var.container.stocktaking.cancel(actorOf(c), c.req.param("id"))));
