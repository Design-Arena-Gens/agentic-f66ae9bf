import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ALI BG REMOVER",
  description: "AI-powered background remover for photos."
};

export default function RootLayout({
  children
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
