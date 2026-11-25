import { Hono } from "hono";
import { cors } from "hono/cors";
import { secureHeaders } from "hono/secure-headers";
import { createContainer, type Container } from "./container";
import { AppError } from "./domain/errors";
import { actorOf, csrfMiddleware, requireAuth, sessionMiddleware, type AppEnv } from "./middleware";
import { SWAGGER_HTML, buildOpenApiDocument } from "./openapi";
import { adminRoutes } from "./routes/admin";
import { authRoutes } from "./routes/auth";
import { catalogRoutes } from "./routes/catalog";
import { inventoryRoutes } from "./routes/inventory";
import { operationsRoutes } from "./routes/operations";
import { warehouseRoutes } from "./routes/warehouse";

/**
 * Builds the HTTP application. `containerFactory` is injectable so tests (or a Node host)
 * can supply their own database/storage adapters.
 */
export function createApp(containerFactory: (env: Env) => Container = (env) => createContainer(env as never)) {
  const app = new Hono<AppEnv>();

  app.onError((err, c) => {
    if (err instanceof AppError) {
      return c.json({ error: { code: err.code, message: err.message, details: err.details } }, err.status as 400);
    }
    // never leak internals (SQL, stack) to clients
    console.error("Unhandled error", err);
    return c.json({ error: { code: "INTERNAL_ERROR", message: "Internal server error" } }, 500);
  });
  app.notFound((c) => c.json({ error: { code: "NOT_FOUND", message: "Route not found" } }, 404));

  app.use("*", secureHeaders({ crossOriginEmbedderPolicy: false }));
  app.use("*", async (c, next) => {
    c.set("container", containerFactory(c.env));
    await next();
  });
  // Only needed when the SPA is served from a different origin than the API (CORS_ALLOWED_ORIGINS).
  app.use("/api/*", async (c, next) => {
    const origins = c.var.container.config.corsAllowedOrigins;
    if (origins.length === 0) return next();
    return cors({ origin: origins, credentials: true, allowHeaders: ["Content-Type", "X-CSRF-Token"], allowMethods: ["GET", "POST", "PUT", "PATCH", "DELETE"] })(c, next);
  });
  app.use("/api/*", async (c, next) => {
    await next();
    c.header("Cache-Control", "no-store");
  });

  app.get("/api/health", (c) => c.json({ data: { status: "ok", env: c.var.container.config.appEnv, database: c.var.container.config.databaseProvider } }));
  app.get("/api/openapi.json", (c) => c.json(buildOpenApiDocument(new URL(c.req.url).origin)));
  app.get("/api/docs", (c) => c.html(SWAGGER_HTML));

  app.use("/api/*", sessionMiddleware);
  app.route("/api/auth", authRoutes);

  const api = new Hono<AppEnv>();
  api.use("*", requireAuth, csrfMiddleware);
  api.route("/", warehouseRoutes);
  api.route("/", catalogRoutes);
  api.route("/", inventoryRoutes);
  api.route("/", operationsRoutes);
  api.route("/", adminRoutes);
  app.route("/api", api);

  // Tenant-scoped file access (product images in R2). Relative URL => host independent.
  app.get("/files/*", sessionMiddleware, requireAuth, async (c) => {
    const key = decodeURIComponent(new URL(c.req.url).pathname.replace(/^\/files\//, ""));
    const obj = await c.var.container.catalog.readFile(actorOf(c), key);
    return c.body(obj.body, 200, {
      "Content-Type": obj.contentType ?? "application/octet-stream",
      "Cache-Control": "private, max-age=31536000, immutable",
      ETag: obj.etag,
    });
  });

  return app;
}
