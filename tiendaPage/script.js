/* ============================================================
   TIENDA GDLDENOXE — Virtual Store Flipbook Engine
   ============================================================
   Modules (in order):
     1. Catalog Engine — fetches catalog.json, builds layered flipbook
     2. Product Modal  — supermarket-style product detail popup
     3. Debug Mode     — hotspot positioning helper (?debug)
     4. Ads System     — periodic ad audio (unchanged)
     5. Music System   — background music crossfade (unchanged)
     6. Marquee Setup  — seamless scroll duplication (unchanged)
     7. Mode Toggle    — light/dark theme (unchanged)
     8. Visibility     — pause audio on tab hide (unchanged)
   ============================================================ */


/****************************
 * 1. CATALOG ENGINE
 * Reads catalog.json, dynamically generates layered page compositions:
 *   Background → Shadow → Frame/Product Image → Splash + Price → Titles
 * Each page face is composed from individual asset layers, not flat images.
 * Preserves the original CSS-only checkbox flip mechanism 1:1.
 ****************************/

(() => {
    const CATALOG_URL  = 'catalog.json';
    const FRONT_SHADE  = 'assets/front_page_edge_shading.webp';
    const BACK_SHADE   = 'assets/back_page_edge_shading.webp';

    const catalogRoot = document.getElementById('catalog-root');
    const dynamicCSS  = document.getElementById('dynamic-flipbook-css');
    if (!catalogRoot || !dynamicCSS) return;

    /* ---------- Layer builders ---------- */

    /**
     * Creates an absolutely-positioned element at given % coords.
     */
    const posEl = (tag, className, x, y, w, h) => {
        const el = document.createElement(tag);
        if (className) el.className = className;
        el.style.position = 'absolute';
        el.style.left   = x + '%';
        el.style.top    = y + '%';
        el.style.width  = w + '%';
        el.style.height = h + '%';
        return el;
    };

    /**
     * Build a product item on a page face:
     *   - Frame image (border/decoration around product)
     *   - Product photo inside frame
     *   - Splash (starburst) with price text overlaid
     *   - Badge ribbon (OFERTA, NUEVO, etc.)
     *   - Entire zone is clickable → opens modal
     */
    const buildProduct = (item, assets) => {
        const wrapper = posEl('div', 'catalog-product', item.x, item.y, item.width, item.height);
        wrapper.dataset.productId = item.id;
        if (item.frame) wrapper.dataset.frame = item.frame;
        wrapper.style.zIndex = '101';
        wrapper.style.cursor = 'pointer';

        // Frame image
        if (item.frame && assets.frames[item.frame]) {
            const frameImg = document.createElement('img');
            frameImg.className = 'catalog-frame';
            frameImg.src   = assets.frames[item.frame];
            frameImg.alt   = '';
            frameImg.loading = 'lazy';
            wrapper.appendChild(frameImg);
        }

        // Shadow behind frame
        if (assets.shadows && assets.shadows.frame) {
            const shadowImg = document.createElement('img');
            shadowImg.className = 'catalog-frame-shadow';
            shadowImg.src   = assets.shadows.frame;
            shadowImg.alt   = '';
            shadowImg.loading = 'lazy';
            wrapper.appendChild(shadowImg);
        }

        // Product photo — wrapped in a clip container so overflow is hidden
        if (item.image) {
            const clipDiv = document.createElement('div');
            clipDiv.className = 'catalog-image-clip';

            const prodImg = document.createElement('img');
            prodImg.className = 'catalog-product-image';
            prodImg.src   = item.image;
            prodImg.alt   = item.name || '';
            prodImg.loading = 'lazy';
            clipDiv.appendChild(prodImg);
            wrapper.appendChild(clipDiv);
        }

        // Splash with price overlay
        if (item.splash && assets.splashes[item.splash] && item.price != null) {
            const splashWrap = document.createElement('div');
            splashWrap.className = 'catalog-splash';

            const splashImg = document.createElement('img');
            splashImg.className = 'catalog-splash-img';
            splashImg.src   = assets.splashes[item.splash];
            splashImg.alt   = '';
            splashImg.loading = 'lazy';
            splashWrap.appendChild(splashImg);

            const priceText = document.createElement('span');
            priceText.className   = 'catalog-splash-price';
            priceText.textContent = '$' + item.price;
            splashWrap.appendChild(priceText);

            wrapper.appendChild(splashWrap);
        } else if (item.price != null) {
            // Price without splash — simple tag
            const priceTag = document.createElement('span');
            priceTag.className   = 'catalog-price-tag';
            priceTag.textContent = '$' + item.price + ' ' + (item.currency || 'MXN');
            wrapper.appendChild(priceTag);
        }

        // Product name label
        if (item.name) {
            const nameEl = document.createElement('span');
            nameEl.className   = 'catalog-product-name';
            nameEl.textContent = item.name;
            wrapper.appendChild(nameEl);
        }

        // Badge ribbon
        if (item.badge) {
            const badge = document.createElement('span');
            badge.className   = 'catalog-badge';
            badge.textContent = item.badge;
            wrapper.appendChild(badge);
        }

        // Subtitle / secondary price label
        if (item.subtitle) {
            const sub = document.createElement('span');
            sub.className   = 'catalog-subtitle';
            sub.textContent = item.subtitle;
            wrapper.appendChild(sub);
        }

        // Click → open modal
        wrapper.addEventListener('click', (e) => {
            e.stopPropagation();
            if (document.body.classList.contains('debug-active')) return;
            if (typeof window.openProductModal === 'function') {
                window.openProductModal(item);
            }
        });

        return wrapper;
    };

    /**
     * Build a title text element on a page face.
     */
    const buildTitle = (item) => {
        const el = posEl('div', 'catalog-title', item.x, item.y, item.width, item.height);
        el.textContent = item.text || '';
        el.style.zIndex = '6';
        if (item.fontSize) el.style.fontSize = item.fontSize;
        if (item.color)    el.style.color    = item.color;
        if (item.fontFamily) el.style.fontFamily = item.fontFamily;
        return el;
    };

    /**
     * Build a decorative "ES GRATIS..." quote with black starburst background.
     */
    const buildQuote = (item) => {
        const wrap = posEl('div', 'catalog-quote', item.x, item.y, item.width, item.height);
        wrap.style.zIndex = '7';

        const inner = document.createElement('div');
        inner.className = 'catalog-quote-inner';

        const bg = document.createElement('div');
        bg.className = 'catalog-quote-bg';
        inner.appendChild(bg);

        const text = document.createElement('div');
        text.className = 'catalog-quote-text';
        // Format the quote with styled segments matching the reference:
        // "ES GRATIS" bold red, "disfrutar de las cosas que" white,
        // "DE NOCHE" bold white, "NO TIENEN PRECIO.." red

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

    /**
     * Build a logo image element on a page face.
     */
    const buildLogo = (item, assets) => {
        const logoSrc = assets.logos[item.asset];
        if (!logoSrc) return null;
        const wrap = posEl('div', 'catalog-logo', item.x, item.y, item.width, item.height);
        wrap.style.zIndex = '6';
        const img = document.createElement('img');
        img.className = 'catalog-logo-img';
        img.src   = logoSrc;
        img.alt   = 'GDLDENOXE';
        img.loading = 'lazy';
        wrap.appendChild(img);
        return wrap;
    };

    /**
     * Build a single page face (front or back) with layered composition:
     *  z-order (bottom to top):
     *    1. Background image (fills entire face)
     *    2. Shadow overlay
     *    3. Product items (frame + photo + splash + price)
     *    4. Titles & logos
     *    5. Edge shading (flipbook cosmetic)
     *    6. Label (page flip trigger)
     */
    const buildFace = (faceClass, imgClass, shadingSrc, faceData, checkboxId, assets) => {
        const face = document.createElement('div');
        face.className = faceClass;

        // 1. Background image
        const bgIdx = faceData.background != null ? faceData.background : 0;
        const bgSrc = assets.backgrounds[bgIdx % assets.backgrounds.length];
        const bgImg = document.createElement('img');
        bgImg.className = 'catalog-bg';
        bgImg.src       = bgSrc;
        bgImg.alt       = '';
        bgImg.loading   = 'lazy';
        face.appendChild(bgImg);

        // 2. Page shadow overlay
        if (assets.shadows && assets.shadows.page) {
            const shadowImg = document.createElement('img');
            shadowImg.className = 'catalog-page-shadow';
            shadowImg.src   = assets.shadows.page;
            shadowImg.alt   = '';
            shadowImg.loading = 'lazy';
            face.appendChild(shadowImg);
        }

        // 3-4. Items (products, titles, logos)
        if (faceData.items && faceData.items.length) {
            faceData.items.forEach(item => {
                let el = null;
                switch (item.type) {
                    case 'product':
                        el = buildProduct(item, assets);
                        break;
                    case 'title':
                        el = buildTitle(item);
                        break;
                    case 'logo':
                        el = buildLogo(item, assets);
                        break;
                    case 'quote':
                        el = buildQuote(item);
                        break;
                }
                if (el) face.appendChild(el);
            });
        }

        // 5. Edge shading overlay (flipbook cosmetic)
        const shade = document.createElement('img');
        shade.className = 'edge_shading';
        shade.src       = shadingSrc;
        shade.alt       = '';
        shade.loading   = 'lazy';
        face.appendChild(shade);

        // 6. Label — full-page click target for flipping
        const label = document.createElement('label');
        label.setAttribute('for', checkboxId);
        face.appendChild(label);

        return face;
    };

    /* ---------- Dynamic CSS generator ---------- */

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
        css += ':is(' + ids.join(', ') + '):checked ~ #flip_book ' +
               '{ transform: translateX(144px) scale(1.03); }\n';

        dynamicCSS.textContent = css;
    };

    /* ---------- Main build ---------- */

    const buildFlipbook = (catalog) => {
        const { pages, marqueeText, assets } = catalog;
        const N = pages.length;

        // Update marquee text
        if (marqueeText) {
            document.querySelectorAll('.marquee-text').forEach(el => {
                el.textContent = marqueeText;
            });
        }

        const frag = document.createDocumentFragment();

        // Checkboxes
        for (let i = 1; i <= N; i++) {
            const cb   = document.createElement('input');
            cb.type    = 'checkbox';
            cb.id      = 'page' + i + '_checkbox';
            frag.appendChild(cb);
        }

        // Flip book container
        const book = document.createElement('div');
        book.id = 'flip_book';

        pages.forEach((page, idx) => {
            const i    = idx + 1;
            const cbId = 'page' + i + '_checkbox';

            const pageDiv = document.createElement('div');
            pageDiv.className = 'page';
            pageDiv.id        = 'page' + i;

            pageDiv.appendChild(
                buildFace('front_page', 'front_content', FRONT_SHADE,
                          page.front, cbId, assets)
            );

            pageDiv.appendChild(
                buildFace('back_page', 'back_content', BACK_SHADE,
                          page.back, cbId, assets)
            );

            book.appendChild(pageDiv);
        });

        frag.appendChild(book);
        catalogRoot.appendChild(frag);
        generateDynamicCSS(N);
    };

    /* ---------- Fetch & initialise ---------- */

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
            ? ('$' + product.price + ' ' + (product.currency || 'MXN'))
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
        'Click anywhere on a page face to log x/y percentages.\n' +
        'Copy the values into catalog.json → hotspot: { x, y, width, height }.',
        'color: #0f0; font-weight: bold; font-size: 13px;'
    );

    // Tooltip element
    const tooltip = document.createElement('div');
    tooltip.className = 'debug-tooltip';
    tooltip.style.display = 'none';
    document.body.appendChild(tooltip);

    // Add grid overlays once flip_book is generated
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

    // Click handler — capture phase so it fires before labels
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

        // Tooltip
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
    const responsiveWarning = document.getElementById('responsive-warning');
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
        if (responsiveWarning) {
            responsiveWarning.style.backgroundColor = isDark ? '#020408' : '#f5f5f5';
        }
    };

    applyMode(localStorage.getItem('mode') || LIGHT);

    toggleModeBtn.addEventListener('click', () => {
        const newMode = body.classList.contains(LIGHT) ? DARK : LIGHT;
        applyMode(newMode);
        localStorage.setItem('mode', newMode);
    });

    // Show responsive warning on mobile
    if (responsiveWarning && window.innerWidth <= 768) {
        responsiveWarning.classList.add('show');
    }
})();


/************************
 * 8. VISIBILITY SAFETY NET
 ************************/

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        window.stopMusic?.();
        window.stopAds?.();
    }
}, { passive: true });
