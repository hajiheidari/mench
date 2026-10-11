# انتشار منچ: وب، اندروید و آیفون

این راهنما برای صاحب پروژه است. هر جا «سکرت» گفته شده یعنی:
GitHub → مخزن `hajiheidari/mench` → Settings → Secrets and variables → Actions → New repository secret.

## نشانی‌ها

| نشانی                                           | چیست                                                        |
| ----------------------------------------------- | ----------------------------------------------------------- |
| https://mench.espadna.com                       | خود بازی (تمرین، بازی آنلاین، دعوت)                         |
| https://mench.espadna.com/join/CODE             | لینک دعوت؛ دوست شما بدون نصب وارد اتاق می‌شود               |
| https://espadna.com/mench-app/ (و `fa/`، `ar/`) | صفحهٔ معرفی                                                 |
| https://espadna.com/mench-app/privacy/          | سیاست حریم خصوصی (برای بازار، گوگل‌پلی و اپ‌استور لازم است) |
| https://mench.espadna.com/healthz               | بررسی سلامت سرور                                            |

همه روی همان حساب Cloudflare سایت espadna.com اجرا می‌شوند؛ مثل عددی و تیارو، یک Worker به نام `mench` (تنظیمات: `apps/edge/wrangler.jsonc`). اتاق‌های آنلاین در یک Durable Object نگهداری می‌شوند. سرور یا دیتابیس جداگانه و هزینهٔ جدید لازم نیست (پلن رایگان Workers).

## ۱) انتشار وب (یک بار تنظیم)

1. دو سکرت `CLOUDFLARE_API_TOKEN` و `CLOUDFLARE_ACCOUNT_ID` را با **همان مقدارهای مخزن espadna-site** (یا math-game) به این مخزن اضافه کنید.
2. شاخهٔ `claude/manch-game-web-mobile-0k6e82` را در `main` ادغام کنید (یا Pull Request بسازید و merge کنید).
3. با هر push روی `main`، workflow **site** بازی و صفحه‌های معرفی را می‌سازد، تست‌ها را اجرا می‌کند و منتشر می‌کند. بدون ادغام هم می‌شود: Actions → site → Run workflow.
4. بعد از اولین انتشار، کارت منچ را به صفحهٔ اصلی espadna.com اضافه کنید (تغییرش در شاخهٔ `claude/mench-card` مخزن espadna-site آماده است؛ آن را در `main` ادغام کنید).

آزمون بعد از انتشار: در گوشی خودتان https://mench.espadna.com را باز کنید ← «بازی آنلاین» ← «ساخت اتاق» ← «ارسال دعوت» را برای دوستتان بفرستید. دوستتان لینک را باز می‌کند و «ورود به اتاق» را می‌زند؛ شما «شروع بازی» را می‌زنید. وسط بازی اینترنت یکی را قطع و وصل کنید؛ باید سر جای خودش برگردد.

### به‌روزرسانی، بازگشت و پشتیبان

- به‌روزرسانی: هر push روی `main`. هیچ‌وقت `wrangler deploy` را دستی اجرا نکنید.
- بازگشت به نسخهٔ قبل: Cloudflare Dashboard → Workers & Pages → mench → Deployments → Rollback؛ سپس commit خراب را در Git هم revert کنید.
- انتشار، سرور اتاق‌ها را دوباره راه می‌اندازد؛ بازیکنان قطع و خودکار دوباره وصل می‌شوند و بازی از حافظهٔ ذخیره‌شده ادامه پیدا می‌کند.
- پشتیبان: داده‌ها فقط اتاق‌های موقت‌اند (حداکثر ۲۴ ساعت)؛ حساب کاربری یا دادهٔ ماندگاری وجود ندارد که نیاز به پشتیبان داشته باشد.
- مصرف: Cloudflare → Workers → mench → Metrics. اگر روزی به سقف پلن رایگان نزدیک شد، خبر دهید (طرح تقسیم اتاق‌ها در `docs/adr/0002-edge-deployment.md`).
- آینهٔ ایران (espadna.ir) فقط فایل‌های ثابت را کپی می‌کند؛ بازی آنلاین روی آن کار نمی‌کند.

## ۲) اندروید (بازار و گوگل‌پلی)

فعلاً دستی: Actions → android → Run workflow. فایل APK (برای بازار یا نصب مستقیم) و AAB (برای گوگل‌پلی) ساخته و در Releases با نام `android-test-build` گذاشته می‌شود. این نسخه‌ها به mench.espadna.com وصل‌اند. شناسهٔ برنامه: `com.espadna.mench`.

بدون کلید امضا، فایل‌ها امضای آزمایشی دارند (برای نصب و تست کافی است، ولی فروشگاه‌ها قبولشان نمی‌کنند). برای انتشار فروشگاهی **یک بار** کلید بسازید و جای امنی نگه دارید (اگر گم شود دیگر نمی‌توانید برنامه را به‌روز کنید):

