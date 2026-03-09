/* ============================================================
   TIENDA GDLDENOXE — Virtual Store Flipbook Engine
   ============================================================
   Modules (in order):
     1. Catalog Engine — auto-layout from flat product list
     2. Product Modal  — supermarket-style product detail popup
     3. Debug Mode     — page coordinate helper (?debug)
     4. Ads System     — periodic ad audio
     5. Music System   — background music crossfade
     6. Marquee Setup  — seamless scroll duplication
     7. Mode Toggle    — light/dark theme
     8. Visibility     — pause audio on tab hide
   ============================================================ */


/****************************
 * 1. CATALOG ENGINE — AUTO-LAYOUT
 *
 * Reads catalog.json with a flat products[] array.
 * Auto-generates flipbook pages by cycling through 4 layout templates:
 *   A) 1 product  (full-page featured)
 *   B) 2 products (side-by-side split)
 *   C) 1 large + 2 small (magazine layout)
 *   D) 2 products (staggered offset)
 * Cover and back-cover pages are auto-generated from config.
 * Backgrounds, frames, and splashes are auto-rotated.
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
                splashX: 2, splashY: 56, splashW: 48, splashH: 40
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
                x: 46, y: 12, width: 52, height: 78,
                framePool: 'large', splashPool: 'large',
                splashX: 18, splashY: 68, splashW: 52, splashH: 28
            },
            {
                x: 2, y: 12, width: 42, height: 36,
                framePool: 'small', splashPool: 'small',
                splashX: 4, splashY: -4, splashW: 44, splashH: 38
            },
            {
                x: 2, y: 52, width: 42, height: 38,
                framePool: 'small', splashPool: 'small',
                splashX: 0, splashY: 36, splashW: 48, splashH: 42
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
                splashX: 55, splashY: 20, splashW: 44, splashH: 38,
                textLayout: 'right-of-image'
            }
        ]
    };

    const TEMPLATES = [TEMPLATE_D, TEMPLATE_C, TEMPLATE_A, TEMPLATE_B, TEMPLATE_A, TEMPLATE_B];

    /* ── DOM helpers ── */

    const posEl = (tag, className, x, y, w, h) => {
        const el = document.createElement(tag);
        if (className) el.className = className;
        el.style.cssText = 'position:absolute;left:' + x + '%;top:' + y + '%;width:' + w + '%;height:' + h + '%;';
        return el;
    };

    /* ── Build a single product card ── */

    const buildProduct = (product, slot, assets, frameRotators, splashRotators) => {
        const wrapper = posEl('div', 'catalog-product', slot.x, slot.y, slot.width, slot.height);
        wrapper.dataset.productId = product.id;

        // Pick frame & splash from pool rotation
        const poolKey = slot.framePool || 'medium';
        const frame = frameRotators[poolKey]();
        const splash = splashRotators[slot.splashPool || 'medium']();

        wrapper.dataset.frame = frame;
        wrapper.style.zIndex = '101';
        wrapper.style.cursor = 'pointer';

        const imageArea = document.createElement('div');
        imageArea.className = 'catalog-image-area';

        // Frame image (or no frame for template D — shadow only via CSS)
        if (slot.shadowOnly) {
            // No decorative frame; product gets a stretched drop-shadow via CSS
            wrapper.classList.add('catalog-product-shadow-only');
            if (slot.squareImage) wrapper.classList.add('catalog-product-square');
        } else if (assets.frames[frame]) {
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
            const prodImg = document.createElement('img');
            prodImg.className = 'catalog-product-image';
            prodImg.src = product.image;
            prodImg.alt = product.name || '';
            prodImg.loading = 'lazy';
            clipDiv.appendChild(prodImg);
            imageArea.appendChild(clipDiv);
        }

        // Price splash — for shadowOnly slots, place in corner; for others, normal position
        if (product.price != null && assets.splashes[splash]) {
            const splashWrap = document.createElement('div');
            splashWrap.className = 'catalog-splash';
            if (slot.splashX != null) splashWrap.style.left   = slot.splashX + '%';
            if (slot.splashY != null) { splashWrap.style.top = slot.splashY + '%'; splashWrap.style.bottom = 'auto'; }
            if (slot.splashW != null) splashWrap.style.width  = slot.splashW + '%';
            if (slot.splashH != null) splashWrap.style.height = slot.splashH + '%';

            const splashImg = document.createElement('img');
            splashImg.className = 'catalog-splash-img';
            splashImg.src = assets.splashes[splash];
            splashImg.alt = '';
            splashImg.loading = 'lazy';
            splashWrap.appendChild(splashImg);

            // Price text
            const priceC = document.createElement('div');
            priceC.className = 'catalog-price-container';
            const d = document.createElement('span'); d.className = 'catalog-price-dollar'; d.textContent = '$';
            const a = document.createElement('span'); a.className = 'catalog-price-amount'; a.textContent = String(product.price);
            const c = document.createElement('span'); c.className = 'catalog-price-cents'; c.textContent = product.cents || '00';
            priceC.appendChild(d); priceC.appendChild(a); priceC.appendChild(c);
            splashWrap.appendChild(priceC);
            imageArea.appendChild(splashWrap);
        } else if (product.price != null) {
            // Standalone price (no splash image available)
            const priceWrap = document.createElement('div');
            priceWrap.className = 'catalog-price-standalone';
            const priceC = document.createElement('div');
            priceC.className = 'catalog-price-container';
            const d = document.createElement('span'); d.className = 'catalog-price-dollar'; d.textContent = '$';
            const a = document.createElement('span'); a.className = 'catalog-price-amount'; a.textContent = String(product.price);
            const c = document.createElement('span'); c.className = 'catalog-price-cents'; c.textContent = product.cents || '00';
            priceC.appendChild(d); priceC.appendChild(a); priceC.appendChild(c);
            priceWrap.appendChild(priceC);
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
                const priceLine = document.createElement('div');
                priceLine.className = 'catalog-text-price';
                const d = document.createElement('span'); d.className = 'catalog-price-dollar'; d.textContent = '$';
                const a = document.createElement('span'); a.className = 'catalog-price-amount'; a.textContent = String(product.price);
                const c = document.createElement('span'); c.className = 'catalog-price-cents'; c.textContent = product.cents || '00';
                priceLine.appendChild(d); priceLine.appendChild(a); priceLine.appendChild(c);
                textBlock.appendChild(priceLine);
            }

            const nameEl = wrapper.querySelector('.catalog-product-name');
            const infoEl = wrapper.querySelector('.catalog-product-info');
            if (nameEl) textBlock.appendChild(nameEl);
            if (infoEl) textBlock.appendChild(infoEl);
            wrapper.appendChild(textBlock);
        }

        // Click → modal
        wrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            if (document.body.classList.contains('debug-active')) return;
            if (typeof window.openProductModal === 'function') {
                window.openProductModal(product);
            }
        });

        return wrapper;
    };

    /* ── Build decorative elements ── */

    const buildLogo = (assets, variant, x, y, w, h) => {
        const logoSrc = assets.logos[variant || 'dark'];
        if (!logoSrc) return null;
        const wrap = posEl('div', 'catalog-logo', x, y, w, h);
        wrap.style.zIndex = '150';
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
        el.style.zIndex = '130';
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
        wrap.style.zIndex = '130';
        const inner = document.createElement('div');
        inner.className = 'catalog-quote-inner';
        const bg = document.createElement('div');
        bg.className = 'catalog-quote-bg';
        inner.appendChild(bg);
        const text = document.createElement('div');
        text.className = 'catalog-quote-text';

        const esGratis = document.createElement('strong');
        esGratis.textContent = 'ES GRATIS';
        esGratis.style.cssText = 'font-size:130%;display:block;color:#FF3333;margin-bottom:2px;';
        const middle = document.createElement('span');
        middle.textContent = 'disfrutar de las cosas que';
        middle.style.cssText = 'display:block;font-weight:400;font-size:85%;';
        const deNoche = document.createElement('strong');
        deNoche.textContent = 'DE NOCHE';
        deNoche.style.cssText = 'display:block;font-size:120%;margin:1px 0;';
        const noTienen = document.createElement('span');
        noTienen.textContent = 'NO TIENEN PRECIO..';
        noTienen.style.cssText = 'display:block;color:#FF3333;font-size:85%;';

        text.appendChild(esGratis);
        text.appendChild(middle);
        text.appendChild(deNoche);
        text.appendChild(noTienen);
        inner.appendChild(text);
        wrap.appendChild(inner);
        return wrap;
    };

    /* ── Build a single page face (shell: bg + shadow + shading + label) ── */

    const buildFaceShell = (faceClass, shadingSrc, bgSrc, checkboxId, assets) => {
        const face = document.createElement('div');
        face.className = faceClass;

        // Background
        const bgImg = document.createElement('img');
        bgImg.className = 'catalog-bg';
        bgImg.src = bgSrc;
        bgImg.alt = '';
        bgImg.loading = 'lazy';
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

    /* ── Auto-layout: distribute products into page face groups ──
       Returns an array of face-data objects.
    */

    const autoLayout = (products, assets, pageBackgrounds, pageNoLogo) => {
        const faces = [];
        let pi = 0;
        let templateIdx = 0;
        let faceIdx = 0;

        const bgRotate = rotator(assets.backgrounds);

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

        while (pi < products.length) {
            const remaining = products.length - pi;

            // Pick template; downgrade if not enough products
            let tmpl;
            if (remaining === 1) {
                tmpl = TEMPLATE_A;
            } else {
                tmpl = TEMPLATES[templateIdx % TEMPLATES.length];
                templateIdx++;
                if (tmpl.slots.length > remaining) {
                    tmpl = remaining >= 3 ? TEMPLATE_C : remaining >= 2 ? TEMPLATE_B : TEMPLATE_A;
                }
            }

            const faceProducts = products.slice(pi, pi + tmpl.slots.length);
            pi += faceProducts.length;

            const bg = (pageBackgrounds && pageBackgrounds[faceIdx])
                ? pageBackgrounds[faceIdx]
                : bgRotate();
            faceIdx++;

            faces.push({
                bgSrc: bg,
                template: tmpl,
                products: faceProducts,
                frameRotators: frameRot,
                splashRotators: splashRot,
                noLogo: !!(pageNoLogo && pageNoLogo[faceIdx - 1])
            });
        }

        return faces;
    };

    /* ── Build cover face (front of first page) ── */

    const buildCoverFace = (catalog, checkboxId, assets) => {
        const cover = catalog.cover || {};
        const bgSrc = 'assets/webAssets/pages/page1.webp';

        // Build cover WITHOUT shadows or edge shading
        const face = document.createElement('div');
        face.className = 'front_page';

        // Background
        const bgImg = document.createElement('img');
        bgImg.className = 'catalog-bg';
        bgImg.src = bgSrc;
        bgImg.alt = '';
        bgImg.loading = 'lazy';
        face.appendChild(bgImg);

        // Flip label (no shadow, no edge shading)
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
        const face = buildFaceShell(faceClass, shadingSrc, faceData.bgSrc, checkboxId, assets);

        // Template D: remove edge shading (background image already has border)
        if (faceData.template === TEMPLATE_D) {
            const shading = face.querySelector('.edge_shading');
            if (shading) shading.remove();
        }

        // Template D: no shadow overlay — uses dedicated background image

        // Logo — large & centered for Template A & D, small for B, small top-left for C
        let logo;
        if (faceData.noLogo) {
            logo = null;
        } else if (faceData.template === TEMPLATE_B) {
            logo = buildLogo(assets, 'light', 57, 13, 32, 7);
        } else if (faceData.template === TEMPLATE_D) {
            logo = buildLogo(assets, 'dark', 5, 5, 90, 14);
        } else if (faceData.template === TEMPLATE_A) {
            logo = buildLogo(assets, 'dark', 10, 2, 80, 14);
        } else {
            logo = buildLogo(assets, 'dark', 3, 2, 45, 10);
        }
        if (logo) face.appendChild(logo);

        // Border color: always red for Template D, alternates for others
        const borderClass = (faceData.template === TEMPLATE_D) ? 'catalog-border-red' : (faceIndex % 2 === 0) ? 'catalog-border-red' : 'catalog-border-black';

        // Products in their template slots
        faceData.products.forEach((product, i) => {
            const slot = faceData.template.slots[i];
            if (!slot) return;
            const card = buildProduct(product, slot, assets, faceData.frameRotators, faceData.splashRotators);
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
        const { products, marqueeText, assets } = catalog;

        // Update marquee
        if (marqueeText) {
            document.querySelectorAll('.marquee-text').forEach(el => {
                el.textContent = marqueeText;
            });
        }

        // Generate content faces from flat product list
        const contentFaces = autoLayout(products || [], assets, catalog.pageBackgrounds, catalog.pageNoLogo);

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
        wrapper.style.transformOrigin = 'top center';
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
            setTimeout(resizeFlipbook, 600);
        }
    });

    window._resizeFlipbook = resizeFlipbook;

    /* ── Fetch & init ── */

    fetch(CATALOG_URL)
        .then(res => {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            return res.json();
        })
        .then(buildFlipbook)
        .catch(err => {
            console.error('[Catalog Engine] Failed to load catalog:', err);
            catalogRoot.innerHTML =
                '<p style="color:red;font-size:1rem;text-align:center;padding:2rem;">' +
                'Error cargando el catálogo.<br>Verifica que <code>catalog.json</code> exista.' +
                '</p>';
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

    const show = () => {
        modal.classList.remove('modal-hidden');
        modal.classList.add('modal-visible');
    };

    const hide = () => {
        modal.classList.remove('modal-visible');
        modal.classList.add('modal-hidden');
    };

    window.openProductModal = (product) => {
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
    };

    // Close triggers
    closeBtn?.addEventListener('click', hide);
    overlay?.addEventListener('click', hide);
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && modal.classList.contains('modal-visible')) hide();
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

    window.stopAds = () => {
        clearTimeout(adTimer);
        adTimer = null;
        adAudio.pause();
        adAudio.currentTime = 0;
    };

    window.startAds = () => {
        clearTimeout(adTimer);
        adTimer = setTimeout(scheduleNextAd, 30000);
    };
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
        const delay = Math.max(0, (audio.duration - END_OFFSET - FADE_DURATION) * 1000);
        crossfadeTimer = setTimeout(crossfade, delay);
    };

    const crossfade = () => {
        inactive.currentTime = START_TIME;
        inactive.play();
        fade(inactive, 0, 1, FADE_DURATION);
        fade(active, 1, 0, FADE_DURATION);
        [active, inactive] = [inactive, active];
        scheduleNextLoop(active);
    };

    backgroundMusic.volume = 0;
    bgClone.volume = 0;

    window.stopMusic = () => {
        clearTimeout(crossfadeTimer);
        crossfadeTimer = null;
        fadeIntervals.forEach(clearInterval);
        fadeIntervals.clear();
        backgroundMusic.pause();
        backgroundMusic.volume = 0;
        bgClone.pause();
        bgClone.volume = 0;
    };

    window.startMusic = () => {
        if (!active.paused) return;
        active.muted = false;
        active.currentTime = START_TIME;
        active.volume = 0;
        active.play().then(() => {
            fade(active, 0, 1, FADE_DURATION);
            scheduleNextLoop(active);
        }).catch(() => {});
    };
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


/**********************
 * 7. MODE TOGGLE BEHAVIOR
 **********************/

(() => {
    const toggleModeBtn = document.getElementById('toggle-mode-btn');
    if (!toggleModeBtn) return;

    const { body } = document;
    const LIGHT = 'light-mode';
    const DARK  = 'dark-mode';

    const applyMode = (mode) => {
        body.classList.remove(LIGHT, DARK);
        body.classList.add(mode);

        const isDark = mode === DARK;
        toggleModeBtn.style.color = isDark ? '#f5f5f5' : '#020408';
        toggleModeBtn.innerHTML = '<i class="bi bi-' + (isDark ? 'sun-fill' : 'moon-stars-fill') + '"></i>';
    };

    applyMode(localStorage.getItem('mode') || LIGHT);

    toggleModeBtn.addEventListener('click', () => {
        const newMode = body.classList.contains(LIGHT) ? DARK : LIGHT;
        applyMode(newMode);
        localStorage.setItem('mode', newMode);
    });
})();


/************************
 * 8. VISIBILITY SAFETY NET
 ************************/

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        window.stopMusic?.();
        window.stopAds?.();
    } else {
        window.startMusic?.();
        window.startAds?.();
    }
}, { passive: true });
