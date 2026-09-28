import { cookies } from "next/headers";
import { getRequestConfig } from "next-intl/server";

import { isLocale } from "@/i18n/config";

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("NEXT_LOCALE")?.value;
  const locale = isLocale(cookieLocale) ? cookieLocale : "en";

  return {
    locale,
    messages: {
      common: (await import(`../../messages/${locale}/common.json`)).default,
      home: (await import(`../../messages/${locale}/home.json`)).default,
      auth: (await import(`../../messages/${locale}/auth.json`)).default,
      dashboard: (await import(`../../messages/${locale}/dashboard.json`)).default,
      songs: (await import(`../../messages/${locale}/songs.json`)).default,
      scores: (await import(`../../messages/${locale}/scores.json`)).default,
    },
  };
});
