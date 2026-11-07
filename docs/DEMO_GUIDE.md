# Hướng Dẫn Kịch Bản Demo Quy Trình Tuyển CTV Theo 6 Ngày Giả Lập (`docs/DEMO_GUIDE.md`)

Tài liệu này hướng dẫn chi tiết kịch bản trình diễn (demo) và quay video kiểm thử toàn diện hệ thống **C-RES Recruit — Câu lạc bộ Thương mại C-RES (Đại học Kinh tế - Đại học Đà Nẵng)** theo trục thời gian **6 ngày giả lập (`Ngày 1` $\rightarrow$ `Ngày 6`)**.

Toàn bộ tên màn hình, thẻ (tab), nút bấm, vai trò, mã ứng viên (`C01`–`C17`), ca phỏng vấn (`DEMO_FULL_A`, `DEMO_FULL_B`, `DEMO_FULL_C`) và trạng thái đều khớp chính xác với mã nguồn hiện tại (`src/`, `server/`).

---

## Nguyên tắc quan trọng khi chạy Demo & Đối chiếu kết quả

1. **Thời hạn tính từ thời điểm xảy ra sự kiện của từng hồ sơ (Event-relative Timers):**
   - **Hạn bổ sung hồ sơ (`supplement_deadline_at`):** Tính bằng `Thời điểm phát hiện thiếu thông tin` + `2 ngày` (`supplement_deadline_days = 2`, tối đa `2` lần bổ sung).
   - **Mốc gửi thư nhắc đặt lịch (`remind_after_days`):** Tính bằng `Thời điểm gửi lời mời đặt lịch (schedule_link_sent_at)` + `1 ngày` (chỉ nhắc đúng 1 lần khi chưa đặt lịch).
   - **Hạn đặt lịch phỏng vấn (`schedule_deadline_at`):** Tính bằng `Thời điểm gửi lời mời đặt lịch (schedule_link_sent_at)` + `2 ngày` (`unbook_after_days = 2`).
   - *Hệ quả thực tế:* Hồ sơ nhận link đặt lịch ở **Ngày 1 (`T0`)** sẽ nhận lời nhắc ở **Ngày 2 (`T0 + 1 ngày`)** và quá hạn ở **Ngày 3 (`T0 + 2 ngày`)**. Ngược lại, hồ sơ mới bổ sung đủ hoặc mới được BNS duyệt Đạt ở **Ngày 2 (`T0 + 1 ngày`)** sẽ có `schedule_link_sent_at = T0 + 1 ngày`, nên hạn đặt lịch của hồ sơ đó kéo dài tới **Ngày 4 (`T0 + 3 ngày`)**.
2. **Phân biệt Kết quả mong đợi vs Kết quả kiểm thử thực tế:**
   - Trong mỗi bước bên dưới, tài liệu tách rõ **Kết quả mong đợi (theo thiết kế quy trình To-Be)** và **Kết quả thực tế trên hệ thống (theo cài đặt mã nguồn hiện tại)**, đồng thời chỉ rõ những giới hạn hoặc nhánh chưa tách riêng.

---

## Phần 0: Chuẩn bị trước khi bấm máy

### 0.1. Tài khoản 3 vai trò và 2 người chấm phỏng vấn (BCN)

| Vai trò nghiệp vụ | Cách truy cập trên màn hình đăng nhập | Tài khoản tương ứng trong hệ thống |
| :--- | :--- | :--- |
| **Quản trị viên (`admin`)** | Mở **`Dành cho Ban tổ chức / Nội bộ CLB (BNS, BCN)`** $\rightarrow$ bấm **`Tổng quan đợt tuyển`** hoặc **`Cài đặt đợt tuyển`** | `admin@cres.due.udn.vn` |
| **Ban Nhân sự (`hr` — BNS)** | Mở **`Dành cho Ban tổ chức / Nội bộ CLB (BNS, BCN)`** $\rightarrow$ bấm **`Ban Nhân sự (BNS)`** | `hr@cres.due.udn.vn` (Lê Hoàng Bảo Trân — Trưởng Ban Nhân sự) |
| **Ban Chủ nhiệm — Giám khảo 1 (`board` — BCN 1)** | Mở **`Dành cho Ban tổ chức / Nội bộ CLB (BNS, BCN)`** $\rightarrow$ bấm **`Ban Chủ nhiệm (BCN)`** (hoặc đăng nhập qua form) | `bcn@cres.due.udn.vn` (Nguyễn Đức Thịnh — Chủ nhiệm CLB) |
| **Ban Chủ nhiệm — Giám khảo 2 (`board` — BCN 2)** | Đăng nhập qua form **`Đăng nhập Ứng viên`** bằng email nội bộ của Phó Chủ nhiệm | `pho.bcn@cres.due.udn.vn` (Phạm Ngọc Khánh Linh — Phó Chủ nhiệm) |
| **Ứng viên mẫu (`candidate` — `C01`..`C17`)** | Bấm **`Tra cứu Hồ sơ Ứng viên`** ở cột trái màn hình đăng nhập (hoặc đăng nhập qua form) | `qa.cres.01@example.com` $\rightarrow$ `qa.cres.17@example.com` |

### 0.2. Kiểm tra dữ liệu demo và cấu hình thời hạn / phiếu chấm

| Hạng mục chuẩn bị | Thao tác kiểm tra trên giao diện | Cấu hình chuẩn cần quan sát |
| :--- | :--- | :--- |
| **1. Bộ dữ liệu 17 ứng viên mẫu (`C01`–`C17`) & 3 ca phỏng vấn** | Đăng nhập **`Tổng quan đợt tuyển`** (hoặc **`Cài đặt đợt tuyển`**). Nếu cần khởi tạo mới từ đầu trước khi quay: bấm **`Đặt lại đợt tuyển trống (0 hồ sơ)`** $\rightarrow$ **`Đồng ý`**, sau đó bấm **`Nạp dữ liệu mẫu (17 ứng viên)`** $\rightarrow$ **`Đồng ý`**. *(Nếu dữ liệu đã nạp sẵn thì giữ nguyên, không bấm đặt lại).* | • **17 tài khoản ứng viên mẫu (`C01`–`C17`)**.<br>• **16 đơn ứng tuyển đã nộp** (`C01`–`C12`, `C14`–`C17`) tại mốc **`T0`**.<br>• **01 tài khoản chưa nộp đơn (`C13`)**.<br>• 3 ca phỏng vấn rơi vào Ngày 4 (`T0 + 74h..79h`):<br>  - `DEMO_FULL_A`: Tổng `6`, Dự trữ `0`, Trống **`6/6`**.<br>  - `DEMO_FULL_B`: Tổng `6`, Dự trữ `4`, Trống **`2/6`**.<br>  - `DEMO_FULL_C`: Tổng `6`, Dự trữ `5`, Trống **`1/6`**. |
| **2. Cấu hình ngưỡng, thời hạn và 2 phiếu chấm tối thiểu** | Vào **`Cài đặt đợt tuyển`** (`Cài đặt thông số đợt tuyển & Chỉ tiêu các Ban`):<br>• Kiểm tra `Điểm chuẩn qua vòng hồ sơ`: **`75`**, `Điểm sàn tối thiểu vòng hồ sơ`: **`50`**, `Biên độ điểm xem xét lại`: **`5`**.<br>• Kiểm tra `Thời hạn bổ sung hồ sơ (ngày)`: **`2`**, `Thời gian gửi nhắc đặt lịch (ngày)`: **`1`**, `Thời hạn đặt lịch phỏng vấn (ngày)`: **`2`**.<br>• Để kiểm thử yêu cầu **đủ 2 phiếu chấm ở Ngày 4**, đặt ô **`Số phiếu chấm tối thiểu / ứng viên:`** = **`2`** rồi bấm **`Lưu toàn bộ cấu hình`**. | Thông báo xanh: *"Đã lưu thông tin cài đặt đợt tuyển và chỉ tiêu của 3 Ban thành công!"*<br>Chỉ tiêu 3 Ban: `Ban Truyền thông` (`8`), `Ban Nhân sự` (`7`), `Ban Kinh doanh` (`7`). |

