import type { Metadata } from "next";
import { IBM_Plex_Sans, JetBrains_Mono, Sora } from "next/font/google";
import "./globals.css";

const harpyDisplay = Sora({
  variable: "--font-harpy-display",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const harpyBody = IBM_Plex_Sans({
  variable: "--font-harpy-body",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
});

const harpyMono = JetBrains_Mono({
  variable: "--font-harpy-mono",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});

export const metadata: Metadata = {
  title: "HARPY Fusion Console",
  description: "Compliance-first geospatial intelligence fusion platform",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${harpyDisplay.variable} ${harpyBody.variable} ${harpyMono.variable}`}>
        {children}
      </body>
    </html>
  );
}
