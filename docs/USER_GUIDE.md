# Hướng Dẫn Sử Dụng Hệ Thống C-RES Recruit Theo Ba Vai Trò

Tài liệu này hướng dẫn chi tiết cách thao tác trên ứng dụng **C-RES Recruit — Cổng Tuyển Cộng Tác Viên Câu lạc bộ Thương mại C-RES (Đại học Kinh tế - Đại học Đà Nẵng)** theo đúng tên màn hình, thẻ (tab), nút bấm, nhãn trạng thái và thông báo lỗi đang được triển khai trong mã nguồn.

---

## Mở đầu: Màn hình Đăng nhập & Thanh điều hướng chung

### 1. Truy cập hệ thống theo từng vai trò tại màn hình khởi đầu
Khi chưa đăng nhập, màn hình **Cổng Tuyển Cộng Tác Viên Câu lạc bộ Thương mại C-RES** chia làm 2 khu vực:
- **Dành cho Ứng viên:**
  - **Cột phải:** Chọn tab **`Đăng nhập Ứng viên`** (điền `Email sinh viên`, `Mật khẩu`, bấm **`Đăng nhập`**) hoặc tab **`Đăng ký Ứng viên mới`** (điền `Họ và tên sinh viên`, `Email sinh viên`, `Mật khẩu`, `Xác nhận lại mật khẩu`, bấm **`Đăng ký & Điền đơn ứng tuyển`**).
  - **Cột trái (Tra cứu nhanh khi kiểm thử/demo):** Bấm nút **`Tra cứu Hồ sơ Ứng viên (<số lượng> hồ sơ)`**, tìm theo họ tên/MSSV/email/trạng thái ở ô **`Tìm theo họ tên, MSSV, email hoặc trạng thái...`**, sau đó bấm vào dòng ứng viên cần kiểm tra để mở trực tiếp màn hình ứng viên đó, hoặc bấm **`+ Đăng ký tài khoản mới`**.
- **Dành cho Ban Nhân sự (BNS) và Ban Chủ nhiệm (BCN):**
  - Ở cuối cột bên phải, bấm mục thu gọn **`Dành cho Ban tổ chức / Nội bộ CLB (BNS, BCN)`** để mở bảng **`Chọn phân hệ quản lý nội bộ Câu lạc bộ Thương mại C-RES`**, sau đó chọn:
    - **`Ban Nhân sự (BNS)`** (`hr@cres.due.udn.vn`)
    - **`Ban Chủ nhiệm (BCN)`** (`bcn@cres.due.udn.vn`)
    - *(Hoặc đăng nhập bằng form với email nội bộ tương ứng; ngoài ra còn có **`Tổng quan đợt tuyển`** và **`Cài đặt đợt tuyển`** dành cho Quản trị viên để bấm **`Đặt lại đợt tuyển trống (0 hồ sơ)`** hoặc **`Nạp dữ liệu mẫu (17 ứng viên)`**).*

### 2. Thanh tiêu đề chung (Header) sau khi đăng nhập
Ở góc phải trên cùng của mọi màn hình luôn có 3 nút:
- **`Facebook C-RES`**: Mở trang Fanpage chính thức của CLB.
- **`Hộp thư`**: Mở ngăn kéo **`Hộp thư thông báo (<số lượng>)`** bên phải màn hình để xem các thư thông báo mô phỏng đã phát sinh.
- **`Đổi tài khoản`**: Đăng xuất khỏi phiên hiện tại và quay về màn hình chọn tài khoản/vai trò.

---

## Vai trò 1: Ứng viên (`candidate`)

### 1. Công việc được thực hiện
Ứng viên sử dụng **Cổng Ứng viên** để thực hiện trọn vẹn hành trình ứng tuyển qua **Thanh tiến trình 6 bước**:
1. **`Bước 1: Nộp hồ sơ`** — Điền đơn đăng ký ứng tuyển CTV (hoặc lưu nháp trên trình duyệt).
2. **`Bước 2: Xét duyệt hồ sơ`** — Nhận kết quả kiểm tra thông tin tự động, bổ sung các trường còn thiếu (nếu hồ sơ ở trạng thái `Cần bổ sung hồ sơ`) và theo dõi kết quả sơ loại.
3. **`Bước 3: Đặt lịch phỏng vấn`** — Chủ động chọn ca phỏng vấn còn chỗ trống, đổi sang ca khác hoặc hủy đặt lịch trước khi điểm danh.
4. **`Bước 4: Tham gia phỏng vấn`** — Tự bấm điểm danh có mặt tại buổi phỏng vấn (hoặc nhờ BCN điểm danh) và chờ hội tụ kết quả.
5. **`Bước 5: Kết quả & Xác nhận`** — Nhận thông báo trúng tuyển phỏng vấn và bấm xác nhận tham gia CLB gộp 1 bước để nhận liên kết vào nhóm sinh hoạt chung.
6. **`Bước 6: Phân công Ban`** — Xem Ban công tác chính thức sau khi Ban Nhân sự chốt phân ban.
- **Ngoại lệ toàn quy trình:** Ứng viên có thể bấm **`Rút đơn ứng tuyển`** ở bất kỳ bước nào khi hồ sơ chưa kết thúc bởi lý do bị loại.

---

### 2. Các bước thao tác theo thứ tự

#### Bước A — Điền và nộp đơn đăng ký (Khi tài khoản chưa có đơn, ví dụ tài khoản mới hoặc `C13`)
1. Tại màn hình **`Đơn Đăng Ký Ứng Tuyển Cộng Tác Viên Câu lạc bộ Thương mại C-RES`**, nhập các trường thông tin:
   - **`Họ và tên *`**
   - **`Mã số sinh viên (MSSV DUE) *`**
   - **`Lớp sinh hoạt *`**
   - **`Email liên hệ *`**
   - **`Số điện thoại *`**
   - **`Link CV / Portfolio (Tùy chọn)`**
   - **`Ban Nguyện vọng 1 *`** (chọn trong danh sách `-- Chọn Ban Nguyện vọng 1 --`: `Ban Truyền thông`, `Ban Nhân sự`, `Ban Kinh doanh`)
   - **`Ban Nguyện vọng 2 (Tùy chọn)`**
   - **`Kinh nghiệm hoạt động ngoại khóa / kỹ năng cá nhân *`**
   - **`Câu hỏi tự luận: Vì sao bạn chọn Câu lạc bộ Thương mại C-RES và mong muốn đóng góp điều gì? *`**
