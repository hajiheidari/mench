#!/usr/bin/env python3
"""Designs the Cafe Bazaar promo screenshots (1080x2160) from raw app screens.

Usage: compose.py <capture dir from capture.mjs> <out dir>
"""
import random
import re
import sys
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = Path(__file__).resolve().parents[2]
FONT = str(ROOT / "packages/board-geometry/assets/fonts/Samim-Bold.ttf")
ART = ROOT / "apps/mobile/assets/game"
ICON = ROOT / "apps/mobile/assets/icon.png"
W, H = 1080, 2160
GOLD = (255, 214, 102)
INK = (28, 15, 51)

SHOTS = [
    # name, raw screen, headline lines, subline, decorations, badges
    ("1", "game", ["همون منچ نوستالژیک", "حالا روی گوشیت!"], "قرمز، سبز، زرد و آبی؛ با همون قانون‌های قدیمی",
     ["dice-night", "pawn-0", "dice-marble", "pawn-3"], ["رایگان", "بدون ثبت‌نام", "۲ تا ۴ نفره"]),
    ("2", "friends", ["با یه لینک", "دوستاتو دعوت کن"], "اتاق بساز، لینک رو تو واتس‌اپ یا تلگرام بفرست",
     ["pawn-1", "pawn-2", "dice-firoozeh"], ["آنلاین با دوستان", "رقابتی"]),
    ("3", "home", ["اینترنت نداری؟", "آفلاین بازی کن"], "با ربات یا دور هم با یک گوشی",
     ["dice-wood", "pawn-0", "pawn-2"], ["بازی با ربات", "بدون اینترنت"]),
    ("4", "shop-dice-scrolled", ["تاس‌های خاص", "و دیدنی"], "کهکشان، مرمر سبز، تراورتن، لاجورد، فیروزه…",
     ["dice-night", "dice-lapis", "dice-travertine", "dice-marble", "dice-gold"], []),
    ("5", "free", ["هر روز", "سکهٔ رایگان"], "جایزهٔ روزانه، بردن بازی و دیدن تبلیغ",
     ["coin", "coin", "coin", "dice-gold"], ["۲۰ سکهٔ روزانه", "۱۰ سکه برای هر برد"]),
    ("6", "shop-boards", ["صفحه و مهره با", "طرح‌های ایرانی"], "چوبی، فیروزه‌کوبی، کاشی اصفهان، خاتم‌کاری",
     ["pawn-firoozeh-0", "pawn-copper-1", "dice-copper"], []),
]


def font(size):
    return ImageFont.truetype(FONT, size)


def background(seed):
    img = Image.new("RGB", (W, H))
    px = ImageDraw.Draw(img)
    for y in range(H):
        t = y / H
        px.line([(0, y), (W, y)], fill=(int(92 - 64 * t), int(46 - 32 * t), int(160 - 105 * t)))
    glow = Image.new("L", (W, H), 0)
    ImageDraw.Draw(glow).ellipse((-300, -500, W + 300, 900), fill=120)
    glow = glow.filter(ImageFilter.GaussianBlur(160))
    img = Image.composite(Image.new("RGB", (W, H), (190, 120, 255)), img, glow.point(lambda v: v * 0.55))
    # Faint corner squares in the four Ludo colors.
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    rnd = random.Random(seed)
    colors = [(240, 51, 51), (36, 179, 63), (255, 224, 51), (43, 136, 238)]
    for i in range(26):
        x, y = rnd.randrange(-40, W), rnd.randrange(0, H)
        s = rnd.randrange(14, 34)
        d.rounded_rectangle((x, y, x + s, y + s), radius=6, fill=colors[i % 4] + (rnd.randrange(30, 70),))
    for i in range(40):
        x, y = rnd.randrange(0, W), rnd.randrange(0, H)
        r = rnd.choice([2, 3, 4])
        d.ellipse((x - r, y - r, x + r, y + r), fill=(255, 255, 255, rnd.randrange(60, 160)))
    img.paste(layer, (0, 0), layer)
    return img


