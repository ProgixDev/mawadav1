import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "MAWADA Admin",
  description: "Tableau de bord d’administration de l’application de mise en relation musulmane MAWADA",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fr" className="h-full antialiased">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
