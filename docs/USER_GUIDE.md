# Hướng dẫn sử dụng

## Đăng nhập

Mở địa chỉ hệ thống, nhập email và mật khẩu. Bản demo có nút **Dùng** để điền nhanh tài khoản (mật khẩu chung `Demo@123`):

- **admin@demo.vn** — Quản trị viên: toàn quyền, quản lý người dùng, cài đặt.
- **manager@demo.vn** — Quản lý kho: hàng hóa, kho, duyệt điều chuyển và kiểm kê, báo cáo.
- **staff@demo.vn** — Nhân viên kho: xem tồn, nhập kho, xuất kho, kiểm đếm.

Menu chỉ hiển thị các chức năng mà vai trò của bạn được phép dùng. Góc phải trên cùng: đổi ngôn ngữ, đổi mật khẩu, đăng xuất.

## Tổng quan

Các chỉ số tồn kho, tỷ lệ sử dụng kho, hàng sắp hết hạn / đã hết hạn, sản phẩm dưới định mức; biểu đồ nhập–xuất 30 ngày, tồn theo loại hàng và khu vực, tình trạng hạn dùng. Nhấn vào thẻ chỉ số để đi tới danh sách chi tiết.

## Quản lý kho

- **Sơ đồ kho**: nhấn khu vực → danh sách kệ → nhấn kệ → các tầng và ô (màu theo mức lấp đầy: xanh = còn trống, vàng = gần đầy, đỏ = đầy, xám = ngừng dùng) → nhấn ô để xem lô hàng, HSD, số lượng. Ô tìm kiếm phía trên tìm theo SKU, tên hàng, số lô hoặc mã vị trí và làm nổi bật vị trí trên sơ đồ.
- **Khu vực kho**: thêm/sửa khu vực, loại khu vực và vị trí trên sơ đồ.
- **Quản lý kệ**: thêm kệ mới — chỉ cần nhập số tầng, số ô mỗi tầng, sức chứa; hệ thống tự tạo mã vị trí `WH001-A-A05-L01-B01`. Kệ đã có hàng/lịch sử thì chỉ ngừng hoạt động, không xóa được.
- **Vị trí lưu trữ**: lọc ô theo khu vực, kệ, mức lấp đầy; sửa sức chứa (không thấp hơn lượng đang chứa) hoặc ngừng sử dụng ô.

## Hàng hóa

- **Danh mục sản phẩm**: thêm/sửa SKU, mã vạch, loại hàng, đơn vị, tồn tối thiểu/tối đa. Trang chi tiết có ảnh sản phẩm, các vị trí đang chứa hàng và lịch sử nhập/xuất. Sản phẩm hết tồn có thể **Lưu trữ** (ẩn khỏi danh sách chọn).
- **Loại hàng hóa**, **Nhà cung cấp**: danh mục dùng khi nhập kho.
- **Quản lý lô hàng**: số lô, NSX, HSD, % hạn dùng còn lại, vị trí. Quản lý kho có thể chuyển lô sang **Cách ly** (chờ QC) hoặc **Khóa** — hàng này sẽ không được xuất.
- **Tồn kho**: tồn chi tiết theo Sản phẩm + Lô + Vị trí, và tab Lịch sử giao dịch.

## Nghiệp vụ kho

### Nhập kho
1. *Tạo phiếu nhập* → chọn nhà cung cấp, ngày nhập.
2. Mỗi dòng: sản phẩm, số lô, NSX, HSD, vị trí cất hàng, số lượng. Lô đã tồn tại thì phải trùng HSD.
3. *Lưu nháp* → kiểm tra → *Xác nhận nhập kho*. Tồn kho, lô, lịch sử được cập nhật cùng lúc. Nếu vượt sức chứa ô, hệ thống từ chối và không thay đổi gì.

