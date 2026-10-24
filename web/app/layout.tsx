import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800", "900"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "AgentVault — Autonomous BTC loan protection on Mezo",
  description:
    "An AI agent that watches your BTC-backed MUSD loan, tops up collateral, and repays debt before liquidation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="min-h-screen bg-paper font-sans text-charcoal antialiased">{children}</body>
    </html>
  );
}
