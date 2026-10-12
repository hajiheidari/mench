#!/usr/bin/env python3
"""Generates the espadna.com/mench-app landing pages (en, fa, ar) and the privacy page.

Run `python3 apps/edge/landing_pages.py` after editing the text below and commit
the result in apps/edge/site/mench-app/. CI fails if the generated files are stale.
"""
from html import escape
from pathlib import Path
import shutil

ROOT = Path(__file__).resolve().parent
OUT = ROOT / "site" / "mench-app"
FONT = ROOT.parent.parent / "packages" / "board-geometry" / "assets" / "fonts"
GAME = "https://mench.espadna.com"
PAGE = "https://espadna.com/mench-app"

TEXT = {
    "en": {
        "dir": "ltr",
        "path": "/mench-app/",
        "title": "Ludo Dosti: Play with Friends | Ludo online or on one phone",
        "desc": "Ludo Dosti is the classic Ludo board game in red, green, yellow and blue. Play with friends from a shared link, against the bot, or pass one phone around. Free, no sign-up.",
        "name": "Ludo Dosti",
        "tag": "The classic board game, now with your friends online 🎲",
        "play": "▶️ Play now",
        "play_small": "In your browser, nothing to install",
        "features": [
            ("🔗", "Invite friends with one link"),
            ("👥", "2, 3 or 4 players"),
            ("🤖", "Practice against the bot"),
            ("🎲", "Fair dice you can verify"),
        ],
        "how": "How to play with a friend",
        "steps": [
            "Tap <b>Play with friends</b> and then <b>Create room</b>.",
            "Tap <b>Share invitation</b> and send the link on WhatsApp, Telegram or any messenger.",
            "Your friend opens the link and taps <b>Join room</b>; no app or account needed.",
            "When everyone is in, the host taps <b>Start game</b>. Lost the connection? Open the game again and you are back in your seat.",
        ],
        "faq": "Questions",
        "qa": [
            ("Is it free?", "Yes, with no purchases or sign-up. The only ads are optional ones in the app’s shop, watched for free coins."),
            ("Are the dice fair?", "In online games the server commits to each roll before you roll and your device adds its own random number, so every result can be checked under “Dice history”. The bot never changes the dice."),
            ("Can I install it?", "On Android open the Chrome menu <b>⋮</b> and choose “Install app”; on iPhone tap <b>⬆️</b> in Safari and choose “Add to Home Screen”."),
        ],
        "privacy": "Privacy",
        "studio": "Espadna",
        "made": "Made for family game nights",
        "langs": [("fa", "فارسی"), ("ar", "العربية")],
        "locale": "en_US",
        "lang_param": "en",
    },
    "fa": {
        "dir": "rtl",
        "path": "/mench-app/fa/",
        "title": "Ludo Dosti | منچ آنلاین با دوستان، با ربات یا روی یک گوشی",
        "desc": "Ludo Dosti، همان منچ نوستالژیک با مهره‌های قرمز، سبز، زرد و آبی. با یک لینک دوستانت را دعوت کن، با ربات تمرین کن یا یک گوشی را دست‌به‌دست کنید. رایگان و بدون ثبت‌نام.",
        "name": "Ludo Dosti",
        "tag": "همان منچ قدیمی، این بار با دوستانت آنلاین 🎲",
        "play": "▶️ شروع بازی",
        "play_small": "بدون نصب، همین‌جا در مرورگر",
        "features": [
            ("🔗", "دعوت دوستان با یک لینک"),
            ("👥", "۲، ۳ یا ۴ نفره"),
            ("🤖", "تمرین با ربات"),
            ("🎲", "تاس منصفانه و قابل بررسی"),
        ],
        "how": "چطور با دوستم بازی کنم؟",
        "steps": [
            "«<b>بازی آنلاین با دوستان</b>» و بعد «<b>ساخت اتاق</b>» را بزن.",
            "«<b>ارسال دعوت</b>» را بزن و لینک را در واتس‌اپ، تلگرام یا هر پیام‌رسانی بفرست.",
            "دوستت لینک را باز می‌کند و «<b>ورود به اتاق</b>» را می‌زند؛ نصب برنامه یا ساخت حساب لازم نیست.",
            "وقتی همه آمدند، میزبان «<b>شروع بازی</b>» را می‌زند. اینترنت قطع شد؟ دوباره بازی را باز کن تا سر جای خودت برگردی.",
        ],
        "faq": "پرسش‌ها",
        "qa": [
            ("رایگان است؟", "بله؛ خرید و ثبت‌نام ندارد. تنها تبلیغ، تبلیغ اختیاری داخل فروشگاه برنامه است که با دیدنش سکهٔ رایگان می‌گیری."),
            ("تاس منصفانه است؟", "در بازی آنلاین، سرور پیش از هر پرتاب به نتیجه متعهد می‌شود و دستگاه خودت هم یک عدد تصادفی اضافه می‌کند؛ پس هر نتیجه را می‌توانی در «سابقهٔ تاس» بررسی کنی. ربات هیچ‌وقت تاس را تغییر نمی‌دهد."),
            ("می‌شود نصبش کرد؟", "در اندروید منوی <b>⋮</b> کروم را بزن و «نصب برنامه» را انتخاب کن؛ در آیفون دکمهٔ <b>⬆️</b> سافاری و بعد «Add to Home Screen»."),
        ],
        "privacy": "حریم خصوصی",
        "studio": "اسپادنا",
        "made": "ساخته‌شده برای شب‌های بازی خانوادگی",
        "langs": [("en", "English"), ("ar", "العربية")],
        "locale": "fa_IR",
        "lang_param": "fa",
    },
    "ar": {
        "dir": "rtl",
        "path": "/mench-app/ar/",
        "title": "Ludo Dosti | لعبة لودو مع الأصدقاء عبر الإنترنت أو على هاتف واحد",
        "desc": "Ludo Dosti هي لعبة اللودو الكلاسيكية بالأحمر والأخضر والأصفر والأزرق. العب مع أصدقائك عبر رابط واحد، أو ضد الروبوت، أو على هاتف واحد. مجانية وبدون تسجيل.",
        "name": "Ludo Dosti",
        "tag": "لعبة الطاولة الكلاسيكية، الآن مع أصدقائك عبر الإنترنت 🎲",
        "play": "▶️ ابدأ اللعب",
        "play_small": "في المتصفح مباشرة، بدون تثبيت",
        "features": [
            ("🔗", "ادعُ أصدقاءك برابط واحد"),
            ("👥", "لاعبان أو ثلاثة أو أربعة"),
            ("🤖", "تدرّب ضد الروبوت"),
            ("🎲", "نرد عادل يمكن التحقق منه"),
        ],
        "how": "كيف ألعب مع صديقي؟",
        "steps": [
            "اختر <b>Play with friends</b> ثم <b>Create room</b> (اللعبة بالفارسية والإنجليزية).",
            "اضغط <b>Share invitation</b> وأرسل الرابط عبر واتساب أو تيليجرام.",
            "يفتح صديقك الرابط ويضغط <b>Join room</b>؛ لا حاجة لتطبيق أو حساب.",
            "عندما يكتمل الجميع، يضغط المضيف <b>Start game</b>. انقطع الاتصال؟ افتح اللعبة مجددًا لتعود إلى مكانك.",
        ],
        "faq": "أسئلة",
        "qa": [
            ("هل هي مجانية؟", "نعم، بلا إعلانات أو مشتريات أو تسجيل."),
            ("هل النرد عادل؟", "في اللعب عبر الإنترنت يلتزم الخادم بكل رمية قبل حدوثها ويضيف جهازك رقمًا عشوائيًا خاصًا به، لذا يمكن التحقق من كل نتيجة. الروبوت لا يغيّر النرد أبدًا."),
            ("هل يمكن تثبيتها؟", "على أندرويد افتح قائمة <b>⋮</b> في كروم واختر «تثبيت التطبيق»، وعلى آيفون اضغط <b>⬆️</b> في سفاري ثم «Add to Home Screen»."),
        ],
        "privacy": "الخصوصية",
        "studio": "إسبادنا",
        "made": "صُنعت لأمسيات اللعب العائلية",
        "langs": [("en", "English"), ("fa", "فارسی")],
        "locale": "ar_AR",
        "lang_param": "en",
    },
}