2. Đánh dấu chọn 2 ô xác nhận điều kiện:
   - **`Tôi xác nhận là sinh viên đang theo học tại Đại học Kinh tế - Đại học Đà Nẵng`**
   - **`Tôi cam kết đảm bảo thời gian tham gia hoạt động cùng Câu lạc bộ Thương mại C-RES`**
3. *(Tùy chọn)* Bấm nút **`Lưu nháp`** ở góc phải tiêu đề biểu mẫu nếu muốn lưu tạm dữ liệu trên trình duyệt trước khi nộp.
4. Bấm nút **`Gửi đơn ứng tuyển`**.

#### Bước B — Bổ sung thông tin còn thiếu (Khi hồ sơ ở trạng thái `Cần bổ sung hồ sơ`)
1. Khi nộp đơn thiếu trường bắt buộc (ví dụ ứng viên mẫu `C02`, `C03`, `C04`), màn hình **`Hồ sơ của tôi: <Họ và tên>`** hiển thị khung màu vàng **`Yêu cầu bổ sung thông tin hồ sơ (Lần <x>/2)`** kèm đồng hồ **`Thời hạn còn lại: ...`**.
2. Điền đầy đủ vào các ô được liệt kê tại mục **`Các thông tin cần bổ sung (<số lượng> mục)`** (chẳng hạn `Số điện thoại *`, `Câu hỏi tự luận (Động lực & Định hướng) *`...).
3. Bấm nút **`Gửi thông tin bổ sung`**.

#### Bước C — Chọn lịch, đổi lịch hoặc hủy lịch phỏng vấn (Khi hồ sơ ở trạng thái `Chờ đặt lịch phỏng vấn` hoặc `Đã đặt lịch phỏng vấn`)
1. Tại khung **`Chọn khung giờ phỏng vấn`**, quan sát thời hạn ở nhãn **`Thời hạn đặt lịch: ...`** và danh sách các thẻ ca phỏng vấn (hiển thị ngày, giờ bắt đầu – kết thúc, tên/địa điểm ca, chỉ số **`Còn <trống>/<tổng> chỗ`** và dòng chi tiết **`Đã đặt: <x> · Dự trữ: <y> · Trống: <z>`**).
2. Bấm nút **`Chọn khung giờ này`** trên ca phỏng vấn còn chỗ trống và chưa qua giờ bắt đầu.
3. Sau khi đã đặt lịch (khung tiêu đề đổi thành **`Lịch phỏng vấn của bạn`** và xuất hiện hộp thông tin **`Khung giờ đã đặt của bạn:`**):
   - Nếu muốn **đổi sang ca khác còn chỗ**: Bấm nút **`Đổi sang khung giờ này`** trên thẻ của ca mới.
   - Nếu muốn **hủy lịch đã chọn để trả lại ghế**: Bấm nút **`Hủy đặt lịch`** trong hộp **`Khung giờ đã đặt của bạn:`**.

#### Bước D — Điểm danh tham gia phỏng vấn (Khi hồ sơ ở trạng thái `Đã đặt lịch phỏng vấn`)
1. Tại hộp **`Khung giờ đã đặt của bạn:`** (khi `Trạng thái điểm danh` đang là `Chưa điểm danh`), bấm nút màu xanh **`Điểm danh tham gia phỏng vấn`**.
2. Chờ Ban Chủ nhiệm hoàn tất chấm phiếu điểm và công bố kết quả.

#### Bước E — Xác nhận tham gia CLB & Xem kết quả phân ban (Khi hồ sơ ở trạng thái `Đã đậu — Chờ xác nhận vào nhóm`)
1. Khi Ban Chủ nhiệm đã chốt kết quả Đậu và gửi thông báo, trên màn hình xuất hiện khung màu xanh lá **`Chúc mừng bạn đã trúng tuyển vòng Phỏng vấn Câu lạc bộ Thương mại C-RES!`**.
2. Bấm nút **`Xác nhận tham gia C-RES`**.
3. Sau khi xác nhận, tại khung **`Nhóm sinh hoạt CLB & Thông tin Phân công Ban`**, bấm nút **`Tham gia nhóm CLB (<link nhóm>)`** để vào nhóm sinh hoạt chung và theo dõi mục **`Ban công tác chính thức:`**.

#### Bước F — Rút đơn ứng tuyển (Tùy chọn ở bất kỳ bước đang hoạt động nào)
1. Trên thẻ tiêu đề **`Hồ sơ của tôi: <Họ và tên>`**, bấm nút màu đỏ **`Rút đơn ứng tuyển`**.
2. Trong hộp thoại **`Xác nhận rút đơn ứng tuyển`**, nhập nội dung vào ô **`Lý do rút đơn *`**.
3. Bấm nút **`Xác nhận Rút đơn`** (hoặc bấm **`Hủy bỏ`** để đóng hộp thoại).

---

### 3. Kết quả cần quan sát sau mỗi bước

