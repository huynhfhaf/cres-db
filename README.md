# C-RES Recruit — Hệ thống Tuyển Cộng Tác Viên Tự Động Hóa (Câu lạc bộ Thương mại C-RES — ĐH Kinh tế, ĐHĐN)

## 1. Giới thiệu hệ thống & Các vai trò người dùng

**C-RES Recruit** là ứng dụng web full-stack hiện thực hóa quy trình **TO-BE BPMN 2.0 & BTH 3.2** cho đợt tuyển Cộng tác viên (CTV) của **Câu lạc bộ Thương mại C-RES — Trường Đại học Kinh tế, Đại học Đà Nẵng (DUE)**.

Hệ thống chuẩn hóa toàn bộ vòng đời tuyển dụng gồm **26 hoạt động** (**10 thủ công — 38,5%**, **15 tự động theo luật — 57,7%**, **1 có AI hỗ trợ — 3,8%**, **0 giao toàn quyền cho Agent — 0%**), kiểm soát chuyển trạng thái tập trung qua State Machine (`server/services/stateMachine.ts`) và ghi vết đầy đủ vào nhật ký kiểm toán (`audit_logs`).

### Phân quyền theo vai trò (RBAC ở Backend)

1. **Ứng viên (`candidate`)**:
   - Đăng ký tài khoản, đăng nhập và nộp hồ sơ ứng tuyển trực tuyến.
   - Theo dõi tiến độ hồ sơ theo thời gian thực và xem thông báo tại Hộp thư ứng viên.
   - Bổ sung các trường thông tin còn thiếu (tối đa `2` lần trong thời hạn `2` ngày kể từ khi nhận yêu cầu).
   - Chủ động chọn ca phỏng vấn còn chỗ trống (được bảo vệ quyền riêng tư: không nhìn thấy thông tin cá nhân của ứng viên khác trong cùng ca), đổi ca hoặc hủy đặt lịch trước khi check-in.
   - Xác nhận tham gia CLB gộp 1 bước khi trúng tuyển để nhận liên kết vào nhóm chung (`group_link`).
   - Có quyền **Rút đơn (`withdrawn`)** ở bất kỳ giai đoạn nào (tự động hủy các bộ đếm hạn, trả lại ghế phỏng vấn hoặc thu hồi phân công `revoked` để hoàn trả chỉ tiêu cho ban chuyên môn).

2. **Ban Nhân sự (`hr` — BNS)**:
   - Theo dõi bảng tổng hợp hồ sơ tự động, cấu hình tiêu chí và mẫu thông báo.
   - Xét duyệt thủ công nhánh biên **Cần xem xét (`needs_review`, $Y \le \text{Điểm} < X$)** với lý do bắt buộc.
   - Kiểm tra lại các hồ sơ **Loại rõ (`clear_fail`) nằm sát ngưỡng $Y$** ($[Y - \text{biên độ}, Y)$ và đạt điều kiện cứng) trước khi xác nhận gửi thông báo từ chối hoặc cứu xét.
   - Xem gợi ý phân ban từ AI (hoặc thuật toán dự phòng), điều chỉnh thủ công và **duyệt chốt phân công ban (`assigned` $\rightarrow$ `completed`)** trong phạm vi chỉ tiêu còn lại (`remainingQuota`) của từng ban.
   - *Giới hạn phân quyền:* Ban Nhân sự bị chặn ở tầng API (`403 Forbidden`) đối với thao tác chấm phiếu điểm phỏng vấn và quyết định Đậu/Rớt phỏng vấn.

3. **Ban Chủ nhiệm (`board` — BCN)**:
   - Tạo và quản lý các ca phỏng vấn (thời gian, địa điểm/liên kết, tổng sức chứa `capacity`, số ghế dự trữ `reserved_seats`).
   - Thực hiện 2 nhánh độc lập trong giai đoạn phỏng vấn (**AND-split / AND-join**):
     - **Nhánh 1:** Check-in điểm danh ứng viên có mặt (`POST /api/applications/:id/check-in`).
     - **Nhánh 2:** Chấm phiếu điểm phỏng vấn theo 5 tiêu chí trọng số (`POST /api/applications/:id/scorecards`).
     - Hồ sơ chỉ hội tụ sang trạng thái `scored` khi **đã Check-in VÀ đủ số phiếu chấm tối thiểu (`min_scorecards_per_interview`)**.
   - Chọn quyết định tuyển chọn (**Đậu `decided_pass` / Rớt `decided_fail` / Chờ xét `scored`**), xem trước danh sách và bấm **Chốt & Gửi thông báo** để phát hành kết quả phỏng vấn.
   - *Giới hạn phân quyền:* Ban Chủ nhiệm bị chặn (`403 Forbidden`) đối với thao tác duyệt sơ loại hồ sơ hoặc chốt phân ban của Ban Nhân sự.

