# Tài Liệu Kiểm Thử Hệ Thống C-RES Recruit (`docs/TESTING.md`)

Tài liệu này mô tả cấu trúc kiểm thử hiện có của dự án **C-RES Recruit**, cách chạy kiểm thử tại máy cục bộ, cách đọc kết quả từ trình chạy `node:test`, cách theo dõi quy trình tích hợp liên tục (CI) trên **GitHub Actions (`C-RES Tests`)**, và ranh giới giữa kiểm thử tự động với kiểm thử thủ công.

Toàn bộ lệnh, đường dẫn tệp và kết quả trong tài liệu được trích xuất trực tiếp từ `package.json`, `server/rules/rulesEngine.test.ts`, `server/routes/api.integration.test.ts` và `.github/workflows/cres-tests.yml`.

---

## 1. Những loại kiểm thử hiện có và mục đích của từng nhóm

Hệ thống kiểm thử tự động của dự án gồm **2 nhóm chính** (tổng cộng **15 bài kiểm thử**):

### 1.1. Kiểm thử đơn vị — Unit Tests (`server/rules/rulesEngine.test.ts` — 9 bài test)
- **Mục đích:** Kiểm tra tính đúng đắn và tất định (deterministic) của các hàm nghiệp vụ thuần túy (pure functions) trong `server/rules/rulesEngine.ts` mà không phụ thuộc vào cơ sở dữ liệu, mạng hay giao diện.
- **Danh sách 9 bài kiểm thử trong tệp `server/rules/rulesEngine.test.ts`:**
  1. `checkRequiredFields identifies missing mandatory fields accurately`: Phát hiện chính xác các trường bắt buộc bị bỏ trống hoặc chỉ chứa khoảng trắng (`full_name`, `student_id`, `class_name`, `email`, `phone`, `first_choice_dept_id`, `experience`, `essay`).
  2. `screenByThreshold routes into clear_pass, needs_review, and clear_fail`: Phân nhánh sơ loại theo ngưỡng $X = 75, Y = 50$ và ép về `clear_fail` khi vi phạm điều kiện cứng (`hardConditionsPassed = false`).
  3. `isNearThreshold detects clear_fail scores within configured margin of Y`: Xác định đúng vùng điểm sát ngưỡng $[Y - \text{margin}, Y) = [45, 50)$ khi đạt điều kiện cứng.
  4. `computeTotalScore calculates weighted normalized score and preserves 0.00 score (F04)`: Tính điểm phỏng vấn trung bình có trọng số chuẩn hóa thang 100 và bảo toàn điểm `0` hợp lệ (không bị rơi về `null` hoặc điểm mặc định).
  5. `canBook and computeSlotAvailableSeats enforce capacity, reserved_seats, duplicate booking, and start time`: Kiểm tra công thức tính chỗ trống `available_seats = max(0, capacity - booked_count - reserved_seats)` (gồm cấu hình ca `DEMO_FULL_C` có `capacity = 6, reserved_seats = 5`), chặn đặt trùng ca hoặc ca đã đầy.
  6. `shouldRemind and shouldDrop evaluate 1-day and 2-day timers accurately`: Đánh giá điều kiện gửi thư nhắc đặt lịch đúng 1 lần sau `1` ngày và điều kiện loại hồ sơ không đặt lịch sau `2` ngày.
  7. `canConvergeInterviewAndJoin requires both check-in and minimum scorecards (F10)`: Kiểm tra cổng hội tụ song song (`AND-join`) đòi hỏi đồng thời đã `Check-in` và đủ số phiếu chấm tối thiểu.
  8. `fallbackAssignmentSuggestion respects department quotas and returns empty departmentId when all quotas are 0`: Kiểm tra thuật toán dự phòng phân ban theo điểm phỏng vấn + nguyện vọng 1/2 mà không vượt trần `remainingQuota`.
  9. `isValidStateTransition enforces strict To-Be state machine rules and prevents stage skipping (F03)`: Kiểm tra bảng chuyển trạng thái hợp lệ gồm 25 trạng thái (`ALL_APPLICATION_STATUSES`), chặn nhảy cóc giai đoạn hoặc đi ngược từ trạng thái kết thúc.

