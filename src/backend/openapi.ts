import { z, type ZodType } from "zod";
import {
  binUpdateSchema,
  categoryInputSchema,
  changePasswordSchema,
  fefoPreviewSchema,
  issueConfirmSchema,
  lotStatusUpdateSchema,
  loginSchema,
  productInputSchema,
  rackCreateSchema,
  rackUpdateSchema,
  receiptInputSchema,
  stocktakingCountSchema,
  stocktakingCreateSchema,
  supplierInputSchema,
  tenantSettingsSchema,
  transferInputSchema,
  userCreateSchema,
  userUpdateSchema,
  warehouseUpdateSchema,
  zoneInputSchema,
} from "../shared/schemas";

type Method = "get" | "post" | "put" | "patch" | "delete";
interface Endpoint {
  method: Method;
  path: string;
  tag: string;
  summary: string;
  permission?: string;
  body?: ZodType;
  paged?: boolean;
  public?: boolean;
}

const E = (method: Method, path: string, tag: string, summary: string, extra: Partial<Endpoint> = {}): Endpoint => ({ method, path, tag, summary, ...extra });

/** Single registry of the REST API; kept next to the routes and rendered as OpenAPI 3.1. */
export const ENDPOINTS: Endpoint[] = [
  E("post", "/api/auth/login", "Auth", "Sign in (sets HttpOnly session cookie, returns CSRF token)", { body: loginSchema, public: true }),
  E("post", "/api/auth/logout", "Auth", "Sign out"),
  E("get", "/api/auth/me", "Auth", "Current user, permissions and CSRF token"),
  E("post", "/api/auth/change-password", "Auth", "Change own password", { body: changePasswordSchema }),

  E("get", "/api/dashboard", "Dashboard", "KPIs and chart data", { permission: "dashboard.view" }),

  E("get", "/api/warehouses", "Warehouse", "List warehouses", { permission: "warehouse.view" }),
  E("put", "/api/warehouses/{id}", "Warehouse", "Update warehouse", { permission: "warehouse.manage", body: warehouseUpdateSchema }),
  E("get", "/api/warehouse-map", "Warehouse", "Zones with racks and utilisation (2D map)", { permission: "warehouse.view" }),
  E("get", "/api/zones", "Warehouse", "List zones", { permission: "warehouse.view" }),
  E("post", "/api/zones", "Warehouse", "Create zone", { permission: "warehouse.manage", body: zoneInputSchema }),
  E("put", "/api/zones/{id}", "Warehouse", "Update zone", { permission: "warehouse.manage", body: zoneInputSchema }),
  E("delete", "/api/zones/{id}", "Warehouse", "Delete empty zone", { permission: "warehouse.manage" }),
  E("get", "/api/racks", "Warehouse", "List racks (?zoneId=)", { permission: "warehouse.view" }),
  E("get", "/api/racks/{id}/layout", "Warehouse", "Levels and bins of a rack", { permission: "warehouse.view" }),
  E("post", "/api/racks", "Warehouse", "Create rack with generated levels and bins", { permission: "warehouse.manage", body: rackCreateSchema }),
  E("put", "/api/racks/{id}", "Warehouse", "Rename / (de)activate rack", { permission: "warehouse.manage", body: rackUpdateSchema }),
  E("delete", "/api/racks/{id}", "Warehouse", "Delete rack without stock or history", { permission: "warehouse.manage" }),
  E("get", "/api/bins", "Warehouse", "List bins (search, zoneId, rackId, status, occupancy)", { permission: "warehouse.view", paged: true }),
  E("get", "/api/bins/options", "Warehouse", "Active bins for pickers", { permission: "warehouse.view" }),
  E("get", "/api/bins/{id}", "Warehouse", "Bin detail with stock positions", { permission: "warehouse.view" }),
  E("put", "/api/bins/{id}", "Warehouse", "Update bin capacity / status", { permission: "warehouse.manage", body: binUpdateSchema }),

  E("get", "/api/categories", "Catalog", "List categories", { permission: "product.view" }),
  E("post", "/api/categories", "Catalog", "Create category", { permission: "product.manage", body: categoryInputSchema }),
  E("put", "/api/categories/{id}", "Catalog", "Update category", { permission: "product.manage", body: categoryInputSchema }),
  E("delete", "/api/categories/{id}", "Catalog", "Soft-delete category", { permission: "product.manage" }),
  E("get", "/api/suppliers", "Catalog", "List suppliers", { permission: "product.view" }),
  E("post", "/api/suppliers", "Catalog", "Create supplier", { permission: "product.manage", body: supplierInputSchema }),
  E("put", "/api/suppliers/{id}", "Catalog", "Update supplier", { permission: "product.manage", body: supplierInputSchema }),
  E("delete", "/api/suppliers/{id}", "Catalog", "Soft-delete supplier", { permission: "product.manage" }),
  E("get", "/api/products", "Catalog", "List products (search, categoryId, status, lowStock=1)", { permission: "product.view", paged: true }),
  E("get", "/api/products/options", "Catalog", "Active products for pickers", { permission: "product.view" }),
  E("get", "/api/products/{id}", "Catalog", "Product detail", { permission: "product.view" }),
  E("get", "/api/products/{id}/locations", "Catalog", "All bins holding the product", { permission: "product.view", paged: true }),
  E("get", "/api/products/{id}/history", "Catalog", "Inventory history of the product", { permission: "product.view", paged: true }),
  E("post", "/api/products", "Catalog", "Create product", { permission: "product.manage", body: productInputSchema }),
  E("put", "/api/products/{id}", "Catalog", "Update product", { permission: "product.manage", body: productInputSchema }),
  E("post", "/api/products/{id}/archive", "Catalog", "Archive product (no stock left)", { permission: "product.manage" }),
  E("post", "/api/products/{id}/restore", "Catalog", "Restore archived product", { permission: "product.manage" }),
  E("post", "/api/products/{id}/image", "Catalog", "Upload product image (multipart 'file', R2)", { permission: "product.manage" }),

  E("get", "/api/inventory", "Inventory", "Inventory positions (product + lot + bin) with filters", { permission: "inventory.view", paged: true }),
  E("get", "/api/inventory/lots", "Inventory", "Lots with quantity, locations and expiry status", { permission: "inventory.view", paged: true }),
  E("get", "/api/inventory/lots/{id}", "Inventory", "Lot detail", { permission: "inventory.view" }),
  E("patch", "/api/inventory/lots/{id}/status", "Inventory", "Set lot status (AVAILABLE/QUARANTINE/BLOCKED)", { permission: "lot.manage", body: lotStatusUpdateSchema }),
  E("get", "/api/inventory/locations", "Inventory", "Search where products/lots are stored (?search=)", { permission: "inventory.view" }),
  E("get", "/api/inventory/transactions", "Inventory", "Inventory ledger", { permission: "inventory.view", paged: true }),
  E("get", "/api/alerts/{type}", "Alerts", "type = expired | expiring | slow-moving", { permission: "inventory.view", paged: true }),

  E("get", "/api/stock-receipts", "Receipts", "List receipts", { permission: "inventory.view", paged: true }),
  E("get", "/api/stock-receipts/{id}", "Receipts", "Receipt with items", { permission: "inventory.view" }),
  E("post", "/api/stock-receipts", "Receipts", "Create draft receipt", { permission: "receipt.create", body: receiptInputSchema }),
  E("put", "/api/stock-receipts/{id}", "Receipts", "Edit draft receipt", { permission: "receipt.create", body: receiptInputSchema }),
  E("post", "/api/stock-receipts/{id}/confirm", "Receipts", "Confirm: create lots, balances, ledger (atomic)", { permission: "receipt.confirm" }),
  E("post", "/api/stock-receipts/{id}/cancel", "Receipts", "Cancel draft", { permission: "receipt.create" }),

  E("get", "/api/stock-issues", "Issues", "List issues", { permission: "inventory.view", paged: true }),
  E("get", "/api/stock-issues/{id}", "Issues", "Issue with FEFO allocations", { permission: "inventory.view" }),
  E("post", "/api/stock-issues/fefo-preview", "Issues", "Compute FEFO allocation (no changes)", { permission: "issue.create", body: fefoPreviewSchema }),
  E("post", "/api/stock-issues", "Issues", "Confirm issue (server recomputes FEFO, idempotent by requestKey)", { permission: "issue.create", body: issueConfirmSchema }),

  E("get", "/api/stock-transfers", "Transfers", "List transfers", { permission: "inventory.view", paged: true }),
  E("get", "/api/stock-transfers/{id}", "Transfers", "Transfer with items", { permission: "inventory.view" }),
  E("post", "/api/stock-transfers", "Transfers", "Create draft transfer", { permission: "transfer.create", body: transferInputSchema }),
  E("post", "/api/stock-transfers/{id}/confirm", "Transfers", "Confirm transfer (atomic)", { permission: "transfer.confirm" }),
  E("post", "/api/stock-transfers/{id}/cancel", "Transfers", "Cancel draft", { permission: "transfer.create" }),

  E("get", "/api/stocktaking", "Stocktaking", "List sessions", { permission: "inventory.view", paged: true }),
  E("get", "/api/stocktaking/{id}", "Stocktaking", "Session with items", { permission: "inventory.view" }),
  E("post", "/api/stocktaking", "Stocktaking", "Create session (snapshot)", { permission: "stocktaking.count", body: stocktakingCreateSchema }),
  E("put", "/api/stocktaking/{id}/counts", "Stocktaking", "Record physical counts", { permission: "stocktaking.count", body: stocktakingCountSchema }),
  E("post", "/api/stocktaking/{id}/submit", "Stocktaking", "Submit for approval", { permission: "stocktaking.count" }),
  E("post", "/api/stocktaking/{id}/reopen", "Stocktaking", "Return to counting", { permission: "stocktaking.approve" }),
  E("post", "/api/stocktaking/{id}/approve", "Stocktaking", "Approve and post adjustments", { permission: "stocktaking.approve" }),
  E("post", "/api/stocktaking/{id}/cancel", "Stocktaking", "Cancel session", { permission: "stocktaking.approve" }),

  E("get", "/api/reports/{type}", "Reports", "inventory|product|lot|location|receipts|issues|expiring|expired|transfers|stocktaking (?format=csv)", { permission: "report.view" }),
  E("get", "/api/users", "Admin", "List users", { permission: "user.manage", paged: true }),
  E("post", "/api/users", "Admin", "Create user", { permission: "user.manage", body: userCreateSchema }),
  E("put", "/api/users/{id}", "Admin", "Update user / roles / reset password", { permission: "user.manage", body: userUpdateSchema }),
  E("get", "/api/audit-logs", "Admin", "Audit log", { permission: "audit.view", paged: true }),
  E("get", "/api/settings", "Admin", "Tenant settings", { permission: "dashboard.view" }),
  E("put", "/api/settings", "Admin", "Update settings", { permission: "settings.manage", body: tenantSettingsSchema }),
  E("post", "/api/demo/reset", "Admin", "Reset demo data (DEMO_MODE=true)", { permission: "settings.manage" }),
];