4. **Quản trị viên (`admin`)**:
   - Cấu hình thông số đợt tuyển (ngưỡng $X$, ngưỡng $Y$, biên độ sát ngưỡng, thời hạn bổ sung, thời gian nhắc lịch/hủy lịch, chỉ tiêu 3 ban chuyên môn).
   - Thực hiện các thao tác hỗ trợ kiểm thử và trình diễn: **Đặt lại đợt tuyển trống (0 hồ sơ)**, **Nạp dữ liệu mẫu (17 ứng viên)**, **Tua thời gian giả lập (+1 ngày / +2 ngày)** và kiểm thử bộ quy tắc sơ loại.

---

## 2. Công nghệ thực tế đang sử dụng

| Tầng | Công nghệ / Thư viện thực tế (theo `package.json` & mã nguồn) | Vai trò trong dự án |
| :--- | :--- | :--- |
| **Frontend** | `react` (`^19.0.1`), `react-dom` (`^19.0.1`), `typescript` (`^7.0.2`), `vite` (`^8.3.0`) | Giao diện SPA cho Cổng Ứng viên và Cổng Quản trị (BNS / BCN / Admin). |
| **Styling & UI** | `tailwindcss` (`^4.3.3`), `@tailwindcss/vite`, `lucide-react`, `recharts`, `motion` | Thiết kế giao diện, biểu đồ thống kê phễu tuyển dụng và trực quan hóa quy trình. |
| **Backend** | `node.js`, `express` (`^4.21.2`), `tsx` (`^4.21.0`), `zod` (`^4.6.7`) | RESTful API (`/api/*`), tích hợp Vite middleware trong môi trường dev trên cổng `3000`. |
| **Cơ sở dữ liệu** | `better-sqlite3` (`^13.0.3` — SQLite3 chạy chế độ `WAL` + `foreign_keys = ON`) | Lưu trữ quan hệ gồm 15 bảng (`server/db/database.ts`, `server/db/schema.sql`). |
| **Bảo mật & Xác thực** | `jsonwebtoken` (`^9.0.3`), `bcryptjs` (`^3.0.3`), Rate Limiter theo IP | Băm mật khẩu, phát hành/kiểm tra Bearer JWT và phân quyền middleware `requireAuth`, `requireRole`. |
| **AI & Rules Engine** | `@google/genai` (`^2.32.0`) + `server/rules/rulesEngine.ts` | Gợi ý phân ban bằng mô hình Gemini (kèm kiểm tra ràng buộc chỉ tiêu và thuật toán dự phòng xác định). |
| **Kiểm thử & CI** | `node:test`, `node:assert/strict`, GitHub Actions (`.github/workflows/cres-tests.yml`) | Kiểm thử đơn vị (Unit Test) và kiểm thử tích hợp API (Integration Test) trên CSDL SQLite tạm cô lập. |

---

## 3. Yêu cầu môi trường, cài đặt và chạy ứng dụng

### Yêu cầu môi trường
- **Node.js**: Khuyến nghị **Node.js $\ge$ 22.x** (hoặc Node.js 24.x theo cấu hình CI `.github/workflows/cres-tests.yml`).
- **Trình quản lý gói**: `npm` (đi kèm Node.js).

### Các bước cài đặt và khởi chạy

```bash
# 1. Cài đặt toàn bộ thư viện phụ thuộc từ package.json
npm install

# 2. Tạo file cấu hình môi trường từ file mẫu (tùy chọn, hệ thống có sẵn giá trị mặc định an toàn cho local dev)
cp .env.example .env

# 3. Khởi chạy ứng dụng ở chế độ phát triển (chạy cả Backend Express + Frontend Vite tại http://localhost:3000)
npm run dev
```