| Sau thao tác | Kết quả cần quan sát trên giao diện Ứng viên |
| :--- | :--- |
| **Bấm `Lưu nháp`** | Xuất hiện thông báo xanh: *"Đã lưu tạm thông tin đơn đăng ký của bạn trên trình duyệt."* |
| **Bấm `Gửi đơn ứng tuyển`** | Biểu mẫu đăng ký chuyển thành màn hình **`Hồ sơ của tôi: <Họ và tên>`** cùng **Thanh tiến trình 6 bước** và mục **`Hộp thư Thông báo của tôi`** ở cuối trang. Hệ thống tự động kiểm tra và chuyển ngay sang một trong các trạng thái:<br>• **`Cần bổ sung hồ sơ`** (nếu thiếu trường bắt buộc).<br>• **`Chờ đặt lịch phỏng vấn`** (nếu đủ thông tin và Đạt rõ $\ge 75$đ).<br>• **`Cần xem xét (Vòng hồ sơ)`** (nếu điểm nằm trong $[50, 75)$đ).<br>• **`Loại rõ (Sát ngưỡng - Chờ xem lại)`** (nếu điểm nằm trong $[45, 50)$đ và đạt điều kiện cứng).<br>• **`Hồ sơ không đạt`** kèm nhãn kết thúc **`Kết thúc: Hồ sơ không đạt`** (nếu $< 45$đ hoặc vi phạm điều kiện cứng). |
| **Bấm `Gửi thông tin bổ sung` (đủ thông tin)** | Hiện thông báo xanh: *"Cảm ơn bạn đã cập nhật bổ sung thông tin hồ sơ! Ban Nhân sự sẽ sớm phản hồi kết quả đến bạn."* Hồ sơ tự động chạy qua bước sơ loại và cập nhật sang trạng thái tương ứng (ví dụ `Chờ đặt lịch phỏng vấn` đối với `C02`, `C03`). |
| **Bấm `Chọn khung giờ này`** | Hiện thông báo xanh: *"Bạn đã chọn lịch phỏng vấn thành công!..."*; trạng thái hồ sơ đổi sang **`Đã đặt lịch phỏng vấn`** (`Bước 4: Tham gia phỏng vấn` sáng lên); nút trên thẻ ca vừa chọn đổi thành **`Đã chọn khung giờ này`**; số ghế **`Trống`** của ca giảm đi `1` và **`Đã đặt`** tăng thêm `1`. |
| **Bấm `Hủy đặt lịch`** | Hiện thông báo xanh: *"Đã hủy lịch phỏng vấn đã chọn và hoàn trả 1 chỗ trống cho ca phỏng vấn..."*; trạng thái hồ sơ quay về **`Chờ đặt lịch phỏng vấn`**; số ghế **`Trống`** của ca tăng lại `1`. |
| **Bấm `Điểm danh tham gia phỏng vấn`** | Hiện thông báo xanh: *"Điểm danh thành công!..."*; dòng trạng thái điểm danh hiển thị **`Đã điểm danh lúc <giờ ngày>`**; hồ sơ chuyển sang **`Đang phỏng vấn (Song song)`** (nếu BCN chưa chấm đủ phiếu) hoặc **`Chờ BCN quyết định Đậu/Rớt`** (nếu BCN đã chấm đủ phiếu trước đó). |
| **Bấm `Xác nhận tham gia C-RES`** | Hiện thông báo xanh: *"Chào mừng bạn chính thức trở thành thành viên mới..."*; trạng thái chuyển từ **`Đã đậu — Chờ xác nhận vào nhóm`** sang **`Đã vào nhóm — Chờ phân ban`**; hiển thị nút **`Tham gia nhóm CLB (...)`**. |
| **Sau khi BNS chốt phân ban** | Trạng thái chuyển sang **`Hoàn tất quy trình tuyển CTV`** kèm nhãn **`Kết thúc: Hoàn tất quy trình tuyển CTV`** (cả 6 bước trên thanh tiến trình đều có dấu tích hoàn thành); mục **`Ban công tác chính thức:`** hiển thị tên ban (VD: `Ban Truyền thông`). |
| **Bấm `Xác nhận Rút đơn`** | Trạng thái chuyển sang **`Đã rút đơn`** kèm nhãn **`Kết thúc: Đã rút đơn`**; nút `Rút đơn ứng tuyển` ẩn đi; nếu đã đặt lịch thì ghế phỏng vấn được trả lại; nếu đã được phân ban thì chỉ tiêu ban đó được hoàn trả `1` chỗ. |

---

### 4. Cách xử lý những trạng thái chờ hoặc thông báo lỗi hiện có

1. **Trạng thái chờ Ban Nhân sự duyệt hồ sơ (`Cần xem xét (Vòng hồ sơ)` hoặc `Loại rõ (Sát ngưỡng - Chờ xem lại)`):**
   - *Nguyên nhân:* Hồ sơ đã đủ thông tin nhưng điểm sơ loại nằm ở vùng biên cần BNS thẩm định thủ công.
   - *Cách xử lý:* Chuyển sang tài khoản **Ban Nhân sự (BNS)** tại tab **`2. Duyệt hồ sơ còn lại`** hoặc **`3. Hồ sơ cần được xem xét`** để thực hiện duyệt.
2. **Bổ sung hồ sơ nhưng vẫn còn thiếu trường hoặc hết 2 lần / quá hạn 2 ngày:**
   - Nếu sau lần bổ sung thứ 1 vẫn để trống trường bắt buộc: Hồ sơ giữ ở **`Cần bổ sung hồ sơ`** và bộ đếm tăng lên **`Lần 2/2`**.
   - Nếu lần bổ sung thứ 2 vẫn thiếu trường bắt buộc, hoặc đồng hồ vượt quá hạn 2 ngày: Hồ sơ chuyển sang trạng thái kết thúc **`Bị loại vì quá hạn`** (`Kết thúc: Bị loại vì quá hạn`) và hiển thị lỗi nếu cố gửi tiếp: *"Thời hạn bổ sung hồ sơ (2 ngày) đã kết thúc."*
3. **Không chọn được ca phỏng vấn (Nút bị khóa hiển thị `Đã hết chỗ trống` hoặc `Đã qua giờ bắt đầu`):**
   - *Nguyên nhân:* Số chỗ trống thực tế của ca (`Tổng sức chứa - Đã đặt - Dự trữ`) đã về `0` (ví dụ `DEMO_FULL_C` khi đã có 1 người đặt trên 1 ghế mở và 5 ghế dự trữ), hoặc thời gian hệ thống đã vượt qua giờ bắt đầu của ca.
   - *Cách xử lý:* Chọn một khung giờ khác còn chỗ trống (như `DEMO_FULL_A`, `DEMO_FULL_B`), hoặc hủy booking của ứng viên đang giữ chỗ nếu muốn kiểm thử lại ca đó.
