import { NextResponse } from 'next/server';
import connectDB, { isMongoConnectionError } from '../../../lib/mongodb';
import { getSessionUser } from '../../../lib/auth';
import Ticket from '../../../models/Ticket';


type Classification = {
  category:
    | 'Network'
    | 'Hardware'
    | 'Software'
    | 'Account & Access'
    | 'Security'
    | 'Other';
  priority: 'Low' | 'Medium' | 'High';
  assignedTeam: string;
  reason: string;
  suggestion: string;
};

const categories: Classification['category'][] = [
  'Network',
  'Hardware',
  'Software',
  'Account & Access',
  'Security',
  'Other',
];

const priorities: Classification['priority'][] = [
  'Low',
  'Medium',
  'High',
];

async function classifyTicket(
  title: string,
  description: string
): Promise<Classification> {
  const baseUrl =
    process.env.OLLAMA_BASE_URL || 'http://127.0.0.1:11434';

  const model = process.env.OLLAMA_MODEL || 'qwen2.5:3b';

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      stream: false,
      format: {
        type: 'object',
        properties: {
          category: {
            type: 'string',
            enum: categories,
          },
          priority: {
            type: 'string',
            enum: priorities,
          },
          assignedTeam: {
            type: 'string',
          },
          reason: {
            type: 'string',
          },
          suggestion: {
            type: 'string',
          },
        },
        required: [
          'category',
          'priority',
          'assignedTeam',
          'reason',
          'suggestion',
        ],
      },
      messages: [
        {
          role: 'system',
          content: `
Bạn là chuyên viên IT Helpdesk.
Phân tích ticket và chỉ trả về JSON theo cấu trúc được yêu cầu.

Quy tắc phân loại:
- Network: Wi-Fi, Internet, mạng, DNS, VPN, kết nối mạng.
- Hardware: máy tính, bàn phím, chuột, màn hình, máy in hoặc thiết bị vật lý.
- Software: ứng dụng, lỗi phần mềm, cài đặt hoặc cập nhật phần mềm.
- Account & Access: đăng nhập, tài khoản, mật khẩu, quyền truy cập.
- Security: phishing, tài khoản bị xâm nhập, mã độc hoặc nguy cơ bảo mật.
- Other: các vấn đề không phù hợp nhóm trên.

Mức ưu tiên:
- High: nhiều người bị ảnh hưởng, công việc quan trọng bị dừng,
  có dấu hiệu tấn công hoặc nguy cơ mất dữ liệu.
- Medium: sự cố ảnh hưởng đáng kể nhưng vẫn có cách làm việc tạm thời.
- Low: yêu cầu thông thường, câu hỏi hoặc sự cố ít ảnh hưởng.

Không tự bịa dữ kiện.
reason và suggestion phải viết bằng tiếng Việt, ngắn gọn.
Không yêu cầu người dùng cung cấp mật khẩu hoặc OTP.
Nếu chưa đủ thông tin, hãy nêu điều cần kiểm tra thêm.
          `.trim(),
        },
        {
          role: 'user',
          content: `Tiêu đề: ${title}\nMô tả: ${description}`,
        },
      ],
    }),
    signal: AbortSignal.timeout(120000),
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error('Ollama API error:', response.status, detail);

    throw new Error(
      `Không gọi được Ollama (HTTP ${response.status}). ` +
        'Hãy kiểm tra Ollama và tên mô hình.'
    );
  }

  const result = await response.json();
  const content = result?.message?.content;

  if (typeof content !== 'string' || !content.trim()) {
    throw new Error('Ollama không trả về kết quả phân loại.');
  }

  let classification: Classification;

  try {
    classification = JSON.parse(content);
  } catch {
    throw new Error('Ollama trả về dữ liệu JSON không hợp lệ.');
  }

  if (
    !categories.includes(classification.category) ||
    !priorities.includes(classification.priority) ||
    typeof classification.assignedTeam !== 'string' ||
    typeof classification.reason !== 'string' ||
    typeof classification.suggestion !== 'string'
  ) {
    throw new Error('Kết quả phân loại từ Ollama không đúng cấu trúc.');
  }

  return classification;
}

