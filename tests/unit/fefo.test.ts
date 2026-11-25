import { describe, expect, it } from "vitest";
import { allocationFingerprint, calculateFefoAllocation, type FefoCandidate } from "@/backend/domain/fefo";

const today = "2026-11-24";

function lot(partial: Partial<FefoCandidate> & Pick<FefoCandidate, "lotNumber" | "quantity">): FefoCandidate {
  return {
    balanceId: `bal-${partial.lotNumber}-${partial.locationCode ?? "X"}`,
    lotId: `lot-${partial.lotNumber}`,
    lotStatus: "AVAILABLE",
    binId: `bin-${partial.locationCode ?? "X"}`,
    locationCode: "WH001-A-A01-L01-B01",
    binActive: true,
    expirationDate: null,
    receivedDate: "2026-01-01",
    ...partial,
  };
}

describe("calculateFefoAllocation", () => {
  it("allocates the spec example: 150 units -> LOT001 100 + LOT002 50", () => {
    const candidates = [
      lot({ lotNumber: "LOT003", quantity: 150, expirationDate: "2027-01-01" }),
      lot({ lotNumber: "LOT001", quantity: 100, expirationDate: "2026-12-01" }),
      lot({ lotNumber: "LOT002", quantity: 200, expirationDate: "2026-12-15" }),
    ];
    const result = calculateFefoAllocation(candidates, 150, today);
    expect(result.allocations.map((a) => [a.lotNumber, a.allocatedQuantity])).toEqual([
      ["LOT001", 100],
      ["LOT002", 50],
    ]);
    expect(result.allocatedQuantity).toBe(150);
    expect(result.shortageQuantity).toBe(0);
  });

  it("excludes expired, quarantined, blocked lots and inactive bins", () => {
    const candidates = [
      lot({ lotNumber: "EXP", quantity: 50, expirationDate: "2026-11-20" }),
      lot({ lotNumber: "TODAY", quantity: 10, expirationDate: today }),
      lot({ lotNumber: "QUA", quantity: 30, expirationDate: "2026-11-30", lotStatus: "QUARANTINE" }),
      lot({ lotNumber: "BLK", quantity: 20, expirationDate: "2026-11-30", lotStatus: "BLOCKED" }),
      lot({ lotNumber: "OFF", quantity: 99, expirationDate: "2026-11-30", binActive: false }),
      lot({ lotNumber: "OK", quantity: 40, expirationDate: "2027-03-01" }),
    ];
    const result = calculateFefoAllocation(candidates, 100, today);
    expect(result.allocations.map((a) => a.lotNumber)).toEqual(["OK"]);
    expect(result.allocatedQuantity).toBe(40);
    expect(result.shortageQuantity).toBe(60);
    expect(result.excluded).toEqual({ expired: 60, quarantine: 30, blocked: 20 });
  });

  it("puts lots without expiry last and breaks ties by received date (FIFO)", () => {
    const candidates = [
      lot({ lotNumber: "NOEXP", quantity: 10, expirationDate: null, receivedDate: "2025-01-01" }),
      lot({ lotNumber: "B", quantity: 10, expirationDate: "2027-01-01", receivedDate: "2026-05-01" }),
      lot({ lotNumber: "A", quantity: 10, expirationDate: "2027-01-01", receivedDate: "2026-04-01" }),
    ];
    const result = calculateFefoAllocation(candidates, 25, today);
    expect(result.allocations.map((a) => [a.lotNumber, a.allocatedQuantity])).toEqual([
      ["A", 10],
      ["B", 10],
      ["NOEXP", 5],
    ]);
  });

  it("splits one lot stored in several bins by location order", () => {
    const candidates = [
      lot({ lotNumber: "L1", quantity: 5, expirationDate: "2027-01-01", locationCode: "WH001-B-B01-L01-B02" }),
      lot({ lotNumber: "L1", quantity: 5, expirationDate: "2027-01-01", locationCode: "WH001-A-A01-L01-B01" }),
    ];
    const result = calculateFefoAllocation(candidates, 7, today);
    expect(result.allocations.map((a) => [a.locationCode, a.allocatedQuantity])).toEqual([
      ["WH001-A-A01-L01-B01", 5],
      ["WH001-B-B01-L01-B02", 2],
    ]);
  });

  it("rejects non-positive or fractional quantities", () => {
    expect(() => calculateFefoAllocation([], 0, today)).toThrow(RangeError);
    expect(() => calculateFefoAllocation([], 1.5, today)).toThrow(RangeError);
  });

  it("produces a fingerprint that changes when stock changes", () => {
    const c = [lot({ lotNumber: "A", quantity: 10, expirationDate: "2027-01-01" })];
    const f1 = allocationFingerprint([{ productId: "p", result: calculateFefoAllocation(c, 5, today) }]);
    const f2 = allocationFingerprint([{ productId: "p", result: calculateFefoAllocation([{ ...c[0], quantity: 8 }], 5, today) }]);
    expect(f1).not.toEqual(f2);
  });
});