4. **Thông báo lỗi khi đặt lịch muộn: *"Thời hạn đặt lịch phỏng vấn (2 ngày) đã hết. Hồ sơ của bạn đã bị hủy lịch hẹn."***
   - *Nguyên nhân:* Ứng viên ở trạng thái `Chờ đặt lịch phỏng vấn` nhưng đã quá hạn 2 ngày kể từ khi nhận lời mời đặt lịch. Hồ sơ tự động chuyển sang **`Ứng viên không tham gia`**.
5. **Trạng thái chờ sau phỏng vấn (`Đang phỏng vấn (Song song)`, `Chờ BCN quyết định Đậu/Rớt`, `Đã chọn Đậu (Chờ chốt gửi TB)`):**
   - *Nguyên nhân:* Màn hình ứng viên hiển thị *"Ban Chủ nhiệm đang tổng hợp kết quả phỏng vấn"*. Lúc này BCN chưa chấm đủ phiếu điểm tối thiểu, chưa chọn Đậu/Rớt, hoặc đã chọn Đậu/Rớt nhưng chưa bấm **`Chốt và gửi thông báo`**.
   - *Cách xử lý:* Chuyển sang tài khoản **Ban Chủ nhiệm (BCN)** để hoàn tất chấm điểm và bấm **`Chốt và gửi thông báo`**.
6. **Trạng thái chờ phân ban (`Đã vào nhóm — Chờ phân ban`):**
   - *Nguyên nhân:* Màn hình hiển thị *"Ban Nhân sự đang sắp xếp vị trí phân ban phù hợp cho bạn..."*.
   - *Cách xử lý:* Chuyển sang tài khoản **Ban Nhân sự (BNS)** tại tab **`4. Phân công 3 Ban (AI gợi ý)`** và bấm **`Chốt phân công và gửi`**.
7. **Thông báo lỗi khi nộp đơn lúc đợt tuyển đã đóng: *"Đợt tuyển dụng hiện đang đóng, không thể nhận thêm hồ sơ mới."***
   - *Cách xử lý:* Mở **`Cài đặt đợt tuyển`** (vai trò Quản trị viên), chuyển trạng thái đợt tuyển về `Đang mở đơn (open)` và lưu cài đặt.

---

## Vai trò 2: Ban Nhân sự (`hr` — BNS)

### 1. Công việc được thực hiện
Ban Nhân sự quản lý vòng hồ sơ, điều phối phân ban và quản trị mẫu thông báo thông qua **5 thẻ (tab) chức năng** cùng **2 nút mô phỏng bộ đếm thời gian (Timer)** trên thanh điều hướng BNS:
- **`1. Sheet Hồ sơ (<số lượng>)`**: Tra cứu, lọc, sắp xếp toàn bộ hồ sơ ứng viên, xem chi tiết lịch sử xử lý (`audit_logs`) và xuất tệp CSV.
- **`2. Duyệt hồ sơ còn lại (<số lượng>)`**: Xét duyệt thủ công các hồ sơ thuộc nhánh biên **`Cần xem xét (Vòng hồ sơ)`** ($50 \le \text{Điểm} < 75$).
- **`3. Hồ sơ cần được xem xét (<số lượng>)`**: Kiểm tra lại các hồ sơ **`Loại rõ (Sát ngưỡng - Chờ xem lại)`** ($45 \le \text{Điểm} < 50$) trước khi xác nhận từ chối hoặc cứu xét sang Đạt, đồng thời tra cứu danh sách hồ sơ không đạt vòng đơn đã ghi nhật ký.
- **`4. Phân công 3 Ban (AI gợi ý)`**: Xem gợi ý phân ban cho các ứng viên đã xác nhận tham gia (`confirmed_joined`), điều chỉnh ban theo nguyện vọng/chỉ tiêu còn lại và bấm chốt phân công chính thức.
- **`5. Mẫu thư và Ngưỡng`**: Xem **`Hộp thư đi mô phỏng (Outbox)`**, chỉnh sửa **`Ngưỡng sơ loại X, Y`** (`Ngưỡng Đạt rõ X`, `Ngưỡng Loại rõ Y`, `Biên độ sát Y`) và cập nhật **`Cấu hình 10 Mẫu thư Tự động`**.
- **2 nút mô phỏng thời gian trên thanh công cụ BNS:**
  - **`Timer +1 ngày (Nhắc lịch)`**
  - **`Timer +2 ngày (Quá hạn / Gạch tên)`**

---

### 2. Các bước thao tác theo thứ tự

#### Bước A — Tra cứu, lọc hồ sơ và xuất CSV tại tab `1. Sheet Hồ sơ`
1. Bấm tab **`1. Sheet Hồ sơ (<số lượng>)`**.
2. Sử dụng thanh công cụ lọc phía trên bảng:
   - Ô tìm kiếm **`Tìm họ tên, MSSV, lớp, email...`**
   - Menu **`Tất cả trạng thái`** (lọc theo từng trạng thái như `Cần bổ sung hồ sơ`, `Cần xem xét (Vòng hồ sơ)`, `Chờ đặt lịch phỏng vấn`...)
   - Menu **`Tất cả các Ban`** (`Ban Truyền thông`, `Ban Nhân sự`, `Ban Kinh doanh`)
   - Ô **`Điểm ≥ ...`** và menu sắp xếp (`Mới nộp nhất`, `Điểm sơ loại (Cao → Thấp)`, `Điểm sơ loại (Thấp → Cao)`, `Họ tên (A → Z)`).
3. Bấm nút **`Chi tiết`** ở cuối dòng của một ứng viên để mở cửa sổ xem đầy đủ thông tin, điểm sơ loại và **`Lịch sử xử lý hồ sơ (<số lượng>)`**, sau đó bấm nút **`X`** ở góc phải trên để đóng.
4. *(Tùy chọn)* Tích chọn từng dòng (hoặc tích ô chọn tất cả ở tiêu đề cột) rồi bấm **`Xuất CSV (<số dòng chọn> / Tất cả)`** để tải tệp `.csv` về máy.

