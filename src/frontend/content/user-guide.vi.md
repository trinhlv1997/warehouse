Hệ thống quản lý kho theo lô, hạn sử dụng và vị trí · Cập nhật 25/11/2026

## 1. Giới thiệu và khái niệm

WMS Pro quản lý hàng trong kho theo ba thông tin gắn liền nhau: **sản phẩm + lô + vị trí**. Nhờ vậy hệ thống luôn biết từng lô hàng nằm ở ô nào, còn bao nhiêu và còn hạn bao lâu.

Tài liệu này dành cho nhân viên kho, quản lý kho và quản trị viên. Các ví dụ dùng dữ liệu mẫu của một nhà máy nhựa kỹ thuật sản xuất linh kiện điện.

### Cấu trúc kho

Mỗi kho chia thành 5 cấp, từ lớn đến nhỏ: **Kho → Khu vực → Kệ → Tầng → Ô**. Ô là nơi hàng thực sự nằm, và mỗi ô có một **mã vị trí** duy nhất ghép từ 5 cấp đó.

| Phần của mã | Ý nghĩa | Ví dụ |
| --- | --- | --- |
| WH001 | Mã kho | Kho nhựa kỹ thuật Mỹ Phước |
| A | Khu vực | Khu A - Hạt nhựa nguyên sinh |
| A01 | Kệ | Kệ số 01 của khu A |
| L02 | Tầng | Tầng 2 của kệ (đếm từ dưới lên) |
| B03 | Ô | Ô số 3 trên tầng đó |

Ví dụ: mã **WH001-A-A01-L02-B03** là ô số 3, tầng 2, kệ A01, khu A của kho WH001.

### Các khái niệm chính

- **Sức chứa ô**: số đơn vị hàng tối đa một ô chứa được (bao, thùng, bộ...). Hệ thống không cho nhập hoặc chuyển hàng vượt sức chứa.
- **Lô hàng**: một đợt hàng cùng sản phẩm, có chung số lô, ngày sản xuất (NSX) và hạn sử dụng (HSD). Một lô có thể nằm ở nhiều ô; một ô có thể chứa nhiều lô.
- **Hạn sử dụng (HSD)**: tính theo ngày giờ Việt Nam. Hàng có HSD là hôm nay được coi là **đã hết hạn** và không được xuất.
- **FEFO** (First Expired – First Out): hết hạn trước thì xuất trước. Khi xuất kho, hệ thống tự chọn lô có HSD sớm nhất.
- **Trạng thái lô**:
  - **Khả dụng**: được phép xuất.
  - **Cách ly**: đang chờ kiểm tra chất lượng (QC), không được xuất.
  - **Khóa**: hàng lỗi hoặc chờ xử lý, không được xuất.
- **Phiếu (chứng từ)**: mọi biến động tồn kho đều đi qua phiếu nhập, phiếu xuất, phiếu điều chuyển hoặc phiên kiểm kê. Mỗi biến động được ghi vào lịch sử giao dịch, không sửa hay xóa được.

## 2. Bắt đầu sử dụng

### Đăng nhập

1. Mở địa chỉ hệ thống do quản trị viên cung cấp bằng Chrome, Edge, Safari hoặc Firefox bản mới. Dùng được trên máy tính, máy tính bảng và điện thoại.
2. Nhập **Email** và **Mật khẩu**, bấm **Đăng nhập**.
3. Nhập sai 5 lần trong 15 phút thì tài khoản bị tạm khóa 15 phút. Chờ hết thời gian rồi thử lại, hoặc nhờ quản trị viên đặt lại mật khẩu.
4. Phiên đăng nhập tự hết hạn sau 12 giờ không sử dụng.

Bản demo có sẵn 3 tài khoản, mật khẩu chung **Demo@123**. Ở trang đăng nhập, bấm **Dùng** bên cạnh tài khoản để điền nhanh.

| Email | Vai trò | Người dùng mẫu |
| --- | --- | --- |
| admin@demo.vn | Quản trị viên | Nguyễn Văn An |
| manager@demo.vn | Quản lý kho | Trần Thị Bình |
| staff@demo.vn | Nhân viên kho | Lê Văn Cường |

### Vai trò và quyền hạn

Menu chỉ hiện các chức năng mà vai trò của bạn được dùng. Bảng quyền đầy đủ nằm ở Phụ lục.

- **Nhân viên kho**: xem kho và tồn kho, tạo và xác nhận phiếu nhập, xuất kho, nhập số đếm kiểm kê.
- **Quản lý kho**: mọi quyền của nhân viên, cộng thêm quản lý khu/kệ/ô, sản phẩm, trạng thái lô, điều chuyển, duyệt kiểm kê, xem báo cáo và nhật ký.
- **Quản trị viên**: toàn quyền, thêm quản lý người dùng và cài đặt hệ thống.

### Bố cục màn hình

- **Thanh menu bên trái** (nền xanh đậm): các nhóm Tổng quan, Quản lý kho, Hàng hóa, Nghiệp vụ kho, Cảnh báo, Báo cáo, Quản lý người dùng, Cài đặt. Trên điện thoại, bấm biểu tượng ☰ ở góc trên bên trái để mở menu.
- **Thanh trên cùng**: tên doanh nghiệp (kèm nhãn DEMO nếu đang dùng dữ liệu mẫu) và tài khoản của bạn.
- **Bấm vào tên tài khoản** để: đổi ngôn ngữ Việt/Anh, **Đổi mật khẩu** (mật khẩu mới tối thiểu 8 ký tự, sau đó phải đăng nhập lại), hoặc **Đăng xuất**.

### Thao tác chung trên các danh sách

- **Ô tìm kiếm**: gõ SKU, tên, số lô, mã vị trí hoặc số phiếu. Kết quả tự lọc sau khi ngừng gõ.
- **Các ô lọc** (khu vực, trạng thái, từ ngày – đến ngày...): chọn "Tất cả" để bỏ lọc.
- **Phân trang** ở cuối bảng: tổng số bản ghi và nút chuyển trang.
- **Ô chọn sản phẩm / vị trí**: bấm vào ô, gõ để tìm, dùng chuột hoặc phím ↑ ↓ và Enter để chọn, Esc để đóng. Ô vị trí đã đầy hiện mờ và không chọn được.
- **Ngày tháng** hiển thị dạng dd/mm/yyyy, giờ theo múi giờ Việt Nam; số có dấu chấm phân cách hàng nghìn (1.500).
- **Thông báo** hiện ở góc phải trên: màu xanh là thành công, màu đỏ là lỗi (xem cách xử lý ở mục Câu hỏi thường gặp).

