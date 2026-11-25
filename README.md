# WMS Pro — Hệ thống quản lý kho

Hệ thống quản lý kho (Warehouse Management System) quản lý tồn kho theo **Sản phẩm + Lô + Vị trí**, xuất kho tự động theo **FEFO** (hết hạn trước – xuất trước), sơ đồ kho 2D, cảnh báo hạn sử dụng, kiểm kê và báo cáo.

Chạy hoàn toàn trên **Cloudflare free tier**: Workers + Workers Static Assets + D1 + R2. Kiến trúc tách lớp để có thể chuyển sang VPS/Node.js, PostgreSQL, S3 mà không viết lại nghiệp vụ.

- Giao diện: tiếng Việt (mặc định), đã chuẩn bị tiếng Anh (i18next).
- Mã nguồn, API, database: tiếng Anh.

## Công nghệ

| Lớp | Công nghệ |
|---|---|
| Frontend | React 19, TypeScript, Vite, Tailwind CSS v4, shadcn/ui-style components (Radix), Lucide, Recharts, React Router, TanStack Query, React Hook Form, Zod, i18next |
| Backend | Cloudflare Workers, Hono, REST, Zod |
| Database | Cloudflare D1 (SQLite) |
| File | Cloudflare R2 (ảnh sản phẩm) |
| Test | Vitest (unit + integration chạy migration thật trên SQLite) |

## Chạy local

Yêu cầu Node.js >= 22.12.

```bash
npm install
cp .dev.vars.example .dev.vars        # secrets local (đã có sẵn nếu clone từ máy này)
npm run setup                         # = db:migrate:local + db:seed:local
npm run dev                           # http://localhost:5173 (SPA + API + D1/R2 local)
```

`npm run dev` chạy Vite cùng Cloudflare Worker thật (workerd) qua `@cloudflare/vite-plugin`, nên frontend, API, D1 và R2 local hoạt động giống production.

### Tài khoản demo

Mật khẩu chung: **`Demo@123`**

| Email | Vai trò |
|---|---|
| admin@demo.vn | Quản trị viên (ADMIN) |
| manager@demo.vn | Quản lý kho (WAREHOUSE_MANAGER) |
| staff@demo.vn | Nhân viên kho (WAREHOUSE_STAFF) |

## Lệnh

```bash
npm run dev               # dev server
npm run build             # typecheck + build SPA và Worker vào dist/
npm run typecheck         # tsc -b (frontend, worker, scripts/tests)
npm run lint              # ESLint
npm test                  # Vitest: unit + integration
npm run preview           # build rồi chạy bản build trên workerd local
npm run deploy            # build + wrangler deploy (production)
npm run deploy:staging    # build + deploy môi trường staging

npm run db:migrate:local  # áp dụng migration vào D1 local
npm run db:seed:local     # nạp dữ liệu demo (chạy lại nhiều lần không trùng)
npm run db:reset:local    # xóa dữ liệu demo và nạp lại theo ngày hôm nay
npm run db:migrate:remote / db:seed:remote / db:reset:remote   # tương tự cho D1 trên Cloudflare
npm run cf-typegen        # sinh lại worker-configuration.d.ts sau khi sửa wrangler.jsonc
```

## Cấu trúc thư mục

```
src/
  frontend/        SPA React: components/ (ui/, layout), pages/, layouts/, hooks/, services/, utils/
  backend/         Worker: routes/, middleware/, services/, repositories/, validators/, domain/, adapters/, seed/
  shared/          Dùng chung FE/BE: schemas/ (Zod), types/ (API DTO), constants/ (roles, permissions, statuses)
  locales/         vi/translation.json, en/translation.json
database/
  migrations/      Migration D1 (SQL)
  seeds/           File seed được sinh ra (seed.generated.sql, không commit)
scripts/           generate-seed.ts
tests/             unit/, integration/, helpers/ (adapter SQLite cho test)
docs/              Tài liệu chi tiết
```

## Tài liệu

- [Kiến trúc](docs/ARCHITECTURE.md)
- [Cơ sở dữ liệu](docs/DATABASE.md)
- [API](docs/API.md) — OpenAPI trực tiếp tại `/api/docs` và `/api/openapi.json`
- [Triển khai Cloudflare](docs/DEPLOYMENT.md)
- [Đổi domain / hosting / database](docs/DOMAIN_MIGRATION.md)
- [Giới hạn gói miễn phí](docs/FREE_TIER_LIMITS.md)
- [Bảo mật](docs/SECURITY.md)
- [Hướng dẫn sử dụng](docs/USER_GUIDE.md)
