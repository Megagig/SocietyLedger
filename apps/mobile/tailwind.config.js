/** @type {import('tailwindcss').Config} */
const v = (name) => `rgb(var(--color-${name}) / <alpha-value>)`;

module.exports = {
  content: ['./app/**/*.{ts,tsx}', './src/**/*.{ts,tsx}'],
  presets: [require('nativewind/preset')],
  theme: {
    colors: {
      transparent: 'transparent',
      bg: v('bg'),
      surface: { DEFAULT: v('surface'), raised: v('surface-raised'), sunken: v('surface-sunken') },
      border: { DEFAULT: v('border'), strong: v('border-strong') },
      text: { DEFAULT: v('text'), secondary: v('text-secondary'), tertiary: v('text-tertiary'), inverse: v('text-inverse') },
      primary: { DEFAULT: v('primary'), pressed: v('primary-pressed'), soft: v('primary-soft') },
      'on-primary-soft': v('on-primary-soft'),
      accent: { DEFAULT: v('accent'), text: v('accent-text'), soft: v('accent-soft') },
      success: { DEFAULT: v('success'), soft: v('success-soft') },
      warning: { DEFAULT: v('warning'), soft: v('warning-soft') },
      danger: { DEFAULT: v('danger'), soft: v('danger-soft') },
      info: { DEFAULT: v('info'), soft: v('info-soft') },
      overlay: v('overlay'),
      focus: v('focus'),
      passbook: { DEFAULT: v('passbook'), stamp: v('passbook-stamp') },
      'on-passbook': { DEFAULT: v('on-passbook'), muted: v('on-passbook-muted') },
    },
    spacing: { 0: '0px', 0.5: '2px', 1: '4px', 2: '8px', 3: '12px', 4: '16px', 5: '20px', 6: '24px', 8: '32px', 10: '40px', 12: '48px', 16: '64px' },
    borderRadius: { none: '0px', xs: '4px', sm: '8px', md: '12px', lg: '16px', xl: '24px', full: '9999px' },
    fontFamily: {
      sans: ['Manrope_500Medium'],
      regular: ['Manrope_400Regular'],
      semibold: ['Manrope_600SemiBold'],
      bold: ['Manrope_700Bold'],
      extrabold: ['Manrope_800ExtraBold'],
    },
    fontSize: {
      display: ['40px', { lineHeight: '44px', letterSpacing: '-0.8px' }],
      h1: ['28px', { lineHeight: '34px', letterSpacing: '-0.4px' }],
      h2: ['22px', { lineHeight: '28px', letterSpacing: '-0.2px' }],
      h3: ['18px', { lineHeight: '24px' }],
      'body-lg': ['17px', { lineHeight: '24px' }],
      body: ['15px', { lineHeight: '22px' }],
      label: ['13px', { lineHeight: '18px', letterSpacing: '0.1px' }],
      caption: ['12px', { lineHeight: '16px', letterSpacing: '0.1px' }],
      micro: ['11px', { lineHeight: '14px', letterSpacing: '0.2px' }],
      'num-lg': ['24px', { lineHeight: '30px', letterSpacing: '-0.3px' }],
    },
    extend: {},
  },
};