## 3. Tổng quan

Màn hình **Tổng quan** cho biết tình trạng kho trong một lần nhìn. Số liệu tính theo ngày làm việc hiện tại (giờ Việt Nam), ghi ngay dưới tiêu đề.

### Các thẻ chỉ số

Bấm vào mỗi thẻ để mở danh sách chi tiết tương ứng.

| Thẻ | Ý nghĩa | Bấm vào sẽ mở |
| --- | --- | --- |
| Tổng số lượng tồn kho | Tổng số đơn vị hàng đang có trong kho | Tồn kho |
| Tổng số SKU | Số sản phẩm đang quản lý (trừ sản phẩm đã lưu trữ) | Danh mục sản phẩm |
| Tổng số loại hàng | Số nhóm hàng | Loại hàng hóa |
| Tổng số lô hàng | Số lô còn hàng | Quản lý lô hàng |
| Tổng số vị trí lưu trữ | Số ô đang hoạt động | Vị trí lưu trữ |
| Tỷ lệ sử dụng kho | Lượng hàng / tổng sức chứa các ô đang hoạt động | Sơ đồ kho |
| Hàng sắp hết hạn | Số lượng và số lô còn hạn 1–30 ngày | Hàng sắp hết hạn |
| Hàng đã hết hạn | Số lượng và số lô đã quá hạn mà vẫn còn trong kho | Hàng đã hết hạn |
| SP dưới mức tồn tối thiểu | Số sản phẩm có tồn thấp hơn định mức | Danh mục sản phẩm, lọc hàng dưới định mức |

### Biểu đồ

- **Nhập kho và xuất kho 30 ngày gần nhất**: đường xanh là nhập, đường cam là xuất. Rê chuột lên từng ngày để xem số liệu.
- **Tình trạng hạn sử dụng**: tỷ lệ hàng đã hết hạn, sắp hết hạn theo từng nhóm, còn hạn an toàn và không có HSD.
- **Tồn kho theo loại hàng** và **Tồn kho theo khu vực** (so với sức chứa của khu).
- **Tỷ lệ sử dụng vị trí kho**: số ô còn trống, gần đầy, đầy và ngừng sử dụng.

### Các danh sách nhanh

- **Cảnh báo hạn sử dụng (≤7 ngày)**: các vị trí có hàng đã hết hạn hoặc sắp hết hạn trong 7 ngày, kèm số lô và mã vị trí để đi lấy ngay.
- **Sản phẩm dưới mức tồn tối thiểu**: thanh tiến độ cho biết còn bao nhiêu phần trăm so với định mức. Đây là danh sách cần đặt mua hoặc lên kế hoạch sản xuất.
- **Giao dịch kho gần đây**: 8 biến động mới nhất; số dương (xanh) là tăng, số âm (cam) là giảm.

## 4. Quản lý kho

### Sơ đồ kho

Sơ đồ kho cho biết hàng đang nằm ở đâu và chỗ nào còn trống. Tiêu đề sơ đồ hiện mã kho và tên kho, ví dụ "WH001 · Kho nhựa kỹ thuật Mỹ Phước".

1. Mở **Quản lý kho → Sơ đồ kho**. Các khu vực hiện thành các ô chữ nhật theo bố trí thực tế, kèm tỷ lệ sử dụng và các cột nhỏ thể hiện mức đầy của từng kệ.
2. **Bấm vào một khu vực**: khung bên phải hiện danh sách kệ của khu đó.
3. **Bấm vào một kệ**: hiện các tầng (tầng cao nhất ở trên cùng) và các ô trên từng tầng, mỗi ô ghi "đã dùng / sức chứa". Bấm ← để quay lại danh sách kệ.
4. **Bấm vào một ô**: hộp chi tiết hiện khu, kệ, tầng, mức sử dụng và danh sách hàng trong ô (sản phẩm, số lô, HSD, trạng thái, số lượng).

**Tìm hàng trên sơ đồ**: gõ SKU, tên hàng, số lô hoặc mã vị trí vào ô tìm kiếm phía trên (tối thiểu 2 ký tự). Khu, kệ và ô có hàng phù hợp sẽ nhấp nháy viền xanh; bấm vào từng kết quả để đi thẳng tới ô đó.

| Màu | Ý nghĩa |
| --- | --- |
| Xanh lá | Còn trống (dưới ngưỡng gần đầy, mặc định 80%) |
| Vàng | Gần đầy (từ 80% đến dưới 100%) |
| Đỏ | Đầy (100%) |
| Xám | Ngừng sử dụng |

### Khu vực kho

Khu vực là vùng lưu trữ theo loại hàng, ví dụ khu hạt nhựa, khu hóa chất, kho khuôn. Chỉ Quản lý kho và Quản trị viên được thêm hoặc sửa.

1. Mở **Khu vực kho → Thêm khu vực**.
2. Nhập **Mã** (ví dụ F; không đổi được sau khi tạo vì nằm trong mã vị trí), **Tên**, **Loại khu vực** (Thông thường, Kho lạnh, Kho khô, Hàng hóa chất, Hàng cồng kềnh), trạng thái và mô tả.
3. **Vị trí trên sơ đồ** đã được điền sẵn vào chỗ trống đầu tiên. Sơ đồ rộng 100 đơn vị (X từ trái sang phải) và tự cao thêm khi có khu mới ở phía dưới (Y từ trên xuống).
4. Xem **sơ đồ thu nhỏ** ngay trong hộp: khu đang sửa màu xanh, các khu khác màu xám. Nếu bị đè lên khu khác, khu chuyển màu đỏ, hiện dòng "Đang đè lên …" và nút Lưu bị khóa. Bấm **Tự động tìm chỗ trống** để đặt lại.
5. Bấm **Lưu**. Khu mới chưa có kệ; tạo kệ ở bước tiếp theo.

Chỉ xóa được khu chưa có kệ. Danh sách khu vực cũng cho biết số kệ, số ô và tỷ lệ sử dụng của từng khu.

### Quản lý kệ

Tạo một kệ là hệ thống tự sinh toàn bộ tầng và ô của kệ đó.