#### Bước B — Xét duyệt hồ sơ nhánh biên tại tab `2. Duyệt hồ sơ còn lại`
1. Bấm tab **`2. Duyệt hồ sơ còn lại (<số lượng>)`** (ví dụ với bộ dữ liệu mẫu có sẵn `C05` và `C06`).
2. Đọc thông tin **`Kinh nghiệm hoạt động:`**, **`Câu hỏi tự luận:`** và **`Điểm hồ sơ: <x>đ`** của từng ứng viên.
3. Nhập nhận xét vào ô **`Nhập lý do duyệt Đạt / Không đạt (Bắt buộc)...`** (tối thiểu 3 ký tự).
4. Bấm một trong hai nút:
   - **`Duyệt ĐẠT (Gửi link PV)`**: Cho phép ứng viên qua vòng đơn và gửi lời mời đặt lịch phỏng vấn.
   - **`Không đạt (Gửi thư loại)`**: Từ chối hồ sơ ở vòng đơn và gửi thư phản hồi.

#### Bước C — Xử lý hồ sơ sát ngưỡng $Y$ tại tab `3. Hồ sơ cần được xem xét`
1. Bấm tab **`3. Hồ sơ cần được xem xét (<số lượng>)`** (ví dụ với bộ dữ liệu mẫu có sẵn `C08` đạt `47đ`, sát ngưỡng $Y = 50$đ).
2. Với từng hồ sơ trong danh sách, chọn một trong hai thao tác:
   - Bấm **`Cứu xét sang ĐẠT (Gửi link PV)`** nếu đánh giá nội dung tự luận/kinh nghiệm phù hợp và muốn trao cơ hội phỏng vấn.
   - Bấm **`Chốt Loại & Gửi thông báo không đạt`** nếu xác nhận giữ nguyên kết quả loại.
3. Hoặc nếu muốn xác nhận từ chối đồng loạt toàn bộ hồ sơ sát ngưỡng đang chờ, bấm nút **`Chốt & Gửi thông báo tất cả (<số lượng> hồ sơ)`** ở góc phải tiêu đề.
4. Ở bảng phía dưới **`Danh sách Hồ sơ không đạt vòng đơn đã ghi nhật ký (<số lượng>)`** (ví dụ `C07` và các hồ sơ vừa chốt loại), bấm **`Xem nhật ký điểm & lý do loại`** để kiểm tra lại lịch sử chấm và lý do từ chối.

#### Bước D — Kích hoạt bộ đếm nhắc lịch (1 ngày) và quá hạn (2 ngày)
1. Khi muốn kiểm thử nhánh tự động nhắc đặt lịch sau 1 ngày (mà không cần chờ 24 giờ thực), bấm nút **`Timer +1 ngày (Nhắc lịch)`** ở góc phải thanh tab BNS.
2. Khi muốn kiểm thử nhánh tự động loại hồ sơ quá hạn bổ sung hoặc quá hạn đặt lịch sau 2 ngày, bấm nút **`Timer +2 ngày (Quá hạn / Gạch tên)`**.

#### Bước E — Phân công ban cho CTV mới tại tab `4. Phân công 3 Ban (AI gợi ý)`
1. Sau khi ứng viên trúng tuyển đã bấm **`Xác nhận tham gia C-RES`** (hồ sơ ở trạng thái `Đã vào nhóm — Chờ phân ban`), chuyển sang tab **`4. Phân công 3 Ban (AI gợi ý)`**.
2. Quan sát 3 thẻ chỉ tiêu của `Ban Truyền thông`, `Ban Nhân sự`, `Ban Kinh doanh` (hiển thị **`Đã chốt: <x>/<quota>`**, **`Còn nhận: <y>`**, **`Đang chờ duyệt vào ban: <z> bạn`**).
3. *(Tùy chọn)* Bấm nút **`Cập nhật gợi ý phân ban`** để hệ thống chạy lại gợi ý từ AI (hoặc thuật toán dự phòng) dựa trên điểm phỏng vấn, nguyện vọng 1/2 và chỉ tiêu còn lại.
4. Tại cột **`HR Chọn Ban Chốt`** của từng ứng viên, kiểm tra hoặc chọn lại ban muốn phân công từ menu thả xuống (`<Tên Ban> (Còn <y> chỗ)`).
5. Bấm nút màu xanh **`Chốt phân công và gửi (<số lượng> CTV)`**.

#### Bước F — Kiểm tra Outbox và chỉnh sửa Mẫu thư / Ngưỡng $X, Y$ tại tab `5. Mẫu thư và Ngưỡng`
1. Bấm tab **`5. Mẫu thư và Ngưỡng`**.
2. **Cột trái (`Hộp thư đi mô phỏng (Outbox)`):** Quan sát toàn bộ thông báo đã gửi kèm người nhận, mã mẫu thư (`template_key`) và nội dung chi tiết. Bấm **`Làm mới`** để cập nhật danh sách mới nhất.
3. **Cột phải:**
   - Điều chỉnh **`Ngưỡng Đạt rõ X:`**, **`Ngưỡng Loại rõ Y:`**, **`Biên độ sát Y:`**.
   - Chọn mẫu thư trong menu **`Chọn mẫu thư:`**, chỉnh sửa **`Tiêu đề thư (Subject):`** và **`Nội dung thư (Body):`** (hỗ trợ các biến `{{full_name}}`, `{{link}}`, `{{deadline}}`, `{{department}}`).
   - Bấm nút **`Lưu Mẫu thư & Ngưỡng X, Y`**.

---

### 3. Kết quả cần quan sát sau mỗi bước

