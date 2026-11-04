# C-res Recruit — Hệ thống Số hóa & Tự động hóa Tuyển CTV CLB C-res (ĐH Kinh tế – ĐHĐN)

Ứng dụng web full-stack (**React + TypeScript + Express + SQLite + Gemini AI**) hiện thực hóa mô hình quy trình **TO-BE BPMN 2.0** cho đợt tuyển Cộng tác viên (CTV) sự kiện của **CLB C-res — Trường Đại học Kinh tế, Đại học Đà Nẵng**.

---

## 1. Cách chạy ứng dụng

```bash
# 1. Cài đặt dependencies
npm install

# 2. Chạy unit test cho Rules Engine & State Machine
npm test
# hoặc: npx --yes tsx --test server/rules/rulesEngine.test.ts

# 3. Khởi chạy server phát triển (Frontend + Backend trên cổng 3000)
npm run dev
```

Lần đầu khởi động, hệ thống tự động tạo cơ sở dữ liệu SQLite (`cres-recruit.db`), chạy migration cho 14 bảng và nạp sẵn **42 hồ sơ ứng viên mẫu** phân bố ở đầy đủ các trạng thái.

---

## 2. Biến môi trường (`.env`)

| Biến môi trường | Mô tả | Mặc định |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Khóa API Google Gemini dùng ở backend cho bước gợi ý phân công ban (`/api/assignments/suggest`). Nếu không cấu hình, hệ thống tự động chuyển sang thuật toán tối ưu dự phòng theo điểm + nguyện vọng + chỉ tiêu. | Được AI Studio tiêm tự động |
| `JWT_SECRET` | Khóa bí mật ký JWT xác thực phiên đăng nhập và phân quyền middleware. | `cres-recruit-due-secret-key-2026` |
| `TIME_SCALE` | Hệ số tỉ lệ thời gian demo (ví dụ `1` = thời gian thực, `720` = 1 ngày bằng 2 phút). Ngoài ra có nút **Tua nhanh +1 ngày / +2 ngày** trực tiếp trên giao diện. | `1` |

---

## 3. Tài khoản Demo (Mật khẩu chung: `123456`)

Bạn có thể chuyển nhanh bằng thanh **"Chế độ Demo Vai trò"** ngay trên đầu trang hoặc đăng nhập bằng các tài khoản sau:

- **Quản trị viên (Admin)**: `admin@cres.due.udn.vn` / `123456`
- **Ban Nhân sự (HR)**: `hr@cres.due.udn.vn` / `123456`
- **Ban Chủ nhiệm (BCN)**: `bcn@cres.due.udn.vn` / `123456` (và `pho.bcn@cres.due.udn.vn`)
- **Ứng viên (Candidate)**: `ungvien@due.udn.vn` / `123456` (hoặc chọn bất kỳ ứng viên nào trong 42 hồ sơ mẫu).

---

## 4. Sơ đồ Trạng thái (`applications.status` State Machine)

Mọi chuyển trạng thái đều bắt buộc đi qua hàm trung tâm `transition(opts)` tại `server/services/stateMachine.ts` và tự động ghi `audit_logs`:

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
                    └─► (Gần ngưỡng Y ≤ 5đ: HR xác nhận) ─────────┘           └─► interviewing (Song song: Check-in || Chấm điểm)
                          [END 2: Hồ sơ không đạt]                                  └─► scored (AND-join hội tụ)
                                                                                          ├─► decided_fail ─► (BCN Chốt & gửi) ─► failed_interview [END 4: Ứng viên không đạt]
                                                                                          └─► decided_pass ─► (BCN Chốt & gửi) ─► offer_sent
                                                                                                                                    └─► confirmed_joined (1 bước xác nhận & nhận link nhóm)
                                                                                                                                          └─► assigned (AI gợi ý + HR duyệt chốt)
                                                                                                                                                └─► completed [END 6: Hoàn tất quy trình tuyển CTV]

* Ngoại lệ toàn quy trình (ở mọi trạng thái trước khi kết thúc):
  Any Active Status ──(Ứng viên bấm Rút đơn)──► withdrawn [END 5: Đã rút đơn]
  (Tự động hủy toàn bộ timer đang chạy; nếu đã phân công ban thì tự động hoàn tác `revoked` và trả lại chỉ tiêu cho ban).
```

---

## 5. Cấu trúc thư mục

- `server/db/` — Khởi tạo SQLite (`database.ts`) và dữ liệu mẫu 42 hồ sơ (`seed.ts`).
- `server/rules/` — Pure functions (`rulesEngine.ts`) và bộ unit test (`rulesEngine.test.ts`).
- `server/services/` — State machine trung tâm (`stateMachine.ts`), Gemini AI phân ban (`aiAssignmentService.ts`), và dịch vụ thông báo/mẫu thư (`notificationService.ts`).
- `server/jobs/` — Bộ đếm giờ chạy nền & tua nhanh thời gian (`timerScheduler.ts`).
- `server/routes/` — REST API & phân quyền theo vai trò (`api.ts`).
- `src/components/` — Giao diện theo từng vai trò (`CandidatePortal.tsx`, `HrPortal.tsx`, `BoardPortal.tsx`, `DashboardAndAdmin.tsx`, `BpmnDiagramModal.tsx`).