1. Mở **Quản lý kệ → Thêm kệ**.
2. Chọn **Khu vực**, nhập **Mã kệ** (ví dụ A05) và **Tên**.
3. Nhập **Số tầng** (1–20), **Số ô mỗi tầng** (1–50) và **Sức chứa mỗi ô**. Dòng gợi ý hiện mã vị trí sẽ được tạo, ví dụ WH001-A-A05-L01-B01.
4. Bấm **Lưu**. Ví dụ 4 tầng × 5 ô tạo ra 20 ô.

Nút biểu tượng bản đồ trên mỗi dòng mở sơ đồ của kệ đó. Nút **Sửa** đổi tên hoặc chuyển kệ sang **Ngừng hoạt động** (toàn bộ ô của kệ cũng ngừng theo). Kệ đã từng có hàng hoặc phát sinh giao dịch thì không xóa được, chỉ chuyển sang ngừng hoạt động.

### Vị trí lưu trữ

Trang **Vị trí lưu trữ** liệt kê từng ô với số lô, số sản phẩm, mức sử dụng và trạng thái.

- **Lọc** theo khu vực, kệ, mức lấp đầy (Trống, Có hàng, Gần đầy, Đầy) và trạng thái. Ô tìm kiếm tìm theo mã vị trí.
- Nút **Xem** mở chi tiết hàng trong ô.
- Nút **Sửa** (Quản lý kho trở lên) đổi **sức chứa** hoặc chuyển ô sang **Ngừng hoạt động** (ví dụ ô đang sửa kệ). Sức chứa không được nhỏ hơn lượng hàng đang chứa. Ô ngừng hoạt động không nhận thêm hàng và không được chọn khi xuất FEFO.

## 5. Hàng hóa

### Danh mục sản phẩm

Mỗi sản phẩm có một mã **SKU** duy nhất. Danh sách hiện tồn kho hiện tại, định mức tối thiểu, số lô và nhãn **Dưới định mức** khi tồn thấp hơn tồn tối thiểu.

**Thêm sản phẩm** (Quản lý kho trở lên):

1. Bấm **Thêm sản phẩm**.
2. Nhập **SKU** (chữ, số và - \_ .; tự chuyển chữ hoa), **Tên sản phẩm**, **Đơn vị** (Bao, Thùng, Can, Bộ...).
3. Chọn **Loại hàng**; nhập **Mã vạch / QR** nếu có.
4. Nhập **Tồn tối thiểu** (để cảnh báo thiếu hàng) và **Tồn tối đa** (phải lớn hơn hoặc bằng tồn tối thiểu).
5. Nhập **Mô tả** (ví dụ điều kiện sấy hạt nhựa), bấm **Lưu**.

**Trang chi tiết sản phẩm** (bấm vào SKU) gồm:

- Thông tin, tồn kho và ảnh sản phẩm. **Tải ảnh lên** nhận JPG, PNG, WebP tối đa 2MB (cần bật lưu trữ tệp R2; nếu chưa bật, hệ thống báo "Chưa cấu hình lưu trữ tệp").
- Tab **Vị trí lưu trữ**: mọi ô đang chứa sản phẩm, theo thứ tự HSD.
- Tab **Lịch sử tồn kho**: mọi lần nhập, xuất, điều chuyển, điều chỉnh, kèm số phiếu (bấm để mở phiếu).
- Nút **Lưu trữ**: ẩn sản phẩm không còn kinh doanh khỏi danh sách chọn. Chỉ lưu trữ được khi tồn bằng 0. Nút **Khôi phục** đưa sản phẩm trở lại.

Lọc danh sách theo loại hàng, trạng thái (Đang hoạt động, Ngừng hoạt động, Đã lưu trữ) hoặc tick **Chỉ hàng dưới định mức**.

### Loại hàng hóa và Nhà cung cấp

- **Loại hàng hóa**: nhóm sản phẩm (ví dụ Hạt nhựa nhiệt dẻo, Khuôn ép nhựa). Bấm tên loại để xem các sản phẩm thuộc loại đó. Chỉ xóa được loại chưa có sản phẩm.
- **Nhà cung cấp**: mã, tên, người liên hệ, điện thoại, email, địa chỉ. Nhà cung cấp được chọn khi tạo phiếu nhập. Xưởng sản xuất nội bộ cũng khai báo như một nhà cung cấp để nhập thành phẩm.

### Quản lý lô hàng

Trang **Quản lý lô hàng** liệt kê từng lô, sắp theo HSD sớm nhất: số lô, sản phẩm, nhà cung cấp, NSX, HSD (kèm số ngày còn lại), thanh **Hạn dùng còn lại** theo phần trăm, ngày nhập, số lượng, các vị trí và trạng thái.

- Lọc theo trạng thái lô, nhóm hạn sử dụng, hoặc bỏ tick **Chỉ lô còn hàng** để xem cả lô đã xuất hết.
- **Đổi trạng thái lô** (Quản lý kho trở lên): bấm biểu tượng khiên cuối dòng, chọn **Khả dụng**, **Cách ly** hoặc **Khóa**, ghi lý do vào Ghi chú (ví dụ "Chờ QC: độ ẩm hạt PA66 vượt 0,2%"). Lô Cách ly hoặc Khóa sẽ không được xuất; QC đạt thì chuyển lại Khả dụng.

### Tồn kho

Trang **Tồn kho** có hai tab:

- **Vị trí tồn**: mỗi dòng là một cặp sản phẩm + lô + ô còn hàng. Lọc theo khu vực, trạng thái lô, nhóm HSD; sắp xếp theo sản phẩm, HSD hoặc vị trí (sắp theo vị trí tiện cho đi kiểm hàng theo lối đi).
- **Lịch sử giao dịch**: sổ cái mọi biến động (Nhập kho, Xuất kho, Chuyển đi, Chuyển đến, Điều chỉnh kiểm kê), kèm số lượng thay đổi, tồn sau giao dịch, số phiếu và người thực hiện. Lọc theo loại giao dịch và khoảng ngày.

## 6. Nhập kho

Phiếu nhập đi qua hai bước: **Lưu nháp** rồi **Xác nhận nhập kho**. Tồn kho chỉ tăng khi phiếu được xác nhận; phiếu nháp có thể sửa hoặc hủy thoải mái.

### Tạo phiếu nhập

