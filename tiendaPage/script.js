/* ============================================================
   TIENDA GDLDENOXE — Virtual Store Flipbook Engine
   ============================================================
   Modules (in order):
     1. Catalog Engine — JSON-driven page layout from pages[] config
     2. Product Modal  — supermarket-style product detail popup
     3. Debug Mode     — page coordinate helper (?debug)
     4. Ads System     — periodic ad audio
     5. Music System   — background music crossfade
     6. Marquee Setup  — seamless scroll duplication
     7. Visibility     — pause audio on tab hide
   ============================================================ */


/* ── Tiny event bus for cross-module communication ── */
const tienda = (() => {
    const _handlers = {};
    return {
        /** Register a handler: tienda.on('openModal', fn) */
        on(event, fn) {
            (_handlers[event] ||= []).push(fn);
        },
        /** Emit an event: tienda.emit('openModal', product) */
        emit(event, ...args) {
            (_handlers[event] || []).forEach(fn => fn(...args));
        },
    };
})();


/****************************
 * 1. CATALOG ENGINE — JSON-DRIVEN PAGES
 *
 * Reads catalog.json with a pages[] array.
 * Each page explicitly defines its template, background,
 * logo, and products (by ID) — no auto-distribution.
 * Templates: A) 1-featured, B) 2-split, C) 2S-1L, D) 1-left-featured
 * Cover and back-cover are auto-generated from config.
 * Frames, splashes, and corner effects are auto-rotated.
 ****************************/

