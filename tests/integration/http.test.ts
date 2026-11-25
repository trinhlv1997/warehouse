import { beforeEach, describe, expect, it } from "vitest";
import { createApp } from "@/backend/app";
import type { Container } from "@/backend/container";
import { businessDate } from "@/backend/domain/dates";
import { createSeededContainer } from "../helpers/sqlite";

let app: ReturnType<typeof createApp>;
let container: Container;

beforeEach(async () => {
  ({ container } = await createSeededContainer(businessDate()));
  app = createApp(() => container);
});

async function login(email: string, password = "Demo@123") {
  const res = await app.request("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json", "cf-connecting-ip": "10.0.0.1" },
    body: JSON.stringify({ email, password }),
  });
  const cookie = res.headers.get("set-cookie")?.split(";")[0] ?? "";
  const body = (await res.json()) as { data?: { csrfToken: string }; error?: { code: string } };
  return { res, cookie, csrf: body.data?.csrfToken ?? "", body, setCookie: res.headers.get("set-cookie") ?? "" };
}

describe("HTTP API security", () => {
  it("rejects anonymous requests", async () => {
    const res = await app.request("/api/products");
    expect(res.status).toBe(401);
    expect(((await res.json()) as { error: { code: string } }).error.code).toBe("UNAUTHORIZED");
  });

  it("logs in with an HttpOnly cookie and returns the user", async () => {
    const { res, cookie, setCookie } = await login("manager@demo.vn");
    expect(res.status).toBe(200);
    expect(setCookie).toMatch(/HttpOnly/i);
    expect(setCookie).toMatch(/SameSite=Lax/i);
    const me = await app.request("/api/auth/me", { headers: { cookie } });
    const body = (await me.json()) as { data: { user: { roles: string[] } } };
    expect(body.data.user.roles).toEqual(["WAREHOUSE_MANAGER"]);
  });

  it("requires a CSRF token for mutations", async () => {
    const { cookie, csrf } = await login("manager@demo.vn");
    const body = JSON.stringify({ code: "TEST", name: "Test" });
    const without = await app.request("/api/categories", { method: "POST", headers: { cookie, "Content-Type": "application/json" }, body });
    expect(without.status).toBe(403);
    const crossSite = await app.request("http://localhost/api/categories", {
      method: "POST",
      headers: { cookie, "Content-Type": "application/json", "X-CSRF-Token": csrf, Origin: "https://evil.example" },
      body,
    });
    expect(crossSite.status).toBe(403);
    const withToken = await app.request("/api/categories", { method: "POST", headers: { cookie, "Content-Type": "application/json", "X-CSRF-Token": csrf }, body });
    expect(withToken.status).toBe(201);
  });

  it("enforces role permissions on the server", async () => {
    const { cookie, csrf } = await login("staff@demo.vn");
    const headers = { cookie, "Content-Type": "application/json", "X-CSRF-Token": csrf };
    expect((await app.request("/api/users", { headers })).status).toBe(403);
    expect((await app.request("/api/reports/inventory", { headers })).status).toBe(403);
    expect((await app.request("/api/stock-transfers", { method: "POST", headers, body: "{}" })).status).toBe(403);
    expect((await app.request("/api/inventory?pageSize=5", { headers })).status).toBe(200);
    const preview = await app.request("/api/stock-issues/fefo-preview", { method: "POST", headers, body: JSON.stringify({ lines: [{ productId: "prd_SP001", quantity: 150 }] }) });
    expect(preview.status).toBe(200);
  });

  it("validates input with consistent error responses", async () => {
    const { cookie, csrf } = await login("admin@demo.vn");
    const res = await app.request("/api/products", { method: "POST", headers: { cookie, "Content-Type": "application/json", "X-CSRF-Token": csrf }, body: JSON.stringify({ sku: "" }) });
    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: { code: string; details: unknown[] } };
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.details.length).toBeGreaterThan(0);
  });

  it("rate-limits repeated failed logins", async () => {
    for (let i = 0; i < 5; i++) expect((await login("manager@demo.vn", "wrong")).res.status).toBe(401);
    const blocked = await login("manager@demo.vn", "Demo@123");
    expect(blocked.res.status).toBe(429);
  });

  it("logs out and invalidates the session", async () => {
    const { cookie, csrf } = await login("admin@demo.vn");
    const out = await app.request("/api/auth/logout", { method: "POST", headers: { cookie, "X-CSRF-Token": csrf } });
    expect(out.status).toBe(200);
    expect((await app.request("/api/dashboard", { headers: { cookie } })).status).toBe(401);
  });

  it("serves an OpenAPI document", async () => {
    const res = await app.request("/api/openapi.json");
    const doc = (await res.json()) as { paths: Record<string, unknown> };
    expect(Object.keys(doc.paths)).toContain("/api/stock-issues/fefo-preview");
  });
});