1. Mở **Nghiệp vụ kho → Nhập kho → Tạo phiếu nhập**.
2. Phần thông tin phiếu: chọn **Nhà cung cấp**, kiểm tra **Ngày nhập** (mặc định hôm nay), nhập **Số hóa đơn / chứng từ** (ví dụ số hóa đơn hoặc số lệnh sản xuất LSX) và ghi chú.
3. Phần **Hàng nhập**, mỗi dòng gồm:
   - **Sản phẩm**: bấm ô, gõ SKU, tên hoặc mã vạch rồi chọn. Dưới ô hiện đơn vị tính.
   - **Số lô**: theo số lô của nhà cung cấp hoặc lô sản xuất; tự chuyển chữ hoa.
   - **Ngày sản xuất** và **Hạn sử dụng**: luôn nhập HSD cho nguyên liệu, hóa chất có hạn (hệ thống không tự bắt buộc, nhưng thiếu HSD thì lô đó bị xếp cuối khi xuất FEFO và không có cảnh báo hết hạn); bỏ trống với hàng không có hạn (thành phẩm, khuôn, phụ tùng). HSD phải sau NSX.
   - **Vị trí**: gõ một phần mã vị trí, ví dụ C01-L02, rồi chọn ô. Mỗi ô hiện "Còn trống X / sức chứa"; ô đã đầy không chọn được.
   - **Số lượng**: số nguyên lớn hơn 0.
4. Bấm **Thêm dòng** để nhập thêm sản phẩm, hoặc cùng một lô chia vào nhiều ô. Bấm biểu tượng thùng rác để bỏ dòng.
5. Bấm **Lưu nháp**. Hệ thống tạo số phiếu dạng PN-YYMMDD-xxxx và mở trang chi tiết phiếu.

### Xác nhận, sửa hoặc hủy

Trên trang chi tiết phiếu ở trạng thái **Nháp**:

- **Sửa**: quay lại form để đổi thông tin hoặc dòng hàng.
- **Hủy phiếu**: phiếu chuyển sang Đã hủy, tồn kho không đổi.
- **Xác nhận nhập kho** → đọc thông báo → **Xác nhận**. Hệ thống cùng lúc tạo lô mới (nếu chưa có), cộng tồn vào đúng ô, ghi lịch sử giao dịch và ghi nhận người xác nhận. Sau khi xác nhận không sửa hay hủy được nữa.

### Quy tắc cần nhớ

- **Lô đã tồn tại**: nhập thêm vào một số lô đã có của cùng sản phẩm sẽ cộng dồn vào lô đó. HSD phải trùng với HSD của lô cũ; nếu khác, hệ thống báo "Số lô đã tồn tại với hạn sử dụng khác" và bạn cần dùng số lô khác.
- **Sức chứa**: nếu bất kỳ dòng nào làm ô vượt sức chứa, toàn bộ phiếu không được xác nhận và vẫn ở trạng thái Nháp. Sửa phiếu, chia hàng sang ô khác rồi xác nhận lại.
- **Ô ngừng hoạt động** không nhận hàng.
- **Bấm xác nhận hai lần** không làm tồn kho cộng hai lần: lần thứ hai báo "Chứng từ đã được xử lý".
- **Nhập thành phẩm từ xưởng**: chọn nhà cung cấp là xưởng ép nội bộ, số chứng từ là số lệnh sản xuất, số lô theo ngày ép (ví dụ TP-261124-01).

## 7. Xuất kho theo FEFO

Khi xuất kho, bạn chỉ nhập **sản phẩm và số lượng**; hệ thống tự chọn lô và vị trí theo nguyên tắc FEFO. Phiếu xuất được xác nhận ngay, không qua bước nháp.

### Cách hệ thống chọn hàng

1. Lấy mọi vị trí đang có sản phẩm đó.
2. Loại bỏ: lô **đã hết hạn** (HSD ≤ hôm nay), lô **Cách ly**, lô **Khóa**, và ô **ngừng hoạt động**.
3. Xếp các lô còn lại theo **HSD sớm nhất trước**. Lô không có HSD xếp cuối. Cùng HSD thì lô nhập trước được lấy trước.
4. Lấy lần lượt từng lô, từng ô cho đến khi đủ số lượng.

**Ví dụ** với SP001 (hạt nhựa PC chống cháy): LOT001 còn 100 bao, HSD 01/12/2026; LOT002 còn 200 bao, HSD 15/12/2026; LOT003 còn 150 bao, HSD 01/01/2027. Xuất 150 bao thì hệ thống lấy **LOT001: 100 bao** và **LOT002: 50 bao**, LOT003 giữ nguyên.

### Tạo phiếu xuất

1. Mở **Nghiệp vụ kho → Xuất kho → Tạo phiếu xuất**.
2. Nhập **Ngày xuất**, **Người nhận / Khách hàng** (ví dụ "Xưởng ép nhựa - Line 1" hoặc tên khách hàng), **Lý do** (Bán hàng, Sử dụng nội bộ, Trả nhà cung cấp, Tiêu hủy, Khác) và ghi chú.
3. Ở phần **Hàng cần xuất**: chọn sản phẩm (ô chọn hiện tồn hiện có) và nhập số lượng. Bấm **Thêm dòng** để xuất nhiều sản phẩm trên cùng một phiếu.
4. Bấm **Tính phân bổ FEFO**. Bảng phân bổ hiện cho từng sản phẩm:
   - Số **Yêu cầu**, **Phân bổ** và **Thiếu** (nếu không đủ hàng).
   - Từng dòng lấy hàng: số lô, HSD kèm số ngày còn lại, **vị trí lấy hàng**, số đang có và số cần lấy.
   - Dòng màu cam "Không xuất được" cho biết có bao nhiêu hàng bị loại vì hết hạn, cách ly hoặc khóa.
5. Nếu đủ hàng, bấm **Xác nhận xuất kho** → **Xác nhận**. Tồn kho bị trừ đúng theo các lô và vị trí trong bảng; hệ thống mở trang chi tiết phiếu (số phiếu dạng PX-YYMMDD-xxxx).

Nếu bảng hiện **Không đủ hàng khả dụng để xuất**, hãy giảm số lượng, kiểm tra lô đang cách ly có thể mở lại hay không, hoặc nhập thêm hàng.

### Khi tồn kho thay đổi giữa chừng

Nếu sau khi bạn tính phân bổ có người khác vừa xuất hoặc đổi trạng thái cùng lô, hệ thống báo **"Tồn kho vừa thay đổi"** và hiện bảng phân bổ mới. Xem lại rồi bấm xác nhận lần nữa. Hai người xuất cùng lúc không bao giờ làm kho bị âm.