def shadowed(canvas, sprite, pos, blur=18, offset=(0, 14), alpha=150):
    a = sprite.split()[-1].point(lambda v: v * alpha // 255)
    sh = Image.new("RGBA", (sprite.width + 4 * blur, sprite.height + 4 * blur), (0, 0, 0, 0))
    sh.paste(Image.new("RGBA", sprite.size, (10, 0, 30, 255)), (2 * blur, 2 * blur), a)
    sh = sh.filter(ImageFilter.GaussianBlur(blur))
    canvas.paste(sh, (pos[0] - 2 * blur + offset[0], pos[1] - 2 * blur + offset[1]), sh)
    canvas.paste(sprite, pos, sprite)


def coin(size):
    c = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    d.ellipse((0, 0, size - 1, size - 1), fill=(201, 138, 20))
    d.ellipse((size * .07, size * .07, size * .93, size * .93), fill=(255, 205, 64))
    d.ellipse((size * .22, size * .22, size * .78, size * .78), outline=(214, 150, 26), width=max(3, size // 18))
    d.ellipse((size * .2, size * .14, size * .42, size * .3), fill=(255, 238, 170))
    return c


def dice_styles():
    src = (ROOT / "packages/board-geometry/src/themes.ts").read_text()
    block = src[src.index("DICE_STYLES"):]
    styles = {}
    for m in re.finditer(r"(\w+): \{\s*faceTop: \"(#\w+)\",\s*faceBottom: \"(#\w+)\",\s*rim: \"(#\w+)\",\s*edge: \"(#\w+)\",\s*pip: \"(#\w+)\"", block):
        styles[m.group(1)] = dict(zip(("top", "bottom", "rim", "edge", "pip"), m.groups()[1:]))
    return styles


STYLES = dice_styles()
PIPS = {1: [(.5, .5)], 2: [(.27, .27), (.73, .73)], 3: [(.27, .27), (.5, .5), (.73, .73)],
        4: [(.27, .27), (.73, .27), (.27, .73), (.73, .73)],
        5: [(.27, .27), (.73, .27), (.5, .5), (.27, .73), (.73, .73)],
        6: [(.27, .25), (.73, .25), (.27, .5), (.73, .5), (.27, .75), (.73, .75)]}


def die(skin, size, value):
    """A chunky die: textured face, darker side below, rim, gloss and pips."""
    st = STYLES[skin]
    side = size // 9
    r = size // 5
    img = Image.new("RGBA", (size, size + side), (0, 0, 0, 0))
    d = ImageDraw.Draw(img)
    d.rounded_rectangle((0, side, size - 1, size + side - 1), radius=r, fill=st["edge"])
    face = Image.open(ART / f"dice-{skin}.png").convert("RGB").resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=r, fill=255)
    img.paste(face, (0, 0), mask)
    d.rounded_rectangle((2, 2, size - 3, size - 3), radius=r, outline=st["rim"], width=max(3, size // 40))
    gloss = Image.new("L", (size, size), 0)
    ImageDraw.Draw(gloss).ellipse((-size * .2, -size * .55, size * 1.1, size * .42), fill=60)
    gloss = Image.composite(gloss, Image.new("L", (size, size), 0), mask)
    img.paste(Image.new("RGBA", (size, size), (255, 255, 255, 255)), (0, 0), gloss)
    pr = size * .085
    for fx, fy in PIPS[value]:
        cx, cy = fx * size, fy * size
        d.ellipse((cx - pr, cy - pr + 2, cx + pr, cy + pr + 2), fill=(0, 0, 0, 90))
        d.ellipse((cx - pr, cy - pr, cx + pr, cy + pr), fill=st["pip"])
    return img


def deco(name, size):
    if name == "coin":
        return coin(size)
    if name.startswith("dice-"):
        return die(name[5:], int(size * .8), random.Random(name).choice([3, 4, 5, 6]))
    img = Image.open(ART / f"{name}.png").convert("RGBA")
    img.thumbnail((size, size), Image.LANCZOS)
    return img


def phone(screen, width):
    bezel = 18
    shot = Image.open(screen).convert("RGB")
    h = int(shot.height * (width - 2 * bezel) / shot.width)
    shot = shot.resize((width - 2 * bezel, h), Image.LANCZOS)
    body = Image.new("RGBA", (width, h + 2 * bezel), (0, 0, 0, 0))
    d = ImageDraw.Draw(body)
    d.rounded_rectangle((0, 0, width - 1, h + 2 * bezel - 1), radius=74, fill=(18, 10, 36))
    d.rounded_rectangle((3, 3, width - 4, h + 2 * bezel - 4), radius=72, outline=(243, 195, 95), width=4)
    mask = Image.new("L", shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, shot.width - 1, shot.height - 1), radius=56, fill=255)
    body.paste(shot, (bezel, bezel), mask)
    return body


def text_center(d, y, text, size, fill, stroke=0):
    f = font(size)
    d.text((W / 2 + 0, y + 7), text, font=f, fill=INK, anchor="mt", stroke_width=stroke, stroke_fill=INK)
    d.text((W / 2, y), text, font=f, fill=fill, anchor="mt", stroke_width=stroke, stroke_fill=INK)
    return f.getbbox(text, anchor="mt")[3]


def pills(d, y, labels):
    f = font(40)
    widths = [d.textlength(t, font=f) + 70 for t in labels]
    gap = 16
    x = (W - sum(widths) - gap * (len(labels) - 1)) / 2
    colors = [(53, 190, 136), (243, 195, 95), (43, 136, 238)]
    for i, (label, w) in enumerate(zip(reversed(labels), reversed(widths))):
        c = colors[(len(labels) - 1 - i) % 3]
        d.rounded_rectangle((x, y + 6, x + w, y + 82), radius=40, fill=INK)
        d.rounded_rectangle((x, y, x + w, y + 76), radius=38, fill=c, outline=INK, width=4)
        d.text((x + w / 2, y + 38), label, font=f, fill=INK, anchor="mm")
        x += w + gap


def bubble(img, x, y):
    """A messenger-style invite message over the lobby screen."""
    w, h = 780, 330
    card = Image.new("RGBA", (w, h + 30), (0, 0, 0, 0))
    d = ImageDraw.Draw(card)
    d.rounded_rectangle((0, 0, w - 1, h - 1), radius=44, fill=(225, 255, 199))
    d.polygon([(w - 90, h - 2), (w - 30, h - 2), (w - 40, h + 28)], fill=(225, 255, 199))
    d.text((w - 44, 40), "بیا با هم منچ بازی کنیم!", font=font(44), fill=(20, 40, 20), anchor="ra")
    d.text((w - 44, 112), "روی لینک بزن تا وارد اتاق من بشی:", font=font(36), fill=(50, 70, 50), anchor="ra")
    d.text((44, 190), "mench.espadna.com/join/F2629FD092", font=font(36), fill=(30, 110, 200), anchor="la")
    d.text((w - 44, h - 30), "۱۲:۳۰", font=font(28), fill=(110, 140, 110), anchor="rb")
    shadowed(img, card, (x, y), blur=24, offset=(0, 18), alpha=170)


def compose(raw, out, spec, index):
    name, screen, lines, sub, decos, badges = spec
    img = background(index).convert("RGBA")
    d = ImageDraw.Draw(img)
    y = 90
    for line in lines:
        text_center(d, y, line, 104, GOLD, stroke=3)
        y += 128
    d.text((W / 2, y + 12), sub, font=font(42), fill=(255, 244, 223), anchor="mt")
    y += 90
    if badges:
        pills(d, y, badges)
        y += 100
    ph = phone(raw / "shots" / f"{screen}.png", 860)
    px = (W - ph.width) // 2
    py = y + 20
    # Decorations behind and around the phone.
    rnd = random.Random(index * 7)
    spots = [(-60, py + 140), (W - 170, py + 380), (-50, py + 760), (W - 180, py + 1060), (-40, py + 1300)]
    behind = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    for i, nm in enumerate(decos):
        sx, sy = spots[i % len(spots)]
        size = rnd.randrange(190, 250)
        sprite = deco(nm, size).rotate(rnd.choice([-18, -10, 12, 20]), expand=True, resample=Image.BICUBIC)
        shadowed(behind if i % 2 else img, sprite, (sx, sy))
    img.alpha_composite(behind)
    shadowed(img, ph, (px, py), blur=30, offset=(0, 26), alpha=200)
    # Front decorations overlap the phone edge a little.
    for i, nm in enumerate(decos[::2]):
        sx, sy = spots[(2 * i) % len(spots)]
        size = rnd.randrange(170, 220)
        sprite = deco(nm, size).rotate(rnd.choice([-14, 9, 16]), expand=True, resample=Image.BICUBIC)
        shadowed(img, sprite, (sx, sy + 40))
    if name == "2":
        bubble(img, px + 40, py + 1020)
    img.convert("RGB").save(out / f"bazaar-{name}.png", optimize=True)


def device(screen, width, kind):
    """An Android phone (punch-hole camera) or an iPhone (Dynamic Island)."""
    bezel = 16 if kind == "android" else 20
    radius = 56 if kind == "android" else 92
    raw = Image.open(screen).convert("RGB")
    # A status bar above the app, as on a real phone, so the camera hides nothing.
    bar = int(raw.width * (0.13 if kind == "iphone" else 0.07))
    shot = Image.new("RGB", (raw.width, raw.height + bar), raw.getpixel((raw.width // 2, 2)))
    shot.paste(raw, (0, bar))
    h = int(shot.height * (width - 2 * bezel) / shot.width)
    shot = shot.resize((width - 2 * bezel, h), Image.LANCZOS)
    body = Image.new("RGBA", (width, h + 2 * bezel), (0, 0, 0, 0))
    d = ImageDraw.Draw(body)
    frame = (58, 62, 70) if kind == "android" else (196, 170, 140)
    d.rounded_rectangle((0, 0, width - 1, h + 2 * bezel - 1), radius=radius, fill=frame)
    d.rounded_rectangle((5, 5, width - 6, h + 2 * bezel - 6), radius=radius - 5, fill=(12, 10, 18))
    mask = Image.new("L", shot.size, 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, shot.width - 1, shot.height - 1), radius=radius - bezel, fill=255)
    body.paste(shot, (bezel, bezel), mask)
    cx = width // 2
    if kind == "android":
        d.ellipse((cx - 13, bezel + 14, cx + 13, bezel + 40), fill=(8, 8, 12))
    else:
        d.rounded_rectangle((cx - 100, bezel + 14, cx + 100, bezel + 70), radius=28, fill=(8, 8, 12))
    return body


def platforms(raw, out):
    """Both phones in one game: Android and iPhone play together."""
    img = background(42).convert("RGBA")
    d = ImageDraw.Draw(img)
    y = 90
    for line in ["هم اندروید", "هم آیفون!"]:
        text_center(d, y, line, 112, GOLD, stroke=3)
        y += 136
    d.text((W / 2, y + 14), "دوستات هر گوشی‌ای داشته باشن، با هم بازی می‌کنید", font=font(42), fill=(255, 244, 223), anchor="mt")
    y += 100
    pills(d, y, ["اندروید", "آیفون و آیپد", "مرورگر"])
    y += 130
    left = device(raw / "shots" / "home.png", 600, "iphone").rotate(5, expand=True, resample=Image.BICUBIC)
    right = device(raw / "shots" / "game.png", 600, "android").rotate(-5, expand=True, resample=Image.BICUBIC)
    shadowed(img, left, (-50, y + 150), blur=30, offset=(0, 26), alpha=200)
    shadowed(img, right, (W - right.width + 50, y + 70), blur=30, offset=(0, 26), alpha=200)
    # The link between the two phones, and their names.
    cy = y + 790
    d = ImageDraw.Draw(img)
    d.ellipse((W / 2 - 100, cy - 94, W / 2 + 100, cy + 108), fill=INK)
    d.ellipse((W / 2 - 100, cy - 100, W / 2 + 100, cy + 100), fill=(53, 190, 136), outline=INK, width=6)
    d.text((W / 2, cy - 24), "با هم", font=font(50), fill=INK, anchor="mm")
    d.text((W / 2, cy + 34), "بازی کنید", font=font(36), fill=INK, anchor="mm")
    for x, ly, label in ((290, min(H - 120, y + 150 + left.height - 40), "آیفون"), (W - 290, y + 70 + right.height - 40, "اندروید")):
        f = font(50)
        w = d.textlength(label, font=f) + 80
        d.rounded_rectangle((x - w / 2, ly + 8, x + w / 2, ly + 96), radius=44, fill=INK)
        d.rounded_rectangle((x - w / 2, ly, x + w / 2, ly + 88), radius=44, fill=(255, 244, 223), outline=INK, width=4)
        d.text((x, ly + 44), label, font=f, fill=INK, anchor="mm")
    img.convert("RGB").save(out / "bazaar-7.png", optimize=True)


def main():
    raw, out = Path(sys.argv[1]), Path(sys.argv[2])
    out.mkdir(parents=True, exist_ok=True)
    for i, spec in enumerate(SHOTS):
        compose(raw, out, spec, i)
        print("bazaar-" + spec[0])
    platforms(raw, out)
    print("bazaar-7")


if __name__ == "__main__":
    main()