function classifyTicketWithoutAI(
  title: string,
  description: string
): Classification {
  const text = `${title} ${description}`.toLocaleLowerCase('vi');

  let category: Classification['category'] = 'Other';
  let assignedTeam = 'IT General';
  let suggestion = 'Đội IT sẽ xem xét ticket và liên hệ để hỗ trợ.';

  if (/wifi|wi-fi|mạng|internet|vpn|dns|router|kết nối/.test(text)) {
    category = 'Network';
    assignedTeam = 'Network Team';
    suggestion = 'Kiểm tra kết nối mạng và thử khởi động lại thiết bị mạng nếu phù hợp.';
  } else if (/máy tính|laptop|bàn phím|chuột|màn hình|máy in|phần cứng/.test(text)) {
    category = 'Hardware';
    assignedTeam = 'Hardware Team';
    suggestion = 'Kiểm tra nguồn điện và kết nối thiết bị; không tự tháo thiết bị.';
  } else if (/phần mềm|ứng dụng|app|cài đặt|cập nhật|lỗi chương trình/.test(text)) {
    category = 'Software';
    assignedTeam = 'Software Team';
    suggestion = 'Ghi lại thông báo lỗi và thử mở lại ứng dụng trước khi đội IT kiểm tra.';
  } else if (/đăng nhập|mật khẩu|tài khoản|quyền truy cập|account/.test(text)) {
    category = 'Account & Access';
    assignedTeam = 'Account Support';
    suggestion = 'Dùng quy trình khôi phục tài khoản chính thức; không gửi mật khẩu hoặc OTP.';
  } else if (/phishing|mã độc|malware|virus|bị hack|bị xâm nhập|rò rỉ/.test(text)) {
    category = 'Security';
    assignedTeam = 'Security Team';
    suggestion = 'Ngừng tương tác với nội dung đáng ngờ và báo ngay cho đội IT bảo mật.';
  }

  const highRisk = category === 'Security' || /toàn công ty|nhiều người|khẩn cấp|dừng hoạt động/.test(text);

  return {
    category,
    priority: highRisk ? 'High' : 'Medium',
    assignedTeam,
    reason: 'AI chưa khả dụng; ticket được phân loại dự phòng theo từ khóa. Đội IT cần xác nhận lại.',
    suggestion,
  };
}

const PAGE_SIZE_OPTIONS = [10, 20, 50];
const VALID_STATUSES = ['Open', 'In Progress', 'Resolved'];

function escapeRegex(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

export async function GET(request: Request) {
  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Bạn cần đăng nhập.' }, { status: 401 });
  }

  try {
    await connectDB();

    const { searchParams } = new URL(request.url);
    const requestedPage = Math.max(1, Number.parseInt(searchParams.get('page') || '1', 10) || 1);
    const requestedLimit = Number.parseInt(searchParams.get('limit') || '10', 10) || 10;
    const limit = PAGE_SIZE_OPTIONS.includes(requestedLimit) ? requestedLimit : 10;
    const search = (searchParams.get('search') || '').trim().slice(0, 120);
    const status = searchParams.get('status') || 'All';
    const sortBy = searchParams.get('sort') || 'recent';

    const filters: Record<string, unknown>[] = [];
    if (VALID_STATUSES.includes(status)) filters.push({ status });
    if (search) {
      const pattern = new RegExp(escapeRegex(search), 'i');
      filters.push({
        $or: [
          { ticketId: pattern },
          { title: pattern },
          { description: pattern },
          { category: pattern },
          { assignedTeam: pattern },
        ],
      });
    }
    const accessFilter = user.role === 'admin' ? {} : { createdBy: user.id };
    if (user.role !== 'admin') filters.push(accessFilter);
    const query = filters.length ? { $and: filters } : accessFilter;

    const [total, allTickets, open, inProgress, resolved, urgent, categories, priorities] = await Promise.all([
      Ticket.countDocuments(query),
      Ticket.countDocuments(accessFilter),
      Ticket.countDocuments({ ...accessFilter, status: 'Open' }),
      Ticket.countDocuments({ ...accessFilter, status: 'In Progress' }),
      Ticket.countDocuments({ ...accessFilter, status: 'Resolved' }),
      Ticket.countDocuments({ ...accessFilter, priority: { $in: ['Critical', 'High'] }, status: { $ne: 'Resolved' } }),
      Ticket.aggregate([
        { $match: accessFilter },
        { $group: { _id: '$category', count: { $sum: 1 } } },
        { $sort: { count: -1, _id: 1 } },
      ]),
      Ticket.aggregate([
        { $match: accessFilter },
        { $group: { _id: '$priority', count: { $sum: 1 } } },
      ]),
    ]);

    const totalPages = Math.max(1, Math.ceil(total / limit));
    const page = Math.min(requestedPage, totalPages);
    const skip = (page - 1) * limit;

    const sort: Record<string, 1 | -1> = sortBy === 'oldest'
      ? { createdAt: 1 as const }
      : sortBy === 'updated'
        ? { updatedAt: -1 as const, createdAt: -1 as const }
        : { createdAt: -1 as const };

    const listQuery = sortBy === 'priority'
      ? Ticket.aggregate([
          { $match: query },
          {
            $addFields: {
              __priorityOrder: {
                $switch: {
                  branches: [
                    { case: { $eq: ['$priority', 'Critical'] }, then: 0 },
                    { case: { $eq: ['$priority', 'High'] }, then: 1 },
                    { case: { $eq: ['$priority', 'Medium'] }, then: 2 },
                    { case: { $eq: ['$priority', 'Low'] }, then: 3 },
                  ],
                  default: 4,
                },
              },
            },
          },
          { $sort: { __priorityOrder: 1, createdAt: -1 } },
          { $skip: skip },
          { $limit: limit },
          { $project: { __priorityOrder: 0 } },
        ])
      : Ticket.find(query).sort(sort).skip(skip).limit(limit).lean();

    const [tickets, priorityTickets] = await Promise.all([
      listQuery,
      Ticket.aggregate([
        { $match: accessFilter },
        {
          $addFields: {
            __priorityOrder: {
              $switch: {
                branches: [
                  { case: { $eq: ['$priority', 'Critical'] }, then: 0 },
                  { case: { $eq: ['$priority', 'High'] }, then: 1 },
                  { case: { $eq: ['$priority', 'Medium'] }, then: 2 },
                  { case: { $eq: ['$priority', 'Low'] }, then: 3 },
                ],
                default: 4,
              },
            },
          },
        },
        { $sort: { __priorityOrder: 1, createdAt: -1 } },
        { $limit: 4 },
        { $project: { __priorityOrder: 0 } },
      ]),
    ]);

    return NextResponse.json(
      {
        success: true,
        data: tickets,
        priorityTickets,
        meta: {
          page,
          limit,
          total,
          totalPages,
          summary: { total: allTickets, open, inProgress, resolved, urgent, categories, priorities },
        },
      },
      { status: 200 }
    );
  } catch (error: unknown) {
    const unavailable = isMongoConnectionError(error);
    console.error('Lỗi tải ticket:', error);

    return NextResponse.json(
      {
        success: false,
        error: unavailable
          ? 'Không thể kết nối cơ sở dữ liệu. Hãy kiểm tra MongoDB Atlas, allowlist IP và kết nối mạng.'
          : 'Không thể tải ticket. Hãy thử lại sau.',
      },
      { status: unavailable ? 503 : 500 }
    );
  }
}

