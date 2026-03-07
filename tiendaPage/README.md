# Tienda GDLDENOXE — Virtual Store Flipbook

## Description

A CSS-checkbox-driven flip book transformed into a **virtual store catalog**. Each page can have clickable product hotspots that open a retro 2000s-supermarket product modal with an external purchase link. The entire catalog is configured through a single JSON file — no HTML edits needed to add pages or products.

**Original flip book concept by [Fabien CHAVONET](https://github.com/fchavonet).** Extended with a data-driven catalog engine, product hotspot overlay system, modal UI, and debug positioning tools.

## Tech Stack

![HTML5 badge](https://img.shields.io/badge/HTML5-e34f26?logo=html5&logoColor=white&style=for-the-badge)
![CSS3 badge](https://img.shields.io/badge/CSS3-1572b6?logo=css&logoColor=white&style=for-the-badge)
![JavaScript badge](https://img.shields.io/badge/JAVASCRIPT-f7df1e?logo=javascript&logoColor=black&style=for-the-badge)

## File Description

| **FILE**         | **DESCRIPTION**                                                    |
| :--------------: | ------------------------------------------------------------------ |
| `catalog.json`   | **The catalog data** — pages, product hotspots, prices, links.     |
| `index.html`     | HTML skeleton (modal template, audio, marquee).                    |
| `style.css`      | All styles: flipbook, hotspots, modal, debug mode.                 |
| `script.js`      | Catalog engine, modal system, debug mode, music, ads, theme toggle.|
| `assets/images/pages/`    | Full-page catalog images (page1.webp – pageN.webp).       |
| `assets/images/products/` | Product detail images (shown in the modal).                |

---

## How It Works

1. **`catalog.json`** defines the pages and their products.
2. On page load, `script.js` fetches `catalog.json` and dynamically generates:
   - Hidden `<input type="checkbox">` elements (one per page)
   - The `#flip_book` with all `.page` divs, content images, edge shading, and labels
   - Product hotspot overlays positioned via percentage coordinates
   - CSS rules for z-index stacking and flip states (injected into `<style id="dynamic-flipbook-css">`)
3. The **CSS-only checkbox flip mechanism** is preserved 1:1 — clicking page edges flips them.
4. Clicking a **product hotspot** opens a retro-styled modal with image, price starburst, description, and a **"¡COMPRAR AHORA!"** button that links to an external store.

---

## Adding / Removing Pages

Edit `catalog.json` → `pages` array. Each entry represents one physical page (2 sides):

```json
{
    "front": {
        "image": "assets/images/pages/page11.webp",
        "alt": "Página 11",
        "products": []
    },
    "back": {
        "image": "assets/images/pages/page12.webp",
        "alt": "Página 12",
        "products": []
    }
}
```

Drop the corresponding images into `assets/images/pages/`. The engine auto-generates all CSS stacking and flip rules for any number of pages.

### Image Specs

| Property          | Value                    |
| :---------------- | :----------------------- |
| Content area      | 288 × 400 px             |
| Format            | `.webp` (recommended)    |
| Image file size   | 287 × 398 px (1px inset) |

---

## Adding Product Hotspots

Each product is an object inside a page face's `products` array:

```json
{
    "id": "camiseta-gdl-01",
    "name": "Camiseta GDLDENOXE Edición Limitada",
    "price": 450,
    "currency": "MXN",
    "description": "Camiseta 100% algodón con diseño exclusivo. Tallas S, M, L, XL.",
    "image": "assets/images/products/camiseta-gdl-01.webp",
    "link": "https://your-store.com/product/camiseta-gdl-01",
    "badge": "NUEVO",
    "hotspot": {
        "x": 10,
        "y": 20,
        "width": 35,
        "height": 30
    }
}
```

### Hotspot Fields

| Field       | Type     | Required | Description                                        |
| :---------- | :------- | :------: | :------------------------------------------------- |
| `id`        | string   | yes      | Unique identifier                                  |
| `name`      | string   | yes      | Product name (shown in modal header)               |
| `price`     | number   | no       | Price (shown in starburst + floating tag)           |
| `currency`  | string   | no       | Currency code (default: `"MXN"`)                   |
| `description` | string | no       | Product description                                |
| `image`     | string   | no       | Path to product detail image (modal)               |
| `link`      | string   | yes      | External store / purchase URL                      |
| `badge`     | string   | no       | Corner ribbon label: `"OFERTA"`, `"NUEVO"`, `"2x1"` |
| `hotspot`   | object   | yes      | `{ x, y, width, height }` — all in **percentages** (0–100) relative to the page face |

---

## Debug Mode — Hotspot Positioning

Append `?debug` to the URL to activate debug mode:

```
index.html?debug
```

This enables:
- **10% grid overlay** on every page face (red vertical, blue horizontal lines)
- **Click logging** — click anywhere on a page to log `{ x, y }` percentages to the browser console
- **Coordinate tooltip** — a floating label shows the coordinates at the click point
- **Hotspot boundaries** — existing hotspots are drawn with dashed green borders and show their `id`
- **Modal suppressed** — clicking hotspots logs coordinates instead of opening the modal

### Workflow

1. Open the page with `?debug` appended
2. Flip to the page you want to add products to
3. Click the **top-left corner** of a product area → note the `x, y` from the console
4. Click the **bottom-right corner** → calculate `width = x2 - x1`, `height = y2 - y1`
5. Add the hotspot object to `catalog.json` with these values
6. Refresh to see the hotspot rendered

---

## Marquee Text

The scrolling banner text can be configured in `catalog.json`:

```json
{
    "marqueeText": "*** YOUR CUSTOM TEXT HERE ***",
    "pages": [ ... ]
}
```

---

## Architecture Notes

- **CSS-only flip mechanism preserved**: The engine generates the exact same `<input type="checkbox">` + `<label>` + sibling combinator (`~`) CSS rules used in the original. No JavaScript is involved in the actual page flipping.
- **Hotspot z-index layering**: Hotspots sit at z-index 101 (above the label at 100). Clicking a hotspot reaches the JS handler; clicking anywhere else on the page reaches the label and triggers the flip.
- **Percentage-based coordinates**: Hotspot positions are defined as percentages of the page face, so they scale correctly regardless of display size.
- **Music & Ads**: The background music crossfade system, periodic ad audio, and parent iframe API (`window.startMusic()`, `window.stopMusic()`, etc.) are fully unchanged and decoupled from the catalog.

## Original Author

**Fabien CHAVONET** — [@fchavonet](https://github.com/fchavonet)
