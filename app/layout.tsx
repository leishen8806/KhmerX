import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "KhmerX · PayEase",
  description: "三端协作的测试贷款业务闭环",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/brand/khmerx-icon-v2.png",
    shortcut: "/brand/khmerx-icon-v2.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