### 1.2. Kiểm thử tích hợp REST API — API Integration Tests (`server/routes/api.integration.test.ts` — 6 bộ test)
- **Mục đích:** Khởi chạy ứng dụng Express (`apiRouter`) trên cổng cục bộ ngẫu nhiên (`127.0.0.1:0`) gắn với một tệp cơ sở dữ liệu SQLite tạm độc lập để kiểm tra toàn bộ vòng đời HTTP request/response, xác thực JWT, phân quyền RBAC (`candidate`, `hr`, `board`, `admin`), giao dịch SQLite và nhật ký `audit_logs`.
- **Danh sách 6 bộ kiểm thử trong tệp `server/routes/api.integration.test.ts`:**
  1. `F12 & F13: Seed empty vs sample modes (17 accounts, 16 applications, C13 unsubmitted, DEMO_FULL_A/B/C T0 sync, and clean reset)`: Kiểm tra chu kỳ `Đặt lại về 0` $\rightarrow$ `Nạp mẫu (17 tài khoản, 16 đơn, C13 chưa nộp)` $\rightarrow$ sửa dữ liệu `C02` $\rightarrow$ bấm `Nạp mẫu` lặp lại không ghi đè tiến trình hay đổi mốc `T0` $\rightarrow$ `Đặt lại về 0` $\rightarrow$ `Nạp mẫu lại từ đầu`; đồng thời kiểm tra đặt chỗ/chặn ca đầy/hủy trả chỗ trên `DEMO_FULL_A` (`6/6`), `DEMO_FULL_B` (`2/6`, dự trữ `4`), `DEMO_FULL_C` (`1/6`, dự trữ `5`).
  2. `F01: /admin/test-screening returns nested evaluation object and maps both camelCase and snake_case inputs`: Kiểm tra API kiểm thử luật sơ loại `/api/admin/test-screening`.
  3. `F08 & F09: /slots and /admin/settings validate dates, timezones, thresholds, and quotas strictly`: Kiểm tra ràng buộc dữ liệu đầu vào khi tạo ca phỏng vấn (`end_at > start_at`, múi giờ `+07:00`) và khi lưu cài đặt ($X > Y$, `remind_after_days < unbook_after_days`, `quota >= 0`).
  4. `F11: POST /applications blocks submissions when round is closed or expired`: Chặn nộp đơn mới khi đợt tuyển ở trạng thái `closed`.
  5. `F02, F03, F04, F05, F06, F07, F10: Full workflow + RBAC, PII protection, 0-score preservation, parallel AND-join, and assignment integrity`: Kiểm tra luồng tích hợp đầu-cuối, chặn chéo quyền giữa HR và BCN (`403`), ẩn thông tin cá nhân ứng viên khác trong `GET /api/slots`, chặn đặt lịch khi đã quá hạn (`no_booking`), chấm phiếu điểm `0` trước khi Check-in không tự động Check-in và giữ đúng điểm `0`, hội tụ `AND-join` khi Check-in, chốt gửi thông báo, chặn phân ban trước khi ứng viên xác nhận tham gia, chốt phân ban và rút đơn sau phân công (`withdrawn` + `assignment.status = 'revoked'` hoàn trả chỉ tiêu).
  6. `Edge Cases: Missing info supplement loop, expired deadline, min_scorecards_per_interview = 2, and quota overflow`: Kiểm tra nộp thiếu thông tin $\rightarrow$ bổ sung lần 1 vẫn thiếu $\rightarrow$ tua thời gian `/api/admin/time-travel` `+3 ngày` chuyển sang `expired_supplement`; cấu hình `min_scorecards_per_interview = 2` chặn quyết định Đậu/Rớt khi mới có 1 phiếu chấm; và chặn chốt phân ban khi `quota = 0`.

---

## 2. Cơ chế cô lập Cơ sở dữ liệu tạm, Thời gian giả lập và AI/Outbox trong Kiểm thử

Đúng theo mã nguồn hiện tại, kiểm thử tự động được thiết kế cô lập để không ảnh hưởng đến dữ liệu đang chạy của ứng dụng:

