import { Hono } from "hono";
import { categoryInputSchema, productInputSchema, productListQuery, supplierInputSchema } from "../../shared/schemas";
import { AppError } from "../domain/errors";
import { actorOf, parseBody, parseQuery, requirePermission, type AppEnv } from "../middleware";
import { searchQuery, transactionsQuery } from "../validators/queries";
import { ok, paged } from "./helpers";

const view = requirePermission("product.view");
const manage = requirePermission("product.manage");

export const catalogRoutes = new Hono<AppEnv>()
  // categories
  .get("/categories", view, async (c) => ok(c, await c.var.container.catalog.listCategories(actorOf(c))))
  .post("/categories", manage, async (c) => ok(c, await c.var.container.catalog.createCategory(actorOf(c), await parseBody(c, categoryInputSchema)), 201))
  .put("/categories/:id", manage, async (c) => ok(c, await c.var.container.catalog.updateCategory(actorOf(c), c.req.param("id"), await parseBody(c, categoryInputSchema))))
  .delete("/categories/:id", manage, async (c) => {
    await c.var.container.catalog.deleteCategory(actorOf(c), c.req.param("id"));
    return ok(c, { success: true });
  })

  // suppliers
  .get("/suppliers", view, async (c) => ok(c, await c.var.container.catalog.listSuppliers(actorOf(c), parseQuery(c, searchQuery).search)))
  .post("/suppliers", manage, async (c) => ok(c, await c.var.container.catalog.createSupplier(actorOf(c), await parseBody(c, supplierInputSchema)), 201))
  .put("/suppliers/:id", manage, async (c) => ok(c, await c.var.container.catalog.updateSupplier(actorOf(c), c.req.param("id"), await parseBody(c, supplierInputSchema))))
  .delete("/suppliers/:id", manage, async (c) => {
    await c.var.container.catalog.deleteSupplier(actorOf(c), c.req.param("id"));
    return ok(c, { success: true });
  })

  // products
  .get("/products", view, async (c) => {
    const q = parseQuery(c, productListQuery);
    return paged(c, await c.var.container.catalog.listProducts(actorOf(c), { ...q, lowStock: q.lowStock === "1" }));
  })
  .get("/products/options", view, async (c) => ok(c, await c.var.container.catalog.productOptions(actorOf(c), parseQuery(c, searchQuery).search)))
  .get("/products/:id", view, async (c) => ok(c, await c.var.container.catalog.getProduct(actorOf(c), c.req.param("id"))))
  .get("/products/:id/locations", view, async (c) =>
    paged(c, await c.var.container.inventory.listPositions(actorOf(c), { productId: c.req.param("id"), page: 1, pageSize: 200, orderBy: "expiry" })),
  )
  .get("/products/:id/history", view, async (c) => {
    const q = parseQuery(c, transactionsQuery);
    return paged(c, await c.var.container.inventory.listTransactions(actorOf(c), { ...q, productId: c.req.param("id") }));
  })
  .post("/products", manage, async (c) => ok(c, await c.var.container.catalog.createProduct(actorOf(c), await parseBody(c, productInputSchema)), 201))
  .put("/products/:id", manage, async (c) => ok(c, await c.var.container.catalog.updateProduct(actorOf(c), c.req.param("id"), await parseBody(c, productInputSchema))))
  .post("/products/:id/archive", manage, async (c) => ok(c, await c.var.container.catalog.archiveProduct(actorOf(c), c.req.param("id"))))
  .post("/products/:id/restore", manage, async (c) => ok(c, await c.var.container.catalog.restoreProduct(actorOf(c), c.req.param("id"))))
  .post("/products/:id/image", manage, async (c) => {
    const form = await c.req.formData().catch(() => null);
    const file = form?.get("file");
    if (!(file instanceof File)) throw new AppError("VALIDATION_ERROR", "Missing file", { field: "file" });
    return ok(c, await c.var.container.catalog.uploadImage(actorOf(c), c.req.param("id"), file));
  })
  .delete("/products/:id/image", manage, async (c) => ok(c, await c.var.container.catalog.removeImage(actorOf(c), c.req.param("id"))));