STYLE = """
    @font-face { font-family: Samim; font-weight: 700 900; font-display: swap; src: url(/mench-app/Samim-Bold.ttf) format("truetype"); }
    :root { --bg: #26164a; --bg2: #4a2677; --card: #fff4df; --ink: #1c0f33; --gold: #f3c35f;
      --red: #f03333; --green: #24b33f; --yellow: #ffe033; --blue: #2b88ee; --muted: #dbc9ed; }
    * { box-sizing: border-box; }
    html { -webkit-text-size-adjust: 100%; background: var(--bg); }
    body { margin: 0; min-height: 100vh; color: #fff; line-height: 1.8;
      font-family: Samim, Tahoma, "Segoe UI", sans-serif;
      background: var(--bg) radial-gradient(ellipse 120% 900px at 50% 0%, #8c55c5 0, var(--bg2) 50%, var(--bg) 100%) no-repeat; }
    main { max-width: 720px; margin: 0 auto; padding: 24px 16px 48px; }
    .hero { text-align: center; padding: 24px 0 8px; }
    .hero img { width: 132px; height: 132px; border-radius: 30px; box-shadow: 0 8px 0 var(--ink); animation: bob 2.4s ease-in-out infinite; }
    h1 { margin: 20px 0 0; font-size: clamp(40px, 11vw, 64px); font-weight: 900; color: var(--gold); line-height: 1.3; text-shadow: 0 5px 0 var(--ink); }
    .tag { margin: 4px 0 28px; font-size: 20px; color: var(--muted); font-weight: 700; }
    .play { display: block; max-width: 420px; margin: 0 auto; padding: 18px 24px; background: #35be88; color: var(--ink);
      text-decoration: none; text-align: center; font-size: 30px; font-weight: 900; border: 4px solid var(--ink);
      border-radius: 999px; box-shadow: 0 8px 0 var(--ink); transition: transform .1s, box-shadow .1s; }
    .play:active { transform: translateY(6px); box-shadow: 0 2px 0 var(--ink); }
    .play small { display: block; font-size: 15px; font-weight: 700; opacity: .75; }
    .dots { display: flex; direction: ltr; justify-content: center; gap: 10px; margin: 18px 0 0; }
    .dots i { width: 14px; height: 14px; border-radius: 50%; border: 2px solid #fff; }
    .grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 14px; margin: 40px 0; }
    .feat { background: var(--card); color: var(--ink); border: 3px solid var(--ink); border-radius: 22px; padding: 16px; text-align: center; box-shadow: 0 6px 0 var(--ink); }
    .feat b { display: block; font-size: 34px; line-height: 1.3; }
    .feat span { font-weight: 800; font-size: 16px; }
    h2 { color: var(--gold); font-size: 26px; margin: 40px 0 12px; }
    .card { background: rgba(255,255,255,.07); border: 2px solid rgba(255,255,255,.12); border-radius: 22px; padding: 6px 20px; }
    ol { padding-inline-start: 26px; margin: 12px 0; } li { margin: 6px 0; }
    details { border-bottom: 1px solid rgba(255,255,255,.12); padding: 10px 0; }
    details:last-child { border-bottom: 0; }
    summary { cursor: pointer; font-weight: 800; }
    .lang { text-align: end; } .lang a { color: var(--muted); font-weight: 800; text-decoration: none; border: 2px solid rgba(255,255,255,.2); border-radius: 999px; padding: 2px 14px; }
    footer { text-align: center; color: var(--muted); font-size: 14px; margin-top: 48px; }
    footer a { color: var(--muted); }
    @keyframes bob { 50% { transform: translateY(-8px) rotate(-3deg); } }
    @media (prefers-reduced-motion: reduce) { .hero img { animation: none; } }
"""


