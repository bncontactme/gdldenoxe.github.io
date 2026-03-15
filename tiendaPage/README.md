# Tienda GDLDENOXE — Virtual Store Flipbook

## Description

A CSS-checkbox-driven flip book transformed into a **virtual store catalog** with a retro 2000s-supermarket aesthetic. Products are defined in `catalog.json` and each page is **explicitly configured** with a template, background, logo, and product IDs via the `pages[]` array. Clicking any product opens a Windows 95-styled modal with product details and an external purchase link.

**Original flip book concept by [Fabien CHAVONET](https://github.com/fchavonet).** Extended with a data-driven auto-layout catalog engine, product modal UI, and debug positioning tools.

## Tech Stack

![HTML5 badge](https://img.shields.io/badge/HTML5-e34f26?logo=html5&logoColor=white&style=for-the-badge)
![CSS3 badge](https://img.shields.io/badge/CSS3-1572b6?logo=css&logoColor=white&style=for-the-badge)
![JavaScript badge](https://img.shields.io/badge/JAVASCRIPT-f7df1e?logo=javascript&logoColor=black&style=for-the-badge)

## File Description

| **FILE**         | **DESCRIPTION**                                                    |
| :--------------: | ------------------------------------------------------------------ |
| `catalog.json`   | **The catalog data** — products, assets, cover/back-cover config.  |
| `index.html`     | HTML skeleton (modal template, audio, marquee).                    |
| `style.css`      | All styles: flipbook, product cards, modal, debug mode.            |
| `script.js`      | Catalog engine, modal system, debug mode, music, ads, theme toggle.|
| `assets/products/`       | Product images (boxer photos, etc.).                       |
| `assets/webAssets/`      | Background, frame, splash, shadow, and logo assets.        |

---

## How It Works

1. **`catalog.json`** defines `products[]`, `pages[]`, and shared visual `assets`.
2. On page load, `script.js` fetches `catalog.json` and:
   - **Builds each page** from the explicit `pages[]` configuration, where each page specifies its template, background, logo variant, and product IDs
   - 4 layout templates are available:
     - **Template A** (`1-featured`): 1 featured product (full-page)
     - **Template B** (`2-split`): 2 products side-by-side
     - **Template C** (`2S-1L`): 1 large + 2 small (magazine layout)
     - **Template D** (`1-left-featured`): 1 product left, text right
   - Generates the cover and back cover automatically from `cover`/`backCover` config
   - Composes each page face from layered assets: background → frame → product photo → price splash → name/info → edge shading
   - Injects CSS stacking and flip-state rules into `<style id="dynamic-flipbook-css">`
   - On mobile (≤480px), renders a simplified Win95-style card grid instead of the flipbook
3. The **CSS-only checkbox flip mechanism** is preserved — clicking page edges flips them.
4. Clicking any **product card** opens a retro-styled modal with image, price starburst, description, and a **"¡COMPRAR AHORA!"** button.

---

## Adding / Removing Products

Edit `catalog.json` → `products` array to add products, and `pages[]` to assign them to pages.

Each product is defined in the `products[]` array:

```json
{
    "id": "boxer-1",
    "name": "BOXER GDLDENOXE #1",
    "price": 299,
    "cents": "00",
    "currency": "MXN",
    "image": "assets/products/boxers/boxer 1.jpg",
    "description": "Boxer exclusivo edición Guadalajara De Noche.",
    "link": "https://your-store.com/product/boxer-1",
    "info": "Talla Única",
    "stock": "5 u",
    "badge": "NUEVO",
    "subtitle": "$220 / Guardaropa"
}
```

Then add the product ID to a page in `pages[]`:

```json
{
    "template": "1-featured",
    "background": "assets/webAssets/background/bg.png",
    "logo": { "variant": "dark", "x": 10, "y": 2, "w": 80, "h": 14 },
    "products": ["boxer-1"]
}
```

The number of product IDs per page must match the template's slot count (A=1, B=2, C=3, D=1).

### Product Fields

| Field             | Type     | Required | Description                                        |
| :---------------- | :------- | :------: | :------------------------------------------------- |
| `id`              | string   | yes      | Unique identifier                                  |
| `name`            | string   | yes      | Product name (shown on card + modal header)        |
| `price`           | number   | no       | Price (shown in splash starburst)                  |
| `cents`           | string   | no       | Cent digits (default: `"00"`)                      |
| `currency`        | string   | no       | Currency code (default: `"MXN"`)                   |
| `description`     | string   | no       | Product description (shown in modal)               |
| `image`           | string   | no       | Path to product photo                              |
| `link`            | string   | yes      | External store / purchase URL                      |
| `info`            | string   | no       | Extra info line (size, weight, etc.)               |
| `stock`           | string   | no       | Stock indicator (e.g., `"5 u"`)                    |
| `badge`           | string   | no       | Corner ribbon: `"OFERTA"`, `"NUEVO"`, `"2x1"`      |
| `subtitle`        | string   | no       | Secondary price label (bottom-right of image)      |
| `noModal`         | boolean  | no       | If true, product is decorative (no click action)   |
| `noSplash`        | boolean  | no       | Hide the price splash image                        |
| `mobileHide`      | boolean  | no       | Hide from mobile store grid                        |
| `imageBg`         | string   | no       | Background color for the image clip area           |
| `noCornerEffect`  | boolean  | no       | Disable corner effect on this product              |
| `cornerEffect`    | boolean  | no       | Force corner effect on this product                |
| `cornerPosition`  | string   | no       | Corner position: `"tl"`, `"tr"`, `"bl"`, `"br"`   |
| `bigSplash`       | object   | no       | Override big splash: `{src, position, offsetX/Y/W}`|

---

## Assets Configuration

The `assets` object in `catalog.json` defines the visual elements used to compose pages:

| Key              | Description                                                |
| :--------------- | :--------------------------------------------------------- |
| `backgrounds`    | Array of page background images (used as fallback)         |
| `frames`         | Named frame images (`tall`, `square-sm`, `featured-1`...)  |
| `splashes`       | Named price starburst images (`large`, `star-1`, `burst-1`...)|
| `logos`          | `dark`, `light`, and `alt` variants of the store logo      |
| `cornerEffects`  | Array of corner decoration images (auto-rotated)           |
| `bigSplashes`    | Array of large decorative splash overlays with positions   |
| `splashScales`   | Per-image scale overrides keyed by filename fragment       |

Frames and splashes are **automatically rotated** through pools matched to each template slot size (large, medium, small).

---

## Cover & Back Cover

Configured via `cover` and `backCover` objects in `catalog.json`:

```json
{
    "cover": {
        "title": "CATÁLOGO 2026",
        "subtitle": "EDICIÓN ESPECIAL",
        "tagline": "BOXERS EXCLUSIVOS",
        "footer": "ENVÍOS A TODO MÉXICO",
        "url": "www.guadalajaradenoxe.com"
    },
    "backCover": {
        "title": "GRACIAS POR TU VISITA",
        "subtitle": "SÍGUENOS EN NUESTRAS REDES...",
        "url": "WWW.GUADALAJARADENOXE.COM"
    }
}
```

---

## Debug Mode

Append `?debug` to the URL:

```
index.html?debug
```

This enables:
- **10% grid overlay** on every page face
- **Click logging** — click anywhere on a page to log `{ x, y }` percentages to console
- **Coordinate tooltip** — floating label at click point
- **Modal suppressed** — product clicks log coordinates instead of opening modal

---

## Marquee Text

```json
{
    "marqueeText": "*** YOUR CUSTOM TEXT HERE ***"
}
```

---

## Architecture Notes

- **Explicit page layout**: Each page in `pages[]` defines its template, background, logo, and product IDs. Products are matched by ID from the flat `products[]` array.
- **CSS-only flip mechanism**: The engine generates `<input type="checkbox">` + `<label>` + sibling combinator (`~`) CSS rules. No JavaScript is involved in page flipping.
- **Layered page composition**: Each page face is built from stacked layers (background → frame → product image → splash/price → name/info → edge shading → flip label).
- **Responsive scaling**: The flipbook is scaled via CSS `transform: scale()` to fit any viewport while preserving the internal 298×420px coordinate system.
- **Mobile store**: On screens ≤480px, the flipbook is replaced with a Windows 95-style card grid showing purchasable products.
- **Music & Ads**: Background music crossfade and periodic ad audio systems are included. Control via `window.startMusic()`, `window.stopMusic()`, `window.startAds()`, `window.stopAds()`.
- **Win95 navigation**: A Windows 95-styled Back/Next panel below the flipbook for page navigation.

## Original Author

**Fabien CHAVONET** — [@fchavonet](https://github.com/fchavonet)
