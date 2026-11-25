/**
 * Demo data generator — industry: engineering plastics for electrical devices
 * (plastic resin, masterbatch & process chemicals, moulded electrical components,
 * mould spare parts and injection moulds).
 *
 * Produces plain SQL statements so the same data can be loaded by `npm run db:seed:*`
 * (via a generated .sql file) or by the in-app "reset demo" action.
 *
 * - Deterministic ids + INSERT OR IGNORE => re-running the seed never duplicates data.
 * - Dates are relative to the business date, so expiry alerts always look realistic.
 * - Every balance is backed by receipt/issue documents and ledger rows (consistent history).
 */
import type { SqlStatement, SqlValue } from "../adapters/db/types";
import { addDays } from "../domain/dates";
import { binCode, buildLocationCode, levelCode } from "../domain/location";

export const DEMO_TENANT_ID = "tenant_demo";
export const DEMO_PASSWORD = "Demo@123";
export const DEMO_ACCOUNTS = [
  { id: "usr_admin", email: "admin@demo.vn", fullName: "Nguyễn Văn An", role: "role_admin", phone: "0901000001" },
  { id: "usr_manager", email: "manager@demo.vn", fullName: "Trần Thị Bình", role: "role_manager", phone: "0901000002" },
  { id: "usr_staff", email: "staff@demo.vn", fullName: "Lê Văn Cường", role: "role_staff", phone: "0901000003" },
] as const;

/** Tables holding tenant data, in FK-safe delete order. Users are kept (demo accounts are re-upserted). */
const TENANT_TABLES = [
  "audit_logs",
  "inventory_transactions",
  "stocktaking_items",
  "stocktaking_sessions",
  "stock_transfer_items",
  "stock_transfers",
  "stock_issue_items",
  "stock_issues",
  "stock_receipt_items",
  "stock_receipts",
  "inventory_balances",
  "inventory_lots",
  "products",
  "product_categories",
  "suppliers",
  "warehouse_bins",
  "warehouse_levels",
  "warehouse_racks",
  "warehouse_zones",
  "warehouses",
];

/** capacity = storage units per bin (bags, cartons, boxes; 1 mould per pallet position in zone E). */
const ZONES = [
  { code: "A", name: "Khu A - Hạt nhựa nguyên sinh", type: "DRY", x: 2, y: 2, w: 30, h: 26, capacity: 120, racks: 3, levels: 4, bins: 4 },
  { code: "B", name: "Khu B - Hạt màu, phụ gia & hóa chất", type: "HAZARD", x: 35, y: 2, w: 30, h: 26, capacity: 60, racks: 3, levels: 4, bins: 4 },
  { code: "C", name: "Khu C - Thành phẩm linh kiện điện", type: "GENERAL", x: 68, y: 2, w: 30, h: 26, capacity: 80, racks: 3, levels: 4, bins: 4 },
  { code: "D", name: "Khu D - Bán thành phẩm & phụ tùng khuôn", type: "GENERAL", x: 2, y: 32, w: 46, h: 26, capacity: 80, racks: 3, levels: 4, bins: 4 },
  { code: "E", name: "Khu E - Kho khuôn ép", type: "BULK", x: 52, y: 32, w: 46, h: 26, capacity: 1, racks: 2, levels: 2, bins: 4 },
] as const;

const CATEGORIES = [
  { code: "RESIN", name: "Hạt nhựa nhiệt dẻo", description: "PC, ABS, PP, PA66, PBT, PVC" },
  { code: "THERMOSET", name: "Nhựa nhiệt rắn", description: "Bột Urea (UF), Melamine (MF) cho vỏ CB, mặt công tắc" },
  { code: "MB", name: "Hạt màu & phụ gia", description: "Masterbatch màu, chống cháy, chống UV" },
  { code: "CHEM", name: "Hóa chất sản xuất", description: "Chất tách khuôn, dầu bôi trơn, keo, dung dịch vệ sinh khuôn" },
  { code: "SWITCH", name: "Linh kiện công tắc - ổ cắm", description: "Mặt, đế, hạt công tắc, vỏ ổ cắm" },
  { code: "BREAKER", name: "Linh kiện CB / MCB", description: "Vỏ, tay gạt aptomat" },
  { code: "ENCL", name: "Vỏ hộp, ống luồn & phụ kiện", description: "Hộp nối, nắp tủ điện, ống và kẹp ống luồn dây" },
  { code: "SPARE", name: "Phụ tùng khuôn", description: "Ty đẩy, lò xo, bạc dẫn hướng" },
  { code: "MOLD", name: "Khuôn ép nhựa", description: "Khuôn ép phun đang lưu kho" },
];

