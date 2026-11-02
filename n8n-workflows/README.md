# HelpMateAI — 9 workflow n8n

Mỗi workflow có tối thiểu 12 node/bước, gồm kiểm tra dữ liệu, các bước xử lý chuyên biệt và đầu ra. Các workflow vẫn nối theo thứ tự xử lý ticket:

`WF01 Intake → WF02 Classification → WF03 Priority → WF04 Assignment → WF05 Duplicate Detection → WF06 Support Response → WF07 High Priority Alert → WF08 SLA Monitoring → WF09 Audit Log`

## Import và chạy

1. Mở n8n tại `http://localhost:5678`.
2. Tạo workflow mới cho mỗi file rồi chọn **Import from File**; nếu nhập ngay trong workflow đang mở, n8n sẽ thay nội dung workflow đó.
3. Trong WF02, node `Classify with Ollama` gọi `http://10.0.2.2:11434/api/generate` dùng model `llama3.2`. Nếu Ollama chạy bên trong Arch VM, đổi URL thành `http://127.0.0.1:11434/api/generate`.
4. Trong WF09, node `Save Audit to MongoDB` ghi bản ghi vào database `helpdeskai`, collection `ticket_audit`. Mở node và tạo/chọn credential MongoDB trước khi chạy.
5. Lưu các workflow, cấu hình URL webhook, rồi kích hoạt WF09 ngược về WF01.
6. Dùng URL Production của Webhook WF01 để cấu hình `N8N_WEBHOOK_URL` trong `.env.local` của ứng dụng.

## Kết nối dịch vụ

- Trên máy Ollama, tải model bằng `ollama pull llama3.2`. Khi Ollama chạy trên Windows host, bật truy cập từ VM tới cổng 11434; địa chỉ `10.0.2.2` là gateway host của VirtualBox NAT. Nếu không muốn mở dịch vụ qua mạng VM, cài Ollama ngay trong Arch VM và dùng `127.0.0.1`.
- Tạo credential MongoDB trong n8n. Nếu MongoDB cùng chạy trong Arch VM, dùng `mongodb://127.0.0.1:27017`; nếu chạy trên Windows host, dùng `mongodb://10.0.2.2:27017`. Điền database `helpdeskai` và thông tin xác thực nếu bật authentication.

Các HTTP Request node gọi webhook kế tiếp qua `http://localhost:5678/webhook/...`. URL này phù hợp khi n8n và các workflow chạy cùng máy/VM. Nếu chạy n8n trong Docker hoặc truy cập từ máy khác, đổi URL sang địa chỉ mà tiến trình n8n có thể truy cập.

## Vai trò và giới hạn

- **WF01** chuẩn hóa dữ liệu đầu vào, kiểm tra trường bắt buộc và ghi nhận thông tin tiếp nhận.
- **WF02** gọi Ollama để phân loại ticket, sau đó dùng luật từ khóa làm phương án dự phòng nếu Ollama trả về category không hợp lệ.
- **WF03** ước lượng mức ưu tiên và ghi lại tín hiệu tác động.
- **WF04** gán nhóm hỗ trợ và hàng đợi theo category.
- **WF05** tạo fingerprint/keyword; cần nối với MongoDB hoặc API tra cứu để đối chiếu ticket đã lưu.
- **WF06** tạo gợi ý trả lời tiếng Việt và kiểm tra không yêu cầu mật khẩu/OTP.
- **WF07** chuẩn bị nội dung cảnh báo; cần cấu hình node email/chat và credential để gửi thật.
- **WF08** tính SLA khi workflow chạy; cần Schedule Trigger và truy vấn dữ liệu nếu muốn giám sát lặp lại.
- **WF09** tạo bản ghi audit và lưu vào MongoDB collection `ticket_audit`.

Các file được xuất ở trạng thái chưa kích hoạt. Chúng chưa tự cấu hình credential MongoDB hoặc kênh thông báo. Kiểm tra các URL webhook theo địa chỉ n8n của bạn trước khi bật workflow.
