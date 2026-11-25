# API

REST/JSON, mọi endpoint dưới `/api`. Tài liệu OpenAPI 3.1 sinh từ cùng Zod schema mà server dùng để validate:

- Swagger UI: `GET /api/docs`
- JSON: `GET /api/openapi.json`
- Danh sách endpoint (nguồn duy nhất): `src/backend/openapi.ts`

## Quy ước

**Thành công**

```json
{ "data": { ... } }
{ "data": [ ... ], "meta": { "page": 1, "pageSize": 20, "total": 132, "totalPages": 7 } }
```

**Lỗi** — `code` ổn định, frontend dịch theo `errors.<code>`:

```json
{ "error": { "code": "INSUFFICIENT_STOCK", "message": "Not enough eligible stock", "details": { ... } } }
```

| HTTP | Mã lỗi |
|---|---|
| 400 | `VALIDATION_ERROR` (`details` = danh sách `{ field, message, code }`) |
| 401 | `UNAUTHORIZED`, `INVALID_CREDENTIALS` |
| 403 | `FORBIDDEN`, `CSRF_INVALID`, `ACCOUNT_DISABLED`, `DEMO_DISABLED` |
| 404 | `NOT_FOUND` |
| 409 | `DUPLICATE`, `STOCK_CHANGED`, `INVALID_STATUS_TRANSITION`, `IN_USE`, `CONFLICT` |
| 422 | `INSUFFICIENT_STOCK`, `BIN_CAPACITY_EXCEEDED`, `BIN_INACTIVE`, `LOT_MISMATCH` |
| 429 | `RATE_LIMITED` |
| 500 | `INTERNAL_ERROR` (không lộ chi tiết nội bộ) |

**Phân trang / tìm kiếm**: `?page=1&pageSize=20&search=...` (+ bộ lọc riêng từng endpoint). `pageSize` tối đa 200.

**Xác thực**: cookie `wms_session` (HttpOnly, SameSite=Lax, Secure trên HTTPS). Mọi request ghi (POST/PUT/PATCH/DELETE) phải gửi header `X-CSRF-Token` lấy từ `POST /api/auth/login` hoặc `GET /api/auth/me`.

## Endpoint chính

| Nhóm | Endpoint |
|---|---|
| Auth | `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`, `POST /api/auth/change-password` |
| Tổng quan | `GET /api/dashboard` |
| Kho | `GET /api/warehouses`, `GET /api/warehouse-map`, `GET/POST/PUT/DELETE /api/zones`, `GET/POST/PUT/DELETE /api/racks`, `GET /api/racks/{id}/layout`, `GET /api/bins`, `GET /api/bins/options`, `GET/PUT /api/bins/{id}` |
| Danh mục | `/api/categories`, `/api/suppliers`, `/api/products`, `/api/products/options`, `/api/products/{id}/locations`, `/api/products/{id}/history`, `POST /api/products/{id}/archive|restore|image` |
| Tồn kho | `GET /api/inventory`, `GET /api/inventory/lots`, `PATCH /api/inventory/lots/{id}/status`, `GET /api/inventory/locations?search=`, `GET /api/inventory/transactions` |
| Cảnh báo | `GET /api/alerts/expired`, `/api/alerts/expiring` (`expiryStatus=CRITICAL|WARNING|NOTICE`), `/api/alerts/slow-moving` |
| Nhập kho | `GET/POST /api/stock-receipts`, `GET/PUT /api/stock-receipts/{id}`, `POST .../{id}/confirm`, `POST .../{id}/cancel` |
| Xuất kho | `POST /api/stock-issues/fefo-preview`, `POST /api/stock-issues`, `GET /api/stock-issues[/{id}]` |
| Điều chuyển | `GET/POST /api/stock-transfers`, `POST .../{id}/confirm`, `POST .../{id}/cancel` |
| Kiểm kê | `GET/POST /api/stocktaking`, `PUT .../{id}/counts`, `POST .../{id}/submit|reopen|approve|cancel` |
| Báo cáo | `GET /api/reports/{type}` (`inventory, product, lot, location, receipts, issues, expiring, expired, transfers, stocktaking`) trả JSON; giao diện tạo file Excel từ JSON này. `?format=csv` vẫn có cho tích hợp hệ thống khác |
| Quản trị | `/api/users`, `/api/audit-logs`, `GET/PUT /api/settings`, `POST /api/demo/reset` |
| Khác | `GET /api/health`, `GET /files/{key}` (ảnh, kiểm tra tenant) |

## Ví dụ: xuất kho FEFO

```http
POST /api/stock-issues/fefo-preview
X-CSRF-Token: <token>
{ "lines": [{ "productId": "prd_SP001", "quantity": 150 }] }
```

```json
{ "data": { "fulfillable": true, "fingerprint": "prd_SP001:bal_...=100/100,bal_...=50/100", "lines": [{
  "productSku": "SP001", "requestedQuantity": 150, "allocatedQuantity": 150, "shortageQuantity": 0,
  "excluded": { "expired": 0, "quarantine": 0, "blocked": 0 },
  "allocations": [
    { "lotNumber": "LOT001", "locationCode": "WH001-A-A01-L01-B03", "expirationDate": "2026-12-01", "allocatedQuantity": 100 },
    { "lotNumber": "LOT002", "locationCode": "WH001-A-A02-L01-B01", "expirationDate": "2026-12-15", "allocatedQuantity": 50 }
  ] }] } }
```

```http
POST /api/stock-issues
{ "requestKey": "c0a8…uuid", "issueDate": "2026-11-24", "reason": "SALE", "recipient": "Siêu thị A",
  "lines": [{ "productId": "prd_SP001", "quantity": 150 }], "previewFingerprint": "<từ preview>" }
```

- Gửi lại cùng `requestKey` → trả về đúng phiếu cũ, không trừ kho lần hai.
- Tồn kho đổi sau khi xem trước → `409 STOCK_CHANGED`, `details.preview` là phân bổ mới.

## Phân quyền

| Quyền | ADMIN | MANAGER | STAFF |
|---|:-:|:-:|:-:|
| dashboard.view, warehouse.view, product.view, inventory.view | ✓ | ✓ | ✓ |
| receipt.create, receipt.confirm, issue.create, stocktaking.count | ✓ | ✓ | ✓ |
| warehouse.manage, product.manage, lot.manage | ✓ | ✓ | |
| transfer.create, transfer.confirm, stocktaking.approve | ✓ | ✓ | |
| report.view, audit.view | ✓ | ✓ | |
| user.manage, settings.manage | ✓ | | |

Nguồn: `src/shared/constants/index.ts` (`ROLE_PERMISSIONS`). Kiểm tra quyền thực hiện trên server bằng `requirePermission()` ở từng route.
