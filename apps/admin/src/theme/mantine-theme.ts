import { createTheme, MantineColorsTuple } from '@mantine/core';

const ledger: MantineColorsTuple = [
  '#eef7f5',
  '#d3ebe6',
  '#a8d7ce',
  '#6fbdb0',
  '#3ca294',
  '#178678',
  '#0e7064',
  '#0b5c53',
  '#0a4842',
  '#083731',
];

const brass: MantineColorsTuple = [
  '#fbf5e6',
  '#f7ebcf',
  '#efd9a6',
  '#e3c27a',
  '#d6ac52',
  '#c8962e',
  '#a67c22',
  '#8a6516',
  '#6e500f',
  '#523b0a',
];

// Override Mantine's gray with the admin neutral scale
const gray: MantineColorsTuple = [
  '#f5f8f7',
  '#edf2f0',
  '#dde5e3',
  '#c5d0cd',
  '#8a9b97',
  '#5e706c',
  '#33433f',
  '#25403c',
  '#1a2d2b',
  '#13211f',
];

const dark: MantineColorsTuple = [
  '#e8f0ee',
  '#9ab0ac',
  '#6e8581',
  '#34544f',
  '#25403c',
  '#1a2d2b',
  '#122120',
  '#0c1716',
  '#091211',
  '#05100f',
];

export const adminTheme = createTheme({
  primaryColor: 'ledger',
  primaryShade: { light: 7, dark: 4 },

  colors: { ledger, brass, gray, dark },

  fontFamily: 'Manrope, Inter, system-ui, sans-serif',
  fontFamilyMonospace: 'JetBrains Mono, Fira Code, monospace',

  // §15.3 dense type scale
  fontSizes: {
    xs: '0.75rem',   // 12px
    sm: '0.8125rem', // 13px
    md: '0.875rem',  // 14px
    lg: '0.9375rem', // 15px
    xl: '1.125rem',  // 18px
  },
  lineHeights: {
    xs: '1rem',   // 16px
    sm: '1.125rem', // 18px
    md: '1.25rem',  // 20px
    lg: '1.375rem', // 22px
    xl: '1.625rem', // 26px
  },
  headings: {
    fontFamily: 'Manrope, Inter, system-ui, sans-serif',
    sizes: {
      h1: { fontSize: '1.5rem', lineHeight: '2rem', fontWeight: '700' },
      h2: { fontSize: '1.125rem', lineHeight: '1.625rem', fontWeight: '700' },
      h3: { fontSize: '0.9375rem', lineHeight: '1.375rem', fontWeight: '600' },
    },
  },

  // §15.4 radius
  radius: {
    xs: '4px',
    sm: '6px',
    md: '8px',
    lg: '12px',
  },

  // §15.4 spacing (4px scale)
  spacing: {
    xs: '4px',
    sm: '8px',
    md: '12px',
    lg: '16px',
    xl: '24px',
  },

  // Component defaults
  components: {
    Badge: {
      defaultProps: { radius: 'sm' },
    },
    Button: {
      defaultProps: { radius: 'md' },
    },
    TextInput: {
      defaultProps: { radius: 'md' },
    },
    Select: {
      defaultProps: { radius: 'md' },
    },
    Card: {
      defaultProps: { radius: 'lg', p: 'lg' },
    },
    Table: {
      defaultProps: { striped: false, highlightOnHover: true },
    },
  },
});
