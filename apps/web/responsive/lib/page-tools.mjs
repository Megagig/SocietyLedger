// Page helpers shared by capture.mjs and interactions.mjs.
// Freeze the browser clock and switch animations off, so two runs of the same page produce the same pixels.
export const INIT_SCRIPT = `
  (() => {
    const fixed = new Date('2026-10-31T10:00:00Z').getTime();
    const RealDate = Date; const offset = fixed - RealDate.now();
    class FixedDate extends RealDate { constructor(...a) { if (a.length === 0) { super(RealDate.now() + offset); } else { super(...a); } } static now() { return RealDate.now() + offset; } }
    window.Date = FixedDate;
    const css = '*:not(.overflow-x-auto),*::before,*::after{animation-duration:0s!important;animation-delay:0s!important}*,*::before,*::after{transition-duration:0s!important;transition-delay:0s!important;caret-color:transparent!important}';
    const add = () => { const s = document.createElement('style'); s.setAttribute('data-resp-audit', ''); s.textContent = css; (document.head || document.documentElement).appendChild(s); };
    if (document.head) add(); else document.addEventListener('DOMContentLoaded', add);
  })();
`;

// Measured inside the page. Returns plain data only.
export function measure() {
  const w = window.innerWidth;
  const doc = document.documentElement;
  const isScrollClipped = (el) => {
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const o = getComputedStyle(p).overflowX;
      if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') return true;
    }
    return false;
  };
  const visible = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width === 0 || r.height === 0) return false;
    const s = getComputedStyle(el);
    return s.visibility !== 'hidden' && s.display !== 'none' && Number(s.opacity) !== 0;
  };
  const desc = (el) => `${el.tagName.toLowerCase()}${el.id ? '#' + el.id : ''}${typeof el.className === 'string' && el.className ? '.' + el.className.trim().split(/\s+/).slice(0, 3).join('.') : ''}`;

  const offenders = [];
  for (const el of document.body.querySelectorAll('*')) {
    if (offenders.length >= 8) break;
    const r = el.getBoundingClientRect();
    if (r.right > w + 1 && visible(el) && !isScrollClipped(el)) {
      offenders.push({ el: desc(el), right: Math.round(r.right), text: (el.textContent || '').trim().slice(0, 40) });
    }
  }

  const interactive = [...document.querySelectorAll('a[href],button,input:not([type=hidden]),select,textarea,[role=button],[role=tab],[role=menuitem]')].filter(visible);
  const small = interactive.filter((el) => { const r = el.getBoundingClientRect(); return r.width < 44 || r.height < 44; });
  const inputs = [...document.querySelectorAll('input:not([type=hidden]):not([type=checkbox]):not([type=radio]),select,textarea')].filter(visible);
  const smallInputs = inputs.filter((el) => parseFloat(getComputedStyle(el).fontSize) < 16);
  const tables = [...document.querySelectorAll('table')].filter(visible).map((t) => ({
    cols: t.rows[0] ? t.rows[0].cells.length : 0,
    rows: t.rows.length,
    width: Math.round(t.getBoundingClientRect().width),
    scrolls: isScrollClipped(t),
  }));
  const bodyFont = parseFloat(getComputedStyle(document.body).fontSize);
  const tinyText = [...document.querySelectorAll('p,span,td,th,li,label,a,button,div')].filter((el) => {
    if (!visible(el)) return false;
    if (![...el.childNodes].some((n) => n.nodeType === 3 && n.textContent.trim())) return false;
    return parseFloat(getComputedStyle(el).fontSize) < 12;
  }).length;
  const dialog = document.querySelector('[role=dialog],.mantine-Modal-content');
  const dr = dialog ? dialog.getBoundingClientRect() : null;

  return {
    innerWidth: w,
    innerHeight: window.innerHeight,
    scrollWidth: doc.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
    scrollHeight: doc.scrollHeight,
    overflowX: doc.scrollWidth > w,
    overflowPx: Math.max(0, doc.scrollWidth - w),
    offenders,
    interactive: interactive.length,
    smallTargets: small.length,
    smallTargetSamples: small.slice(0, 4).map((el) => `${desc(el)} ${Math.round(el.getBoundingClientRect().width)}x${Math.round(el.getBoundingClientRect().height)} "${(el.textContent || el.getAttribute('aria-label') || '').trim().slice(0, 24)}"`),
    inputs: inputs.length,
    smallInputs: smallInputs.length,
    tables,
    bodyFont,
    tinyText,
    images: [...document.images].filter(visible).length,
    imagesNoSize: [...document.images].filter((i) => visible(i) && !(i.getAttribute('width') && i.getAttribute('height'))).length,
    h1: (document.querySelector('h1')?.textContent || '').trim().slice(0, 80),
    title: document.title,
    dialogOpen: Boolean(dialog),
    dialogOverflowsViewport: Boolean(dr && (dr.height > window.innerHeight + 1 || dr.width > w + 1)),
    standalone: matchMedia('(display-mode: standalone)').matches,
  };
}

export async function settle(page) {
  await page.waitForLoadState('networkidle', { timeout: 12000 }).catch(() => {});
  await page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {});
  await page.waitForTimeout(700);
}

