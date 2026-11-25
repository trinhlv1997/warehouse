import { describe, expect, it } from "vitest";
import { addDays, businessDate, daysBetween, isValidDateString } from "@/backend/domain/dates";
import { classifyExpiry, daysToExpiry, expiryDateRange, shelfLifePercent } from "@/backend/domain/expiry";
import { buildLocationCode, capacityStatus, levelCode, binCode, utilization } from "@/backend/domain/location";
import { hashPassword, verifyPassword, timingSafeEqual } from "@/backend/services/crypto";
import { permissionsForRoles } from "@/shared/constants";

describe("business dates (Asia/Ho_Chi_Minh)", () => {
  it("rolls over at Vietnam midnight, not UTC midnight", () => {
    // 2026-11-24 17:30 UTC = 2026-11-25 00:30 in Vietnam (UTC+7)
    expect(businessDate(new Date("2026-11-24T17:30:00Z"))).toBe("2026-11-25");
    expect(businessDate(new Date("2026-11-24T16:59:00Z"))).toBe("2026-11-24");
  });

  it("does date-only arithmetic", () => {
    expect(daysBetween("2026-11-24", "2026-12-01")).toBe(7);
    expect(daysBetween("2026-12-31", "2027-01-01")).toBe(1);
    expect(addDays("2026-02-27", 2)).toBe("2026-03-01");
    expect(isValidDateString("2026-02-30")).toBe(false);
    expect(isValidDateString("2026-02-28")).toBe(true);
  });
});

describe("expiry classification", () => {
  const today = "2026-11-24";
  it.each([
    ["2026-11-01", "EXPIRED"],
    ["2026-11-24", "EXPIRED"],
    ["2026-11-25", "CRITICAL"],
    ["2026-12-01", "CRITICAL"],
    ["2026-12-02", "WARNING"],
    ["2026-12-24", "WARNING"],
    ["2026-12-25", "NOTICE"],
    ["2027-01-23", "NOTICE"],
    ["2027-01-24", "SAFE"],
  ])("%s -> %s", (exp, status) => {
    expect(classifyExpiry(exp, today)).toBe(status);
  });

  it("handles missing expiry", () => {
    expect(classifyExpiry(null, today)).toBe("NO_EXPIRY");
    expect(daysToExpiry(null, today)).toBeNull();
  });

  it("date ranges agree with the classifier", () => {
    for (const status of ["CRITICAL", "WARNING", "NOTICE"] as const) {
      const r = expiryDateRange(status, today);
      expect(classifyExpiry(r.from, today)).toBe(status);
      expect(classifyExpiry(r.to, today)).toBe(status);
    }
    expect(classifyExpiry(expiryDateRange("EXPIRED", today).to, today)).toBe("EXPIRED");
    expect(classifyExpiry(expiryDateRange("SAFE", today).from, today)).toBe("SAFE");
  });

  it("computes remaining shelf life percentage", () => {
    expect(shelfLifePercent("2026-01-01", "2026-12-31", "2026-07-02")).toBe(50);
    expect(shelfLifePercent(null, "2026-12-31", today)).toBeNull();
    expect(shelfLifePercent("2026-01-01", "2026-02-01", today)).toBe(0);
  });
});

describe("locations & capacity", () => {
  it("builds hierarchical location codes", () => {
    expect(buildLocationCode({ warehouseCode: "WH001", zoneCode: "A", rackCode: "A01", levelCode: levelCode(2), binCode: binCode(3) })).toBe(
      "WH001-A-A01-L02-B03",
    );
  });

  it("classifies capacity bands", () => {
    expect(capacityStatus(10, 100, true)).toBe("AVAILABLE");
    expect(capacityStatus(80, 100, true)).toBe("NEAR_CAPACITY");
    expect(capacityStatus(100, 100, true)).toBe("FULL");
    expect(capacityStatus(10, 100, false)).toBe("INACTIVE");
    expect(utilization(1, 3)).toBe(33.3);
  });
});

describe("security helpers", () => {
  it("hashes and verifies passwords with a random salt", async () => {
    const h1 = await hashPassword("Secret#123", 1000);
    const h2 = await hashPassword("Secret#123", 1000);
    expect(h1).not.toEqual(h2);
    expect(await verifyPassword("Secret#123", h1)).toBe(true);
    expect(await verifyPassword("wrong", h1)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });

  it("compares in constant time", () => {
    expect(timingSafeEqual("abc", "abc")).toBe(true);
    expect(timingSafeEqual("abc", "abd")).toBe(false);
    expect(timingSafeEqual("abc", "abcd")).toBe(false);
  });

  it("maps roles to permissions (server-side RBAC source of truth)", () => {
    const staff = permissionsForRoles(["WAREHOUSE_STAFF"]);
    expect(staff).toContain("issue.create");
    expect(staff).not.toContain("transfer.confirm");
    expect(staff).not.toContain("user.manage");
    const manager = permissionsForRoles(["WAREHOUSE_MANAGER"]);
    expect(manager).toContain("stocktaking.approve");
    expect(manager).not.toContain("user.manage");
    expect(permissionsForRoles(["ADMIN"])).toContain("user.manage");
  });
});