### Danh sách đầy đủ các script trong `package.json`

| Lệnh (`npm run ...`) | Lệnh thực thi thực tế trong `package.json` | Chức năng |
| :--- | :--- | :--- |
| `npm run dev` | `tsx server.ts` | Khởi chạy server phát triển full-stack (API + giao diện Vite) tại cổng `3000`. |
| `npm test` | `tsx --test server/rules/rulesEngine.test.ts server/routes/api.integration.test.ts` | Chạy toàn bộ bộ kiểm thử tự động (Unit Tests + API Integration Tests). |
| `npm run test:unit` | `tsx --test server/rules/rulesEngine.test.ts` | Chỉ chạy kiểm thử đơn vị cho Rules Engine và State Machine. |
| `npm run test:api` | `tsx --test server/routes/api.integration.test.ts` | Chỉ chạy kiểm thử tích hợp REST API trên cơ sở dữ liệu SQLite tạm. |
| `npm run lint` | `tsc --noEmit` | Kiểm tra tĩnh kiểu dữ liệu TypeScript toàn dự án. |
| `npm run build` | `vite build` | Đóng gói bản build giao diện Production vào thư mục `dist/`. |
| `npm start` | `node server.ts` | Chạy server theo cấu hình khởi chạy của dự án. |
| `npm run preview` | `vite preview` | Xem trước bản build tĩnh của Vite. |
| `npm run clean` | `rm -rf dist server.js` | Dọn dẹp thư mục kết quả build. |

---

## 4. Cấu hình biến môi trường (`.env` / `.env.example`)

Để cấu hình biến môi trường khi chạy tại máy cá nhân hoặc máy chủ, sao chép tệp `.env.example` thành `.env` và cập nhật các giá trị cần thiết. **Lưu ý bảo mật:** Không đưa khóa bí mật thật vào mã nguồn hoặc commit tệp `.env` lên Git (đã được chặn trong `.gitignore`).

| Tên biến | Cách cấu hình & Ý nghĩa trong mã nguồn | Hành vi mặc định khi không cấu hình |
| :--- | :--- | :--- |
| `GEMINI_API_KEY` | Khóa API Google Gemini dùng ở backend (`server/services/aiAssignmentService.ts`) khi gọi gợi ý phân công ban (`GET /api/assignments/suggest`). | Nếu để trống, giữ giá trị mẫu hoặc khi chạy kiểm thử (`CRES_TEST_MODE=true`), hệ thống tự động dùng thuật toán dự phòng `fallbackAssignmentSuggestion`. |
| `APP_URL` | Địa chỉ URL gốc nơi ứng dụng được triển khai (dùng cho liên kết tự tham chiếu). | Tự động nhận theo môi trường chạy hoặc localhost. |
| `JWT_SECRET` | Chuỗi bí mật dùng để ký và xác thực token đăng nhập JWT tại `server/routes/api.ts`. Khi triển khai thực tế cần đặt một chuỗi ngẫu nhiên đủ dài. | Dùng khóa mặc định phục vụ phát triển cục bộ trong `server/routes/api.ts`. |
| `TIME_SCALE` | Hệ số tỉ lệ thời gian mô phỏng lưu vào bảng `settings` khi khởi tạo. Ngoài biến này, người kiểm thử có thể dùng chức năng **Tua thời gian (+1 ngày / +2 ngày)** trực tiếp trên giao diện. | `"1"` (thời gian thực). |
| `DEMO_MODE` | Đặt `"true"` hoặc `"false"` để bật/tắt các endpoint hỗ trợ chuyển nhanh tài khoản khi demo (`/api/auth/demo`, `/api/auth/demo-users`, `/api/auth/quick-switch`). | `"true"` (bật hỗ trợ demo; đặt `DEMO_MODE="false"` để tắt khi vận hành thật). |
| `CRES_DB_PATH` | Đường dẫn tệp cơ sở dữ liệu SQLite được đọc tại `server/db/database.ts`. Để giữ dữ liệu bền vững ngay trong thư mục dự án, có thể đặt ví dụ `CRES_DB_PATH="./cres-recruit.db"`. | Mặc định trỏ tới `path.join(os.tmpdir(), 'cres-recruit.db')` (tức `/tmp/cres-recruit.db` trên Linux). |

