import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "HARPY",
  description: "Operator HUD (local-first)",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
