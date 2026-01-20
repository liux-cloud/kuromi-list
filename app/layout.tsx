import type { Metadata } from "next";
import { ZCOOL_KuaiLe } from "next/font/google";
import "./globals.css";

const zcool = ZCOOL_KuaiLe({
  subsets: ["latin"],
  weight: ["400"],
  variable: "--font-kuromi",
});

export const metadata: Metadata = {
  title: "Kuromi List",
  description: "A realtime, shareable Kuromi-themed shopping list.",
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <head>
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black" />
        <meta name="apple-mobile-web-app-title" content="库洛米清单" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        <link rel="manifest" href="/manifest.json" />
      </head>
      <body className={`${zcool.variable} antialiased`}>{children}</body>
    </html>
  );
}
