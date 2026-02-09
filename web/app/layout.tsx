import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "HR Platform",
  description: "Human Resource Management System",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="th">
      <body className="bg-gray-50 min-h-screen">{children}</body>
    </html>
  );
}
