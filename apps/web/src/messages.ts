import type { Locale } from "@mench/shared-types";
export const messages: Record<
  Locale,
  { title: string; subtitle: string; stage: string; language: string }
> = {
  fa: {
    title: "منچ، یک شروع تازه",
    subtitle: "بنیاد یک بازی منصفانه، برای همهٔ دستگاه‌ها",
    stage: "مرحلهٔ صفر · زیرساخت آماده می‌شود",
    language: "English",
  },
  en: {
    title: "Mench, a fresh start",
    subtitle: "A fair game foundation, across every device",
    stage: "Milestone zero · Building the foundation",
    language: "فارسی",
  },
};
