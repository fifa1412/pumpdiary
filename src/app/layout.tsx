import type { Metadata } from "next";
import { getLocale, getMessages, getTranslations } from "next-intl/server";
import { NextIntlClientProvider } from "next-intl";
import { Barlow, Barlow_Condensed, Noto_Sans_Thai } from "next/font/google";
import { SiteFooter } from "@/components/site-footer";
import { SiteHeader } from "@/components/site-header";
import { Toaster } from "@/components/ui/sonner";
import { getCurrentUser } from "@/lib/supabase/server";
import "./globals.css";

const barlowCondensed = Barlow_Condensed({
  weight: ["500", "600", "700", "800"],
  subsets: ["latin"],
  variable: "--font-barlow-condensed",
  display: "swap",
});

const notoSansThai = Noto_Sans_Thai({
  weight: ["400", "500", "600"],
  subsets: ["latin", "thai"],
  variable: "--font-noto-sans-thai",
  display: "swap",
});

const barlow = Barlow({
  weight: ["500", "600"],
  subsets: ["latin"],
  variable: "--font-barlow",
  display: "swap",
});

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("common");

  return {
    title: {
      default: t("metadata.titleDefault"),
      template: "%s | PumpDiary",
    },
    description: t("metadata.description"),
  };
}

export default async function RootLayout({ children }: LayoutProps<"/">) {
  const [user, locale, messages] = await Promise.all([
    getCurrentUser(),
    getLocale(),
    getMessages(),
  ]);

  return (
    <html
      lang={locale}
      className={`dark ${barlowCondensed.variable} ${notoSansThai.variable} ${barlow.variable} h-full antialiased`}
    >
      <body className="min-h-screen flex flex-col">
        <NextIntlClientProvider messages={messages}>
          <SiteHeader initialUser={user} />
          <main className="flex flex-1 flex-col">{children}</main>
          <SiteFooter />
          <Toaster theme="dark" />
        </NextIntlClientProvider>
      </body>
    </html>
  );
}