def alternates() -> str:
    links = [
        f'  <link rel="alternate" hreflang="{code}" href="https://espadna.com{TEXT[code]["path"]}">'
        for code in ("en", "fa", "ar")
    ]
    links.append(
        f'  <link rel="alternate" hreflang="x-default" href="https://espadna.com/mench-app/">'
    )
    return "\n".join(links)


def page(code: str) -> str:
    t = TEXT[code]
    url = f"https://espadna.com{t['path']}"
    game = f"{GAME}/?lang={t['lang_param']}"
    langs = " ".join(
        f'<a href="{TEXT[c]["path"]}" hreflang="{c}" lang="{c}">{label}</a>'
        for c, label in t["langs"]
    )
    features = "\n".join(
        f'    <div class="feat"><b>{icon}</b><span>{escape(label)}</span></div>'
        for icon, label in t["features"]
    )
    steps = "\n".join(f"      <li>{step}</li>" for step in t["steps"])
    qa = "\n".join(
        f"    <details>\n      <summary>{escape(q)}</summary>\n      <p>{a}</p>\n    </details>"
        for q, a in t["qa"]
    )
    dots = "".join(
        f'<i style="background:var(--{c})"></i>' for c in ("red", "green", "yellow", "blue")
    )
    return f"""<!DOCTYPE html>
<html lang="{code}" dir="{t['dir']}">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
  <title>{escape(t['title'])}</title>
  <meta name="description" content="{escape(t['desc'])}">
  <meta name="theme-color" content="#26164a">
  <link rel="canonical" href="{url}">
{alternates()}
  <link rel="icon" type="image/png" href="/mench-app/icon.png">
  <link rel="apple-touch-icon" href="/mench-app/icon.png">
  <meta property="og:type" content="website">
  <meta property="og:locale" content="{t['locale']}">
  <meta property="og:site_name" content="{escape(t['name'])}">
  <meta property="og:title" content="{escape(t['name'])} 🎲">
  <meta property="og:description" content="{escape(t['desc'])}">
  <meta property="og:url" content="{url}">
  <meta property="og:image" content="{PAGE}/icon.png">
  <meta name="twitter:card" content="summary">
  <script type="application/ld+json">
  {{
    "@context": "https://schema.org",
    "@type": "VideoGame",
    "name": "{t['name']}",
    "description": "{t['desc']}",
    "inLanguage": "{code}",
    "genre": ["Board game", "Ludo"],
    "gamePlatform": ["Web browser", "Android", "iOS"],
    "url": "{url}",
    "image": "{PAGE}/icon.png",
    "offers": {{ "@type": "Offer", "price": "0", "priceCurrency": "USD" }}
  }}
  </script>
  <style>{STYLE}  </style>
</head>
<body>
<main>
  <nav class="lang">{langs}</nav>
  <section class="hero">
    <img src="/mench-app/icon.png" alt="{escape(t['name'])}" width="132" height="132">
    <h1>{escape(t['name'])}</h1>
    <p class="tag">{escape(t['tag'])}</p>
    <a class="play" href="{game}">{t['play']}<small>{escape(t['play_small'])}</small></a>
    <div class="dots" aria-hidden="true">{dots}</div>
  </section>

  <section class="grid">
{features}
  </section>

  <h2>{escape(t['how'])}</h2>
  <div class="card">
    <ol>
{steps}
    </ol>
  </div>

  <h2>{escape(t['faq'])}</h2>
  <div class="card">
{qa}
  </div>

  <footer>
    <a href="{'/' if code == 'en' else f'/{code}/'}">{escape(t['studio'])}</a> · <a href="/mench-app/privacy/">{escape(t['privacy'])}</a> · {escape(t['made'])}
  </footer>
</main>
</body>
</html>
"""


