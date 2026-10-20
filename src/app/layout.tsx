import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TopBar } from "@/components/layout/top-bar";
import { PortfolioGate } from "@/components/providers/portfolio-gate";
import { StorageGuard } from "@/components/providers/storage-guard";
import { DataAutoFill } from "@/components/shared/data-auto-fill";
import { PriceAutoRefresh } from "@/components/shared/price-auto-refresh";
import { TooltipProvider } from "@/components/ui/tooltip";
import { APP_NAME } from "@/config/nav";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Analyze an investment portfolio: allocation, sector and country exposure (looking through ETFs and bond funds) and risk.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full">
        <TooltipProvider>
          <TopBar />
          <PriceAutoRefresh />
          <DataAutoFill />
          <main className="min-h-screen px-4 pb-8 pt-24 md:px-6">
            <div className="mx-auto max-w-[1400px]">
              <StorageGuard />
              <PortfolioGate>{children}</PortfolioGate>
            </div>
          </main>
        </TooltipProvider>
      </body>
    </html>
  );
}