(() => {
    const CATALOG_URL = 'catalog.json';
    const FRONT_SHADE = 'assets/front_page_edge_shading.webp';
    const BACK_SHADE  = 'assets/back_page_edge_shading.webp';

    const catalogRoot = document.getElementById('catalog-root');
    const dynamicCSS  = document.getElementById('dynamic-flipbook-css');
    if (!catalogRoot || !dynamicCSS) return;

    /* ── Rotation helpers ── */
    const rotator = (arr) => { let i = 0; return () => arr[(i++) % arr.length]; };

    /* Frame rotation pools by slot size */
    const LARGE_FRAMES  = ['tall', 'featured-2', 'featured-3', 'featured-1'];
    const MEDIUM_FRAMES = ['square-lg', 'featured-1', 'featured-2', 'tall'];
    const SMALL_FRAMES  = ['rounded', 'square-sm', 'square-sm2', 'square-lg'];

    /* Splash rotation pools by slot size */
    const LARGE_SPLASHES  = ['large', 'wide', 'medium-1', 'medium-3'];
    const MEDIUM_SPLASHES = ['medium-1', 'medium-2', 'medium-4', 'large'];
    const SMALL_SPLASHES  = ['star-1', 'star-2', 'burst-1', 'burst-2', 'burst-3', 'burst-4', 'burst-5', 'medium-2'];

    /* ── Layout template definitions ──
       Each template defines slots as {x, y, width, height} percentages,
       plus the frame/splash pool to draw from, and splash position overrides.
    */

    /* Template A: single featured product */
    const TEMPLATE_A = {
        name: '1-featured',
        slots: [
            {
                x: 8, y: 14, width: 84, height: 72,
                framePool: 'large', splashPool: 'large',
                splashX: 2, splashY: 60, splashW: 38, splashH: 34,
                noBigSplash: true
            }
        ]
    };

    /* Template B: two products side by side */
    const TEMPLATE_B = {
        name: '2-split',
        slots: [
            {
                x: 4, y: 6, width: 44, height: 66,
                framePool: 'medium', splashPool: 'medium',
                splashX: 2, splashY: 58, splashW: 52, splashH: 38
            },
            {
                x: 50, y: 26, width: 44, height: 66,
                framePool: 'medium', splashPool: 'medium',
                splashX: 2, splashY: 58, splashW: 52, splashH: 38
            }
        ]
    };

    /* Template C: 2 small left + 1 large right (magazine) */
    const TEMPLATE_C = {
        name: '2S-1L',
        slots: [
            {
                x: 48, y: 16, width: 48, height: 70,
                framePool: 'large', splashPool: 'large',
                splashX: 55, splashY: 72, splashW: 55, splashH: 34
            },
            {
                x: 6, y: 8, width: 40, height: 34,
                framePool: 'small', splashPool: 'small',
                splashX: -8, splashY: -10, splashW: 65, splashH: 55
            },
            {
                x: 6, y: 46, width: 40, height: 36,
                framePool: 'small', splashPool: 'small',
                splashX: -8, splashY: 26, splashW: 65, splashH: 55
            }
        ]
    };

    /* Template D: 1 featured product on the left
       Large frame on left side, splash on the right,
       price and info at bottom-right. */
    const TEMPLATE_D = {
        name: '1-left-featured',
        slots: [
            {
                x: 5, y: 18, width: 55, height: 68,
                framePool: 'large', splashPool: 'large',
                splashX: 55, splashY: 30, splashW: 36, splashH: 30,
                textLayout: 'right-of-image'
            }
        ]
    };

    /** Template registry — look up templates by name for JSON-driven config */
    const TEMPLATES = {
        '1-featured':      TEMPLATE_A,
        '2-split':         TEMPLATE_B,
        '2S-1L':           TEMPLATE_C,
        '1-left-featured': TEMPLATE_D,
    };

    /* FACE_CONFIG removed — page layout is now fully JSON-driven via catalog.pages[] */

    /* ── DOM helpers ── */

    const posEl = (tag, className, x, y, w, h) => {
        const el = document.createElement(tag);
        if (className) el.className = className;
        el.style.cssText = 'position:absolute;left:' + x + '%;top:' + y + '%;width:' + w + '%;height:' + h + '%;';
        return el;
    };

    /* ── Shared element builders ── */

    /** Build $XX.CC price element with the given wrapper class */
    const buildPriceEl = (price, cents, className) => {
        const wrap = document.createElement('div');
        wrap.className = className;
        const d = document.createElement('span'); d.className = 'catalog-price-dollar'; d.textContent = '$';
        const a = document.createElement('span'); a.className = 'catalog-price-amount'; a.textContent = String(price);
        const c = document.createElement('span'); c.className = 'catalog-price-cents';  c.textContent = cents || '00';
        wrap.appendChild(d); wrap.appendChild(a); wrap.appendChild(c);
        return wrap;
    };

    /** Build splash-with-price (image + price overlay) */
    const buildSplashEl = (product, slot, splashSrc, assets) => {
        const splashWrap = document.createElement('div');
        splashWrap.className = 'catalog-splash';
        // Product-level overrides take priority over slot defaults
        const sx = product.splashX != null ? product.splashX : slot.splashX;
        const sy = product.splashY != null ? product.splashY : slot.splashY;
        const sw = product.splashW != null ? product.splashW : slot.splashW;
        const sh = product.splashH != null ? product.splashH : slot.splashH;
        if (sx != null) splashWrap.style.left = sx + '%';
        if (product.splashRight != null) { splashWrap.style.right = product.splashRight + '%'; splashWrap.style.left = 'auto'; }
        if (!product.splashBottom && sy != null) { splashWrap.style.top = sy + '%'; splashWrap.style.bottom = 'auto'; }
        if (sw != null) splashWrap.style.width  = sw + '%';
        if (sh != null) splashWrap.style.height = sh + '%';

        const splashImg = document.createElement('img');
        splashImg.className = 'catalog-splash-img';
        splashImg.src = splashSrc;
        splashImg.alt = '';
        splashImg.loading = 'lazy';
        splashWrap.appendChild(splashImg);

        // Per-image splash scaling (from catalog.json assets.splashScales)
        const scales = assets.splashScales || {};
        for (const [fragment, scale] of Object.entries(scales)) {
            if (splashSrc.includes(fragment)) {
                splashImg.style.transform = 'scale(' + scale + ')';
                splashImg.style.transformOrigin = 'center';
                break;
            }
        }

        if (!product.splashNoPrice) {
            splashWrap.appendChild(buildPriceEl(product.price, product.cents, 'catalog-price-container'));
        }
        return splashWrap;
    };

    /* ── Build a single product card ── */

    const buildProduct = ({ product, slot, assets, frameRotators, splashRotators, templateName, pageCornerEffects, pageBigSplash }) => {
        const wrapper = posEl('div', 'catalog-product', slot.x, slot.y, slot.width, slot.height);
        wrapper.dataset.productId = product.id;

        // Pick frame & splash from pool rotation
        const poolKey = slot.framePool || 'medium';
        const frame = frameRotators[poolKey]();
        const splash = splashRotators[slot.splashPool || 'medium']();

        wrapper.dataset.frame = frame;

        const imageArea = document.createElement('div');
        imageArea.className = 'catalog-image-area';

        // Frame image
        if (assets.frames[frame]) {
            const frameImg = document.createElement('img');
            frameImg.className = 'catalog-frame';
            frameImg.src = assets.frames[frame];
            frameImg.alt = '';
            frameImg.loading = 'lazy';
            imageArea.appendChild(frameImg);
        }

        // Product photo clipped inside frame
        if (product.image) {
            const clipDiv = document.createElement('div');
            clipDiv.className = 'catalog-image-clip';
            if (product.imageBg) clipDiv.style.backgroundColor = product.imageBg;
            const prodImg = document.createElement('img');
            prodImg.className = 'catalog-product-image';
            prodImg.src = product.image;
            prodImg.alt = product.name || '';
            prodImg.loading = 'lazy';
            clipDiv.appendChild(prodImg);
            imageArea.appendChild(clipDiv);
        }

        // Price splash
        const splashSrc = product.splashOverride || assets.splashes[splash];
        if (product.price != null && splashSrc && !product.noSplash) {
            imageArea.appendChild(buildSplashEl(product, slot, splashSrc, assets));
        } else if (product.price != null && !product.noSplash) {
            // Standalone price (no splash image available)
            const priceWrap = document.createElement('div');
            priceWrap.className = 'catalog-price-standalone';
            priceWrap.appendChild(buildPriceEl(product.price, product.cents, 'catalog-price-container'));
            imageArea.appendChild(priceWrap);
        }

        // Badge
        if (product.badge) {
            const badge = document.createElement('span');
            badge.className = 'catalog-badge';
            badge.textContent = product.badge;
            imageArea.appendChild(badge);
        }

        // Subtitle
        if (product.subtitle) {
            const sub = document.createElement('span');
            sub.className = 'catalog-subtitle';
            sub.textContent = product.subtitle;
            imageArea.appendChild(sub);
        }

        // Corner effects: per-product noCornerEffect takes priority, then per-product cornerEffect forces it, then per-page override, then pool default
        const showCorners = product.noCornerEffect
            ? false
            : product.cornerEffect
                ? true
                : pageCornerEffects !== undefined
                    ? pageCornerEffects
                    : (poolKey === 'small' || poolKey === 'medium');
        if (showCorners) {
            addFrameCornerEffects(imageArea, assets, product.cornerPosition || null);
        }

        // Per-product big splash override (takes priority over everything)
        if (product.bigSplash) {
            addBigSplash(imageArea, slot, assets, templateName, product.bigSplash);
        } else {
            // Big splash: default = large frames + no noBigSplash flag; overridable per-page via JSON
            const showBigSplash = pageBigSplash !== undefined
                ? pageBigSplash
                : (poolKey === 'large' && !slot.noBigSplash);
            if (showBigSplash) {
                addBigSplash(imageArea, slot, assets, templateName);
            }
        }

        wrapper.appendChild(imageArea);

        // Product name
        if (product.name) {
            const nameEl = document.createElement('span');
            nameEl.className = 'catalog-product-name';
            if (slot.textSide) nameEl.classList.add('catalog-text-' + slot.textSide);
            nameEl.textContent = product.name;
            wrapper.appendChild(nameEl);
        }

        // Info
        if (product.stock || product.info) {
            const infoEl = document.createElement('div');
            infoEl.className = 'catalog-product-info';
            if (slot.textSide) infoEl.classList.add('catalog-text-' + slot.textSide);
            const lines = [];
            if (product.info) lines.push(product.info);
            if (product.stock) lines.push('Stock: ' + product.stock);
            infoEl.innerHTML = lines.join('<br>');
            wrapper.appendChild(infoEl);
        }

        // If textLayout is 'left-of-image' or 'right-of-image', move name+info to an absolute container
        if (slot.textLayout === 'left-of-image' || slot.textLayout === 'right-of-image') {
            const textBlock = document.createElement('div');
            textBlock.className = 'catalog-text-' + slot.textLayout;

            // Add red price above name
            if (product.price != null) {
                textBlock.appendChild(buildPriceEl(product.price, product.cents, 'catalog-text-price'));
            }

            const nameEl = wrapper.querySelector('.catalog-product-name');
            const infoEl = wrapper.querySelector('.catalog-product-info');
            if (nameEl) textBlock.appendChild(nameEl);
            if (infoEl) textBlock.appendChild(infoEl);
            wrapper.appendChild(textBlock);
        }

        // Accessibility
        if (product.noModal) {
            wrapper.setAttribute('role', 'img');
            wrapper.removeAttribute('tabindex');
            wrapper.style.cursor = 'default';
            wrapper.classList.add('catalog-product--no-modal');
        } else {
            wrapper.setAttribute('role', 'button');
            wrapper.setAttribute('tabindex', '0');
        }
        wrapper.setAttribute('aria-label', (product.name || 'Producto') + (product.price != null ? ' — $' + product.price : ''));

        // Click & keyboard → modal
        if (!product.noModal) {
            const openModal = (e) => {
                e.stopPropagation();
                if (document.body.classList.contains('debug-active')) return;
                tienda.emit('openModal', product);
            };
            wrapper.addEventListener('click', openModal);
            wrapper.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    openModal(e);
                }
            });
        }

        return wrapper;
    };

    /* ── Build decorative elements ── */

    const buildLogo = (assets, variant, x, y, w, h, src) => {
        const logoSrc = src || assets.logos[variant || 'dark'];
        if (!logoSrc) return null;
        const wrap = posEl('div', 'catalog-logo', x, y, w, h);
        const img = document.createElement('img');
        img.className = 'catalog-logo-img';
        img.src = logoSrc;
        img.alt = 'GDLDENOXE';
        img.loading = 'lazy';
        wrap.appendChild(img);
        return wrap;
    };

    const buildTitle = (text, x, y, w, h, fontSize, color, fontFamily) => {
        const el = posEl('div', 'catalog-title', x, y, w, h);
        el.textContent = text;
        if (fontSize) el.style.fontSize = fontSize;
        if (color) el.style.color = color;
        if (fontFamily) el.style.fontFamily = fontFamily;
        return el;
    };

    const buildDisclaimer = (x, y, w, h) => {
        const el = posEl('div', 'catalog-disclaimer', x || 3, y || 92, w || 94, h || 7);
        el.textContent = '*Aplican restricciones. Promoción válida hasta agotar stock de cada producto. Imágenes referenciales. Encuentras más productos y marcas en www.guadalajaradenoxe.com';
        return el;
    };

    const buildQuote = (x, y, w, h) => {
        const wrap = posEl('div', 'catalog-quote', x, y, w, h);
        const inner = document.createElement('div');
        inner.className = 'catalog-quote-inner';
        const bg = document.createElement('div');
        bg.className = 'catalog-quote-bg';
        inner.appendChild(bg);
        const text = document.createElement('div');
        text.className = 'catalog-quote-text';

        const esGratis = document.createElement('strong');
        esGratis.className = 'quote-line-highlight';
        esGratis.textContent = 'ES GRATIS';
        const middle = document.createElement('span');
        middle.className = 'quote-line-sub';
        middle.textContent = 'disfrutar de las cosas que';
        const deNoche = document.createElement('strong');
        deNoche.className = 'quote-line-main';
        deNoche.textContent = 'DE NOCHE';
        const noTienen = document.createElement('span');
        noTienen.className = 'quote-line-highlight quote-line-sub';
        noTienen.textContent = 'NO TIENEN PRECIO..';

        text.appendChild(esGratis);
        text.appendChild(middle);
        text.appendChild(deNoche);
        text.appendChild(noTienen);
        inner.appendChild(text);
        wrap.appendChild(inner);
        return wrap;
    };

    /* ── Big splash system (for large frames) ──
       Position is specified per-image in catalog.json using named positions.
       Available positions:
         top-left, top-center, top-right,
         middle-left, middle-right,
         bottom-left, bottom-center, bottom-right
    */

    // Image metadata: natural aspect ratios for sizing
    const BIG_SPLASH_META = {
        'image1126': { w: 416, h: 301, ratio: 416/301 },  // wide
        'image3732': { w: 251, h: 251, ratio: 1 },         // square
        'image4252': { w: 629, h: 527, ratio: 629/527 },   // slightly wide
        'path4038':  { w: 353, h: 254, ratio: 353/254 },    // wide
    };

    const getBigSplashMeta = (src) => {
        for (const key of Object.keys(BIG_SPLASH_META)) {
            if (src.includes(key)) return BIG_SPLASH_META[key];
        }
        return { w: 400, h: 300, ratio: 4/3 }; // fallback
    };

    // Named positions → CSS coordinates (% relative to imageArea)
    const NAMED_POSITIONS = {
        'top-left':       { left: -10, top: -8,  cssW: 55 },
        'top-center':     { left: 20,  top: -12, cssW: 52 },
        'top-right':      { left: 55,  top: -8,  cssW: 55 },
        'middle-left':    { left: -12, top: 30,  cssW: 50 },
        'middle-center':  { left: 65,  top: 15,  cssW: 93 },
        'middle-right':   { left: 62,  top: 30,  cssW: 50 },
        'bottom-left':    { left: -10, top: 60,  cssW: 55 },
        'bottom-center':  { left: 20,  top: 65,  cssW: 52 },
        'bottom-right':   { left: 55,  top: 60,  cssW: 55 },
    };

    let bigSplashRotator = null;

    const addBigSplash = (imageArea, slot, assets, templateName, forcedEntry) => {
        const bigs = assets.bigSplashes;
        if (!forcedEntry && (!bigs || !bigs.length)) return;
        if (!forcedEntry && !bigSplashRotator) bigSplashRotator = rotator(bigs);

        const entry = forcedEntry || bigSplashRotator();
        // Support both old format (string) and new format (object with src + position)
        const src = typeof entry === 'string' ? entry : entry.src;
        const posName = (typeof entry === 'object' && entry.position) ? entry.position : 'top-right';

        const meta = getBigSplashMeta(src);
        const pos = NAMED_POSITIONS[posName] || NAMED_POSITIONS['top-right'];
        const offsetX = (typeof entry === 'object' && entry.offsetX != null) ? entry.offsetX : 0;
        const offsetY = (typeof entry === 'object' && entry.offsetY != null) ? entry.offsetY : 0;
        const offsetW = (typeof entry === 'object' && entry.offsetW != null) ? entry.offsetW : 0;

        const wrap = document.createElement('div');
        wrap.className = 'catalog-big-splash';
        wrap.style.left = (pos.left + offsetX) + '%';
        wrap.style.top = (pos.top + offsetY) + '%';
        wrap.style.width = (pos.cssW + offsetW) + '%';
        const img = document.createElement('img');
        img.src = src;
        img.alt = '';
        img.loading = 'lazy';
        wrap.appendChild(img);
        imageArea.appendChild(wrap);
    };

    /* ── Corner effect rotator ── */
    let cornerEffectRotator = null;

    const cornerPositions = ['tl', 'tr', 'bl', 'br'];
    let cornerPosIdx = 0;

    const addFrameCornerEffects = (imageArea, assets, forcedPos) => {
        const corners = assets.cornerEffects;
        if (!corners || !corners.length) return;
        if (!cornerEffectRotator) cornerEffectRotator = rotator(corners);

        // Pick one corner per product, cycling through positions
        const pos = forcedPos || cornerPositions[cornerPosIdx % cornerPositions.length];
        cornerPosIdx++;

        const wrap = document.createElement('div');
        wrap.className = 'catalog-corner-effect corner-' + pos;
        const img = document.createElement('img');
        img.src = cornerEffectRotator();
        img.alt = '';
        img.loading = 'lazy';
        wrap.appendChild(img);
        imageArea.appendChild(wrap);
    };

    /* ── Build a single page face (shell: bg + shadow + shading + label) ── */

    const buildFaceShell = (faceClass, shadingSrc, bgSrc, checkboxId, assets) => {
        const face = document.createElement('div');
        face.className = faceClass;

        // Background
        const bgImg = document.createElement('div');
        bgImg.className = 'catalog-bg';
        bgImg.style.backgroundImage = 'url("' + bgSrc + '")';
        face.appendChild(bgImg);

        // Edge shading
        const shade = document.createElement('img');
        shade.className = 'edge_shading';
        shade.src = shadingSrc;
        shade.alt = '';
        shade.loading = 'lazy';
        face.appendChild(shade);

        // Flip label
        const label = document.createElement('label');
        label.setAttribute('for', checkboxId);
        face.appendChild(label);

        return face;
    };

    /* ── Auto-layout: build face groups from JSON page configs ──
       Each entry in catalog.pages[] explicitly defines its template,
       background, logo, and products (by ID).
       Returns an array of face-data objects.
    */

    const autoLayout = (pages, productMap, assets) => {
        // Shared rotators persist across all faces for variety
        const frameRot = {
            large:  rotator(LARGE_FRAMES),
            medium: rotator(MEDIUM_FRAMES),
            small:  rotator(SMALL_FRAMES)
        };
        const splashRot = {
            large:  rotator(LARGE_SPLASHES),
            medium: rotator(MEDIUM_SPLASHES),
            small:  rotator(SMALL_SPLASHES)
        };

        return pages.map(page => {
            const tmpl = TEMPLATES[page.template] || TEMPLATE_A;

            // Resolve products by ID; blank pages have no products array
            const faceProducts = page._blank
                ? [{ _blank: true }]
                : (page.products || []).map(id => {
                    const p = productMap[id];
                    if (!p) console.warn('[tienda] Product not found:', id);
                    return p || { _blank: true, name: id };
                });

            return {
                bgSrc: page.background || bgRotate(),
                template: tmpl,
                products: faceProducts,
                frameRotators: frameRot,
                splashRotators: splashRot,
                noLogo: !!page.noLogo,
                logoConfig: page.logo || null,
                // Optional per-page overrides (undefined = use defaults)
                cornerEffects: page.cornerEffects,
                bigSplash: page.bigSplash,
            };
        });
    };

    /* ── Build cover face (front of first page) ── */

    const buildCoverFace = (catalog, checkboxId, assets) => {
        const cover = catalog.cover || {};
        const bgSrc = 'assets/webAssets/pages/page1.webp';

        // Build cover WITHOUT shadows or edge shading
        const face = document.createElement('div');
        face.className = 'front_page';

        // Background — high priority since it's the first visible content
        const bgImg = document.createElement('div');
        bgImg.className = 'catalog-bg';
        bgImg.style.backgroundImage = 'url("' + bgSrc + '")';
        face.appendChild(bgImg);

        // Preload cover image with high priority
        const preloadLink = document.createElement('link');
        preloadLink.rel = 'preload';
        preloadLink.as = 'image';
        preloadLink.href = bgSrc;
        preloadLink.fetchPriority = 'high';
        document.head.appendChild(preloadLink);

        const label = document.createElement('label');
        label.setAttribute('for', checkboxId);
        face.appendChild(label);

        // Logo is already part of page1.webp — no dynamic logo needed

        return face;
    };

    /* ── Build back-cover face (back of last page) ── */

    const buildBackCoverFace = (catalog, checkboxId, assets) => {
        const bc = catalog.backCover || {};
        const bgSrc = assets.backgrounds[2 % assets.backgrounds.length];
        const face = buildFaceShell('back_page', BACK_SHADE, bgSrc, checkboxId, assets);

        const logo = buildLogo(assets, 'dark', 10, 15, 80, 18);
        if (logo) face.appendChild(logo);

        if (bc.title)    face.appendChild(buildTitle(bc.title, 8, 38, 84, 12, '1.2rem', '#CC0000'));
        if (bc.subtitle) face.appendChild(buildTitle(bc.subtitle, 10, 53, 80, 14, '0.5rem', '#FFFFFF'));
        if (bc.url)      face.appendChild(buildTitle(bc.url, 12, 72, 76, 8, '0.55rem', '#FFD700', 'Tahoma, sans-serif'));

        return face;
    };

    /* ── Build a content face from auto-layout data ── */

    const buildContentFace = (faceData, faceClass, shadingSrc, checkboxId, assets, faceIndex) => {
        // Blank page: just background, no products or decorations
        if (faceData.products.length === 1 && faceData.products[0]._blank) {
            const face = buildFaceShell(faceClass, shadingSrc, faceData.bgSrc, checkboxId, assets);
            return face;
        }

        const face = buildFaceShell(faceClass, shadingSrc, faceData.bgSrc, checkboxId, assets);

        // Template D: remove edge shading (background image already has border)
        if (faceData.template === TEMPLATE_D) {
            const shading = face.querySelector('.edge_shading');
            if (shading) shading.remove();
        }

        // Template D: no shadow overlay — uses dedicated background image

        // Logo — position comes from FACE_CONFIG (bundled with template)
        let logo;
        if (faceData.noLogo) {
            logo = null;
        } else if (faceData.logoConfig) {
            const lc = faceData.logoConfig;
            logo = buildLogo(assets, lc.variant || 'dark', lc.x, lc.y, lc.w, lc.h, lc.src || null);
        } else {
            logo = buildLogo(assets, 'dark', 10, 2, 80, 14);
        }
        if (logo) face.appendChild(logo);

        // Border color: always red for Template D, alternates for others
        const borderClass = (faceData.template === TEMPLATE_D) ? 'catalog-border-red' : (faceIndex % 2 === 0) ? 'catalog-border-red' : 'catalog-border-black';

        // Products in their template slots
        faceData.products.forEach((product, i) => {
            const slot = faceData.template.slots[i];
            if (!slot) return;
            const card = buildProduct({
                product, slot, assets,
                frameRotators: faceData.frameRotators,
                splashRotators: faceData.splashRotators,
                templateName: faceData.template.name,
                // Per-page overrides from JSON (undefined = use defaults)
                pageCornerEffects: faceData.cornerEffects,
                pageBigSplash: faceData.bigSplash,
            });
            card.classList.add(borderClass);
            face.appendChild(card);
        });

        // Disclaimer
        face.appendChild(buildDisclaimer(3, 93, 94, 6));

        return face;
    };

    /* ── Dynamic CSS for N pages ── */

    const generateDynamicCSS = (N) => {
        let css = '/* Auto-generated: ' + N + ' pages */\n';
        for (let i = 1; i <= N; i++) {
            const z = (i === 1) ? N + 3 : N - i + 2;
            css += '#page' + i + ' { z-index: ' + z + '; }\n';
        }
        for (let i = 1; i <= N; i++) {
            const z = (i === N) ? N + 4 : i + 2;
            css += '#page' + i + '_checkbox:checked ~ #flip_book #page' + i +
                   ' { transform: rotateY(-180deg); z-index: ' + z + '; }\n';
        }
        const ids = [];
        for (let i = 1; i <= N; i++) ids.push('#page' + i + '_checkbox');
        css += ':is(' + ids.join(', ') + '):checked ~ #flip_book { transform: translateX(50%) scale(1.03); }\n';
        dynamicCSS.textContent = css;
    };

    /* ── Main build ── */

    const buildFlipbook = (catalog) => {
        const { products, pages, marqueeText, assets } = catalog;

        // Update marquee
        if (marqueeText) {
            document.querySelectorAll('.marquee-text').forEach(el => {
                el.textContent = marqueeText;
            });
        }

        // Build product lookup map (by id)
        const productMap = {};
        (products || []).forEach(p => { if (p.id) productMap[p.id] = p; });

        // Generate content faces from explicit page configs
        const contentFaces = autoLayout(pages || [], productMap, assets);

        // Pair faces into physical pages: each page has front + back
        // Page 1: front = cover, back = content[0]
        // Pages 2..N-1: front = content[i], back = content[i+1]
        // Last page: front = content[last] or filler, back = backCover

        const pagePairs = [];

        if (contentFaces.length === 0) {
            pagePairs.push({ front: 'cover', back: 'backCover' });
        } else {
            // Page 1: cover + first content
            pagePairs.push({ front: 'cover', back: contentFaces[0] });

            // Pair remaining content faces two at a time
            let fi = 1;
            while (fi < contentFaces.length) {
                if (fi + 1 < contentFaces.length) {
                    pagePairs.push({ front: contentFaces[fi], back: contentFaces[fi + 1] });
                    fi += 2;
                } else {
                    // Odd face left — it becomes front, backCover is back
                    pagePairs.push({ front: contentFaces[fi], back: 'backCover' });
                    fi++;
                }
            }

            // If the last page's back isn't the backCover yet, add it
            const lastPair = pagePairs[pagePairs.length - 1];
            if (lastPair.back !== 'backCover') {
                // Need a filler front for the backCover page
                pagePairs.push({ front: 'filler', back: 'backCover' });
            }
        }

        const N = pagePairs.length;
        const frag = document.createDocumentFragment();
        const wrapper = document.createElement('div');
        wrapper.className = 'flipbook-scale-wrapper';

        // Checkboxes (CSS flip mechanism)
        for (let i = 1; i <= N; i++) {
            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.id = 'page' + i + '_checkbox';
            wrapper.appendChild(cb);
        }

        const book = document.createElement('div');
        book.id = 'flip_book';

        pagePairs.forEach((pair, idx) => {
            const i = idx + 1;
            const cbId = 'page' + i + '_checkbox';
            const pageDiv = document.createElement('div');
            pageDiv.className = 'page';
            pageDiv.id = 'page' + i;

            // ─── Front face ───
            let frontFace;
            if (pair.front === 'cover') {
                frontFace = buildCoverFace(catalog, cbId, assets);
            } else if (pair.front === 'filler') {
                // Decorative filler page with quote
                const bgSrc = assets.backgrounds[1 % assets.backgrounds.length];
                frontFace = buildFaceShell('front_page', FRONT_SHADE, bgSrc, cbId, assets);
                const logo = buildLogo(assets, 'dark', 5, 5, 60, 12);
                if (logo) frontFace.appendChild(logo);
                frontFace.appendChild(buildQuote(20, 20, 55, 45));
                frontFace.appendChild(buildTitle('EDICIÓN LIMITADA', 10, 72, 80, 10, '0.8rem', '#FFD700'));
                frontFace.appendChild(buildDisclaimer(3, 93, 94, 6));
            } else {
                frontFace = buildContentFace(pair.front, 'front_page', FRONT_SHADE, cbId, assets, idx * 2);
            }
            pageDiv.appendChild(frontFace);

            // ─── Back face ───
            let backFace;
            if (pair.back === 'backCover') {
                backFace = buildBackCoverFace(catalog, cbId, assets);
            } else {
                backFace = buildContentFace(pair.back, 'back_page', BACK_SHADE, cbId, assets, idx * 2 + 1);
            }
            pageDiv.appendChild(backFace);

            book.appendChild(pageDiv);
        });

        wrapper.appendChild(book);
        frag.appendChild(wrapper);
        catalogRoot.appendChild(frag);
        generateDynamicCSS(N);

        requestAnimationFrame(() => resizeFlipbook());
    };

    /* ── Responsive scaling ── */

    const DESIGN_W = 298;
    const DESIGN_H = 420;
    /* Open spread is ~2 pages wide (translateX(50%) doubles the visual footprint) */
    const SPREAD_W = DESIGN_W * 2;

    const resizeFlipbook = () => {
        const wrapper = document.querySelector('.flipbook-scale-wrapper');
        if (!wrapper) return;

        const marqueeH = document.getElementById('marquee-bar')?.offsetHeight || 40;
        const availW = window.innerWidth - 16;
        const availH = window.innerHeight - marqueeH - 32;
        /* Scale to fit the OPEN spread (2 pages) so nothing is ever clipped */
        const scale = Math.min(availW / SPREAD_W, availH / DESIGN_H, 2.5);

        wrapper.style.transform = 'scale(' + scale + ') translateZ(0)';
        wrapper.style.transformOrigin = 'center center';
        wrapper.style.width  = DESIGN_W + 'px';
        wrapper.style.height = DESIGN_H + 'px';

        const root = document.getElementById('catalog-root');
        if (root) {
            root.style.width  = (SPREAD_W * scale) + 'px';
            root.style.height = (DESIGN_H * scale) + 'px';
        }
    };

    let resizeTimer = null;
    window.addEventListener('resize', () => {
        clearTimeout(resizeTimer);
        resizeTimer = setTimeout(resizeFlipbook, 80);
    }, { passive: true });

    document.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox' && e.target.id.includes('_checkbox')) {
            /* Temporarily elevate the flipping page so it stays ON TOP of
               both unchecked AND already-checked pages during the 0.5s CSS
               flip animation.  Without this, later pages (whose unchecked
               z-index is low) appear to flip behind the book. */
            const pageId = e.target.id.replace('_checkbox', '');
            const pageEl = document.getElementById(pageId);
            if (pageEl) {
                const N = document.querySelectorAll('#flip_book > .page').length;
                pageEl.style.zIndex = N + 10;
                setTimeout(() => { pageEl.style.zIndex = ''; }, 520);
            }
            setTimeout(resizeFlipbook, 600);
        }
    });

    tienda.on('resize', resizeFlipbook);

    /* ── Mobile detection ── */
    /* If innerWidth is 0 the page is likely inside a hidden iframe
       (e.g. the Win95 desktop loads the tienda in a display:none window).
       Treat 0-width as desktop so the flipbook gets built. */
    const isMobileWidth = () => {
        const w = window.innerWidth;
        return w > 0 && w <= 480;
    };

    /* ─────────────────────────────────────────────────────────
       MOBILE STORE — Win95 card grid (image + price)
       ───────────────────────────────────────────────────────── */

    const buildMobileStore = (catalog) => {
        const { products, assets, marqueeText } = catalog;

        if (marqueeText) {
            document.querySelectorAll('.marquee-text').forEach(el => {
                el.textContent = marqueeText;
            });
        }

        const purchasable = (products || []).filter(p => !p.noModal && !p.mobileHide && p.price != null);

        const store = document.createElement('div');
        store.className = 'mobile-store';

        // Logo
        if (assets && assets.logos && assets.logos.dark) {
            const logoWrap = document.createElement('div');
            logoWrap.className = 'ms-logo-wrap';
            const logoImg = document.createElement('img');
            logoImg.className = 'ms-logo';
            logoImg.src = assets.logos.dark;
            logoImg.alt = 'GDLDENOXE';
            logoWrap.appendChild(logoImg);
            store.appendChild(logoWrap);
        }

        // Grid
        const grid = document.createElement('div');
        grid.className = 'ms-grid';

        purchasable.forEach(product => {
            const card = document.createElement('div');
            card.className = 'ms-card';

            // Image
            const imgWrap = document.createElement('div');
            imgWrap.className = 'ms-img-wrap';
            if (product.imageBg) imgWrap.style.backgroundColor = product.imageBg;
            if (product.image) {
                const img = document.createElement('img');
                img.className = 'ms-img';
                img.src = product.image;
                img.alt = product.name || '';
                img.loading = 'lazy';
                imgWrap.appendChild(img);
            }
            card.appendChild(imgWrap);

            // Info area: title + description + price
            const info = document.createElement('div');
            info.className = 'ms-info';

            if (product.name) {
                const title = document.createElement('div');
                title.className = 'ms-title';
                title.textContent = product.name;
                info.appendChild(title);
            }

            if (product.description) {
                const desc = document.createElement('div');
                desc.className = 'ms-desc';
                desc.textContent = product.description;
                info.appendChild(desc);
            }

            if (product.price != null) {
                const priceEl = document.createElement('div');
                priceEl.className = 'ms-price';
                priceEl.textContent = '$' + product.price + '.' + (product.cents || '00');
                info.appendChild(priceEl);
            }

            card.appendChild(info);

            card.addEventListener('click', () => tienda.emit('openModal', product));
            grid.appendChild(card);
        });

        store.appendChild(grid);
        catalogRoot.appendChild(store);

        // Let body scroll
        document.querySelector('main').style.overflow = 'visible';
        catalogRoot.style.overflow = 'visible';
    };

    /* ── Fetch & init ── */

    fetch(CATALOG_URL)
        .then(res => {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        })
        .then(catalog => {
            if (isMobileWidth()) {
                buildMobileStore(catalog);
            } else {
                buildFlipbook(catalog);
            }
        })
        .catch(err => {
            console.error('[Catalog Engine] Failed to load catalog:', err);
            const errP = document.createElement('p');
            errP.style.cssText = 'color:red;font-size:1rem;text-align:center;padding:2rem;';
            errP.textContent = 'Error cargando el catálogo. Verifica que catalog.json exista.';
            catalogRoot.textContent = '';
            catalogRoot.appendChild(errP);
        });
})();


