import type { Metadata } from "next";
import { IBM_Plex_Mono, Orbitron } from "next/font/google";
import "./globals.css";

const orbitron = Orbitron({
  variable: "--font-harpy-display",
  subsets: ["latin"],
  weight: ["500", "700", "900"],
});

const plexMono = IBM_Plex_Mono({
  variable: "--font-harpy-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "HARPY Tactical HUD",
  description: "Compliance-first geospatial intelligence fusion platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${orbitron.variable} ${plexMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
