# C-RES Recruit — Hệ thống Tuyển Cộng Tác Viên Tự Động Hóa (Câu lạc bộ Thương mại C-RES — ĐH Kinh tế, ĐHĐN)

Ứng dụng web full-stack (**React 19 + TypeScript + Express + SQLite + Gemini AI**) hiện thực hóa mô hình quy trình **TO-BE BPMN 2.0 & BTH 3.2** cho đợt tuyển Cộng tác viên (CTV) sự kiện của **Câu lạc bộ Thương mại C-RES — Trường Đại học Kinh tế, Đại học Đà Nẵng**.

---

## 1. Hướng dẫn cài đặt, kiểm thử và khởi chạy

```bash
# 1. Cài đặt dependencies (đã gỡ xung đột peer dependency giữa vite 8 và esbuild)
npm install

# 2. Chạy toàn bộ bộ kiểm thử (Unit Test + API Integration Test trên DB cô lập)
npm test
# Chỉ chạy unit test cho Rules Engine & State Machine:
npm run test:unit
# Chỉ chạy kiểm thử tích hợp REST API (F01–F13 & luồng To-Be):
npm run test:api

# 3. Kiểm tra kiểu tĩnh TypeScript và đóng gói bản build Production
npm run lint
npm run build

# 4. Khởi chạy server phát triển (Frontend + Backend trên cổng 3000)
npm run dev
```

---

## 2. Cấu hình biến môi trường (`.env` / `.env.example`)

| Biến môi trường | Mô tả | Mặc định |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Khóa API Google Gemini dùng ở backend cho bước gợi ý phân công ban (`/api/assignments/suggest`). Nếu không cấu hình hoặc hết hạn mức, hệ thống tự động chuyển sang thuật toán tối ưu dự phòng (`fallbackAssignmentSuggestion`) theo điểm phỏng vấn + nguyện vọng 1/2 + chỉ tiêu còn lại. | Được tiêm tự động (tùy chọn) |
| `JWT_SECRET` | Khóa bí mật ký JWT xác thực phiên đăng nhập và phân quyền theo vai trò (`candidate`, `hr`, `board`, `admin`). | `cres-recruit-due-secret-key-2026` |
| `TIME_SCALE` | Hệ số tỉ lệ thời gian demo (ví dụ `1` = thời gian thực). Ngoài ra quản trị viên có thể dùng nút **Tua nhanh +1 ngày / +2 ngày** trực tiếp trên giao diện. | `1` |
| `DEMO_MODE` | Bật/tắt chế độ chuyển nhanh tài khoản nội bộ (`/api/auth/demo-users` và `/api/auth/quick-switch`). Đặt `DEMO_MODE=false` để khóa hoàn toàn tính năng chuyển nhanh tài khoản trong môi trường thực tế. | `true` |
| `CRES_DB_PATH` | Đường dẫn tệp cơ sở dữ liệu SQLite. Bộ kiểm thử tích hợp (`server/routes/api.integration.test.ts`) tự động gán `CRES_DB_PATH` sang tệp tạm riêng biệt để không tác động đến dữ liệu của website đang chạy. | `/tmp/cres-recruit.db` |

---

## 3. Chế độ Khởi tạo Dữ liệu (Seed Modes) & Thông báo Mô phỏng (Simulated Outbox)

### Hai chế độ làm mới dữ liệu (`POST /api/admin/seed`)
Tại màn hình **Dashboard / Cài đặt**, quản trị viên có 2 lựa chọn rõ ràng (có bước xác nhận trước khi thực thi):
1. **Đặt lại đợt tuyển trống (`{ "mode": "empty" }`)**: Xóa toàn bộ hồ sơ ứng viên (`0 hồ sơ`), giữ nguyên cấu hình đợt tuyển, 3 ban chuyên môn, 5 tiêu chí chấm điểm và 4 khung giờ phỏng vấn để người kiểm thử tự đăng ký và test từ đầu.
2. **Nạp dữ liệu mẫu (`{ "mode": "sample" }`)**: Khởi tạo **6 hồ sơ ứng viên mẫu** đại diện cho các nhánh nghiệp vụ (`needs_supplement`, `needs_review`, `clear_fail` sát ngưỡng Y, `invited_to_book`, `interviewing`, `confirmed_joined`).

### Cơ chế Thông báo Mô phỏng (Simulated Outbox — Không gửi Email thật)
- Mọi thông báo tự động (xác nhận nộp đơn, yêu cầu bổ sung hồ sơ, thư từ chối sơ loại, link đặt lịch phỏng vấn, thư nhắc đặt lịch sau 1 ngày, thông báo đậu/rớt phỏng vấn, thông tin phân ban) đều được ghi vào bảng `notifications` trong SQLite (**Outbox mô phỏng**).
- Hệ thống **không gửi email SMTP ra ngoài internet**, đảm bảo an toàn tuyệt đối khi chạy kiểm thử với email giả định.
- Ứng viên xem thông báo trực tiếp tại hộp thư trên **Cổng Ứng viên**, và Ban Nhân sự theo dõi/chỉnh sửa 10 mẫu thư động tại tab **5. Hộp thư & Mẫu TB**.