/****************************
 * 2. PRODUCT MODAL SYSTEM
 * Opens a 2000s-supermarket-styled popup with product details
 * and an external purchase link.
 ****************************/

(() => {
    const modal = document.getElementById('product-modal');
    if (!modal) return;

    const overlay  = modal.querySelector('.modal-overlay');
    const closeBtn = modal.querySelector('.modal-close');
    const imgEl    = modal.querySelector('.modal-product-image');
    const nameEl   = modal.querySelector('.modal-product-name');
    const priceEl  = modal.querySelector('.modal-price-text');
    const descEl   = modal.querySelector('.modal-product-description');
    const badgeEl  = modal.querySelector('.modal-badge');
    const buyBtn   = modal.querySelector('.modal-buy-btn');

    let previousFocus = null;

    const srAnnounce = (msg) => {
        const sr = document.getElementById('sr-announcements');
        if (sr) sr.textContent = msg;
    };

    const show = () => {
        previousFocus = document.activeElement;
        modal.classList.remove('modal-hidden');
        modal.classList.add('modal-visible');
        // Focus the close button for keyboard users
        closeBtn?.focus();
    };

    const hide = () => {
        modal.classList.remove('modal-visible');
        modal.classList.add('modal-hidden');
        // Restore focus to the element that opened the modal
        previousFocus?.focus?.();
        previousFocus = null;
        srAnnounce('Detalle de producto cerrado');
    };

    tienda.on('openModal', (product) => {
        imgEl.src  = product.image || '';
        imgEl.alt  = product.name  || '';
        nameEl.textContent  = product.name || '';
        priceEl.textContent = (product.price != null)
            ? ('$' + product.price + (product.cents != null ? '.' + product.cents : '') + ' ' + (product.currency || 'MXN'))
            : '';
        descEl.textContent = product.description || '';

        if (product.badge) {
            badgeEl.textContent = product.badge;
            badgeEl.classList.add('has-badge');
        } else {
            badgeEl.classList.remove('has-badge');
        }

        buyBtn.href = product.link || '#';
        show();
        srAnnounce('Detalle de producto: ' + (product.name || 'Producto'));
    });

    // Close triggers
    closeBtn?.addEventListener('click', hide);
    overlay?.addEventListener('click', hide);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('modal-visible')) hide();
        // Focus trap: Tab cycles within the modal
        if (e.key === 'Tab' && modal.classList.contains('modal-visible')) {
            const focusable = modal.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])');
            if (!focusable.length) return;
            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (e.shiftKey && document.activeElement === first) {
                e.preventDefault();
                last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
                e.preventDefault();
                first.focus();
            }
        }
    });
})();


