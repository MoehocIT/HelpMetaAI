"use client";

import { useState } from "react";
import styles from "./AuthForm.module.css";

export default function LogoutButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  async function logout() {
    setPending(true);
    setError("");
    try {
      const response = await fetch("/api/auth/logout", { method: "POST" });
      if (!response.ok) throw new Error("Chưa thể đăng xuất. Vui lòng thử lại.");
      // Clear the rendered workspace and client navigation cache on logout.
      window.location.replace("/login");
    } catch {
      setError("Chưa thể đăng xuất. Vui lòng thử lại.");
      setPending(false);
    }
  }

  return <>
    <button className={styles.logout} type="button" onClick={logout} disabled={pending} title="Đăng xuất" aria-label="Đăng xuất">↪</button>
    {error && <span role="alert">{error}</span>}
  </>;
}