### Xuất kho (FEFO)
1. *Tạo phiếu xuất* → nhập người nhận, lý do, các sản phẩm và số lượng.
2. *Tính phân bổ FEFO*: hệ thống chọn lô hết hạn sớm nhất trước, bỏ qua hàng hết hạn/cách ly/khóa, hiển thị **chính xác lô và vị trí lấy hàng**.
3. *Xác nhận xuất kho*. Nếu trong lúc đó tồn kho thay đổi, hệ thống báo và hiển thị phân bổ mới để xác nhận lại. Bấm nhiều lần không bị trừ kho hai lần.
4. Mở phiếu xuất → **Xuất phiếu PDF** để tải file `PhieuXuatKho_<số phiếu>.pdf` (khổ A4): thông tin doanh nghiệp và kho, người nhận, lý do, bảng lấy hàng theo FEFO (mã hàng, số lô, HSD, vị trí lấy hàng, ĐVT, số lượng), dòng tổng cộng và 4 ô ký (Người lập phiếu, Người nhận hàng, Thủ kho, Giám đốc). Phiếu đã hủy có dấu chìm "ĐÃ HỦY". File được tạo ngay trên trình duyệt, không cần kết nối thêm tới máy chủ.

### Điều chuyển (Quản lý kho)
Chọn hàng tại vị trí nguồn → chọn vị trí đích → số lượng → *Lưu nháp* → *Xác nhận điều chuyển*. Lô và HSD được giữ nguyên.

### Kiểm kê
1. *Tạo phiên kiểm kê* theo toàn kho, khu vực hoặc kệ — hệ thống chụp lại số lượng hệ thống.
2. Nhập số lượng thực tế, *Lưu số đếm* (có thể làm nhiều lần), *Gửi duyệt*.
3. Quản lý kho xem chênh lệch, *Duyệt & điều chỉnh tồn* (hoặc trả lại kiểm đếm). Điều chỉnh được ghi vào lịch sử.

## Cảnh báo

- **Hàng sắp hết hạn**: còn ≤ 60 ngày, lọc theo nhóm 1–7 / 8–30 / 31–60 ngày, khu vực, kệ, khoảng HSD.
- **Hàng đã hết hạn**: cần xử lý (tiêu hủy, trả NCC — dùng phiếu xuất lý do tương ứng sau khi đổi trạng thái lô nếu cần).
- **Hàng tồn lâu ngày**: lô nhập lâu và không xuất trong N ngày (cấu hình trong Cài đặt).

Hạn dùng được tính theo ngày giờ Việt Nam tại thời điểm xem; hàng có HSD là hôm nay được coi là đã hết hạn.

## Báo cáo

Chọn loại báo cáo (tồn kho, theo sản phẩm/lô/vị trí, nhập, xuất, sắp hết hạn, hết hạn, điều chuyển, kiểm kê), lọc theo ngày hoặc khu vực, bấm **Xuất Excel** để tải file `.xlsx` đã định dạng sẵn: tên doanh nghiệp, tên báo cáo, kỳ báo cáo / khu vực, người xuất; dòng tiêu đề cố định khi cuộn và có bộ lọc ở mỗi cột; ngày dạng dd/mm/yyyy và số có phân cách hàng nghìn (tính toán được trong Excel); tình trạng hạn dùng và trạng thái lô tô màu; dòng **TỔNG CỘNG** dùng công thức SUM (tự cập nhật khi lọc/sửa); sẵn sàng in khổ ngang vừa một trang chiều rộng. File được tạo ngay trên trình duyệt.

## Quản trị (Admin)

- **Quản lý người dùng**: thêm tài khoản, gán vai trò, khóa tài khoản, đặt lại mật khẩu; tab **Nhật ký hệ thống** xem ai làm gì, khi nào.
- **Cài đặt**: tên doanh nghiệp, **mã kho** (tiền tố mọi mã vị trí, hiện ở tiêu đề Sơ đồ kho; đổi mã sẽ cập nhật toàn bộ mã vị trí sau khi xác nhận), tên và địa chỉ kho, ngưỡng cảnh báo; **Khôi phục dữ liệu demo** để đưa hệ thống về dữ liệu mẫu sau buổi demo.