const SUPPLIERS = [
  { code: "NCC01", name: "Công ty TNHH Hạt nhựa Kỹ thuật Đông Á", contact: "Phạm Minh Đức", phone: "0274 3741 001", email: "sales@dongaplastic-demo.vn", address: "KCN Sóng Thần 2, Dĩ An, Bình Dương" },
  { code: "NCC02", name: "Công ty CP Polymer Miền Nam", contact: "Võ Thị Lan", phone: "028 3780 0002", email: "order@polymermn-demo.vn", address: "KCN Hiệp Phước, Nhà Bè, TP. Hồ Chí Minh" },
  { code: "NCC03", name: "Công ty TNHH Masterbatch Việt Thành", contact: "Đặng Quốc Huy", phone: "028 3754 0003", email: "cs@vietthanhmb-demo.vn", address: "KCN Tân Tạo, Bình Tân, TP. Hồ Chí Minh" },
  { code: "NCC04", name: "Công ty CP Hóa chất Công nghiệp Thăng Long", contact: "Bùi Thu Trang", phone: "024 3958 0004", email: "info@tlchem-demo.vn", address: "KCN Quang Minh, Mê Linh, Hà Nội" },
  { code: "NCC05", name: "Xưởng ép nhựa nội bộ - Nhà máy Minh Phát", contact: "Huỳnh Văn Tài", phone: "0274 3741 005", email: "sanxuat@minhphat-demo.vn", address: "Lô C5, KCN Mỹ Phước 3, Bến Cát, Bình Dương" },
  { code: "NCC06", name: "Công ty TNHH Khuôn mẫu Chính xác Tân Tiến", contact: "Ngô Thanh Sơn", phone: "0251 3836 006", email: "khuon@tantien-demo.vn", address: "KCN Biên Hòa 2, Đồng Nai" },
];

interface ProductSpec {
  sku: string;
  name: string;
  category: string;
  unit: string;
  zone: string;
  supplier: string;
  /** 0 = no expiry date */
  shelfLife: number;
  min: number;
  max: number | null;
  qty: [number, number];
  /** lot number prefix (supplier lot / production lot / mould serial) */
  lotPrefix: string;
  lots?: number;
  description: string;
}

const P = (
  sku: string, name: string, category: string, unit: string, zone: string, supplier: string, shelfLife: number,
  min: number, max: number | null, qty: [number, number], lotPrefix: string, description: string, lots?: number,
): ProductSpec => ({ sku, name, category, unit, zone, supplier, shelfLife, min, max, qty, lotPrefix, description, lots });