| Sau thao tác của BNS | Kết quả cần quan sát trên giao diện |
| :--- | :--- |
| **Bấm `Duyệt ĐẠT (Gửi link PV)` ở tab 2 (hoặc `Cứu xét sang ĐẠT` ở tab 3)** | Hiện thông báo xanh: *"Đã duyệt hồ sơ ĐẠT và gửi thư mời chọn lịch phỏng vấn đến bạn ứng viên!"*; hồ sơ biến mất khỏi danh sách chờ duyệt, chuyển sang trạng thái **`Chờ đặt lịch phỏng vấn`** và phát sinh thư `interview_invitation` trong Outbox. |
| **Bấm `Không đạt (Gửi thư loại)` ở tab 2 (hoặc `Chốt Loại & Gửi thông báo không đạt` / `Chốt & Gửi thông báo tất cả` ở tab 3)** | Hồ sơ chuyển sang trạng thái kết thúc **`Hồ sơ không đạt`**, di chuyển xuống bảng **`Danh sách Hồ sơ không đạt vòng đơn đã ghi nhật ký`** và phát sinh thư cảm ơn `rejected_docs` trong Outbox. |
| **Bấm `Timer +1 ngày (Nhắc lịch)`** | Hiện thông báo xanh: *"Đã chạy Timer +1 ngày: Quá hạn bổ sung (<x>), Nhắc đặt lịch 1 ngày (<y>), Gạch tên quá 2 ngày (<z>)."* Các hồ sơ đang ở `Chờ đặt lịch phỏng vấn` quá 1 ngày được gửi đúng 1 thư `interview_reminder` vào Outbox. |
| **Bấm `Timer +2 ngày (Quá hạn / Gạch tên)`** | Các hồ sơ đang ở `Cần bổ sung hồ sơ` quá 2 ngày chuyển sang **`Bị loại vì quá hạn`**; các hồ sơ đang ở `Chờ đặt lịch phỏng vấn` quá 2 ngày chuyển sang **`Ứng viên không tham gia`**. |
| **Bấm `Chốt phân công và gửi (<số lượng> CTV)` ở tab 4** | Hiện thông báo xanh: *"Đã chốt phân ban và gửi thư chào mừng chính thức đến <n> Cộng tác viên mới..."*; chỉ số **`Đã chốt`** của ban tương ứng tăng lên và **`Còn nhận`** giảm đi; ứng viên chuyển từ bảng chờ xuống khung **`Danh sách CTV đã chốt phân công & hoàn tất quy trình`** với trạng thái **`Hoàn tất quy trình tuyển CTV`**. |
| **Bấm `Lưu Mẫu thư & Ngưỡng X, Y` ở tab 5** | Hiện thông báo xanh: *"Đã lưu Mẫu thư thông báo và Ngưỡng sơ loại (X = ...đ, Y = ...đ, biên độ = ...đ)."* |

---

### 4. Cách xử lý những trạng thái chờ hoặc thông báo lỗi hiện có

1. **Thông báo lỗi khi duyệt hồ sơ ở tab 2: *"Bạn vui lòng nhập ghi chú nhận xét (tối thiểu 3 ký tự) trước khi xác nhận kết quả nhé."***
   - *Nguyên nhân:* Ô **`Nhập lý do duyệt Đạt / Không đạt (Bắt buộc)...`** của ứng viên đang để trống hoặc ngắn hơn 3 ký tự.
   - *Cách xử lý:* Nhập lý do cụ thể (ví dụ: `"Đạt yêu cầu phỏng vấn"` hoặc `"Chưa phù hợp định hướng đợt này"`) rồi bấm lại nút duyệt.
2. **Tab `4. Phân công 3 Ban (AI gợi ý)` hiển thị *"Hiện không có ứng viên nào đang chờ phân ban."***
   - *Nguyên nhân:* Chỉ những ứng viên ở trạng thái **`Đã vào nhóm — Chờ phân ban` (`confirmed_joined`)** mới xuất hiện tại bảng chờ phân ban. Nếu ứng viên vừa được BCN chốt đậu (`offer_sent`) nhưng chưa bấm xác nhận tham gia, ứng viên đó chưa thể được phân ban.
   - *Cách xử lý:* Chuyển sang tài khoản ứng viên tương ứng và bấm nút **`Xác nhận tham gia C-RES`**, sau đó quay lại tab 4 của BNS.
3. **Thẻ chỉ tiêu ban chuyển sang nền đỏ hoặc báo lỗi khi chốt phân công: *"Vượt quá chỉ tiêu..."* / *"Chưa thể chốt phân công: Tất cả các ban hiện đã hết chỉ tiêu nhận CTV..."***
   - *Nguyên nhân:* Số lượng ứng viên đang được chọn vào một ban lớn hơn số chỗ **`Còn nhận`** (`remainingQuota`) của ban đó, hoặc cả 3 ban đã hết chỉ tiêu (`remainingQuota = 0`).
   - *Cách xử lý:* Dùng menu ở cột **`HR Chọn Ban Chốt`** để chuyển bớt ứng viên sang ban còn chỉ tiêu (ví dụ Ban Nguyện vọng 2), hoặc vào màn hình **`Cài đặt đợt tuyển`** (vai trò Quản trị viên) để tăng chỉ tiêu (`quota`) cho ban.
4. **Thông báo lỗi khi lưu Ngưỡng sơ loại ở tab 5: *"Ngưỡng Đạt rõ (X) phải lớn hơn Ngưỡng Loại rõ (Y)."***
   - *Cách xử lý:* Đảm bảo nhập giá trị $X > Y$ và $0 \le Y < X \le 100$ (mặc định chuẩn của đợt tuyển là $X = 75, Y = 50$, biên độ $= 5$).

---

## Vai trò 3: Ban Chủ nhiệm (`board` — BCN)

### 1. Công việc được thực hiện
Ban Chủ nhiệm phụ trách tổ chức lịch phỏng vấn, điểm danh, chấm phiếu điểm và quyết định kết quả tuyển chọn thông qua **3 thẻ (tab) chức năng** và nút chốt kết quả trên cổng **BCN Chấm điểm & Xét tuyển**:
- **`1. Chờ chấm điểm xét tuyển (<số lượng>)`**: Danh sách các ứng viên đã đặt lịch hoặc đang phỏng vấn (`booked`, `interviewing`, `scored`) chưa có quyết định Đậu/Rớt. Hỗ trợ **Check-in** và **Chấm phiếu** song song độc lập (**AND-join**).
- **`2. Đã có kết quả (<số lượng>)`**: Danh sách các ứng viên đã được BCN chọn **`Đã đậu`** hoặc **`Đã loại`**, hỗ trợ lọc theo kết quả (`Tất cả`, `Đã đậu`, `Đã loại`), xem lại phiếu điểm, hoàn tác về danh sách chờ chấm (`Đưa về Chờ chấm`), hoặc chốt gửi thông báo cho từng người.
- **`3. Lịch phỏng vấn theo ca (<số lượng> ca)`**: Theo dõi sĩ số từng ca phỏng vấn (`Tổng`, `Đã đặt`, `Dự trữ`, `Trống`, `Chờ chấm`), tạo khung giờ phỏng vấn mới và thực hiện Check-in / Chấm điểm trực tiếp theo ca.
- **Nút `Chốt và gửi thông báo (<số lượng> bạn)` / `Xem trước & Gửi kết quả (<số lượng> bạn)`**: Mở hộp thoại kiểm tra danh sách lần cuối trước khi phát hành thông báo kết quả phỏng vấn hàng loạt.

