import { beforeEach, describe, expect, it } from "vitest";
import { permissionsForRoles } from "@/shared/constants";
import { receiptInputSchema } from "@/shared/schemas";
import type { Container } from "@/backend/container";
import { businessDate, addDays } from "@/backend/domain/dates";
import { AppError } from "@/backend/domain/errors";
import { DEMO_TENANT_ID, buildDemoStatements } from "@/backend/seed/demoData";
import type { Actor } from "@/backend/services/context";
import { createSeededContainer, type SqliteDatabase } from "../helpers/sqlite";

const today = businessDate();
const manager: Actor = { userId: "usr_manager", tenantId: DEMO_TENANT_ID, permissions: permissionsForRoles(["WAREHOUSE_MANAGER"]), ipAddress: null };

let db: SqliteDatabase;
let c: Container;

beforeEach(async () => {
  ({ db, container: c } = await createSeededContainer(today));
});

const count = async (sql: string, params: (string | number)[] = []) => (await db.first<{ n: number }>(sql, params))!.n;
const qty = async (lotId: string) => count("SELECT COALESCE(SUM(quantity), 0) AS n FROM inventory_balances WHERE lot_id = ?", [lotId]);

async function expectAppError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toSatisfy((e: unknown) => e instanceof AppError && e.code === code);
}

async function emptyBin(zone = "A") {
  const bins = await c.warehouse.listBins(manager, { zoneId: `zn_${zone}`, occupancy: "EMPTY", status: "ACTIVE", page: 1, pageSize: 5 });
  return bins.items[0];
}

describe("demo seed", () => {
  it("creates the required volume of realistic data", async () => {
    expect(await count("SELECT COUNT(*) AS n FROM warehouse_zones")).toBe(5);
    expect(await count("SELECT COUNT(*) AS n FROM products")).toBeGreaterThanOrEqual(30);
    expect(await count("SELECT COUNT(*) AS n FROM inventory_lots")).toBeGreaterThanOrEqual(60);
    expect(await count("SELECT COUNT(*) AS n FROM inventory_lots WHERE expiration_date <= ?", [today])).toBeGreaterThan(0);
    expect(await count("SELECT COUNT(*) AS n FROM inventory_lots WHERE expiration_date > ? AND expiration_date <= ?", [today, addDays(today, 7)])).toBeGreaterThan(0);
    expect(await count("SELECT COUNT(*) AS n FROM inventory_lots WHERE expiration_date > ? AND expiration_date <= ?", [addDays(today, 7), addDays(today, 30)])).toBeGreaterThan(0);
    expect(await count("SELECT COUNT(*) AS n FROM inventory_lots WHERE expiration_date > ?", [addDays(today, 60)])).toBeGreaterThan(0);
    expect(await count("SELECT COUNT(*) AS n FROM inventory_transactions WHERE transaction_type = 'ISSUE'")).toBeGreaterThan(0);
  });

  it("is idempotent: running it again does not duplicate rows", async () => {
    const before = await count("SELECT COUNT(*) AS n FROM inventory_transactions");
    await db.batch(buildDemoStatements({ today, passwordHash: "x", reset: false }));
    expect(await count("SELECT COUNT(*) AS n FROM inventory_transactions")).toBe(before);
    expect(await count("SELECT COUNT(*) AS n FROM products")).toBe(32);
  });

  it("keeps the ledger consistent with balances", async () => {
    const mismatches = await count(
      `SELECT COUNT(*) AS n FROM inventory_balances b
        WHERE b.quantity <> (SELECT COALESCE(SUM(quantity_change), 0) FROM inventory_transactions t WHERE t.lot_id = b.lot_id AND t.bin_id = b.bin_id)`,
    );
    expect(mismatches).toBe(0);
  });
});