/****************************
 * 3. DEBUG MODE
 * Append ?debug to URL to activate.
 * - 10% grid overlay on every page face
 * - Click logs {x, y} percentages to console
 * - Hotspot boundaries drawn with dashed green
 * - Hotspot clicks don't open modal (so you can reposition)
 ****************************/

(() => {
    if (!new URLSearchParams(window.location.search).has('debug')) return;

    document.body.classList.add('debug-active');

    console.log(
        '%c[DEBUG MODE] Hotspot positioning helper active.\n' +
        'Click anywhere on a page face to log x/y percentages.',
        'color: #0f0; font-weight: bold; font-size: 13px;'
    );

    const tooltip = document.createElement('div');
    tooltip.className = 'debug-tooltip';
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);

    const observer = new MutationObserver(() => {
        const flipBook = document.getElementById('flip_book');
        if (!flipBook) return;
        observer.disconnect();

        flipBook.querySelectorAll('.front_page, .back_page').forEach(face => {
            const grid = document.createElement('div');
            grid.className = 'debug-grid';
            face.appendChild(grid);
        });
    });

    const root = document.getElementById('catalog-root') || document.body;
    observer.observe(root, { childList: true, subtree: true });

    let hideTimer = null;
    document.addEventListener('click', (e) => {
        const face = e.target.closest('.front_page, .back_page');
        if (!face) return;

        const rect = face.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width  * 100).toFixed(1);
        const y = ((e.clientY - rect.top)  / rect.height * 100).toFixed(1);
        const pageId = face.closest('.page')?.id || '?';
        const side   = face.classList.contains('front_page') ? 'front' : 'back';

        console.log(
            '%c[DEBUG] ' + pageId + ' ' + side + '  →  x: ' + x + '%,  y: ' + y + '%',
            'color: #0f0; font-size: 14px;'
        );

        tooltip.textContent = pageId + ' ' + side + ':  x=' + x + '%  y=' + y + '%';
        tooltip.style.left    = (e.clientX + 14) + 'px';
        tooltip.style.top     = (e.clientY - 32) + 'px';
        tooltip.style.display = 'block';
        clearTimeout(hideTimer);
        hideTimer = setTimeout(() => { tooltip.style.display = 'none'; }, 2500);
    }, true);
})();


