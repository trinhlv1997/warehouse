# Giới hạn gói miễn phí Cloudflare

> Số liệu dưới đây theo tài liệu Cloudflare tại thời điểm viết. Cloudflare có thể thay đổi — luôn kiểm tra trang pricing/limits chính thức trước khi cam kết với khách hàng:
> developers.cloudflare.com/workers/platform/limits · /d1/platform/pricing · /r2/pricing

## Hạn mức chính

| Dịch vụ | Free | Ảnh hưởng tới WMS |
|---|---|---|
| Workers — request | 100.000 request/ngày (reset 00:00 UTC = 07:00 giờ VN) | Chỉ tính `/api/*` và `/files/*`; file tĩnh của SPA **không** tính |
| Workers — CPU | 10 ms CPU/request | Đăng nhập (PBKDF2 50k vòng ≈ 6 ms) là request nặng nhất; còn lại chủ yếu chờ I/O D1 (không tính CPU) |
| Workers — kích thước | 3 MB (gzip) | Worker hiện ~104 KB gzip |
| Static Assets | Miễn phí, không giới hạn request | SPA |
| D1 — đọc | 5 triệu row đọc/ngày | Mỗi lần mở Tổng quan quét ~vài nghìn–vài chục nghìn row (dữ liệu demo) |
| D1 — ghi | 100.000 row ghi/ngày | Mỗi phiếu nhập/xuất ghi ~5–20 row; reset demo ghi ~1.300 row |
| D1 — dung lượng | 500 MB/database, 5 GB/tài khoản | Dữ liệu demo < 1 MB |
| R2 | 10 GB lưu trữ, 1 triệu thao tác ghi (Class A), 10 triệu thao tác đọc (Class B)/tháng, egress miễn phí | Ảnh sản phẩm ≤ 2 MB/ảnh |

Ước tính cho demo/khách hàng nhỏ (5–10 người dùng, vài trăm thao tác/ngày): dùng < 5% mọi hạn mức.

## Khi vượt hạn mức

| Vượt | Hậu quả |
|---|---|
| 100k request Workers/ngày | API trả lỗi (Cloudflare error 1027) đến khi reset hằng ngày. SPA vẫn tải nhưng không gọi được API |
| 10 ms CPU | Request đó bị hủy (error 1102). Cloudflare cho phép vượt nhẹ thỉnh thoảng nhưng không đảm bảo |
| D1 đọc/ghi/ngày | Query trả lỗi đến khi reset 00:00 UTC; app hiển thị "Đã xảy ra lỗi hệ thống" |
| D1 dung lượng | Ghi bị từ chối, đọc vẫn được |
| R2 | R2 tính phí phần vượt (theo phương thức thanh toán đã đăng ký); không tự chặn |

Hệ thống **không tự nâng cấp lên gói trả phí**. Workers và D1 trên gói Free chỉ dừng phục vụ khi hết hạn mức chứ không phát sinh phí.

## Theo dõi sử dụng

- Dashboard → Workers & Pages → `warehouse-management` → *Metrics*: request, lỗi, CPU time.
- Dashboard → D1 → `wms-db` → *Metrics*: rows read/written, dung lượng.
- Dashboard → R2 → *Metrics*.
- Log thời gian thực: `npx wrangler tail`.
- Dashboard → Notifications: tạo cảnh báo usage (nếu tài khoản hỗ trợ).
- CLI: `npx wrangler d1 info wms-db`.

## Thiết kế để tiết kiệm hạn mức

- SPA phục vụ từ Static Assets (không tốn request Worker).
- Không dùng cron: trạng thái hạn dùng tính lúc truy vấn.
- Phiên làm mới tối đa 5 phút/lần (giảm ghi D1); dọn phiên hết hạn ngẫu nhiên thay vì job định kỳ.
- TanStack Query cache 15 giây phía client, không refetch khi đổi tab.
- Ảnh phục vụ với `Cache-Control: immutable` (mỗi lần upload là key mới).
- Số vòng PBKDF2 cấu hình được để vừa 10 ms CPU.

## Nâng cấp sau này

1. **Workers Paid** (khoảng 5 USD/tháng): 10 triệu request/tháng, CPU tới 30 s/request, D1 25 tỷ row đọc / 50 triệu row ghi mỗi tháng (tham khảo trang pricing). Dashboard → Workers & Pages → *Plans*. Không cần đổi code.
2. Sau khi nâng cấp: tăng `PASSWORD_HASH_ITERATIONS` lên `100000` trong `wrangler.jsonc` rồi deploy — mật khẩu được băm lại tự động khi người dùng đăng nhập.
3. Khách hàng lớn hoặc yêu cầu đặt dữ liệu tại Việt Nam: chuyển sang VPS + PostgreSQL theo [DOMAIN_MIGRATION.md](DOMAIN_MIGRATION.md).
