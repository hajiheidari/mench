#!/usr/bin/env python3
"""Renders the Cafe Bazaar promo clip (1080x1920, 30 fps, about 30 s) from the
screen recordings of capture.mjs, with Persian captions and a light synth tune.

Usage: video.py <capture dir> <out.mp4>
"""
import json
import math
import subprocess
import sys
import wave
from functools import lru_cache
from pathlib import Path

import numpy as np
from PIL import Image, ImageDraw

sys.path.insert(0, str(Path(__file__).parent))
from compose import GOLD, ICON, INK, background, bubble, coin, die, font, phone, shadowed  # noqa: E402

W, H, FPS = 1080, 1920, 30
RAW = Path(sys.argv[1])
OUT = Path(sys.argv[2])

SCENES = [  # kind, seconds, clip, caption, small line
    ("intro", 3.0, None, None, None),
    ("clip", 7.0, "game", "با ربات یا دوستات بازی کن", "۲ تا ۴ نفره، آنلاین یا آفلاین"),
    ("clip", 4.5, "friends", "با یه لینک دعوتشون کن", "واتس‌اپ، تلگرام یا هر پیام‌رسانی"),
    ("clip", 5.0, "shop", "تاس‌ها و صفحه‌های خاص", "کهکشان، مرمر سبز، لاجورد و…"),
    ("clip", 4.0, "free", "هر روز سکهٔ رایگان", "جایزهٔ روزانه و سکه برای هر برد"),
    ("outro", 4.5, None, None, None),
]


def ease(t):
    t = min(max(t, 0.0), 1.0)
    return 1 - (1 - t) ** 3


class Clip:
    def __init__(self, name):
        meta = json.loads((RAW / "clips" / name / "frames.json").read_text())
        self.dir = RAW / "clips" / name
        self.frames = meta["frames"]
        self.t0 = self.frames[0]["t"] if self.frames else meta["start"]
        self.length = meta["end"] - meta["start"]

    def at(self, seconds):
        # Recordings only emit a frame when the screen changes: hold the last one.
        best = self.frames[0]
        for f in self.frames:
            if f["t"] - self.t0 <= seconds:
                best = f
            else:
                break
        return self.dir / best["file"]


@lru_cache(maxsize=64)
def phone_frame(path):
    return phone(path, 820)