---

## Ngày 1 (Mốc `T0`): Nộp hồ sơ, chia nhánh tự động, chọn lịch, thử ca đầy và rút trước phân công

### Bước 1.1 — Ứng viên `C13` tự nộp hồ sơ và kiểm tra kết quả chia nhánh của 17 ứng viên
- **Vai trò thao tác:** Ứng viên (`candidate`) $\rightarrow$ sau đó chuyển sang Ban Nhân sự (`hr`).
- **Ứng viên minh họa:**
  - `C13` (`TEST 13 Duc Son` — `qa.cres.13@example.com`): Tài khoản duy nhất chưa nộp đơn khi nạp mẫu.
  - Đối chiếu toàn bộ `C01`–`C17` trên bảng `1. Sheet Hồ sơ` của BNS.
- **Thao tác:**
  1. Tại màn hình đăng nhập, bấm **`Tra cứu Hồ sơ Ứng viên`** $\rightarrow$ chọn **`TEST 13 Duc Son`** (nhãn `Chưa nộp đơn`).
  2. Quan sát biểu mẫu **`Đơn Đăng Ký Ứng Tuyển Cộng Tác Viên Câu lạc bộ Thương mại C-RES`** đã được nạp sẵn thông tin nháp của `C13`, bấm nút **`Gửi đơn ứng tuyển`**.
  3. Bấm **`Đổi tài khoản`** $\rightarrow$ vào **`Ban Nhân sự (BNS)`** $\rightarrow$ mở tab **`1. Sheet Hồ sơ (17)`**.
- **Kết quả mong đợi vs Kết quả thực tế:**
  - *Kết quả mong đợi:* Hệ thống tự động kiểm tra đủ 8 trường bắt buộc và chia hồ sơ vào đúng các nhánh: thiếu thông tin (`needs_supplement`), đạt rõ (`invited_to_book`), cần xem xét (`needs_review`), loại rõ sát ngưỡng (`clear_fail` với `is_near_threshold = 1`) và loại rõ xa ngưỡng (`rejected_docs`).
  - *Kết quả thực tế trên hệ thống:* Khớp 100%:
    - **Thiếu thông tin (`Cần bổ sung hồ sơ` — hạn `2 ngày`):** `C02` (thiếu `phone`), `C03` (thiếu `essay`), `C04` (thiếu `phone`).
    - **Đạt rõ (`Chờ đặt lịch phỏng vấn` — `100đ` $\ge 75$đ, hạn đặt lịch `2 ngày`):** `C01`, `C09`, `C10`, `C11`, `C12`, `C13` (vừa nộp), `C14`, `C15`, `C16`, `C17`.
    - **Cần xem xét (`Cần xem xét (Vòng hồ sơ)` — `63đ` $\in [50, 75)$):** `C05`, `C06`.
    - **Loại rõ sát ngưỡng $Y$ (`Loại rõ (Sát ngưỡng - Chờ xem lại)` — `47đ` $\in [45, 50)$):** `C08`.
    - **Loại rõ xa ngưỡng $Y$ (`Hồ sơ không đạt` — `35đ` $< 45$):** `C07` (tự động kết thúc quy trình và gửi thư cảm ơn vào Outbox).
  - *Giới hạn trong mã nguồn:* Đối với `C13`, hệ thống không có công tắc giả lập lỗi hạ tầng khi gửi link đặt lịch; do đó khi `C13` bấm `Gửi đơn ứng tuyển` với hồ sơ đạt `100đ`, hệ thống lập tức gửi lời mời đặt lịch thành công (`invited_to_book`) trong cùng giao dịch.
- **Bằng chứng cần lưu:**
  - Ảnh chụp màn hình `C13` trước và ngay sau khi bấm **`Gửi đơn ứng tuyển`**.
  - Ảnh chụp tab **`1. Sheet Hồ sơ (17)`** của BNS thể hiện đủ 5 nhóm trạng thái sau sơ loại.

---

### Bước 1.2 — Chọn lịch phỏng vấn, thử ca đầy (`DEMO_FULL_C`, `DEMO_FULL_B`) và hủy/đổi chỗ
- **Vai trò thao tác:** Ứng viên (`candidate`).
- **Ứng viên minh họa:**
  - `C01` (`TEST 01 Minh An`): Đặt ghế trống duy nhất của ca `DEMO_FULL_C` (`Còn 1/6 chỗ`).
  - `C09` (`TEST 09 Nhat Minh`): Thử nhìn/đặt vào `DEMO_FULL_C` khi đã đầy (`Còn 0/6 chỗ`), sau đó đặt sang `DEMO_FULL_B` (`Còn 2/6 chỗ` $\rightarrow$ `1/6`).
  - `C10` (`TEST 10 Thao Nhi`): Đặt ghế trống thứ 2 của `DEMO_FULL_B` (`Còn 1/6 chỗ` $\rightarrow$ `0/6`).
  - `C15`, `C16`, `C17`: Đặt lịch vào ca `DEMO_FULL_A` (`Còn 6/6 chỗ` $\rightarrow$ `3/6`).
- **Thao tác:**
  1. Đăng nhập `C01` $\rightarrow$ tại khung **`Chọn khung giờ phỏng vấn`**, quan sát 3 ca:
     - `DEMO_FULL_A`: `Còn 6/6 chỗ` (`Đã đặt: 0 · Dự trữ: 0 · Trống: 6`)
     - `DEMO_FULL_B`: `Còn 2/6 chỗ` (`Đã đặt: 0 · Dự trữ: 4 · Trống: 2`)
     - `DEMO_FULL_C`: `Còn 1/6 chỗ` (`Đã đặt: 0 · Dự trữ: 5 · Trống: 1`)
  2. Trên thẻ `DEMO_FULL_C`, bấm **`Chọn khung giờ này`**.
  3. Đổi sang tài khoản `C09` $\rightarrow$ quan sát thẻ `DEMO_FULL_C` hiện **`Còn 0/6 chỗ`** (`Đã đặt: 1 · Dự trữ: 5 · Trống: 0`) và nút bị khóa hiển thị **`Đã hết chỗ trống`** $\rightarrow$ bấm **`Chọn khung giờ này`** trên thẻ `DEMO_FULL_B`.
  4. *(Tùy chọn minh họa trả chỗ)*: Nếu bấm **`Hủy đặt lịch`** hoặc **`Đổi sang khung giờ này`**, ghế của ca cũ sẽ tăng lại `1` chỗ trống ngay lập tức.
  5. Lần lượt đăng nhập `C10` đặt vào `DEMO_FULL_B` (làm `DEMO_FULL_B` về `Còn 0/6 chỗ`), và đăng nhập `C15`, `C16`, `C17` đặt vào `DEMO_FULL_A`.