```sh
keytool -genkeypair -v -keystore mench-upload.jks -alias mench -keyalg RSA -keysize 4096 -validity 10000
base64 -w0 mench-upload.jks   # خروجی را در سکرت MENCH_UPLOAD_KEYSTORE_BASE64 بگذارید
```

سکرت‌ها: `MENCH_UPLOAD_KEYSTORE_BASE64`، `MENCH_UPLOAD_STORE_PASSWORD`، `MENCH_UPLOAD_KEY_ALIAS` (مثلاً `mench`)، `MENCH_UPLOAD_KEY_PASSWORD`.

سپس: بازار ← پنل توسعه‌دهندگان ← برنامهٔ جدید ← بارگذاری `mench-release.apk`؛ گوگل‌پلی ← Play Console ← `mench-release.aab`. در هر دو، نشانی حریم خصوصی را https://espadna.com/mench-app/privacy/ بدهید. شمارهٔ نسخه (versionCode) خودکار با هر ساخت بالا می‌رود.

## ۳) آیفون (اپ‌استور و TestFlight)

ساخت iOS روی مک GitHub (Xcode 26) آزمایش شده و بدون امضا با موفقیت ساخته می‌شود. برای امضا و ارسال به TestFlight، بدون نیاز به مک:

1. **کلید API**: App Store Connect → Users and Access → Integrations → App Store Connect API → یک کلید با نقش **Admin** بسازید (اگر برای عددی ساخته‌اید، همان را استفاده کنید). فایل `AuthKey_XXXX.p8` فقط یک بار قابل دانلود است.
2. **شناسهٔ برنامه**: developer.apple.com → Certificates, IDs & Profiles → Identifiers → + → App IDs → App، با Bundle ID دقیقاً `com.espadna.mench` (Explicit). قابلیت خاصی لازم نیست.
3. **رکورد برنامه**: App Store Connect → Apps → + → New App: پلتفرم iOS، Bundle ID همان `com.espadna.mench`، SKU مثلاً `mench`، زبان اصلی فارسی. نام باید در کل اپ‌استور یکتا باشد؛ اگر «منچ» یا «Mench» گرفته شده بود، مثلاً «منچ آنلاین» یا «Mench: Ludo with Friends».
4. **سکرت‌های مخزن mench** (Settings → Secrets → Actions):
   - `APPLE_TEAM_ID`: در developer.apple.com → Account → Membership
   - `ASC_KEY_ID`: شناسهٔ کلید (Key ID)
   - `ASC_ISSUER_ID`: Issuer ID بالای صفحهٔ کلیدها
   - `ASC_KEY_P8`: کل متن فایل `.p8` (از `-----BEGIN PRIVATE KEY-----` تا انتها)
5. Actions → **ios** → Run workflow (گزینهٔ upload روشن). بعد از ۱۰ تا ۳۰ دقیقه پردازش اپل، نسخه در App Store Connect → TestFlight دیده می‌شود. سؤال رمزنگاری از قبل جواب داده شده (`ITSAppUsesNonExemptEncryption = false`).
6. برای تست روی آیفون خودتان: در TestFlight → Internal Testing خودتان را اضافه کنید و برنامهٔ TestFlight را روی گوشی نصب کنید.
7. برای انتشار: در صفحهٔ برنامه، اسکرین‌شات‌ها (آیفون ۶٫۹ اینچ)، توضیحات، نشانی حریم خصوصی `https://espadna.com/mench-app/privacy/` و نشانی پشتیبانی `https://espadna.com/mench-app/` را وارد کنید. Age Rating بدون محتوای حساس است؛ در App Privacy دقیق‌ترین اعلام این است: User Content → Other User Content (نام نمایشی که بازیکن تایپ می‌کند)، با هدف App Functionality، **Not linked to the user** و **Not used for tracking**. داده‌ی دیگری جمع نمی‌شود.

هر بار workflow را اجرا کنید، شمارهٔ build خودکار بالا می‌رود.

## اجرای محلی

```sh
npm ci
npm run check                                   # lint، تایپ، تست‌ها، build
npx playwright test --config playwright.edge.config.ts   # بازی آنلاین واقعی روی Worker محلی (wrangler dev)
VITE_BACKEND=edge npm run build -w @mench/web && npm run dev -w @mench/edge   # http://localhost:8787
python3 apps/edge/landing_pages.py              # بعد از تغییر متن صفحه‌های معرفی
```

نسخهٔ کامل با حساب کاربری، رتبه‌بندی، دوستان و تورنمنت هنوز روی API نود (`apps/api` + PostgreSQL) است و منتشر نشده؛ نسخهٔ عمومی فعلاً بازی تمرینی و آنلاین دوستانه بدون حساب است.