/***********************
 * 4. ADVERTISEMENT SYSTEM
 ***********************/

(() => {
    const adAudio = document.getElementById('ad-audio');
    if (!adAudio) return;

    const AD_VOLUME_RATIO = 0.35;
    let adTimer = null;

    const playRandomAd = () => {
        if (document.hidden) return;
        const bgMusic = document.getElementById('background-music');
        if (bgMusic?.paused === false) {
            adAudio.volume = bgMusic.volume * AD_VOLUME_RATIO;
            adAudio.currentTime = 0;
            adAudio.play().catch(() => {});
        }
    };

    const scheduleNextAd = () => {
        const delay = (90 + Math.random() * 60) * 1000;
        adTimer = setTimeout(() => {
            playRandomAd();
            scheduleNextAd();
        }, delay);
    };

    const stopAds = () => {
        clearTimeout(adTimer);
        adTimer = null;
        adAudio.pause();
        adAudio.currentTime = 0;
    };

    const startAds = () => {
        clearTimeout(adTimer);
        adTimer = setTimeout(scheduleNextAd, 30000);
    };

    tienda.on('stopAds', stopAds);
    tienda.on('startAds', startAds);

    /* Expose globally so the parent frame can control ads. */
    window.startAds = startAds;
    window.stopAds  = stopAds;
})();