1. **Cơ sở dữ liệu SQLite tạm (`CRES_DB_PATH`):**
   - Tại đầu tệp `server/routes/api.integration.test.ts` (dòng 9–13), trước khi nạp `database.ts`, bài test gán:
     ```ts
     const testDbPath = path.join(
       os.tmpdir(),
       `cres-recruit-integration-test-${process.pid}-${Date.now()}.db`
     );
     process.env.CRES_DB_PATH = testDbPath;
     ```
   - Khi kết thúc toàn bộ bài test, hook `after()` (dòng 67–85) đóng kết nối SQLite và xóa sạch cả 3 tệp `testDbPath`, `testDbPath-wal` và `testDbPath-shm`. Dữ liệu của môi trường Preview hoặc bản triển khai hoàn toàn không bị tác động.
2. **Cơ chế thời gian giả lập (Không cần đợi 1–2 ngày thực):**
   - Trong unit test (`rulesEngine.test.ts`), các hàm `shouldRemind` và `shouldDrop` nhận trực tiếp mốc thời gian `nowMs` giả lập.
   - Trong integration test (`api.integration.test.ts`), bài test gọi endpoint `POST /api/admin/time-travel` (cộng độ lệch vào `settings.virtual_offset_ms` và kích hoạt `runTimerTick()` ngay lập tức) hoặc cập nhật mốc hạn trong DB tạm để kiểm tra quá hạn trong vài mili-giây.
3. **Cơ chế AI gợi ý phân ban và Hộp thư mô phỏng trong kiểm thử:**
   - **AI gợi ý phân ban (`server/services/aiAssignmentService.ts`):** Trong workflow CI (`.github/workflows/cres-tests.yml`), biến `GEMINI_API_KEY` được đặt rỗng (`""`). Ngoài ra, `aiAssignmentService.ts` hỗ trợ cờ `CRES_TEST_MODE="true"` và hàm `setMockAiGenerator(...)`. Khi không có khóa API thật, hệ thống tự động chạy thuật toán dự phòng `fallbackAssignmentSuggestion()` mà không phát sinh kết nối mạng ra ngoài.
   - **Thông báo mô phỏng (`server/services/notificationService.ts`):** Mọi thông báo trong quá trình test chỉ ghi vào bảng `notifications` của tệp SQLite tạm, không gửi email hay SMS ra bên ngoài.

---

## 3. Điều kiện môi trường và lệnh chạy test thực tế

### 3.1. Điều kiện môi trường
- **Node.js:** Phiên bản $\ge$ 22.x (môi trường phát triển cục bộ chạy `Node v22.23.2`, workflow GitHub Actions chạy `Node 24`).
- **Thư viện:** Đã chạy `npm install` đầy đủ (bao gồm `tsx` để thực thi TypeScript và `better-sqlite3` cho SQLite).

### 3.2. Các lệnh chạy kiểm thử (theo `package.json`)

```bash
# Chạy toàn bộ bộ kiểm thử (Unit Tests + API Integration Tests)
npm test

# Chỉ chạy 9 bài Unit Test của Rules Engine & State Machine
npm run test:unit

# Chỉ chạy 6 bộ API Integration Test trên DB SQLite tạm
npm run test:api
```

---

## 4. Cách đọc các chỉ số `tests`, `pass`, `fail`, `skipped` và `cancelled`

Trình chạy kiểm thử tích hợp của Node.js (`tsx --test`, sử dụng `node:test`) xuất kết quả theo chuẩn **TAP version 13** và tổng kết ở cuối log với các chỉ số sau:

- **`# tests <N>`**: Tổng số bài kiểm thử cấp cao nhất (`test(...)`) đã được đăng ký và thực thi trong lần chạy đó.
- **`# pass <N>`**: Số bài kiểm thử vượt qua toàn bộ các khẳng định (`assert.*`) mà không ném ra ngoại lệ.
- **`# fail <N>`**: Số bài kiểm thử bị thất bại (do `AssertionError`, lỗi runtime hoặc trả về mã HTTP sai). Nếu `fail > 0`, tiến trình kết thúc với mã lỗi khác `0` (`exit code != 0`).
- **`# skipped <N>`**: Số bài kiểm thử bị bỏ qua có chủ đích (ví dụ đánh dấu `{ skip: true }` hoặc `t.skip()`). Bài bị skip không được tính là đã kiểm chứng thành công.
- **`# cancelled <N>`**: Số bài kiểm thử bị hủy giữa chừng (thường do quá thời gian chờ `timeout` hoặc do `AbortSignal`).
- **`# duration_ms <N>`**: Tổng thời gian thực thi toàn bộ bộ kiểm thử tính bằng mili-giây.

