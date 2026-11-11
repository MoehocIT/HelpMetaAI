"use client";

import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useRouter } from "next/navigation";

type PriorityLevel = "Critical" | "High" | "Medium" | "Low";
type TicketStatus = "Open" | "In Progress" | "Resolved";
type MessageRole = "ai" | "user";

type Ticket = {
  id: string;
  title: string;
  category: string;
  priority: PriorityLevel;
  status: TicketStatus;
  owner: string;
  date: string;
  description?: string;
  aiReason?: string;
  aiSuggestion?: string;
  createdAt?: string;
  updatedAt?: string;
  updatedDate?: string;
};

type ApiTicket = {
  ticketId: string;
  title: string;
  description?: string;
  category?: string;
  priority?: string;
  assignedTeam?: string;
  aiReason?: string;
  aiSuggestion?: string;
  status?: string;
  createdAt?: string;
  updatedAt?: string;
};

type TicketSummary = {
  total: number;
  open: number;
  inProgress: number;
  resolved: number;
  urgent: number;
};

type TicketBreakdown = { _id: string; count: number }[];

const emptyTicketSummary: TicketSummary = {
  total: 0,
  open: 0,
  inProgress: 0,
  resolved: 0,
  urgent: 0,
};

type ChatMessage = {
  id: string;
  role: MessageRole;
  text: string;
};

type Page = "overview" | "chat" | "tickets" | "knowledge" | "reports";
type AuthUser = { id: string; email: string; name: string; role: "admin" | "user" };

type GuideStep = { title: string; body: string };
type Guide = { category: string; title: string; intro: string; steps: GuideStep[]; escalation: string };

const priorities: PriorityLevel[] = [
  "Critical",
  "High",
  "Medium",
  "Low",
];

const statuses: TicketStatus[] = [
  "Open",
  "In Progress",
  "Resolved",
];

const navItems: {
  id: Page;
  icon: string;
  label: string;
}[] = [
  { id: "overview", icon: "▦", label: "Tổng quan" },
  { id: "chat", icon: "✳", label: "Trợ lý AI" },
  { id: "tickets", icon: "▤", label: "Quản lý ticket" },
  { id: "knowledge", icon: "▧", label: "Kho kiến thức" },
  { id: "reports", icon: "▥", label: "Báo cáo" },
];

const guides: Record<string, Guide> = {
  wifi: {
    category: "Mạng & kết nối",
    title: "Khắc phục sự cố Wi-Fi",
    intro: "Làm lần lượt các bước dưới đây để tìm nguyên nhân mất hoặc chập chờn kết nối.",
    steps: [
      { title: "Kiểm tra phạm vi ảnh hưởng", body: "Thử mở một trang web khác và kiểm tra thiết bị khác có vào mạng được không. Nếu chỉ một thiết bị lỗi, tiếp tục các bước bên dưới; nếu nhiều người cùng lỗi, báo IT." },
      { title: "Kiểm tra Wi-Fi trên máy", body: "Tắt chế độ máy bay, bật Wi-Fi và xác nhận bạn đang kết nối đúng mạng. Tắt rồi bật lại Wi-Fi, sau đó thử kết nối lại." },
      { title: "Ngắt và kết nối lại mạng", body: "Chọn mạng đang dùng, ngắt kết nối rồi kết nối lại. Chỉ chọn “Quên mạng” nếu bạn biết mật khẩu hoặc có thể xin lại mật khẩu từ IT." },
      { title: "Khởi động lại thiết bị", body: "Lưu công việc rồi khởi động lại máy tính. Nếu đang ở nhà, có thể khởi động lại router; tại văn phòng, không tự reset thiết bị mạng." },
      { title: "Ghi lại thông tin lỗi", body: "Ghi tên mạng, thời điểm xảy ra, vị trí và thông báo lỗi. Thông tin này giúp IT kiểm tra nhanh hơn." },
    ],
    escalation: "Nếu nhiều thiết bị cùng mất mạng, mạng văn phòng biến mất hoặc lỗi vẫn còn sau khi khởi động lại, hãy tạo ticket cho IT.",
  },
  account: {
    category: "Tài khoản",
    title: "Đăng nhập & mật khẩu",
    intro: "Kiểm tra thông tin đăng nhập và khôi phục quyền truy cập qua kênh chính thức.",
    steps: [
      { title: "Kiểm tra tài khoản", body: "Xác nhận bạn đang dùng đúng email/tên đăng nhập của cơ quan. Kiểm tra ngôn ngữ bàn phím, Caps Lock và khoảng trắng thừa." },
      { title: "Thử đăng nhập lại một lần", body: "Nhập lại mật khẩu cẩn thận. Tránh thử liên tục vì tài khoản có thể bị khóa tạm thời." },
      { title: "Dùng chức năng khôi phục chính thức", body: "Chọn “Quên mật khẩu” trên trang đăng nhập của dịch vụ hoặc làm theo quy trình nội bộ. Chỉ mở liên kết khôi phục từ trang chính thức." },
      { title: "Liên hệ IT nếu tài khoản bị khóa", body: "Cung cấp tên dịch vụ và ảnh/chữ của thông báo lỗi. Không gửi mật khẩu, mã OTP hay mã khôi phục cho bất kỳ ai." },
    ],
    escalation: "Nếu nhận được yêu cầu đổi mật khẩu bất ngờ, nghi tài khoản bị chiếm quyền hoặc không truy cập được email khôi phục, báo IT ngay.",
  },
  performance: {
    category: "Hiệu năng",
    title: "Máy tính chạy chậm",
    intro: "Thử các kiểm tra an toàn trước khi đóng ứng dụng hoặc thay đổi cấu hình máy.",
    steps: [
      { title: "Lưu công việc và khởi động lại", body: "Lưu tài liệu đang mở, đóng ứng dụng không sử dụng rồi khởi động lại máy để giải phóng tài nguyên." },
      { title: "Kiểm tra ứng dụng đang dùng nhiều tài nguyên", body: "Trên Windows, nhấn Ctrl + Shift + Esc để mở Task Manager. Xem ứng dụng nào dùng CPU hoặc bộ nhớ cao; chỉ đóng ứng dụng bạn nhận biết và không còn cần dùng." },
      { title: "Kiểm tra dung lượng ổ đĩa", body: "Mở Settings → System → Storage để xem dung lượng còn trống. Xóa các tệp cá nhân không cần thiết; không xóa thư mục hệ thống hoặc dữ liệu công việc." },
      { title: "Cập nhật và quét bảo mật", body: "Cài bản cập nhật theo quy định của công ty và chạy công cụ bảo mật được IT phê duyệt. Không tải phần mềm “tăng tốc” từ nguồn lạ." },
    ],
    escalation: "Nếu máy nóng bất thường, tự tắt, phát tiếng lạ hoặc vẫn chậm sau khi khởi động lại, tạo ticket và ghi rõ ứng dụng, thời điểm xảy ra.",
  },
  software: {
    category: "Phần mềm",
    title: "Cài đặt phần mềm",
    intro: "Cài ứng dụng từ nguồn được công ty phê duyệt để tránh lỗi tương thích và rủi ro bảo mật.",
    steps: [
      { title: "Xác nhận ứng dụng được phép", body: "Kiểm tra ứng dụng có trong Company Portal/kho phần mềm nội bộ hoặc hỏi IT trước khi cài." },
      { title: "Kiểm tra yêu cầu hệ thống", body: "Xác nhận phiên bản Windows/macOS, dung lượng trống và quyền cần thiết. Lưu công việc trước khi cài đặt." },
      { title: "Tải bộ cài từ nguồn chính thức", body: "Chỉ dùng liên kết của nhà phát hành hoặc cổng nội bộ. Không mở tệp đính kèm hay trình cài đặt từ nguồn không rõ." },
      { title: "Cài đặt và khởi động lại ứng dụng", body: "Làm theo hướng dẫn, không cấp quyền quản trị nếu không được phê duyệt. Sau khi cài, mở ứng dụng và ghi lại nguyên văn lỗi nếu có." },
    ],
    escalation: "Nếu cần quyền quản trị, giấy phép hoặc ứng dụng báo lỗi bảo mật, gửi tên ứng dụng, phiên bản và ảnh thông báo cho IT.",
  },
  hardware: {
    category: "Phần cứng",
    title: "Thiết bị ngoại vi",
    intro: "Kiểm tra nguồn, dây kết nối và lựa chọn thiết bị trước khi cài lại trình điều khiển.",
    steps: [
      { title: "Kiểm tra nguồn và dây cáp", body: "Đảm bảo thiết bị đã bật, dây nguồn và dây USB được cắm chắc. Thử cổng USB khác nếu phù hợp; không giật mạnh đầu nối." },
      { title: "Kiểm tra thiết bị được chọn", body: "Với máy in, xác nhận đã chọn đúng máy in và máy không ở trạng thái Offline. Với màn hình, kiểm tra đúng nguồn vào (HDMI/DisplayPort)." },
      { title: "Khởi động lại thiết bị", body: "Tắt thiết bị ngoại vi, chờ vài giây rồi bật lại. Lưu công việc và khởi động lại máy tính nếu thiết bị vẫn chưa nhận." },
      { title: "Thử trên cổng hoặc máy khác", body: "Nếu được phép, thử cáp/cổng khác hoặc thiết bị trên máy khác để xác định lỗi nằm ở đâu. Không tự tháo thiết bị còn bảo hành." },
      { title: "Cài trình điều khiển đúng nguồn", body: "Chỉ cài driver từ Company Portal hoặc hướng dẫn của IT/nhà sản xuất. Tránh các trang tải driver không rõ nguồn." },
    ],
    escalation: "Nếu có mùi khét, tia lửa, pin phồng hoặc thiết bị quá nóng, ngắt nguồn nếu làm được an toàn và báo IT ngay; không tiếp tục sử dụng.",
  },
  security: {
    category: "Bảo mật",
    title: "An toàn tài khoản",
    intro: "Nếu nghi ngờ email, liên kết hoặc tài khoản có vấn đề, ưu tiên bảo vệ tài khoản và báo IT sớm.",
    steps: [
      { title: "Nhận biết dấu hiệu đáng ngờ", body: "Cẩn trọng với người gửi lạ, lời thúc giục gấp, liên kết có địa chỉ khác thường, tệp bất ngờ hoặc yêu cầu mật khẩu/OTP." },
      { title: "Không tương tác với nội dung nghi ngờ", body: "Không nhấn liên kết, mở tệp, trả lời hoặc chuyển tiếp cho đồng nghiệp. Dùng nút Report phishing nếu hệ thống email có chức năng này." },
      { title: "Báo cáo IT", body: "Gửi báo cáo qua kênh nội bộ được chỉ định. Giữ lại email/tin nhắn để IT kiểm tra; không xóa bằng chứng nếu IT chưa hướng dẫn." },
      { title: "Nếu đã nhập thông tin", body: "Báo IT ngay. Từ thiết bị đáng tin cậy, đổi mật khẩu qua trang chính thức và làm theo hướng dẫn bảo vệ tài khoản. Không gửi OTP hoặc mật khẩu mới cho người hỗ trợ." },
      { title: "Nếu thiết bị có dấu hiệu bị xâm nhập", body: "Ngừng nhập thông tin nhạy cảm và liên hệ IT khẩn cấp. Làm theo hướng dẫn của IT trước khi tắt máy hoặc ngắt mạng để họ có thể điều tra." },
    ],
    escalation: "Nếu đã mở tệp lạ, nhập mật khẩu/OTP vào trang đáng ngờ hoặc thấy đăng nhập không phải của bạn, liên hệ IT ngay qua kênh khẩn cấp.",
  },
};

