import fs from 'fs';
import path from 'path';

import { tokens } from './tokens';

function cssVarsFromGlobalCss() {
  const css = fs.readFileSync(path.join(__dirname, 'global.css'), 'utf8');
  const rootBlock = css.match(/:root\s*{([^}]*)}/)?.[1] ?? '';
  const darkBlock = css.match(/prefers-color-scheme:\s*dark\s*\)\s*{\s*:root\s*{([^}]*)}/)?.[1] ?? '';

  const parse = (block: string) => {
    const vars: Record<string, string> = {};
    for (const match of block.matchAll(/--color-([a-z-]+):\s*([\d\s]+);/g)) {
      const name = match[1];
      const rgb = match[2];
      if (!name || !rgb) continue;
      const channels = rgb.trim().split(/\s+/).map(Number);
      if (channels.length !== 3 || channels.some((n) => Number.isNaN(n))) continue;
      vars[name] = `#${channels.map((n) => n.toString(16).padStart(2, '0')).join('').toUpperCase()}`;
    }
    return vars;
  };

  return { light: parse(rootBlock), dark: parse(darkBlock) };
}

function camelToKebab(key: string) {
  return key.replace(/([a-z0-9])([A-Z])/g, '$1-$2').toLowerCase();
}

describe('theme tokens parity with global.css', () => {
  const { light, dark } = cssVarsFromGlobalCss();

  it('every light color in tokens.ts matches global.css', () => {
    for (const [key, hex] of Object.entries(tokens.light.color)) {
      const cssVar = camelToKebab(key);
      expect(light[cssVar]).toBe(hex);
    }
  });

  it('every dark color override in tokens.ts matches global.css', () => {
    for (const [key, hex] of Object.entries(tokens.dark.color)) {
      const cssVar = camelToKebab(key);
      if (!(cssVar in dark)) continue; // passbook tokens are theme-independent, not re-declared in the dark block
      expect(dark[cssVar]).toBe(hex);
    }
  });
});
