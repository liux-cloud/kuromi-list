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
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${zcool.variable} antialiased`}>{children}</body>
    </html>
  );
}