- **Kết quả mong đợi vs Kết quả thực tế:**
  - *Kết quả mong đợi:* Sức chứa khả dụng được tính từ backend theo công thức `Trống = Tổng (6) - Đã đặt - Dự trữ`; khi `Trống = 0`, ứng viên tiếp theo không thể đặt vào ca đó; ứng viên không nhìn thấy thông tin cá nhân của người đã đặt trước.
  - *Kết quả thực tế trên hệ thống:* Khớp 100%. Khi `C01` đặt `DEMO_FULL_C`, `available_seats` về `0`, nút trên màn hình của `C09` chuyển sang `Đã hết chỗ trống` (disabled) và API chặn `400 Bad Request` nếu gọi trực tiếp.
- **Bằng chứng cần lưu:**
  - Ảnh chụp màn hình chọn lịch của `C01` trước khi đặt (`DEMO_FULL_A` 6/6, `DEMO_FULL_B` 2/6, `DEMO_FULL_C` 1/6) và màn hình của `C09` khi `DEMO_FULL_C` hiển thị **`Còn 0/6 chỗ`** / **`Đã hết chỗ trống`**.

---

### Bước 1.3 — Ứng viên rút đơn trước khi phân công (Rút đơn sớm ở Ngày 1)
- **Vai trò thao tác:** Ứng viên (`candidate`).
- **Ứng viên minh họa:** `C14` (`TEST 14 Thu Trang` — đang ở trạng thái `Chờ đặt lịch phỏng vấn`).
- **Thao tác:**
  1. Đăng nhập tài khoản `C14` (`qa.cres.14@example.com`).
  2. *(Tùy chọn)* Đặt vào `DEMO_FULL_A` (số chỗ trống giảm từ `3/6` xuống `2/6`) để chứng minh rút đơn tự động trả lại ghế phỏng vấn.
  3. Trên thẻ **`Hồ sơ của tôi: TEST 14 Thu Trang`**, bấm nút màu đỏ **`Rút đơn ứng tuyển`**.
  4. Trong hộp thoại **`Xác nhận rút đơn ứng tuyển`**, nhập lý do: `"Em bị trùng lịch học quân sự đột xuất"` $\rightarrow$ bấm **`Xác nhận Rút đơn`**.
- **Kết quả mong đợi vs Kết quả thực tế:**
  - *Kết quả mong đợi:* Hồ sơ chuyển sang trạng thái kết thúc `Đã rút đơn` (`withdrawn`), hủy mọi bộ đếm hạn đang chạy và trả lại ghế phỏng vấn đã đặt.
  - *Kết quả thực tế trên hệ thống:* Khớp 100%. Nhãn trạng thái của `C14` chuyển thành **`Đã rút đơn`** kèm **`Kết thúc: Đã rút đơn`**, nút `Rút đơn ứng tuyển` ẩn đi, và số ghế trống của `DEMO_FULL_A` tăng trở lại `3/6`.
- **Bằng chứng cần lưu:**
  - Ảnh chụp hộp thoại **`Xác nhận rút đơn ứng tuyển`** và màn hình `C14` sau khi chuyển sang trạng thái **`Đã rút đơn`**.

---

## Ngày 2 (Mốc `T0 + 1 ngày`): Bổ sung hồ sơ, BNS xét duyệt, nhận lời nhắc 1 ngày và đặt lịch

### Bước 2.1 — Chuyển đồng hồ giả lập sang Ngày 2 (`+1 ngày`) & Kiểm tra lời nhắc đặt lịch
- **Vai trò thao tác:** Ban Nhân sự (`hr`).
- **Ứng viên minh họa:** `C11` (`TEST 11 Viet Phuc`) và `C12` (`TEST 12 Mai Quynh`) — hai ứng viên đã nhận lời mời đặt lịch từ Ngày 1 (`T0`) nhưng chưa chọn ca.
- **Thao tác:**
  1. Đăng nhập **`Ban Nhân sự (BNS)`**.
  2. Trên thanh điều hướng BNS, bấm nút **`Timer +1 ngày (Nhắc lịch)`**.
  3. Chuyển sang tab **`5. Mẫu thư và Ngưỡng`** để kiểm tra danh sách **`Hộp thư đi mô phỏng (Outbox)`**.
- **Kết quả mong đợi vs Kết quả thực tế:**
  - *Kết quả mong đợi:* Các hồ sơ ở trạng thái `invited_to_book` đã qua `1 ngày` kể từ `schedule_link_sent_at` và chưa đặt lịch sẽ nhận đúng 1 thư nhắc `interview_reminder`, vẫn giữ trạng thái `Chờ đặt lịch phỏng vấn` (vì hạn đặt lịch là `2 ngày`).
  - *Kết quả thực tế trên hệ thống:* Khớp 100%. Banner màu xanh hiển thị: *"Đã chạy Timer +1 ngày: Quá hạn bổ sung (0), Nhắc đặt lịch 1 ngày (...), Gạch tên quá 2 ngày (0)."* Trong Outbox xuất hiện thư nhắc đặt lịch gửi tới `C11` và `C12` (và `C13` nếu `C13` chưa đặt lịch). Nếu bấm kiểm tra lại lần nữa trong cùng ngày, hệ thống không gửi trùng thư nhắc lần 2 (do đã ghi nhận `schedule_reminded_at`).
- **Bằng chứng cần lưu:**
  - Ảnh chụp thông báo kết quả chạy **`Timer +1 ngày (Nhắc lịch)`** và nội dung thư `interview_reminder` trong tab **`5. Mẫu thư và Ngưỡng`**.

---

### Bước 2.2 — Ứng viên bổ sung hồ sơ (Thành công vs Hết số lần bổ sung)
- **Vai trò thao tác:** Ứng viên (`candidate`).
- **Ứng viên minh họa:**
  - `C02` (`TEST 02 Bao Binh` — thiếu `phone`): Bổ sung đầy đủ thành công ngay lần 1.
  - `C03` (`TEST 03 Gia Chi` — thiếu `essay`): Minh họa bổ sung nhiều lần (hoặc kiểm thử giới hạn tối đa `2` lần bổ sung).
  - `C04` (`TEST 04 Hoai Duong` — thiếu `phone`): **Giữ nguyên không bổ sung** để sang Ngày 3 kiểm tra nhánh quá hạn 2 ngày.