export function buildOpenApiDocument(serverUrl: string) {
  const paths: Record<string, Record<string, unknown>> = {};
  for (const e of ENDPOINTS) {
    const params = [...e.path.matchAll(/\{(\w+)\}/g)].map((m) => ({ name: m[1], in: "path", required: true, schema: { type: "string" } }));
    const op: Record<string, unknown> = {
      tags: [e.tag],
      summary: e.summary,
      description: e.permission ? `Required permission: \`${e.permission}\`` : undefined,
      parameters: params.length ? params : undefined,
      security: e.public ? [] : undefined,
      responses: {
        "200": { description: e.paged ? "`{ data: [...], meta: { page, pageSize, total, totalPages } }`" : "`{ data }`" },
        "4XX": { $ref: "#/components/responses/Error" },
      },
    };
    if (e.body) {
      op.requestBody = { required: true, content: { "application/json": { schema: z.toJSONSchema(e.body, { io: "input", unrepresentable: "any" }) } } };
    }
    (paths[e.path] ??= {})[e.method] = op;
  }
  return {
    openapi: "3.1.0",
    info: {
      title: "Warehouse Management System API",
      version: "1.0.0",
      description:
        "Session cookie auth (`wms_session`, HttpOnly). Mutating requests must send `X-CSRF-Token` (from /api/auth/login or /api/auth/me). Errors use `{ error: { code, message, details } }`.",
    },
    servers: [{ url: serverUrl }],
    components: {
      securitySchemes: { session: { type: "apiKey", in: "cookie", name: "wms_session" } },
      responses: {
        Error: {
          description: "Error",
          content: {
            "application/json": {
              schema: {
                type: "object",
                properties: { error: { type: "object", properties: { code: { type: "string" }, message: { type: "string" }, details: {} } } },
              },
            },
          },
        },
      },
    },
    security: [{ session: [] }],
    paths,
  };
}

export const SWAGGER_HTML = `<!doctype html><html><head><meta charset="utf-8"><title>WMS API</title>
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css"></head>
<body><div id="ui"></div><script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js"></script>
<script>SwaggerUIBundle({ url: "/api/openapi.json", dom_id: "#ui" });</script></body></html>`;
