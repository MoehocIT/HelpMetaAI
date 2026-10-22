# HelpMate AI IT Helpdesk — bản kết hợp

Dự án gồm giao diện Next.js, API quản lý ticket, MongoDB và 9 workflow n8n.

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
3. Cấu hình lần lượt các node HTTP Request trong từng workflow để gọi URL webhook của workflow kế tiếp. Kiểm tra credential/URL theo môi trường n8n của bạn.
4. Kích hoạt `WF01 - Ticket Intake`.
5. Sao chép **Production URL** của Webhook node trong WF01 và đặt vào `N8N_WEBHOOK_URL` trong `.env.local`.
6. Khởi động lại Next.js sau khi thay đổi biến môi trường.

Các workflow hiện được xuất ở trạng thái chưa kích hoạt. Hãy kiểm tra URL nối giữa các workflow và thử bằng dữ liệu giả trước khi dùng thật; import workflow không tự động cấu hình credential hoặc tự kích hoạt chúng.

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
- API `POST /api/tickets`: tạo ticket và gọi webhook n8n nếu `N8N_WEBHOOK_URL` được cấu hình.
- API `PATCH /api/tickets/[id]`: cập nhật trạng thái ticket.
- Trợ lý chat trên giao diện hiện dùng câu trả lời demo ở phía client; nó chưa gọi mô hình AI thật hoặc workflow n8n. Cần tích hợp endpoint/AI provider riêng nếu muốn câu trả lời AI thực sự.

## Bảo mật
File `.env.local` trong bản gốc có chứa thông tin kết nối cơ sở dữ liệu. Bản kết hợp này không kèm thông tin đó. Nếu thông tin đã được chia sẻ hoặc tải lên nơi công khai, hãy đổi mật khẩu database/thu hồi credential cũ và cập nhật URI mới trong `.env.local`.