- **Thao tác:**
  1. Đăng nhập `C02` (`qa.cres.02@example.com`) $\rightarrow$ tại khung vàng **`Yêu cầu bổ sung thông tin hồ sơ (Lần 1/2)`** (còn khoảng `1 ngày` hạn bổ sung), nhập Số điện thoại `0900000102` $\rightarrow$ bấm **`Gửi thông tin bổ sung`**.
  2. Đăng nhập `C03` (`qa.cres.03@example.com`):
     - *Kịch bản A (Bổ sung thành công):* Nhập nội dung vào ô **`Câu hỏi tự luận (Động lực & Định hướng) *`** $\rightarrow$ bấm **`Gửi thông tin bổ sung`**.
     - *(Lưu ý nếu muốn minh họa nhánh **Hết 2 lần bổ sung vẫn thiếu** ngay tại đây: ở Lần 1/2 bấm `Gửi thông tin bổ sung` khi ô tự luận chỉ nhập khoảng trắng `   ` $\rightarrow$ hệ thống báo vẫn ở `Cần bổ sung hồ sơ (Lần 2/2)`; bấm gửi khoảng trắng thêm một lần nữa ở Lần 2/2 $\rightarrow$ hồ sơ lập tức chuyển sang **`Bị loại vì quá hạn`** do vượt trần `supplement_max_rounds = 2`).*
- **Kết quả mong đợi vs Kết quả thực tế:**
  - *Kết quả mong đợi:* Hồ sơ bổ sung đủ thông tin trong hạn `2 ngày` và trong `2 lần` sẽ tự động đi tiếp qua bộ chấm sơ loại; hồ sơ bổ sung quá `2 lần` mà vẫn rỗng trường bắt buộc sẽ bị loại (`expired_supplement`).
  - *Kết quả thực tế trên hệ thống:* Khớp 100%. Sau khi `C02` bổ sung số điện thoại, hồ sơ đạt `100đ` và chuyển ngay sang **`Chờ đặt lịch phỏng vấn`** với hạn đặt lịch mới tính từ Ngày 2 (`(T0 + 1 ngày) + 2 ngày = T0 + 3 ngày`).
- **Bằng chứng cần lưu:**
  - Ảnh chụp khung **`Yêu cầu bổ sung thông tin hồ sơ (Lần 1/2)`** của `C02` và màn hình sau khi chuyển sang **`Chờ đặt lịch phỏng vấn`**.

---

### Bước 2.3 — Ban Nhân sự xét duyệt nhánh `Cần xem xét` và kiểm tra hồ sơ sát ngưỡng $Y$
- **Vai trò thao tác:** Ban Nhân sự (`hr`).
- **Ứng viên minh họa:**
  - `C05` (`TEST 05 Khanh Ha` — `63đ`): BNS duyệt **ĐẠT**.
  - `C06` (`TEST 06 Ngoc Hieu` — `63đ`): BNS duyệt **Không đạt**.
  - `C08` (`TEST 08 Thanh Lam` — `47đ`, sát ngưỡng $Y = 50$đ): BNS kiểm tra và bấm **Chốt Loại** (hoặc **Cứu xét sang ĐẠT**).
- **Thao tác:**
  1. Đăng nhập **`Ban Nhân sự (BNS)`** $\rightarrow$ mở tab **`2. Duyệt hồ sơ còn lại (2)`**.
  2. Tại thẻ của `C05` (`TEST 05 Khanh Ha`):
     - Thử bấm **`Duyệt ĐẠT (Gửi link PV)`** khi chưa nhập lý do để quan sát thông báo nhắc nhập lý do tối thiểu 3 ký tự.
     - Nhập vào ô **`Nhập lý do duyệt Đạt / Không đạt (Bắt buộc)...`**: `"Có tinh thần cầu thị và cam kết gắn bó tốt"` $\rightarrow$ bấm **`Duyệt ĐẠT (Gửi link PV)`**.
  3. Tại thẻ của `C06` (`TEST 06 Ngoc Hieu`):
     - Nhập lý do: `"Kinh nghiệm chưa phù hợp với yêu cầu của Ban đợt này"` $\rightarrow$ bấm **`Không đạt (Gửi thư loại)`**.
  4. Chuyển sang tab **`3. Hồ sơ cần được xem xét (1)`**:
     - Quan sát hồ sơ `C08` (`TEST 08 Thanh Lam` — `Điểm sơ loại: 47đ (Sát ngưỡng Y=50đ)`).
     - Bấm **`Chốt Loại & Gửi thông báo không đạt`** (hoặc bấm **`Cứu xét sang ĐẠT (Gửi link PV)`** nếu muốn đưa `C08` vào vòng phỏng vấn).
- **Kết quả mong đợi vs Kết quả thực tế:**
  - *Kết quả mong đợi:* BNS bắt buộc phải nhập lý do khi duyệt; hồ sơ được duyệt Đạt chuyển sang `invited_to_book` (với hạn đặt lịch tính từ thời điểm duyệt ở Ngày 2); hồ sơ Không đạt chuyển sang `rejected_docs` và gửi thư phản hồi vào Outbox.
  - *Kết quả thực tế trên hệ thống:* Khớp 100%. `C05` chuyển sang **`Chờ đặt lịch phỏng vấn`**, `C06` và `C08` chuyển sang **`Hồ sơ không đạt`** và xuất hiện trong bảng **`Danh sách Hồ sơ không đạt vòng đơn đã ghi nhật ký`**.
- **Bằng chứng cần lưu:**
  - Ảnh chụp tab **`2. Duyệt hồ sơ còn lại`** trước/sau khi duyệt `C05`, `C06` và tab **`3. Hồ sơ cần được xem xét`** khi xử lý `C08`.

---

### Bước 2.4 — Ứng viên nhận lời nhắc (`C11`) và ứng viên vừa duyệt/bổ sung (`C02`, `C05`) đặt lịch phỏng vấn
- **Vai trò thao tác:** Ứng viên (`candidate`).
- **Ứng viên minh họa:** `C11` (`TEST 11 Viet Phuc`), `C02` (`TEST 02 Bao Binh`), `C05` (`TEST 05 Khanh Ha`). *(Giữ nguyên `C12` không đặt lịch để kiểm tra quá hạn ở Ngày 3).*
- **Thao tác:**
  1. Đăng nhập `C11` (`qa.cres.11@example.com`): Kiểm tra mục **`Hộp thư Thông báo của tôi`** ở cuối trang để thấy thư nhắc chọn lịch phỏng vấn vừa gửi ở Bước 2.1, sau đó bấm **`Chọn khung giờ này`** trên ca `DEMO_FULL_A`.
  2. Đăng nhập `C02` và `C05`: Lần lượt bấm **`Chọn khung giờ này`** vào ca `DEMO_FULL_A` (hoặc một trong các ca phòng phỏng vấn `Phòng C302` / `Phòng H101` còn chỗ).