---

## 5. Kiểm thử tự động, kiểm tra TypeScript, Build và GitHub Actions

### Chạy kiểm tra tại máy cục bộ (Local)

```bash
# 1. Chạy toàn bộ Unit Test + API Integration Test
npm test

# 2. Kiểm tra lỗi kiểu TypeScript
npm run lint

# 3. Kiểm tra đóng gói bản build giao diện
npm run build
```

- Khi chạy `npm test`, tệp `server/routes/api.integration.test.ts` tự động gán `process.env.CRES_DB_PATH` sang một tệp SQLite tạm riêng biệt (`cres-recruit-integration-test-<pid>-<timestamp>.db`) và tự động xóa tệp này trong hook `after()`, đảm bảo **tách biệt hoàn toàn** với dữ liệu đang hiển thị trên trình duyệt.

### Xem kết quả CI trên GitHub Actions (`C-RES Tests`)

Dự án đã được thiết lập sẵn workflow kiểm thử tự động tại `.github/workflows/cres-tests.yml` với tên hiển thị **`C-RES Tests`**:
- **Khi nào chạy:** Tự động kích hoạt khi `push` hoặc tạo `pull_request` vào nhánh `main`, hoặc chạy thủ công qua nút **Run workflow** (`workflow_dispatch`) trong tab **Actions** trên GitHub.
- **Các bước kiểm tra trong workflow:**
  1. Checkout mã nguồn và thiết lập Node.js trên `ubuntu-latest`.
  2. Cài đặt thư viện (`npm ci` nếu có `package-lock.json`, hoặc `npm install`).
  3. Chạy kiểm thử tự động (`npm test`) với biến môi trường cô lập (`CRES_DB_PATH="/tmp/cres-ci.db"`, `GEMINI_API_KEY=""`).
  4. Kiểm tra TypeScript (`npm run lint --if-present`).
  5. Đóng gói ứng dụng (`npm run build`).
- Nếu bất kỳ bước nào thất bại, toàn bộ workflow sẽ báo đỏ (fail) để ngăn hợp nhất mã lỗi.

---

## 6. Giải thích thao tác "Đặt lại đợt tuyển trống" và "Nạp dữ liệu mẫu"

Trên thanh công cụ Quản trị (hoặc qua endpoint `POST /api/admin/seed`), hệ thống cung cấp 2 thao tác quản lý dữ liệu kiểm thử được xử lý tại `server/db/seed.ts`:

### 6.1. Đặt lại đợt tuyển trống (`0 hồ sơ`)
- **API:** `POST /api/admin/seed` với body `{ "mode": "empty" }` $\rightarrow$ gọi hàm `resetCurrentRoundToEmpty()`.
- **Hành vi thực tế trong mã nguồn:**
  - Xóa toàn bộ dữ liệu phát sinh của đợt tuyển hiện tại theo đúng thứ tự khóa ngoại: `audit_logs`, `notifications`, `assignments`, `selection_decisions`, `scorecards`, `review_decisions`, `application_missing_fields`, `interview_bookings` và `applications`.
  - Xóa các tài khoản ứng viên mẫu/thử nghiệm không còn gắn với đơn ứng tuyển nào (giữ lại các tài khoản nội bộ `admin`, `hr`, `board` và tài khoản ứng viên mặc định).
  - Xóa mốc thời gian `sample_seed_t0_iso` để lần nạp mẫu kế tiếp ghi nhận mốc `T0` mới.
  - **Giữ nguyên:** Cấu hình đợt tuyển (ngưỡng $X = 75$, $Y = 50$, biên độ $= 5$, hạn bổ sung/đặt lịch), 3 ban chuyên môn cùng chỉ tiêu gốc (Truyền thông: `8`, Nhân sự: `7`, Kinh doanh: `7`), 5 tiêu chí chấm điểm và danh sách các ca phỏng vấn (bao gồm cấu hình sức chứa và ghế dự trữ của `DEMO_FULL_A`, `DEMO_FULL_B`, `DEMO_FULL_C`).
  - **Kết quả sau khi bấm:** Đợt tuyển về trạng thái trống **`0 hồ sơ`**, toàn bộ ghế mở đăng ký của các ca phỏng vấn trở về trạng thái ban đầu.