describe("FEFO stock issue", () => {
  const line = [{ productId: "prd_SP001", quantity: 150 }];

  it("allocates LOT001 100 + LOT002 50 (spec example) and posts ledger rows", async () => {
    const preview = await c.issues.preview(manager, line);
    expect(preview.lines[0].allocations.map((a) => [a.lotNumber, a.allocatedQuantity])).toEqual([
      ["LOT001", 100],
      ["LOT002", 50],
    ]);
    const issue = await c.issues.confirm(manager, { requestKey: "req-spec-1", issueDate: today, recipient: "Test", reason: "SALE", notes: null, lines: line, previewFingerprint: preview.fingerprint });
    expect(issue.totalQuantity).toBe(150);
    expect(await qty("lot_SP001_1")).toBe(0);
    expect(await qty("lot_SP001_2")).toBe(150);
    expect(await qty("lot_SP001_3")).toBe(150);
    expect(await count("SELECT COUNT(*) AS n FROM inventory_transactions WHERE reference_id = ? AND transaction_type = 'ISSUE'", [issue.id])).toBe(issue.items!.length);
  });

  it("is idempotent per requestKey (no double deduction)", async () => {
    const input = { requestKey: "req-dup-1", issueDate: today, recipient: null, reason: "SALE" as const, notes: null, lines: [{ productId: "prd_SP001", quantity: 10 }] };
    const a = await c.issues.confirm(manager, input);
    const b = await c.issues.confirm(manager, input);
    expect(b.id).toBe(a.id);
    expect(await qty("lot_SP001_1")).toBe(90);
  });

  it("skips quarantined and expired lots", async () => {
    await c.inventory.updateLotStatus(manager, "lot_SP001_1", "QUARANTINE", null);
    const preview = await c.issues.preview(manager, [{ productId: "prd_SP001", quantity: 10 }]);
    expect(preview.lines[0].allocations[0].lotNumber).toBe("LOT002");
    expect(preview.lines[0].excluded.quarantine).toBe(100);

    await db.run("UPDATE inventory_lots SET expiration_date = ? WHERE id = 'lot_SP001_2'", [addDays(today, -1)]);
    const p2 = await c.issues.preview(manager, [{ productId: "prd_SP001", quantity: 10 }]);
    expect(p2.lines[0].allocations[0].lotNumber).toBe("LOT003");
    expect(p2.lines[0].excluded.expired).toBe(200);
  });

  it("rejects insufficient stock without changing anything", async () => {
    await expectAppError(
      c.issues.confirm(manager, { requestKey: "req-big", issueDate: today, recipient: null, reason: "SALE", notes: null, lines: [{ productId: "prd_SP001", quantity: 100000 }] }),
      "INSUFFICIENT_STOCK",
    );
    expect(await qty("lot_SP001_1")).toBe(100);
    expect(await count("SELECT COUNT(*) AS n FROM stock_issues WHERE request_key = 'req-big'")).toBe(0);
  });

  it("detects a stale preview", async () => {
    const preview = await c.issues.preview(manager, [{ productId: "prd_SP001", quantity: 50 }]);
    await c.issues.confirm(manager, { requestKey: "req-other", issueDate: today, recipient: null, reason: "SALE", notes: null, lines: [{ productId: "prd_SP001", quantity: 5 }] });
    await expectAppError(
      c.issues.confirm(manager, { requestKey: "req-stale", issueDate: today, recipient: null, reason: "SALE", notes: null, lines: [{ productId: "prd_SP001", quantity: 50 }], previewFingerprint: preview.fingerprint }),
      "STOCK_CHANGED",
    );
  });

  it("prevents concurrent over-allocation (negative stock)", async () => {
    const total = (await qty("lot_SP001_1")) + (await qty("lot_SP001_2")) + (await qty("lot_SP001_3"));
    const issue = (key: string) =>
      c.issues.confirm(manager, { requestKey: key, issueDate: today, recipient: null, reason: "SALE", notes: null, lines: [{ productId: "prd_SP001", quantity: total }] });
    const results = await Promise.allSettled([issue("race-1"), issue("race-2")]);
    expect(results.filter((r) => r.status === "fulfilled")).toHaveLength(1);
    const failure = results.find((r) => r.status === "rejected") as PromiseRejectedResult;
    expect(["STOCK_CHANGED", "INSUFFICIENT_STOCK"]).toContain((failure.reason as AppError).code);
    expect(await count("SELECT COUNT(*) AS n FROM inventory_balances WHERE quantity < 0")).toBe(0);
    expect(await count("SELECT COALESCE(SUM(quantity), 0) AS n FROM inventory_balances WHERE product_id = 'prd_SP001'")).toBe(0);
  });
});

