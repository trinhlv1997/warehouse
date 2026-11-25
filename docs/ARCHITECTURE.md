# Kiến trúc

## Tổng quan triển khai

```
Trình duyệt ──HTTPS──► Cloudflare Worker "warehouse-management"
                         ├─ Workers Static Assets: SPA (dist/client), fallback index.html
                         └─ /api/*, /files/*  ─► Hono app (src/backend)
                                                   ├─ D1  (binding DB)      — dữ liệu
                                                   └─ R2  (binding STORAGE) — ảnh sản phẩm
```

Một Worker duy nhất phục vụ cả SPA và API trên **cùng origin**: frontend gọi API bằng URL tương đối `/api/...`, không cần CORS, cookie phiên là first-party. `assets.run_worker_first` trong `wrangler.jsonc` chỉ đưa `/api/*` và `/files/*` vào Worker; mọi đường dẫn khác do Static Assets phục vụ (miễn phí, không tính request Worker).

Frontend và backend tách **logic**: có thể host SPA ở nơi khác và đặt `VITE_API_BASE_URL` + `CORS_ALLOWED_ORIGINS` (xem DOMAIN_MIGRATION.md).

## Các lớp backend

```
routes/        HTTP: parse + validate (Zod), gọi service, trả envelope { data, meta? } / { error }
middleware/    session (cookie), CSRF, RBAC (requirePermission), parseBody/parseQuery
services/      Nghiệp vụ: receipts, issues (FEFO), transfers, stocktaking, inventory, warehouse, catalog,
               dashboard/reports, auth, users, settings, demo. Không biết đang chạy trên Cloudflare hay Node.
repositories/  Truy cập dữ liệu qua interface (IdentityRepository, WarehouseRepository, CatalogRepository,
               InventoryRepository, OperationsRepository, ReportRepository). SQL tham số hóa, luôn lọc tenant_id.
domain/        Hàm thuần: FEFO, phân loại hạn dùng, ngày nghiệp vụ VN, mã vị trí, sức chứa, lỗi nghiệp vụ.
adapters/      Hạ tầng: db/ (SqlDatabase ← D1SqlDatabase), storage/ (StorageProvider ← R2StorageProvider, NoStorageProvider)
container.ts   Composition root: chọn adapter theo DATABASE_PROVIDER / STORAGE_PROVIDER, khởi tạo services.
config.ts      Đọc biến môi trường → AppConfig (không hard-code domain).
```

Quy tắc phụ thuộc: `routes → services → repositories (interface) → adapters`. `domain/` không phụ thuộc gì. Chỉ `container.ts` và `adapters/` biết về D1/R2.

### Toàn vẹn dữ liệu khi không có transaction tương tác

D1 không hỗ trợ `BEGIN ... COMMIT` tương tác; đơn vị nguyên tử là `db.batch()`. Mỗi nghiệp vụ ghi (xác nhận nhập, xuất, điều chuyển, duyệt kiểm kê) được dựng thành **một batch duy nhất** và dựa vào ràng buộc trong DB để tự hủy cả batch khi có xung đột:

| Rủi ro | Cơ chế chặn (trong DB) |
|---|---|
| Âm kho / bán vượt | `CHECK (quantity >= 0)` trên `inventory_balances` |
| Trừ hai lần cùng một chứng từ | Trigger trạng thái (`trg_*_status`) + `UNIQUE (reference_item_id, transaction_type)` trên sổ cái |
| Bấm xác nhận xuất 2 lần / retry mạng | `UNIQUE (tenant_id, request_key)` trên `stock_issues` (idempotency key) |
| Hai người xuất cùng lúc | Kế hoạch FEFO tính lại lúc xác nhận; nếu tồn đã bị lấy, `CHECK` làm hỏng batch → `STOCK_CHANGED` |
| Lô bị cách ly/hết hạn giữa lúc xem trước và xác nhận | Statement guard `assertLotIssuable` trong cùng batch |
| Vượt sức chứa ô | Trigger `trg_balances_capacity_*` |
| Điều chuyển từ vị trí không còn hàng | Guard `assertPositionExists` |

`services/tx.ts#runAtomic` chuyển lỗi SQLite thành mã lỗi nghiệp vụ (`mapDatabaseError`).

### FEFO

`domain/fefo.ts#calculateFefoAllocation` (hàm thuần, có unit test):

1. Lấy mọi vị trí tồn (lô + ô) của sản phẩm.
2. Loại: lô `QUARANTINE`, `BLOCKED`, lô hết hạn (HSD ≤ ngày nghiệp vụ hôm nay), ô ngừng hoạt động.
3. Sắp xếp HSD tăng dần (lô không có HSD xếp cuối), hòa thì theo ngày nhập (FIFO), số lô, mã vị trí.
4. Phân bổ lần lượt đến khi đủ số lượng; trả về thiếu hụt nếu không đủ.

`POST /api/stock-issues/fefo-preview` chỉ tính toán. `POST /api/stock-issues` **tính lại FEFO trên server** rồi ghi atomic; nếu dấu vân tay (fingerprint) khác bản xem trước → `409 STOCK_CHANGED` kèm bản phân bổ mới.

### Ngày và hạn sử dụng

Ngày nghiệp vụ = ngày lịch tại `Asia/Ho_Chi_Minh` (`domain/dates.ts#businessDate`). Ngày lưu dạng `YYYY-MM-DD`, phép tính chỉ theo ngày (không lệch múi giờ). Trạng thái hạn dùng được **tính khi truy vấn**, không phụ thuộc cron:

| Số ngày còn lại (HSD − hôm nay) | Nhóm |
|---|---|
| ≤ 0 | EXPIRED — Đã hết hạn |
| 1–7 | CRITICAL |
| 8–30 | WARNING |
| 31–60 | NOTICE |
| > 60 | SAFE |

## Frontend

- `App.tsx`: router, guard đăng nhập + guard quyền, lazy-load từng trang (Recharts chỉ tải ở Tổng quan).
- `services/api.ts`: fetch wrapper, base URL cấu hình được, tự gắn `X-CSRF-Token`, chuẩn hóa lỗi `ApiError(code)`.
- `hooks/useAuth.tsx`: phiên đăng nhập, `can(permission)` (chỉ để ẩn/hiện UI — server mới là nơi kiểm soát).
- `hooks/useApi.ts`: TanStack Query helpers, toast lỗi đã dịch theo mã lỗi.
- Mọi chữ hiển thị qua `t()` (i18next), file dịch ở `src/locales`.
- Form dùng React Hook Form + **cùng Zod schema với backend** (`src/shared/schemas`).

## Đa tenant

Mọi bảng dữ liệu nghiệp vụ có `tenant_id`. `tenant_id` lấy từ phiên đăng nhập (không bao giờ từ request), và mọi query/UPDATE trong repository đều có `tenant_id = ?`. Integration test `tenant isolation` kiểm chứng điều này. Hiện có 1 tenant demo (`tenant_demo`); thêm tenant = thêm dòng `tenants` + users.