### 6.2. Nạp dữ liệu mẫu (`17 ứng viên`)
- **API:** `POST /api/admin/seed` với body `{ "mode": "sample" }` $\rightarrow$ gọi hàm `seedSample17Candidates()`.
- **Hành vi thực tế trong mã nguồn:**
  - **Khi nạp mới (sau khi đã đặt lại đợt tuyển trống):**
    1. Lấy thời gian hiện tại của đồng hồ hệ thống backend (`getSystemNow()`) làm mốc **`T0`** và lưu vào `settings.sample_seed_t0_iso`.
    2. Đồng bộ thời gian cho 3 ca phỏng vấn kiểm thử sức chứa tương ứng với `T0` (khi ca chưa có người đặt), đồng thời giữ nguyên cấu hình tổng sức chứa `capacity = 6` và số ghế dự trữ `reserved_seats`:
       - `DEMO_FULL_A`: bắt đầu `T0 + 74 giờ`, kết thúc `T0 + 75 giờ` — Tổng sức chứa `6`, dự trữ `0`, đã đặt `0` $\rightarrow$ **Còn `6/6` chỗ trống**.
       - `DEMO_FULL_B`: bắt đầu `T0 + 76 giờ`, kết thúc `T0 + 77 giờ` — Tổng sức chứa `6`, dự trữ `4`, đã đặt `0` $\rightarrow$ **Còn `2/6` chỗ trống**.
       - `DEMO_FULL_C`: bắt đầu `T0 + 78 giờ`, kết thúc `T0 + 79 giờ` — Tổng sức chứa `6`, dự trữ `5`, đã đặt `0` $\rightarrow$ **Còn `1/6` chỗ trống**.
    3. Khởi tạo **17 tài khoản ứng viên mẫu (`C01`–`C17`)** và tự động nộp **16 đơn ứng tuyển (`C01`–`C12`, `C14`–`C17`)** đi qua đúng hàm kiểm tra & sơ loại thật `runAutomatedCheckAndScreenPipeline(appId, 'system')`.
  - **Cơ chế an toàn khi bấm "Nạp dữ liệu mẫu" lặp lại mà chưa Đặt lại:**
    - Nếu phát hiện bộ ứng viên mẫu `qa.cres.01@example.com` – `qa.cres.17@example.com` đã tồn tại trong đợt tuyển (`alreadySeeded: true`), hệ thống **giữ nguyên hiện trạng**: không tạo trùng tài khoản/hồ sơ, không ghi đè tiến trình đang kiểm thử (như thông tin đã bổ sung, lịch đã đặt, phiếu điểm đã chấm), và không làm dịch chuyển mốc `T0` hay giờ của các ca phỏng vấn.

---

## 7. Chi tiết bộ dữ liệu mẫu hiện tại (Phân biệt 17 tài khoản vs 16 hồ sơ đã nộp)

Bộ dữ liệu mẫu cố định định nghĩa tại hằng số `QA_17_CANDIDATES` trong `server/db/seed.ts` gồm:
- **Tổng số tài khoản ứng viên mẫu được tạo:** **17 tài khoản** (`qa.cres.01@example.com` đến `qa.cres.17@example.com`).
- **Tổng số đơn ứng tuyển đã nộp vào bảng `applications`:** **16 hồ sơ** (`C01`–`C12` và `C14`–`C17`).
- **Tài khoản chưa nộp đơn (`submitOnSeed: false`):** **01 tài khoản — `C13` (`TEST 13 Duc Son` — `qa.cres.13@example.com`)**. Tài khoản này chỉ có bản ghi trong bảng `users` (và dữ liệu nháp hỗ trợ điền nhanh), chưa có đơn trong bảng `applications` để người chấm chủ động đăng nhập và kiểm thử thao tác nộp đơn trực tiếp hoặc nhánh lỗi gửi liên kết.

### Phân bố trạng thái ban đầu của 17 ứng viên mẫu (do logic sơ loại tự tính với $X = 75, Y = 50$, biên độ $= 5$)