describe("stock receipt", () => {
  it("creates lots and balances on confirm, and cannot be confirmed twice", async () => {
    const bin = await emptyBin();
    const input = receiptInputSchema.parse({
      supplierId: "sup_NCC02",
      receiptDate: today,
      items: [{ productId: "prd_SP002", lotNumber: "new-lot-1", manufacturingDate: addDays(today, -10), expirationDate: addDays(today, 200), binId: bin.id, quantity: 40 }],
    });
    const draft = await c.receipts.create(manager, input);
    expect(draft.status).toBe("DRAFT");
    const confirmed = await c.receipts.confirm(manager, draft.id);
    expect(confirmed.status).toBe("CONFIRMED");
    const lot = await c.repos.inventory.findLot(DEMO_TENANT_ID, "prd_SP002", "NEW-LOT-1");
    expect(lot).not.toBeNull();
    expect(await qty(lot!.id)).toBe(40);
    await expectAppError(c.receipts.confirm(manager, draft.id), "INVALID_STATUS_TRANSITION");
    // the database trigger also blocks a direct double confirmation
    await expect(db.run("UPDATE stock_receipts SET status = 'CONFIRMED' WHERE id = ?", [draft.id])).rejects.toThrow(/INVALID_STATUS_TRANSITION/);
    expect(await qty(lot!.id)).toBe(40);
  });

  it("rolls back everything when a bin would exceed capacity", async () => {
    const bin = await emptyBin();
    const draft = await c.receipts.create(
      manager,
      receiptInputSchema.parse({ receiptDate: today, items: [{ productId: "prd_SP002", lotNumber: "BIG", expirationDate: addDays(today, 300), binId: bin.id, quantity: bin.capacity + 1 }] }),
    );
    await expectAppError(c.receipts.confirm(manager, draft.id), "BIN_CAPACITY_EXCEEDED");
    expect((await c.receipts.get(manager, draft.id)).status).toBe("DRAFT");
    expect(await c.repos.inventory.findLot(DEMO_TENANT_ID, "prd_SP002", "BIG")).toBeNull();
  });

  it("rejects an existing lot number with a different expiry", async () => {
    const bin = await emptyBin();
    await expectAppError(
      c.receipts.create(manager, receiptInputSchema.parse({ receiptDate: today, items: [{ productId: "prd_SP001", lotNumber: "LOT001", expirationDate: addDays(today, 999), binId: bin.id, quantity: 1 }] })),
      "LOT_MISMATCH",
    );
  });
});

describe("stock transfer", () => {
  it("moves stock between bins keeping the lot, with capacity validation", async () => {
    const source = await db.first<{ lotId: string; binId: string; quantity: number }>(
      "SELECT lot_id AS lotId, bin_id AS binId, quantity FROM inventory_balances WHERE lot_id = 'lot_SP001_2' AND quantity > 20 LIMIT 1",
    );
    const target = await emptyBin();
    await expectAppError(
      c.transfers.create(manager, { transferDate: today, reason: null, notes: null, items: [{ lotId: source!.lotId, fromBinId: source!.binId, toBinId: target.id, quantity: target.capacity + 1 }] }),
      source!.quantity > target.capacity ? "BIN_CAPACITY_EXCEEDED" : "INSUFFICIENT_STOCK",
    );
    const draft = await c.transfers.create(manager, { transferDate: today, reason: "Sắp xếp", notes: null, items: [{ lotId: source!.lotId, fromBinId: source!.binId, toBinId: target.id, quantity: 20 }] });
    await c.transfers.confirm(manager, draft.id);
    const moved = await c.repos.inventory.getPosition(DEMO_TENANT_ID, source!.lotId, target.id);
    expect(moved?.quantity).toBe(20);
    expect((await c.repos.inventory.getPosition(DEMO_TENANT_ID, source!.lotId, source!.binId))?.quantity).toBe(source!.quantity - 20);
    expect(await qty(source!.lotId)).toBe(200);
    await expectAppError(c.transfers.confirm(manager, draft.id), "INVALID_STATUS_TRANSITION");
  });
});

