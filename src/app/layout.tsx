import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { TopBar } from "@/components/layout/top-bar";
import { TooltipProvider } from "@/components/ui/tooltip";
import { APP_NAME } from "@/config/nav";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: APP_NAME,
  description: "Analyze an investment portfolio: allocation, sector tilts and holdings.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full`}>
      <body className="min-h-full">
        <TooltipProvider>
          <TopBar />
          <main className="min-h-screen px-4 pb-8 pt-15 md:px-6">
            <div className="mx-auto max-w-[1400px]">{children}</div>
          </main>
        </TooltipProvider>
      </body>
    </html>
  );
}