const knowledgeCards = [
  { key: "wifi", icon: "⌁", color: "blue", description: "Kiểm tra kết nối, DNS và cấu hình mạng." },
  { key: "account", icon: "♙", color: "purple", description: "Khôi phục tài khoản và xử lý lỗi đăng nhập." },
  { key: "performance", icon: "▣", color: "orange", description: "Kiểm tra ứng dụng, bộ nhớ và dung lượng máy." },
  { key: "software", icon: "▧", color: "green", description: "Cài đặt an toàn và xử lý lỗi ứng dụng." },
  { key: "hardware", icon: "▤", color: "orange", description: "Xử lý sự cố máy in, màn hình và thiết bị." },
  { key: "security", icon: "◇", color: "purple", description: "Nhận biết dấu hiệu đáng ngờ và báo sự cố." },
] as const;

const categoryLabels: Record<string, string> = {
  Network: "Mạng & kết nối",
  Hardware: "Phần cứng",
  Software: "Phần mềm",
  "Account & Access": "Tài khoản & truy cập",
  Security: "Bảo mật",
  Other: "Khác",
  Unassigned: "Chưa phân loại",
};

function matchesKnowledgeSearch(key: string, searchTerm: string) {
  const guide = guides[key];
  const card = knowledgeCards.find((item) => item.key === key);
  return `${guide.title} ${guide.category} ${guide.intro} ${card?.description || ""}`
    .toLowerCase()
    .includes(searchTerm.trim().toLowerCase());
}

function mapApiTicket(raw: ApiTicket): Ticket {
  const priority = priorities.includes(raw.priority as PriorityLevel)
    ? (raw.priority as PriorityLevel)
    : "Medium";

  const status = statuses.includes(raw.status as TicketStatus)
    ? (raw.status as TicketStatus)
    : "Open";

  const parsedDate = raw.createdAt ? new Date(raw.createdAt) : null;

  const date =
    parsedDate && !Number.isNaN(parsedDate.getTime())
      ? parsedDate.toLocaleDateString("vi-VN")
      : "—";

  return {
    id: raw.ticketId,
    title: raw.title || "Ticket chưa có tiêu đề",
    category: raw.category || "Unassigned",
    priority,
    status,
    owner: raw.assignedTeam || "IT General",
    date,
    updatedAt: raw.updatedAt || raw.createdAt,
    updatedDate:
      raw.updatedAt && !Number.isNaN(new Date(raw.updatedAt).getTime())
        ? new Date(raw.updatedAt).toLocaleDateString("vi-VN")
        : date,
    description: raw.description || "",
    aiReason: raw.aiReason || "",
    aiSuggestion: raw.aiSuggestion || "",
    createdAt: raw.createdAt,
  };
}

async function readApiResponse(response: Response) {
  let result: Record<string, unknown>;

  try {
    result = await response.json();
  } catch {
    throw new Error(
      `Server trả về dữ liệu không hợp lệ (HTTP ${response.status}).`
    );
  }

  if (!response.ok || result.success === false) {
    const message =
      typeof result.error === "string"
        ? result.error
        : typeof result.message === "string"
          ? result.message
          : `Yêu cầu thất bại (HTTP ${response.status}).`;

    throw new Error(message);
  }

  return result;
}

function getErrorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

