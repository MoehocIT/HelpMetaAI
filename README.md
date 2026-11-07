# HelpMate AI IT Helpdesk — bản kết hợp

Dự án gồm giao diện Next.js, API quản lý ticket, MongoDB và 9 workflow n8n. Mỗi workflow có ít nhất 12 node/bước; chi tiết tại `n8n-workflows/README.md`.

## Yêu cầu
- Node.js 20.9+ (khuyến nghị bản LTS)
- npm
- MongoDB local hoặc MongoDB Atlas
- n8n chỉ cần khi muốn chạy tự động hóa ticket

## 1. Cài đặt
```bash
npm install
```

Tạo file `.env.local` ở thư mục gốc bằng cách sao chép `.env.example`, sau đó chỉnh `MONGODB_URI` thành URI MongoDB của bạn.

Ví dụ MongoDB chạy local:
```env
MONGODB_URI=mongodb://127.0.0.1:27017/it_helpdesk
N8N_WEBHOOK_URL=
```

Không đưa `.env.local` lên Git hoặc chia sẻ công khai.

## 2. Chạy website
```bash
npm run dev
```
Mở http://localhost:3000

## 3. Kết nối n8n (tùy chọn)
1. Mở n8n.
2. Import các file JSON trong `n8n-workflows/` (Import from File).
3. Trong `WF02 - Ticket Classification`, node `Classify with Ollama` gọi Ollama trên Windows host qua `http://10.0.2.2:11434/api/generate` với model `llama3.2`. Ollama phải được cài model và cho phép VM truy cập cổng 11434; nếu Ollama chạy trong Arch VM, đổi URL thành `http://127.0.0.1:11434/api/generate`.
4. Trong `WF09 - Audit Log`, tạo credential MongoDB trong n8n rồi chọn cho node `Save Audit to MongoDB`. Node ghi ticket/audit vào database `helpdeskai`, collection `ticket_audit` (database được chọn trong credential). MongoDB phải truy cập được từ môi trường đang chạy n8n.
5. Kiểm tra URL nối giữa các workflow theo môi trường n8n của bạn.
6. Kích hoạt `WF01 - Ticket Intake`.
7. Sao chép **Production URL** của Webhook node trong WF01 và đặt vào `N8N_WEBHOOK_URL` trong `.env.local`.
8. Khởi động lại Next.js sau khi thay đổi biến môi trường.

Các workflow hiện được xuất ở trạng thái chưa kích hoạt. Hãy kiểm tra URL nối giữa các workflow và thử bằng dữ liệu giả trước khi dùng thật; import workflow không tự động cấu hình credential hoặc tự kích hoạt chúng. Ollama/MongoDB chưa được cài đặt hoặc cấu hình thay bạn.

## Các workflow đi kèm
- WF01 — Ticket Intake
- WF02 — Ticket Classification
- WF03 — Priority Assessment
- WF04 — Team Assignment
- WF05 — Duplicate Detection
- WF06 — Support Response
- WF07 — High Priority Alert
- WF08 — SLA Monitoring
- WF09 — Audit Log

## Ghi chú chức năng
- API `GET /api/tickets`: lấy danh sách ticket.
- API `POST /api/tickets`: tạo ticket và gọi webhook n8n nếu `N8N_WEBHOOK_URL` được cấu hình. Nếu Ollama chưa kết nối, hệ thống vẫn lưu ticket và phân loại dự phòng theo từ khóa; nội dung AI trong ticket cần được đội IT xác nhận.
- API `PATCH /api/tickets/[id]`: cập nhật trạng thái ticket.
- Trợ lý chat gọi Ollama qua API phía máy chủ. Ollama chạy trên máy cá nhân hoặc `localhost` không truy cập được từ Vercel; muốn chat AI hoạt động trên website, cần cấu hình `OLLAMA_BASE_URL` tới một dịch vụ Ollama có thể truy cập công khai hoặc thay bằng AI provider được host riêng.

## Triển khai trên Vercel
- Thêm `MONGODB_URI` trong Project → Settings → Environment Variables.
- `OLLAMA_BASE_URL`, `OLLAMA_MODEL` và `N8N_WEBHOOK_URL` là tùy chọn; chỉ cấu hình URL mà môi trường Vercel có thể truy cập.
- Nếu chưa cấu hình Ollama, chat AI sẽ báo chưa kết nối, nhưng chức năng tạo ticket vẫn hoạt động với phân loại dự phòng.

## Bảo mật
File `.env.local` trong bản gốc có chứa thông tin kết nối cơ sở dữ liệu. Bản kết hợp này không kèm thông tin đó. Nếu thông tin đã được chia sẻ hoặc tải lên nơi công khai, hãy đổi mật khẩu database/thu hồi credential cũ và cập nhật URI mới trong `.env.local`.