- **Kết quả mong đợi vs Kết quả thực tế:**
  - *Kết quả mong đợi:* `C11`, `C02`, `C05` chuyển sang trạng thái **`Đã đặt lịch phỏng vấn`** (`booked`) trước khi hết hạn; riêng `C12` vẫn ở trạng thái **`Chờ đặt lịch phỏng vấn`**.
  - *Kết quả thực tế trên hệ thống:* Khớp 100%.
- **Bằng chứng cần lưu:**
  - Ảnh chụp màn hình của `C11` hiển thị thư nhắc đặt lịch trong hộp thư và trạng thái **`Đã đặt lịch phỏng vấn`** sau khi chọn ca.

---

## Ngày 3 (Mốc `T0 + 2 ngày`): Kiểm tra quá hạn bổ sung, quá hạn đặt lịch và hồ sơ đã đặt đúng hạn

### Bước 3.1 — Chuyển đồng hồ giả lập sang Ngày 3 (thêm `+1 ngày` nữa, tổng `T0 + 2 ngày`)
- **Vai trò thao tác:** Ban Nhân sự (`hr`).
- **Ứng viên minh họa:**
  - `C04` (`TEST 04 Hoai Duong`): Đang ở `Cần bổ sung hồ sơ` từ `T0`, chưa bổ sung sau `2 ngày`.
  - `C12` (`TEST 12 Mai Quynh`): Đang ở `Chờ đặt lịch phỏng vấn` từ `T0`, đã nhắc ở Ngày 2 nhưng vẫn không đặt lịch sau `2 ngày`.
  - `C01`, `C02`, `C05`, `C09`, `C10`, `C11`, `C15`, `C16`, `C17`: Các hồ sơ đã đặt lịch đúng hạn (`Đã đặt lịch phỏng vấn`).
- **Thao tác:**
  1. Đăng nhập **`Ban Nhân sự (BNS)`**.
  2. Bấm nút **`Timer +1 ngày (Nhắc lịch)`** (đưa tổng thời gian giả lập từ `T0 + 1 ngày` lên `T0 + 2 ngày`, hoặc bấm **`Timer +2 ngày (Quá hạn / Gạch tên)`**).
  3. Mở tab **`1. Sheet Hồ sơ`** và lọc theo trạng thái để kiểm tra `C04`, `C12` và các ứng viên đã đặt lịch.
- **Kết quả mong đợi vs Kết quả thực tế:**
  - *Kết quả mong đợi:*
    - `C04` quá hạn bổ sung 2 ngày $\rightarrow$ tự động chuyển sang **`Bị loại vì quá hạn`** (`expired_supplement` — **END 1**) và nhận thông báo hết hạn bổ sung.
    - `C12` quá hạn đặt lịch 2 ngày $\rightarrow$ tự động chuyển sang **`Ứng viên không tham gia`** (`no_booking` — **END 3**) và nhận thông báo hủy lịch hẹn.
    - Các hồ sơ đã đặt lịch đúng hạn (`C01`, `C02`, `C05`, `C09`, `C10`, `C11`, `C15`, `C16`, `C17`) giữ nguyên trạng thái **`Đã đặt lịch phỏng vấn`** và giữ nguyên chỗ trong ca phỏng vấn.
  - *Kết quả thực tế trên hệ thống:* Khớp 100%. Ngoài việc tự động quét qua Timer, nếu một ứng viên quá hạn cố tình bấm nút đặt lịch trên trình duyệt trước khi Timer kịp chạy, API `POST /api/applications/:id/book` cũng chặn ngay với mã `400` và chuyển hồ sơ sang `no_booking`.
- **Bằng chứng cần lưu:**
  - Ảnh chụp dòng trạng thái của `C04` (`Bị loại vì quá hạn`) và `C12` (`Ứng viên không tham gia`) trên **`1. Sheet Hồ sơ`** kèm cửa sổ **`Chi tiết`** hiển thị `Lịch sử xử lý hồ sơ`.

---

## Ngày 4 (Mốc `T0 + 3 ngày`): Điểm danh độc lập với phiếu điểm, đủ 2 phiếu chấm mới quyết định, và kiểm tra điểm phỏng vấn bằng 0

### Bước 4.1 — Kiểm chứng Check-in độc lập với Phiếu điểm và cổng hội tụ `AND-join` (Yêu cầu đủ 2 phiếu chấm)
- **Vai trò thao tác:** Ban Chủ nhiệm — Giám khảo 1 (`bcn@cres.due.udn.vn`) và Giám khảo 2 (`pho.bcn@cres.due.udn.vn`).
- **Ứng viên minh họa:** `C01` (`TEST 01 Minh An`), `C09` (`TEST 09 Nhat Minh`), `C10` (`TEST 10 Thao Nhi`), `C11` (`TEST 11 Viet Phuc`).
- **Thao tác:**
  1. Đăng nhập **`Ban Chủ nhiệm (BCN)`** (Giám khảo 1: `bcn@cres.due.udn.vn`) $\rightarrow$ mở tab **`1. Chờ chấm điểm xét tuyển`**.
  2. **Kiểm tra nhánh chấm điểm trước khi Check-in trên `C01`:**
     - Khi `C01` đang hiển thị `Check-in: Chưa check-in` và `Phiếu chấm: 0/2 phiếu`, bấm **`Chấm phiếu`**.
     - Trong modal **`Phiếu chấm điểm phỏng vấn: TEST 01 Minh An`**, quan sát hai nút `Lưu & Chọn Rớt` và `Lưu & Duyệt Đậu` đang bị khóa (vì chưa Check-in) $\rightarrow$ nhập điểm `9.0` cho 5 tiêu chí $\rightarrow$ bấm **`Chỉ lưu điểm`**.
     - Quan sát trên bảng: `C01` chuyển sang trạng thái **`Đang phỏng vấn (Song song)`**, `Check-in: Chưa check-in`, `Phiếu chấm: 1/2 phiếu`, điểm trung bình `90.00đ`, và hai nút **`Chọn Đậu`** / **`Chọn Rớt`** vẫn bị khóa.
  3. **Kiểm tra nhánh đã Check-in nhưng mới có 1/2 phiếu chấm trên `C01`:**
     - Bấm nút **`Check-in`** trên dòng của `C01` $\rightarrow$ dòng thông tin đổi thành `Check-in: Đã có mặt`, `Phiếu chấm: 1/2 phiếu`.
     - Quan sát: Trạng thái của `C01` **vẫn giữ ở `Đang phỏng vấn (Song song)`** và hai nút **`Chọn Đậu`** / **`Chọn Rớt`** **vẫn bị khóa** với chú thích: *"Cần Check-in và đủ tối thiểu 2 phiếu chấm trước khi quyết định Đậu/Rớt"*.
  4. **Nộp phiếu chấm thứ 2 từ Giám khảo 2 (`pho.bcn@cres.due.udn.vn`):**
     - Bấm **`Đổi tài khoản`** $\rightarrow$ đăng nhập bằng email `pho.bcn@cres.due.udn.vn` (mật khẩu `123456`).
     - Tại tab **`1. Chờ chấm điểm xét tuyển`**, bấm **`Chấm phiếu`** trên dòng của `C01` $\rightarrow$ nhập điểm `8.0` cho 5 tiêu chí $\rightarrow$ bấm **`Chỉ lưu điểm`** (hoặc bấm trực tiếp **`Lưu & Duyệt Đậu`**).
  5. Thực hiện tương tự (Check-in + đủ 2 phiếu chấm từ 2 giám khảo BCN) cho `C09`, `C10`, `C11` và bấm **`Chọn Đậu`** cho cả 4 bạn (`C01`, `C09`, `C10`, `C11`).