### Log kết quả chạy thực tế đã xác minh trên môi trường dự án

Dưới đây là kết quả thực tế khi chạy lệnh `npm test`:

```text
> react-example@0.0.0 test
> tsx --test server/rules/rulesEngine.test.ts server/routes/api.integration.test.ts

TAP version 13
ok 1 - F12 & F13: Seed empty vs sample modes (17 accounts, 16 applications, C13 unsubmitted, DEMO_FULL_A/B/C T0 sync, and clean reset)
ok 2 - F01: /admin/test-screening returns nested evaluation object and maps both camelCase and snake_case inputs
ok 3 - F08 & F09: /slots and /admin/settings validate dates, timezones, thresholds, and quotas strictly
ok 4 - F11: POST /applications blocks submissions when round is closed or expired
ok 5 - F02, F03, F04, F05, F06, F07, F10: Full workflow + RBAC, PII protection, 0-score preservation, parallel AND-join, and assignment integrity
ok 6 - Edge Cases: Missing info supplement loop, expired deadline, min_scorecards_per_interview = 2, and quota overflow
ok 7 - checkRequiredFields identifies missing mandatory fields accurately
ok 8 - screenByThreshold routes into clear_pass, needs_review, and clear_fail
ok 9 - isNearThreshold detects clear_fail scores within configured margin of Y
ok 10 - computeTotalScore calculates weighted normalized score and preserves 0.00 score (F04)
ok 11 - canBook and computeSlotAvailableSeats enforce capacity, reserved_seats, duplicate booking, and start time
ok 12 - shouldRemind and shouldDrop evaluate 1-day and 2-day timers accurately
ok 13 - canConvergeInterviewAndJoin requires both check-in and minimum scorecards (F10)
ok 14 - fallbackAssignmentSuggestion respects department quotas and returns empty departmentId when all quotas are 0
ok 15 - isValidStateTransition enforces strict To-Be state machine rules and prevents stage skipping (F03)
1..15
# tests 15
# suites 0
# pass 15
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 2961.335305
```

---

## 5. Cách chạy kiểm tra TypeScript và Build theo script đang có

Ngoài `npm test`, dự án cung cấp 2 lệnh kiểm tra tĩnh và đóng gói trong `package.json`:

```bash
# 1. Kiểm tra kiểu dữ liệu TypeScript toàn bộ dự án (thực thi: tsc --noEmit)
npm run lint

# 2. Đóng gói bản build giao diện Production vào thư mục dist/ (thực thi: vite build)
npm run build
```

- Khi `npm run lint` đạt: Lệnh kết thúc với `exit code 0` và không in ra thông báo lỗi kiểu dữ liệu (`TSxxxx`).
- Khi `npm run build` đạt: Vite biên dịch toàn bộ mô-đun TypeScript/React + Tailwind CSS và tạo thư mục `dist/` thành công.

---

## 6. Cách xem kết quả trên GitHub Actions

Dự án sử dụng workflow `.github/workflows/cres-tests.yml` với tên hiển thị **`C-RES Tests`**:

1. Mở kho mã nguồn (repository) trên trình duyệt GitHub.
2. Bấm vào tab **`Actions`** trên thanh điều hướng phía trên.
3. Ở cột bên trái, chọn workflow **`C-RES Tests`**.
4. **Cách kích hoạt:**
   - **Tự động:** Mỗi khi có lệnh `git push` hoặc mở/cập nhật `pull_request` vào nhánh `main`.
   - **Thủ công:** Bấm nút **`Run workflow`** ở góc phải $\rightarrow$ chọn nhánh `main` $\rightarrow$ bấm nút xanh **`Run workflow`** (`workflow_dispatch`).
