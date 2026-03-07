/* ============================================================
   TIENDA GDLDENOXE — Virtual Store Flipbook Engine
   ============================================================
   Modules (in order):
     1. Catalog Engine — fetches catalog.json, builds flipbook
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
 * Reads catalog.json, dynamically generates:
 *   - <input> checkboxes (siblings of #flip_book)
 *   - #flip_book with N .page elements
 *   - Product hotspot overlays on each page face
 *   - Dynamic CSS rules for z-index stacking & flip states
 * Preserves the original CSS-only checkbox flip mechanism 1:1.
 ****************************/

(() => {
    const CATALOG_URL  = 'catalog.json';
    const FRONT_SHADE  = 'assets/images/front_page_edge_shading.webp';
    const BACK_SHADE   = 'assets/images/back_page_edge_shading.webp';

    const catalogRoot = document.getElementById('catalog-root');
    const dynamicCSS  = document.getElementById('dynamic-flipbook-css');
    if (!catalogRoot || !dynamicCSS) return;

    /* ---------- Hotspot factory ---------- */

    const createHotspot = (product) => {
        const div = document.createElement('div');
        div.className = 'product-hotspot';
        div.dataset.productId = product.id;
        div.dataset.product   = JSON.stringify(product);

        const hs = product.hotspot;
        div.style.left   = hs.x + '%';
        div.style.top    = hs.y + '%';
        div.style.width  = hs.width + '%';
        div.style.height = hs.height + '%';

        // Floating price tag
        if (product.price != null) {
            const tag = document.createElement('span');
            tag.className   = 'hotspot-price';
            tag.textContent = '$' + product.price + ' ' + (product.currency || 'MXN');
            div.appendChild(tag);
        }

        // Badge ribbon
        if (product.badge) {
            const badge = document.createElement('span');
            badge.className   = 'hotspot-badge';
            badge.textContent = product.badge;
            div.appendChild(badge);
        }

        // Click → open product modal (skip in debug mode)
        div.addEventListener('click', (e) => {
            e.stopPropagation();
            if (document.body.classList.contains('debug-active')) return;
            if (typeof window.openProductModal === 'function') {
                window.openProductModal(product);
            }
        });

        return div;
    };

    /* ---------- Page builder ---------- */

    const buildFace = (faceClass, imgClass, shadingSrc, contentSrc, contentAlt, checkboxId, products) => {
        const face = document.createElement('div');
        face.className = faceClass;

        // Label — full-page click target for flipping
        const label = document.createElement('label');
        label.setAttribute('for', checkboxId);
        face.appendChild(label);

        // Edge shading overlay
        const shade = document.createElement('img');
        shade.className = 'edge_shading';
        shade.src       = shadingSrc;
        shade.alt       = '';
        shade.loading   = 'lazy';
        face.appendChild(shade);

        // Page content image
        const img = document.createElement('img');
        img.className = imgClass;
        img.src       = contentSrc;
        img.alt       = contentAlt;
        img.loading   = 'lazy';
        face.appendChild(img);

        // Product hotspots
        if (products && products.length) {
            products.forEach(p => face.appendChild(createHotspot(p)));
        }

        return face;
    };

    /* ---------- Dynamic CSS generator ---------- */

    const generateDynamicCSS = (N) => {
        let css = '/* Auto-generated: ' + N + ' pages */\n';

        // Default z-index stacking (unflipped)
        for (let i = 1; i <= N; i++) {
            const z = (i === 1) ? N + 3 : N - i + 2;
            css += '#page' + i + ' { z-index: ' + z + '; }\n';
        }

        // Flip states (checked)
        for (let i = 1; i <= N; i++) {
            const z = (i === N) ? N + 4 : i + 2;
            css += '#page' + i + '_checkbox:checked ~ #flip_book #page' + i +
                   ' { transform: rotateY(-180deg); z-index: ' + z + '; }\n';
        }

        // Shift book right when any page is flipped
        const ids = [];
        for (let i = 1; i <= N; i++) ids.push('#page' + i + '_checkbox');
        css += ':is(' + ids.join(', ') + '):checked ~ #flip_book ' +
               '{ transform: translateX(144px) scale(1.03); }\n';

        dynamicCSS.textContent = css;
    };

    /* ---------- Main build ---------- */

    const buildFlipbook = (catalog) => {
        const { pages, marqueeText } = catalog;
        const N = pages.length;

        // Update marquee text from JSON
        if (marqueeText) {
            document.querySelectorAll('.marquee-text').forEach(el => {
                el.textContent = marqueeText;
            });
        }

        const frag = document.createDocumentFragment();

        // Checkboxes (must precede #flip_book for ~ combinator)
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
            const i = idx + 1;
            const cbId = 'page' + i + '_checkbox';

            const pageDiv = document.createElement('div');
            pageDiv.className = 'page';
            pageDiv.id        = 'page' + i;

            // Front face
            pageDiv.appendChild(
                buildFace('front_page', 'front_content', FRONT_SHADE,
                          page.front.image,
                          page.front.alt || ('Página ' + (i * 2 - 1)),
                          cbId,
                          page.front.products)
            );

            // Back face
            pageDiv.appendChild(
                buildFace('back_page', 'back_content', BACK_SHADE,
                          page.back.image,
                          page.back.alt || ('Página ' + (i * 2)),
                          cbId,
                          page.back.products)
            );

            book.appendChild(pageDiv);
        });

        frag.appendChild(book);
        catalogRoot.appendChild(frag);

        // Inject z-index + flip CSS
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
