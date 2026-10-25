import mark_v5 as M
from mark_v5 import BLUE_P, GREEN_P, CARD, WIN, LINES, GAP, T, defs, BLUE, GREEN
OUT="SocietyLedger-brand"
def rr(r,fill): x,y,w,h,rad=r; return f'<rect x="{x}" y="{y}" width="{w}" height="{h}" rx="{rad}" fill="{fill}"/>'
def mark_svg(scale=0.86, mono=None, bg=None, u="s"):
    cb,cg,cc,cl=(mono,)*4 if mono else (f"url(#b{u})",f"url(#g{u})",f"url(#c{u})",GREEN)
    x,y,w,h,r=CARD
    tf=T(scale)
    back=""
    if bg=="gradient": back=f'<rect width="1024" height="1024" rx="230" fill="url(#t{u})"/>'
    if bg=="slate": back='<rect width="1024" height="1024" rx="230" fill="#0F172A"/>'
    m=(f'<mask id="gap{u}" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><rect width="1024" height="1024" fill="#fff"/>'
       f'<g transform="{tf}">{rr((x-GAP,y-GAP,w+2*GAP,h+2*GAP,r+GAP),"#000")}</g></mask>'
       f'<mask id="win{u}" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024"><rect width="1024" height="1024" fill="#fff"/>'
       f'<g transform="{tf}">{rr(WIN,"#000")}</g></mask>')
    lines="".join(rr((lx,ly,lw,lh,3),cl) for lx,ly,lw,lh in LINES)
    body=(f'{back}<defs>{m}</defs>'
          f'<g mask="url(#gap{u})"><g transform="{tf}"><path d="{BLUE_P}" fill="{cb}"/><path d="{GREEN_P}" fill="{cg}"/></g></g>'
          f'<g mask="url(#win{u})"><g transform="{tf}">{rr(CARD,cc)}</g></g><g transform="{tf}">{lines}</g>')
    return f'<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">{defs(u)}{body}</svg>'
open(f"{OUT}/src/logo-mark.svg","w").write(mark_svg())
open(f"{OUT}/src/logo-mono-black.svg","w").write(mark_svg(mono="#0F172A",u="k"))
open(f"{OUT}/src/logo-mono-white.svg","w").write(mark_svg(mono="#FFFFFF",u="w"))
open(f"{OUT}/src/app-icon.svg","w").write(mark_svg(0.80,mono="#FFFFFF",bg="gradient",u="i"))
open(f"{OUT}/favicon/favicon.svg","w").write(mark_svg(0.86,mono="#FFFFFF",bg="gradient",u="f"))
open(f"{OUT}/in-app/logo-mark.svg","w").write(mark_svg(0.96,u="a"))
print("ok")