- **Kết quả mong đợi vs Kết quả thực tế:**
  - *Kết quả mong đợi:* Check-in không tự tạo phiếu điểm; chấm điểm không tự động Check-in; khi cấu hình `min_scorecards_per_interview = 2`, chỉ khi có `Check-in: Đã có mặt` **VÀ** `Phiếu chấm: 2/2 phiếu` thì hồ sơ mới hội tụ sang trạng thái **`Chờ BCN quyết định Đậu/Rớt`** (`scored`) và mở khóa nút **`Chọn Đậu`** / **`Chọn Rớt`**.
  - *Kết quả thực tế trên hệ thống:* Khớp 100%. Khi `C01` có đủ 2 phiếu (`90đ` và `80đ`), điểm trung bình tự cộng chính xác là **`85.00đ`**, trạng thái chuyển sang **`Chờ BCN quyết định Đậu/Rớt`**, và sau khi bấm **`Chọn Đậu`** ứng viên chuyển ngay sang tab **`2. Đã có kết quả`** với trạng thái **`Đã chọn Đậu (Chờ chốt gửi TB)`**.
- **Bằng chứng cần lưu:**
  - Ảnh chụp dòng của `C01` lúc mới có `Check-in: Đã có mặt` + `Phiếu chấm: 1/2 phiếu` (nút `Chọn Đậu`/`Chọn Rớt` đang khóa).
  - Ảnh chụp dòng của `C01` sau khi có đủ `Phiếu chấm: 2/2 phiếu` (trạng thái **`Chờ BCN quyết định Đậu/Rớt`**, nút `Chọn Đậu`/`Chọn Rớt` mở khóa).

---

### Bước 4.2 — Kiểm tra giữ nguyên điểm phỏng vấn bằng `0.00đ` và quyết định Rớt phỏng vấn
- **Vai trò thao tác:** Ban Chủ nhiệm — Giám khảo 1 (`bcn@cres.due.udn.vn`) và Giám khảo 2 (`pho.bcn@cres.due.udn.vn`).
- **Ứng viên minh họa:** `C15` (`TEST 15 Hai Uyen` — có điểm sơ loại ban đầu là `100đ`).
- **Thao tác:**
  1. Tại tab **`1. Chờ chấm điểm xét tuyển`**, bấm **`Check-in`** cho `C15`.
  2. Bấm **`Chấm phiếu`** cho `C15` (bằng tài khoản Giám khảo 1): Nhập **`0`** cho cả 5 tiêu chí, nhập nhận xét: `"Ứng viên không trả lời được các câu hỏi tình huống (0 điểm)"` $\rightarrow$ quan sát hộp cam hiển thị **`Hệ thống tự cộng điểm (theo trọng số): 0.00 / 100đ`** $\rightarrow$ bấm **`Chỉ lưu điểm`**.
  3. Đăng nhập tài khoản Giám khảo 2 (`pho.bcn@cres.due.udn.vn`) $\rightarrow$ bấm **`Chấm phiếu`** cho `C15` $\rightarrow$ nhập **`0`** cho cả 5 tiêu chí $\rightarrow$ bấm **`Lưu & Chọn Rớt`** (hoặc bấm **`Chỉ lưu điểm`** rồi bấm **`Chọn Rớt`** ngoài bảng).
- **Kết quả mong đợi vs Kết quả thực tế:**
  - *Kết quả mong đợi:* Điểm phỏng vấn `0` là giá trị hợp lệ, phải được bảo toàn là **`0.00đ`** trên bảng xét tuyển (tuyệt đối không bị coi là `null`/`falsy` để rơi về điểm sơ loại `100đ`).
  - *Kết quả thực tế trên hệ thống:* Khớp 100%. Cột `Điểm trung bình` (và `Điểm tổng hợp` ở tab **`2. Đã có kết quả`**) của `C15` hiển thị chính xác **`0.00đ`**, trạng thái chuyển sang **`Đã chọn Rớt (Chờ chốt gửi TB)`**.
- **Bằng chứng cần lưu:**
  - Ảnh chụp modal **`Phiếu chấm điểm phỏng vấn: TEST 15 Hai Uyen`** với `0.00 / 100đ` và bảng **`2. Đã có kết quả`** hiển thị `0.00đ` — `Đã loại`.

---

## Ngày 5 (Mốc `T0 + 4 ngày`): Chốt thông báo kết quả PV, ứng viên xác nhận tham gia và BNS phân ban

### Bước 5.1 — Ban Chủ nhiệm xem trước và bấm "Chốt và gửi thông báo"
- **Vai trò thao tác:** Ban Chủ nhiệm (`board`).
- **Ứng viên minh họa:** Các ứng viên đã chọn Đậu (`C01`, `C09`, `C10`, `C11`) và ứng viên đã chọn Rớt (`C15`).
- **Thao tác:**
  1. Tại màn hình **BCN Chấm điểm & Xét tuyển**, bấm nút màu cam **`Chốt và gửi thông báo (5 bạn)`** (hoặc **`Xem trước & Gửi kết quả (5 bạn)`**).
  2. Trong hộp thoại **`Xác nhận gửi thông báo kết quả phỏng vấn`**, kiểm tra danh sách:
     - `C01`, `C09`, `C10`, `C11`: nhãn xanh **`GỬI THƯ ĐẬU`**.
     - `C15`: nhãn đỏ **`GỬI THƯ RỚT`**.
  3. Bấm nút **`Chốt và gửi (5 thông báo)`**.
- **Kết quả mong đợi vs Kết quả thực tế:**
  - *Kết quả mong đợi:* Các ứng viên Đậu chuyển sang `offer_sent` (`Đã đậu — Chờ xác nhận vào nhóm`) và nhận thư mời tham gia; ứng viên Rớt chuyển sang trạng thái kết thúc `failed_interview` (`Ứng viên không đạt (Rớt PV)` — **END 4**) và nhận thư cảm ơn sau phỏng vấn.
  - *Kết quả thực tế trên hệ thống:* Khớp 100%. Banner báo: *"Đã chốt kết quả và gửi thông báo thành công cho 5 ứng viên (4 Đậu, 1 Rớt)!"*
- **Bằng chứng cần lưu:**
  - Ảnh chụp hộp thoại **`Xác nhận gửi thông báo kết quả phỏng vấn`** và bảng **`2. Đã có kết quả`** sau khi gửi.

---