Bấm xác nhận nhiều lần hoặc mạng chập chờn cũng **không trừ kho hai lần**: hệ thống nhận ra cùng một lần xác nhận và trả về phiếu đã tạo.

### Xuất phiếu PDF

Trên trang chi tiết phiếu xuất, bấm **Xuất phiếu PDF** để tải file PhieuXuatKho\_\<số phiếu>.pdf (khổ A4). Phiếu gồm:

- Tên doanh nghiệp, mã và tên kho, địa chỉ; số phiếu và trạng thái.
- Tiêu đề PHIẾU XUẤT KHO, ngày xuất, người nhận, lý do, người lập, thời điểm xác nhận.
- Bảng lấy hàng: STT, mã hàng, tên hàng, số lô, HSD, vị trí lấy hàng, đơn vị tính, số lượng và dòng Cộng.
- Bốn ô ký: Người lập phiếu, Người nhận hàng, Thủ kho, Giám đốc.

In phiếu để thủ kho đi lấy hàng theo cột **Vị trí lấy hàng**, sau đó các bên ký nhận. Phiếu xuất đã xác nhận không hủy được; nếu xuất nhầm, dùng Kiểm kê để điều chỉnh lại tồn.

## 8. Điều chuyển

Điều chuyển dời hàng từ ô này sang ô khác và **giữ nguyên số lô, HSD**. Chức năng dành cho Quản lý kho và Quản trị viên; nhân viên chỉ xem được danh sách phiếu.

Dùng khi: dồn hàng lẻ để giải phóng ô, chuyển lô cách ly sang khu chờ QC, đưa hàng sắp hết hạn ra gần lối xuất, hoặc làm trống ô cần sửa kệ.

1. Mở **Nghiệp vụ kho → Điều chuyển → Tạo phiếu điều chuyển**.
2. Nhập **Ngày điều chuyển**, **Lý do** và ghi chú.
3. Bấm **Chọn hàng tại vị trí nguồn**: cửa sổ hiện các vị trí đang có hàng; tìm theo SKU, số lô hoặc mã vị trí rồi bấm vào dòng cần chuyển.
4. Với mỗi dòng: chọn **Vị trí đích** (phải khác vị trí nguồn, còn đủ chỗ) và nhập **Số lượng** (mặc định bằng toàn bộ lượng tại nguồn, không được vượt quá).
5. Lặp lại bước 3–4 để chuyển nhiều dòng trong một phiếu, rồi bấm **Lưu nháp** (số phiếu dạng DC-YYMMDD-xxxx).
6. Trên trang chi tiết, bấm **Xác nhận điều chuyển** → **Xác nhận**. Hàng được trừ ở nguồn và cộng vào đích cùng lúc; lịch sử ghi hai giao dịch Chuyển đi và Chuyển đến.

Phiếu nháp có thể **Hủy phiếu**. Khi xác nhận, nếu hàng tại nguồn không còn đủ (ví dụ đã bị xuất sau khi lập phiếu) hoặc ô đích không còn đủ chỗ, hệ thống từ chối toàn bộ phiếu và không thay đổi tồn nào.

## 9. Kiểm kê

Kiểm kê so số đếm thực tế với số trên hệ thống và điều chỉnh chênh lệch. Một phiên đi qua 3 trạng thái: **Đang kiểm đếm → Chờ duyệt → Đã duyệt**. Nhân viên đếm và gửi duyệt; Quản lý kho duyệt, trả lại hoặc hủy phiên.

### Nhân viên kho: tạo phiên và đếm

1. Mở **Nghiệp vụ kho → Kiểm kê → Tạo phiên kiểm kê**.
2. Chọn **Phạm vi**: Toàn kho, Theo khu vực hoặc Theo kệ; bấm chọn một hoặc nhiều khu/kệ (tối đa 50). Bấm **Tạo mới**.
3. Hệ thống chụp lại **SL hệ thống** của mọi vị trí có hàng trong phạm vi tại thời điểm tạo (số phiên dạng KK-YYMMDD-xxxx).
4. Đi đếm theo danh sách (đã sắp theo mã vị trí) và nhập **SL thực tế** cho từng dòng. Cột **Chênh lệch** tự tính: số dương màu xanh là thừa, số âm màu đỏ là thiếu; dòng chênh lệch được tô nền cam.
5. Bấm **Lưu số đếm** bất cứ lúc nào; có thể đếm nhiều đợt.
6. Nút **Điền SL hệ thống cho dòng chưa đếm** giúp nhanh khi phần lớn khớp sổ sách, chỉ cần sửa các dòng lệch. Chỉ dùng khi đã thực sự đếm các dòng đó.
7. Khi đếm xong và đã lưu, bấm **Gửi duyệt**.

Dòng chưa nhập số đếm sẽ không được điều chỉnh. Dùng ô tìm kiếm và tick **Chỉ hiện chênh lệch** để rà lại trước khi gửi.

### Quản lý kho: duyệt

1. Mở phiên ở trạng thái **Chờ duyệt**, xem số dòng chênh lệch và từng dòng.
2. Chưa hợp lý thì bấm **Trả lại kiểm đếm** để nhân viên đếm lại.
3. Hợp lý thì bấm **Duyệt & điều chỉnh tồn** → **Xác nhận**. Tồn kho được cộng hoặc trừ đúng bằng chênh lệch, lịch sử ghi giao dịch "Điều chỉnh kiểm kê" và nhật ký lưu chi tiết từng dòng điều chỉnh.
4. **Hủy phiên** nếu phiên tạo nhầm; tồn kho không đổi.

Phiên đã duyệt hoặc đã hủy không mở lại được. Nên hạn chế nhập, xuất trong phạm vi đang kiểm kê; nếu có phát sinh, chênh lệch vẫn được tính theo số chụp lúc tạo phiên. Nếu ô không còn đủ hàng để trừ, hoặc phần thừa làm ô vượt sức chứa, việc duyệt bị từ chối và không có thay đổi nào.

## 10. Cảnh báo

Nhóm **Cảnh báo** có 3 danh sách, được tính lại mỗi lần mở theo ngày giờ Việt Nam, nên luôn đúng với ngày hôm nay. Mỗi danh sách lọc được theo sản phẩm/lô/vị trí (ô tìm kiếm), khu vực, kệ và khoảng HSD; cuối thanh lọc hiện tổng số lượng của trang đang xem.

