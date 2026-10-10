# تحویل پروژهٔ منچ به Claude Code — ۲۰۲۶/۱۰/۱۰

فایل `CLAUDE_CODE_PROMPT_FA.md` در ریشهٔ بسته را به Claude Code بده. آن فایل شرح کامل ادامهٔ کار، وضعیت واقعی پروژه، درخواست‌های اصلاحی و **متن کامل پرامپت اولیه** را یکجا دارد. سورس در پوشهٔ `mench/` است. اگر Claude Code در workspace سایت فعلی کار می‌کند، این پوشه را به عنوان سورس بازی معرفی کن و از او بخواه قبل از ادغام، پروژه و دستورالعمل‌های همان سایت را بررسی کند.

محتویات بسته:

- `mench/`: همهٔ فایل‌های tracked سورس، shared packages، assets/فونت و مجوز، tests، migrations، configs، CI و مستندات؛ dependencies با package-lock قفل شده‌اند.
- `CLAUDE_CODE_PROMPT_FA.md`: پرامپت آمادهٔ انتقال با ضمیمهٔ کل master prompt.
- `ORIGINAL_MASTER_PROMPT.txt`: فایل ارسالی اولیهٔ کاربر، بدون تغییر بایت‌ها.
- `history/mench-history.bundle`: تاریخچهٔ کامل شاخهٔ محلی؛ برای ادامه با Git می‌توان آن را clone کرد.
- `reference/`: فایل وب آفلاینِ فعلی و پیش‌نمایش‌های پالت کلاسیک. این HTML نسخهٔ آنلاین سایت نیست.
- `MANIFEST.json`: commit سورس، اندازه و SHA256 فایل‌های بسته.

برای ادامه با تاریخچهٔ Git، از ریشهٔ استخراج‌شده:

```sh
git clone history/mench-history.bundle mench-with-history
cd mench-with-history
npm ci
```

یا مستقیماً در `mench/` از سورس استفاده کن. ZIP پوشهٔ `.git` ندارد؛ bundle شامل تاریخچه است. تاریخچهٔ GitHub/main ممکن است از این snapshot عقب باشد؛ تغییرات این محیط push نشده‌اند.

Node مطابق `.nvmrc` (24.19.0)، npm11.9.0، PostgreSQL و برای native ابزارهای platform لازم‌اند. ابزارهای شخصی این cloud، node_modules، cache/build treeها، secretها و دادهٔ دیتابیس در بسته نیستند. generated Android/iOS باید با Expo prebuild ساخته شوند؛ دستورها در پرامپت و docs/MOBILE.md آمده‌اند. APK موجود development/debug-signed است و از لینک قبلی دانلود می‌شود؛ برای سایت، سورس کامل وب/API را منتشر کن، نه HTML آفلاین.

اولویت بعدی: آنلاین قابل استفاده برای دو دوست روی دو دستگاه واقعی در سایت موجود، لینک دعوت صحیح، backend مشترک HTTPS/WSS، حفظ رنگ‌های قرمز/سبز/زرد/آبی و فونت صمیم، تکمیل popup نتیجه در native و تست کامل. در این محیط هیچ سرور/دامنه عمومی منتشر نشده است.
