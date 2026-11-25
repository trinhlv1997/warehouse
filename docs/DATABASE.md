# Cơ sở dữ liệu

Cloudflare D1 (SQLite). Schema: `database/migrations/0001_init.sql`. Quy ước:

- Tên bảng/cột tiếng Anh, `snake_case`.
- Khóa chính `TEXT` (UUID; dữ liệu demo dùng id cố định để seed idempotent) — chuyển sang PostgreSQL dễ dàng.
- Timestamp ISO-8601 UTC (`created_at`, `updated_at`); ngày nghiệp vụ `YYYY-MM-DD`.
- Số lượng là số nguyên.
- Xóa mềm: `deleted_at` (users, warehouses, zones, racks, categories, suppliers), `archived_at`/`status='ARCHIVED'` (products).

## Sơ đồ quan hệ chính

```
tenants ─┬─ users ── user_roles ── roles
         ├─ warehouses ── warehouse_zones ── warehouse_racks ── warehouse_levels ── warehouse_bins
         ├─ product_categories ── products ── inventory_lots ── inventory_balances (lot × bin) ── warehouse_bins
         ├─ suppliers ── inventory_lots
         ├─ stock_receipts ── stock_receipt_items
         ├─ stock_issues ── stock_issue_items           (mỗi dòng = 1 phân bổ FEFO: lô + ô)
         ├─ stock_transfers ── stock_transfer_items
         ├─ stocktaking_sessions ── stocktaking_items
         ├─ inventory_transactions                     (sổ cái mọi biến động)
         └─ audit_logs
sessions, login_attempts                               (bảo mật)
```

## Bảng

| Bảng | Vai trò |
|---|---|
| `tenants` | Doanh nghiệp (SaaS). `settings` JSON: `slowMovingDays`, `nearCapacityPercent` |
| `users`, `roles`, `user_roles` | Tài khoản, 3 vai trò cố định |
| `sessions` | Phiên đăng nhập server-side. `id` = HMAC-SHA256(token, SESSION_SECRET) |
| `login_attempts` | Giới hạn đăng nhập sai theo email/IP |
| `warehouses` | Kho chính (WH001) |
| `warehouse_zones` | Khu vực; `map_x/y/width/height` cho sơ đồ 2D (lưới 100×60) |
| `warehouse_racks`, `warehouse_levels` | Kệ, tầng |
| `warehouse_bins` | Ô lưu trữ; `location_code` dạng `WH001-A-A01-L02-B03`, `capacity` (đơn vị hàng) |
| `product_categories`, `products`, `suppliers` | Danh mục |
| `inventory_lots` | Lô: số lô, NSX, HSD, ngày nhập, NCC, trạng thái `AVAILABLE/QUARANTINE/BLOCKED`. Duy nhất theo (tenant, product, lot_number) |
| `inventory_balances` | **Tồn kho = Sản phẩm + Lô + Ô**. `UNIQUE(lot_id, bin_id)`, `CHECK (quantity >= 0)` |
| `stock_receipts(_items)` | Phiếu nhập `DRAFT → CONFIRMED/CANCELLED` |
| `stock_issues(_items)` | Phiếu xuất (tạo ở trạng thái `CONFIRMED`), `request_key` idempotency |
| `stock_transfers(_items)` | Phiếu điều chuyển `DRAFT → CONFIRMED/CANCELLED` |
| `stocktaking_sessions(_items)` | Kiểm kê `COUNTING → SUBMITTED → APPROVED` (hoặc `CANCELLED`); items chụp `system_quantity` |
| `inventory_transactions` | Sổ cái: `RECEIPT`, `ISSUE`, `TRANSFER_OUT`, `TRANSFER_IN`, `ADJUSTMENT`, `quantity_change` có dấu, `balance_after` |
| `audit_logs` | Nhật ký: đăng nhập, thay đổi dữ liệu, xác nhận chứng từ |

Số lượng của một lô **không lưu trùng**: luôn = `SUM(inventory_balances.quantity)` theo lô, nên thông tin HSD theo lô không bao giờ mất khi cộng tổng.

## Trigger