5. **Cách xem chi tiết từng bước:**
   - Bấm vào dòng lượt chạy (workflow run) mới nhất $\rightarrow$ bấm vào job **`Test and Build`**.
   - Mở rộng từng bước để xem log chi tiết:
     - `Lay ma nguon` (`actions/checkout@v6`)
     - `Cai Node.js` (`actions/setup-node@v7`, Node `24`)
     - `Cai thu vien` (`npm ci` hoặc `npm install`)
     - `Chay kiem thu tu dong` (`npm test`)
     - `Kiem tra TypeScript` (`npm run lint --if-present`)
     - `Build ung dung` (`npm run build`)

---

## 7. Cách phân biệt Lỗi cài môi trường, Lỗi test và Lỗi build

Khi một lượt chạy kiểm tra (trên máy cục bộ hoặc trên GitHub Actions) bị dừng với dấu chéo đỏ, có thể xác định nguyên nhân dựa vào bước bị lỗi và thông điệp trong log:

| Loại lỗi | Bước xảy ra lỗi trong CI / Lệnh tương ứng | Dấu hiệu nhận biết trong Log | Cách khắc phục |
| :--- | :--- | :--- | :--- |
| **1. Lỗi cài môi trường (Environment / Dependency Error)** | Bước `Cai Node.js` hoặc `Cai thu vien` (`npm ci` / `npm install`) | • `npm ERR! ERESOLVE unable to resolve dependency tree`<br>• Lỗi biên dịch native addon `better-sqlite3` (`node-gyp`, `Could not locate the bindings file`)<br>• Không tìm thấy lệnh `tsx: not found` | Kiểm tra phiên bản Node.js tương thích, xóa `node_modules` và chạy lại `npm install` để tải đúng binary của `better-sqlite3` cho hệ điều hành đang dùng. |
| **2. Lỗi kiểm thử (Test Failure)** | Bước `Chay kiem thu tu dong` (`npm test`) | • Xuất hiện dòng `not ok <N> - <Tên bài test>` trong log TAP.<br>• Có `AssertionError [ERR_ASSERTION]: Expected values to be strictly equal` (ví dụ trả về HTTP `200` thay vì `403`, hoặc sai trạng thái `status`).<br>• Cuối log có `# fail <N>` lớn hơn `0`. | Đọc stack trace ngay dưới dòng `not ok <N>` để biết dòng `assert.equal(...)` nào bị sai, đối chiếu lại logic trong `server/rules/rulesEngine.ts`, `server/services/stateMachine.ts` hoặc `server/routes/api.ts`. **Tuyệt đối không xóa assertion hay sửa kết quả kỳ vọng sai nghiệp vụ chỉ để làm xanh bài test.** |
| **3. Lỗi kiểu dữ liệu hoặc Lỗi đóng gói (TypeScript / Build Failure)** | Bước `Kiem tra TypeScript` (`npm run lint`) hoặc `Build ung dung` (`npm run build`) | • Lỗi `error TS2322: Type '...' is not assignable to type '...'` hoặc `error TS2339: Property '...' does not exist`<br>• Lỗi Vite/Rollup: `Could not resolve "..." from "src/..."` hoặc lỗi cú pháp JSX/CSS. | Sửa đúng định nghĩa kiểu trong `src/types.ts` hoặc các đường dẫn `import` bị thiếu, sau đó chạy lại `npm run lint` và `npm run build` tại máy cục bộ trước khi đẩy lên GitHub. |

---

## 8. Phân biệt Kiểm thử tự động với Kiểm thử thủ công bằng bộ ứng viên Demo (`C01`–`C17`)

