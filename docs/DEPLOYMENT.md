# Triển khai lên Cloudflare (gói miễn phí)

Không giả định tài nguyên đã tồn tại. Làm theo thứ tự dưới đây. Mỗi bước có cách dùng CLI và Dashboard.

## 0. Chuẩn bị

- Tài khoản Cloudflare (miễn phí).
- Node.js >= 22.12, `npm install` trong thư mục dự án.
- Đăng nhập Wrangler:

```bash
npx wrangler login        # mở trình duyệt để cấp quyền
npx wrangler whoami
```

## 1. Tạo D1

**CLI**

```bash
npx wrangler d1 create wms-db
```

Copy `database_id` in ra vào `wrangler.jsonc` → `d1_databases[0].database_id` (thay giá trị `00000000-...`).

**Dashboard**: Workers & Pages → D1 SQL Database → *Create* → tên `wms-db` → copy *Database ID* vào `wrangler.jsonc`.

## 2. Tạo R2 (tùy chọn — chỉ cần cho ảnh sản phẩm)

R2 yêu cầu bật R2 trong tài khoản (Dashboard → R2 → *Purchase/Enable R2*; gói free có hạn mức miễn phí nhưng Cloudflare có thể yêu cầu thêm phương thức thanh toán).

**CLI**

```bash
npx wrangler r2 bucket create wms-files
```

**Dashboard**: R2 Object Storage → *Create bucket* → `wms-files`.

**Không dùng R2?** Xóa khối `r2_buckets` trong `wrangler.jsonc` (hoặc đặt `STORAGE_PROVIDER` = `none`). Ứng dụng vẫn chạy đầy đủ; chỉ tắt tải ảnh (API trả `STORAGE_UNAVAILABLE`).

## 3. Biến môi trường và secrets

Biến thường nằm trong `wrangler.jsonc` → `vars`:

| Biến | Ý nghĩa | Mặc định |
|---|---|---|
| `APP_ENV` | `production` / `staging` / `development` | `production` |
| `APP_BASE_URL` | URL công khai của app (dùng cho kiểm tra Origin khi khác domain). Để trống nếu cùng domain | `""` |
| `CORS_ALLOWED_ORIGINS` | Danh sách origin, cách nhau dấu phẩy, khi SPA host ở domain khác | `""` |
| `DATABASE_PROVIDER` | `d1` | `d1` |
| `STORAGE_PROVIDER` | `r2` hoặc `none` | `r2` |
| `DEFAULT_TIMEZONE` | Múi giờ nghiệp vụ | `Asia/Ho_Chi_Minh` |
| `DEMO_MODE` | `true` bật nút "Khôi phục dữ liệu demo" | `true` |
| `PASSWORD_HASH_ITERATIONS` | Số vòng PBKDF2 (xem SECURITY.md) | `50000` |

Secret bắt buộc (không bao giờ commit, không đưa vào frontend):

```bash
openssl rand -hex 32 | npx wrangler secret put SESSION_SECRET
```

Dashboard: Worker `warehouse-management` → Settings → Variables and Secrets → *Add* → Type *Secret*.

> Thiếu `SESSION_SECRET` (≥ 32 ký tự) ở môi trường không phải development thì Worker từ chối chạy — có chủ đích.

Lưu ý: secret gắn với Worker đã tồn tại. Nếu Worker chưa deploy lần nào, chạy bước 5 trước rồi đặt secret, hoặc dùng `wrangler secret put` (Wrangler sẽ hỏi tạo Worker).

## 4. Migration và dữ liệu demo

```bash
npm run db:migrate:remote      # = wrangler d1 migrations apply DB --remote
npm run db:seed:remote         # nạp dữ liệu demo (idempotent)
```

Đặt lại dữ liệu demo sau buổi demo: `npm run db:reset:remote` hoặc đăng nhập admin → Cài đặt → *Khôi phục dữ liệu demo*.

## 5. Deploy lên workers.dev

```bash
npm run deploy        # vite build (SPA + Worker) rồi wrangler deploy
```

Wrangler in ra URL dạng `https://warehouse-management.<subdomain>.workers.dev`. Lần đầu dùng Workers, Dashboard sẽ yêu cầu chọn subdomain `*.workers.dev`.

> Luôn deploy qua `npm run deploy`: lệnh `wrangler deploy` dùng cấu hình mà `vite build` sinh ra trong `dist/` (đã gồm SPA). Gọi `npx wrangler deploy` trực tiếp chỉ đúng sau khi vừa `npm run build`.

## 6. Gắn domain riêng (ví dụ `wms.company.vn`)

Yêu cầu: zone `company.vn` đã được thêm vào Cloudflare (DNS do Cloudflare quản lý).

**Dashboard**: Worker → Settings → Domains & Routes → *Add* → *Custom domain* → `wms.company.vn`. Cloudflare tự tạo DNS và chứng chỉ TLS.

**CLI / cấu hình** — thêm vào `wrangler.jsonc` rồi deploy lại:

```jsonc
"routes": [{ "pattern": "wms.company.vn", "custom_domain": true }]
```

Không cần sửa code: SPA dùng URL tương đối và cookie gắn theo host. Nếu muốn tắt URL workers.dev: `"workers_dev": false`.

## 7. Môi trường staging

`wrangler.jsonc` đã có `env.staging` (Worker `warehouse-management-staging`, D1 `wms-db-staging`, bucket `wms-files-staging`):

```bash
npx wrangler d1 create wms-db-staging            # cập nhật env.staging.d1_databases[0].database_id
npx wrangler r2 bucket create wms-files-staging
openssl rand -hex 32 | npx wrangler secret put SESSION_SECRET --env staging
npx wrangler d1 migrations apply DB --remote --env staging
npm run deploy:staging
```

## 8. Cập nhật phiên bản

```bash
git pull
npm ci
npm test && npm run lint
npm run db:migrate:remote        # nếu có migration mới — chạy TRƯỚC khi deploy code
npm run deploy
```

Rollback code: Dashboard → Worker → Deployments → chọn bản trước → *Rollback* (hoặc `npx wrangler rollback`). Migration DB không tự rollback — viết migration bù trừ nếu cần. D1 Time Travel cho phép khôi phục DB về thời điểm trong 30 ngày (`npx wrangler d1 time-travel restore wms-db --timestamp=<ISO>`).

## 9. Kiểm tra sau deploy

```bash
curl https://<host>/api/health            # {"data":{"status":"ok",...}}
```

Đăng nhập `admin@demo.vn / Demo@123`, mở Tổng quan, Sơ đồ kho, thử xuất kho SP001 × 150.

Log: `npx wrangler tail` hoặc Dashboard → Worker → Logs (observability đã bật trong `wrangler.jsonc`).
