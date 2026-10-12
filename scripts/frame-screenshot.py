#!/usr/bin/env python3
"""Frames one app screenshot for the App Store: headline, subtitle, gold frame.

Usage: frame-screenshot.py in.png out.png width height title subtitle
"""
import sys
from PIL import Image, ImageDraw, ImageFont

src, out, w, h, title, subtitle = sys.argv[1], sys.argv[2], int(sys.argv[3]), int(sys.argv[4]), sys.argv[5], sys.argv[6]
FONT = "packages/board-geometry/assets/fonts/Samim-Bold.ttf"
canvas = Image.new("RGB", (w, h))
draw = ImageDraw.Draw(canvas)
for y in range(h):  # purple gradient like the app's backdrop
    t = y / h
    draw.line([(0, y), (w, y)], fill=(int(140 - 100 * t), int(80 - 55 * t), int(200 - 120 * t)))
head = int(h * 0.12)
big = ImageFont.truetype(FONT, int(w * 0.075))
small = ImageFont.truetype(FONT, int(w * 0.036))
draw.text((w / 2, head * 0.48), title, font=big, fill=(255, 231, 160), anchor="mm")
draw.text((w / 2, head * 0.92), subtitle, font=small, fill=(255, 244, 223), anchor="mm")
shot = Image.open(src).convert("RGB")
margin = int(w * 0.065)
top = int(head * 1.18)
box_w, box_h = w - 2 * margin, h - top - margin
scale = min(box_w / shot.width, box_h / shot.height)
shot = shot.resize((int(shot.width * scale), int(shot.height * scale)), Image.LANCZOS)
x, y = (w - shot.width) // 2, top
radius = int(w * 0.045)
border = max(6, int(w * 0.007))
draw.rounded_rectangle((x - border, y - border, x + shot.width + border, y + shot.height + border), radius=radius + border, fill=(243, 195, 95))
mask = Image.new("L", shot.size, 0)
ImageDraw.Draw(mask).rounded_rectangle((0, 0, shot.width, shot.height), radius=radius, fill=255)
canvas.paste(shot, (x, y), mask)
canvas.save(out, optimize=True)
