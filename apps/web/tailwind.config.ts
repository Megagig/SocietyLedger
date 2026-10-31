import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Meaning, not hue: each switches with dark mode through the variables in globals.css.
        'ink': 'var(--c-ink)',
        'ink-soft': 'var(--c-ink-soft)',
        'ink-muted': 'var(--c-ink-muted)',
        'ink-faint': 'var(--c-ink-faint)',
        'ink-subtle': 'var(--c-ink-subtle)',
        'on-solid': 'var(--c-on-solid)',
        'surface': 'var(--c-surface)',
        'surface-muted': 'var(--c-surface-muted)',
        'surface-sunken': 'var(--c-surface-sunken)',
        'page': 'var(--c-page)',
        'line': 'var(--c-line)',
        'line-soft': 'var(--c-line-soft)',
        'line-strong': 'var(--c-line-strong)',
        'success-soft': 'var(--c-success-soft)',
        'success-line': 'var(--c-success-line)',
        'success-strong': 'var(--c-success-strong)',
        'success-text': 'var(--c-success-text)',
        'success-link': 'var(--c-success-link)',
        'success': 'var(--c-success)',
        'success-solid': 'var(--c-success-solid)',
        'success-hover': 'var(--c-success-hover)',
        'success-focus': 'var(--c-success-focus)',
        'danger-soft': 'var(--c-danger-soft)',
        'danger-line': 'var(--c-danger-line)',
        'danger-strong': 'var(--c-danger-strong)',
        'danger-text': 'var(--c-danger-text)',
        'danger': 'var(--c-danger)',
        'warning-soft': 'var(--c-warning-soft)',
        'warning-line': 'var(--c-warning-line)',
        'warning-strong': 'var(--c-warning-strong)',
        'warning-text': 'var(--c-warning-text)',
        'info-soft': 'var(--c-info-soft)',
        'info-line': 'var(--c-info-line)',
        'info-strong': 'var(--c-info-strong)',
        'info-text': 'var(--c-info-text)',
        'grad-from': 'var(--c-grad-from)',
        'grad-to': 'var(--c-grad-to)',
        primary: {
          50: '#f0fdfa',
          100: '#ccfbf1',
          200: '#99f6e4',
          300: '#5eead4',
          400: '#2dd4bf',
          500: '#14b8a6',
          600: '#0d9488',
          700: '#0f766e',
          800: '#115e59',
          900: '#134e4a',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-radial': 'radial-gradient(var(--tw-gradient-stops))',
        'gradient-dark': 'linear-gradient(135deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
      },
    },
  },
  plugins: [],
  corePlugins: {
    preflight: false, // Disable to work with Mantine
  },
}
export default config