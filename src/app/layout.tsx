import type { Metadata } from "next";
import { Chakra_Petch, IBM_Plex_Sans_Thai } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import { getCurrentUser } from "@/lib/supabase/server";
import "./globals.css";

const chakraPetch = Chakra_Petch({
  weight: ["500", "600", "700"],
  subsets: ["latin", "thai"],
  variable: "--font-chakra-petch",
  display: "swap",
});

const ibmPlexSansThai = IBM_Plex_Sans_Thai({
  weight: ["400", "500", "600"],
  subsets: ["latin", "thai"],
  variable: "--font-ibm-plex-sans-thai",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "PumpDiary — สมุดบันทึกคะแนน Pump It Up",
    template: "%s | PumpDiary",
  },
  description:
    "PumpDiary คือสมุดบันทึกส่วนตัวของสายปั๊ม เก็บคะแนน เกรด และวิดีโอการเล่นไว้ในที่เดียว แล้วดูพัฒนาการของตัวเองในทุกชาร์ต",
};

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const user = await getCurrentUser();

  return (
    <html
      lang="th"
      className={`dark ${chakraPetch.variable} ${ibmPlexSansThai.variable} h-full antialiased`}
    >
      <body className="min-h-screen flex flex-col">
        <SiteHeader initialUser={user} />
        <main className="flex flex-1 flex-col">{children}</main>
        <SiteFooter />
        <Toaster theme="dark" />
      </body>
    </html>
  );
}
