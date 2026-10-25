# SocietyLedger brand kit

**Logo:** a bold "S" with rising bands. The blue upper piece (trust, stability) and the green lower piece (growth, community) wrap around a ledger card at the centre: people, records, progress.

## Colours

| Role | Hex |
|---|---|
| Primary Blue (upper S, "Society") | `#0B6BFF` (gradient `#2F86FF` → `#0A55D6`) |
| Primary Green (lower S, card, "Ledger") | `#14B866` (gradient `#0E9A55` → `#24CC7C`) |
| Deep Blue (wordmark on light) | `#0B3FB0` |
| Slate (splash, OG, website theme) | `#0F172A` |
| Icon gradient | `#0B6BFF` → `#0A93C9` → `#14B866` |

Wordmark: Poppins Bold. Tagline "PEOPLE • RECORDS • PROGRESS": Poppins Medium, wide letter-spacing.

## Folders

- `master/`:
  - transparent master (1024, 2048)
  - icon tile (square and rounded), mark on slate
  - vertical and horizontal lockups (light/dark, with/without tagline)
  - mono black/white
- `app/`: Expo icon, adaptive foreground/background, monochrome, splash images
- `favicon/`: favicon.ico/.svg/PNGs, apple-touch, PWA + maskable icons, site.webmanifest
- `in-app/`: colour mark 24–128 px (@1x/@2x/@3x), rounded app tiles, header logo (40 px tall), logo-mark.svg
- `social/`: OG/Twitter image (1200×630), profile picture
- `src/`: vector SVGs (mark, mono, app icon) and the generator scripts

The card window is cut out, so the background shows through: white on light pages, slate on dark, gradient on the icon. At 48 px and below the card uses two thicker lines so it stays crisp.

## Expo (`apps/mobile/app.json`)

```json
{
  "expo": {
    "icon": "./assets/icon.png",
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon-foreground.png",
        "backgroundImage": "./assets/adaptive-icon-background.png",
        "monochromeImage": "./assets/adaptive-icon-monochrome.png",
        "backgroundColor": "#0B6BFF"
      }
    },
    "plugins": [
      ["expo-splash-screen", {
        "image": "./assets/splash-icon.png",
        "imageWidth": 280,
        "resizeMode": "contain",
        "backgroundColor": "#0F172A"
      }]
    ]
  }
}
```

For a white splash, use `splash-icon-light.png` with `"backgroundColor": "#FFFFFF"`.
Icons and splash only change with a new native build (`npx expo prebuild --clean` or EAS build), not OTA.

## Web `<head>` (web, docs, admin)

Copy `favicon/*` and `social/og-image-1200x630.png` into each app's `public/`:

```html
<link rel="icon" href="/favicon.ico" sizes="48x48">
<link rel="icon" href="/favicon.svg" type="image/svg+xml">
<link rel="apple-touch-icon" href="/apple-touch-icon.png">
<link rel="manifest" href="/site.webmanifest">
<meta name="theme-color" content="#0F172A">
<meta property="og:image" content="https://societyledger.com.ng/og-image-1200x630.png">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
```

Website header: `master/logo-horizontal-light-notag.png` on white, `-dark-notag` on slate. Use `in-app/logo-mark.svg` for a vector version.

## Usage rules

- Use the colour mark on white or slate. Use the white mark on the gradient, on photos, or in single-colour contexts.
- Keep clear space around the logo equal to the height of the ledger card.
- Don't recolour the two halves, rotate or stretch the mark, or remove the card.