### Bước 5.2 — Kiểm chứng bắt buộc ứng viên xác nhận tham gia trước khi phân ban
- **Vai trò thao tác:** Ban Nhân sự (`hr`) $\rightarrow$ sau đó chuyển sang Ứng viên (`candidate`).
- **Ứng viên minh họa:** `C01` (`TEST 01 Minh An`), `C09` (`TEST 09 Nhat Minh`), `C10` (`TEST 10 Thao Nhi`), `C11` (`TEST 11 Viet Phuc`).
- **Thao tác:**
  1. **Kiểm tra trên cổng BNS trước khi ứng viên xác nhận:**
     - Đăng nhập **`Ban Nhân sự (BNS)`** $\rightarrow$ mở tab **`4. Phân công 3 Ban (AI gợi ý)`**.
     - Quan sát: Bảng chờ phân ban hiển thị *"Hiện không có ứng viên nào đang chờ phân ban."* vì `C01`, `C09`, `C10`, `C11` mới ở trạng thái `Đã đậu — Chờ xác nhận vào nhóm` (`offer_sent`), chưa xác nhận tham gia.
  2. **Ứng viên bấm xác nhận tham gia 1 bước:**
     - Lần lượt đăng nhập `C01`, `C09`, `C10`, `C11`.
     - Tại khung màu xanh lá **`Chúc mừng bạn đã trúng tuyển vòng Phỏng vấn Câu lạc bộ Thương mại C-RES!`**, bấm nút **`Xác nhận tham gia C-RES`**.
- **Kết quả mong đợi vs Kết quả thực tế:**
  - *Kết quả mong đợi:* BNS không thể phân ban cho ứng viên chưa xác nhận; khi ứng viên bấm **`Xác nhận tham gia C-RES`**, hồ sơ chuyển ngay sang **`Đã vào nhóm — Chờ phân ban`** (`confirmed_joined`) và hiển thị nút **`Tham gia nhóm CLB (https://zalo.me/g/cres-ctv-gen2026-due)`**.
  - *Kết quả thực tế trên hệ thống:* Khớp 100%.
  - *Giới hạn trong mã nguồn:* Bước xác nhận tham gia được gộp 1 bước theo thiết kế To-Be và không có bộ đếm tự động hủy lời mời trúng tuyển nếu ứng viên để lâu không bấm (nếu ứng viên từ chối tham gia sẽ bấm nút **`Rút đơn ứng tuyển`**).
- **Bằng chứng cần lưu:**
  - Ảnh chụp khung **`Chúc mừng bạn đã trúng tuyển vòng Phỏng vấn...`** và khung **`Nhóm sinh hoạt CLB & Thông tin Phân công Ban`** sau khi `C01` bấm xác nhận.

---

### Bước 5.3 — Ban Nhân sự xem gợi ý AI, kiểm tra giới hạn chỉ tiêu và chốt phân công ban
- **Vai trò thao tác:** Ban Nhân sự (`hr`).
- **Ứng viên minh họa:** `C01` (NV1: `Ban Truyền thông`), `C09` (NV1: `Ban Kinh doanh`), `C10` (NV1: `Ban Nhân sự`), `C11` (NV1: `Ban Truyền thông`).
- **Thao tác:**
  1. Đăng nhập **`Ban Nhân sự (BNS)`** $\rightarrow$ mở tab **`4. Phân công 3 Ban (AI gợi ý)`**.
  2. Bấm nút **`Cập nhật gợi ý phân ban`** để hệ thống tạo gợi ý phân công kèm lý do tại cột **`AI Gợi ý & Lý do`**.
  3. *(Tùy chọn kiểm tra giới hạn chỉ tiêu `quota`)*:
     - Có thể vào **`Cài đặt đợt tuyển`** đặt thử chỉ tiêu `Ban Truyền thông` = `1` rồi quay lại tab **`4. Phân công 3 Ban (AI gợi ý)`**: khi cả `C01` và `C11` cùng chọn `Ban Truyền thông` (`2 > 1`), thẻ `Ban Truyền thông` lập tức đổi sang viền đỏ cảnh báo vượt chỉ tiêu và nếu bấm chốt sẽ bị chặn với lỗi *"Vượt quá chỉ tiêu..."*; còn khi bấm **`Cập nhật gợi ý phân ban`**, hệ thống tự động xếp người điểm cao hơn vào `Ban Truyền thông` (1 chỗ) và chuyển người thứ 2 sang Nguyện vọng 2 (`Ban Nhân sự`). *(Sau khi thử xong, đặt lại chỉ tiêu gốc `8 / 7 / 7`).*
  4. Kiểm tra cột **`HR Chọn Ban Chốt`** của 4 ứng viên (`C01`, `C09`, `C10`, `C11`) và bấm nút **`Chốt phân công và gửi (4 CTV)`**.
- **Kết quả mong đợi vs Kết quả thực tế:**
  - *Kết quả mong đợi:* Hồ sơ của 4 ứng viên chuyển qua `assigned` sang **`Hoàn tất quy trình tuyển CTV`** (`completed` — **END 6**), gửi thư thông báo phân ban vào Outbox, và cập nhật số lượng **`Đã chốt`** / **`Còn nhận`** của từng ban:
    - `Ban Truyền thông`: `Đã chốt: 2/8` · `Còn nhận: 6` (`C01`, `C11`)
    - `Ban Nhân sự`: `Đã chốt: 1/7` · `Còn nhận: 6` (`C10`)
    - `Ban Kinh doanh`: `Đã chốt: 1/7` · `Còn nhận: 6` (`C09`)
  - *Kết quả thực tế trên hệ thống:* Khớp 100%. Cả 4 ứng viên xuất hiện trong khung **`Danh sách CTV đã chốt phân công & hoàn tất quy trình (4)`**.
- **Bằng chứng cần lưu:**
  - Ảnh chụp tab **`4. Phân công 3 Ban (AI gợi ý)`** trước và sau khi bấm **`Chốt phân công và gửi (4 CTV)`** (thể hiện rõ số liệu `Đã chốt` và `Còn nhận` của 3 ban).

---

## Ngày 6 (Mốc `T0 + 5 ngày`): Rút đơn sau phân công, kiểm tra thu hồi (`revoked`) và hoàn trả chỉ tiêu

### Bước 6.1 — Cộng tác viên đã hoàn tất phân ban bấm "Rút đơn ứng tuyển"
- **Vai trò thao tác:** Ứng viên (`candidate`) $\rightarrow$ sau đó kiểm tra trên Ban Nhân sự (`hr`) và Tổng quan đợt tuyển (`admin`).
- **Ứng viên minh họa:** `C11` (`TEST 11 Viet Phuc` — đang ở trạng thái **`Hoàn tất quy trình tuyển CTV`**, đã được chốt vào **`Ban Truyền thông`**).
- **Thao tác:**
  1. Đăng nhập tài khoản `C11` (`qa.cres.11@example.com`).
  2. Quan sát màn hình **`Hồ sơ của tôi: TEST 11 Viet Phuc`** đang hiển thị nhãn **`Hoàn tất quy trình tuyển CTV`** và mục **`Ban công tác chính thức: Ban Truyền thông`**.
  3. Bấm nút màu đỏ **`Rút đơn ứng tuyển`** ở góc phải thẻ hồ sơ.
  4. Trong hộp thoại **`Xác nhận rút đơn ứng tuyển`**, nhập lý do: `"Em nhận học bổng trao đổi học kỳ nên xin phép rút tên khỏi đợt tuyển"` $\rightarrow$ bấm **`Xác nhận Rút đơn`**.
  5. Bấm **`Đổi tài khoản`** $\rightarrow$ vào **`Ban Nhân sự (BNS)`** $\rightarrow$ mở tab **`4. Phân công 3 Ban (AI gợi ý)`** và tab **`1. Sheet Hồ sơ`** (bấm **`Chi tiết`** trên dòng `C11`).