const PRODUCTS: ProductSpec[] = [
  // ---- Khu A: hạt nhựa (bao 25kg)
  P("SP001", "Hạt nhựa PC chống cháy UL94 V-0 (bao 25kg)", "RESIN", "Bao", "A", "NCC01", 540, 150, 800, [60, 120], "PC", "Polycarbonate chống cháy, dùng ép mặt công tắc, hạt công tắc, vỏ ổ cắm. Sấy 120°C/4h trước khi ép."),
  P("SP002", "Hạt nhựa ABS chống cháy V-0 màu trắng (bao 25kg)", "RESIN", "Bao", "A", "NCC01", 540, 80, 600, [50, 120], "ABS", "ABS chống cháy cho vỏ ổ cắm kéo dài, hộp nối. Sấy 80°C/3h."),
  P("SP003", "Hạt nhựa PP Homopolymer (bao 25kg)", "RESIN", "Bao", "A", "NCC02", 720, 60, 500, [50, 130], "PP", "Polypropylene dùng ép kẹp ống, phụ kiện ống luồn dây."),
  P("SP004", "Hạt nhựa PA66 gia cường 30% sợi thủy tinh (bao 25kg)", "RESIN", "Bao", "A", "NCC01", 365, 60, 400, [40, 110], "PA66", "Nylon 66 GF30 cho tay gạt MCB, chi tiết chịu lực. Hút ẩm mạnh — bảo quản kín, sấy 80°C/4h."),
  P("SP005", "Hạt nhựa PBT gia cường sợi thủy tinh (bao 25kg)", "RESIN", "Bao", "A", "NCC02", 540, 40, 300, [40, 100], "PBT", "PBT GF dùng cho chi tiết cách điện chịu nhiệt."),
  P("SP006", "Hạt nhựa PVC cứng làm ống luồn dây (bao 25kg)", "RESIN", "Bao", "A", "NCC02", 365, 80, 600, [60, 130], "PVC", "PVC compound cho dây chuyền đùn ống luồn dây điện."),
  P("SP007", "Bột nhựa Urea Formaldehyde (UF) ép vỏ CB (bao 25kg)", "THERMOSET", "Bao", "A", "NCC02", 270, 50, 300, [40, 100], "UF", "Nhựa nhiệt rắn Urea, ép nóng vỏ MCB/aptomat. Hạn dùng ngắn, xuất theo FEFO."),
  P("SP008", "Bột nhựa Melamine (MF) ép mặt công tắc (bao 20kg)", "THERMOSET", "Bao", "A", "NCC02", 270, 40, 250, [30, 90], "MF", "Melamine Formaldehyde cho mặt công tắc cao cấp, chịu nhiệt và chống trầy."),
  // ---- Khu B: hạt màu, phụ gia, hóa chất
  P("SP009", "Hạt màu Masterbatch trắng sứ (bao 25kg)", "MB", "Bao", "B", "NCC03", 365, 30, 200, [20, 80], "MBW", "Tỷ lệ pha 2–3% cho PC/ABS màu trắng sứ."),
  P("SP010", "Hạt màu Masterbatch xám RAL 7035 (bao 25kg)", "MB", "Bao", "B", "NCC03", 365, 20, 150, [20, 60], "MBG", "Màu xám ghi tủ điện RAL 7035."),
  P("SP011", "Phụ gia chống cháy không halogen (bao 20kg)", "MB", "Bao", "B", "NCC03", 365, 20, 120, [20, 70], "FR", "Phụ gia đạt UL94 V-0, không chứa halogen (RoHS)."),
  P("SP012", "Phụ gia chống tia UV (bao 20kg)", "MB", "Bao", "B", "NCC03", 365, 10, 80, [15, 50], "UV", "Chống ố vàng cho sản phẩm lắp đặt ngoài trời."),
  P("SP013", "Chất tách khuôn silicone dạng xịt (thùng 24 chai)", "CHEM", "Thùng", "B", "NCC04", 365, 10, 60, [10, 40], "TK", "Bình xịt 500ml, dùng cho khuôn ép PC/ABS."),
  P("SP014", "Dầu bôi trơn ty đẩy khuôn chịu nhiệt (can 4L)", "CHEM", "Can", "B", "NCC04", 720, 10, 50, [10, 40], "DBT", "Dầu tổng hợp chịu nhiệt 250°C cho ty đẩy, chốt dẫn hướng."),
  P("SP015", "Keo dán nhựa kỹ thuật 2 thành phần (hộp 50ml)", "CHEM", "Hộp", "B", "NCC04", 180, 30, 200, [30, 90], "KEO", "Epoxy 2K dán vỏ hộp nối, thời gian khô 10 phút."),
  P("SP016", "Dung dịch vệ sinh khuôn (can 5L)", "CHEM", "Can", "B", "NCC04", 540, 10, 60, [10, 40], "VS", "Tẩy cặn nhựa, dầu trên bề mặt lòng khuôn."),
  // ---- Khu C: thành phẩm (xưởng ép nội bộ nhập kho)
  P("SP017", "Mặt công tắc 1 chiều PC trắng (thùng 500 cái)", "SWITCH", "Thùng", "C", "NCC05", 0, 40, 300, [30, 90], "TP", "Mặt công tắc đơn, PC V-0, màu trắng sứ."),
  P("SP018", "Đế ổ cắm âm tường 3 chấu (thùng 300 cái)", "SWITCH", "Thùng", "C", "NCC05", 0, 40, 300, [40, 120], "TP", "Đế âm tường ABS chống cháy, chuẩn hộp 86."),
  P("SP019", "Vỏ ổ cắm kéo dài 4 lỗ ABS (thùng 200 cái)", "SWITCH", "Thùng", "C", "NCC05", 0, 30, 250, [30, 110], "TP", "Bộ vỏ trên + dưới, ABS V-0 trắng."),
  P("SP021", "Vỏ MCB 1 cực Urea (thùng 400 cái)", "BREAKER", "Thùng", "C", "NCC05", 0, 30, 200, [30, 100], "TP", "Vỏ aptomat 1P ép nhiệt rắn Urea, chịu hồ quang."),
  P("SP023", "Hộp nối dây chống nước IP65 (thùng 100 cái)", "ENCL", "Thùng", "C", "NCC05", 0, 20, 150, [20, 80], "TP", "Hộp nối PC + gioăng cao su, đạt IP65."),
  P("SP024", "Ống luồn dây PVC D20 (bó 50 cây x 2.92m)", "ENCL", "Bó", "C", "NCC05", 0, 50, 400, [60, 140], "TP", "Ống tròn cứng D20, chống cháy, màu trắng."),
  P("SP025", "Nắp tủ điện âm tường 8 module (thùng 50 cái)", "ENCL", "Thùng", "C", "NCC05", 0, 15, 100, [15, 60], "TP", "Nắp trong suốt PC cho tủ điện 8 đường."),
  // ---- Khu D: bán thành phẩm & phụ tùng khuôn
  P("SP020", "Hạt công tắc rocker PC (thùng 1000 cái)", "SWITCH", "Thùng", "D", "NCC05", 0, 20, 150, [20, 90], "BTP", "Bán thành phẩm chờ lắp ráp vào mặt công tắc."),
  P("SP022", "Tay gạt MCB PA66 GF30 (thùng 1000 cái)", "BREAKER", "Thùng", "D", "NCC05", 0, 20, 150, [20, 80], "BTP", "Bán thành phẩm chờ lắp ráp MCB."),
  P("SP026", "Kẹp ống luồn dây D20 PP (thùng 2000 cái)", "ENCL", "Thùng", "D", "NCC05", 0, 20, 200, [20, 100], "BTP", "Kẹp đỡ ống, đóng gói chờ xuất."),
  P("SP027", "Ty đẩy khuôn SKD61 Ø4 x 150mm (hộp 50 cây)", "SPARE", "Hộp", "D", "NCC06", 0, 5, 40, [8, 30], "PT", "Ty đẩy thép SKD61 tôi cứng, thay thế định kỳ."),
  P("SP028", "Lò xo khuôn tải nặng 25 x 50mm (hộp 20 cái)", "SPARE", "Hộp", "D", "NCC06", 0, 5, 40, [8, 30], "PT", "Lò xo hồi tấm đẩy, mã màu đỏ (tải nặng)."),
  P("SP029", "Bộ bạc dẫn hướng & chốt định vị khuôn", "SPARE", "Bộ", "D", "NCC06", 0, 10, 60, [10, 40], "PT", "Bộ bạc + chốt dẫn hướng tiêu chuẩn Misumi."),
  // ---- Khu E: khuôn ép (mỗi lô = 1 bộ khuôn, số lô = số serial khuôn)
  P("SP030", "Khuôn ép mặt công tắc 1 chiều (4 cavity)", "MOLD", "Bộ", "E", "NCC06", 0, 0, 3, [1, 1], "KH-MCT", "Khuôn nóng (hot runner), thép NAK80, tuổi thọ 500.000 shot.", 3),
  P("SP031", "Khuôn ép đế ổ cắm âm tường (2 cavity)", "MOLD", "Bộ", "E", "NCC06", 0, 0, 3, [1, 1], "KH-DOC", "Khuôn nguội 2 tấm, thép P20.", 2),
  P("SP032", "Khuôn ép vỏ MCB 1 cực - nhiệt rắn (2 cavity)", "MOLD", "Bộ", "E", "NCC06", 0, 0, 3, [1, 1], "KH-MCB", "Khuôn ép nóng cho bột Urea, gia nhiệt điện trở.", 3),
];

