# Kết quả kiểm thử mã nguồn C-RES Recruit

Ngày kiểm tra: 05/11/2026, giờ Việt Nam.

Mã nguồn: bản ZIP người dùng cung cấp trong cuộc trò chuyện. Căn cứ nghiệp vụ là sơ đồ To-Be và bài thực hành 3.2; không dùng bài 3.1 làm căn cứ đánh giá. Việc kiểm tra lần này chỉ chạy trên bản sao cục bộ với SQLite và dữ liệu giả, không thay đổi website đang triển khai. Chưa sửa mã nguồn ứng dụng.

## Kết luận

Luồng chính có thể chạy từ nộp đơn đến hoàn tất phân công và rút đơn. Tuy nhiên, các API vẫn cho phép bỏ qua bước và tạo dữ liệu không nhất quán. Cần xử lý các lỗi về quyết định tuyển chọn, điểm phỏng vấn, phân ban và hợp đồng dữ liệu frontend–backend trước khi coi bản demo là mô hình To-Be được thực thi đầy đủ.

## Những gì đã chạy

| Hạng mục | Kết quả và giới hạn |
|---|---|
| 9 unit test có sẵn | 9/9 đạt; đây là test các hàm luật, không phải kiểm thử toàn bộ ứng dụng |
| TypeScript `npm run lint` | Đạt |
| `npm run build` | Đạt sau khi cài phụ thuộc bằng tùy chọn `--legacy-peer-deps` |
| Cài đặt theo README bằng `npm install` | Thất bại ERESOLVE: esbuild 0.25 của dự án không khớp peer dependency esbuild 0.27/0.28 của phiên bản Vite được npm giải quyết |
| Kiểm thử API tích hợp | Chạy 16 nhóm kịch bản với tài khoản, đơn đăng ký và ca phỏng vấn giả trong database tạm riêng |
| AI phân công | Thử đường dự phòng theo luật khi không cấu hình API key; chưa xác minh lời gọi Gemini thực tế |
| Email | Đã kiểm tra bản ghi thông báo trong database; không có gửi thư thật trong bộ kiểm thử |

Các luồng đạt trong dữ liệu thử: hồ sơ đủ thông tin → mời đặt lịch; bổ sung đủ → mời đặt lịch; hai lần bổ sung vẫn thiếu → kết thúc quá hạn; nhánh cần xem xét → BNS duyệt; hồ sơ 45 điểm giữ lại để xem sát ngưỡng; hồ sơ 43 điểm tự loại; đặt lịch → check-in → phiếu chấm → BCN quyết định → chốt thông báo → ứng viên xác nhận → gợi ý phân ban → BNS chốt → hoàn tất; rút đơn sau phân công thu hồi bản ghi phân công. Timer gửi một lời nhắc, không gửi lặp ở lần quét tiếp theo; sau hai ngày xử lý không đặt lịch và quá hạn bổ sung đúng trạng thái trong ca thử.

## Các lỗi đã tái hiện

Mức Cao: làm sai kết quả tuyển chọn, phá trạng thái hoặc lộ dữ liệu. Mức Trung bình: sai kiểm tra đầu vào, thời hạn hoặc chức năng hỗ trợ. Mức Thấp: nhãn, số liệu trình bày hoặc tài liệu gây hiểu nhầm.

### F01 — Cao — Bộ kiểm thử luật gây trang trắng và bỏ qua dữ liệu người nhập

- Vị trí: `src/components/DashboardAndAdmin.tsx:164`, `:756`; `server/routes/api.ts:2518`.
- Tái hiện: mở Cài đặt → giữ dữ liệu mặc định → Chạy kiểm thử luật. API trả `score`, `branch` ở cấp ngoài; giao diện đọc `testResult.evaluation.totalScore`, `evaluation.branch`, `evaluation.explanation`.
- Kết quả: lỗi đọc `totalScore` từ `undefined`, phù hợp lỗi đã quan sát trên website.
- Lỗi đi kèm: giao diện gửi `timeCommitmentConfirmed`, API đọc `commitment_confirmed`. Gửi `{timeCommitmentConfirmed:false}` vẫn nhận `hardConditionsPassed:true`; gửi tên trường API đúng mới nhận `false`. GPA và số ca rảnh trên giao diện cũng không được API dùng.
- Cần sửa: thống nhất cả request và response, khai báo kiểu dữ liệu thay cho `any`, cập nhật trường thử nghiệm theo luật đang dùng, xử lý response thiếu trước khi render. Chỉ sửa đường dẫn đọc điểm là chưa đủ.

### F02 — Cao — Quyết định đậu/rớt bỏ qua điều kiện và sai phạm vi vai trò