/*****************************
 * 5. BACKGROUND MUSIC (CROSSFADE)
 *****************************/

(() => {
    const backgroundMusic = document.getElementById('background-music');
    if (!backgroundMusic) return;

    const START_TIME   = 5;
    const END_OFFSET   = 5;
    const FADE_DURATION = 7;
    const FADE_STEPS   = 30;

    const bgClone = backgroundMusic.cloneNode(true);
    backgroundMusic.parentNode.appendChild(bgClone);

    let active   = backgroundMusic;
    let inactive = bgClone;
    let crossfadeTimer = null;
    const fadeIntervals = new Set();

    const fade = (audio, from, to, duration) => {
        const stepTime = (duration * 1000) / FADE_STEPS;
        const step = (to - from) / FADE_STEPS;
        let volume = from;
        audio.volume = from;

        const interval = setInterval(() => {
            volume += step;
            audio.volume = Math.max(0, Math.min(1, volume));
            if ((step > 0 && volume >= to) || (step < 0 && volume <= to)) {
                audio.volume = to;
                clearInterval(interval);
                fadeIntervals.delete(interval);
            }
        }, stepTime);
        fadeIntervals.add(interval);
    };

    const scheduleNextLoop = (audio) => {
        const dur = audio.duration;
        // Guard: if duration is not yet available (NaN), wait for metadata
        if (!isFinite(dur)) {
            audio.addEventListener('loadedmetadata', () => scheduleNextLoop(audio), { once: true });
            return;
        }
        const delay = Math.max(0, (dur - END_OFFSET - FADE_DURATION) * 1000);
        crossfadeTimer = setTimeout(crossfade, delay);
    };

    const crossfade = () => {
        // Bail if music was stopped between schedule and fire
        if (active.paused && inactive.paused) return;
        inactive.currentTime = START_TIME;
        inactive.play();
        fade(inactive, 0, 1, FADE_DURATION);
        fade(active, 1, 0, FADE_DURATION);
        [active, inactive] = [inactive, active];
        scheduleNextLoop(active);
    };

    backgroundMusic.volume = 0;
    bgClone.volume = 0;

    const stopMusic = () => {
        clearTimeout(crossfadeTimer);
        crossfadeTimer = null;
        fadeIntervals.forEach(clearInterval);
        fadeIntervals.clear();
        backgroundMusic.pause();
        backgroundMusic.volume = 0;
        bgClone.pause();
        bgClone.volume = 0;
    };

    const startMusic = () => {
        if (!active.paused) return;
        active.muted = false;
        active.currentTime = START_TIME;
        active.volume = 0;
        active.play().then(() => {
            fade(active, 0, 1, FADE_DURATION);
            scheduleNextLoop(active);
        }).catch(() => {});
    };

    tienda.on('stopMusic', stopMusic);
    tienda.on('startMusic', startMusic);

    /* Expose globally so the parent frame can trigger audio after
       the user clicks the tienda icon (user-activation is on the parent). */
    window.startMusic = startMusic;
    window.stopMusic  = stopMusic;
})();