const INTERNAL_CATEGORIES = new Set(["RESIN", "THERMOSET", "MB", "CHEM", "SPARE"]);

/** Small deterministic PRNG so the demo looks the same for a given date. */
function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const yymm = (date: string) => date.slice(2, 4) + date.slice(5, 7);
const yymmdd = (date: string) => date.slice(2).replaceAll("-", "");

export interface DemoSeedOptions {
  today: string;
  passwordHash: string;
  reset: boolean;
}

export function buildDemoStatements(opts: DemoSeedOptions): SqlStatement[] {
  const { today, passwordHash } = opts;
  const T = DEMO_TENANT_ID;
  const rand = mulberry32(20260101);
  const randInt = (min: number, max: number) => min + Math.floor(rand() * (max - min + 1));
  const out: SqlStatement[] = [];
  const ins = (table: string, row: Record<string, SqlValue>) => {
    const cols = Object.keys(row);
    out.push({ sql: `INSERT OR IGNORE INTO ${table} (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`, params: cols.map((c) => row[c]) });
  };

  if (opts.reset) {
    for (const table of TENANT_TABLES) out.push({ sql: `DELETE FROM ${table} WHERE tenant_id = ?`, params: [T] });
    out.push({ sql: "DELETE FROM login_attempts", params: [] });
  }

  // ---- tenant & users
  ins("tenants", {
    id: T, code: "DEMO", name: "Công ty TNHH Nhựa Kỹ thuật Minh Phát (Demo)",
    settings: JSON.stringify({ slowMovingDays: 90, nearCapacityPercent: 80 }),
  });
  if (opts.reset) out.push({ sql: "UPDATE tenants SET name = ? WHERE id = ?", params: ["Công ty TNHH Nhựa Kỹ thuật Minh Phát (Demo)", T] });
  for (const u of DEMO_ACCOUNTS) {
    ins("users", { id: u.id, tenant_id: T, email: u.email, full_name: u.fullName, phone: u.phone, password_hash: passwordHash, status: "ACTIVE" });
    if (opts.reset) {
      out.push({ sql: "UPDATE users SET password_hash = ?, status = 'ACTIVE', deleted_at = NULL WHERE id = ?", params: [passwordHash, u.id] });
      out.push({ sql: "DELETE FROM user_roles WHERE user_id = ?", params: [u.id] });
    }
    ins("user_roles", { user_id: u.id, role_id: u.role });
  }

  // ---- warehouse structure
  const WH = { id: "wh_main", code: "WH001" };
  ins("warehouses", { id: WH.id, tenant_id: T, code: WH.code, name: "Kho nhựa kỹ thuật Mỹ Phước", address: "Lô C5, KCN Mỹ Phước 3, Bến Cát, Bình Dương" });
  type BinSlot = { id: string; code: string; capacity: number; used: number };
  const binsByZone = new Map<string, BinSlot[]>();
  for (const z of ZONES) {
    const zoneId = `zn_${z.code}`;
    ins("warehouse_zones", {
      id: zoneId, tenant_id: T, warehouse_id: WH.id, code: z.code, name: z.name, zone_type: z.type, status: "ACTIVE",
      description: z.code === "E" ? "Mỗi ô là 1 vị trí pallet chứa 1 bộ khuôn" : null,
      map_x: z.x, map_y: z.y, map_width: z.w, map_height: z.h,
    });
    const bins: BinSlot[] = [];
    for (let r = 1; r <= z.racks; r++) {
      const rackCode = `${z.code}${String(r).padStart(2, "0")}`;
      const rackId = `rk_${rackCode}`;
      ins("warehouse_racks", { id: rackId, tenant_id: T, zone_id: zoneId, code: rackCode, name: z.code === "E" ? `Kệ khuôn ${rackCode}` : `Kệ ${rackCode}` });
      for (let l = 1; l <= z.levels; l++) {
        const lc = levelCode(l);
        const levelId = `lv_${rackCode}_${lc}`;
        ins("warehouse_levels", { id: levelId, tenant_id: T, rack_id: rackId, code: lc, level_number: l });
        for (let b = 1; b <= z.bins; b++) {
          const bc = binCode(b);
          const id = `bn_${rackCode}_${lc}_${bc}`;
          const code = buildLocationCode({ warehouseCode: WH.code, zoneCode: z.code, rackCode, levelCode: lc, binCode: bc });
          // one bin under maintenance to demonstrate the gray state
          const status = rackCode === "D03" && lc === "L04" && b === 4 ? "INACTIVE" : "ACTIVE";
          ins("warehouse_bins", { id, tenant_id: T, warehouse_id: WH.id, zone_id: zoneId, rack_id: rackId, level_id: levelId, code: bc, location_code: code, capacity: z.capacity, status });
          if (status === "ACTIVE") bins.push({ id, code, capacity: z.capacity, used: 0 });
        }
      }
    }
    binsByZone.set(z.code, bins);
  }

  // ---- master data
  for (const c of CATEGORIES) ins("product_categories", { id: `cat_${c.code}`, tenant_id: T, code: c.code, name: c.name, description: c.description });
  for (const s of SUPPLIERS) {
    ins("suppliers", { id: `sup_${s.code}`, tenant_id: T, code: s.code, name: s.name, contact_name: s.contact, phone: s.phone, email: s.email, address: s.address });
  }
  for (const p of PRODUCTS) {
    ins("products", {
      id: `prd_${p.sku}`, tenant_id: T, category_id: `cat_${p.category}`, sku: p.sku, name: p.name,
      barcode: `893${String(1000000000 + Number(p.sku.slice(2)) * 7919).slice(0, 10)}`,
      unit: p.unit, description: p.description, min_stock: p.min, max_stock: p.max, status: "ACTIVE",
    });
  }

  // ---- lots, receipts, issues, ledger
  type LotPlan = { id: string; product: ProductSpec; lotNumber: string; mfg: string | null; exp: string | null; received: string; qty: number; status: string; notes: string | null; issued: number };
  const lots: LotPlan[] = [];
  // expiry buckets cycle so every alert category has data (only materials have an expiry date)
  const expiryOffsets = [-25, 3, 12, 45, 150, -6, 6, 20, 38, 240, 1, 27, 55, 400];
  let bucket = 0;
  PRODUCTS.forEach((p, idx) => {
    const lotCount = p.lots ?? (p.sku === "SP001" ? 3 : idx % 3 === 0 ? 4 : 3);
    for (let n = 1; n <= lotCount; n++) {
      let exp: string | null = null;
      let mfg: string;
      let qty = randInt(p.qty[0], p.qty[1]);
      let specLot: string | null = null;
      if (p.sku === "SP001") {
        // the FEFO example from the specification: 100 / 200 / 150 units
        const spec = [
          { lot: "LOT001", qty: 100, days: 7 },
          { lot: "LOT002", qty: 200, days: 21 },
          { lot: "LOT003", qty: 150, days: 38 },
        ][n - 1];
        specLot = spec.lot;
        qty = spec.qty;
        exp = addDays(today, spec.days);
        mfg = addDays(exp, -p.shelfLife);
      } else if (p.shelfLife > 0) {
        const offset = expiryOffsets[bucket++ % expiryOffsets.length];
        exp = addDays(today, Math.min(offset, p.shelfLife - 10));
        mfg = addDays(exp, -p.shelfLife);
      } else if (p.category === "MOLD") {
        mfg = addDays(today, -randInt(400, 1500)); // mould fabrication date
      } else {
        mfg = addDays(today, -randInt(3, 120)); // production date
      }
      // received recently, never before manufacturing; some old lots / idle moulds for "slow-moving"
      const oldStock = p.category === "MOLD" ? n !== 1 : idx % 7 === 3 && n === 1;
      let received = addDays(today, oldStock ? -randInt(120, 200) : -randInt(2, 75));
      if (received < mfg) received = addDays(mfg, 3) > today ? mfg : addDays(mfg, 3);
      if (received > today) received = today;

      const lotNumber =
        specLot ??
        (p.category === "MOLD"
          ? `${p.lotPrefix}-${String(n).padStart(2, "0")}`
          : p.shelfLife > 0
            ? `${p.lotPrefix}-${yymm(mfg)}-${String(n).padStart(2, "0")}`
            : `${p.lotPrefix}-${yymmdd(mfg)}-${String(n).padStart(2, "0")}`);
      lots.push({ id: `lot_${p.sku}_${n}`, product: p, lotNumber, mfg, exp, received, qty, status: "AVAILABLE", notes: null, issued: 0 });
    }
  });

  // quality states
  const setStatus = (lotId: string, status: string, notes: string) => {
    const lot = lots.find((l) => l.id === lotId);
    if (lot) Object.assign(lot, { status, notes });
  };
  setStatus("lot_SP004_1", "QUARANTINE", "Chờ QC: độ ẩm hạt PA66 vượt 0,2% — cần sấy lại trước khi đưa vào sản xuất");
  setStatus("lot_SP018_2", "QUARANTINE", "Chờ QC: kiểm tra kích thước lỗ bắt vít sau khi sửa khuôn");
  setStatus("lot_SP009_2", "BLOCKED", "Sai lệch màu ΔE > 1,5 so với mẫu chuẩn — chờ trả nhà cung cấp");
  setStatus("lot_SP031_2", "BLOCKED", "Khuôn chờ sửa: mòn lõi cavity số 2");

  // issued quantities (history): part of the stock was consumed by production or sold
  lots.forEach((l, i) => {
    const old = l.received < addDays(today, -100);
    if (l.product.category === "MOLD" || old || i % 4 === 1 || /^LOT00\d$/.test(l.lotNumber)) return;
    l.issued = Math.floor(l.qty * (0.2 + rand() * 0.5));
  });
  // push a few products below minimum stock
  for (const sku of ["SP010", "SP017", "SP029"]) {
    lots.filter((l) => l.product.sku === sku).forEach((l) => (l.issued = l.qty - randInt(1, 3)));
  }

  // place each lot in one or more bins of its product's zone
  type Position = { lot: LotPlan; binId: string; qty: number; issued: number };
  const positions: Position[] = [];
  for (const lot of lots) {
    const bins = binsByZone.get(lot.product.zone)!;
    const cap = bins[0].capacity;
    const isSpecLot = /^LOT00\d$/.test(lot.lotNumber);
    const maxPart = isSpecLot ? cap : Math.max(1, Math.floor(cap * 0.75));
    const split = Math.max(1, Math.ceil(lot.qty / maxPart));
    let remaining = lot.qty;
    let remainingIssued = lot.issued;
    const binsOfLot = new Set<string>(); // (lot, bin) is unique: split parts go to different bins
    for (let s = 0; s < split; s++) {
      const part = s === split - 1 ? remaining : Math.floor(lot.qty / split);
      const issuedPart = s === split - 1 ? remainingIssued : Math.floor(lot.issued / split);
      const balance = part - issuedPart;
      // first-fit from the front racks: realistic clustering, so the map shows near-full and full bins
      const startAt = randInt(0, Math.min(bins.length - 1, 24));
      let bin: BinSlot | null = null;
      for (let k = 0; k < bins.length; k++) {
        const candidate = bins[(startAt + k) % bins.length];
        if (!binsOfLot.has(candidate.id) && candidate.capacity - candidate.used >= part) {
          bin = candidate;
          break;
        }
      }
      if (!bin) throw new Error(`Demo data does not fit zone ${lot.product.zone}`);
      bin.used += balance;
      binsOfLot.add(bin.id);
      positions.push({ lot, binId: bin.id, qty: part, issued: issuedPart });
      remaining -= part;
      remainingIssued -= issuedPart;
    }
  }

  // Tighten the capacity of some occupied bins so the 2D map shows every colour band
  // (full = red, near capacity = yellow). Guarded so it never drops below current stock.
  let occupiedIndex = 0;
  for (const bins of binsByZone.values()) {
    for (const bin of bins) {
      if (bin.used <= 0 || bin.capacity <= 1) continue;
      occupiedIndex++;
      const target = occupiedIndex % 6 === 0 ? bin.used : occupiedIndex % 6 === 3 ? Math.ceil(bin.used / 0.88) : null;
      if (target === null) continue;
      out.push({
        sql: `UPDATE warehouse_bins SET capacity = ? WHERE id = ? AND tenant_id = ?
                AND COALESCE((SELECT SUM(quantity) FROM inventory_balances WHERE bin_id = ?), 0) <= ?`,
        params: [target, bin.id, T, bin.id, target],
      });
    }
  }

  // receipts grouped by (received date, supplier)
  const receiptGroups = new Map<string, Position[]>();
  for (const pos of positions) {
    const key = `${pos.lot.received}|${pos.lot.product.supplier}`;
    receiptGroups.set(key, [...(receiptGroups.get(key) ?? []), pos]);
  }
  let receiptSeq = 0;
  const receiptItemIds = new Map<Position, string>();
  for (const [key, group] of [...receiptGroups.entries()].sort()) {
    const [date, supplier] = key.split("|");
    receiptSeq++;
    const receiptId = `rcp_${String(receiptSeq).padStart(4, "0")}`;
    const created = `${date}T02:${String(receiptSeq % 60).padStart(2, "0")}:00.000Z`;
    const fromProduction = supplier === "NCC05";
    ins("stock_receipts", {
      id: receiptId, tenant_id: T, warehouse_id: WH.id, receipt_number: `PN-${yymmdd(date)}-${String(receiptSeq).padStart(4, "0")}`,
      supplier_id: `sup_${supplier}`, receipt_date: date,
      reference_no: fromProduction ? `LSX-${yymmdd(date)}-${String((receiptSeq % 9) + 1).padStart(2, "0")}` : `HĐ ${String(100000 + receiptSeq * 37)}`,
      notes: fromProduction ? "Nhập thành phẩm từ xưởng ép theo lệnh sản xuất" : null,
      status: "CONFIRMED", created_by: receiptSeq % 2 ? "usr_staff" : "usr_manager", confirmed_by: "usr_manager", confirmed_at: created, created_at: created, updated_at: created,
    });
    group.forEach((pos, i) => {
      const sku = pos.lot.product.sku;
      const itemId = `${receiptId}_i${i + 1}`;
      receiptItemIds.set(pos, itemId);
      ins("inventory_lots", {
        id: pos.lot.id, tenant_id: T, product_id: `prd_${sku}`, supplier_id: `sup_${supplier}`, lot_number: pos.lot.lotNumber,
        manufacturing_date: pos.lot.mfg, expiration_date: pos.lot.exp, received_date: pos.lot.received, status: pos.lot.status,
        notes: pos.lot.notes, created_at: created, updated_at: created,
      });
      ins("stock_receipt_items", {
        id: itemId, tenant_id: T, receipt_id: receiptId, product_id: `prd_${sku}`, lot_id: pos.lot.id, lot_number: pos.lot.lotNumber,
        manufacturing_date: pos.lot.mfg, expiration_date: pos.lot.exp, bin_id: pos.binId, quantity: pos.qty, created_at: created,
      });
    });
  }

  // balances = received - issued
  for (const pos of positions) {
    ins("inventory_balances", {
      id: `bal_${pos.lot.id}_${pos.binId}`, tenant_id: T, product_id: `prd_${pos.lot.product.sku}`, lot_id: pos.lot.id, bin_id: pos.binId, quantity: pos.qty - pos.issued,
    });
  }

  // issues over the last 30 days: materials/spares go to the moulding lines (INTERNAL_USE),
  // finished parts are sold to electrical-equipment manufacturers (SALE)
  const issueGroups = new Map<string, Position[]>();
  for (const pos of positions.filter((p) => p.issued > 0)) {
    const earliest = pos.lot.received > addDays(today, -29) ? pos.lot.received : addDays(today, -29);
    const span = Math.max(0, Math.round((Date.parse(today) - Date.parse(earliest)) / 86_400_000));
    const date = addDays(earliest, randInt(0, span));
    const product = pos.lot.product;
    // materials go to the line that consumes them; finished parts are grouped per sales order
    const destination = !INTERNAL_CATEGORIES.has(product.category)
      ? "SALE"
      : product.category === "SPARE"
        ? "Tổ bảo trì khuôn"
        : product.sku === "SP006"
          ? "Dây chuyền đùn ống PVC"
          : product.category === "THERMOSET"
            ? "Xưởng ép nhiệt rắn Urea/Melamine"
            : Number(product.sku.slice(2)) % 2
              ? "Xưởng ép nhựa - Line 1 (máy 180T)"
              : "Xưởng ép nhựa - Line 2 (máy 250T)";
    const key = `${date}|${destination}`;
    issueGroups.set(key, [...(issueGroups.get(key) ?? []), pos]);
  }
  const customers = [
    "Công ty CP Thiết bị điện Sao Mai",
    "Công ty TNHH Điện dân dụng Ánh Dương",
    "Nhà máy tủ bảng điện Phúc Long",
    "Công ty CP Khí cụ điện Trường Thịnh",
    "Đại lý vật tư điện Hưng Thịnh - Long An",
  ];
  let issueSeq = 0;
  for (const [key, group] of [...issueGroups.entries()].sort()) {
    const [date, destination] = key.split("|");
    const kind = destination === "SALE" ? "SALE" : destination === "Tổ bảo trì khuôn" ? "MAINT" : "LINE";
    issueSeq++;
    const issueId = `iss_${String(issueSeq).padStart(4, "0")}`;
    const created = `${date}T07:${String(issueSeq % 60).padStart(2, "0")}:00.000Z`;
    const recipient = kind === "SALE" ? customers[issueSeq % customers.length] : destination;
    ins("stock_issues", {
      id: issueId, tenant_id: T, warehouse_id: WH.id, issue_number: `PX-${yymmdd(date)}-${String(issueSeq).padStart(4, "0")}`,
      request_key: `seed-${issueId}`, issue_date: date, recipient, reason: kind === "SALE" ? "SALE" : "INTERNAL_USE",
      notes: kind === "LINE" ? "Cấp nguyên liệu cho sản xuất theo kế hoạch ca" : kind === "MAINT" ? "Thay thế phụ tùng khi bảo dưỡng khuôn" : null,
      status: "CONFIRMED", created_by: issueSeq % 3 ? "usr_staff" : "usr_manager", confirmed_by: "usr_staff", confirmed_at: created, created_at: created, updated_at: created,
    });
    group.forEach((pos, i) => {
      const sku = pos.lot.product.sku;
      const itemId = `${issueId}_i${i + 1}`;
      ins("stock_issue_items", { id: itemId, tenant_id: T, issue_id: issueId, product_id: `prd_${sku}`, lot_id: pos.lot.id, bin_id: pos.binId, quantity: pos.issued, expiration_date: pos.lot.exp, created_at: created });
      ins("inventory_transactions", {
        id: `txn_${itemId}`, tenant_id: T, transaction_type: "ISSUE", product_id: `prd_${sku}`, lot_id: pos.lot.id, bin_id: pos.binId,
        quantity_change: -pos.issued, balance_after: pos.qty - pos.issued, reference_type: "STOCK_ISSUE", reference_id: issueId, reference_item_id: itemId,
        transaction_date: date, created_by: "usr_staff", created_at: created,
      });
    });
  }
  // receipt ledger rows
  for (const pos of positions) {
    const itemId = receiptItemIds.get(pos)!;
    ins("inventory_transactions", {
      id: `txn_${itemId}`, tenant_id: T, transaction_type: "RECEIPT", product_id: `prd_${pos.lot.product.sku}`, lot_id: pos.lot.id, bin_id: pos.binId,
      quantity_change: pos.qty, balance_after: pos.qty, reference_type: "STOCK_RECEIPT", reference_id: itemId.split("_i")[0], reference_item_id: itemId,
      transaction_date: pos.lot.received, created_by: "usr_manager", created_at: `${pos.lot.received}T02:00:00.000Z`,
    });
  }

  ins("audit_logs", { id: `aud_seed_${today}`, tenant_id: T, user_id: null, action: opts.reset ? "demo.reset" : "demo.seeded", entity_type: "tenant", entity_id: T, details: JSON.stringify({ businessDate: today }) });
  return out;
}

/** Inline parameters into a SQL literal script (for `wrangler d1 execute --file`). */
export function toSqlScript(statements: SqlStatement[]): string {
  const lit = (v: SqlValue) => (v === null ? "NULL" : typeof v === "number" ? String(v) : `'${String(v).replace(/'/g, "''")}'`);
  return statements
    .map((s) => {
      let i = 0;
      return s.sql.replace(/\?/g, () => lit((s.params ?? [])[i++] ?? null)) + ";";
    })
    .join("\n");
}
