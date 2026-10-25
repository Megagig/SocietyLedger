"""SocietyLedger brand kit v5 — approved reference S (blue/green) + ledger card."""
import os, io, json, shutil
import cairosvg
from PIL import Image
from fontTools.ttLib import TTFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
import mark_v5 as M
from mark_v5 import render_mark, BLUE, GREEN

OUT = "SocietyLedger-brand"
shutil.rmtree(OUT, ignore_errors=True)
for d in ["master", "app", "favicon", "in-app", "social", "src"]:
    os.makedirs(f"{OUT}/{d}")

SLATE = "#0F172A"
WORD_BLUE = "#0B3FB0"
GREEN_LIGHT = "#34D399"
BOLD = "/usr/share/fonts/truetype/google-fonts/Poppins-Bold.ttf"
MED = "/usr/share/fonts/truetype/google-fonts/Poppins-Medium.ttf"
SS = 4  # supersampling factor for crisp edges


def save(im, path):
    im.save(f"{OUT}/{path}", optimize=True)


def sharp(fn, px, *a, **k):
    """Render at SS× then downsample."""
    big = fn(px * SS, *a, **k)
    return big.resize((px, big.height * px // big.width), Image.LANCZOS)


def opaque(im, col=SLATE):
    o = Image.new("RGB", im.size, col)
    o.paste(im, (0, 0), im)
    return o


def svg_img(body, w, h):
    return Image.open(io.BytesIO(cairosvg.svg2png(
        bytestring=f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 {w} {h}">{body}</svg>'.encode(),
        output_width=w, output_height=h))).convert("RGBA")


# ---------- backgrounds ----------
def gradient(w, h, radius=0):
    return svg_img(
        f'<defs><linearGradient id="g" x1="0" y1="0" x2="{w}" y2="{h}" gradientUnits="userSpaceOnUse">'
        f'<stop offset="0" stop-color="{BLUE}"/><stop offset="0.55" stop-color="#0A93C9"/><stop offset="1" stop-color="{GREEN}"/></linearGradient>'
        f'<radialGradient id="hl" cx="0.22" cy="0.12" r="0.85"><stop offset="0" stop-color="#fff" stop-opacity="0.20"/>'
        f'<stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>'
        f'<rect width="{w}" height="{h}" rx="{radius}" fill="url(#g)"/><rect width="{w}" height="{h}" rx="{radius}" fill="url(#hl)"/>', w, h)


def slate(w, h, radius=0):
    return svg_img(
        f'<defs><linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#16213A"/>'
        f'<stop offset="1" stop-color="{SLATE}"/></linearGradient>'
        f'<radialGradient id="b" cx="0.30" cy="0.35" r="0.55"><stop offset="0" stop-color="{BLUE}" stop-opacity="0.22"/>'
        f'<stop offset="1" stop-color="{BLUE}" stop-opacity="0"/></radialGradient>'
        f'<radialGradient id="gr" cx="0.70" cy="0.65" r="0.55"><stop offset="0" stop-color="{GREEN}" stop-opacity="0.18"/>'
        f'<stop offset="1" stop-color="{GREEN}" stop-opacity="0"/></radialGradient></defs>'
        f'<rect width="{w}" height="{h}" rx="{radius}" fill="url(#s)"/><rect width="{w}" height="{h}" rx="{radius}" fill="url(#b)"/>'
        f'<rect width="{w}" height="{h}" rx="{radius}" fill="url(#gr)"/>', w, h)


def icon_tile(size, scale=0.80, radius_frac=0.0, detail=2):
    bg = gradient(size, size, int(size * radius_frac))
    bg.alpha_composite(render_mark(size, scale, mono="#FFFFFF", detail=detail))
    return bg


def color_mark(size, scale=0.92, detail=2):
    return render_mark(size, scale, detail=detail)


def mono_mark(size, scale=0.92, col="#FFFFFF", detail=2):
    return render_mark(size, scale, mono=col, detail=detail)


# ---------- text ----------
def text_svg(txt, font_path, size, fill, tracking=0.0, colors=None):
    font = TTFont(font_path)
    gs, cmap = font.getGlyphSet(), font.getBestCmap()
    k = size / font["head"].unitsPerEm
    out, cx = [], 0
    for i, ch in enumerate(txt):
        gl = cmap[ord(ch)]
        pen = SVGPathPen(gs)
        gs[gl].draw(TransformPen(pen, (k, 0, 0, -k, cx, 0)))
        out.append(f'<path d="{pen.getCommands()}" fill="{colors[i] if colors else fill}"/>')
        cx += gs[gl].width * k + tracking
    return "".join(out), cx - tracking


def wordmark(size, dark):
    a, wa = text_svg("Society", BOLD, size, "#FFFFFF" if dark else WORD_BLUE, -size * 0.01)
    b, wb = text_svg("Ledger", BOLD, size, GREEN_LIGHT if dark else GREEN, -size * 0.01)
    return f'<g>{a}</g><g transform="translate({wa} 0)">{b}</g>', wa + wb


def tagline(size, dark):
    t = "PEOPLE  •  RECORDS  •  PROGRESS"
    base = "#CBD5E1" if dark else WORD_BLUE
    dot = GREEN_LIGHT if dark else GREEN
    return text_svg(t, MED, size, base, size * 0.32, [dot if c == "•" else base for c in t])


def lockup_vertical(Wd, dark=False, white_mark=False):
    im = Image.new("RGBA", (Wd, Wd), (0, 0, 0, 0))
    mw = int(Wd * 0.62)
    mk = mono_mark(mw, 0.96) if white_mark else color_mark(mw, 0.96)
    im.alpha_composite(mk, ((Wd - mw) // 2, int(Wd * 0.05)))
    fs = Wd * 0.112
    wm, ww = wordmark(fs, dark)
    tg, tw = tagline(fs * 0.29, dark)
    im.alpha_composite(svg_img(f'<g transform="translate({(Wd-ww)/2} {Wd*0.80})">{wm}</g>'
                               f'<g transform="translate({(Wd-tw)/2} {Wd*0.89})">{tg}</g>', Wd, Wd))
    return im


def lockup_horizontal(H, dark=False, tag=True):
    fs = H * 0.40
    wm, ww = wordmark(fs, dark)
    tg, tw = tagline(fs * 0.25, dark)
    gap = H * 0.10
    Wd = int(H + gap + max(ww, tw if tag else 0) + H * 0.05)
    im = Image.new("RGBA", (Wd, H), (0, 0, 0, 0))
    im.alpha_composite(color_mark(H, 0.98))
    x = H + gap
    body = (f'<g transform="translate({x} {H*0.56})">{wm}</g><g transform="translate({x+fs*0.03} {H*0.77})">{tg}</g>'
            if tag else f'<g transform="translate({x} {H*0.65})">{wm}</g>')
    im.alpha_composite(svg_img(body, Wd, H))
    return im


def hsharp(fn, h, *a):
    big = fn(h * 2, *a)
    return big.resize((big.width // 2, h), Image.LANCZOS)


# ======================= MASTER =======================
save(sharp(color_mark, 1024, 0.86), "master/logo-master-1024.png")
save(color_mark(4096, 0.86).resize((2048, 2048), Image.LANCZOS), "master/logo-master-2048.png")
save(opaque(sharp(icon_tile, 1024, 0.80)), "master/logo-master-tile-1024.png")
save(sharp(icon_tile, 1024, 0.80, 0.225), "master/logo-master-tile-rounded-1024.png")
d = slate(1024, 1024); d.alpha_composite(sharp(color_mark, 1024, 0.80)); save(opaque(d), "master/logo-master-on-slate-1024.png")
save(hsharp(lockup_vertical, 1200), "master/logo-vertical-light.png")
save(hsharp(lockup_vertical, 1200, True), "master/logo-vertical-dark.png")
save(hsharp(lockup_horizontal, 320), "master/logo-horizontal-light.png")
save(hsharp(lockup_horizontal, 320, True), "master/logo-horizontal-dark.png")
save(hsharp(lockup_horizontal, 320, False, False), "master/logo-horizontal-light-notag.png")
save(hsharp(lockup_horizontal, 320, True, False), "master/logo-horizontal-dark-notag.png")
save(sharp(mono_mark, 1024, 0.86, "#0F172A"), "master/logo-mono-black-1024.png")
save(sharp(mono_mark, 1024, 0.86, "#FFFFFF"), "master/logo-mono-white-1024.png")

# ======================= APP (Expo) =======================
save(opaque(sharp(icon_tile, 1024, 0.80)), "app/icon.png")
save(sharp(mono_mark, 1024, 0.56), "app/adaptive-icon-foreground.png")
save(opaque(gradient(1024, 1024)), "app/adaptive-icon-background.png")
save(sharp(mono_mark, 1024, 0.56), "app/adaptive-icon-monochrome.png")
save(hsharp(lockup_vertical, 1024, True), "app/splash-icon.png")          # on #0F172A
save(hsharp(lockup_vertical, 1024), "app/splash-icon-light.png")          # on #FFFFFF
sw, sh = 1284, 2778
full = slate(sw, sh)
full.alpha_composite(hsharp(lockup_vertical, 960, True), ((sw - 960) // 2, (sh - 960) // 2 - 40))
save(opaque(full), "app/splash-full-1284x2778.png")

# ======================= FAVICON / PWA =======================
for sz in (16, 32, 48, 96):
    det = 1 if sz <= 32 else 2
    save(icon_tile(512, 0.88 if sz <= 32 else 0.82, 0.22, det).resize((sz, sz), Image.LANCZOS),
         f"favicon/favicon-{sz}x{sz}.png")
ico = [Image.open(f"{OUT}/favicon/favicon-{s}x{s}.png") for s in (16, 32, 48)]
ico[2].save(f"{OUT}/favicon/favicon.ico", sizes=[(16, 16), (32, 32), (48, 48)], append_images=ico[:2])
save(opaque(sharp(icon_tile, 180, 0.80)), "favicon/apple-touch-icon.png")
for sz in (192, 512):
    save(opaque(sharp(icon_tile, sz, 0.80)), f"favicon/icon-{sz}.png")
    save(opaque(sharp(icon_tile, sz, 0.60)), f"favicon/icon-maskable-{sz}.png")
json.dump({"name": "SocietyLedger", "short_name": "SocietyLedger",
           "icons": [{"src": "/icon-192.png", "sizes": "192x192", "type": "image/png"},
                     {"src": "/icon-512.png", "sizes": "512x512", "type": "image/png"},
                     {"src": "/icon-maskable-192.png", "sizes": "192x192", "type": "image/png", "purpose": "maskable"},
                     {"src": "/icon-maskable-512.png", "sizes": "512x512", "type": "image/png", "purpose": "maskable"}],
           "theme_color": SLATE, "background_color": SLATE, "display": "standalone"},
          open(f"{OUT}/favicon/site.webmanifest", "w"), indent=2)

# ======================= IN-APP =======================
for sz in (24, 32, 48, 64, 96, 128):
    for mult, suf in ((1, ""), (2, "@2x"), (3, "@3x")):
        px = sz * mult
        det = 1 if px <= 48 else 2
        save(color_mark(max(px * SS, 512), 0.96, det).resize((px, px), Image.LANCZOS), f"in-app/logo-mark-{sz}{suf}.png")
    save(icon_tile(max(sz * 3 * SS, 512), 0.80, 0.225, 1 if sz <= 24 else 2).resize((sz * 3, sz * 3), Image.LANCZOS),
         f"in-app/app-tile-{sz}@3x.png")
save(hsharp(lockup_horizontal, 120, False, False), "in-app/header-logo-light-h40@3x.png")
save(hsharp(lockup_horizontal, 120, True, False), "in-app/header-logo-dark-h40@3x.png")

# ======================= SOCIAL =======================
og = slate(1200, 630)
og.alpha_composite(sharp(color_mark, 470, 0.95), (50, 80))
wm, ww = wordmark(76, True)
tg, tw = tagline(20, True)
sub, _ = text_svg("Association management for Africa", MED, 28, "#94A3B8")
og.alpha_composite(svg_img(f'<g transform="translate(540 300)">{wm}</g>'
                           f'<g transform="translate(543 344)">{tg}</g>'
                           f'<g transform="translate(543 420)">{sub}</g>', 1200, 630))
save(opaque(og), "social/og-image-1200x630.png")
save(opaque(sharp(icon_tile, 800, 0.76)), "social/profile-picture-800.png")
print("built", sum(len(f) for _, _, f in os.walk(OUT)), "files")
