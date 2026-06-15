import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAWADA Admin",
  description: "Admin dashboard for the MAWADA Muslim matchmaking app",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