- **Kết quả mong đợi vs Kết quả thực tế:**
  - *Kết quả mong đợi:*
    - Trạng thái hồ sơ của `C11` chuyển từ `completed` sang **`Đã rút đơn`** (`withdrawn` — **END 5**).
    - Bản ghi phân công trong bảng `assignments` của `C11` tự động chuyển trạng thái từ `confirmed` sang **`revoked`** (thu hồi phân công).
    - Chỉ tiêu của **`Ban Truyền thông`** tự động được hoàn trả `1` chỗ: từ `Đã chốt: 2/8 · Còn nhận: 6` quay về **`Đã chốt: 1/8 · Còn nhận: 7`**, và `C11` được rút khỏi **`Danh sách CTV đã chốt phân công & hoàn tất quy trình`**.
  - *Kết quả thực tế trên hệ thống:* Khớp 100%. Trong cửa sổ **`Chi tiết`** của `C11` trên cổng BNS, mục **`Lịch sử xử lý hồ sơ`** ghi nhận rõ bản ghi thu hồi phân ban và hoàn trả 1 chỉ tiêu cho Ban Truyền thông.
- **Bằng chứng cần lưu:**
  - Ảnh chụp màn hình của `C11` sau khi rút đơn (`Đã rút đơn`).
  - Ảnh chụp tab **`4. Phân công 3 Ban (AI gợi ý)`** thể hiện thẻ **`Ban Truyền thông`** đã hoàn trả chỉ tiêu về **`Đã chốt: 1/8`** — **`Còn nhận: 7`**.
  - Ảnh chụp cửa sổ **`Chi tiết`** (`Lịch sử xử lý hồ sơ`) của `C11` và màn hình **`Tổng quan đợt tuyển`** thể hiện thống kê 6 lý do kết thúc quy trình.

---

## Bảng tóm tắt đối chiếu 6 ngày giả lập & Trạng thái cuối của các ứng viên minh họa

| Ngày giả lập | Sự kiện chính được kiểm chứng | Ứng viên minh họa | Trạng thái kết quả thực tế trên hệ thống |
| :--- | :--- | :--- | :--- |
| **Ngày 1 (`T0`)** | • Nộp đơn trực tiếp<br>• Sơ loại tự động 3 nhánh + sát ngưỡng $Y$<br>• Đặt lịch & thử ca đầy (`DEMO_FULL_C` 1/6, `DEMO_FULL_B` 2/6)<br>• Rút đơn trước phân công | • `C13` (nộp mới)<br>• `C07` (loại rõ xa $Y$)<br>• `C01`, `C09`, `C10`, `C15`–`C17`<br>• `C14` (rút đơn sớm) | • `C13` $\rightarrow$ `invited_to_book`<br>• `C07` $\rightarrow$ **`rejected_docs` (END 2)**<br>• `C01`, `C09`, `C10`, `C15`–`C17` $\rightarrow$ `booked` (`DEMO_FULL_C` & `B` về `0/6` chỗ trống)<br>• `C14` $\rightarrow$ **`withdrawn` (END 5)** |
| **Ngày 2 (`T0 + 1d`)** | • Bổ sung hồ sơ thành công<br>• BNS duyệt `needs_review` (Đạt / Không đạt) & chốt `clear_fail` sát ngưỡng $Y$<br>• Timer nhắc đặt lịch sau 1 ngày & đặt lịch | • `C02`, `C03` (bổ sung)<br>• `C05` (duyệt Đạt), `C06` (duyệt Loại), `C08` (chốt Loại sát $Y$)<br>• `C11` (nhận nhắc & đặt lịch) | • `C02`, `C05`, `C11` $\rightarrow$ `booked`<br>• `C06`, `C08` $\rightarrow$ **`rejected_docs` (END 2)**<br>• Outbox ghi nhận thư `interview_reminder` cho `C11`, `C12` |
| **Ngày 3 (`T0 + 2d`)** | • Timer quá hạn bổ sung sau 2 ngày<br>• Timer quá hạn đặt lịch sau 2 ngày<br>• Bảo toàn hồ sơ đã đặt đúng hạn | • `C04` (quá hạn bổ sung)<br>• `C12` (quá hạn đặt lịch)<br>• `C01`, `C02`, `C05`, `C09`–`C11`, `C15` | • `C04` $\rightarrow$ **`expired_supplement` (END 1)**<br>• `C12` $\rightarrow$ **`no_booking` (END 3)**<br>• Các hồ sơ đã đặt đúng hạn giữ nguyên `booked` |
| **Ngày 4 (`T0 + 3d`)** | • Check-in độc lập với phiếu chấm điểm<br>• Đủ 2 phiếu chấm (`AND-join`) mới mở khóa quyết định<br>• Bảo toàn điểm phỏng vấn `0.00đ` | • `C01`, `C09`, `C10`, `C11` (2 giám khảo BCN chấm Đậu)<br>• `C15` (chấm `0.00đ` — Rớt) | • `C01`, `C09`, `C10`, `C11` $\rightarrow$ `decided_pass`<br>• `C15` $\rightarrow$ `decided_fail` (giữ đúng `0.00đ`, không rơi về `100đ`) |
| **Ngày 5 (`T0 + 4d`)** | • BCN chốt & gửi thông báo Đậu/Rớt<br>• Ứng viên xác nhận tham gia 1 bước<br>• BNS chạy AI gợi ý & chốt phân ban trong chỉ tiêu | • `C15` (nhận thư Rớt PV)<br>• `C01`, `C09`, `C10`, `C11` (xác nhận & phân ban) | • `C15` $\rightarrow$ **`failed_interview` (END 4)**<br>• `C01`, `C09`, `C10` $\rightarrow$ **`completed` (END 6)** |
| **Ngày 6 (`T0 + 5d`)** | • Rút đơn sau khi đã chốt phân công<br>• Thu hồi phân công (`revoked`) & hoàn trả chỉ tiêu ban | • `C11` (rút đơn sau khi đã vào `Ban Truyền thông`) | • `C11` $\rightarrow$ **`withdrawn` (END 5)**, `assignment.status = 'revoked'`<br>• `Ban Truyền thông` hoàn trả `1` chỉ tiêu (`Đã chốt: 1/8`, `Còn nhận: 7`) |