export default function Home() {
  const router = useRouter();
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [page, setPage] = useState<Page>("overview");
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [dashboardTickets, setDashboardTickets] = useState<Ticket[]>([]);
  const [ticketSummary, setTicketSummary] = useState<TicketSummary>(emptyTicketSummary);
  const [ticketCategories, setTicketCategories] = useState<TicketBreakdown>([]);
  const [ticketPriorities, setTicketPriorities] = useState<TicketBreakdown>([]);
  const [reportPeriod, setReportPeriod] = useState<"all" | "30d" | "7d">("all");
  const [ticketTotal, setTicketTotal] = useState(0);
  const [ticketTotalPages, setTicketTotalPages] = useState(1);
  const [ticketPage, setTicketPage] = useState(1);
  const [refreshTicketList, setRefreshTicketList] = useState(0);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [apiError, setApiError] = useState("");

  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [knowledgeQuery, setKnowledgeQuery] = useState("");
  const [filter, setFilter] = useState("All");
  const [sortBy, setSortBy] = useState("recent");

  const [chatInput, setChatInput] = useState("");
  const [sendingMessage, setSendingMessage] = useState(false);

  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "welcome",
      role: "ai",
      text:
        "Xin chào! Mình là HelpMate AI. " +
        "Bạn đang gặp vấn đề CNTT gì? " +
        "Hãy mô tả sự cố để mình hỗ trợ bạn từng bước.",
    },
  ]);

  const [showNewTicket, setShowNewTicket] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [creatingTicket, setCreatingTicket] = useState(false);

  const [toast, setToast] = useState("");
  const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
  const [selectedGuide, setSelectedGuide] = useState<Guide | null>(null);
  const [updatingTicketId, setUpdatingTicketId] = useState("");

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);
  const latestTicketRequest = useRef(0);

  useEffect(() => {
    let active = true;
    fetch("/api/auth/session", { cache: "no-store" })
      .then(async (response) => {
        if (!response.ok) {
          router.replace("/login");
          return null;
        }
        return response.json();
      })
      .then((result) => {
        if (!active || !result?.user) return;
        setAuthUser(result.user as AuthUser);
        setAuthChecked(true);
      })
      .catch(() => router.replace("/login"));
    return () => { active = false; };
  }, [router]);

  async function logout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  function exportReportCsv() {
    const rows = [
      ["Nhóm", "Tên", "Số lượng"],
      ["Tổng quan", "Tổng ticket", String(ticketSummary.total)],
      ["Trạng thái", "Đang mở", String(ticketSummary.open)],
      ["Trạng thái", "Đang xử lý", String(ticketSummary.inProgress)],
      ["Trạng thái", "Đã giải quyết", String(ticketSummary.resolved)],
      ["Ưu tiên", "Ticket ưu tiên cao chưa giải quyết", String(ticketSummary.urgent)],
      ...ticketCategories.map((item) => ["Danh mục", categoryLabels[item._id] || item._id || "Khác", String(item.count)]),
      ...ticketPriorities.map((item) => [
        "Mức ưu tiên",
        ({ Critical: "Nghiêm trọng", High: "Cao", Medium: "Trung bình", Low: "Thấp" } as Record<string, string>)[item._id] || item._id,
        String(item.count),
      ]),
      ["Thông tin", "Khoảng thời gian", reportPeriod === "all" ? "Toàn bộ thời gian" : `${reportPeriod === "7d" ? "7" : "30"} ngày gần nhất`],
      ["Thông tin", "Thời điểm xuất (UTC)", new Date().toISOString()],
    ];
    const csv = `\uFEFF${rows.map((row) => row.map((value) => `"${value.replaceAll('"', '""')}"`).join(",")).join("\r\n")}`;
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const link = document.createElement("a");
    link.href = url;
    link.download = `helpmate-bao-cao-${new Date().toISOString().slice(0, 10)}.csv`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  const notify = useCallback((text: string) => {
    setToast(text);

    if (toastTimer.current) {
      clearTimeout(toastTimer.current);
    }

    toastTimer.current = setTimeout(() => {
      setToast("");
      toastTimer.current = null;
    }, 3500);
  }, []);

  useEffect(() => {
    return () => {
      if (toastTimer.current) {
        clearTimeout(toastTimer.current);
      }
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "end",
    });
  }, [messages, sendingMessage]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(query.trim());
      setTicketPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  const loadTickets = useCallback(async () => {
    const requestId = ++latestTicketRequest.current;
    setTicketsLoading(true);

    try {
      const params = new URLSearchParams({
        page: String(ticketPage),
        limit: "10",
        sort: sortBy,
        reportPeriod: page === "reports" ? reportPeriod : "all",
      });
      if (debouncedQuery) params.set("search", debouncedQuery);
      if (filter !== "All") params.set("status", filter);

      const response = await fetch(`/api/tickets?${params.toString()}`, {
        method: "GET",
        cache: "no-store",
        signal: AbortSignal.timeout(12000),
      });

      const result = await readApiResponse(response);
      if (requestId !== latestTicketRequest.current) return;

      const data: ApiTicket[] = Array.isArray(result.data)
        ? (result.data as ApiTicket[])
        : [];
      const priorityData: ApiTicket[] = Array.isArray(result.priorityTickets)
        ? (result.priorityTickets as ApiTicket[])
        : [];
      const meta = result.meta as {
        page?: number;
        total?: number;
        totalPages?: number;
        summary?: Partial<TicketSummary> & {
          categories?: TicketBreakdown;
          priorities?: TicketBreakdown;
        };
      } | undefined;

      const mappedTickets = data
        .filter((ticket) => typeof ticket.ticketId === "string")
        .map(mapApiTicket);
      const mappedPriorityTickets = priorityData
        .filter((ticket) => typeof ticket.ticketId === "string")
        .map(mapApiTicket);

      setTickets(mappedTickets);
      setDashboardTickets(mappedPriorityTickets);
      setTicketTotal(Number(meta?.total) || 0);
      setTicketTotalPages(Math.max(1, Number(meta?.totalPages) || 1));
      setTicketPage(Math.max(1, Number(meta?.page) || 1));
      setTicketSummary({
        total: Number(meta?.summary?.total) || 0,
        open: Number(meta?.summary?.open) || 0,
        inProgress: Number(meta?.summary?.inProgress) || 0,
        resolved: Number(meta?.summary?.resolved) || 0,
        urgent: Number(meta?.summary?.urgent) || 0,
      });
      setTicketCategories(Array.isArray(meta?.summary?.categories) ? meta.summary.categories : []);
      setTicketPriorities(Array.isArray(meta?.summary?.priorities) ? meta.summary.priorities : []);
      setApiError("");

      setSelectedTicket((current) => {
        if (!current) return null;

        return (
          mappedTickets.find((ticket) => ticket.id === current.id) ??
          mappedPriorityTickets.find((ticket) => ticket.id === current.id) ??
          current
        );
      });
    } catch (error) {
      if (requestId !== latestTicketRequest.current) return;
      const message = getErrorMessage(error, "");
      const normalized = message.toLowerCase();
      setApiError(
        message.includes("Không thể kết nối cơ sở dữ liệu")
          ? message
          : normalized.includes("mongodb") ||
          normalized.includes("mongo") ||
          normalized.includes("econnrefused") ||
          normalized.includes("timed out") ||
          normalized.includes("timeout") ||
          error instanceof DOMException && error.name === "TimeoutError" ||
          normalized.includes("fetch failed")
          ? "Chưa kết nối được cơ sở dữ liệu ticket. Hãy kiểm tra MongoDB và cấu hình MONGODB_URI, sau đó thử tải lại."
          : "Không thể tải ticket từ máy chủ. Hãy thử lại; nếu lỗi tiếp diễn, kiểm tra nhật ký API."
      );
    } finally {
      if (requestId === latestTicketRequest.current) setTicketsLoading(false);
    }
  }, [debouncedQuery, filter, page, reportPeriod, sortBy, ticketPage, refreshTicketList]);

  useEffect(() => {
    if (!authChecked || !authUser) return;
    void loadTickets();
  }, [authChecked, authUser, loadTickets]);

  const visibleTickets = tickets;

  function openTicket(ticket: Ticket) {
    setSelectedTicket(ticket);
  }

  async function createTicket() {
    if (creatingTicket) return;

    const title = newTitle.trim();
    const description = newDescription.trim();

    if (!title || !description) {
      notify("Vui lòng nhập tiêu đề và mô tả chi tiết.");
      return;
    }

    if (title.length > 200) {
      notify("Tiêu đề không được vượt quá 200 ký tự.");
      return;
    }

    if (description.length > 10000) {
      notify("Mô tả không được vượt quá 10.000 ký tự.");
      return;
    }

    setCreatingTicket(true);

    try {
      const response = await fetch("/api/tickets", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title,
          description,
        }),
      });

      const result = await readApiResponse(response);
      const created = result.data as ApiTicket | undefined;

      setShowNewTicket(false);
      setNewTitle("");
      setNewDescription("");

      setPage("tickets");
      setTicketPage(1);
      setFilter("All");
      setQuery("");
      setDebouncedQuery("");
      setSortBy("recent");
      setRefreshTicketList((value) => value + 1);

      if (created?.ticketId) {
        const classificationNote = result.classificationMode === "fallback"
          ? " AI chưa kết nối; hệ thống đã phân loại dự phòng theo từ khóa."
          : "";
        notify(
          `Đã tạo ${created.ticketId}. ` +
            `Phân loại: ${categoryLabels[created.category || "Other"] || created.category || "Khác"} · ` +
            `Ưu tiên: ${created.priority || "Medium"}.` +
            classificationNote
        );
      } else {
        notify("Đã tạo ticket thành công.");
      }
    } catch (error) {
      notify(
        getErrorMessage(error, "Không thể tạo ticket. Hãy kiểm tra backend.")
      );
    } finally {
      setCreatingTicket(false);
    }
  }

  async function updateTicketStatus(
    ticketId: string,
    status: TicketStatus
  ) {
    if (updatingTicketId === ticketId) return;

    const previousTickets = tickets;
    const previousSelectedTicket = selectedTicket;

    const currentTicket = tickets.find((ticket) => ticket.id === ticketId);

    if (!currentTicket || currentTicket.status === status) return;

    const updatedAt = new Date().toISOString();
    const updatedDate = new Date(updatedAt).toLocaleDateString("vi-VN");

    setUpdatingTicketId(ticketId);

    // Cập nhật giao diện trước để người dùng thấy phản hồi ngay.
    setTickets((old) =>
      old.map((ticket) =>
        ticket.id === ticketId
          ? { ...ticket, status, updatedAt, updatedDate }
          : ticket
      )
    );

    setSelectedTicket((old) =>
      old?.id === ticketId
        ? { ...old, status, updatedAt, updatedDate }
        : old
    );

    try {
      const response = await fetch(
        `/api/tickets/${encodeURIComponent(ticketId)}`,
        {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({ status }),
        }
      );

      const result = await readApiResponse(response);

      // Dùng dữ liệu server trả về nếu có.
      if (result.data) {
        const updated = mapApiTicket(result.data as ApiTicket);

        setTickets((old) =>
          old.map((ticket) =>
            ticket.id === ticketId ? updated : ticket
          )
        );

        setSelectedTicket((old) =>
          old?.id === ticketId ? updated : old
        );
      }

      setRefreshTicketList((value) => value + 1);
      notify("Đã cập nhật trạng thái ticket.");
    } catch (error) {
      setTickets(previousTickets);
      setSelectedTicket(previousSelectedTicket);

      notify(
        getErrorMessage(error, "Không thể cập nhật trạng thái ticket.")
      );
    } finally {
      setUpdatingTicketId("");
    }
  }

  async function sendMessage(text = chatInput) {
    const value = text.trim();

    if (!value || sendingMessage) return;

    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      role: "user",
      text: value,
    };

    setMessages((old) => [...old, userMessage]);
    setChatInput("");
    setSendingMessage(true);

    try {
      /*
       * API này phải được tạo ở backend để gọi Ollama.
       * Không gọi Ollama trực tiếp từ trình duyệt.
       */
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: value,
          history: messages.map((message) => ({
            role: message.role === "ai" ? "assistant" : "user",
            content: message.text,
          })),
        }),
      });

      const result = await readApiResponse(response);

      const answer =
        typeof result.reply === "string"
          ? result.reply
          : typeof result.message === "string"
            ? result.message
            : typeof result.data === "string"
              ? result.data
              : "";

      if (!answer.trim()) {
        throw new Error("API chat không trả về nội dung phản hồi.");
      }

      setMessages((old) => [
        ...old,
        {
          id: crypto.randomUUID(),
          role: "ai",
          text: answer,
        },
      ]);
    } catch (error) {
      setMessages((old) => [
        ...old,
        {
          id: crypto.randomUUID(),
          role: "ai",
          text:
            "Mình chưa thể kết nối với dịch vụ AI lúc này. " +
            getErrorMessage(error, "Vui lòng thử lại sau.") +
            "\n\nBạn vẫn có thể tạo ticket để lưu sự cố và gửi cho đội IT.",
        },
      ]);
    } finally {
      setSendingMessage(false);
    }
  }

  function startNewChat() {
    setMessages([
      {
        id: crypto.randomUUID(),
        role: "ai",
        text:
          "Cuộc trò chuyện mới bắt đầu. " +
          "Bạn đang gặp vấn đề CNTT gì?",
      },
    ]);
  }

  if (!authChecked || !authUser) {
    return (
      <main className="auth-screen">
        <p role="status">Đang kiểm tra phiên đăng nhập…</p>
      </main>
    );
  }

  const initials = authUser.name.split(/\s+/).slice(-2).map((part) => part[0]).join("").toUpperCase();

  return (
    <main className="app-shell">
      {mobileNavOpen && (
        <button
          type="button"
          className="mobile-nav-backdrop"
          aria-label="Đóng menu điều hướng"
          onClick={() => setMobileNavOpen(false)}
        />
      )}
      <aside className={`sidebar ${mobileNavOpen ? "mobile-open" : ""}`}>
        <div className="brand">
          <div className="brand-mark">✳</div>
          <div>
            <strong>
              help<span>mate</span>
            </strong>
            <small>AI IT HELPDESK</small>
          </div>
        </div>

        <div className="workspace-label">WORKSPACE</div>

        <nav className="nav-list">
          {navItems.map((item) => (
            <button
              key={item.id}
              className={`nav-item ${page === item.id ? "active" : ""}`}
              aria-current={page === item.id ? "page" : undefined}
              title={item.label}
              onClick={() => { setPage(item.id); setMobileNavOpen(false); }}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>

              {item.id === "tickets" && (
                <span className="nav-count">
                  {ticketSummary.open + ticketSummary.inProgress}
                </span>
              )}
            </button>
          ))}
        </nav>

        <div className="sidebar-bottom">
          <div className="help-card">
            <div className="help-card-icon">✦</div>
            <strong>Cần trợ giúp?</strong>
            <p>Để AI hướng dẫn bạn xử lý sự cố nhanh hơn.</p>
            <button onClick={() => setPage("chat")}>
              Bắt đầu trò chuyện <span>↗</span>
            </button>
          </div>

          <div className="user-profile">
            <div className="avatar">{initials}</div>
            <div className="user-info">
              <strong>{authUser.name}</strong>
              <span>{authUser.role === "admin" ? "Quản trị viên" : "Nhân viên"}</span>
            </div>
            <button className="more-button" aria-label="Đăng xuất" title="Đăng xuất" onClick={() => void logout()}>
              ↪
            </button>
          </div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <button
            type="button"
            className="mobile-nav-toggle"
            aria-label={mobileNavOpen ? "Đóng menu" : "Mở menu"}
            aria-expanded={mobileNavOpen}
            onClick={() => setMobileNavOpen((open) => !open)}
          >
            ☰
          </button>
          <div className="breadcrumbs">
            <span>Workspace</span>
            <b>/</b>
            <strong>
              {navItems.find((item) => item.id === page)?.label}
            </strong>
          </div>

          <div className="top-actions">
            <span className={`system-status ${apiError ? "system-status-error" : ""}`}>
              <i /> {apiError ? "Kết nối ticket gián đoạn" : "Hệ thống hoạt động"}
            </span>

            <button
              className="icon-button"
              aria-label="Thông báo"
              onClick={() => notify("Bạn đã xem các thông báo mới.")}
            >
              ♧<i className="notification-dot" />
            </button>

            <button className="logout-button" onClick={() => void logout()}>Đăng xuất</button>
            <div className="top-avatar" title={authUser.email}>{initials}</div>
          </div>
        </header>

        <div className="content">
          {page === "overview" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">TỔNG QUAN KHÔNG GIAN LÀM VIỆC</div>
                  <h1>
                    Xin chào, {authUser.name.split(/\s+/).slice(-1)[0]}{" "}
                    <span className="wave">✦</span>
                  </h1>
                  <p>
                    Đây là tình hình hỗ trợ CNTT của bạn hôm nay.
                  </p>
                </div>

                <button
                  className="primary-button"
                  onClick={() => setShowNewTicket(true)}
                >
                  <span>＋</span> Tạo ticket mới
                </button>
              </div>

              {apiError && (
                <div className="api-error" role="alert">
                  <span className="api-error-icon">!</span>
                  <div><strong>Không tải được ticket</strong><p>{apiError}</p></div>
                  <button disabled={ticketsLoading} onClick={() => void loadTickets()}>
                    {ticketsLoading ? "Đang thử…" : "Thử lại"}
                  </button>
                </div>
              )}

              {!apiError && !ticketsLoading && ticketSummary.urgent > 0 && (
                <button
                  type="button"
                  className="priority-alert"
                  onClick={() => { setPage("tickets"); setFilter("All"); setSortBy("priority"); setTicketPage(1); setQuery(""); setDebouncedQuery(""); }}
                >
                  <span className="priority-alert-icon">!</span>
                  <span><strong>Có ticket cần ưu tiên</strong><small>{ticketSummary.urgent} yêu cầu mức cao hoặc nghiêm trọng</small></span>
                  <b>Xem ticket →</b>
                </button>
              )}

              <div className="stats-grid">
                <StatCard
                  label="Tổng ticket"
                  value={ticketsLoading ? "..." : String(ticketSummary.total)}
                  change="Từ cơ sở dữ liệu"
                  icon="▤"
                  tone="violet"
                  note="từ MongoDB"
                />

                <StatCard
                  label="Đang mở"
                  value={
                    ticketsLoading
                      ? "..."
                    : String(ticketSummary.open)
                  }
                  change="Cần xử lý"
                  icon="◷"
                  tone="orange"
                  note="ticket đang chờ"
                />

                <StatCard
                  label="Đang xử lý"
                  value={
                    ticketsLoading
                      ? "..."
                    : String(ticketSummary.inProgress)
                  }
                  change="Đang thực hiện"
                  icon="⟳"
                  tone="blue"
                  note="bởi đội IT"
                />

                <StatCard
                  label="Đã giải quyết"
                  value={
                    ticketsLoading
                      ? "..."
                    : String(ticketSummary.resolved)
                  }
                  change="Hoàn tất"
                  icon="✓"
                  tone="green"
                  note="ticket hoàn tất"
                />
              </div>

              <div className="dashboard-grid">
                <section className="panel ticket-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>Ticket cần chú ý</h2>
                      <p>Ưu tiên các sự cố cần được xử lý sớm</p>
                    </div>

                    <button
                      className="text-button"
                      onClick={() => { setPage("tickets"); setFilter("All"); setSortBy("recent"); setTicketPage(1); setQuery(""); setDebouncedQuery(""); }}
                    >
                      Xem tất cả <span>→</span>
                    </button>
                  </div>

                  <div className="ticket-table-wrap">
                    <table className="ticket-table">
                      <thead>
                        <tr>
                          <th>MÃ TICKET / VẤN ĐỀ</th>
                          <th>ƯU TIÊN</th>
                          <th>TRẠNG THÁI</th>
                          <th>ĐỘI PHỤ TRÁCH</th>
                        </tr>
                      </thead>

                      <tbody>
                        {ticketsLoading ? (
                          <tr>
                            <td colSpan={4} className="empty-state">
                              <span className="loading-indicator" /> Đang tải ticket...
                            </td>
                          </tr>
                        ) : (
                          dashboardTickets.map((ticket) => (
                            <tr
                              key={ticket.id}
                              onClick={() => {
                                setPage("tickets");
                                openTicket(ticket);
                              }}
                              style={{ cursor: "pointer" }}
                            >
                              <td>
                                <strong>{ticket.id}</strong>
                                <span className="ticket-title">
                                  {ticket.title}
                                </span>
                              </td>
                              <td>
                                <Priority priority={ticket.priority} />
                              </td>
                              <td>
                                <Status status={ticket.status} />
                              </td>
                              <td>
                                <div className="person-cell">
                                  <span className="mini-avatar">
                                    {ticket.owner.slice(0, 1)}
                                  </span>
                                  {ticket.owner}
                                </div>
                              </td>
                            </tr>
                          ))
                        )}

                        {!ticketsLoading && dashboardTickets.length === 0 && (
                          <tr>
                            <td colSpan={4} className="empty-state">
                              <div className="empty-state-content">
                                <span className="empty-state-icon">▤</span>
                                <strong>Chưa có ticket nào</strong>
                                <span>Tạo yêu cầu đầu tiên để đội IT có thể hỗ trợ bạn.</span>
                                <button type="button" onClick={() => setShowNewTicket(true)}>＋ Tạo ticket</button>
                              </div>
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </section>

                <section className="panel assistant-panel">
                  <div className="assistant-top">
                    <div className="ai-orb">✳</div>
                    <div>
                      <span className="online-label">
                        <i /> TRỢ LÝ AI
                      </span>
                      <h2>HelpMate AI</h2>
                      <p>Trợ lý kỹ thuật của bạn</p>
                    </div>
                    <span className="sparkle">✧</span>
                  </div>

                  <div className="assistant-message">
                    Xin chào Phương! 👋
                    <br />
                    <br />
                    Mình có thể giúp bạn chẩn đoán lỗi, tìm hướng dẫn
                    hoặc tạo ticket hỗ trợ.
                  </div>

                  <div className="suggestion-label">BẠN CẦN GIÚP GÌ?</div>

                  <button
                    className="suggestion"
                    onClick={() => {
                      setPage("chat");
                      void sendMessage(
                        "Máy tính của tôi không kết nối được Wi-Fi"
                      );
                    }}
                  >
                    ⌁ <span>Khắc phục lỗi Wi-Fi</span><b>↗</b>
                  </button>

                  <button
                    className="suggestion"
                    onClick={() => {
                      setPage("chat");
                      void sendMessage("Tôi không thể đăng nhập tài khoản");
                    }}
                  >
                    ♙ <span>Vấn đề tài khoản</span><b>↗</b>
                  </button>

                  <button
                    className="suggestion"
                    onClick={() => setPage("chat")}
                  >
                    ＋ <span>Mô tả sự cố khác</span><b>↗</b>
                  </button>

                  <button
                    className="chat-cta"
                    onClick={() => setPage("chat")}
                  >
                    Trò chuyện với AI <span>→</span>
                  </button>
                </section>
              </div>

              <section className="panel knowledge-panel">
                <div className="panel-heading">
                  <div>
                    <h2>Kiến thức nổi bật</h2>
                    <p>
                      Hướng dẫn xử lý nhanh các vấn đề thường gặp
                    </p>
                  </div>

                  <button
                    className="text-button"
                    onClick={() => setPage("knowledge")}
                  >
                    Khám phá kho kiến thức <span>→</span>
                  </button>
                </div>

                <div className="knowledge-grid">
                  <KnowledgeCard
                    icon="⌁"
                    category="MẠNG & KẾT NỐI"
                    title="Khắc phục sự cố Wi-Fi"
                    desc="Các bước kiểm tra khi thiết bị không thể kết nối mạng."
                    color="blue"
                    onClick={() => setPage("knowledge")}
                  />

                  <KnowledgeCard
                    icon="♙"
                    category="TÀI KHOẢN"
                    title="Khôi phục quyền truy cập"
                    desc="Xử lý lỗi đăng nhập và quên mật khẩu an toàn."
                    color="purple"
                    onClick={() => setPage("knowledge")}
                  />

                  <KnowledgeCard
                    icon="▣"
                    category="HIỆU NĂNG"
                    title="Tối ưu máy tính chậm"
                    desc="Kiểm tra ứng dụng nền và tài nguyên hệ thống."
                    color="orange"
                    onClick={() => setPage("knowledge")}
                  />
                </div>
              </section>
            </>
          )}

          {page === "tickets" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">TRUNG TÂM HỖ TRỢ</div>
                  <h1>Quản lý ticket</h1>
                  <p>
                    Nhấn vào một ticket để xem chi tiết yêu cầu hỗ trợ.
                  </p>
                </div>

                <button
                  className="primary-button"
                  onClick={() => setShowNewTicket(true)}
                >
                  ＋ Tạo ticket mới
                </button>
              </div>

              {apiError && (
                <div className="api-error" role="alert">
                  <span className="api-error-icon">!</span>
                  <div><strong>Không tải được ticket</strong><p>{apiError}</p></div>
                  <button disabled={ticketsLoading} onClick={() => void loadTickets()}>
                    {ticketsLoading ? "Đang thử…" : "Thử lại"}
                  </button>
                </div>
              )}

              <section className="panel ticket-list-panel">
                <div className="list-toolbar">
                  <div className="search-box">
                    <span>⌕</span>
                    <input
                    value={query}
                    onChange={(event) => setQuery(event.target.value)}
                      placeholder="Tìm theo mã, vấn đề, đội phụ trách..."
                    />
                  </div>

                  <select
                    value={filter}
                    onChange={(event) => { setFilter(event.target.value); setTicketPage(1); }}
                  >
                    <option value="All">Tất cả trạng thái</option>
                    <option value="Open">Đang mở</option>
                    <option value="In Progress">Đang xử lý</option>
                    <option value="Resolved">Đã giải quyết</option>
                  </select>
                  <select aria-label="Sắp xếp ticket" value={sortBy} onChange={(event) => { setSortBy(event.target.value); setTicketPage(1); }}>
                    <option value="recent">Mới nhất</option>
                    <option value="updated">Vừa cập nhật</option>
                    <option value="oldest">Cũ nhất</option>
                    <option value="priority">Ưu tiên cao trước</option>
                  </select>
                </div>

                <div className="ticket-table-wrap">
                  <table className="ticket-table full-table">
                    <thead>
                      <tr>
                        <th>MÃ TICKET / VẤN ĐỀ</th>
                        <th>PHÂN LOẠI</th>
                        <th>ƯU TIÊN</th>
                        <th>TRẠNG THÁI</th>
                        <th>ĐỘI PHỤ TRÁCH</th>
                        <th>NGÀY TẠO</th>
                        <th>CẬP NHẬT</th>
                      </tr>
                    </thead>

                    <tbody>
                      {ticketsLoading ? (
                        <tr>
                          <td colSpan={7} className="empty-state">
                            <span className="loading-indicator" /> Đang tải danh sách ticket...
                          </td>
                        </tr>
                      ) : (
                        visibleTickets.map((ticket) => (
                          <tr
                            key={ticket.id}
                            onClick={() => openTicket(ticket)}
                            style={{ cursor: "pointer" }}
                            title="Nhấn để xem chi tiết ticket"
                          >
                            <td>
                              <strong>{ticket.id}</strong>
                              <span className="ticket-title">
                                {ticket.title}
                              </span>
                            </td>

                              <td>{categoryLabels[ticket.category] || ticket.category}</td>

                            <td>
                              <Priority priority={ticket.priority} />
                            </td>

                            <td onClick={(event) => event.stopPropagation()}>
                              {authUser.role === "admin" ? <select
                                className="status-select"
                                aria-label={`Trạng thái ${ticket.id}`}
                                value={ticket.status}
                                disabled={updatingTicketId === ticket.id}
                                onChange={(event) => {
                                  void updateTicketStatus(
                                    ticket.id,
                                    event.target.value as TicketStatus
                                  );
                                }}
                              >
                                <option value="Open">Đang mở</option>
                                <option value="In Progress">Đang xử lý</option>
                                <option value="Resolved">Đã giải quyết</option>
                              </select> : <Status status={ticket.status} />}
                            </td>

                            <td>{ticket.owner}</td>
                            <td>{ticket.date}</td>
                            <td>{ticket.updatedDate || ticket.date}</td>
                          </tr>
                        ))
                      )}

                      {!ticketsLoading && visibleTickets.length === 0 && (
                        <tr>
                          <td colSpan={7} className="empty-state">
                            <div className="empty-state-content">
                              <span className="empty-state-icon">⌕</span>
                              <strong>Không tìm thấy ticket phù hợp</strong>
                              <span>Thử đổi từ khóa hoặc bộ lọc trạng thái.</span>
                              {(query || filter !== "All") && <button type="button" onClick={() => { setQuery(""); setDebouncedQuery(""); setFilter("All"); setTicketPage(1); }}>Xóa bộ lọc</button>}
                            </div>
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="table-footer">
                  {ticketTotal === 0 ? "Không có ticket" : `Hiển thị ${(ticketPage - 1) * 10 + 1}–${Math.min(ticketPage * 10, ticketTotal)} trên ${ticketTotal} ticket`}
                  <span>Đồng bộ API · MongoDB</span>
                </div>
                <div className="pagination-bar" aria-label="Phân trang ticket">
                  <span>Trang {ticketPage} / {ticketTotalPages}</span>
                  <div>
                    <button type="button" disabled={ticketsLoading || ticketPage <= 1} onClick={() => setTicketPage((page) => Math.max(1, page - 1))}>← Trước</button>
                    <button type="button" disabled={ticketsLoading || ticketPage >= ticketTotalPages} onClick={() => setTicketPage((page) => Math.min(ticketTotalPages, page + 1))}>Tiếp →</button>
                  </div>
                </div>
              </section>
            </>
          )}

          {page === "reports" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">PHÂN TÍCH HỖ TRỢ CNTT</div>
                  <h1>Báo cáo ticket</h1>
                  <p>{reportPeriod === "all" ? "Tổng hợp ticket trong phạm vi dữ liệu tài khoản của bạn." : `Tổng hợp ticket phát sinh trong ${reportPeriod === "7d" ? "7 ngày" : "30 ngày"} gần nhất.`}</p>
                </div>
                <div className="report-actions">
                  <label className="report-range-label" htmlFor="report-period">Khoảng thời gian</label>
                  <select id="report-period" className="report-range-select" value={reportPeriod} onChange={(event) => setReportPeriod(event.target.value as typeof reportPeriod)}>
                    <option value="7d">7 ngày gần nhất</option>
                    <option value="30d">30 ngày gần nhất</option>
                    <option value="all">Toàn bộ thời gian</option>
                  </select>
                  <button className="secondary-button" onClick={exportReportCsv} disabled={ticketsLoading || Boolean(apiError)}>↓ Tải CSV</button>
                  <button className="secondary-button" onClick={() => void loadTickets()} disabled={ticketsLoading}>
                    {ticketsLoading ? "Đang cập nhật…" : "↻ Làm mới dữ liệu"}
                  </button>
                </div>
              </div>

              {apiError && (
                <div className="api-error" role="alert">
                  <span className="api-error-icon">!</span>
                  <div><strong>Không tải được báo cáo</strong><p>{apiError}</p></div>
                  <button disabled={ticketsLoading} onClick={() => void loadTickets()}>
                    {ticketsLoading ? "Đang thử…" : "Thử lại"}
                  </button>
                </div>
              )}

              <div className="stats-grid report-stats">
                <StatCard label="Tổng ticket" value={String(ticketSummary.total)} change={`${ticketSummary.urgent} ưu tiên cao`} icon="▤" tone="violet" note="trong hệ thống" />
                <StatCard label="Đang mở" value={String(ticketSummary.open)} change="Cần tiếp nhận" icon="◷" tone="orange" note="chưa xử lý" />
                <StatCard label="Đang xử lý" value={String(ticketSummary.inProgress)} change="Đội IT phụ trách" icon="↗" tone="blue" note="đang thực hiện" />
                <StatCard label="Đã giải quyết" value={String(ticketSummary.resolved)} change={ticketSummary.total ? `${Math.round(ticketSummary.resolved / ticketSummary.total * 100)}% tổng ticket` : "Chưa có dữ liệu"} icon="✓" tone="green" note="đã hoàn tất" />
              </div>

              <div className="report-breakdowns">
                <section className="panel breakdown-panel">
                  <div className="panel-heading"><div><h2>Theo danh mục</h2><p>Phân bố trên toàn bộ ticket</p></div></div>
                  <div className="breakdown-list">
                    {ticketCategories.length ? ticketCategories.map((item) => {
                      const percent = ticketSummary.total ? Math.round(item.count / ticketSummary.total * 100) : 0;
                      return <div className="breakdown-row" key={item._id}>
                        <div className="breakdown-label"><span>{categoryLabels[item._id] || item._id || "Khác"}</span><strong>{item.count}</strong></div>
                        <div className="breakdown-track"><span style={{ width: `${percent}%` }} /></div>
                      </div>;
                    }) : <p className="breakdown-empty">Chưa có dữ liệu phân loại.</p>}
                  </div>
                </section>
                <section className="panel breakdown-panel">
                  <div className="panel-heading"><div><h2>Theo mức ưu tiên</h2><p>Phân bố trên toàn bộ ticket</p></div></div>
                  <div className="breakdown-list">
                    {(["Critical", "High", "Medium", "Low"] as const).map((priority) => {
                      const count = ticketPriorities.find((item) => item._id === priority)?.count || 0;
                      const percent = ticketSummary.total ? Math.round(count / ticketSummary.total * 100) : 0;
                      const labels: Record<PriorityLevel, string> = { Critical: "Nghiêm trọng", High: "Cao", Medium: "Trung bình", Low: "Thấp" };
                      return <div className="breakdown-row" key={priority}>
                        <div className="breakdown-label"><span><i className={`priority-dot priority-dot-${priority.toLowerCase()}`} />{labels[priority]}</span><strong>{count}</strong></div>
                        <div className="breakdown-track"><span className={`breakdown-fill-${priority.toLowerCase()}`} style={{ width: `${percent}%` }} /></div>
                      </div>;
                    })}
                  </div>
                </section>
              </div>

              <section className="panel report-panel">
                <div className="panel-heading">
                  <div><h2>Ticket gần đây</h2><p>{ticketSummary.total ? `5 ticket mới nhất trên tổng số ${ticketSummary.total}` : "Ticket mới sẽ xuất hiện tại đây."}</p></div>
                  <button className="text-button" onClick={() => setPage("tickets")}>Xem tất cả →</button>
                </div>
                <div className="ticket-table-wrap">
                  <table className="ticket-table full-table">
                    <thead><tr><th>MÃ TICKET / VẤN ĐỀ</th><th>PHÂN LOẠI</th><th>ƯU TIÊN</th><th>TRẠNG THÁI</th><th>NGÀY TẠO</th></tr></thead>
                    <tbody>
                      {ticketsLoading ? <tr><td colSpan={5} className="empty-state"><span className="loading-indicator" /> Đang tải dữ liệu...</td></tr> : tickets.length ? tickets.slice(0, 5).map((ticket) => (
                        <tr key={ticket.id} onClick={() => openTicket(ticket)} style={{ cursor: "pointer" }} title="Nhấn để xem chi tiết ticket">
                          <td><strong>{ticket.id}</strong><span className="ticket-title">{ticket.title}</span></td>
                          <td>{categoryLabels[ticket.category] || ticket.category}</td>
                          <td><Priority priority={ticket.priority} /></td>
                          <td><Status status={ticket.status} /></td>
                          <td>{ticket.date}</td>
                        </tr>
                      )) : <tr><td colSpan={5} className="empty-state"><div className="empty-state-content"><span className="empty-state-icon">▥</span><strong>Chưa có dữ liệu ticket</strong><span>Tạo ticket đầu tiên để bắt đầu theo dõi hoạt động hỗ trợ.</span></div></td></tr>}
                    </tbody>
                  </table>
                </div>
                <div className="table-footer"><span>Số liệu được cập nhật từ MongoDB</span><span>Phạm vi: {authUser.role === "admin" ? "Toàn bộ hệ thống" : "Ticket của bạn"}</span></div>
              </section>
            </>
          )}

          {page === "chat" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">HỖ TRỢ CÙNG TRÍ TUỆ NHÂN TẠO</div>
                  <h1>Trợ lý AI</h1>
                  <p>
                    Mô tả vấn đề của bạn — cùng tìm giải pháp từng bước.
                  </p>
                </div>

                <span className="system-status">
                  <i /> Sẵn sàng hỗ trợ
                </span>
              </div>

              <section className="chat-layout panel">
                <div className="chat-header">
                  <div className="ai-orb small-orb">✳</div>
                  <div>
                    <strong>HelpMate AI</strong>
                    <span><i /> Trợ lý kỹ thuật</span>
                  </div>

                  <button className="text-button" onClick={startNewChat}>
                    ＋ Cuộc trò chuyện mới
                  </button>
                </div>

                <div className="chat-messages">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`message-row ${
                        message.role === "user" ? "user-row" : ""
                      }`}
                    >
                      {message.role === "ai" && (
                        <div className="message-avatar">✳</div>
                      )}

                      <div className={`message-bubble ${message.role}`}>
                        {message.text}
                      </div>

                      {message.role === "user" && (
                        <div className="message-avatar user-message-avatar">
                          MP
                        </div>
                      )}
                    </div>
                  ))}

                  {sendingMessage && (
                    <div className="message-row">
                      <div className="message-avatar">✳</div>
                      <div className="message-bubble ai">
                        HelpMate AI đang tìm hướng hỗ trợ...
                      </div>
                    </div>
                  )}

                  <div ref={chatEndRef} />
                </div>

                <div className="chat-prompts">
                  <button
                    disabled={sendingMessage}
                    onClick={() =>
                      void sendMessage("Máy tính không kết nối được Wi-Fi")
                    }
                  >
                    ⌁ Lỗi Wi-Fi
                  </button>

                  <button
                    disabled={sendingMessage}
                    onClick={() =>
                      void sendMessage("Tôi quên mật khẩu tài khoản")
                    }
                  >
                    ♙ Tài khoản
                  </button>

                  <button
                    onClick={() => setShowNewTicket(true)}
                  >
                    ＋ Tạo ticket
                  </button>
                </div>

                <form
                  className="chat-composer"
                  onSubmit={(event) => {
                    event.preventDefault();
                    void sendMessage();
                  }}
                >
                  <input
                    value={chatInput}
                    onChange={(event) => setChatInput(event.target.value)}
                    placeholder="Mô tả vấn đề bạn đang gặp..."
                    disabled={sendingMessage}
                    maxLength={5000}
                  />

                  <button
                    className="send-button"
                    type="submit"
                    aria-label="Gửi tin nhắn"
                    disabled={sendingMessage || !chatInput.trim()}
                  >
                    ↑
                  </button>
                </form>

                <p className="chat-disclaimer">
                  AI có thể đưa ra gợi ý chưa chính xác. Không chia sẻ mật khẩu
                  hoặc thông tin nhạy cảm.
                </p>
              </section>
            </>
          )}

          {page === "knowledge" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">TỰ TÌM HƯỚNG DẪN</div>
                  <h1>Kho kiến thức</h1>
                  <p>
                    Hướng dẫn thực tế giúp bạn tự xử lý các sự cố CNTT phổ biến.
                  </p>
                </div>
              </div>

              <div className="knowledge-hero">
                <div>
                  <span className="online-label">✦ THƯ VIỆN HƯỚNG DẪN</span>
                  <h2>Tìm câu trả lời, nhanh hơn.</h2>
                  <p>
                    Khám phá hướng dẫn và giải pháp từ đội ngũ IT.
                  </p>

                  <div className="hero-search">
                    <span>⌕</span>
                    <input
                      value={knowledgeQuery}
                      onChange={(event) => setKnowledgeQuery(event.target.value)}
                      placeholder="Tìm theo sự cố, tài khoản, Wi-Fi..."
                    />
                  </div>
                </div>

                <div className="hero-art">
                  ✳<span>⌁</span><i>✦</i>
                </div>
              </div>

              <div className="section-title">
                <h2>Danh mục hướng dẫn</h2>
                <span>{knowledgeCards.filter(({ key }) => matchesKnowledgeSearch(key, knowledgeQuery)).length} hướng dẫn</span>
              </div>

              <div className="knowledge-grid large-knowledge">
                {knowledgeCards.filter(({ key }) => matchesKnowledgeSearch(key, knowledgeQuery)).map(({ key, icon, color, description }) => {
                  const guide = guides[key];
                  return <KnowledgeCard key={key} icon={icon} category={guide.category} title={guide.title} desc={description} color={color} onClick={() => setSelectedGuide(guide)} />;
                })}
                {knowledgeCards.every(({ key }) => !matchesKnowledgeSearch(key, knowledgeQuery)) && <div className="knowledge-empty"><span>⌕</span><strong>Chưa tìm thấy hướng dẫn phù hợp</strong><p>Thử tìm với từ khóa khác như Wi-Fi, tài khoản hoặc phần mềm.</p></div>}
              </div>
            </>
          )}

          <footer className="footer">
            <span>© 2026 HelpMate AI · Trung tâm hỗ trợ CNTT</span>
            <span>
              Được thiết kế để hỗ trợ bạn tốt hơn <b>✳</b>
            </span>
          </footer>
        </div>
      </section>

      {selectedGuide && (
        <div className="modal-backdrop" onClick={() => setSelectedGuide(null)}>
          <article
            className="ticket-modal guide-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guide-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button type="button" className="modal-close" aria-label="Đóng hướng dẫn" onClick={() => setSelectedGuide(null)}>×</button>
            <div className="modal-icon">▧</div>
            <span className="guide-category">{selectedGuide.category}</span>
            <h2 id="guide-title">{selectedGuide.title}</h2>
            <p>{selectedGuide.intro}</p>
            <ol className="guide-steps">
              {selectedGuide.steps.map((step) => (
                <li key={step.title}>
                  <strong>{step.title}</strong>
                  <p>{step.body}</p>
                </li>
              ))}
            </ol>
            <div className="guide-escalation"><strong>Khi nào cần báo IT</strong><p>{selectedGuide.escalation}</p></div>
            <div className="modal-actions">
              <button type="button" className="secondary-button" onClick={() => setSelectedGuide(null)}>Đóng</button>
              <button type="button" className="primary-button" onClick={() => { setSelectedGuide(null); setShowNewTicket(true); }}>Tạo ticket hỗ trợ →</button>
            </div>
          </article>
        </div>
      )}

      {/* Modal tạo ticket */}
      {showNewTicket && (
        <div
          className="modal-backdrop"
          onClick={() => {
            if (!creatingTicket) setShowNewTicket(false);
          }}
        >
          <form
            className="ticket-modal"
            onClick={(event) => event.stopPropagation()}
            onSubmit={(event) => {
              event.preventDefault();
              void createTicket();
            }}
          >
            <button
              type="button"
              className="modal-close"
              aria-label="Đóng"
              disabled={creatingTicket}
              onClick={() => setShowNewTicket(false)}
            >
              ×
            </button>

            <div className="modal-icon">＋</div>
            <h2>Tạo ticket hỗ trợ</h2>
            <p>Mô tả vấn đề để đội IT có thể hỗ trợ bạn.</p>

            <label>
              Tiêu đề sự cố <span>*</span>
              <input
                required
                maxLength={200}
                value={newTitle}
                onChange={(event) => setNewTitle(event.target.value)}
                placeholder="Ví dụ: Không thể kết nối Wi-Fi"
              />
            </label>

            <label>
              Mô tả chi tiết <span>*</span>
              <textarea
                required
                maxLength={10000}
                value={newDescription}
                onChange={(event) => setNewDescription(event.target.value)}
                placeholder="Bạn đã thử những cách nào? Lỗi xuất hiện từ khi nào?"
                rows={4}
              />
            </label>

            <div className="modal-note">
              ✦ Backend có thể dùng Ollama để tự phân loại sự cố, đánh giá
              ưu tiên và tạo đề xuất xử lý. Kết quả được lưu vào MongoDB.
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                disabled={creatingTicket}
                onClick={() => setShowNewTicket(false)}
              >
                Hủy
              </button>

              <button
                type="submit"
                className="primary-button"
                disabled={creatingTicket}
              >
                {creatingTicket ? "Đang phân tích và tạo..." : "Tạo ticket →"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Modal chi tiết ticket */}
      {selectedTicket && (
        <div
          className="modal-backdrop ticket-detail-backdrop"
          onClick={() => setSelectedTicket(null)}
        >
          <section
            className="ticket-modal ticket-detail-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="ticket-detail-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              type="button"
              className="modal-close"
              aria-label="Đóng chi tiết ticket"
              onClick={() => setSelectedTicket(null)}
            >
              ×
            </button>

            <div className="modal-icon">▤</div>

            <span className="knowledge-category">
              CHI TIẾT YÊU CẦU HỖ TRỢ
            </span>

            <h2 id="ticket-detail-title">{selectedTicket.title}</h2>

            <p className="ticket-detail-id">
              Mã ticket: <strong>{selectedTicket.id}</strong>
            </p>

            <div className="ticket-detail-grid">
              <div className="ticket-detail-item">
                <span>Danh mục</span>
                <strong>{categoryLabels[selectedTicket.category] || selectedTicket.category}</strong>
              </div>

              <div className="ticket-detail-item">
                <span>Đội phụ trách</span>
                <strong>{selectedTicket.owner}</strong>
              </div>

              <div className="ticket-detail-item">
                <span>Mức độ ưu tiên</span>
                <Priority priority={selectedTicket.priority} />
              </div>

              <div className="ticket-detail-item">
                <span>Ngày tạo</span>
                <strong>{selectedTicket.date}</strong>
              </div>
              <div className="ticket-detail-item">
                <span>Cập nhật gần nhất</span>
                <strong>{selectedTicket.updatedDate || selectedTicket.date}</strong>
              </div>
            </div>

            <div className="ticket-detail-section">
              <label htmlFor="detail-ticket-status">
                Trạng thái ticket
              </label>

              {authUser.role === "admin" ? <select
                id="detail-ticket-status"
                className="status-select ticket-detail-status"
                value={selectedTicket.status}
                disabled={updatingTicketId === selectedTicket.id}
                onChange={(event) => {
                  void updateTicketStatus(
                    selectedTicket.id,
                    event.target.value as TicketStatus
                  );
                }}
              >
                <option value="Open">Đang mở</option>
                <option value="In Progress">Đang xử lý</option>
                <option value="Resolved">Đã giải quyết</option>
              </select> : <Status status={selectedTicket.status} />}
            </div>

            <div className="ticket-detail-section">
              <h3>Mô tả sự cố</h3>
              <p className="ticket-detail-description">
                {selectedTicket.description ||
                  "Ticket chưa có mô tả chi tiết trong dữ liệu API."}
              </p>
            </div>

            <div className="ticket-detail-section">
              <h3>✳ Lý do phân loại của AI</h3>
              <p className="ticket-detail-description">
                {selectedTicket.aiReason ||
                  "Chưa có phân tích AI. Hãy kiểm tra API tạo ticket và cấu hình Ollama."}
              </p>
            </div>

            <div className="ticket-detail-section ai-suggestion-box">
              <h3>✦ Đề xuất xử lý từ AI</h3>
              <p className="ticket-detail-description">
                {selectedTicket.aiSuggestion ||
                  "Chưa có đề xuất xử lý. Hãy kiểm tra backend có gọi Ollama và lưu aiSuggestion vào MongoDB hay không."}
              </p>
            </div>

            <div className="modal-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={() => setSelectedTicket(null)}
              >
                Đóng
              </button>
            </div>
          </section>
        </div>
      )}

      {toast && (
        <div className="toast" role="status">
          ✓ {toast}
        </div>
      )}
    </main>
  );
}

