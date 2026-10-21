import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "AgentVault — Autonomous BTC loan protection on Mezo",
  description:
    "An AI agent that watches your BTC-backed MUSD loan, tops up collateral, and repays debt before liquidation.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans antialiased">{children}</body>
    </html>
  );
}
