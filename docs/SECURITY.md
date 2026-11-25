# Bảo mật

## Xác thực

- **Mật khẩu**: PBKDF2-SHA256, salt ngẫu nhiên 16 byte, định dạng `pbkdf2-sha256$<vòng>$<salt>$<hash>`. So sánh constant-time.
  - Số vòng mặc định **50.000** (`PASSWORD_HASH_ITERATIONS`) để vừa giới hạn 10 ms CPU của Workers Free (100k vòng ≈ 12 ms). Workers giới hạn PBKDF2 tối đa 100.000 vòng.
  - Đây là đánh đổi có chủ đích cho gói miễn phí; OWASP khuyến nghị cao hơn. Khi lên gói trả phí, đặt 100.000 — hash cũ được **băm lại tự động** khi người dùng đăng nhập thành công.
  - Email không tồn tại vẫn chạy một lần băm giả để thời gian phản hồi tương đương (chống dò tài khoản).
- **Phiên**: token ngẫu nhiên 256-bit trong cookie `wms_session` — `HttpOnly`, `SameSite=Lax`, `Secure` (ngoài development), `Path=/`. DB chỉ lưu `HMAC-SHA256(token, SESSION_SECRET)`, nên lộ DB không lộ phiên. Hết hạn sau 12 giờ, gia hạn trượt. Đăng xuất/đổi mật khẩu/khóa tài khoản xóa phiên phía server.
- **Giới hạn đăng nhập**: 5 lần sai trong 15 phút theo email **và** theo IP → khóa 15 phút (`429 RATE_LIMITED`). Lưu trong D1 (`login_attempts`).

## CSRF

Hai lớp cho mọi request ghi có cookie:
1. **Synchronizer token**: `X-CSRF-Token` phải khớp token gắn với phiên trên server (so sánh constant-time).
2. **Kiểm tra Origin**: nếu trình duyệt gửi `Origin`, nó phải là chính origin của API, `APP_BASE_URL` hoặc nằm trong `CORS_ALLOWED_ORIGINS`.

Thêm `SameSite=Lax` trên cookie.

## Phân quyền (RBAC)

- Quyền định nghĩa tại `src/shared/constants` (`ROLE_PERMISSIONS`). Server kiểm tra bằng `requirePermission()` trên **từng route**; frontend chỉ ẩn/hiện giao diện.
- Admin không thể tự gỡ quyền ADMIN hoặc tự khóa mình.
- Test `enforces role permissions on the server` kiểm chứng staff bị chặn ở API.

## Cô lập tenant

`tenant_id` lấy từ phiên, không bao giờ từ input. Mọi câu SQL trong repository có điều kiện `tenant_id = ?`; INSERT tham chiếu (danh mục, kho, lô) dùng `SELECT ... WHERE tenant_id = ?` để không thể trỏ sang dữ liệu tenant khác. File R2 có tiền tố `t/<tenantId>/` và `/files/*` kiểm tra tiền tố này.

## Chống SQL injection / validate input

- 100% query dùng tham số bind (`?`); không nối chuỗi giá trị người dùng. LIKE escape ký tự `%`, `_`.
- Mọi body/query được validate bằng Zod (`src/shared/schemas`, `src/backend/validators`) trước khi tới service.
- Upload ảnh: chỉ `image/jpeg|png|webp`, tối đa 2 MB, key do server sinh.
- Xuất Excel ghi mọi giá trị dữ liệu dưới dạng chuỗi/số/ngày, không bao giờ là công thức (chỉ dòng tổng do hệ thống tạo dùng `SUM`). API `?format=csv` (dành cho tích hợp) chặn formula injection bằng cách thêm `'` trước giá trị bắt đầu bằng `= + - @`.

## Toàn vẹn dữ liệu

Xem bảng trong ARCHITECTURE.md: `CHECK (quantity >= 0)`, trigger sức chứa và trạng thái, unique idempotency key, ledger unique, batch atomic. Không thể âm kho, trừ hai lần, hay xuất hàng hết hạn/cách ly kể cả khi có request đồng thời.

## Xử lý lỗi & header

- Lỗi không lường trước: log phía server, client chỉ nhận `INTERNAL_ERROR` (không lộ SQL/stack).
- `secureHeaders` của Hono: HSTS, `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy`...
- API trả `Cache-Control: no-store`.

## Audit log

Ghi: đăng nhập/đăng xuất/đăng nhập sai, đổi mật khẩu, CRUD danh mục/kho, đổi trạng thái lô, tạo/xác nhận/hủy chứng từ, duyệt kiểm kê (kèm chi tiết điều chỉnh), tạo/sửa người dùng, đổi cài đặt, reset demo. Xem tại Quản lý người dùng → Nhật ký hệ thống.

## Secrets

- Không commit secret: `.dev.vars`, `.env*` nằm trong `.gitignore`; mẫu ở `.dev.vars.example`, `.env.example`.
- Chỉ biến có tiền tố `VITE_` vào bundle frontend — không đặt secret ở đó.
- Production: `npx wrangler secret put SESSION_SECRET`. Worker từ chối chạy nếu thiếu/quá ngắn.
- Đổi `SESSION_SECRET` = vô hiệu mọi phiên đang có.

## Trước khi giao cho khách thật

- [ ] Đặt `DEMO_MODE=false` (tắt nút reset dữ liệu).
- [ ] Đổi/xóa tài khoản demo, tạo admin mới với mật khẩu mạnh.
- [ ] `SESSION_SECRET` riêng cho mỗi môi trường.
- [ ] Bật Cloudflare WAF/Rate limiting rules cho `/api/auth/login` nếu có (bổ sung cho giới hạn trong app).
- [ ] Bật D1 Time Travel / export định kỳ làm backup.
