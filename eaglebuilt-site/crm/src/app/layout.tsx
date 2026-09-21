import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "@/components/Providers";

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "EagleBuilt CRM",
  description: "Lead pipeline for EagleBuilt AI outdoor kitchens",
  /* Private back office — never in search results. Pairs with app/robots.ts:
     that file stops crawling, this stops listing. Both are needed, because a
     URL discovered elsewhere can be listed without ever being crawled. */
  robots: { index: false, follow: false, nocache: true },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${inter.className} antialiased`}>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
