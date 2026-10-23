"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useId, useState, type FormEvent } from "react";
import styles from "./AuthForm.module.css";

export default function AuthForm({ mode }: { mode: "login" | "register" }) {
  const isRegister = mode === "register";
  const formId = useId();
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    setError("");
    const fields = new FormData(event.currentTarget);
    const password = String(fields.get("password") ?? "");
    const confirmPassword = String(fields.get("confirmPassword") ?? "");
    if (isRegister && password !== confirmPassword) {
      setError("Mật khẩu xác nhận không khớp.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: fields.get("name"), email: fields.get("email"), password, confirmPassword,
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Không thể xử lý yêu cầu. Vui lòng thử lại.");
      router.replace("/");
      router.refresh();
    } catch (error) {
      setError(error instanceof Error ? error.message : "Không thể kết nối máy chủ. Vui lòng thử lại.");
      setPending(false);
    }
  }

  return (
    <main className={styles.shell} lang="vi">
      <aside className={styles.intro}>
        <Link href="/login" className={styles.brand} aria-label="HelpMate — Đăng nhập">
          <span className={styles.mark} aria-hidden="true">✳</span>
          <span>help<strong>mate</strong><small>AI IT HELPDESK</small></span>
        </Link>
        <div className={styles.introContent}>
          <span className={styles.badge}>KHÔNG GIAN HỖ TRỢ CNTT</span>
          <h2>Mọi sự cố,<br />đều có người đồng hành.</h2>
          <p>Kết nối với đội ngũ IT, theo dõi yêu cầu và tìm giải pháp cho công việc mỗi ngày.</p>
          <div className={styles.features}>
            <div><span aria-hidden="true">▤</span><span><strong>Yêu cầu được theo dõi</strong><small>Cập nhật tiến độ hỗ trợ tại một nơi.</small></span></div>
            <div><span aria-hidden="true">✦</span><span><strong>Kiến thức luôn sẵn sàng</strong><small>Tìm hướng dẫn cho những sự cố thường gặp.</small></span></div>
            <div><span aria-hidden="true">◎</span><span><strong>Kết nối đội ngũ IT</strong><small>Gửi đúng thông tin để được hỗ trợ nhanh hơn.</small></span></div>
          </div>
        </div>
        <p className={styles.introFooter}>HelpMate · Người bạn hỗ trợ công việc của bạn</p>
      </aside>

      <section className={styles.formPanel} aria-labelledby="auth-title">
        <div className={styles.card}>
          <span className={styles.eyebrow}>{isRegister ? "BẮT ĐẦU CÙNG HELPMATE" : "CHÀO MỪNG BẠN TRỞ LẠI"}</span>
          <h1 id="auth-title">{isRegister ? "Tạo tài khoản" : "Đăng nhập"}</h1>
          <p className={styles.description}>
            {isRegister ? "Đăng ký để gửi yêu cầu và nhận hỗ trợ từ đội ngũ IT." : "Vào không gian làm việc để tiếp tục nhận hỗ trợ."}
          </p>

          <form onSubmit={submit} aria-busy={pending}>
            {error && <div className={styles.error} role="alert">{error}</div>}
            <fieldset disabled={pending} className={styles.fields}>
              {isRegister && <label htmlFor={`${formId}-name`}>Họ và tên
                <input id={`${formId}-name`} name="name" autoComplete="name" placeholder="Nguyễn Minh Anh" required minLength={2} maxLength={80} />
              </label>}
              <label htmlFor={`${formId}-email`}>Email
                <input id={`${formId}-email`} name="email" type="email" autoComplete="email" placeholder="ban@congty.vn" required maxLength={254} />
              </label>
              <label htmlFor={`${formId}-password`}>Mật khẩu</label>
              <div className={styles.passwordField}>
                <input id={`${formId}-password`} name="password" type={showPassword ? "text" : "password"} autoComplete={isRegister ? "new-password" : "current-password"} placeholder="Nhập mật khẩu của bạn" required minLength={8} maxLength={128} aria-describedby={isRegister ? `${formId}-password-hint` : undefined} />
                <button type="button" onClick={() => setShowPassword(!showPassword)} aria-label={showPassword ? "Ẩn mật khẩu" : "Hiện mật khẩu"} aria-pressed={showPassword}>{showPassword ? "Ẩn" : "Hiện"}</button>
              </div>
              {isRegister && <>
                <p id={`${formId}-password-hint`} className={styles.hint}>Sử dụng từ 8 đến 128 ký tự cho mật khẩu của bạn.</p>
                <label htmlFor={`${formId}-confirmPassword`}>Xác nhận mật khẩu
                  <input id={`${formId}-confirmPassword`} name="confirmPassword" type={showPassword ? "text" : "password"} autoComplete="new-password" placeholder="Nhập lại mật khẩu" required minLength={8} maxLength={128} />
                </label>
              </>}
              <button type="submit" className={styles.submit}>
                {pending ? "Đang xử lý…" : isRegister ? "Tạo tài khoản" : "Đăng nhập"}
                {!pending && <span aria-hidden="true">→</span>}
              </button>
            </fieldset>
          </form>

          <p className={styles.switchMode}>
            {isRegister ? "Bạn đã có tài khoản? " : "Bạn chưa có tài khoản? "}
            <Link href={isRegister ? "/login" : "/register"}>{isRegister ? "Đăng nhập" : "Đăng ký ngay"}</Link>
          </p>
          <p className={styles.footer}>Không gian hỗ trợ CNTT dành cho công việc của bạn.</p>
        </div>
      </section>
    </main>
  );
}