---

### 2. Các bước thao tác theo thứ tự

#### Bước A — Quản lý ca phỏng vấn và tạo khung giờ mới tại tab `3. Lịch phỏng vấn theo ca`
1. Bấm tab **`3. Lịch phỏng vấn theo ca (<số lượng> ca)`**.
2. Kiểm tra thông tin từng ca phỏng vấn: thời gian bắt đầu – kết thúc, tên/địa điểm ca (như `DEMO_FULL_A`, `DEMO_FULL_B`, `DEMO_FULL_C` hoặc các phòng phỏng vấn), chỉ số **`Tổng: <x> ghế · Đã đặt: <y> · Dự trữ: <z> · Trống: <t>`** và danh sách ứng viên đang chờ chấm trong ca.
3. *(Tùy chọn — Tạo ca mới)*:
   - Bấm nút **`Tạo khung giờ phỏng vấn mới`** ở góc phải.
   - Trong hộp thoại **`Tạo khung giờ phỏng vấn mới`**, điền **`Thời gian bắt đầu:`**, **`Thời gian kết thúc:`**, **`Địa điểm phòng hoặc Link Google Meet:`** và **`Sức chứa tối đa (số ứng viên):`**.
   - Bấm **`Tạo khung giờ`**.

#### Bước B — Thực hiện Check-in điểm danh và Chấm phiếu điểm (Song song độc lập)
BCN có thể thao tác tại tab **`1. Chờ chấm điểm xét tuyển`** hoặc ngay trên từng ca ở tab **`3. Lịch phỏng vấn theo ca`** theo bất kỳ thứ tự nào (Check-in trước hoặc Chấm phiếu trước đều được):

1. **Nhánh 1 — Điểm danh ứng viên (`Check-in`):**
   - Trên dòng của ứng viên chưa điểm danh, bấm nút **`Check-in`** (hoặc bấm nút **`Check-in ngay`** bên trong cửa sổ phiếu chấm điểm).
2. **Nhánh 2 — Chấm phiếu điểm phỏng vấn (`Chấm phiếu` / `Chấm điểm`):**
   - Bấm nút **`Chấm phiếu`** (ở tab 1) hoặc **`Chấm điểm`** (ở tab 3) trên dòng của ứng viên để mở hộp thoại **`Phiếu chấm điểm phỏng vấn: <Họ và tên>`**.
   - Nhập điểm (từ `0` đến `10`, bước nhảy `0.5`) cho 5 tiêu chí trọng số:
     1. `Thái độ & Mức độ cam kết đồng hành` (`25%`)
     2. `Kỹ năng chuyên môn theo Ban ứng tuyển` (`25%`)
     3. `Tư duy xử lý tình huống thực tế` (`20%`)
     4. `Kỹ năng giao tiếp & Làm việc nhóm` (`15%`)
     5. `Sự phù hợp với văn hóa Câu lạc bộ Thương mại C-RES` (`15%`)
   - Quan sát dòng **`Hệ thống tự cộng điểm (theo trọng số): <xx.xx> / 100đ`** và số chỗ còn nhận của Ban Nguyện vọng 1. *(Lưu ý: Nếu nhập `0` cho tất cả tiêu chí, hệ thống giữ nguyên đúng `0.00 / 100đ`).*
   - Nhập ghi chú vào ô **`Nhận xét thái độ & năng lực của ứng viên:`**.
   - Chọn một trong các nút ở cuối hộp thoại:
     - **`Chỉ lưu điểm`**: Lưu phiếu chấm điểm (dùng khi ứng viên chưa Check-in, hoặc khi cần chờ thêm phiếu chấm thứ 2, hoặc muốn lưu điểm trước rồi mới xét chọn sau).
     - **`Lưu & Duyệt Đậu`**: Lưu phiếu điểm và chuyển ngay ứng viên sang trạng thái Đã chọn Đậu (chỉ mở khi ứng viên đã Check-in).
     - **`Lưu & Chọn Rớt`**: Lưu phiếu điểm và chuyển ngay ứng viên sang trạng thái Đã chọn Rớt (chỉ mở khi ứng viên đã Check-in).

#### Bước C — Xét chọn Đậu / Rớt trên bảng tổng hợp
1. Tại tab **`1. Chờ chấm điểm xét tuyển`**, khi ứng viên đã hội tụ đủ 2 điều kiện (`Check-in: Đã có mặt` và `Phiếu chấm: <đủ số phiếu tối thiểu>`), trạng thái hiển thị **`Chờ BCN quyết định Đậu/Rớt`**.
2. Bấm nút **`Chọn Đậu`** (màu xanh lá) hoặc **`Chọn Rớt`** (màu đỏ) ở cột `Thao tác xét tuyển`.
3. Nếu muốn điều chỉnh lại quyết định trước khi gửi thông báo:
   - Mở tab **`2. Đã có kết quả (<số lượng>)`**.
   - Dùng bộ lọc **`Tất cả`**, **`Đã đậu`**, **`Đã loại`** để tìm ứng viên.
   - Bấm nút **`Đưa về Chờ chấm`** để chuyển ứng viên quay lại tab **`1. Chờ chấm điểm xét tuyển`**, hoặc bấm **`Xem phiếu điểm`** để sửa điểm.