---

## 4. Phân quyền & Quy tắc Nghiệp vụ To-Be (Theo BTH 3.2)

Tổng cộng **26 hoạt động**: **10 thủ công (38,5%)**, **15 theo luật (57,7%)**, **1 có AI hỗ trợ (3,8%)**, **0 giao Agent (0%)**.

- **Ứng viên (`candidate`)**:
  - Chỉ xem và cập nhật hồ sơ của chính mình, bổ sung thông tin còn thiếu (tối đa 2 lần trong hạn 2 ngày), tự chọn khung giờ phỏng vấn còn chỗ (không nhìn thấy thông tin cá nhân của ứng viên khác), xác nhận tham gia nhóm 1 bước và có quyền rút đơn ở bất kỳ bước nào.
- **Ban Nhân sự (`hr`)**:
  - Quản lý bảng Sheet hồ sơ tự động, xét duyệt nhánh biên **"Cần xem xét"** (`Y <= Điểm < X`, bắt buộc nhập lý do), xem lại hồ sơ **"Loại rõ" sát ngưỡng Y** trước khi chốt gửi thư từ chối, xem gợi ý phân ban từ AI và **duyệt chốt phân công ban** trong phạm vi chỉ tiêu (`quota`) của từng ban.
  - Ban Nhân sự **không** có quyền quyết định Đậu/Rớt phỏng vấn.
- **Ban Chủ nhiệm (`board`)**:
  - Quản lý khung giờ phỏng vấn, thực hiện **Check-in điểm danh** và **Chấm phiếu điểm** chạy song song độc lập (`AND-join`: chỉ hội tụ sang `scored` khi ứng viên đã Check-in **và** đủ số phiếu chấm tối thiểu `min_scorecards_per_interview`).
  - Quyết định kết quả phỏng vấn (**Đậu / Rớt / Chờ xét**) và bấm **"Chốt & Gửi thông báo"** để phát hành kết quả chính thức.

---

## 5. Tài khoản Demo mặc định (Mật khẩu chung: `123456`)

- **Quản trị viên (Admin)**: `admin@cres.due.udn.vn` / `123456`
- **Ban Nhân sự (BNS / HR)**: `hr@cres.due.udn.vn` / `123456`
- **Ban Chủ nhiệm (BCN)**: `bcn@cres.due.udn.vn` / `123456` (và `pho.bcn@cres.due.udn.vn` / `123456`)
- **Ứng viên mặc định**: `ungvien@due.udn.vn` / `123456`

---

## 6. Sơ đồ Trạng thái (`applications.status` State Machine)

Mọi chuyển trạng thái đều bắt buộc đi qua `transition(opts)` tại `server/services/stateMachine.ts`, kiểm tra chặt chẽ `isValidStateTransition(from, to)` và tự động ghi `audit_logs`:

```text
submitted
  └─► checking
        ├─► needs_supplement ⇄ supplement_submitted ─► checking
        │     └─► (Quá 2 ngày hoặc quá 2 lần vẫn thiếu) ─► expired_supplement [END 1: Bị loại vì quá hạn]
        └─► screening
              ├─► clear_pass ─────────────────────────────────────┐
              ├─► needs_review ─► review_pass ────────────────────┼─► invited_to_book
              │                 └─► review_fail ─► rejected_docs   │     ├─► (Sau 1 ngày: Nhắc 1 lần)
              └─► clear_fail                                      │     ├─► (Quá 2 ngày) ─► no_booking [END 3: Ứng viên không tham gia]
                    ├─► (Xa ngưỡng Y) ───────────► rejected_docs   │     └─► booked
                    └─► (Gần ngưỡng Y: BNS xem lại & chốt) ────────┘           └─► interviewing (Song song độc lập: Check-in || Chấm điểm)
                          [END 2: Hồ sơ không đạt]                                  └─► scored (Hội tụ AND-join khi Đã Check-in + Đủ phiếu chấm)
                                                                                          ├─► decided_fail ─► (BCN Chốt & gửi) ─► failed_interview [END 4: Ứng viên không đạt]
                                                                                          └─► decided_pass ─► (BCN Chốt & gửi) ─► offer_sent
                                                                                                                                    └─► confirmed_joined (Ứng viên xác nhận 1 bước)
                                                                                                                                          └─► assigned (AI chỉ gợi ý + BNS duyệt chốt)
                                                                                                                                                └─► completed [END 6: Hoàn tất quy trình tuyển CTV]

* Ngoại lệ toàn quy trình (Global Withdrawal Exception):
  Any Active Status / assigned / completed ──(Ứng viên bấm Rút đơn)──► withdrawn [END 5: Đã rút đơn]
  (Tự động hủy toàn bộ timer đang chạy; nếu đã chốt phân công ban thì tự động hoàn tác `revoked` và hoàn trả chỉ tiêu cho ban).
```