function StatCard({
  label,
  value,
  change,
  icon,
  tone,
  note,
}: {
  label: string;
  value: string;
  change: string;
  icon: string;
  tone: string;
  note: string;
}) {
  return (
    <div className="stat-card">
      <div className={`stat-icon ${tone}`}>{icon}</div>
      <span className="stat-label">{label}</span>
      <strong className="stat-value">{value}</strong>
      <div className="stat-foot">
        <span className={tone === "orange" ? "orange-text" : "green-text"}>
          {change}
        </span>
        <span>{note}</span>
      </div>
    </div>
  );
}

function Priority({ priority }: { priority: PriorityLevel }) {
  const labels: Record<PriorityLevel, string> = {
    Critical: "Nghiêm trọng",
    High: "Cao",
    Medium: "Trung bình",
    Low: "Thấp",
  };

  return (
    <span className={`priority priority-${priority.toLowerCase()}`}>
      <i />
      {labels[priority]}
    </span>
  );
}

function Status({ status }: { status: TicketStatus }) {
  const labels: Record<TicketStatus, string> = {
    Open: "Đang mở",
    "In Progress": "Đang xử lý",
    Resolved: "Đã giải quyết",
  };

  return (
    <span
      className={`status status-${status.toLowerCase().replace(" ", "-")}`}
    >
      <i />
      {labels[status]}
    </span>
  );
}

function KnowledgeCard({
  icon,
  category,
  title,
  desc,
  color,
  onClick,
}: {
  icon: string;
  category: string;
  title: string;
  desc: string;
  color: string;
  onClick: () => void;
}) {
  return (
    <button className="knowledge-card" onClick={onClick}>
      <div className={`knowledge-icon ${color}`}>{icon}</div>
      <span className="knowledge-category">{category}</span>
      <h3>{title}</h3>
      <p>{desc}</p>
      <span className="knowledge-link">
        Đọc hướng dẫn <b>↗</b>
      </span>
    </button>
  );
}


