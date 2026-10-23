import { Suspense } from "react";
import { redirect } from "next/navigation";
import HelpdeskDashboard from "../components/HelpdeskDashboard";
import { getCurrentUser } from "../lib/auth";

async function Workspace() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return <HelpdeskDashboard user={user} />;
}

export default function Home() {
  return <Suspense fallback={<p role="status">Đang tải không gian làm việc…</p>}>
    <Workspace />
  </Suspense>;
}
