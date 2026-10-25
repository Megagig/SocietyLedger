/* eslint-disable @next/next/no-img-element */

/** SocietyLedger brand assets (SocietyLedger-brand kit), served from `public/brand/`.
 * `BrandMark` is the "S" mark alone; `BrandLogo` is the horizontal lockup. The lockup comes in a
 * light-page and a dark-page version — `tone="auto"` swaps them with the theme, `"onDark"` always
 * uses the dark-page one (e.g. the footer, which is dark in both themes). */

interface BrandMarkProps {
  size?: number;
  className?: string;
}

export function BrandMark({ size = 40, className }: BrandMarkProps) {
  return (
    <img
      src="/brand/logo-mark.svg"
      alt=""
      aria-hidden="true"
      width={size}
      height={size}
      className={className}
      style={{ width: size, height: size }}
    />
  );
}

interface BrandLogoProps {
  /** Rendered height in px; width follows the 1288:320 artwork ratio. */
  height?: number;
  tone?: 'auto' | 'onLight' | 'onDark';
  className?: string;
}

export function BrandLogo({ height = 36, tone = 'auto', className = '' }: BrandLogoProps) {
  const width = Math.round(height * (1288 / 320));
  const common = { alt: 'SocietyLedger', height, width, style: { height, width } };

  if (tone === 'onLight') {
    return <img src="/brand/logo-horizontal-light-notag.png" {...common} className={className} />;
  }
  if (tone === 'onDark') {
    return <img src="/brand/logo-horizontal-dark-notag.png" {...common} className={className} />;
  }
  return (
    <>
      <img src="/brand/logo-horizontal-light-notag.png" {...common} className={`dark:hidden ${className}`} />
      <img src="/brand/logo-horizontal-dark-notag.png" {...common} className={`hidden dark:block ${className}`} />
    </>
  );
}