export async function POST(request: Request) {
  const user = getSessionUser(request);
  if (!user) {
    return NextResponse.json({ success: false, error: 'Bạn cần đăng nhập.' }, { status: 401 });
  }

  try {
    const body = await request.json();

    const title =
      typeof body.title === 'string' ? body.title.trim() : '';

    const description =
      typeof body.description === 'string'
        ? body.description.trim()
        : '';

    if (!title || !description) {
      return NextResponse.json(
        {
          success: false,
          error: 'Tiêu đề và mô tả không được để trống.',
        },
        { status: 400 }
      );
    }

    if (title.length > 200 || description.length > 10000) {
      return NextResponse.json(
        {
          success: false,
          error:
            'Tiêu đề tối đa 200 ký tự và mô tả tối đa 10.000 ký tự.',
        },
        { status: 400 }
      );
    }

    // Ticket vẫn được lưu nếu Ollama chưa được cấu hình hoặc tạm thời không khả dụng.
    let classification: Classification;
    let classificationMode: 'ai' | 'fallback' = 'ai';
    try {
      classification = await classifyTicket(title, description);
    } catch (error) {
      classificationMode = 'fallback';
      classification = classifyTicketWithoutAI(title, description);
      console.warn('Ollama không khả dụng; dùng phân loại dự phòng:', error);
    }

    await connectDB();

    const ticketId = `TCK-${Math.floor(
      100000 + Math.random() * 900000
    )}`;

    const newTicket = await Ticket.create({
      ticketId,
      title,
      description,
      category: classification.category,
      priority: classification.priority,
      assignedTeam: classification.assignedTeam,
      aiReason: classification.reason,
      aiSuggestion: classification.suggestion,
      status: 'Open',
      createdBy: user.id,
      updatedAt: new Date(),
    });

    const n8nWebhookUrl = process.env.N8N_WEBHOOK_URL;

    if (n8nWebhookUrl) {
      fetch(n8nWebhookUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticketId: newTicket.ticketId,
          title: newTicket.title,
          description: newTicket.description,
          category: newTicket.category,
          priority: newTicket.priority,
          assignedTeam: newTicket.assignedTeam,
          aiReason: newTicket.aiReason,
          aiSuggestion: newTicket.aiSuggestion,
        }),
        signal: AbortSignal.timeout(10000),
      }).catch((error) => {
        console.error('Lỗi khi gọi n8n webhook:', error);
      });
    }

    return NextResponse.json(
      {
        success: true,
        message: 'Đã phân loại và tạo ticket thành công.',
        classificationMode,
        data: newTicket,
      },
      { status: 201 }
    );
  } catch (error: unknown) {
    const message =
      error instanceof Error ? error.message : 'Tạo ticket thất bại.';
    const databaseUnavailable = isMongoConnectionError(error);

    console.error('Lỗi tạo ticket:', message);

    const status =
      databaseUnavailable ||
      message.includes('Ollama') ||
      message.includes('fetch failed') ||
      message.includes('ECONNREFUSED')
        ? 503
        : 500;

    return NextResponse.json(
      {
        success: false,
        error: databaseUnavailable
          ? 'Không thể kết nối cơ sở dữ liệu. Hãy kiểm tra MongoDB Atlas, allowlist IP và kết nối mạng.'
          : message,
      },
      { status }
    );
  }
}