| Danh sách | Gồm những gì | Nên xử lý thế nào |
| --- | --- | --- |
| Hàng sắp hết hạn | Hàng còn hạn 1–60 ngày; lọc thêm theo nhóm 1–7, 8–30, 31–60 ngày | Ưu tiên xuất sử dụng (FEFO đã tự làm), báo bộ phận sản xuất/kinh doanh, cân nhắc điều chuyển ra gần lối xuất |
| Hàng đã hết hạn | Hàng có HSD đến hôm nay hoặc đã qua mà vẫn còn trong kho | Không được xuất bán. Chuyển lô sang Khóa, tiêu hủy hoặc trả nhà cung cấp, rồi điều chỉnh tồn về 0 bằng Kiểm kê (xem lưu ý bên dưới) |
| Hàng tồn lâu ngày | Lô nhập từ trên N ngày và không có lần xuất nào trong N ngày (N mặc định 90, đổi trong Cài đặt) | Rà soát nhu cầu, giảm đặt mua, xem xét thanh lý; với khuôn: cân nhắc bảo dưỡng hoặc ngừng lưu kho |

Nhóm hạn sử dụng dùng chung trên toàn hệ thống:

| Nhóm | Số ngày còn lại | Màu |
| --- | --- | --- |
| Đã hết hạn | 0 hoặc âm (HSD là hôm nay cũng tính là hết hạn) | Đỏ đậm |
| Hết hạn trong 1–7 ngày | 1 đến 7 | Đỏ |
| Hết hạn trong 8–30 ngày | 8 đến 30 | Cam |
| Hết hạn trong 31–60 ngày | 31 đến 60 | Vàng |
| Còn hạn an toàn | Trên 60 | Xanh lá |
| Không có HSD | Lô không nhập HSD | Xám |

**Lưu ý khi tiêu hủy hàng hết hạn**: FEFO luôn bỏ qua hàng hết hạn, nên phiếu xuất không lấy được lô đó. Để đưa hàng hết hạn ra khỏi sổ, tạo phiên Kiểm kê cho kệ chứa lô đó, nhập SL thực tế bằng 0 cho lô đã tiêu hủy, ghi chú số biên bản tiêu hủy, rồi gửi duyệt.

## 11. Báo cáo và xuất Excel

Trang **Báo cáo** (Quản lý kho và Quản trị viên) có 10 loại báo cáo, đều xuất được ra file Excel đã định dạng sẵn.

| Báo cáo | Nội dung | Bộ lọc |
| --- | --- | --- |
| Báo cáo tồn kho | Tồn theo từng sản phẩm + lô + vị trí, kèm NSX, HSD, trạng thái lô | Khu vực |
| Theo sản phẩm | Tổng tồn, định mức, số lô, số vị trí, HSD gần nhất của từng SKU | — |
| Theo lô | Mọi lô: nhà cung cấp, NSX, HSD, ngày nhập, trạng thái, số lượng còn | — |
| Theo vị trí | Mọi ô: sức chứa, số lượng, % sử dụng, số lô | Khu vực |
| Nhập kho | Từng dòng hàng của phiếu nhập đã xác nhận | Khoảng ngày |
| Xuất kho | Từng dòng lấy hàng của phiếu xuất, kèm người nhận và lý do | Khoảng ngày |
| Hàng sắp hết hạn | Hàng còn hạn 1–60 ngày, kèm số ngày còn lại và nhóm hạn | Khu vực |
| Hàng hết hạn | Hàng đã hết hạn còn trong kho | Khu vực |
| Lịch sử điều chuyển | Từng dòng điều chuyển đã xác nhận: từ vị trí, đến vị trí | Khoảng ngày |
| Kiểm kê | SL hệ thống, SL thực tế và chênh lệch của các dòng đã đếm | Khoảng ngày |

### Cách dùng

1. Bấm tên báo cáo ở hàng nút phía trên.
2. Chọn bộ lọc: khoảng ngày (mặc định 30 ngày gần nhất) hoặc khu vực. Kết quả hiện ngay bên dưới, kèm số dòng và tổng số lượng. Màn hình hiện tối đa 500 dòng đầu.
3. Bấm **Xuất Excel** để tải file .xlsx chứa **toàn bộ** dữ liệu, kể cả khi vượt 500 dòng.

### File Excel gồm gì

- 4 dòng đầu: tên doanh nghiệp, tên báo cáo, kỳ báo cáo hoặc khu vực, người xuất và thời điểm xuất.
- Dòng tiêu đề cột cố định khi cuộn, có nút lọc ở mỗi cột.
- Ngày ở dạng ngày thật của Excel (dd/mm/yyyy), số có phân cách hàng nghìn: sắp xếp, lọc và tính toán được ngay.
- Tình trạng hạn sử dụng và trạng thái lô được tô màu như trên hệ thống; chênh lệch kiểm kê âm màu đỏ, dương màu xanh.
- Dòng **TỔNG CỘNG** dùng công thức SUM, tự tính lại khi bạn sửa số trong Excel.
- In được ngay: khổ ngang, vừa một trang chiều rộng, tiêu đề cột lặp lại mỗi trang.

## 12. Quản trị hệ thống

### Quản lý người dùng (Quản trị viên)

1. Mở **Quản lý người dùng → Thêm người dùng**.
2. Nhập **Email** (dùng để đăng nhập, không đổi được sau này), **Họ và tên**, **Điện thoại**, **Mật khẩu** ban đầu (tối thiểu 8 ký tự).
3. Tick một hoặc nhiều **Vai trò**; dưới mỗi vai trò có mô tả quyền.
4. Bấm **Lưu** và gửi email, mật khẩu cho người dùng; dặn họ đổi mật khẩu sau lần đăng nhập đầu.

Nút **Sửa** trên mỗi dòng cho phép đổi tên, vai trò, trạng thái và **đặt lại mật khẩu** (để trống nếu giữ nguyên). Khi người dùng nghỉ việc, chuyển trạng thái sang **Ngừng hoạt động**: họ bị đăng xuất ngay và không đăng nhập được nữa, nhưng lịch sử thao tác của họ vẫn giữ. Quản trị viên không thể tự gỡ quyền quản trị hoặc tự khóa tài khoản của mình.

### Nhật ký hệ thống

