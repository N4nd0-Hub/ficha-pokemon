#!/usr/bin/env python3
"""Gera os cenários de combate em pixel art (estilo das batalhas de DS).

Saída: assets/arenas/<ambiente>.png (cena 320x160) e
       assets/arenas/<ambiente>-platform.png (plataforma 128x40).
O navegador amplia com image-rendering:pixelated.
Rode:  python3 scripts/build-arena-scenes.py
"""
import math, random
from pathlib import Path
from PIL import Image, ImageDraw

W, H = 320, 160
OUT = Path(__file__).resolve().parent.parent / "assets" / "arenas"
OUT.mkdir(parents=True, exist_ok=True)

BAYER = [[0, 8, 2, 10], [12, 4, 14, 6], [3, 11, 1, 9], [15, 7, 13, 5]]

def hexc(h):
    h = h.lstrip("#")
    return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)

def gradient(img, y0, y1, colors, x0=0, x1=None):
    """Degradê vertical em faixas com pontilhado ordenado (dithering)."""
    x1 = W if x1 is None else x1
    px = img.load()
    cols = [hexc(c) for c in colors]
    n = len(cols) - 1
    for y in range(y0, y1):
        t = (y - y0) / max(1, (y1 - y0 - 1)) * n
        i = min(int(t), n - 1)
        f = t - i
        for x in range(x0, x1):
            px[x, y] = cols[i + 1] if f * 16 > BAYER[y % 4][x % 4] else cols[i]

def ridge(img, base, amp, color, seed, freq=1.0, hl=None, rough=0.0, step=1):
    """Silhueta de morros/montanhas preenchida até o fundo."""
    rnd = random.Random(seed)
    ph = [rnd.random() * 6.28 for _ in range(3)]
    d = ImageDraw.Draw(img)
    c = hexc(color)
    tops = []
    for x in range(0, W, step):
        y = base - amp * (0.55 * math.sin(x / 47 * freq + ph[0]) + 0.3 * math.sin(x / 19 * freq + ph[1]) + 0.15 * math.sin(x / 7.3 * freq + ph[2]))
        if rough:
            y += rnd.uniform(-rough, rough)
        y = int(round(y))
        for xx in range(x, min(W, x + step)):
            tops.append(y)
            d.line([(xx, y), (xx, H)], fill=c)
    if hl:
        h = hexc(hl)
        for x, y in enumerate(tops):
            img.putpixel((x, max(0, y)), h)
    return tops

def stripes(img, y0, colors, first=2.0, grow=1.18, y1=H):
    """Faixas horizontais de chão que engrossam em direção à câmera."""
    d = ImageDraw.Draw(img)
    y, h, k = float(y0), first, 0
    while y < y1:
        d.rectangle([0, int(y), W, int(min(y1, y + h))], fill=hexc(colors[k % len(colors)]))
        y += h
        h *= grow
        k += 1

def dots(img, n, area, colors, seed, size=1):
    rnd = random.Random(seed)
    d = ImageDraw.Draw(img)
    x0, y0, x1, y1 = area
    for _ in range(n):
        x, y = rnd.randint(x0, x1), rnd.randint(y0, y1)
        c = hexc(rnd.choice(colors))
        d.rectangle([x, y, x + size - 1, y + size - 1], fill=c)