/******************
 * 6. MARQUEE BAR SETUP
 ******************/

(() => {
    const marqueeContent = document.querySelector('.marquee-content');
    const marqueeText = document.querySelector('.marquee-text');
    if (marqueeContent && marqueeText) {
        marqueeContent.appendChild(marqueeText.cloneNode(true));
    }
})();


/************************
 * 7. AUTOPLAY + VISIBILITY / LIFECYCLE
 *
 * Browsers block audio until the user interacts with the page.
 * We listen for the first gesture, start music + ads, then remove
 * the listener so it only fires once.
 *
 * We also stop everything whenever the page becomes hidden
 * (tab switch, minimise, iframe hidden, page unload).
 ************************/

/* ── Start on first user interaction ── */
let _audioStarted = false;
const _startAudio = () => {
    if (_audioStarted) return;
    _audioStarted = true;
    tienda.emit('startMusic');
    tienda.emit('startAds');
};
['click', 'keydown', 'touchstart', 'pointerdown'].forEach(ev =>
    document.addEventListener(ev, _startAudio, { once: true, passive: true })
);

/* ── Stop when page/tab becomes invisible ── */
const _stopAudio = () => {
    tienda.emit('stopMusic');
    tienda.emit('stopAds');
};

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        _stopAudio();
    } else {
        tienda.emit('startMusic');
        tienda.emit('startAds');
    }
}, { passive: true });