def caption_layer(title, small):
    layer = Image.new("RGBA", (W, 330), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    f = font(96)
    d.text((W / 2, 46), title, font=f, fill=INK, anchor="mt", stroke_width=3, stroke_fill=INK)
    d.text((W / 2, 40), title, font=f, fill=GOLD, anchor="mt", stroke_width=3, stroke_fill=INK)
    d.text((W / 2, 190), small, font=font(46), fill=(255, 244, 223), anchor="mt")
    return layer


def fade(img, alpha):
    if alpha >= 1:
        return img
    a = img.split()[-1].point(lambda v: int(v * alpha))
    out = img.copy()
    out.putalpha(a)
    return out


BG = [background(10 + i).resize((W, H)) for i in range(len(SCENES))]
ICON_IMG = Image.open(ICON).convert("RGBA")
DICE = [die("night", 200, 6), die("marble", 180, 5), die("gold", 170, 4), die("lapis", 190, 3)]
COIN = coin(150)


def icon(size):
    img = ICON_IMG.resize((size, size), Image.LANCZOS)
    mask = Image.new("L", (size, size), 0)
    ImageDraw.Draw(mask).rounded_rectangle((0, 0, size - 1, size - 1), radius=size // 4.4, fill=255)
    out = Image.new("RGBA", (size, size), (0, 0, 0, 0))
    out.paste(img, (0, 0), mask)
    return out


def floating(frame, t, seed):
    spots = [(40, 300), (W - 230, 520), (60, 1500), (W - 220, 1640)]
    for i, (x, y) in enumerate(spots):
        sprite = DICE[(i + seed) % len(DICE)]
        dy = int(18 * math.sin(t * 2.2 + i * 1.7))
        rot = 12 * math.sin(t * 1.3 + i)
        s = sprite.rotate(rot, expand=True, resample=Image.BICUBIC)
        shadowed(frame, s, (x, y + dy), blur=14)


def intro(t, length):
    frame = BG[0].convert("RGBA")
    floating(frame, t, 0)
    size = int(300 + 60 * ease(t / 0.8))
    ic = fade(icon(size), ease(t / 0.5))
    shadowed(frame, ic, ((W - size) // 2, 520 - size // 2 + 150), blur=26)
    d = ImageDraw.Draw(frame)
    if t > 0.6:
        a = ease((t - 0.6) / 0.5)
        layer = Image.new("RGBA", (W, 600), (0, 0, 0, 0))
        ld = ImageDraw.Draw(layer)
        ld.text((W / 2, 16), "بازی منچ دوستانه", font=font(120), fill=INK, anchor="mt", stroke_width=4, stroke_fill=INK)
        ld.text((W / 2, 8), "بازی منچ دوستانه", font=font(120), fill=GOLD, anchor="mt", stroke_width=4, stroke_fill=INK)
        ld.text((W / 2, 200), "همون منچ نوستالژیک، حالا روی گوشیت!", font=font(54), fill=(255, 244, 223), anchor="mt")
        frame.alpha_composite(fade(layer, a), (0, 1000 + int(40 * (1 - a))))
    return frame


def clip_scene(index, t, length, clip, title, small):
    frame = BG[index].convert("RGBA")
    floating(frame, t, index)
    a = ease(t / 0.45)
    cap = caption_layer(title, small)
    frame.alpha_composite(fade(cap, a), (0, 70 + int(-30 * (1 - a))))
    # Short recordings are stretched over the scene; long ones play their middle part.
    if clip.length < length:
        at = t * clip.length / length
    else:
        at = (clip.length - length) / 2 + t
    ph = phone_frame(clip.at(at))
    y = 420 + int(700 * (1 - ease(t / 0.55)))
    shadowed(frame, ph, ((W - ph.width) // 2, y), blur=30, offset=(0, 24), alpha=200)
    if clip.dir.name == "friends" and t > 1.2:
        # The invite message pops up over the lobby, as the friend receives it.
        layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
        bubble(layer, 150, 1080 + int(120 * (1 - ease((t - 1.2) / 0.4))))
        frame.alpha_composite(fade(layer, ease((t - 1.2) / 0.3)))
    return frame


def outro(t, length):
    frame = BG[-1].convert("RGBA")
    for i in range(9):  # coins raining
        x = (i * 131 + 40) % (W - 150)
        y = int(-200 + ((t * 420 + i * 260) % 2300))
        frame.alpha_composite(COIN.rotate(i * 30 + t * 90, resample=Image.BICUBIC), (x, y))
    size = 330
    pulse = 1 + 0.04 * math.sin(t * 6)
    ic = icon(int(size * pulse))
    shadowed(frame, ic, ((W - ic.width) // 2, 360 - ic.height // 2 + 150), blur=26)
    d = ImageDraw.Draw(frame)
    d.text((W / 2, 760), "بازی منچ دوستانه", font=font(116), fill=INK, anchor="mt", stroke_width=4, stroke_fill=INK)
    d.text((W / 2, 752), "بازی منچ دوستانه", font=font(116), fill=GOLD, anchor="mt", stroke_width=4, stroke_fill=INK)
    d.text((W / 2, 940), "رایگان و بدون ثبت‌نام", font=font(58), fill=(255, 244, 223), anchor="mt")
    a = ease((t - 0.4) / 0.5)
    btn = Image.new("RGBA", (860, 210), (0, 0, 0, 0))
    bd = ImageDraw.Draw(btn)
    bd.rounded_rectangle((0, 14, 859, 209), radius=100, fill=INK)
    bd.rounded_rectangle((0, 0, 859, 195), radius=100, fill=(53, 190, 136), outline=INK, width=6)
    bd.text((430, 98), "همین الان نصب کن!", font=font(78), fill=INK, anchor="mm")
    scale = 1 + 0.035 * math.sin(t * 5)
    btn = btn.resize((int(860 * scale), int(210 * scale)), Image.LANCZOS)
    frame.alpha_composite(fade(btn, a), ((W - btn.width) // 2, 1160 + int(60 * (1 - a))))
    return frame


def music(seconds, path):
    sr = 44100
    n = int(seconds * sr)
    out = np.zeros(n)
    bpm = 112
    beat = 60 / bpm
    # I–V–vi–IV in C, a cheerful plucked arpeggio with a soft bass and claps.
    chords = [[60, 64, 67], [55, 59, 62], [57, 60, 64], [53, 57, 60]]
    hz = lambda m: 440 * 2 ** ((m - 69) / 12)

    def pluck(freq, start, dur, amp):
        i0 = int(start * sr)
        k = np.arange(min(int(dur * sr), n - i0))
        if len(k) <= 0:
            return
        env = np.exp(-k / sr * 5.5)
        tone = np.sin(2 * np.pi * freq * k / sr) + 0.35 * np.sin(4 * np.pi * freq * k / sr)
        out[i0:i0 + len(k)] += amp * env * tone

    step = beat / 2
    i = 0
    t = 0.0
    while t < seconds:
        chord = chords[int(t / (beat * 4)) % 4]
        note = chord[[0, 1, 2, 1][i % 4]] + 12
        pluck(hz(note), t, 0.5, 0.18)
        if i % 4 == 0:
            pluck(hz(chord[0] - 12), t, beat * 1.8, 0.22)
        if i % 4 == 2:  # clap: short noise burst
            i0 = int(t * sr)
            k = np.arange(min(int(0.08 * sr), n - i0))
            out[i0:i0 + len(k)] += 0.12 * np.random.default_rng(i).standard_normal(len(k)) * np.exp(-k / sr * 40)
        t += step
        i += 1
    fade_n = int(1.5 * sr)
    out[-fade_n:] *= np.linspace(1, 0, fade_n)
    out[: int(0.05 * sr)] *= np.linspace(0, 1, int(0.05 * sr))
    out = out / max(1e-6, np.abs(out).max()) * 0.7
    data = (out * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(sr)
        w.writeframes(data.tobytes())


def main():
    total = sum(s[1] for s in SCENES)
    audio = OUT.with_suffix(".wav")
    music(total, audio)
    ff = subprocess.Popen(
        ["ffmpeg", "-y", "-loglevel", "error", "-f", "rawvideo", "-pix_fmt", "rgb24",
         "-s", f"{W}x{H}", "-r", str(FPS), "-i", "-", "-i", str(audio),
         "-c:v", "libx264", "-preset", "slow", "-crf", "20", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "128k", "-shortest", "-movflags", "+faststart", str(OUT)],
        stdin=subprocess.PIPE,
    )
    clips = {s[2]: Clip(s[2]) for s in SCENES if s[2]}
    for index, (kind, length, clip, title, small) in enumerate(SCENES):
        for f in range(int(length * FPS)):
            t = f / FPS
            if kind == "intro":
                frame = intro(t, length)
            elif kind == "outro":
                frame = outro(t, length)
            else:
                frame = clip_scene(index, t, length, clips[clip], title, small)
            ff.stdin.write(frame.convert("RGB").tobytes())
        print(kind, clip or "", flush=True)
    ff.stdin.close()
    ff.wait()
    audio.unlink()


if __name__ == "__main__":
    main()