Tab **Nhật ký hệ thống** trong trang Quản lý người dùng ghi lại ai làm gì, lúc nào, từ địa chỉ IP nào: đăng nhập, đăng nhập sai (tô đỏ), đăng xuất, tạo và xác nhận chứng từ, đổi trạng thái lô, duyệt kiểm kê, thay đổi danh mục, người dùng và cài đặt. Gõ vào ô tìm kiếm để lọc theo hành động hoặc nội dung chi tiết.

### Cài đặt

Mọi người đều xem được trang **Cài đặt**; chỉ Quản trị viên sửa được.

| Mục | Ý nghĩa |
| --- | --- |
| Tên doanh nghiệp | Hiện ở thanh trên cùng, phiếu PDF và file Excel |
| Mã kho | Tiền tố của mọi mã vị trí, 2–10 chữ và số, hiện ở tiêu đề Sơ đồ kho |
| Tên kho chính, Địa chỉ kho | Hiện ở Sơ đồ kho và đầu phiếu xuất PDF |
| Số ngày coi là tồn lâu | Ngưỡng cho danh sách Hàng tồn lâu ngày (7–720 ngày, mặc định 90) |
| Ngưỡng gần đầy (%) | Từ mức này ô chuyển màu vàng trên sơ đồ (50–99%, mặc định 80) |
| Ngôn ngữ | Tiếng Việt hoặc English, riêng cho trình duyệt của bạn |

**Đổi mã kho**: khi bấm Lưu, hệ thống hỏi xác nhận vì toàn bộ mã vị trí sẽ đổi theo, ví dụ WH001-A-A01-L01-B01 thành KMP01-A-A01-L01-B01. Nhãn vị trí đã in và file PDF/Excel đã xuất trước đó vẫn ghi mã cũ, nên chỉ đổi khi thật cần.

**Thông tin hệ thống** cho biết môi trường, cơ sở dữ liệu, lưu trữ tệp, múi giờ nghiệp vụ và liên kết tài liệu API cho bộ phận IT.

**Khôi phục dữ liệu demo** (chỉ có ở bản demo): đưa toàn bộ dữ liệu kho về bộ mẫu theo ngày hôm nay, xóa mọi thay đổi đã làm. Dùng sau mỗi buổi trình diễn; không hoàn tác được.

## 13. Quy trình mẫu tại nhà máy nhựa kỹ thuật

Quy trình dưới đây nối các chức năng thành một vòng hàng hoàn chỉnh, dùng được ngay với dữ liệu demo để đào tạo hoặc trình diễn.

![Hàng đi một chiều: nguyên liệu → xưởng ép → thành phẩm → khách hàng](/guide-assets/quy-trinh-nha-may.png)

Lô không đạt QC bị giữ lại ở trạng thái Cách ly hoặc Khóa nên không bao giờ đi vào xưởng hay tới tay khách hàng.

1. **Nhận nguyên liệu** (Nhân viên kho): nhà cung cấp giao 120 bao hạt PC SP001. Tạo phiếu nhập, chọn nhà cung cấp, nhập số hóa đơn, số lô của nhà cung cấp, NSX, HSD; chia 60 bao vào mỗi ô trống ở khu A. Lưu nháp rồi xác nhận.
2. **Kiểm tra chất lượng** (Quản lý kho): nếu QC cần thời gian, chuyển lô sang Cách ly ngay sau khi nhập; QC đạt thì chuyển lại Khả dụng, không đạt thì chuyển Khóa và ghi lý do.
3. **Cấp nguyên liệu cho sản xuất** (Nhân viên kho): tạo phiếu xuất, người nhận "Xưởng ép nhựa - Line 1", lý do Sử dụng nội bộ. Tính phân bổ FEFO, xuất phiếu PDF và lấy hàng theo cột Vị trí lấy hàng.
4. **Nhập thành phẩm** (Nhân viên kho): khi xưởng giao hàng, tạo phiếu nhập với nhà cung cấp là xưởng ép nội bộ, số chứng từ là số lệnh sản xuất, số lô theo ngày ép, ô ở khu C; bỏ trống HSD.
5. **Xuất bán** (Nhân viên kho): tạo phiếu xuất lý do Bán hàng, người nhận là khách hàng, xuất phiếu PDF để khách ký nhận.
6. **Dọn ô và sắp xếp** (Quản lý kho): dùng Điều chuyển dồn các ô lẻ; theo dõi Sơ đồ kho để biết khu nào sắp đầy.
7. **Hằng ngày** (Quản lý kho): mở Tổng quan và Cảnh báo; báo bộ phận mua hàng các sản phẩm dưới định mức và báo sản xuất các lô nguyên liệu sắp hết hạn.
8. **Cuối tháng** (Nhân viên đếm, Quản lý duyệt): kiểm kê từng khu, duyệt chênh lệch, sau đó xuất báo cáo Tồn kho và Kiểm kê ra Excel để lưu hồ sơ.

## 14. Câu hỏi thường gặp và xử lý lỗi

### Thông báo lỗi thường gặp

