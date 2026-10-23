import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HelpMate | Hỗ trợ CNTT",
  description: "Không gian hỗ trợ CNTT, quản lý yêu cầu và kết nối đội ngũ IT.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