PRIVACY = """<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Ludo Dosti privacy policy</title>
  <link rel="canonical" href="https://espadna.com/mench-app/privacy/">
  <style>{style}
    h1 {{ font-size: 36px; }} .card p, .card li {{ color: #fff4df; }}
  </style>
</head>
<body>
<main>
  <nav class="lang"><a href="#fa">فارسی</a></nav>
  <h1>Ludo Dosti privacy policy</h1>
  <div class="card">
    <p>Updated 2026-10-12. Ludo Dosti (web, Android and iOS) is made by Espadna.</p>
    <ul>
      <li><b>No account, no tracking.</b> The game does not ask for your name, email, phone number or contacts, contains no analytics SDKs and never asks to track you across apps.</li>
      <li><b>Online rooms.</b> When you play online, the nickname you type, the moves and the dice rolls of that room are sent to our server (Cloudflare) so every player sees the same game. Other players in the room see your nickname. A random seat token is kept on your device so you can return to your seat after a disconnect.</li>
      <li><b>Retention.</b> Room data is deleted automatically: unused lobbies after one hour, every room at most 24 hours after it was created.</li>
      <li><b>Server logs.</b> Cloudflare processes technical request data (such as IP address) to deliver and protect the service, under its own privacy policy.</li>
      <li><b>Competitive online games</b> send your nickname and a country flag (guessed on your device from its time zone; the time zone itself is not sent) to the server to find an opponent; the room is then handled like any online room. If nobody is free, the computer plays and the game stays on your device.</li>
      <li><b>Practice games</b> against the computer stay on your device.</li>
      <li><b>Coins and designs.</b> Your coin balance, the boards and pawns you own and the ones you use are kept on our server under a random wallet number made on your device; it is not linked to your name or any account. That number comes from a recovery code shown in the menu; the app also keeps the code in your own iCloud (iPhone) or Google backup (Android) so a reinstall finds your coins. Coins have no money value, cannot be bought and cannot be cashed out; they come from a daily reward, from won games (an online win is checked with the game server using that game&rsquo;s seat, nothing else) and from ads you choose to watch in the shop.</li>
      <li><b>Ads.</b> Ads appear only in the shop of the iOS and Android apps, and only when you tap “Watch an ad”; the web game has none. They are served by Appodeal and the networks it works with (iOS) and by Adivery (Android), which receive technical data such as IP address, device model and system version to deliver the ad and count it, under their own privacy policies. The advertising identifier is not shared on iOS because the app never asks for tracking permission.</li>
      <li><b>Children.</b> The game has no chat and collects no personal information.</li>
      <li><b>Contact.</b> Questions or deletion requests: <a href="mailto:espadna.support@gmail.com">espadna.support@gmail.com</a>.</li>
    </ul>
  </div>
  <h2 id="fa" dir="rtl" lang="fa">حریم خصوصی Ludo Dosti</h2>
  <div class="card" dir="rtl" lang="fa">
    <ul>
      <li>بدون حساب کاربری و بدون ردیابی. نام، ایمیل، شماره یا مخاطبان شما را نمی‌خواهیم و ابزار آمار و تحلیل در برنامه نیست.</li>
      <li>در بازی آنلاین، نام نمایشی که وارد می‌کنید، حرکت‌ها و تاس‌های همان اتاق به سرور ما (Cloudflare) فرستاده می‌شود تا همه یک بازی را ببینند. بازیکنان همان اتاق نام نمایشی شما را می‌بینند.</li>
      <li>اطلاعات اتاق خودکار پاک می‌شود: اتاق بلااستفاده پس از یک ساعت و هر اتاق حداکثر ۲۴ ساعت پس از ساخت.</li>
      <li>در بازی آنلاین رقابتی، نام نمایشی و یک پرچم کشور (که روی دستگاه از منطقهٔ زمانی حدس زده می‌شود؛ خود منطقهٔ زمانی ارسال نمی‌شود) برای پیدا کردن حریف به سرور فرستاده می‌شود و بعد مثل هر اتاق آنلاین دیگری رفتار می‌شود. اگر حریفی نباشد، کامپیوتر بازی می‌کند و بازی روی دستگاه شما می‌ماند.</li>
      <li>بازی تمرینی با کامپیوتر فقط روی دستگاه شما می‌ماند.</li>
      <li>تعداد سکه‌ها و صفحه و مهره‌هایی که خریده‌اید یا انتخاب کرده‌اید روی سرور ما نگه داشته می‌شود، با یک شماره‌ی تصادفی که گوشی خودتان می‌سازد و به نام یا حسابی وصل نیست. این شماره از «کد بازیابی» داخل منو ساخته می‌شود و برنامه همین کد را در iCloud (آیفون) یا پشتیبان گوگل (اندروید) خودتان هم نگه می‌دارد تا بعد از نصب دوباره، سکه‌ها برگردد. سکه ارزش پولی ندارد، خریدنی نیست و قابل نقد کردن نیست؛ از جایزهٔ روزانه، بردن بازی (برد آنلاین فقط با همان صندلی بازی روی سرور بازی بررسی می‌شود) و تبلیغی که به انتخاب خودتان در فروشگاه می‌بینید به دست می‌آید.</li>
      <li>تبلیغ فقط در فروشگاه برنامهٔ آیفون و اندروید و فقط وقتی «دیدن تبلیغ» را بزنید نشان داده می‌شود؛ نسخهٔ وب تبلیغ ندارد. تبلیغ‌ها را Appodeal و شبکه‌های همکارش (آیفون) و Adivery (اندروید) نشان می‌دهند و برای نمایش و شمارش تبلیغ اطلاعات فنی مثل آدرس IP، مدل گوشی و نسخهٔ سیستم‌عامل را طبق سیاست حریم خصوصی خودشان دریافت می‌کنند. در آیفون شناسهٔ تبلیغاتی فرستاده نمی‌شود، چون برنامه هیچ‌وقت اجازهٔ ردیابی نمی‌خواهد.</li>
      <li>تماس: <a href="mailto:espadna.support@gmail.com">espadna.support@gmail.com</a></li>
    </ul>
  </div>
</main>
</body>
</html>
"""


def main() -> None:
    OUT.mkdir(parents=True, exist_ok=True)
    (OUT / "index.html").write_text(page("en"), encoding="utf-8")
    for code in ("fa", "ar"):
        (OUT / code).mkdir(exist_ok=True)
        (OUT / code / "index.html").write_text(page(code), encoding="utf-8")
    (OUT / "privacy").mkdir(exist_ok=True)
    (OUT / "privacy" / "index.html").write_text(
        PRIVACY.format(style=STYLE), encoding="utf-8"
    )
    shutil.copyfile(FONT / "Samim-Bold.ttf", OUT / "Samim-Bold.ttf")
    shutil.copyfile(FONT / "LICENSE", OUT / "Samim-LICENSE.txt")
    print(f"Landing pages written to {OUT}")


if __name__ == "__main__":
    main()