| Trigger | Tác dụng |
|---|---|
| `trg_balances_capacity_insert/update` | Hủy batch nếu tổng tồn của ô > `capacity` (`BIN_CAPACITY_EXCEEDED`) hoặc ô `INACTIVE` (`BIN_INACTIVE`) |
| `trg_receipts_status`, `trg_transfers_status` | Chứng từ đã khác `DRAFT` thì không đổi trạng thái được nữa |
| `trg_issues_status` | Phiếu xuất đã hủy không đổi được trạng thái |
| `trg_stocktaking_status` | Chỉ duyệt từ `SUBMITTED`; phiên đã duyệt/hủy là bất biến |

## Migration

```bash
npx wrangler d1 migrations create DB <ten_migration>   # tạo file mới trong database/migrations
npm run db:migrate:local
npm run db:migrate:remote                              # trước khi deploy code mới
```

Không sửa migration đã chạy ở production; luôn tạo file mới.

## Dữ liệu demo

`src/backend/seed/demoData.ts` sinh dữ liệu theo **ngày nghiệp vụ hiện tại** (để luôn có hàng hết hạn, sắp hết hạn 7/30/60 ngày...):

Ngành: **nhựa kỹ thuật cho thiết bị điện** (Công ty TNHH Nhựa Kỹ thuật Minh Phát — kho Mỹ Phước, Bình Dương).

| Khu | Nội dung | Cấu trúc | Sức chứa ô |
|---|---|---|---|
| A | Hạt nhựa nhiệt dẻo & bột nhiệt rắn (PC, ABS, PP, PA66, PBT, PVC, Urea, Melamine) | 3 kệ × 4 tầng × 4 ô | 120 bao |
| B | Hạt màu, phụ gia, hóa chất (masterbatch, chống cháy, chống UV, tách khuôn, keo...) | 3 × 4 × 4 | 60 |
| C | Thành phẩm linh kiện điện (mặt công tắc, đế ổ cắm, vỏ MCB, hộp nối IP65, ống luồn dây...) | 3 × 4 × 4 | 80 thùng/bó |
| D | Bán thành phẩm chờ lắp ráp & phụ tùng khuôn (ty đẩy, lò xo, bạc dẫn hướng) | 3 × 4 × 4 (1 ô bảo trì) | 80 |
| E | Khuôn ép (mỗi ô = 1 vị trí pallet = 1 bộ khuôn; số lô = số serial khuôn) | 2 × 2 × 4 | 1 |

- 9 loại hàng, 6 nhà cung cấp (4 NCC nguyên liệu, xưởng ép nội bộ nhập thành phẩm, công ty khuôn mẫu), 32 sản phẩm, ~104 lô.
- Hạn sử dụng chỉ có ở nguyên liệu/hóa chất (hạt nhựa 9–24 tháng, keo 6 tháng...); thành phẩm, phụ tùng, khuôn không có HSD.
- Số lô: nguyên liệu `PC-2511-02` (tiền tố + tháng SX), thành phẩm `TP-260806-01` (ngày ép), bán thành phẩm `BTP-...`, khuôn `KH-MCT-01`.
- Trạng thái chất lượng mẫu: PA66 cách ly vì độ ẩm, đế ổ cắm chờ QC sau sửa khuôn, hạt màu bị khóa vì sai màu, khuôn chờ sửa.
- Phiếu xuất: nguyên liệu cấp cho Line 1/Line 2, xưởng nhiệt rắn, dây chuyền đùn ống (lý do *Sử dụng nội bộ*); phụ tùng cho Tổ bảo trì khuôn; thành phẩm bán cho các nhà máy thiết bị điện.
- Hàng dưới định mức: SP010 (hạt màu xám RAL 7035), SP017 (mặt công tắc), SP029 (bạc dẫn hướng). Tồn lâu: khuôn không sử dụng, lô nhập lâu.
- Lịch sử phiếu nhập/xuất và sổ cái khớp với tồn kho (test `keeps the ledger consistent with balances`).
- SP001 (hạt PC chống cháy V-0) có LOT001 (100 bao, HSD +7 ngày), LOT002 (200, +21), LOT003 (150, +38) — đúng ví dụ FEFO trong đặc tả.

Cùng một module được dùng bởi `scripts/generate-seed.ts` (CLI) và `POST /api/demo/reset` (nút trong Cài đặt). ID cố định + `INSERT OR IGNORE` ⇒ chạy seed nhiều lần không tạo trùng; `db:reset:*` xóa dữ liệu tenant demo rồi nạp lại.