#### Bước D — Xem trước, chốt kết quả và gửi thông báo cho ứng viên
1. Khi đã có ứng viên ở trạng thái `Đã chọn Đậu (Chờ chốt gửi TB)` hoặc `Đã chọn Rớt (Chờ chốt gửi TB)`, bấm nút **`Chốt và gửi thông báo (<số lượng> bạn)`** (hoặc **`Xem trước & Gửi kết quả (<số lượng> bạn)`** trên thanh tab).
2. Trong hộp thoại **`Xác nhận gửi thông báo kết quả phỏng vấn`**, kiểm tra lại danh sách ứng viên, điểm tổng hợp và nhãn **`GỬI THƯ ĐẬU`** / **`GỬI THƯ RỚT`**.
3. Bấm nút **`Chốt và gửi (<số lượng> thông báo)`** (hoặc bấm nút **`Chốt & Gửi TB`** trên từng dòng ứng viên ở tab **`2. Đã có kết quả`** nếu muốn gửi lẻ từng người).

---

### 3. Kết quả cần quan sát sau mỗi bước

| Sau thao tác của BCN | Kết quả cần quan sát trên giao diện |
| :--- | :--- |
| **Bấm `Tạo khung giờ`** | Hiện thông báo xanh: *"Đã tạo khung giờ phỏng vấn mới thành công."*; ca mới xuất hiện ngay trong tab **`3. Lịch phỏng vấn theo ca`** và trên màn hình chọn lịch của Ứng viên. |
| **Bấm `Check-in` (khi chưa chấm phiếu) HOẶC bấm `Chỉ lưu điểm` (khi chưa Check-in)** | Trạng thái ứng viên chuyển sang **`Đang phỏng vấn (Song song)`**. Cột `Điểm danh & Phiếu chấm` cập nhật phần tương ứng (`Check-in: Đã có mặt` hoặc `Phiếu chấm: 1/1 phiếu`), nhưng hai nút **`Chọn Đậu`** / **`Chọn Rớt`** vẫn bị khóa mờ cho đến khi hoàn thành cả hai nhánh. |
| **Hoàn tất cả `Check-in` VÀ đủ số `Phiếu chấm` tối thiểu** | Cổng hội tụ song song (`AND-join`) kích hoạt: trạng thái ứng viên tự động chuyển sang **`Chờ BCN quyết định Đậu/Rớt`**; hai nút **`Chọn Đậu`** và **`Chọn Rớt`** sáng lên sẵn sàng cho BCN bấm. |
| **Bấm `Chọn Đậu` / `Lưu & Duyệt Đậu` (hoặc `Chọn Rớt` / `Lưu & Chọn Rớt`)** | Ứng viên lập tức được chuyển từ tab **`1. Chờ chấm điểm xét tuyển`** sang tab **`2. Đã có kết quả`** với trạng thái **`Đã chọn Đậu (Chờ chốt gửi TB)`** (hoặc **`Đã chọn Rớt (Chờ chốt gửi TB)`**); bộ đếm trên nút **`Chốt và gửi thông báo (<n> bạn)`** tăng lên. |
| **Bấm `Đưa về Chờ chấm` ở tab 2** | Ứng viên quay trở lại tab **`1. Chờ chấm điểm xét tuyển`** ở trạng thái **`Chờ BCN quyết định Đậu/Rớt`**. |
| **Bấm `Chốt và gửi (<n> thông báo)` (hoặc `Chốt & Gửi TB`)** | Hiện thông báo xanh: *"Đã chốt kết quả và gửi thông báo thành công cho <n> ứng viên (<x> Đậu, <y> Rớt)!"*:<br>• Ứng viên Đậu chuyển sang trạng thái **`Đã đậu — Chờ xác nhận vào nhóm`** và nhận thư `interview_pass_offer`.<br>• Ứng viên Rớt chuyển sang trạng thái kết thúc **`Ứng viên không đạt (Rớt PV)`** và nhận thư `interview_fail`. |

---

### 4. Cách xử lý những trạng thái chờ hoặc thông báo lỗi hiện có

1. **Hai nút `Chọn Đậu` / `Chọn Rớt` (hoặc `Lưu & Duyệt Đậu` / `Lưu & Chọn Rớt`) bị khóa mờ không bấm được:**
   - *Nguyên nhân:* Theo quy tắc hội tụ song song (`AND-join`), Ban Chủ nhiệm chỉ được phép ra quyết định khi ứng viên **đã Check-in (`Đã có mặt`)** **VÀ** **đã có đủ số phiếu chấm điểm tối thiểu (`min_scorecards_per_interview`)**.
   - *Cách xử lý:*
     - Nếu dòng trạng thái báo `Check-in: Chưa check-in`: Bấm nút **`Check-in`** trên dòng đó (hoặc nút **`Check-in ngay`** trong modal chấm điểm).
     - Nếu dòng trạng thái báo `Phiếu chấm: 0/1 phiếu` (hoặc `1/2 phiếu` khi cấu hình yêu cầu 2 phiếu): Bấm **`Chấm phiếu`** để nộp phiếu điểm từ giám khảo BCN thứ nhất / thứ hai (`bcn@cres.due.udn.vn` và `pho.bcn@cres.due.udn.vn`).
2. **Nút `Chốt và gửi thông báo (0 bạn)` bị khóa mờ:**
   - *Nguyên nhân:* Hiện chưa có ứng viên nào ở trạng thái chờ gửi thông báo (`Đã chọn Đậu (Chờ chốt gửi TB)` hoặc `Đã chọn Rớt (Chờ chốt gửi TB)`), hoặc tất cả ứng viên trong tab **`2. Đã có kết quả`** đều đã được gửi thông báo trước đó.
   - *Cách xử lý:* Chọn **`Chọn Đậu`** hoặc **`Chọn Rớt`** cho ít nhất 1 ứng viên ở tab 1 trước khi bấm chốt và gửi.
3. **Thông báo lỗi khi tạo khung giờ phỏng vấn mới: *"Thời gian kết thúc phải lớn hơn thời gian bắt đầu."* hoặc *"Thời gian bắt đầu hoặc kết thúc không hợp lệ."***
   - *Cách xử lý:* Kiểm tra lại ô **`Thời gian bắt đầu:`** và **`Thời gian kết thúc:`** sao cho giờ kết thúc diễn ra sau giờ bắt đầu và `Sức chứa tối đa` $\ge 1$.