/* pagehide fires when navigating away or the iframe src changes */
window.addEventListener('pagehide', _stopAudio, { passive: true });

/* freeze fires in bfcache-freezing browsers */
window.addEventListener('freeze', _stopAudio, { passive: true });


/*************************************
 * 8. FLIPBOOK NAVIGATION ARROWS
 * Windows 95-style Back / Next panel
 *************************************/

(() => {
    const backBtn   = document.getElementById('fnav-back');
    const nextBtn   = document.getElementById('fnav-next');
    const counter   = document.getElementById('fnav-counter');
    if (!backBtn || !nextBtn || !counter) return;

    const ANIM_MS = 620; // slightly longer than CSS transition (0.5s + buffer)
    let animating = false;

    /* Return ordered array of page checkboxes */
    const getCheckboxes = () => {
        const root = document.getElementById('catalog-root');
        if (!root) return [];
        return Array.from(root.querySelectorAll('input[type="checkbox"][id$="_checkbox"]'))
            .sort((a, b) => {
                const numA = parseInt(a.id.replace(/\D+/g, ''), 10);
                const numB = parseInt(b.id.replace(/\D+/g, ''), 10);
                return numA - numB;
            });
    };

    const updateNav = () => {
        const boxes = getCheckboxes();
        const N = boxes.length;
        const checked = boxes.filter(cb => cb.checked).length;
        /* Spread 1 = cover (0 checked), spreads go up to N checked */
        const page = checked + 1;
        const total = N + 1;
        counter.textContent = page + ' / ' + total;
        backBtn.disabled = animating || (checked === 0);
        nextBtn.disabled = animating || (checked === N);
    };

    const lockButtons = () => {
        animating = true;
        backBtn.disabled = true;
        nextBtn.disabled = true;
        setTimeout(() => {
            animating = false;
            updateNav();
        }, ANIM_MS);
    };

    const announce = (msg) => {
        const sr = document.getElementById('sr-announcements');
        if (sr) sr.textContent = msg;
    };

    const goBack = () => {
        if (animating) return;
        const boxes = getCheckboxes();
        /* Find last checked checkbox and uncheck it */
        for (let i = boxes.length - 1; i >= 0; i--) {
            if (boxes[i].checked) {
                boxes[i].checked = false;
                boxes[i].dispatchEvent(new Event('change', { bubbles: true }));
                break;
            }
        }
        lockButtons();
        updateNav();
        announce('Página anterior');
    };

    const goNext = () => {
        if (animating) return;
        const boxes = getCheckboxes();
        /* Find first unchecked checkbox and check it */
        for (let i = 0; i < boxes.length; i++) {
            if (!boxes[i].checked) {
                boxes[i].checked = true;
                boxes[i].dispatchEvent(new Event('change', { bubbles: true }));
                break;
            }
        }
        lockButtons();
        updateNav();
        announce('Página siguiente');
    };

    backBtn.addEventListener('click', goBack);
    nextBtn.addEventListener('click', goNext);

    /* Also sync counter when any checkbox changes (e.g. clicking page labels) */
    document.addEventListener('change', (e) => {
        if (e.target.type === 'checkbox' && e.target.id.includes('_checkbox')) {
            updateNav();
        }
    });

    /* Watch for flipbook being injected into the DOM, then initialise counter */
    const observer = new MutationObserver(() => {
        if (getCheckboxes().length > 0) {
            observer.disconnect();
            updateNav();
        }
    });
    observer.observe(document.body, { childList: true, subtree: true });
})();
