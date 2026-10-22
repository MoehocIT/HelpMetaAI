"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
};

type ChatMessage = {
  id: string;
  role: MessageRole;
  text: string;
};

type Page = "overview" | "chat" | "tickets" | "knowledge";

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
];

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
  const [page, setPage] = useState<Page>("overview");

  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [ticketsLoading, setTicketsLoading] = useState(true);
  const [apiError, setApiError] = useState("");

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("All");

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
  const [updatingTicketId, setUpdatingTicketId] = useState("");

  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const chatEndRef = useRef<HTMLDivElement | null>(null);

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

  const loadTickets = useCallback(async () => {
    setTicketsLoading(true);

    try {
      const response = await fetch("/api/tickets", {
        method: "GET",
        cache: "no-store",
      });

      const result = await readApiResponse(response);

      const data: ApiTicket[] = Array.isArray(result.data)
        ? (result.data as ApiTicket[])
        : [];

      const mappedTickets = data
        .filter((ticket) => typeof ticket.ticketId === "string")
        .map(mapApiTicket);

      setTickets(mappedTickets);
      setApiError("");

      setSelectedTicket((current) => {
        if (!current) return null;

        return (
          mappedTickets.find((ticket) => ticket.id === current.id) ?? current
        );
      });
    } catch (error) {
      const message = getErrorMessage(
        error,
        "Không thể kết nối API ticket."
      );

      setApiError(message);
    } finally {
      setTicketsLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadTickets();
  }, [loadTickets]);

  const visibleTickets = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return tickets.filter((ticket) => {
      const searchText = [
        ticket.id,
        ticket.title,
        ticket.owner,
        ticket.category,
        ticket.description || "",
      ]
        .join(" ")
        .toLowerCase();

      const matchesQuery = searchText.includes(normalizedQuery);

      const matchesFilter =
        filter === "All" || ticket.status === filter;

      return matchesQuery && matchesFilter;
    });
  }, [tickets, query, filter]);

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

      await loadTickets();

      setPage("tickets");
      setFilter("All");
      setQuery("");

      if (created?.ticketId) {
        notify(
          `Đã tạo ${created.ticketId}. ` +
            `Phân loại: ${created.category || "Other"} · ` +
            `Ưu tiên: ${created.priority || "Medium"}.`
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

    setUpdatingTicketId(ticketId);

    // Cập nhật giao diện trước để người dùng thấy phản hồi ngay.
    setTickets((old) =>
      old.map((ticket) =>
        ticket.id === ticketId ? { ...ticket, status } : ticket
      )
    );

    setSelectedTicket((old) =>
      old?.id === ticketId ? { ...old, status } : old
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

  return (
    <main className="app-shell">
      <aside className="sidebar">
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
              onClick={() => setPage(item.id)}
            >
              <span className="nav-icon">{item.icon}</span>
              <span>{item.label}</span>

              {item.id === "tickets" && (
                <span className="nav-count">
                  {
                    tickets.filter(
                      (ticket) => ticket.status !== "Resolved"
                    ).length
                  }
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
            <div className="avatar">MP</div>
            <div className="user-info">
              <strong>Mai Phương</strong>
              <span>Nhân viên</span>
            </div>
            <button className="more-button" aria-label="Tùy chọn">
              ···
            </button>
          </div>
        </div>
      </aside>

      <section className="main-panel">
        <header className="topbar">
          <div className="breadcrumbs">
            <span>Workspace</span>
            <b>/</b>
            <strong>
              {navItems.find((item) => item.id === page)?.label}
            </strong>
          </div>

          <div className="top-actions">
            <span className="system-status">
              <i /> Hệ thống hoạt động
            </span>

            <button
              className="icon-button"
              aria-label="Thông báo"
              onClick={() => notify("Bạn đã xem các thông báo mới.")}
            >
              ♧<i className="notification-dot" />
            </button>

            <div className="top-avatar">MP</div>
          </div>
        </header>

        <div className="content">
          {page === "overview" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">WORKSPACE OVERVIEW</div>
                  <h1>
                    Chào buổi tối, Phương{" "}
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
                <div className="api-error">
                  {apiError}
                  <button onClick={() => void loadTickets()}>
                    Thử lại
                  </button>
                </div>
              )}

              <div className="stats-grid">
                <StatCard
                  label="Tổng ticket"
                  value={ticketsLoading ? "..." : String(tickets.length)}
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
                      : String(
                          tickets.filter(
                            (ticket) => ticket.status === "Open"
                          ).length
                        )
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
                      : String(
                          tickets.filter(
                            (ticket) => ticket.status === "In Progress"
                          ).length
                        )
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
                      : String(
                          tickets.filter(
                            (ticket) => ticket.status === "Resolved"
                          ).length
                        )
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
                      <h2>Ticket gần đây</h2>
                      <p>Theo dõi các yêu cầu hỗ trợ mới nhất</p>
                    </div>

                    <button
                      className="text-button"
                      onClick={() => setPage("tickets")}
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
                              Đang tải ticket...
                            </td>
                          </tr>
                        ) : (
                          tickets.slice(0, 4).map((ticket) => (
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

                        {!ticketsLoading && tickets.length === 0 && (
                          <tr>
                            <td colSpan={4} className="empty-state">
                              Chưa có ticket nào.
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
                        <i /> AI ASSISTANT
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
                  <div className="eyebrow">SUPPORT CENTER</div>
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
                <div className="api-error">
                  {apiError}
                  <button onClick={() => void loadTickets()}>
                    Thử tải lại
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
                    onChange={(event) => setFilter(event.target.value)}
                  >
                    <option value="All">Tất cả trạng thái</option>
                    <option value="Open">Đang mở</option>
                    <option value="In Progress">Đang xử lý</option>
                    <option value="Resolved">Đã giải quyết</option>
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
                      </tr>
                    </thead>

                    <tbody>
                      {ticketsLoading ? (
                        <tr>
                          <td colSpan={6} className="empty-state">
                            Đang tải ticket...
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

                            <td>{ticket.category}</td>

                            <td>
                              <Priority priority={ticket.priority} />
                            </td>

                            <td onClick={(event) => event.stopPropagation()}>
                              <select
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
                              </select>
                            </td>

                            <td>{ticket.owner}</td>
                            <td>{ticket.date}</td>
                          </tr>
                        ))
                      )}

                      {!ticketsLoading && visibleTickets.length === 0 && (
                        <tr>
                          <td colSpan={6} className="empty-state">
                            Không tìm thấy ticket phù hợp.
                          </td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                <div className="table-footer">
                  Hiển thị {visibleTickets.length} trên {tickets.length} ticket
                  <span>Đồng bộ API · MongoDB</span>
                </div>
              </section>
            </>
          )}

          {page === "chat" && (
            <>
              <div className="page-heading">
                <div>
                  <div className="eyebrow">AI-POWERED SUPPORT</div>
                  <h1>Trợ lý AI</h1>
                  <p>
                    Mô tả vấn đề của bạn — cùng tìm giải pháp từng bước.
                  </p>
                </div>

                <span className="system-status">
                  <i /> Trợ lý hỗ trợ
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
                        HelpMate AI đang suy nghĩ...
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
                  <div className="eyebrow">SELF-SERVICE CENTER</div>
                  <h1>Kho kiến thức</h1>
                  <p>
                    Hướng dẫn thực tế giúp bạn tự xử lý các sự cố CNTT phổ biến.
                  </p>
                </div>
              </div>

              <div className="knowledge-hero">
                <div>
                  <span className="online-label">✦ KNOWLEDGE BASE</span>
                  <h2>Tìm câu trả lời, nhanh hơn.</h2>
                  <p>
                    Khám phá hướng dẫn và giải pháp từ đội ngũ IT.
                  </p>

                  <div className="hero-search">
                    <span>⌕</span>
                    <input
                      value={query}
                      onChange={(event) => setQuery(event.target.value)}
                      placeholder="Bạn đang cần hỗ trợ điều gì?"
                    />
                  </div>
                </div>

                <div className="hero-art">
                  ✳<span>⌁</span><i>✦</i>
                </div>
              </div>

              <div className="section-title">
                <h2>Danh mục hướng dẫn</h2>
                <span>03 danh mục chính</span>
              </div>

              <div className="knowledge-grid large-knowledge">
                <KnowledgeCard
                  icon="⌁"
                  category="MẠNG & KẾT NỐI"
                  title="Khắc phục sự cố Wi-Fi"
                  desc="Kiểm tra kết nối, DNS, router và cấu hình mạng."
                  color="blue"
                  onClick={() => notify("Hướng dẫn Wi-Fi đang ở bản demo.")}
                />

                <KnowledgeCard
                  icon="♙"
                  category="TÀI KHOẢN"
                  title="Đăng nhập & mật khẩu"
                  desc="Khôi phục tài khoản và xử lý lỗi xác thực."
                  color="purple"
                  onClick={() =>
                    notify("Hướng dẫn tài khoản đang ở bản demo.")
                  }
                />

                <KnowledgeCard
                  icon="▣"
                  category="HIỆU NĂNG"
                  title="Máy tính chạy chậm"
                  desc="Kiểm tra bộ nhớ, ứng dụng nền và dung lượng."
                  color="orange"
                  onClick={() =>
                    notify("Hướng dẫn hiệu năng đang ở bản demo.")
                  }
                />

                <KnowledgeCard
                  icon="▧"
                  category="PHẦN MỀM"
                  title="Cài đặt phần mềm"
                  desc="Các bước cài đặt và xử lý lỗi ứng dụng cơ bản."
                  color="green"
                  onClick={() =>
                    notify("Hướng dẫn phần mềm đang ở bản demo.")
                  }
                />

                <KnowledgeCard
                  icon="▤"
                  category="PHẦN CỨNG"
                  title="Thiết bị ngoại vi"
                  desc="Xử lý sự cố máy in, bàn phím và màn hình."
                  color="orange"
                  onClick={() =>
                    notify("Hướng dẫn phần cứng đang ở bản demo.")
                  }
                />

                <KnowledgeCard
                  icon="◇"
                  category="BẢO MẬT"
                  title="An toàn tài khoản"
                  desc="Nhận biết dấu hiệu đáng ngờ và báo cáo sự cố."
                  color="purple"
                  onClick={() =>
                    notify("Hướng dẫn bảo mật đang ở bản demo.")
                  }
                />
              </div>
            </>
          )}

          <footer className="footer">
            <span>© 2026 HelpMate AI · IT Support Workspace</span>
            <span>
              Được thiết kế để hỗ trợ bạn tốt hơn <b>✳</b>
            </span>
          </footer>
        </div>
      </section>

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
                <strong>{selectedTicket.category}</strong>
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
            </div>

            <div className="ticket-detail-section">
              <label htmlFor="detail-ticket-status">
                Trạng thái ticket
              </label>

              <select
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
              </select>
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