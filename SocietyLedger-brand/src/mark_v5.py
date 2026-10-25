"""SocietyLedger v5: reference-exact S. Upright construction, then vertical shear (bands rise right)."""
import io
import cairosvg
from PIL import Image, ImageChops

BLUE_L, BLUE, BLUE_D = "#2F86FF", "#0B6BFF", "#0A55D6"
GREEN_L, GREEN, GREEN_D = "#24CC7C", "#14B866", "#0E9A55"

# Upright geometry (before shear)
BLUE_P = ("M308 182 L776 182 L776 297 A90 90 0 0 1 686 387 L337 387 Q323 387 323 401 "
          "L323 612 C218 565 156 485 156 385 C156 275 198 182 308 182 Z")
GREEN_P = ("M168 842 L168 722 A60 60 0 0 1 228 662 L420 662 L420 470 L646 430 "
           "C770 456 866 556 866 662 C866 768 790 842 690 842 Z")
CARD = (353, 418, 315, 230, 24)          # x, y, w, h, r
WIN = (398, 433, 256, 200, 16)           # cut-out window inside the card
LINES = [(428, 466, 196, 26), (428, 516, 196, 26), (428, 566, 196, 26)]
GAP = 22
SHEAR = -16
FIT = [1.0, 0.0, 0.0]                    # scale, dx, dy (computed below)


def defs(u):
    return f"""<defs>
<linearGradient id="b{u}" x1="0" y1="180" x2="0" y2="620" gradientUnits="userSpaceOnUse">
 <stop offset="0" stop-color="{BLUE_L}"/><stop offset="1" stop-color="{BLUE_D}"/></linearGradient>
<linearGradient id="g{u}" x1="200" y1="430" x2="860" y2="850" gradientUnits="userSpaceOnUse">
 <stop offset="0" stop-color="{GREEN_D}"/><stop offset="1" stop-color="{GREEN_L}"/></linearGradient>
<linearGradient id="c{u}" x1="350" y1="420" x2="670" y2="650" gradientUnits="userSpaceOnUse">
 <stop offset="0" stop-color="#109E58"/><stop offset="1" stop-color="#14B866"/></linearGradient>
<linearGradient id="t{u}" x1="0" y1="0" x2="1024" y2="1024" gradientUnits="userSpaceOnUse">
 <stop offset="0" stop-color="{BLUE}"/><stop offset="0.55" stop-color="#0A93C9"/><stop offset="1" stop-color="{GREEN}"/></linearGradient>
</defs>"""


def T(scale):
    s, dx, dy = FIT
    return (f"translate(512 512) scale({scale}) translate(-512 -512) "
            f"translate({dx} {dy}) translate(512 512) scale({s}) skewY({SHEAR}) translate(-512 -512)")


def svg(body, u="", w=1024, h=1024):
    return (f'<svg xmlns="http://www.w3.org/2000/svg" width="{w}" height="{h}" viewBox="0 0 1024 1024">'
            f'{defs(u)}{body}</svg>')


def rr(r, fill, extra=""):
    x, y, w, h, rad = r
    return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rad}" fill="{fill}"{extra}/>'


def _r(body, u, size):
    return Image.open(io.BytesIO(cairosvg.svg2png(bytestring=svg(body, u).encode(),
                                                  output_width=size, output_height=size))).convert("RGBA")


def _cut(im, hole):
    im.putalpha(ImageChops.multiply(im.getchannel("A"), ImageChops.invert(hole.getchannel("A"))))
    return im


def g(scale, inner):
    return f'<g transform="{T(scale)}">{inner}</g>'


def render_mark(size, scale=1.0, mono=None, window_fill=None, detail=2):
    """mono: single colour. window_fill: paint the card window instead of cutting it out."""
    cb, cg, cc, cl = (mono,) * 4 if mono else ("url(#ba)", "url(#ga)", "url(#ca)", GREEN)
    x, y, w, h, r = CARD
    ring = g(scale, rr((x - GAP, y - GAP, w + 2 * GAP, h + 2 * GAP, r + GAP), "#000"))
    shape = _cut(_r(g(scale, f'<path d="{BLUE_P}" fill="{cb}"/><path d="{GREEN_P}" fill="{cg}"/>'), "a", size),
                 _r(ring, "a", size))
    card = _cut(_r(g(scale, rr(CARD, cc)), "a", size), _r(g(scale, rr(WIN, "#000")), "a", size))
    shape.alpha_composite(card)
    if window_fill:
        shape.alpha_composite(_r(g(scale, rr(WIN, window_fill)), "a", size))
    lines = LINES if detail >= 2 else [(428, 480, 196, 40), (428, 556, 130, 40)]
    shape.alpha_composite(_r(g(scale, "".join(rr((lx, ly, lw, lh, 3), cl) for lx, ly, lw, lh in lines)), "a", size))
    return shape


def _fit():
    im = render_mark(1024, 1.0)
    l, t, r, b = im.getchannel("A").getbbox()
    s = 820 / max(r - l, b - t)
    FIT[:] = [s, s * (512 - (l + r) / 2), s * (512 - (t + b) / 2)]


_fit()


def gradient_tile(size, radius=0):
    return _r(f'<rect width="1024" height="1024" rx="{radius}" fill="url(#ta)"/>', "a", size)


def render_icon(size, scale=0.78, radius=0):
    """White mark on the blue-green gradient (window cut out to show the gradient)."""
    bg = gradient_tile(size, radius)
    m = render_mark(size, scale, mono="#FFFFFF")
    # lines must be cut too so the gradient shows through the window and lines read
    bg.alpha_composite(m)
    return bg
