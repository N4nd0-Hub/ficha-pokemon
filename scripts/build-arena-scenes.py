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
}

SCENES = {
    "standard": scene_standard, "desert": scene_desert, "water": scene_water,
    "night": scene_night, "rain": scene_rain, "forest": scene_forest,
    "sky": scene_sky, "cave": scene_cave, "volcanic": scene_volcanic,
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

LAYERS = {
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