def cloud(d, x, y, w, c, shade=None):
    r = w // 4
    blobs = [(x, y, r), (x + r, y - r // 2, r + 2), (x + 2 * r, y - r // 3, r + 1), (x + 3 * r, y, r)]
    if shade:
        for bx, by, br in blobs:
            d.ellipse([bx - br, by - br + 2, bx + br, by + br + 2], fill=hexc(shade))
    for bx, by, br in blobs:
        d.ellipse([bx - br, by - br, bx + br, by + br], fill=hexc(c))
    d.rectangle([x, y, x + 3 * r, y + r], fill=hexc(c))

def pine(d, x, base, h, c, hl):
    for i in range(h):
        w = int((i / h) * h * 0.45) + 1
        d.line([(x - w, base - h + i), (x + w, base - h + i)], fill=hexc(c))
    d.line([(x, base - h), (x, base - h + h // 2)], fill=hexc(hl))
    d.rectangle([x - 1, base, x + 1, base + 2], fill=hexc("#3b2a1c"))

def round_tree(d, x, base, r, c, hl, trunk="#4a3524"):
    d.rectangle([x - 1, base - r, x + 1, base], fill=hexc(trunk))
    d.ellipse([x - r, base - 2 * r - r // 2, x + r, base - r // 2], fill=hexc(c))
    d.ellipse([x - r + 2, base - 2 * r - r // 2 + 1, x + r // 3, base - r - r // 3], fill=hexc(hl))

# ---------------------------------------------------------------- cenas
HORIZON = 92

def scene_standard():
    im = Image.new("RGBA", (W, H))
    gradient(im, 0, HORIZON, ["#4f9be8", "#6fb3ef", "#93c9f3", "#bfe0f6", "#e3f2f8"])
    d = ImageDraw.Draw(im)
    for x, y, w in [(26, 22, 44), (150, 14, 36), (238, 30, 52)]:
        cloud(d, x, y, w, "#ffffff", "#d7e9f6")
    ridge(im, 70, 9, "#8fb7c6", 3, hl="#a9cad6")
    ridge(im, 80, 7, "#6c9f6f", 7, freq=1.6, hl="#86b884")
    for x in range(4, W, 11):
        round_tree(d, x + (x * 7) % 5, 90, 5 + (x % 3), "#3f7d48", "#5a9b5a")
    stripes(im, HORIZON, ["#9fd06e", "#8dc35f"], first=2, grow=1.17)
    dots(im, 140, (0, HORIZON + 8, W, H), ["#7fb455", "#b6e084"], 11)
    return im

def scene_desert():
    im = Image.new("RGBA", (W, H))
    gradient(im, 0, HORIZON, ["#5aa6dc", "#86bfe2", "#c4dbe0", "#f2dcae", "#f6c98a"])
    d = ImageDraw.Draw(im)
    d.ellipse([244, 10, 276, 42], fill=hexc("#fff3c4"))
    d.ellipse([248, 14, 272, 38], fill=hexc("#fffbe6"))
    # mesas
    for x0, w, h in [(10, 60, 26), (196, 46, 20), (270, 54, 30)]:
        d.polygon([(x0, HORIZON), (x0 + 8, HORIZON - h), (x0 + w - 8, HORIZON - h), (x0 + w, HORIZON)], fill=hexc("#c27a45"))
        d.line([(x0 + 8, HORIZON - h), (x0 + w - 8, HORIZON - h)], fill=hexc("#e19a5c"))
        d.rectangle([x0 + 9, HORIZON - h + 5, x0 + w - 9, HORIZON - h + 6], fill=hexc("#a8653a"))
    d.rectangle([0, HORIZON - 6, W, H], fill=hexc("#e3b06a"))
    ridge(im, 88, 6, "#e3b06a", 4, freq=0.8, hl="#f1c886")
    stripes(im, HORIZON + 2, ["#ebc07a", "#e2b46c"], first=2, grow=1.16)
    # ondulações
    rnd = random.Random(5)
    for _ in range(26):
        y = rnd.randint(HORIZON + 10, H - 4)
        x = rnd.randint(0, W - 30)
        w = 8 + (y - HORIZON) // 3
        d.arc([x, y, x + w, y + 4], 200, 340, fill=hexc("#c9965a"))
    # cactos
    for x, b in [(40, 124), (292, 112)]:
        d.rectangle([x, b - 22, x + 4, b], fill=hexc("#4f8a46"))
        d.rectangle([x - 6, b - 14, x - 3, b - 6], fill=hexc("#4f8a46"))
        d.rectangle([x - 6, b - 8, x, b - 6], fill=hexc("#4f8a46"))
        d.rectangle([x + 7, b - 18, x + 10, b - 10], fill=hexc("#4f8a46"))
        d.rectangle([x + 4, b - 12, x + 10, b - 10], fill=hexc("#4f8a46"))
        d.line([(x + 1, b - 21), (x + 1, b - 1)], fill=hexc("#78b066"))
    return im

def scene_water():
    im = Image.new("RGBA", (W, H))
    gradient(im, 0, 76, ["#3e8fd8", "#62acea", "#9ccff1", "#d5ecf6"])
    d = ImageDraw.Draw(im)
    for x, y, w in [(40, 26, 40), (200, 18, 56)]:
        cloud(d, x, y, w, "#ffffff", "#cfe3f2")
    # ilhas
    for x0, w, h in [(18, 50, 8), (236, 70, 11)]:
        d.ellipse([x0, 76 - h, x0 + w, 76 + h], fill=hexc("#4f8a5a"))
        d.rectangle([x0, 76, x0 + w, 80], fill=hexc("#3b6f7a"))
        for k in range(3):
            pine(d, x0 + 10 + k * (w // 4), 72, 9 + k % 2 * 3, "#2f6640", "#4c8a58")
    gradient(im, 76, H, ["#7cc6e8", "#4ea6d4", "#2c84bd", "#1d679e", "#16548a"])
    rnd = random.Random(9)
    for y in range(80, H, 3):
        for _ in range(3 + (y - 76) // 12):
            x = rnd.randint(0, W)
            w = 2 + (y - 76) // 10
            d.line([(x, y), (x + w, y)], fill=hexc("#b8e6f6" if rnd.random() < .5 else "#8fd0ee"))
    return im

def scene_night():
    im = Image.new("RGBA", (W, H))
    gradient(im, 0, HORIZON, ["#0b1030", "#141c48", "#22306a", "#34477e", "#4a5a8a"])
    dots(im, 90, (0, 0, W, 70), ["#ffffff", "#c9d6ff", "#fff4c2"], 21)
    d = ImageDraw.Draw(im)
    for x, y in [(40, 16), (120, 8), (300, 30), (180, 40)]:
        d.line([(x - 2, y), (x + 2, y)], fill=hexc("#ffffff"))
        d.line([(x, y - 2), (x, y + 2)], fill=hexc("#ffffff"))
    d.ellipse([238, 12, 266, 40], fill=hexc("#f4f1da"))
    for cx, cy, r in [(246, 22, 3), (256, 30, 2), (252, 18, 1)]:
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=hexc("#d9d4b4"))
    ridge(im, 72, 10, "#2a3a5e", 13, hl="#3d5079")
    ridge(im, 84, 6, "#1d3a33", 17, freq=1.5, hl="#2c5446")
    for x in range(0, W, 9):
        pine(d, x + (x * 5) % 4, 92, 8 + (x * 3) % 6, "#142a26", "#22443a")
    stripes(im, HORIZON, ["#2f5c43", "#284f3a"], first=2, grow=1.17)
    dots(im, 40, (0, HORIZON + 6, W, H), ["#c8f080", "#e8ff9a"], 31)  # vaga-lumes
    return im

def scene_rain():
    im = Image.new("RGBA", (W, H))
    gradient(im, 0, HORIZON, ["#3c4a5a", "#526274", "#6b7c8c", "#8797a2", "#9eadb2"])
    d = ImageDraw.Draw(im)
    for x, y, w in [(-10, 14, 70), (70, 6, 80), (170, 12, 70), (250, 4, 90)]:
        cloud(d, x, y, w, "#5b6878", "#46525f")
    ridge(im, 74, 8, "#62767a", 3, hl="#738a8c")
    ridge(im, 82, 6, "#4a6a52", 7, freq=1.6, hl="#5b7d60")
    for x in range(4, W, 12):
        round_tree(d, x, 90, 5 + (x % 3), "#33573d", "#41694a")
    stripes(im, HORIZON, ["#6f9662", "#628a57"], first=2, grow=1.17)
    rnd = random.Random(4)
    for _ in range(9):  # poças
        y = rnd.randint(HORIZON + 14, H - 8)
        w = 10 + (y - HORIZON) // 2
        x = rnd.randint(0, W - w)
        d.ellipse([x, y, x + w, y + 3 + (y - HORIZON) // 18], fill=hexc("#8fa9b8"))
        d.line([(x + 2, y + 1), (x + w // 2, y + 1)], fill=hexc("#c6d8e2"))
    return im

def scene_forest():
    im = Image.new("RGBA", (W, H))
    gradient(im, 0, HORIZON, ["#264c32", "#2f6040", "#3d754c", "#5a8d5c"])
    d = ImageDraw.Draw(im)
    # raios de luz
    rays = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    rd = ImageDraw.Draw(rays)
    for x in (60, 150, 250):
        rd.polygon([(x, 0), (x + 14, 0), (x + 44, HORIZON), (x + 24, HORIZON)], fill=(214, 240, 170, 40))
    im.alpha_composite(rays)
    d = ImageDraw.Draw(im)
    # troncos ao fundo e à frente
    for x in range(6, W, 26):
        d.rectangle([x, 0, x + 5, HORIZON], fill=hexc("#3c3020"))
        d.line([(x + 1, 0), (x + 1, HORIZON)], fill=hexc("#5a4630"))
    for x in (0, 292):
        d.rectangle([x, 0, x + 18, H], fill=hexc("#2a2016"))
        d.line([(x + 3, 0), (x + 3, H)], fill=hexc("#4a3a26"))
    # copas
    rnd = random.Random(2)
    for _ in range(46):
        x, y, r = rnd.randint(-10, W + 10), rnd.randint(-8, 26), rnd.randint(10, 22)
        d.ellipse([x - r, y - r, x + r, y + r], fill=hexc(rnd.choice(["#1c3d25", "#244a2d", "#2b5734"])))
    for _ in range(30):
        x, y, r = rnd.randint(0, W), rnd.randint(4, 30), rnd.randint(3, 7)
        d.ellipse([x - r, y - r, x + r, y + r], fill=hexc("#3f7a48"))
    # arbustos
    for x in range(-4, W, 14):
        r = 8 + (x * 7) % 5
        d.ellipse([x - r, HORIZON - r, x + r, HORIZON + r // 2], fill=hexc("#2e6238"))
        d.ellipse([x - r + 3, HORIZON - r + 1, x, HORIZON - r // 2], fill=hexc("#3f7d48"))
    stripes(im, HORIZON, ["#5d8a46", "#517d3e"], first=2, grow=1.17)
    dots(im, 70, (20, HORIZON + 6, W - 20, H), ["#8bbf5a", "#e8d36a", "#d97a7a"], 8)
    return im

def scene_sky():
    im = Image.new("RGBA", (W, H))
    gradient(im, 0, H, ["#2f7fd6", "#4f9ae6", "#77b6ee", "#a6d2f4", "#d4ebf9", "#eef8ff"])
    d = ImageDraw.Draw(im)
    for x, y, w in [(20, 30, 40), (130, 18, 30), (250, 36, 46)]:
        cloud(d, x, y, w, "#ffffff", "#d6e8f6")
    # mar de nuvens
    rnd = random.Random(7)
    for row, (y, c, sh) in enumerate([(104, "#e9f3fb", "#c7dcee"), (122, "#f4f9fd", "#d3e3f1"), (142, "#ffffff", "#dde9f4")]):
        for x in range(-20, W + 20, 26 + row * 6):
            r = 14 + row * 4 + rnd.randint(-3, 3)
            d.ellipse([x - r, y - r + 3, x + r, y + r + 3], fill=hexc(sh))
            d.ellipse([x - r, y - r, x + r, y + r], fill=hexc(c))
        d.rectangle([0, y, W, H], fill=hexc(c))
    return im

def scene_cave():
    im = Image.new("RGBA", (W, H))
    gradient(im, 0, HORIZON, ["#0f0d14", "#1c1820", "#2a242c", "#3a3136"])
    d = ImageDraw.Draw(im)
    ridge(im, 70, 12, "#2e2830", 6, freq=1.3, rough=1.2, hl="#40363c")
    ridge(im, 84, 7, "#3a3036", 9, freq=2.0, rough=1.0, hl="#4c4044")
    rnd = random.Random(3)
    for _ in range(22):  # estalactites
        x, h = rnd.randint(0, W), rnd.randint(8, 30)
        d.polygon([(x - 4, 0), (x + 4, 0), (x, h)], fill=hexc("#241f26"))
        d.line([(x - 1, 0), (x - 1, h - 6)], fill=hexc("#3a3238"))
    for _ in range(9):  # cristais
        x, y = rnd.randint(10, W - 10), rnd.randint(62, 90)
        c = rnd.choice(["#6fd8ff", "#b48cff", "#7cf0c0"])
        d.polygon([(x, y - 7), (x + 3, y), (x, y + 2), (x - 3, y)], fill=hexc(c))
        im.putpixel((x, y - 4), hexc("#ffffff"))
    stripes(im, HORIZON, ["#5a4c48", "#4e423f"], first=2, grow=1.17)
    for _ in range(40):
        y = rnd.randint(HORIZON + 6, H - 3)
        x = rnd.randint(0, W)
        s = 1 + (y - HORIZON) // 22
        d.rectangle([x, y, x + s + 1, y + s], fill=hexc("#3c3230"))
        d.line([(x, y), (x + s, y)], fill=hexc("#6c5c56"))
    return im

def scene_volcanic():
    im = Image.new("RGBA", (W, H))
    gradient(im, 0, HORIZON, ["#2a0f12", "#4a1716", "#7a2618", "#b0441c", "#e0742a"])
    d = ImageDraw.Draw(im)
    # vulcão
    d.polygon([(120, HORIZON), (170, 22), (196, 22), (250, HORIZON)], fill=hexc("#3a1a18"))
    d.polygon([(170, 22), (196, 22), (190, 30), (176, 30)], fill=hexc("#ff8a2a"))
    for y in range(30, HORIZON, 2):  # lava escorrendo
        x = 182 + int(6 * math.sin(y / 7))
        d.line([(x, y), (x + 2, y)], fill=hexc("#ff7a1a" if y % 4 else "#ffc040"))
    d.ellipse([160, 2, 206, 24], fill=hexc("#4a2a2a"))
    d.ellipse([150, -8, 190, 12], fill=hexc("#3a2222"))
    ridge(im, 82, 7, "#2a1414", 5, freq=1.6, rough=0.8, hl="#5a2418")
    stripes(im, HORIZON, ["#2c1a18", "#24150f"], first=2, grow=1.17)
    rnd = random.Random(12)
    for _ in range(14):  # rachaduras de lava
        x, y = rnd.randint(0, W - 20), rnd.randint(HORIZON + 8, H - 6)
        pts = [(x, y)]
        for _k in range(4):
            x += rnd.randint(3, 8) + (y - HORIZON) // 12
            y += rnd.randint(-2, 2)
            pts.append((x, y))
        d.line(pts, fill=hexc("#ff6a1a"), width=1 + (y - HORIZON) // 30)
    dots(im, 50, (0, 0, W, HORIZON), ["#ffb040", "#ff7a2a"], 14)
    return im


def column(d, x, top, base, w, light="#f4efe2", mid="#ddd5c2", dark="#b8ad94", broken=False):
    """Coluna grega com caneluras, capitel e base."""
    d.rectangle([x - 1, base - 3, x + w + 1, base], fill=hexc(dark))
    d.rectangle([x - 1, base - 4, x + w + 1, base - 4], fill=hexc(light))
    d.rectangle([x, top + 3, x + w, base - 4], fill=hexc(mid))
    for k in range(x + 1, x + w, 3):
        d.line([(k, top + 4), (k, base - 5)], fill=hexc(dark))
    d.line([(x, top + 3), (x, base - 5)], fill=hexc(light))
    if broken:
        d.polygon([(x, top + 3), (x + w // 2, top), (x + w, top + 5), (x + w, top + 3)], fill=hexc(mid))
        return
    d.rectangle([x - 2, top, x + w + 2, top + 2], fill=hexc(light))
    d.rectangle([x - 2, top + 2, x + w + 2, top + 2], fill=hexc(dark))

def scene_temple():
    im = Image.new("RGBA", (W, H))
    gradient(im, 0, HORIZON, ["#6b8fd8", "#93acdf", "#c9c3d8", "#f2d3b0", "#ffe2b0"])
    d = ImageDraw.Draw(im)
    d.ellipse([136, 6, 184, 54], fill=hexc("#fff4d6"))
    rays = Image.new("RGBA", (W, H), (0, 0, 0, 0)); rd = ImageDraw.Draw(rays)
    for a in range(0, 360, 24):
        r = math.radians(a)
        rd.polygon([(160, 30), (160 + 220 * math.cos(r), 30 + 220 * math.sin(r)), (160 + 220 * math.cos(r + .12), 30 + 220 * math.sin(r + .12))], fill=(255, 240, 200, 26))
    im.alpha_composite(rays); d = ImageDraw.Draw(im)
    for x, y, w in [(14, 30, 40), (250, 22, 46)]:
        cloud(d, x, y, w, "#fff6ea", "#ead8c6")
    ridge(im, 78, 8, "#a8a4b8", 3, hl="#bdb8c9")
    ridge(im, 86, 5, "#8aa070", 9, freq=1.5, hl="#a2b886")
    # templo ao fundo
    tx0, tx1, tb = 92, 228, 88
    d.rectangle([tx0 - 6, tb, tx1 + 6, tb + 2], fill=hexc("#cfc6b0"))
    d.rectangle([tx0 - 3, tb - 2, tx1 + 3, tb], fill=hexc("#e8e1d0"))
    d.rectangle([tx0, tb - 4, tx1, tb - 2], fill=hexc("#f4efe2"))
    for i in range(8):
        column(d, tx0 + 3 + i * 17, 44, tb - 4, 7)
    d.rectangle([tx0 - 2, 38, tx1 + 2, 43], fill=hexc("#ece5d4"))
    for k in range(tx0, tx1, 6):
        d.rectangle([k, 39, k + 2, 41], fill=hexc("#c9a23a"))
    d.rectangle([tx0 - 4, 36, tx1 + 4, 37], fill=hexc("#d8cfba"))
    d.polygon([(tx0 - 4, 36), (160, 18), (tx1 + 4, 36)], fill=hexc("#f4efe2"))
    d.polygon([(tx0 + 8, 34), (160, 22), (tx1 - 8, 34)], fill=hexc("#ddd5c2"))
    d.line([(tx0 - 4, 36), (160, 18), (tx1 + 4, 36)], fill=hexc("#fffaf0"))
    d.ellipse([154, 26, 166, 33], fill=hexc("#c9a23a"))
    # colunas quebradas nas laterais
    for x, top, w in [(14, 56, 9), (36, 68, 8), (276, 50, 10), (300, 64, 9)]:
        column(d, x, top, 96, w, broken=(x in (36, 300)))
    # piso de mármore em perspectiva
    stripes(im, HORIZON, ["#efe8d8", "#e2d8c2"], first=2, grow=1.18)
    vx, vy = 160, 40
    for k in range(-12, 13):
        xb = 160 + k * 34
        x0 = vx + (xb - vx) * (HORIZON - vy) / (H - vy)
        d.line([(int(x0), HORIZON), (xb, H)], fill=hexc("#cbbd9e"))
    dots(im, 40, (0, HORIZON + 6, W, H), ["#d8c7a0", "#f7f1e2"], 23)
    for x in (60, 250):  # vasos
        d.ellipse([x - 5, 112, x + 5, 124], fill=hexc("#b8582c"))
        d.rectangle([x - 3, 108, x + 3, 112], fill=hexc("#b8582c"))
        d.line([(x - 4, 117), (x + 4, 117)], fill=hexc("#2a1a10"))
        d.line([(x - 2, 113), (x - 2, 121)], fill=hexc("#e08050"))
    return im

def scene_city():
    im = Image.new("RGBA", (W, H))
    gradient(im, 0, 96, ["#1a1838", "#3a2a5a", "#7a3c6a", "#d0607a", "#f59a7a", "#3a2a4a"])
    d = ImageDraw.Draw(im)
    # prédios no fim do beco
    rnd = random.Random(8)
    x = 96
    while x < 224:
        w, h = rnd.randint(12, 22), rnd.randint(30, 62)
        d.rectangle([x, 86 - h, x + w, 86], fill=hexc(rnd.choice(["#2a2540", "#322a4a", "#251f38"])))
        for wy in range(86 - h + 4, 84, 5):
            for wx in range(x + 2, x + w - 2, 4):
                if rnd.random() < .45:
                    d.rectangle([wx, wy, wx + 1, wy + 2], fill=hexc(rnd.choice(["#ffd27a", "#ffe9a8", "#9ee0ff"])))
        x += w + 1
    # paredes do beco em perspectiva
    def wall(xa, xb, side):
        top_far, top_near = 10, -40
        poly = [(xa, top_far), (xb, top_near), (xb, H), (xa, 96)]
        d.polygon(poly, fill=hexc("#5a2f2a" if side == "l" else "#4e2a28"))
        for i in range(0, 40):  # tijolos
            t = i / 40
            y = int(top_far + (H - top_far) * t)
            for k in range(0, 8):
                f = k / 8
                xx = int(xa + (xb - xa) * f)
                yy = int(y + (top_near - top_far) * f * (1 - t))
                d.point((xx + (i % 2) * 3, yy), fill=hexc("#7a443a"))
        d.line([(xa, top_far), (xa, 96)], fill=hexc("#2a1614"))
    wall(96, 0, "l")
    wall(224, W, "r")
    # janelas e escada de incêndio
    for (x0, y0, x1, y1, lit) in [(20, 30, 40, 52, True), (52, 40, 66, 58, False), (262, 34, 284, 56, True), (240, 44, 254, 60, False)]:
        d.rectangle([x0, y0, x1, y1], fill=hexc("#ffd88a" if lit else "#241c2a"))
        d.rectangle([x0, y0, x1, y1], outline=hexc("#2a1614"))
        d.line([((x0 + x1) // 2, y0), ((x0 + x1) // 2, y1)], fill=hexc("#2a1614"))
    for y in (64, 88):
        d.line([(232, y), (300, y - 10)], fill=hexc("#1a1a22"), width=2)
        for k in range(232, 300, 6):
            d.line([(k, y - (k - 232) * 10 // 68), (k, y - 8 - (k - 232) * 10 // 68)], fill=hexc("#1a1a22"))
    # letreiro neon
    d.rectangle([58, 64, 86, 76], fill=hexc("#1a1020"), outline=hexc("#ff4fa8"))
    d.text((61, 65), "BAR", fill=hexc("#ff7ac0"))
    # canos
    d.rectangle([4, 0, 7, H], fill=hexc("#3a3a44")); d.line([(5, 0), (5, H)], fill=hexc("#6a6a78"))
    d.rectangle([308, 0, 311, H], fill=hexc("#3a3a44"))
    # chão de asfalto
    stripes(im, 96, ["#3a3844", "#34323e"], first=2, grow=1.16)
    d.polygon([(150, 96), (170, 96), (176, H), (144, H)], fill=hexc("#2e2c36"))
    for y in range(100, H, 10):
        d.line([(160, y), (160, y + 4)], fill=hexc("#c8b860"))
    # lixeiras e caixa
    for x, b in [(18, 132), (40, 124)]:
        d.rectangle([x, b - 16, x + 14, b], fill=hexc("#5a6470"))
        d.rectangle([x - 1, b - 18, x + 15, b - 16], fill=hexc("#7a8490"))
        for k in range(x + 3, x + 13, 4):
            d.line([(k, b - 14), (k, b - 2)], fill=hexc("#47505a"))
    d.rectangle([268, 112, 312, 136], fill=hexc("#2f5a48")); d.rectangle([266, 108, 314, 112], fill=hexc("#3f7a60"))
    d.rectangle([240, 126, 258, 138], fill=hexc("#a8784a")); d.line([(240, 132), (258, 132)], fill=hexc("#7a5434"))
    # poças refletindo o neon
    for x, y, w in [(70, 138, 30), (196, 130, 22), (110, 150, 26)]:
        d.ellipse([x, y, x + w, y + 4], fill=hexc("#5a4a7a"))
        d.line([(x + 4, y + 2), (x + w // 2, y + 2)], fill=hexc("#ff7ac0"))
    dots(im, 50, (0, 100, W, H), ["#4a4856", "#2a2832"], 41)
    return im

def scene_mountain():
    im = Image.new("RGBA", (W, H))
    gradient(im, 0, 112, ["#1e4fa8", "#3a74c8", "#6a9fe0", "#a8cdf2", "#e6f3fc"])
    d = ImageDraw.Draw(im)
    d.ellipse([256, 8, 284, 36], fill=hexc("#fffbe8"))
    # picos nevados distantes
    for cx, h, w, c in [(40, 40, 50, "#8aa0c8"), (120, 30, 40, "#9aaed2"), (210, 46, 56, "#7f96c2"), (300, 34, 44, "#9aaed2")]:
        d.polygon([(cx - w, 80), (cx, 80 - h), (cx + w, 80)], fill=hexc(c))
        d.polygon([(cx - w // 4, 80 - h * 3 // 4), (cx, 80 - h), (cx + w // 4, 80 - h * 3 // 4), (cx + 4, 80 - h * 2 // 3), (cx - 3, 80 - h * 5 // 7)], fill=hexc("#f4f8ff"))
    # mar de nuvens
    rnd = random.Random(17)
    for row, (y, c, sh) in enumerate([(78, "#eef5fc", "#cddff0"), (88, "#ffffff", "#dbe7f3")]):
        for x in range(-10, W + 20, 20 + row * 6):
            r = 10 + row * 3 + rnd.randint(-2, 3)
            d.ellipse([x - r, y - r + 2, x + r, y + r + 2], fill=hexc(sh))
            d.ellipse([x - r, y - r, x + r, y + r], fill=hexc(c))
        d.rectangle([0, y, W, y + 14], fill=hexc(c))
    # cume rochoso em primeiro plano
    d.polygon([(0, 104), (30, 96), (70, 100), (120, 94), (200, 96), (250, 92), (290, 98), (W, 94), (W, H), (0, H)], fill=hexc("#6a6470"))
    stripes(im, 104, ["#e9eff7", "#dfe7f2"], first=2, grow=1.17)
    for x, y, w, h in [(0, 98, 40, 30), (276, 94, 44, 34), (70, 140, 30, 20), (230, 136, 26, 24)]:
        d.polygon([(x, y + h), (x + w // 3, y), (x + w, y + h // 3), (x + w, y + h)], fill=hexc("#5a5462"))
        d.line([(x + w // 3, y), (x + w, y + h // 3)], fill=hexc("#8a8494"))
        d.polygon([(x + w // 3 - 4, y + 4), (x + w // 3, y), (x + w // 3 + 8, y + 3)], fill=hexc("#ffffff"))
    # marco do cume
    d.line([(296, 94), (296, 70)], fill=hexc("#5a3a20"), width=2)
    d.polygon([(298, 70), (314, 74), (298, 78)], fill=hexc("#e0393e"))
    dots(im, 60, (0, 106, W, H), ["#c9d6e6", "#ffffff"], 19)
    return im

def scene_ocean():
    im = Image.new("RGBA", (W, H))
    gradient(im, 0, H, ["#2fa6c8", "#1f86b0", "#166a98", "#11527e", "#0c3d62", "#0a3254"])
    d = ImageDraw.Draw(im)
    # raios de luz vindos da superfície
    rays = Image.new("RGBA", (W, H), (0, 0, 0, 0)); rd = ImageDraw.Draw(rays)
    for x in (30, 110, 190, 260):
        rd.polygon([(x, 0), (x + 18, 0), (x + 50, H), (x + 22, H)], fill=(190, 240, 255, 30))
    im.alpha_composite(rays); d = ImageDraw.Draw(im)
    for y in range(2, 10, 3):  # ondulação da superfície
        for x in range(0, W, 12):
            d.line([(x + (y * 3) % 12, y), (x + (y * 3) % 12 + 5, y)], fill=hexc("#7fd6ec"))
    # rochas ao fundo
    ridge(im, 92, 10, "#0e4a6a", 21, freq=1.4, rough=1.0, hl="#16607e")
    # navio pirata naufragado
    sh = Image.new("RGBA", (W, H), (0, 0, 0, 0)); sd = ImageDraw.Draw(sh)
    hull = [(150, 70), (270, 58), (284, 66), (268, 96), (172, 100), (150, 86)]
    sd.polygon(hull, fill=hexc("#3c2a22"))
    for k in range(0, 6):
        y0 = 72 + k * 5
        sd.line([(154, y0 + (k > 2) * 2), (276 - k * 2, y0 - 10 + k)], fill=hexc("#2a1c16"))
    sd.line([(150, 70), (270, 58)], fill=hexc("#5a4030"), width=2)
    for x in (184, 214, 244):  # escotilhas
        sd.ellipse([x, 76, x + 7, 82], fill=hexc("#0c2a3a"), outline=hexc("#8a7040"))
    sd.polygon([(256, 95), (264, 84), (272, 90), (266, 98)], fill=hexc("#0c2a3a"))  # rombo
    sd.line([(200, 64), (176, 14)], fill=hexc("#4a3428"), width=3)  # mastro inclinado
    sd.line([(186, 34), (150, 26)], fill=hexc("#4a3428"), width=2)
    sd.polygon([(182, 26), (152, 22), (146, 44), (160, 52), (178, 46)], fill=hexc("#b8b096"))
    sd.polygon([(160, 30), (164, 44), (170, 34)], fill=hexc("#11527e"))  # rasgo na vela
    sd.line([(238, 60), (232, 30)], fill=hexc("#4a3428"), width=2)
    sd.polygon([(233, 32), (250, 30), (248, 40), (236, 40)], fill=hexc("#1a1a1a"))  # bandeira
    sd.ellipse([239, 33, 244, 37], fill=hexc("#e8e2d0"))
    sh = Image.blend(Image.new("RGBA", (W, H), (0, 0, 0, 0)), sh, 1)
    tint = Image.new("RGBA", (W, H), hexc("#11527e")[:3] + (0,))
    sh_px = sh.load(); im_px = im.load()
    for yy in range(H):
        for xx in range(W):
            r, g, b, a = sh_px[xx, yy]
            if a:
                br, bg, bb, _ = im_px[xx, yy]
                im_px[xx, yy] = (int(r * .72 + br * .28), int(g * .72 + bg * .28), int(b * .72 + bb * .28), 255)
    d = ImageDraw.Draw(im)
    # areia
    d.polygon([(0, 100), (60, 94), (140, 100), (220, 96), (W, 100), (W, H), (0, H)], fill=hexc("#c8b27a"))
    stripes(im, 104, ["#d8c48a", "#ccb67c"], first=2, grow=1.16)
    rnd = random.Random(31)
    # algas
    for x in [6, 14, 26, 96, 128, 292, 304, 312]:
        h = rnd.randint(30, 62)
        base = 108 + rnd.randint(-4, 6)
        for y in range(base - h, base):
            xx = x + int(3 * math.sin((y + x) / 6))
            d.line([(xx, y), (xx + 2, y)], fill=hexc("#2f8a4a" if (y // 4) % 2 else "#3fa85a"))
    # corais
    for x, b, c in [(44, 118, "#ff7a6a"), (66, 122, "#ff9ad0"), (270, 120, "#ffb44a"), (250, 128, "#ff7a6a")]:
        for k in range(-2, 3):
            d.line([(x, b), (x + k * 4, b - 10 - abs(k) * -2)], fill=hexc(c), width=2)
            d.ellipse([x + k * 4 - 2, b - 13 + abs(k) * 2, x + k * 4 + 2, b - 9 + abs(k) * 2], fill=hexc(c))
    # baú do tesouro
    d.rectangle([210, 112, 228, 124], fill=hexc("#7a4a24")); d.rectangle([210, 108, 228, 112], fill=hexc("#8a5a2c"))
    d.rectangle([210, 112, 228, 113], fill=hexc("#e0b040")); d.rectangle([218, 113, 220, 117], fill=hexc("#e0b040"))
    dots(im, 8, (204, 122, 236, 126), ["#ffd84a", "#fff2a0"], 5)
    # pedras e conchas
    for x, y in [(90, 136), (150, 146), (300, 140), (20, 150)]:
        d.ellipse([x, y, x + 12, y + 6], fill=hexc("#8a7a5a")); d.line([(x + 2, y + 1), (x + 7, y + 1)], fill=hexc("#b0a07a"))
    for x, y in [(120, 126), (180, 140), (240, 150)]:
        d.pieslice([x, y, x + 6, y + 6], 180, 360, fill=hexc("#f4d8c8"))
    dots(im, 70, (0, 106, W, H), ["#b8a26a", "#e8d8a0"], 13)
    return im

# ---------------------------------------------------------------- plataformas
PW, PH = 128, 40

def platform(top, rim, side, ring=None, extra=None):
    im = Image.new("RGBA", (PW, PH), (0, 0, 0, 0))
    d = ImageDraw.Draw(im)
    d.ellipse([2, 10, PW - 3, PH - 2], fill=(0, 0, 0, 70))          # sombra
    d.ellipse([4, 6, PW - 5, PH - 6], fill=hexc(side))               # lateral
    d.ellipse([4, 2, PW - 5, PH - 10], fill=hexc(rim))               # borda
    d.ellipse([8, 4, PW - 9, PH - 12], fill=hexc(top))               # topo
    if ring:
        d.ellipse([28, 9, PW - 29, PH - 17], outline=hexc(ring))
        d.ellipse([46, 13, PW - 47, PH - 21], outline=hexc(ring))
    d.arc([10, 4, PW - 11, PH - 12], 190, 260, fill=(255, 255, 255, 120))
    if extra:
        extra(d)
    return im

PLATFORMS = {
    "standard": dict(top="#a6d878", rim="#7fb658", side="#5f8a3e", ring="#93c86a"),
    "desert": dict(top="#f0cc8a", rim="#d8ab64", side="#a87a40", ring="#e2bb78"),
    "water": dict(top="#9ed8ec", rim="#d8f3fb", side="#2f86b8", ring="#c4ecf8"),
    "night": dict(top="#4c7e5a", rim="#3a684a", side="#244634", ring="#5a8e68"),
    "rain": dict(top="#7fa86e", rim="#5f8a54", side="#43633c", ring="#9cbcb2"),
    "forest": dict(top="#7a6440", rim="#5f4e30", side="#3e3220", ring="#8f7a50"),
    "sky": dict(top="#ffffff", rim="#e6f1fa", side="#bcd4ea", ring="#dbe9f6"),
    "cave": dict(top="#7a6a62", rim="#5e504a", side="#3a302c", ring="#8c7c72"),
    "volcanic": dict(top="#3e2622", rim="#2c1a16", side="#1a0e0c", ring="#ff6a1a"),
    "temple": dict(top="#f4efe2", rim="#ddd3bc", side="#a89a7a", ring="#c9a23a"),
    "city": dict(top="#4a4856", rim="#36343f", side="#22212a", ring="#e8d060"),
    "mountain": dict(top="#f2f6fb", rim="#c8d4e2", side="#6a6470", ring="#dfe8f2"),
    "ocean": dict(top="#d8c48a", rim="#bea86e", side="#7a6a44", ring="#e8d8a6"),
}

SCENES = {
    "standard": scene_standard, "desert": scene_desert, "water": scene_water,
    "night": scene_night, "rain": scene_rain, "forest": scene_forest,
    "sky": scene_sky, "cave": scene_cave, "volcanic": scene_volcanic,
    "temple": scene_temple, "city": scene_city, "mountain": scene_mountain, "ocean": scene_ocean,
}

# ---------------------------------------------------------------- camadas animadas
def layer_clouds():
    im = Image.new("RGBA", (320, 60), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for x, y, w in [(10, 30, 30), (120, 18, 22), (210, 36, 34)]:
        cloud(d, x, y, w, "#ffffff", "#dce9f5")
    return im

def layer_points(colors, n, seed, size=(160, 80), cross=False):
    im = Image.new("RGBA", size, (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    rnd = random.Random(seed)
    for _ in range(n):
        x, y = rnd.randint(1, size[0] - 2), rnd.randint(1, size[1] - 2)
        c = hexc(rnd.choice(colors))
        im.putpixel((x, y), c)
        if cross:
            for dx, dy in ((1, 0), (-1, 0), (0, 1), (0, -1)):
                im.putpixel((x + dx, y + dy), c[:3] + (150,))
    return im

def layer_leaves():
    im = Image.new("RGBA", (160, 120), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    rnd = random.Random(5)
    for _ in range(9):
        x, y = rnd.randint(2, 150), rnd.randint(2, 110)
        c = hexc(rnd.choice(["#6fae4a", "#9cc85a", "#d8b44a"]))
        d.rectangle([x, y, x + 2, y + 1], fill=c)
        im.putpixel((x + 1, y + 2), c)
    return im

def layer_bubbles():
    im = Image.new("RGBA", (160, 160), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    rnd = random.Random(9)
    for _ in range(14):
        x, y, r = rnd.randint(3, 154), rnd.randint(3, 154), rnd.choice([1, 1, 2, 2, 3])
        d.ellipse([x - r, y - r, x + r, y + r], outline=(220, 248, 255, 200))
        im.putpixel((x - max(0, r - 1), y - max(0, r - 1)), (255, 255, 255, 255))
    return im

def layer_fish():
    im = Image.new("RGBA", (320, 80), (0, 0, 0, 0)); d = ImageDraw.Draw(im)
    for x, y, c in [(30, 20, "#ffd84a"), (40, 26, "#ffd84a"), (36, 32, "#ffd84a"), (190, 46, "#ff8a5a"), (200, 52, "#ff8a5a"), (260, 14, "#9fe8ff")]:
        d.ellipse([x, y, x + 6, y + 3], fill=hexc(c))
        d.polygon([(x - 3, y - 1), (x, y + 1), (x - 3, y + 4)], fill=hexc(c))
        im.putpixel((x + 4, y + 1), hexc("#1a1a1a"))
    return im

LAYERS = {
    "fx-bubbles": layer_bubbles,
    "fx-fish": layer_fish,
    "fx-snow": lambda: layer_points(["#ffffff", "#eaf4ff"], 30, 7, size=(160, 120), cross=True),
    "fx-clouds": layer_clouds,
    "fx-sparkle": lambda: layer_points(["#ffffff", "#d8f6ff"], 22, 1, cross=True),
    "fx-stars": lambda: layer_points(["#ffffff", "#fff2b0", "#c8d8ff"], 26, 2, cross=True),
    "fx-embers": lambda: layer_points(["#ffb040", "#ff7a2a", "#ffe08a"], 22, 3, size=(160, 120)),
    "fx-dust": lambda: layer_points(["#f6dca0", "#e8c286"], 18, 4, size=(160, 120)),
    "fx-glint": lambda: layer_points(["#9fe8ff", "#d0b4ff", "#a8ffd8"], 12, 6, cross=True),
    "fx-leaves": layer_leaves,
}

if __name__ == "__main__":
    for name, fn in LAYERS.items():
        fn().save(OUT / f"{name}.png", optimize=True)
    for name, fn in SCENES.items():
        scene = fn()
        assert scene.getchannel("A").getextrema()[0] == 255, f"{name}: há pixels transparentes"
        scene.convert("RGB").save(OUT / f"{name}.png", optimize=True)
        platform(**PLATFORMS[name]).save(OUT / f"{name}-platform.png", optimize=True)
        print(name)