describe("stocktaking", () => {
  it("snapshots, records counts and posts adjustments on approval", async () => {
    const session = await c.stocktaking.create(manager, { scopeType: "ZONE", scopeIds: ["zn_A"], notes: null });
    expect(session.items!.length).toBeGreaterThan(0);
    const [first, second] = session.items!;
    await c.stocktaking.recordCounts(manager, session.id, [
      { itemId: first.id, countedQuantity: first.systemQuantity - 3, notes: "Thiếu 3" },
      { itemId: second.id, countedQuantity: second.systemQuantity, notes: null },
    ]);
    const submitted = await c.stocktaking.submit(manager, session.id);
    expect(submitted.discrepancyCount).toBe(1);
    await c.stocktaking.approve(manager, session.id);
    const pos = await c.repos.inventory.getPosition(DEMO_TENANT_ID, first.lotId, first.binId);
    expect(pos!.quantity).toBe(first.systemQuantity - 3);
    expect(await count("SELECT COUNT(*) AS n FROM inventory_transactions WHERE reference_id = ? AND transaction_type = 'ADJUSTMENT'", [session.id])).toBe(1);
    await expectAppError(c.stocktaking.approve(manager, session.id), "INVALID_STATUS_TRANSITION");
  });
});

describe("alerts and dashboard", () => {
  it("computes expiry alerts dynamically from the database", async () => {
    const expired = await c.inventory.alerts(manager, "expired", { page: 1, pageSize: 100 });
    expect(expired.items.length).toBeGreaterThan(0);
    expect(expired.items.every((p) => p.expiryStatus === "EXPIRED")).toBe(true);
    const critical = await c.inventory.alerts(manager, "expiring", { page: 1, pageSize: 100, expiryStatus: "CRITICAL" });
    expect(critical.items.every((p) => p.daysToExpiry! >= 1 && p.daysToExpiry! <= 7)).toBe(true);
    const slow = await c.inventory.alerts(manager, "slow-moving", { page: 1, pageSize: 100 });
    expect(slow.items.length).toBeGreaterThan(0);
  });

  it("builds the dashboard from live data", async () => {
    const d = await c.dashboard.dashboard(manager);
    expect(d.totals.skuCount).toBe(32);
    expect(d.totals.expiredLots).toBeGreaterThan(0);
    expect(d.totals.lowStockProducts).toBeGreaterThan(0);
    expect(d.byZone).toHaveLength(5);
    expect(d.movements).toHaveLength(30);
  });

  it("produces every report type", async () => {
    for (const type of ["inventory", "product", "lot", "location", "receipts", "issues", "expiring", "expired", "transfers", "stocktaking"]) {
      const report = await c.dashboard.report(manager, type, {});
      expect(report.columns.length).toBeGreaterThan(0);
    }
  });
});

describe("tenant isolation", () => {
  it("never returns another tenant's data", async () => {
    await db.batch([
      { sql: "INSERT INTO tenants (id, code, name) VALUES ('tenant_other', 'OTHER', 'Other Co')" },
      { sql: "INSERT INTO users (id, tenant_id, email, full_name, password_hash) VALUES ('usr_other', 'tenant_other', 'x@other.vn', 'X', 'x')" },
    ]);
    const other: Actor = { ...manager, userId: "usr_other", tenantId: "tenant_other" };
    expect((await c.catalog.listProducts(other, { page: 1, pageSize: 10 })).meta.total).toBe(0);
    expect((await c.inventory.listPositions(other, { page: 1, pageSize: 10 })).meta.total).toBe(0);
    await expectAppError(c.catalog.getProduct(other, "prd_SP001"), "NOT_FOUND");
    await expectAppError(c.issues.preview(other, [{ productId: "prd_SP001", quantity: 1 }]), "VALIDATION_ERROR");
    expect(await c.repos.inventory.getLot("tenant_other", "lot_SP001_1")).toBeNull();
  });
});