| Tiêu chí | Kiểm thử tự động (`npm test` / GitHub Actions) | Kiểm thử thủ công bằng bộ ứng viên Demo (`C01`–`C17`) |
| :--- | :--- | :--- |
| **Mục tiêu** | Xác minh nhanh, lặp lại được và tự động hóa các quy tắc tính điểm, chuyển trạng thái, kiểm soát quyền RBAC ở tầng hàm (Unit) và tầng giao tiếp REST API (Integration). | Trình diễn trực quan trên giao diện trình duyệt (UI/UX), phục vụ người chấm và quay video demo 6 ngày giả lập theo từng vai trò (`Ứng viên`, `Ban Nhân sự`, `Ban Chủ nhiệm`). |
| **Cơ sở dữ liệu** | Dùng tệp SQLite tạm riêng biệt (`cres-recruit-integration-test-...db`), tự động tạo mới khi bắt đầu và tự động xóa sạch ngay khi chạy xong. | Dùng cơ sở dữ liệu đang chạy của website (`CRES_DB_PATH`), giữ nguyên trạng thái qua các lần tải lại trang để người kiểm thử tự thao tác từng bước. |
| **Dữ liệu sử dụng** | Tự khởi tạo dữ liệu cô lập trong từng bài test và tự gọi các API theo kịch bản lập trình sẵn. | Khởi tạo qua nút **`Nạp dữ liệu mẫu (17 ứng viên)`** (tạo 17 tài khoản `C01`–`C17`, 16 đơn đã nộp qua sơ loại và `C13` chưa nộp) kèm 3 ca `DEMO_FULL_A/B/C`; hệ thống **không** tự đặt lịch hay chấm điểm thay người dùng. |
| **Cách kiểm tra thời gian** | Gọi API `/api/admin/time-travel` hoặc truyền tham số thời gian giả lập trong code test (hoàn tất trong ~3 giây). | Người dùng chủ động bấm nút **`Timer +1 ngày (Nhắc lịch)`** / **`Timer +2 ngày (Quá hạn / Gạch tên)`** hoặc **`Tua nhanh +1 ngày` / `+2 ngày`** trên giao diện và quan sát sự thay đổi trực tiếp. |

---

## 9. Phạm vi xác nhận của kết quả kiểm thử (Lưu ý quan trọng khi báo cáo)

Việc bộ kiểm thử tự động chạy đạt (**`pass 15, fail 0`**) và các bước `lint` / `build` báo xanh **chỉ xác nhận đúng những kịch bản, nhánh logic và khẳng định (`assert`) đã được viết và thực thi trong phiên bản mã nguồn tại thời điểm chạy đó**:

1. **Những gì bộ test tự động đã xác nhận:**
   - 9 quy tắc nghiệp vụ cốt lõi trong `server/rules/rulesEngine.test.ts` và 6 kịch bản tích hợp API trong `server/routes/api.integration.test.ts` (gồm sơ loại, bổ sung quá hạn, đặt lịch/ca đầy/ghế dự trữ/hủy chỗ, phân quyền RBAC giữa Ứng viên - BNS - BCN, ẩn PII ứng viên khác, cổng hội tụ song song `AND-join` với 1 và 2 phiếu chấm, bảo toàn điểm `0.00`, phân ban theo chỉ tiêu, rút đơn thu hồi phân công `revoked`, và chu kỳ Đặt lại 0 hồ sơ $\leftrightarrow$ Nạp 17 ứng viên mẫu).
2. **Những gì bộ test tự động KHÔNG tự động chứng minh thay cho kiểm thử thực tế:**
   - Bộ test hiện tại chạy ở tầng hàm và tầng HTTP API (`fetch`), **không phải** bài kiểm thử trình duyệt tự động (E2E Browser UI) cho mọi thao tác bấm chuột hay bố cục hiển thị trên màn hình. Do đó, việc kiểm thử giao diện và quay video theo `docs/DEMO_GUIDE.md` vẫn là bước bắt buộc để xác nhận trải nghiệm người dùng.
   - Các dịch vụ bên ngoài như gửi email/SMS thật không được tích hợp (hệ thống dùng Hộp thư mô phỏng trong SQLite), và bước gợi ý phân ban trong môi trường CI chạy qua nhánh thuật toán dự phòng khi `GEMINI_API_KEY` để trống.
   - Nếu mã nguồn, cấu hình hoặc tệp kiểm thử được chỉnh sửa sau lần chạy này, cần phải chạy lại `npm test`, `npm run lint` và `npm run build` (hoặc kiểm tra lại log mới nhất trên GitHub Actions) trước khi ghi nhận kết quả mới vào báo cáo.