- Vị trí: `server/routes/api.ts:1338`.
- Tái hiện cục bộ: hồ sơ `needs_supplement`, chưa đặt lịch, chưa có phiếu chấm; dùng vai trò HR gọi API quyết định `pass`.
- Kết quả: HTTP 200, chuyển `decided_pass`. Hồ sơ `withdrawn` cũng bị đưa lại thành `decided_pass` bằng API này.
- Nguyên nhân: API cho HR quyền quyết định, không chặn trạng thái đầu vào, không yêu cầu đủ phiếu điểm và cập nhật SQL trực tiếp thay vì gọi `transition()`.
- Cần sửa: quyết định tuyển chọn thuộc BCN theo bài 3.2; yêu cầu đúng giai đoạn, đủ dữ liệu phỏng vấn, chặn hồ sơ đã kết thúc/rút. Nếu cần mở lại hồ sơ, dùng thao tác riêng có lý do và kiểm soát rõ ràng.

### F03 — Cao — API nhận cả trạng thái không tồn tại

- Vị trí: `server/routes/api.ts:1444`.
- Tái hiện: HR gửi `PUT /api/applications/{id}/status` với `{"status":"QA_UNKNOWN_STATUS"}`.
- Kết quả: HTTP 200 và database lưu nguyên trạng thái này.
- Hệ quả: hồ sơ có thể biến mất khỏi hàng chờ, bộ lọc và các job chỉ xử lý những trạng thái đã biết. Các chuyển bước tùy ý còn có thể bỏ qua việc thu hồi phân công, gửi thông báo hoặc hủy timer.
- Cần sửa: dùng enum và state machine trung tâm, kiểm tra quyền trên từng chuyển bước, cập nhật toàn bộ dữ liệu liên quan trong transaction. Không chỉ kiểm tra chuỗi có rỗng hay không.

### F04 — Cao — Phỏng vấn 0 điểm bị thay thành 100 điểm

- Vị trí: `server/routes/api.ts:1381`, `:1504`; logic tương tự trong dữ liệu tổng hợp xét tuyển.
- Tái hiện: hồ sơ có điểm sơ loại 100; nộp phiếu phỏng vấn với tất cả tiêu chí bằng 0; gọi API quyết định kết quả.
- Kết quả: bản ghi `selection_decisions.total_score` là 100, dù điểm phỏng vấn thực tế bằng 0.
- Nguyên nhân: dùng `computedScore > 0 ? computedScore : app.screening_score ?? 85`, coi điểm 0 là chưa có dữ liệu.
- Cần sửa: phân biệt không có phiếu chấm với có phiếu chấm đạt 0 điểm. Khi có đủ phiếu hợp lệ, bảo toàn điểm 0; khi chưa có đủ phiếu, chặn quyết định thay vì lấy điểm sơ loại thay thế.

### F05 — Cao — Hoàn tất quy trình dù không có bản ghi phân công

- Vị trí: `server/routes/api.ts:1896`, đặc biệt đoạn cập nhật assignments tại `:1973`.
- Tái hiện: hồ sơ đã `confirmed_joined`, chưa chạy gợi ý và chưa có dòng trong bảng assignments; gửi danh sách phân công trực tiếp đến `/api/assignments/confirm`.
- Kết quả: API báo chốt thành công, hồ sơ chuyển `completed`, nhưng bảng assignments không có bản ghi của ứng viên đó.
- Nguyên nhân: câu lệnh UPDATE không kiểm tra số dòng thay đổi; bước chuyển trạng thái vẫn tiếp tục.
- Cần sửa: tạo hoặc xác nhận bản ghi phân công hợp lệ trong cùng transaction; chỉ hoàn tất khi bản ghi tồn tại, đúng ban và đã xác nhận. Bảo đảm chỉ tiêu cũng được tính từ cùng dữ liệu đó.

### F06 — Trung bình — Vẫn đặt lịch được sau hạn hai ngày nếu job chưa quét

- Vị trí: `server/routes/api.ts:982`; `server/jobs/timerScheduler.ts`.
- Tái hiện: cho hồ sơ vượt `schedule_deadline_at`, chưa gọi job quét; đặt một ca còn ở tương lai.
- Kết quả: HTTP 200, hồ sơ chuyển `booked` và deadline bị xóa.
- Cần sửa: kiểm tra hạn ngay trong API đặt lịch bằng đồng hồ hệ thống đang dùng; job nền chỉ là cơ chế xử lý bổ sung, không phải lớp kiểm tra thời hạn duy nhất.

### F07 — Cao — Ứng viên nhận được dữ liệu đặt lịch của ứng viên khác