| Thông báo | Nguyên nhân | Cách xử lý |
| --- | --- | --- |
| Email hoặc mật khẩu không đúng | Gõ sai hoặc bật Caps Lock | Gõ lại; quên mật khẩu thì nhờ Quản trị viên đặt lại |
| Bạn đã thử quá nhiều lần | Sai mật khẩu 5 lần trong 15 phút | Chờ 15 phút rồi thử lại |
| Phiên đăng nhập đã hết hạn | Không thao tác trong 12 giờ, hoặc vừa đổi mật khẩu | Đăng nhập lại |
| Phiên làm việc không hợp lệ, vui lòng tải lại trang | Trang mở quá lâu hoặc đăng nhập ở tab khác | Bấm F5 tải lại trang |
| Bạn không có quyền thực hiện thao tác này | Vai trò không được phép (ví dụ nhân viên tạo điều chuyển) | Nhờ Quản lý kho thực hiện hoặc xin cấp thêm vai trò |
| Mã hoặc dữ liệu này đã tồn tại | Trùng SKU, mã khu, mã kệ, email... | Đổi sang mã khác |
| Vượt quá sức chứa của vị trí lưu trữ | Ô không còn đủ chỗ | Chia hàng sang ô khác hoặc tăng sức chứa ô |
| Vị trí lưu trữ đang ngừng sử dụng | Ô bị chuyển sang Ngừng hoạt động | Chọn ô khác |
| Số lô đã tồn tại với hạn sử dụng khác | Nhập trùng số lô cũ nhưng khác HSD | Kiểm tra lại HSD hoặc dùng số lô mới |
| Không đủ tồn kho khả dụng | Hàng còn lại không đủ, hoặc phần còn lại đang hết hạn/cách ly/khóa | Giảm số lượng; kiểm tra dòng "Không xuất được" trong bảng phân bổ |
| Tồn kho vừa thay đổi | Người khác vừa xuất hoặc đổi lô sau khi bạn tính phân bổ | Xem bảng phân bổ mới rồi xác nhận lại |
| Chứng từ đã được xử lý hoặc trạng thái không hợp lệ | Phiếu đã được xác nhận/hủy (có thể bởi người khác) | Tải lại trang để xem trạng thái hiện tại |
| Dữ liệu đang được sử dụng, không thể xóa | Xóa khu còn kệ, kệ có lịch sử, loại hàng còn sản phẩm, sản phẩm còn tồn | Chuyển sang Ngừng hoạt động thay vì xóa |
| Khu vực bị đè lên khu khác trên sơ đồ kho | Vị trí/kích thước khu chồng lên khu khác | Bấm Tự động tìm chỗ trống |
| Chưa cấu hình lưu trữ tệp (R2) | Chưa bật lưu trữ ảnh | Báo bộ phận IT; các chức năng khác vẫn dùng bình thường |
| Không kết nối được máy chủ / Đã xảy ra lỗi hệ thống | Mất mạng hoặc máy chủ tạm quá tải | Kiểm tra mạng, thử lại sau vài phút; kéo dài thì báo IT |

### Câu hỏi thường gặp

**Vì sao lô có HSD là hôm nay lại bị coi là hết hạn?** Để không xuất hàng hết hạn ngay trong ngày giao. Hàng cần xuất phải còn ít nhất 1 ngày hạn.

**Tôi muốn xuất đúng một lô cụ thể, không theo FEFO được không?** Hiện chưa. Phiếu xuất luôn theo FEFO để tránh tồn hàng cận hạn. Nếu cần giữ lại một lô, chuyển lô đó sang Cách ly tạm thời.

**Xuất hoặc nhập nhầm thì sửa thế nào?** Phiếu đã xác nhận không sửa hay xóa được để giữ lịch sử. Dùng một phiên Kiểm kê cho kệ liên quan để đưa tồn về đúng số thực tế, ghi chú lý do.

**Vì sao không thấy một số menu?** Menu chỉ hiện chức năng thuộc vai trò của bạn. Xem bảng phân quyền ở Phụ lục.

**Ô chọn vị trí chỉ hiện khu A?** Danh sách mặc định chỉ hiện 50 ô đầu tiên. Gõ một phần mã vị trí, ví dụ C01 hoặc B-B02, để tìm ô ở khu khác.

**Số liệu có cập nhật ngay không?** Có. Sau mỗi lần xác nhận, tồn kho, sơ đồ, cảnh báo và báo cáo đều phản ánh ngay. Nếu màn hình của người khác vẫn hiện số cũ, họ tải lại trang là thấy.

## 15. Phụ lục

### A. Bảng phân quyền

| Chức năng | Nhân viên kho | Quản lý kho | Quản trị viên |
| --- | --- | --- | --- |
| Xem Tổng quan, sơ đồ, khu/kệ/ô, sản phẩm, lô, tồn kho, cảnh báo | Có | Có | Có |
| Xem danh sách phiếu nhập, xuất, điều chuyển, kiểm kê | Có | Có | Có |
| Tạo, sửa, hủy và xác nhận phiếu nhập | Có | Có | Có |
| Tạo phiếu xuất (FEFO), xuất phiếu PDF | Có | Có | Có |
| Tạo phiên kiểm kê, nhập số đếm, gửi duyệt | Có | Có | Có |
| Thêm, sửa khu vực, kệ, ô |  | Có | Có |
| Thêm, sửa sản phẩm, loại hàng, nhà cung cấp |  | Có | Có |
| Đổi trạng thái lô (Cách ly, Khóa) |  | Có | Có |
| Tạo, xác nhận, hủy điều chuyển |  | Có | Có |
| Duyệt, trả lại, hủy phiên kiểm kê |  | Có | Có |
| Xem báo cáo, xuất Excel |  | Có | Có |
| Quản lý người dùng, xem nhật ký hệ thống |  |  | Có |
| Sửa cài đặt, đổi mã kho, khôi phục dữ liệu demo |  |  | Có |

Một người có thể được gán nhiều vai trò; quyền được cộng dồn.

### B. Tiền tố số chứng từ

| Tiền tố | Loại chứng từ | Ví dụ |
| --- | --- | --- |
| PN | Phiếu nhập kho | PN-261124-RV52 |
| PX | Phiếu xuất kho | PX-261124-3EF2 |
| DC | Phiếu điều chuyển | DC-261124-7KQ2 |
| KK | Phiên kiểm kê | KK-261124-M8TA |

Số sau tiền tố là ngày tạo dạng YYMMDD, cuối cùng là mã ngẫu nhiên 4 ký tự.

### C. Thuật ngữ

| Thuật ngữ | Giải thích |
| --- | --- |
| SKU | Mã định danh duy nhất của một sản phẩm |
| Lô | Một đợt hàng cùng sản phẩm, cùng NSX và HSD |
| NSX / HSD | Ngày sản xuất / Hạn sử dụng |
| FEFO | First Expired – First Out: hết hạn trước thì xuất trước |
| Vị trí tồn | Một cặp sản phẩm + lô + ô đang có hàng |
| Sức chứa | Số đơn vị hàng tối đa một ô chứa được |
| Định mức tồn (tối thiểu / tối đa) | Mức tồn cần duy trì; dưới tối thiểu thì cần bổ sung |
| Chứng từ | Phiếu nhập, phiếu xuất, phiếu điều chuyển, phiên kiểm kê |
| Sổ cái / lịch sử giao dịch | Danh sách mọi biến động tồn kho, không sửa xóa được |
| Masterbatch | Hạt màu hoặc hạt phụ gia pha vào hạt nhựa khi ép |
| Cavity | Lòng khuôn; khuôn 4 cavity ép ra 4 sản phẩm mỗi lần |
| LSX | Lệnh sản xuất |
