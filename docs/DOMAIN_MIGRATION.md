# Đổi domain, hosting và hạ tầng

Nguyên tắc: **không có domain, URL server hay nhà cung cấp nào bị hard-code trong nghiệp vụ**. Mọi thứ phụ thuộc hạ tầng nằm ở `src/backend/config.ts`, `src/backend/container.ts`, `src/backend/adapters/`, `wrangler.jsonc` và biến môi trường.

| Muốn thay đổi | Sửa ở đâu | Không cần sửa |
|---|---|---|
| Domain | Cloudflare Custom Domain / DNS | Code |
| SPA ở domain khác API | `VITE_API_BASE_URL`, `CORS_ALLOWED_ORIGINS`, `APP_BASE_URL` | Services, repositories |
| Workers → VPS/Node.js | Một file entry Node + adapter DB/Storage | Routes, services, domain |
| D1 → PostgreSQL | Adapter `SqlDatabase` + chuyển SQL dialect | Services, routes, frontend |
| R2 → S3 | Adapter `StorageProvider` | Mọi thứ khác |

## 1. workers.dev → domain riêng (`wms.company.vn`)

1. Thêm Custom Domain cho Worker (DEPLOYMENT.md §6).
2. Không cần đổi biến nào khi SPA và API cùng host (mặc định).
3. Phiên đăng nhập cũ trên workers.dev không chuyển sang domain mới (cookie theo host) — người dùng đăng nhập lại.

## 2. Tách SPA và API ra hai domain

Ví dụ SPA ở `https://wms.company.vn` (Pages/Nginx/CDN), API ở `https://api.wms.company.vn`:

- Build frontend với `VITE_API_BASE_URL=https://api.wms.company.vn npm run build`.
- Trên API: `CORS_ALLOWED_ORIGINS=https://wms.company.vn`, `APP_BASE_URL=https://wms.company.vn`.
- Cookie phiên cần gửi cross-site: hai domain nên là **cùng site** (cùng `company.vn`) để `SameSite=Lax` vẫn hoạt động. Nếu khác site hoàn toàn, đổi cookie sang `SameSite=None; Secure` trong `src/backend/routes/auth.ts` (CSRF token vẫn bảo vệ).

Khuyến nghị giữ cùng origin (cấu hình mặc định) vì đơn giản và an toàn nhất.

## 3. Cloudflare Workers → VPS / Node.js

Hono chạy được trên Node (`@hono/node-server`), nên chỉ cần một entry mới:

```ts
// src/server-node.ts (ví dụ)
import { serve } from "@hono/node-server";
import { serveStatic } from "@hono/node-server/serve-static";
import { createApp } from "./backend/app";
import { buildContainer } from "./backend/container";
import { loadConfig } from "./backend/config";
import { PostgresSqlDatabase } from "./backend/adapters/db/postgres";   // tự viết, xem §4
import { S3StorageProvider } from "./backend/adapters/storage/s3";      // tự viết, xem §5

const config = loadConfig(process.env);
const container = buildContainer(config, new PostgresSqlDatabase(process.env.DATABASE_URL!), new S3StorageProvider(/* ... */));
const app = createApp(() => container);
app.use("/*", serveStatic({ root: "./dist/client" }));       // SPA
serve({ fetch: app.fetch, port: 8787 });
```

`createApp(containerFactory)` đã nhận factory nên routes/middleware/services dùng nguyên vẹn. Integration test (`tests/helpers/sqlite.ts`) đã chạy toàn bộ app trên Node với adapter SQLite khác — minh chứng tính độc lập hạ tầng.

Trên VPS cần thêm: reverse proxy HTTPS (Nginx/Caddy) truyền `X-Forwarded-For` (middleware đọc `cf-connecting-ip` rồi `x-forwarded-for`), quản lý tiến trình (systemd/PM2), backup DB.

## 4. D1 → PostgreSQL

1. Viết `PostgresSqlDatabase implements SqlDatabase` (`all`, `first`, `run`, `batch`):
   - `batch()` = `BEGIN; ...; COMMIT` trong một transaction (Postgres có transaction thật, mạnh hơn D1).
   - Chuyển placeholder `?` → `$1, $2...` trong adapter.
2. Đăng ký trong `container.ts#createDatabase` với `DATABASE_PROVIDER=postgres`.
3. Chuyển schema (`database/migrations/0001_init.sql`):
   - `strftime('%Y-%m-%dT%H:%M:%fZ','now')` → `to_char(now() at time zone 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')` (hoặc dùng `timestamptz`).
   - Trigger SQLite (`RAISE(ABORT, ...)`) → function PL/pgSQL `RAISE EXCEPTION 'BIN_CAPACITY_EXCEEDED'` (giữ nguyên chuỗi mã lỗi để `mapDatabaseError` tiếp tục hoạt động).
   - `INSERT OR IGNORE` → `INSERT ... ON CONFLICT DO NOTHING`; `GROUP_CONCAT` → `string_agg`; `lower(hex(randomblob(16)))` → `gen_random_uuid()::text`; `COLLATE NOCASE` → `citext` hoặc `lower()`.
   - Alias camelCase trong SELECT cần đặt trong ngoặc kép (`AS "productId"`), hoặc adapter tự map snake → camel.
4. Chuyển dữ liệu: `npx wrangler d1 export wms-db --remote --output dump.sql`, chuyển đổi rồi nạp vào Postgres.

Business logic (FEFO, trạng thái chứng từ, phân quyền) nằm trong `domain/` và `services/`, không đổi.

## 5. R2 → S3-compatible (AWS S3, MinIO, Wasabi...)

Viết `S3StorageProvider implements StorageProvider` (`put/get/delete`) bằng `aws4fetch` hoặc AWS SDK, đăng ký trong `container.ts#createStorage` với `STORAGE_PROVIDER=s3`. Key ảnh có tiền tố tenant (`t/<tenantId>/products/<productId>/<uuid>.<ext>`) giữ nguyên; copy dữ liệu bằng `rclone`. URL ảnh trong API là tương đối (`/files/<key>`), không phụ thuộc nhà cung cấp.

## 6. Checklist chuyển đổi

- [ ] Biến môi trường mới đã đặt (`APP_ENV`, `SESSION_SECRET`, `CORS_ALLOWED_ORIGINS`...)
- [ ] `npm test` chạy xanh với adapter mới
- [ ] Migration/schema đã áp dụng ở hạ tầng mới, dữ liệu đã copy
- [ ] HTTPS bật (cookie `Secure` được đặt khi `APP_ENV` khác `development`)
- [ ] `/api/health` trả `ok`, đăng nhập và xuất kho FEFO thử thành công