- Vị trí: `server/routes/api.ts:854`, danh sách bookings trả về tại `:913`.
- Tái hiện: tạo hai ứng viên, đặt lịch cho một người, dùng token người còn lại đọc `/api/slots`.
- Kết quả: response chứa bookings của người khác, gồm tên, MSSV, ID hồ sơ và trạng thái. Trong khi đọc trực tiếp hồ sơ người khác bị chặn 403, đường slots vẫn làm lộ một phần thông tin.
- Cần sửa: response dành cho ứng viên chỉ cần thông tin ca, sức chứa, số chỗ và lịch của chính họ. Chi tiết ứng viên trong ca chỉ trả cho vai trò nội bộ có quyền.

### F08 — Trung bình — Lưu được ca phỏng vấn có giờ kết thúc trước giờ bắt đầu

- Vị trí: `server/routes/api.ts:922` và `:932`.
- Tái hiện API cục bộ: bắt đầu `2026-12-01T10:00:00Z`, kết thúc `2026-12-01T09:00:00Z`, sức chứa 2.
- Kết quả: HTTP 201 và lưu ca này.
- Cần sửa: kiểm tra thời gian có hợp lệ và `end_at > start_at`, thống nhất múi giờ giữa input và hiển thị. Giao diện gửi `datetime-local` không có offset; backend diễn giải theo múi giờ máy chủ, nên cần quy ước múi giờ rõ ràng.
- Giới hạn bằng chứng: phép nhập ngày giờ bằng trình duyệt ở lượt trước không giữ được giá trị thử; kết luận F08 dựa trên API cục bộ lần này, không dựa vào thao tác nhập đó.

### F09 — Trung bình — Lưu được cấu hình ngưỡng và thời hạn mâu thuẫn

- Vị trí: `server/routes/api.ts:2409`.
- Tái hiện cục bộ: lưu X=40, Y=50 và thời hạn bổ sung -2 ngày.
- Kết quả: HTTP 200, database ghi các giá trị này. Cấu hình cục bộ được trả lại giá trị gốc sau phép thử.
- Cần sửa: schema xác thực có điều kiện liên trường, ví dụ 0 ≤ Y < X ≤ 100, thời hạn dương, số phiếu nguyên dương, chỉ tiêu không âm, thời gian nhắc sớm hơn hạn đặt lịch. Xác thực toàn bộ trước khi ghi; tránh lưu dở một phần.

### F10 — Trung bình — Nộp phiếu chấm tự động coi như ứng viên đã check-in

- Vị trí: `server/routes/api.ts:1157`, `:1357`.
- Tái hiện: ứng viên đã đặt ca nhưng chưa check-in; BCN gửi phiếu điểm. `checked_in_at` tự được ghi.
- Hệ quả: điều kiện hội tụ check-in và phiếu chấm không còn độc lập; việc nhập điểm có thể tạo bằng chứng hiện diện mà chưa có thao tác ghi nhận hiện diện riêng.
- Cần sửa: giữ thao tác điểm danh/check-in riêng. Nếu BCN được phép ghi nhận thay ứng viên, yêu cầu xác nhận rõ và ghi người thực hiện trong audit log; không ngầm thực hiện khi chấm điểm hay quyết định.

### F11 — Trung bình — Không kiểm tra ngày đóng đợt tuyển khi nhận đơn

- Vị trí: `server/routes/api.ts:378`, `:393`.
- Tái hiện cục bộ: đặt `close_at` về quá khứ nhưng trạng thái round vẫn `open`; nộp đơn hợp lệ mới.
- Kết quả: đơn vẫn được nhận và chuyển `invited_to_book`.
- Cần sửa: khi nhận đơn, kiểm tra cả trạng thái và khoảng `open_at`/`close_at` theo quy định đợt tuyển. Nếu việc đóng đợt là hoàn toàn thủ công, giao diện phải thể hiện rõ ý nghĩa của các ngày này.

### F12 — Trung bình — Chức năng khôi phục và tài liệu không khớp hành vi thực

- Vị trí: `server/db/seed.ts:71`, `:104`, `:215`; `server/routes/api.ts:2306`; README.
- Hành vi thực: hàm seed chủ động tạo 0 ứng viên; khi force reset sẽ xóa các bảng dữ liệu trước khi khởi tạo lại. README và audit vẫn mô tả 42 hồ sơ mẫu.
- Điều chỉnh kết luận từ lượt kiểm thử web: đây không đơn thuần là không nạp được dữ liệu; mã hiện tại được viết để đưa đợt tuyển về trống, nhưng nhãn và tài liệu đang gây hiểu nhầm.
- Cần sửa: tách rõ “Đặt lại đợt tuyển trống” và “Nạp dữ liệu mẫu”; thông báo chính xác tác động, có xác nhận trước khi xóa dữ liệu. Không tiếp tục thử reset trên website có hồ sơ thật.

