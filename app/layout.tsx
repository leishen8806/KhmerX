import type { Metadata } from "next";
import "./globals.css";
import {TestFlowMenu} from "@/components/test-flow-menu";

export const metadata: Metadata = {
  title: "KhmerX · PayEase",
  description: "三端协作的测试贷款业务闭环",
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased"><TestFlowMenu/>{children}</body>
    </html>
  );
}