| Mã UV | Họ tên hiển thị | Email đăng nhập | Trạng thái đơn ban đầu sau khi nạp mẫu | Giải thích theo dữ liệu đầu vào & Rules Engine |
| :--- | :--- | :--- | :--- | :--- |
| **C01** | `TEST 01 Minh An` | `qa.cres.01@example.com` | `invited_to_book` (Đạt rõ — Đã gửi link đặt lịch) | Đủ 8 trường bắt buộc, đạt điều kiện cứng, điểm sơ loại `100` ($\ge 75$). |
| **C02** | `TEST 02 Bao Binh` | `qa.cres.02@example.com` | `needs_supplement` (Chờ bổ sung hồ sơ) | Thiếu trường bắt buộc `phone` (chuỗi rỗng `""`). |
| **C03** | `TEST 03 Gia Chi` | `qa.cres.03@example.com` | `needs_supplement` (Chờ bổ sung hồ sơ) | Thiếu trường bắt buộc `essay` (chuỗi rỗng `""`). |
| **C04** | `TEST 04 Hoai Duong` | `qa.cres.04@example.com` | `needs_supplement` (Chờ bổ sung hồ sơ) | Thiếu trường bắt buộc `phone` (chuỗi rỗng `""`), dùng để kiểm thử nhánh quá hạn/hết lượt bổ sung. |
| **C05** | `TEST 05 Khanh Ha` | `qa.cres.05@example.com` | `needs_review` (Cần BNS xem xét) | Đủ thông tin, điểm sơ loại `63` nằm trong khoảng $[50, 75)$ $\rightarrow$ chờ BNS duyệt thủ công. |
| **C06** | `TEST 06 Ngoc Hieu` | `qa.cres.06@example.com` | `needs_review` (Cần BNS xem xét) | Đủ thông tin, điểm sơ loại `63` nằm trong khoảng $[50, 75)$ $\rightarrow$ chờ BNS duyệt thủ công. |
| **C07** | `TEST 07 Quynh Khang` | `qa.cres.07@example.com` | `rejected_docs` (Hồ sơ không đạt — Loại rõ xa ngưỡng $Y$) | Điểm sơ loại `35` ($< 45$, nằm ngoài biên độ sát ngưỡng $Y$) $\rightarrow$ tự động từ chối sơ loại. |
| **C08** | `TEST 08 Thanh Lam` | `qa.cres.08@example.com` | `clear_fail` (`is_near_threshold = 1` — Sát ngưỡng $Y$) | Điểm sơ loại `47` nằm trong vùng sát ngưỡng $[45, 50)$ $\rightarrow$ tạm giữ để BNS kiểm tra trước khi xác nhận từ chối hoặc cứu xét. |
| **C09–C12** | `TEST 09` – `TEST 12` | `qa.cres.09` – `12@example.com` | `invited_to_book` (Đạt rõ — Đã gửi link đặt lịch) | Đủ thông tin, đạt điều kiện cứng, điểm sơ loại `100` ($\ge 75$), sẵn sàng để tự kiểm thử đặt lịch/phỏng vấn/phân ban. |
| **C13** | `TEST 13 Duc Son` | `qa.cres.13@example.com` | *(Chưa nộp đơn — `application: null`)* | Chỉ tạo tài khoản đăng nhập để người chấm tự thao tác nộp đơn mới. |
| **C14–C17** | `TEST 14` – `TEST 17` | `qa.cres.14` – `17@example.com` | `invited_to_book` (Đạt rõ — Đã gửi link đặt lịch) | Đủ thông tin, đạt điều kiện cứng, điểm sơ loại `100` ($\ge 75$), dùng cho các kịch bản đặt lịch, nhắc lịch, quá hạn, phỏng vấn và phân ban. |

---

## 8. Những giới hạn và cơ chế kỹ thuật xác minh từ mã nguồn

Khi đánh giá và vận hành ứng dụng, người chấm có thể đối chiếu 4 cơ chế/giới hạn thiết kế sau trực tiếp trong mã nguồn:

1. **Hộp thư thông báo mô phỏng (Simulated Outbox — Không gửi Email/SMS thật):**
   - Tại `server/services/notificationService.ts`, phương thức `NotificationService.send()` không kết nối tới máy chủ SMTP hay cổng SMS bên ngoài.
   - Mọi thông báo (xác nhận nộp đơn, yêu cầu bổ sung, thư từ chối sơ loại, lời mời đặt lịch, nhắc lịch sau 1 ngày, thông báo quá hạn, kết quả phỏng vấn, kết quả phân ban) đều được nội suy từ mẫu (`notification_templates`) và ghi trực tiếp vào bảng `notifications` trong SQLite với trạng thái `sent`.
   - Cách thiết kế này giúp kiểm thử an toàn với các địa chỉ email giả định (`@example.com`, `@due.udn.vn`) và cho phép đối chiếu ngay nội dung thư trên giao diện ứng viên cũng như tab **Hộp thư & Mẫu TB** của BNS.

2. **Cơ chế AI gợi ý phân ban kết hợp Luật dự phòng xác định (Hybrid AI + Deterministic Fallback):**
   - Tại `server/services/aiAssignmentService.ts`, hệ thống chỉ gọi Gemini API (`@google/genai`) ở bước duy nhất là gợi ý phân ban (`GET /api/assignments/suggest`) khi có biến môi trường `GEMINI_API_KEY` hợp lệ và không ở chế độ test (`CRES_TEST_MODE !== 'true'`).
   - Ngay cả khi Gemini trả về kết quả, mã nguồn vẫn kiểm tra nghiêm ngặt bằng thuật toán: tất cả ứng viên phải có mặt, mã ban hợp lệ và số lượng phân vào từng ban **không được vượt quá `remainingQuota`**.
   - Nếu không cấu hình `GEMINI_API_KEY`, gặp lỗi kết nối/hạn mức, hoặc kết quả AI vi phạm ràng buộc chỉ tiêu, hệ thống tự động chuyển sang hàm dự phòng `fallbackAssignmentSuggestion()` (`server/rules/rulesEngine.ts`) để xếp ứng viên theo điểm phỏng vấn giảm dần, ưu tiên Nguyện vọng 1 $\rightarrow$ Nguyện vọng 2 $\rightarrow$ ban còn chỉ tiêu. Quyết định cuối cùng luôn do BNS bấm **Xác nhận phân công** (`POST /api/assignments/confirm`).

3. **Đặc điểm lưu trữ SQLite và đường dẫn mặc định (`/tmp/cres-recruit.db`):**
   - Tại `server/db/database.ts`, đường dẫn tệp cơ sở dữ liệu được xác định bởi:
     `const dbPath = process.env.CRES_DB_PATH || path.join(os.tmpdir(), 'cres-recruit.db');`
   - Dữ liệu được lưu bền vững qua mọi lần tải lại trang trình duyệt (F5) và qua các lần khởi động lại tiến trình Node.js trong cùng một phiên máy/container. Tuy nhiên, nếu chạy trên môi trường container đám mây phi trạng thái (stateless container) mà không cấu hình `CRES_DB_PATH` sang ổ đĩa gắn ngoài (persistent volume), dữ liệu trong `/tmp` sẽ được khởi tạo lại khi container bị cấp phát mới.

4. **Đồng hồ ảo (`virtual_offset_ms`) và Công thức tính chỗ trống có ghế dự trữ (`reserved_seats`):**
   - Để kiểm thử các bộ đếm thời gian (`1` ngày nhắc đặt lịch, `2` ngày quá hạn bổ sung hoặc quá hạn đặt lịch) mà không phải chờ thời gian thực, hệ thống sử dụng hàm `getSystemNow()` (`server/db/database.ts`) cộng độ lệch `virtual_offset_ms` khi người dùng bấm nút **Tua thời gian** (`POST /api/admin/time-travel`) và kích hoạt ngay `runTimerTick()` (`server/jobs/timerScheduler.ts`).
   - Số chỗ còn trống của mỗi ca phỏng vấn luôn được tính từ backend theo công thức tại `computeSlotAvailableSeats()` (`server/rules/rulesEngine.ts`):
     $$\text{Chỗ trống (`available\_seats`)} = \max(0, \text{Tổng sức chứa (`capacity`)} - \text{Booking đang giữ chỗ (`booked\_count`)} - \text{Ghế dự trữ (`reserved\_seats`)})$$