### F13 — Thấp — Chỉ số thời gian xử lý dễ bị hiểu là số đo thực tế

- Vị trí: `src/components/DashboardAndAdmin.tsx:280`; `server/routes/api.ts` phần tính Cycle Time.
- Khi chưa có số đo, giao diện thay bằng ~1,6 giờ. API còn áp sàn 0,5 giờ cho từng hồ sơ đã kết thúc, làm sai số đo của trường hợp thực sự xử lý nhanh hơn 30 phút.
- Cần sửa: tách KPI thực đo khỏi mục tiêu/kỳ vọng, hiển thị “Chưa có dữ liệu” khi chưa có trường hợp hoàn tất; không áp sàn vào dữ liệu đo. Con số BIMP này không được dùng để đánh giá yêu cầu của người dùng vì bài 3.1 đã được loại khỏi phạm vi.

## Những giới hạn cần ghi rõ khi demo

1. `/auth/demo` cho phép lấy phiên đăng nhập bằng email hoặc vai trò mà không cần mật khẩu; đã xác nhận bằng tài khoản giả cục bộ. Đây có thể là chủ đích của bản trình diễn. Nếu triển khai với hồ sơ thật, phải tắt hoặc giới hạn chế độ này ở backend, không chỉ ẩn nút. `/auth/demo-accounts` cũng đang công khai danh sách tài khoản ứng viên.
2. `NotificationService.send()` hiện chỉ chèn bản ghi vào SQLite với trạng thái `sent`, chưa có tích hợp gửi email. Khi thuyết trình nên gọi là hộp thư/thông báo mô phỏng; không kết luận thư đã đến hộp thư ngoài.
3. Dữ liệu SQLite được đặt trong thư mục tạm của máy chủ. Chưa kiểm tra độ bền khi nền tảng triển khai khởi động lại; cần có vị trí lưu bền vững nếu dùng thật.
4. Test bổ sung cho thuật toán phân công dự phòng: khi mọi ban còn 0 chỉ tiêu, thuật toán vẫn trả về một gợi ý phân ban. API chốt có kiểm tra chỉ tiêu, nên chưa chứng minh có phân công vượt chỉ tiêu được chốt; nhưng gợi ý nên trả về “chưa thể phân công” thay vì chọn ban đã đầy.

## Đối chiếu To-Be và bài 3.2

| Thành phần quy trình | Đánh giá từ kiểm thử |
|---|---|
| Kiểm tra đủ thông tin, bổ sung tối đa hai lần | Luồng cơ bản chạy đúng trong ca thử |
| Sơ loại ba nhánh, BNS xem hồ sơ cần xem xét và sát ngưỡng | Luồng kiểm tra chính chạy được; bộ thử luật trên giao diện đang lỗi F01 |
| Nhắc sau một ngày, loại sau hai ngày | Job chạy đúng ca thử; API đặt lịch còn lỗ hổng thời hạn F06 |
| Phỏng vấn và chấm điểm; BCN chịu trách nhiệm quyết định | Chưa bảo đảm do F02, F03, F04 và F10 |
| Ứng viên xác nhận, BNS chốt phân công, AI chỉ gợi ý | Luồng chuẩn chạy được; F05 có thể tạo hoàn tất giả; chưa kiểm tra Gemini thực tế |
| Rút đơn, hủy timer và thu hồi phân công | Luồng rút chạy đúng trong ca thử, nhưng API quyết định có thể hồi sinh hồ sơ đã rút do F02 |
| Nhật ký và minh bạch kết quả | Có bản ghi audit, nhưng có log không đồng nghĩa chuyển bước hợp lệ; cần chặn tại API |

## Thứ tự sửa đề nghị

1. Sửa F01 để công cụ thử luật hoạt động và phản ánh đúng đầu vào.
2. Khóa F02–F05: quyền quyết định, state machine, điểm 0, tính nhất quán phân công.
3. Sửa F06–F11: deadline tại API, giới hạn dữ liệu theo vai trò, xác thực ca/cấu hình và check-in.
4. Đồng bộ nhãn, dữ liệu mẫu, tài liệu và cách trình bày KPI; ghi rõ phạm vi mô phỏng.
5. Chạy lại bộ kiểm thử API âm sau khi sửa; không chỉ chạy lại 9 unit test hiện có.

Các kết quả trên mô tả hành vi của bản ZIP đã nhận, không phải xác nhận rằng mọi chức năng và mọi trình duyệt đều đã được kiểm thử.
