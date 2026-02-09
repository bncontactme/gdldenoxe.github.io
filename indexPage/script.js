// Funcionalidad para el dashboard estilo Windows 95

document.addEventListener('DOMContentLoaded', () => {
    // Cache DOM elements
    const $ = (sel) => document.querySelector(sel);
    const $$ = (sel) => document.querySelectorAll(sel);
    
    const desktop = $('.desktop');
    const taskbarItems = $('#taskbar-items');
    const startButton = $('.start-button');
    const startMenu = $('#start-menu');
    const musicPlayer = $('#musicPlayer');
    const allWindows = $$('.win95-window');
    
    let highestZIndex = 100;
    let draggedWindow = null;
    let offsetX = 0;
    let offsetY = 0;
    let lastMobileCheck = 0;
    let cachedIsMobile = null;

    // Funciones para controlar audio de tienda
    function pauseTiendaAudio() {
        try {
            const tiendaIframe = $('#tienda-iframe');
            if (tiendaIframe?.contentWindow) {
                tiendaIframe.contentWindow.stopMusic?.();
                tiendaIframe.contentWindow.stopAds?.();
            }
        } catch (e) { /* Cross-origin error */ }
    }

    function playTiendaAudio() {
        try {
            const tiendaIframe = $('#tienda-iframe');
            if (tiendaIframe?.contentWindow) {
                tiendaIframe.contentWindow.startMusic?.();
                tiendaIframe.contentWindow.startAds?.();
            }
        } catch (e) { /* Cross-origin error */ }
    }

    // Pausar audio de tienda al cargar
    setTimeout(() => {
        const tiendaWindow = $('[data-window-id="tienda"]');
        if (tiendaWindow?.classList.contains('hidden')) pauseTiendaAudio();
    }, 1000);

    // Mobile detection with caching
    function isMobile() {
        const now = Date.now();
        if (cachedIsMobile !== null && now - lastMobileCheck < 500) return cachedIsMobile;
        lastMobileCheck = now;
        cachedIsMobile = window.innerWidth <= 768;
        return cachedIsMobile;
    }

    // Funcionalidad de iconos del escritorio usando delegación de eventos
    const desktopIconsContainer = $('.desktop-icons');
    let selectedIcon = null;

    // Helper para abrir ventana
    function openWindow(windowId, playAudio = false) {
        const win = $(`[data-window-id="${windowId}"]`);
        if (!win) return;
        
        if (windowId === 'tienda') {
            positionWindowRandomly(win, 750, 650);
        }
        
        win.classList.remove('hidden', 'minimized');
        bringToFront(win);
        updateTaskbar();
        
        if (playAudio) setTimeout(playTiendaAudio, 500);
    }
    
    function positionWindowRandomly(win, width, height) {
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        const iconAreaWidth = 150;
        const taskbarHeight = 40;
        
        const x = Math.random() * (screenW - width - iconAreaWidth - 100) + iconAreaWidth + 50;
        const y = Math.random() * (screenH - height - taskbarHeight - 100) + 30;
        
        win.style.left = Math.floor(Math.max(iconAreaWidth + 50, Math.min(x, screenW - width - 20))) + 'px';
        win.style.top = Math.floor(Math.max(30, Math.min(y, screenH - height - taskbarHeight - 20))) + 'px';
    }

    desktopIconsContainer?.addEventListener('click', (e) => {
        const icon = e.target.closest('.desktop-icon');
        if (!icon) return;
        
        e.stopPropagation();
        const link = icon.dataset.link;
        const folder = icon.dataset.folder;

        if (isMobile()) {
            if (link) window.open(link, '_blank');
            else if (folder) window.location.href = 'indexPage/frame.html?p=' + folder;
            return;
        }

        $$('.desktop-icon').forEach(i => i.classList.remove('selected'));
        icon.classList.add('selected');
        selectedIcon = icon;
    });

    desktopIconsContainer?.addEventListener('dblclick', (e) => {
        const icon = e.target.closest('.desktop-icon');
        if (!icon) return;
        
        e.stopPropagation();
        const link = icon.dataset.link;
        const folder = icon.dataset.folder;
        
        if (link) {
            window.location.href = link;
        } else if (folder === 'articulos') {
            openWindow('folder-articulos');
        } else if (folder === 'galeria') {
            openWindow('galeria');
        } else if (folder === 'tienda') {
            openWindow('tienda', true);
        }
    });

    // =============================================
    // SISTEMA DE ARTÍCULOS DINÁMICO (desde JSON)
    // =============================================
    let selectedFolderItem = null;

    function wireWindowControls(win) {
        makeDraggable(win);
        win.addEventListener('mousedown', () => bringToFront(win));

        const closeBtn = win.querySelector('.close-btn');
        const minBtn = win.querySelector('.minimize-btn');
        const maxBtn = win.querySelector('.maximize-btn');
        
        closeBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            win.classList.add('hidden');
            updateTaskbar();
        });
        
        minBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            win.classList.add('minimized');
            updateTaskbar();
        });
        
        maxBtn?.addEventListener('click', (e) => {
            e.stopPropagation();
            const isMax = win.classList.toggle('maximized');
            if (isMax) {
                win.dataset.originalLeft = win.style.left;
                win.dataset.originalTop = win.style.top;
                win.dataset.originalWidth = win.style.width;
            } else {
                win.style.left = win.dataset.originalLeft;
                win.style.top = win.dataset.originalTop;
                win.style.width = win.dataset.originalWidth;
                win.style.height = '';
            }
        });
    }

    function buildFullArticleWindow(art) {
        const screenW = window.innerWidth;
        const screenH = window.innerHeight;
        const w = Math.min(620, screenW - 100);
        const h = Math.min(550, screenH - 80);
        const x = Math.floor((screenW - w) / 2 + (Math.random() * 60 - 30));
        const y = Math.floor((screenH - h) / 2 + (Math.random() * 40 - 20));

        const win = document.createElement('div');
        win.className = 'win95-window hidden art-full-window';
        win.dataset.windowId = 'artfull-' + art.id;
        Object.assign(win.style, { left: x + 'px', top: y + 'px', width: w + 'px' });

        const blockMap = {
            lead: t => `<p class="art-full-lead">${t}</p>`,
            h2: t => `<h2 class="art-full-h2">${t}</h2>`,
            quote: t => `<div class="art-full-quote">"${t}"</div>`
        };
        
        const bodyHTML = art.contenido.map(b => 
            (blockMap[b.tipo] || (t => `<p class="art-full-p">${t}</p>`))(b.texto)
        ).join('');

        win.innerHTML = `
            <div class="title-bar">
                <div class="title-bar-text">${art.titulo}</div>
                <div class="title-bar-controls">
                    <button class="minimize-btn">_</button>
                    <button class="maximize-btn">□</button>
                    <button class="close-btn">✕</button>
                </div>
            </div>
            <div class="window-body art-full-body">
                <div class="art-full-inner">
                    <div class="art-full-hero">
                        <img src="${art.imagen}" alt="${art.titulo}" loading="lazy">
                    </div>
                    <div class="art-full-meta">${art.meta}</div>
                    <div class="art-full-content">${bodyHTML}</div>
                </div>
                <div class="art-full-footer">
                    <button class="art-full-close-btn">Cerrar</button>
                </div>
            </div>`;
        
        wireWindowControls(win);
        win.querySelector('.art-full-close-btn').addEventListener('click', () => {
            win.classList.add('hidden');
            updateTaskbar();
        });
        return win;
    }

    function buildArticleWindow(art, idx, visible) {
        const fullWin = buildFullArticleWindow(art);
        $('#articles-container').appendChild(fullWin);

        const win = document.createElement('div');
        win.className = 'win95-window' + (visible ? '' : ' hidden');
        win.dataset.windowId = 'art-' + art.id;
        
        win.innerHTML = `
            <div class="title-bar">
                <div class="title-bar-text">Artículo #${art.id}</div>
                <div class="title-bar-controls">
                    <button class="minimize-btn">_</button>
                    <button class="maximize-btn">□</button>
                    <button class="close-btn">✕</button>
                </div>
            </div>
            <div class="window-body">
                <div class="article-image">
                    <img src="${art.imagen}" alt="${art.titulo}" loading="lazy">
                </div>
                <div class="article-description">
                    <h3>${art.titulo}</h3>
                    <p>${art.descripcion}</p>
                    <button class="read-more-btn" data-art-id="${art.id}">Leer más</button>
                </div>
            </div>`;
        
        wireWindowControls(win);
        win.querySelector('.read-more-btn').addEventListener('click', () => {
            fullWin.classList.remove('hidden', 'minimized');
            bringToFront(fullWin);
            updateTaskbar();
        });
        return win;
    }

    function buildFolderItem(art) {
        const item = document.createElement('div');
        item.className = 'folder-item';
        item.dataset.openArticle = 'art-' + art.id;
        item.innerHTML = `
            <span class="folder-icon"><img src="https://win98icons.alexmeub.com/icons/png/notepad_file-0.png" alt="" class="folder-item-icon"></span>
            <span class="folder-name">${art.titulo}.txt</span>`;

        item.addEventListener('click', (e) => {
            e.stopPropagation();
            $$('.folder-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            selectedFolderItem = item;
        });
        
        item.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            const artWin = $(`[data-window-id="${item.dataset.openArticle}"]`);
            if (artWin) {
                artWin.classList.remove('hidden', 'minimized');
                bringToFront(artWin);
                updateTaskbar();
            }
        });
        return item;
    }

    // Fetch y render
    fetch('articulosPage/articulos.json')
        .then(r => r.json())
        .then(articulos => {
            const container = $('#articles-container');
            const folderContent = $('#folder-articulos-content');
            const visibleIdx = Math.floor(Math.random() * articulos.length);
            
            // Use DocumentFragment for batch DOM insertion
            const containerFrag = document.createDocumentFragment();
            const folderFrag = document.createDocumentFragment();

            articulos.forEach((art, idx) => {
                containerFrag.appendChild(buildArticleWindow(art, idx, idx === visibleIdx));
                folderFrag.appendChild(buildFolderItem(art));
            });
            
            container.appendChild(containerFrag);
            folderContent.appendChild(folderFrag);

            // Populate article widget with a random article
            const randomArt = articulos[Math.floor(Math.random() * articulos.length)];
            const widgetImg = $('#articuloWidgetImg');
            const widgetTitle = $('#articuloWidgetTitle');
            const widgetDesc = $('#articuloWidgetDesc');
            
            if (widgetImg && widgetTitle) {
                widgetImg.src = randomArt.imagen;
                widgetImg.alt = randomArt.titulo;
                widgetTitle.textContent = randomArt.titulo;
                widgetDesc.textContent = randomArt.descripcion;
            }
            
            // Make widget clickable → navigate to article
            const artWidget = $('[data-window-id="articulo-widget"]');
            artWidget?.addEventListener('click', () => {
                if (isMobile()) {
                    window.location.href = 'indexPage/frame.html?p=articulo&id=' + randomArt.id;
                }
            });

            // Dynamically position poema widget below articulo-widget on mobile
            if (isMobile()) {
                function positionPoemaWidget() {
                    const aw = $('[data-window-id="articulo-widget"]');
                    const pw = $('[data-window-id="poema1"]');
                    if (!aw || !pw) return;
                    const awRect = aw.getBoundingClientRect();
                    const parentRect = aw.offsetParent?.getBoundingClientRect() || { top: 0 };
                    pw.style.top = (awRect.bottom - parentRect.top + 10) + 'px';
                }
                // Wait for images/layout to settle then position
                const artImg = artWidget?.querySelector('img');
                if (artImg && !artImg.complete) {
                    artImg.addEventListener('load', positionPoemaWidget);
                } else {
                    requestAnimationFrame(() => requestAnimationFrame(positionPoemaWidget));
                }
                window.addEventListener('resize', positionPoemaWidget);
            }

            updateTaskbar();
            // Posicionar TODAS las ventanas en cascada después de cargar artículos
            randomizeWindowPositions();
        })
        .catch(() => {
            randomizeWindowPositions();
        });

    // Deseleccionar al hacer click en el escritorio
    desktop?.addEventListener('click', () => {
        $$('.desktop-icon').forEach(i => i.classList.remove('selected'));
        selectedIcon = null;
    });

    // Deseleccionar items de carpeta al hacer click en window-body
    $$('.folder-content').forEach(folder => {
        folder.addEventListener('click', (e) => {
            if (e.target === folder) {
                $$('.folder-item').forEach(i => i.classList.remove('selected'));
                selectedFolderItem = null;
            }
        });
    });

    // Funcionalidad de imagen random
    const imagePaths = [
        "indexPage/indexImages/2 Intro.jpeg",
        "indexPage/indexImages/3 Intro.jpeg",
        "indexPage/indexImages/4 Intro.jpeg",
        "indexPage/indexImages/6 Intro.jpeg",
        "indexPage/indexImages/7 Intro.JPG"
    ];

    const randomImgEl = $('#randomWindowImage');
    if (randomImgEl) {
        randomImgEl.src = imagePaths[Math.floor(Math.random() * imagePaths.length)];
    }

    // Sistema de poemas random
    const poemas = [
        `Cuando el sol se mete
dentro de esa agua,
yo me medio embriago
y tú ahí sofocado,

bailas y algo hago
con mi abaniquito
y mis pies mojados,
juntxs y brillando.`
    ];

    // Cargar poemas random en los frames
    $$('.poem-text').forEach(el => {
        el.textContent = poemas[Math.floor(Math.random() * poemas.length)];
    });

    // On mobile: override poema1 with ASCII art
    if (isMobile()) {
        const poema1El = $('[data-window-id="poema1"] .poem-text');
        if (poema1El) poema1El.textContent = `\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\n\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\u2800\n⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⣀⡀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n⠀⠀⠀⠀⠀⠀⠀⠀⡠⠖⠋⠉⠉⠳⡴⠒⠒⠒⠲⠤⢤⣀⠀⠀⠀⠀\n⠀⠀⠀⠀⠀⠀⣠⠊⠀⠀⡴⠚⡩⠟⠓⠒⡖⠲⡄⠀⠀⠈⡆⠀⠀⠀\n⠀⠀⢀⡞⠁⢠⠒⠾⢥⣀⣇⣚⣹⡤⡟⠀⡇⢠⠀⢠⠇⠀⠀⠀⠀⠀\n⠀⠀⠀⠀⢸⣄⣀⠀⡇⠀⠀⠀⠀⠀⢀⡜⠁⣸⢠⠎⣰⣃⠀⠀⠀⠀\n⠀⠀⠀⠸⡍⠀⠉⠉⠛⠦⣄⠀⢀⡴⣫⠴⠋⢹⡏⡼⠁⠈⠙⢦⡀⠀\n⠀⠀⠀⣀⡽⣄⠀⠀⠀⠀⠈⠙⠻⣎⡁⠀⠀⣸⡾⠀⠀⠀⠀⣀⡹⠂\n⠀⢀⡞⠁⠀⠈⢣⡀⠀⠀⠀⠀⠀⠀⠉⠓⠶⢟⠀⢀⡤⠖⠋⠁⠀⠀\n⠀⠀⠉⠙⠒⠦⡀⠙⠦⣀⠀⠀⠀⠀⠀⠀⢀⣴⡷⠋⠀⠀⠀⠀⠀⠀\n⠀⠀⠀⠀⠀⠀⠘⢦⣀⠈⠓⣦⣤⣤⣤⢶⡟⠁⠀⠀⠀⠀⠀⠀⠀⠀\n⢤⣤⣤⡤⠤⠤⠤⠤⣌⡉⠉⠁⠀⠀⢸⢸⠁⡠⠖⠒⠒⢒⣒⡶⣶⠤\n⠀⠉⠲⣍⠓⠦⣄⠀⠀⠙⣆⠀⠀⠀⡞⡼⡼⢀⣠⠴⠊⢉⡤⠚⠁⠀\n⠀⠀⠀⠈⠳⣄⠈⠙⢦⡀⢸⡀⠀⢰⢣⡧⠷⣯⣤⠤⠚⠉⠀⠀⠀⠀\n⠀⠀⠀⠀⠀⠈⠑⣲⠤⠬⠿⠧⣠⢏⡞⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n⠀⠀⠀⢀⡴⠚⠉⠉⢉⣳⣄⣠⠏⡞⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n⠀⣠⣴⣟⣒⣋⣉⣉⡭⠟⢡⠏⡼⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n⠀⠉⠀⠀⠀⠀⠀⠀⠀⢀⠏⣸⠁⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n⠀⠀⠀⠀⠀⠀⠀⠀⠀⡞⢠⠇⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀\n⠀⠀⠀⠀⠀⠀⠀⠀⠘⠓⠚⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀⠀`;
    }

    // Posicionar ventanas sin overlap, imagen a la izquierda del artículo
    function randomizeWindowPositions() {
        if (isMobile()) return;
        const windows = Array.from($$('.win95-window:not(.hidden)'));
        if (!windows.length) return;
        
        const screenW = window.innerWidth;
        const gap = 12;
        
        // Separate windows by type
        let imgWin = null, artWin = null;
        const others = [];
        windows.forEach(win => {
            const id = win.dataset.windowId || '';
            if (id === 'random') imgWin = win;
            else if (id.startsWith('art-')) artWin = win;
            else others.push(win);
        });
        
        // Position articulo at top-right
        let rightColX = screenW - gap;
        let topY = gap;
        
        if (artWin) {
            const artRect = artWin.getBoundingClientRect();
            const artW = artRect.width || 280;
            const artH = artRect.height || 300;
            artWin.style.left = (screenW - artW - gap) + 'px';
            artWin.style.top = topY + 'px';
            
            // Position image to the LEFT of articulo
            if (imgWin) {
                const imgRect = imgWin.getBoundingClientRect();
                const imgW = imgRect.width || 280;
                imgWin.style.left = (screenW - artW - gap - imgW - gap) + 'px';
                imgWin.style.top = topY + 'px';
            }
            
            // Others (poem etc) below articulo
            let belowY = topY + artH + gap;
            others.forEach(win => {
                const rect = win.getBoundingClientRect();
                const w = rect.width || 280;
                win.style.left = (screenW - w - gap) + 'px';
                win.style.top = belowY + 'px';
                belowY += (rect.height || 200) + gap;
            });
        } else {
            // Fallback: stack all on right
            let ry = gap;
            windows.forEach(win => {
                const rect = win.getBoundingClientRect();
                const w = rect.width || 280;
                win.style.left = (screenW - w - gap) + 'px';
                win.style.top = ry + 'px';
                ry += (rect.height || 200) + gap;
            });
        }
    }

    // Hacer las ventanas arrastrables
    function makeDraggable(windowElement) {
        const titleBar = windowElement.querySelector('.title-bar');
        if (!titleBar) return;
        
        const startDrag = (clientX, clientY, isTouch) => {
            const rect = windowElement.getBoundingClientRect();
            draggedWindow = windowElement;
            offsetX = clientX - rect.left;
            offsetY = clientY - rect.top;
            
            if (isTouch) {
                windowElement.style.setProperty('--drag-left', rect.left + 'px');
                windowElement.style.setProperty('--drag-top', rect.top + 'px');
                windowElement.classList.add('dragging');
            }
            
            bringToFront(windowElement);
        };
        
        titleBar.addEventListener('mousedown', (e) => {
            if (e.target.closest('.title-bar-controls')) return;
            startDrag(e.clientX, e.clientY, false);
            e.preventDefault();
        });

        titleBar.addEventListener('touchstart', (e) => {
            if (e.target.closest('.title-bar-controls')) return;
            const touch = e.touches[0];
            startDrag(touch.clientX, touch.clientY, true);
        }, { passive: true });
    }

    const updateDragPosition = (clientX, clientY, isTouch) => {
        if (!draggedWindow) return;
        
        const x = clientX - offsetX;
        const y = clientY - offsetY;
        const maxX = window.innerWidth - draggedWindow.offsetWidth;
        const maxY = window.innerHeight - draggedWindow.offsetHeight - (isTouch ? 44 : 40);
        
        const clampedX = Math.max(0, Math.min(x, maxX));
        const clampedY = Math.max(0, Math.min(y, maxY));
        
        if (isTouch) {
            draggedWindow.style.setProperty('--drag-left', clampedX + 'px');
            draggedWindow.style.setProperty('--drag-top', clampedY + 'px');
        }
        
        draggedWindow.style.left = clampedX + 'px';
        draggedWindow.style.top = clampedY + 'px';
    };

    document.addEventListener('mousemove', (e) => updateDragPosition(e.clientX, e.clientY, false));

    document.addEventListener('touchmove', (e) => {
        if (!draggedWindow) return;
        updateDragPosition(e.touches[0].clientX, e.touches[0].clientY, true);
        e.preventDefault();
    }, { passive: false });

    document.addEventListener('mouseup', () => { draggedWindow = null; });
    document.addEventListener('touchend', () => { draggedWindow = null; });

    // Traer ventana al frente
    function bringToFront(windowElement) {
        $$('.win95-window').forEach(w => w.classList.remove('active'));
        windowElement.classList.add('active');
        windowElement.style.zIndex = ++highestZIndex;
        updateTaskbar();
    }

    // Click en ventana para traerla al frente
    allWindows.forEach(win => {
        makeDraggable(win);
        win.addEventListener('mousedown', () => bringToFront(win));
        win.addEventListener('touchstart', () => bringToFront(win), { passive: true });
    });

    // Funcionalidad de botones de ventana usando delegación
    desktop?.addEventListener('click', (e) => {
        const btn = e.target.closest('.close-btn, .minimize-btn, .maximize-btn');
        if (!btn) return;
        
        e.stopPropagation();
        const win = btn.closest('.win95-window');
        if (!win) return;
        
        if (btn.classList.contains('close-btn')) {
            win.classList.add('hidden');
            if (win.dataset.windowId === 'tienda') pauseTiendaAudio();
            if (win.dataset.windowId === 'galeria') {
                const dp = $('#win95-details-panel');
                if (dp) { dp.classList.remove('open'); dp.setAttribute('aria-hidden', 'true'); }
            }
        } else if (btn.classList.contains('minimize-btn')) {
            win.classList.add('minimized');
            if (win.dataset.windowId === 'tienda') pauseTiendaAudio();
        } else if (btn.classList.contains('maximize-btn')) {
            const isMax = win.classList.toggle('maximized');
            if (isMax) {
                win.dataset.originalLeft = win.style.left;
                win.dataset.originalTop = win.style.top;
                win.dataset.originalWidth = win.style.width || '';
                Object.assign(win.style, { left: '0', top: '0', width: '100%', height: 'calc(100vh - 40px)' });
            } else {
                win.style.left = win.dataset.originalLeft;
                win.style.top = win.dataset.originalTop;
                win.style.width = win.dataset.originalWidth;
                win.style.height = '';
            }
        }
        updateTaskbar();
    });

    // Barra de tareas
    function updateTaskbar() {
        if (!taskbarItems) return;
        taskbarItems.innerHTML = '';
        
        const frag = document.createDocumentFragment();
        $$('.win95-window:not(.hidden)').forEach(win => {
            const title = win.querySelector('.title-bar-text')?.textContent || '';
            const isActive = win.classList.contains('active');
            
            const item = document.createElement('button');
            item.className = 'taskbar-item' + (isActive ? ' active' : '');
            item.textContent = title;
            item.addEventListener('click', () => {
                if (win.classList.contains('minimized')) {
                    win.classList.remove('minimized');
                    if (win.dataset.windowId === 'tienda') setTimeout(playTiendaAudio, 500);
                }
                bringToFront(win);
            });
            frag.appendChild(item);
        });
        taskbarItems.appendChild(frag);
    }

    // Menú de inicio
    startButton?.addEventListener('click', (e) => {
        e.stopPropagation();
        startMenu?.classList.toggle('active');
        startButton.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!startMenu?.contains(e.target) && !startButton?.contains(e.target)) {
            startMenu?.classList.remove('active');
            startButton?.classList.remove('active');
        }
    });

    // Elementos del menú usando delegación
    startMenu?.addEventListener('click', (e) => {
        const item = e.target.closest('.menu-item');
        if (!item) return;
        
        const shortcut = item.dataset.shortcut;
        const closeMenu = () => {
            startMenu.classList.remove('active');
            startButton.classList.remove('active');
        };

        if (isMobile()) {
            closeMenu();
            const mobileActions = {
                links: () => window.location.href = 'https://linktr.ee/guadalajaradenoche',
                palestina: () => window.open('https://www.unrwa.org/', '_blank'),
                radio: () => { if (radioAvailable) { musicPlayer.classList.remove('hidden'); musicPlayer.style.display = 'block'; } },
                minesweeper: () => {
                    const msWin = $('[data-window-id="minesweeper"]');
                    if (msWin) { msWin.classList.remove('hidden', 'minimized'); bringToFront(msWin); }
                }
            };
            
            if (mobileActions[shortcut]) {
                mobileActions[shortcut]();
            } else {
                window.location.href = 'indexPage/frame.html?p=' + shortcut;
            }
            return;
        }
        
        const desktopActions = {
            galeria: () => openWindow('galeria'),
            tienda: () => openWindow('tienda', true),
            articulos: () => openWindow('folder-articulos'),
            minesweeper: () => openWindow('minesweeper'),
            links: () => window.location.href = 'https://linktr.ee/guadalajaradenoche',
            palestina: () => window.open('https://www.unrwa.org/', '_blank'),
            radio: () => {
                if (radioAvailable) {
                    musicPlayer?.classList.remove('hidden');
                    $('#taskbar-radio')?.remove();
                }
            }
        };
        
        desktopActions[shortcut]?.();
        closeMenu();
        updateTaskbar();
    });

    // Reloj
    const clockEl = $('#clock');
    function updateClock() {
        if (!clockEl) return;
        const now = new Date();
        const h = now.getHours() % 12 || 12;
        const m = now.getMinutes().toString().padStart(2, '0');
        clockEl.textContent = `${h}:${m} ${now.getHours() >= 12 ? 'PM' : 'AM'}`;
    }

    updateClock();
    setInterval(updateClock, 1000);

    // Inicializar taskbar
    updateTaskbar();

    // ==================== REPRODUCTOR DE MÚSICA ====================
    
    const playBtn = $('#playBtn');
    const prevBtn = $('#prevBtn');
    const nextBtn = $('#nextBtn');
    const stopBtn = $('#stopBtn');
    const progressFill = $('#progressFill');
    const trackInfo = $('#trackInfo');
    const timeDisplay = $('#timeDisplay');
    const playerMinimizeBtn = musicPlayer?.querySelector('.player-minimize-btn');
    const playerCloseBtn = musicPlayer?.querySelector('.player-close-btn');
    const progressBar = $('.progress-bar');
    
    // Playlist: Radio en vivo + tracks locales
    const playlist = [
        { title: "RADIO GDN", url: "https://radio.guadalajaradenoxe.com/stream.mp3", isLive: true },
        { title: "GDL Nights Vol.1", url: "tiendaPage/assets/images/BACKGROUND WEB TIENDA MUSIC.mp3", isLive: false }
    ];
    
    const liveDot = $('#liveDot');
    
    let currentTrackIndex = 0;
    let isPlaying = false;
    const audioPlayer = new Audio();
    audioPlayer.volume = 0.5;
    
    const formatTime = (s) => isNaN(s) ? '00:00' : 
        `${Math.floor(s / 60).toString().padStart(2, '0')}:${Math.floor(s % 60).toString().padStart(2, '0')}`;
    
    function updateTimeDisplay() {
        if (!timeDisplay) return;
        const track = playlist[currentTrackIndex];
        timeDisplay.textContent = track.isLive ? 'STREAMING...' : 
            `${formatTime(audioPlayer.currentTime)} / ${formatTime(audioPlayer.duration)}`;
    }
    
    function loadTrack(index) {
        if (index < 0 || index >= playlist.length) return;
        currentTrackIndex = index;
        const track = playlist[currentTrackIndex];
        audioPlayer.src = track.url;
        
        if (trackInfo) {
            const textNode = trackInfo.childNodes[trackInfo.childNodes.length - 1];
            if (textNode) textNode.textContent = ' ' + track.title;
        }
        if (liveDot) {
            liveDot.classList.toggle('hidden', !track.isLive);
        }
        updateTimeDisplay();
    }
    
    // Play/Pause
    playBtn?.addEventListener('click', () => {
        if (isPlaying) {
            audioPlayer.pause();
            playBtn.textContent = '▶';
            isPlaying = false;
            if (liveDot) liveDot.classList.add('paused');
        } else {
            audioPlayer.play();
            playBtn.textContent = '⏸';
            isPlaying = true;
            if (liveDot) liveDot.classList.remove('paused');
        }
    });
    
    // Stop
    stopBtn?.addEventListener('click', () => {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
        if (playBtn) playBtn.textContent = '▶';
        isPlaying = false;
        if (progressFill) progressFill.style.width = '0%';
        updateTimeDisplay();
    });
    
    // Anterior/Siguiente
    const changeTrack = (delta) => {
        currentTrackIndex = (currentTrackIndex + delta + playlist.length) % playlist.length;
        const wasPlaying = isPlaying;
        loadTrack(currentTrackIndex);
        if (wasPlaying) audioPlayer.play();
    };
    
    prevBtn?.addEventListener('click', () => changeTrack(-1));
    nextBtn?.addEventListener('click', () => changeTrack(1));
    
    // Actualizar barra de progreso (solo para tracks no-live)
    audioPlayer.addEventListener('timeupdate', () => {
        if (!playlist[currentTrackIndex].isLive && audioPlayer.duration) {
            if (progressFill) progressFill.style.width = (audioPlayer.currentTime / audioPlayer.duration * 100) + '%';
            updateTimeDisplay();
        }
    });
    
    // Click en barra de progreso para saltar (solo tracks no-live)
    progressBar?.addEventListener('click', (e) => {
        if (!playlist[currentTrackIndex].isLive && audioPlayer.duration) {
            const rect = progressBar.getBoundingClientRect();
            audioPlayer.currentTime = ((e.clientX - rect.left) / rect.width) * audioPlayer.duration;
        }
    });
    
    // Cuando termina una canción no-live, pasar a la siguiente
    audioPlayer.addEventListener('ended', () => {
        if (!playlist[currentTrackIndex].isLive) changeTrack(1);
    });
    
    // Minimizar reproductor
    playerMinimizeBtn?.addEventListener('click', () => {
        musicPlayer?.classList.add('hidden');
        if (!$('#taskbar-radio')) {
            const radioBtn = document.createElement('button');
            radioBtn.id = 'taskbar-radio';
            radioBtn.className = 'taskbar-item';
            radioBtn.innerHTML = '<img src="https://win98icons.alexmeub.com/icons/png/media_player-0.png" alt="" class="taskbar-icon"> LaMovida95';
            radioBtn.addEventListener('click', () => {
                musicPlayer?.classList.remove('hidden');
                radioBtn.remove();
            });
            taskbarItems?.appendChild(radioBtn);
        }
    });
    
    // Cerrar reproductor (pausa audio también)
    playerCloseBtn?.addEventListener('click', () => {
        audioPlayer.pause();
        isPlaying = false;
        if (playBtn) playBtn.textContent = '▶';
        musicPlayer?.classList.add('hidden');
        $('#taskbar-radio')?.remove();
    });
    
    // Cargar primera canción
    loadTrack(0);

    // ===== RADIO: Check Icecast status and auto-show player (1:1 con funcionalidad original) =====
    const streamUrl = 'https://radio.guadalajaradenoxe.com/stream.mp3';
    const statusUrl = 'https://radio.guadalajaradenoxe.com/status-json.xsl';
    let radioAvailable = false;
    const radioMenuItem = $('[data-shortcut="radio"]');
    
    // Initially hide menu item until we confirm stream is live
    if (radioMenuItem) radioMenuItem.style.display = 'none';

    function checkIcecastStatus() {
        fetch(statusUrl)
            .then(function(r) { return r.json(); })
            .then(function(data) {
                var sources = (data && data.icestats && data.icestats.source) || [];
                if (!Array.isArray(sources)) sources = [sources];
                var live = sources.some(function(s) {
                    return s.listenurl && s.listenurl.indexOf('/stream.mp3') !== -1;
                });
                console.log('[Radio] Icecast check:', live ? 'LIVE' : 'OFFLINE');
                radioAvailable = live;
                
                if (live) {
                    // Show menu item
                    if (radioMenuItem) radioMenuItem.style.display = '';
                    // Auto-show player when live (1:1 with old brutalist widget behavior)
                    if (musicPlayer) {
                        musicPlayer.classList.remove('hidden');
                        musicPlayer.style.display = 'block';
                    }
                    // Ensure first track is the live stream
                    if (playlist[0].isLive && audioPlayer.src !== streamUrl) {
                        loadTrack(0);
                    }
                } else {
                    // Hide menu item and player when offline
                    if (radioMenuItem) radioMenuItem.style.display = 'none';
                    if (musicPlayer) {
                        musicPlayer.classList.add('hidden');
                    }
                    // Stop audio if playing
                    if (isPlaying && playlist[currentTrackIndex].isLive) {
                        audioPlayer.pause();
                        isPlaying = false;
                        if (playBtn) playBtn.textContent = '▶';
                    }
                }
            })
            .catch(function(err) {
                console.warn('[Radio] Icecast check failed:', err);
                radioAvailable = false;
                if (radioMenuItem) radioMenuItem.style.display = 'none';
                if (musicPlayer) musicPlayer.classList.add('hidden');
            });
    }

    // Initial check + poll every 60s (1:1 con original)
    checkIcecastStatus();
    setInterval(checkIcecastStatus, 60000);

    // ===== Panel de detalles de imagen (Galería) =====
    const detailsPanel = $('#win95-details-panel');
    const detailsImage = $('#win95-details-image');
    const detailsFilename = $('#win95-details-filename');
    const detailsType = $('#win95-details-type');
    const detailsDimensions = $('#win95-details-dimensions');
    const detailsPath = $('#win95-details-path');
    const detailsClose = $('#win95-details-close');
    const detailsOk = $('#win95-details-ok');
    const detailsTitlebar = $('#win95-details-titlebar');
    let detailsPanelHasBeenPositioned = false;

    function openDetailsPanel(data) {
        if (!detailsPanel) return;
        if (detailsImage) detailsImage.src = data.src;
        if (detailsFilename) detailsFilename.textContent = data.fileName;
        if (detailsType) detailsType.textContent = data.fileType;
        if (detailsDimensions) detailsDimensions.textContent = data.dimensions;
        if (detailsPath) detailsPath.textContent = data.path;

        if (!detailsPanelHasBeenPositioned) {
            const galeriaWin = $('[data-window-id="galeria"]');
            if (galeriaWin) {
                const gRect = galeriaWin.getBoundingClientRect();
                let panelLeft = gRect.right + 8;
                let panelTop = Math.max(0, gRect.top);
                
                if (panelLeft + 280 > window.innerWidth) panelLeft = gRect.left - 288;
                
                Object.assign(detailsPanel.style, {
                    left: panelLeft + 'px',
                    top: panelTop + 'px',
                    height: gRect.height + 'px'
                });
            }
            detailsPanelHasBeenPositioned = true;
        }

        detailsPanel.classList.add('open');
        detailsPanel.setAttribute('aria-hidden', 'false');
        detailsPanel.style.zIndex = ++highestZIndex;
    }

    function closeDetailsPanel() {
        if (!detailsPanel) return;
        detailsPanel.classList.remove('open');
        detailsPanel.setAttribute('aria-hidden', 'true');
        detailsPanelHasBeenPositioned = false;
    }

    detailsClose?.addEventListener('click', closeDetailsPanel);
    detailsOk?.addEventListener('click', closeDetailsPanel);

    // Make the details panel draggable by its titlebar
    if (detailsTitlebar && detailsPanel) {
        let isDraggingDetails = false;
        let detailsOffX = 0;
        let detailsOffY = 0;

        detailsTitlebar.addEventListener('mousedown', (e) => {
            if (e.target === detailsClose) return;
            isDraggingDetails = true;
            detailsOffX = e.clientX - detailsPanel.offsetLeft;
            detailsOffY = e.clientY - detailsPanel.offsetTop;
            detailsPanel.style.zIndex = ++highestZIndex;
            e.preventDefault();
        });

        document.addEventListener('mousemove', (e) => {
            if (!isDraggingDetails) return;
            const x = e.clientX - detailsOffX;
            const y = e.clientY - detailsOffY;
            const maxX = window.innerWidth - detailsPanel.offsetWidth;
            const maxY = window.innerHeight - detailsPanel.offsetHeight - 40;
            detailsPanel.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
            detailsPanel.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
        });

        document.addEventListener('mouseup', () => { isDraggingDetails = false; });
    }

    // Listen for messages from the gallery iframe
    window.addEventListener('message', (e) => {
        if (e.data?.type === 'galeria-open-details') openDetailsPanel(e.data.data);
    });

    // ─── Buscaminas (embedded) ───
    (function() {
        const msBoard = $('#msBoard');
        const msMineCount = $('#msMineCount');
        const msTimer = $('#msTimer');
        const msResetBtn = $('#msResetBtn');
        const msLevelSel = $('#msLevel');

        if (!msBoard) return;

        // Win95 Minesweeper sprites as inline SVGs
        const SPRITES = {
            faceSmile: `<img class="ms-face-icon" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Crect width='20' height='20' fill='%23FFFF00'/%3E%3Ccircle cx='10' cy='10' r='9' fill='%23FFFF00' stroke='%23000' stroke-width='1'/%3E%3Crect x='6' y='6' width='2' height='3' fill='%23000'/%3E%3Crect x='12' y='6' width='2' height='3' fill='%23000'/%3E%3Cpath d='M6 12 Q10 16 14 12' fill='none' stroke='%23000' stroke-width='1.2'/%3E%3C/svg%3E" alt=":)">`,
            faceCool: `<img class="ms-face-icon" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Crect width='20' height='20' fill='%23FFFF00'/%3E%3Ccircle cx='10' cy='10' r='9' fill='%23FFFF00' stroke='%23000' stroke-width='1'/%3E%3Crect x='4' y='7' width='5' height='2' rx='1' fill='%23000'/%3E%3Crect x='11' y='7' width='5' height='2' rx='1' fill='%23000'/%3E%3Cpath d='M6 12 Q10 16 14 12' fill='none' stroke='%23000' stroke-width='1.2'/%3E%3C/svg%3E" alt="B)">`,
            faceDead: `<img class="ms-face-icon" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Crect width='20' height='20' fill='%23FFFF00'/%3E%3Ccircle cx='10' cy='10' r='9' fill='%23FFFF00' stroke='%23000' stroke-width='1'/%3E%3Cline x1='5' y1='5' x2='9' y2='9' stroke='%23000' stroke-width='1.3'/%3E%3Cline x1='9' y1='5' x2='5' y2='9' stroke='%23000' stroke-width='1.3'/%3E%3Cline x1='11' y1='5' x2='15' y2='9' stroke='%23000' stroke-width='1.3'/%3E%3Cline x1='15' y1='5' x2='11' y2='9' stroke='%23000' stroke-width='1.3'/%3E%3Ccircle cx='10' cy='14' rx='3' ry='2' fill='none' stroke='%23000' stroke-width='1.2'/%3E%3C/svg%3E" alt="X(">`,
            faceOh: `<img class="ms-face-icon" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Crect width='20' height='20' fill='%23FFFF00'/%3E%3Ccircle cx='10' cy='10' r='9' fill='%23FFFF00' stroke='%23000' stroke-width='1'/%3E%3Crect x='6' y='6' width='2' height='3' fill='%23000'/%3E%3Crect x='12' y='6' width='2' height='3' fill='%23000'/%3E%3Ccircle cx='10' cy='14' r='2' fill='none' stroke='%23000' stroke-width='1.2'/%3E%3C/svg%3E" alt=":O">`,
            mine: `<img class="ms-sprite" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14'%3E%3Ccircle cx='7' cy='7' r='4' fill='%23000'/%3E%3Cline x1='7' y1='1' x2='7' y2='13' stroke='%23000' stroke-width='1.2'/%3E%3Cline x1='1' y1='7' x2='13' y2='7' stroke='%23000' stroke-width='1.2'/%3E%3Cline x1='3' y1='3' x2='11' y2='11' stroke='%23000' stroke-width='1'/%3E%3Cline x1='11' y1='3' x2='3' y2='11' stroke='%23000' stroke-width='1'/%3E%3Crect x='5' y='4' width='2' height='2' fill='%23fff'/%3E%3C/svg%3E" alt="*">`,
            flag: `<img class="ms-sprite" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14'%3E%3Cpolygon points='4,2 4,8 10,5' fill='%23FF0000'/%3E%3Cline x1='4' y1='2' x2='4' y2='11' stroke='%23000' stroke-width='1.3'/%3E%3Crect x='2' y='11' width='5' height='1.5' fill='%23000'/%3E%3Crect x='1' y='12' width='7' height='1.5' fill='%23000'/%3E%3C/svg%3E" alt="F">`,
            wrongFlag: `<img class="ms-sprite" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14'%3E%3Ccircle cx='7' cy='7' r='4' fill='%23000'/%3E%3Cline x1='7' y1='1' x2='7' y2='13' stroke='%23000' stroke-width='1.2'/%3E%3Cline x1='1' y1='7' x2='13' y2='7' stroke='%23000' stroke-width='1.2'/%3E%3Cline x1='3' y1='3' x2='11' y2='11' stroke='%23000' stroke-width='1'/%3E%3Cline x1='11' y1='3' x2='3' y2='11' stroke='%23000' stroke-width='1'/%3E%3Cline x1='2' y1='2' x2='12' y2='12' stroke='%23FF0000' stroke-width='1.8'/%3E%3Cline x1='12' y1='2' x2='2' y2='12' stroke='%23FF0000' stroke-width='1.8'/%3E%3C/svg%3E" alt="X">`
        };

        const levels = {
            beginner: { rows: 9, cols: 9, mines: 10 },
            intermediate: { rows: 16, cols: 16, mines: 40 },
            expert: { rows: 16, cols: 30, mines: 99 }
        };

        let st = null, timerId = null, startTime = null;
        const pad = n => String(n).padStart(3, '0');
        const getLevel = () => levels[msLevelSel?.value || 'beginner'];

      function createState(lv) {
        const { rows, cols, mines } = lv;
        const cells = Array.from({ length: rows }, () =>
          Array.from({ length: cols }, () => ({
            mine: false, revealed: false, flagged: false, count: 0
          }))
        );
        let placed = 0;
        while (placed < mines) {
          const r = Math.floor(Math.random() * rows);
          const c = Math.floor(Math.random() * cols);
          if (!cells[r][c].mine) { cells[r][c].mine = true; placed++; }
        }
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (cells[r][c].mine) continue;
            let cnt = 0;
            for (let dr = -1; dr <= 1; dr++) {
              for (let dc = -1; dc <= 1; dc++) {
                if (!dr && !dc) continue;
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && cells[nr][nc].mine) cnt++;
              }
            }
            cells[r][c].count = cnt;
          }
        }
        return { rows, cols, mines, flagsLeft: mines, revealedCount: 0, over: false, cells };
      }

      function renderBoard() {
        msBoard.innerHTML = '';
        msBoard.style.gridTemplateColumns = `repeat(${st.cols}, 20px)`;
        for (let r = 0; r < st.rows; r++) {
          for (let c = 0; c < st.cols; c++) {
            const el = document.createElement('div');
            el.className = 'ms-cell';
            el.dataset.r = r;
            el.dataset.c = c;
            el.addEventListener('click', onReveal);
            el.addEventListener('contextmenu', onFlag);
            msBoard.appendChild(el);
          }
        }
        updateCounters();
      }

      function updateCounters() {
        msMineCount.textContent = pad(Math.max(0, st.flagsLeft));
        msTimer.textContent = pad(getElapsed());
      }

      function getElapsed() {
        if (!startTime) return 0;
        return Math.min(999, Math.floor((Date.now() - startTime) / 1000));
      }

      function startTimerMs() {
        if (timerId) return;
        startTime = Date.now();
        timerId = setInterval(() => { msTimer.textContent = pad(getElapsed()); }, 250);
      }

      function stopTimerMs() {
        if (timerId) { clearInterval(timerId); timerId = null; }
      }

      function getCellEl(r, c) {
        return msBoard.querySelector(`.ms-cell[data-r="${r}"][data-c="${c}"]`);
      }

      function revealCell(r, c) {
        const cell = st.cells[r][c];
        if (cell.revealed || cell.flagged) return;
        cell.revealed = true;
        st.revealedCount++;
        const el = getCellEl(r, c);
        el.classList.add('revealed');
        if (cell.mine) {
          el.innerHTML = SPRITES.mine;
          el.classList.add('mine-hit');
          endGame(false);
          return;
        }
        if (cell.count > 0) {
          el.textContent = cell.count;
          el.classList.add('ms-n' + cell.count);
        } else {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (!dr && !dc) continue;
              const nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < st.rows && nc >= 0 && nc < st.cols) revealCell(nr, nc);
            }
          }
        }
        checkWin();
      }

      function checkWin() {
        if (st.revealedCount === st.rows * st.cols - st.mines) endGame(true);
      }

      function endGame(win) {
        st.over = true;
        stopTimerMs();
        msResetBtn.innerHTML = win ? SPRITES.faceCool : SPRITES.faceDead;
        for (let r = 0; r < st.rows; r++) {
          for (let c = 0; c < st.cols; c++) {
            const cell = st.cells[r][c];
            const el = getCellEl(r, c);
            if (cell.mine && !cell.revealed) {
              el.classList.add('revealed');
              el.innerHTML = SPRITES.mine;
            }
            if (!win && cell.flagged && !cell.mine) {
              el.classList.add('revealed', 'wrong-flag');
              el.innerHTML = SPRITES.wrongFlag;
            }
            el.removeEventListener('click', onReveal);
            el.removeEventListener('contextmenu', onFlag);
          }
        }
      }

      function onReveal(e) {
        if (st.over) return;
        const r = Number(e.currentTarget.dataset.r);
        const c = Number(e.currentTarget.dataset.c);
        startTimerMs();
        revealCell(r, c);
      }

      function onFlag(e) {
        e.preventDefault();
        if (st.over) return;
        const r = Number(e.currentTarget.dataset.r);
        const c = Number(e.currentTarget.dataset.c);
        const cell = st.cells[r][c];
        if (cell.revealed) return;
        cell.flagged = !cell.flagged;
        const el = getCellEl(r, c);
        el.classList.toggle('flagged', cell.flagged);
        el.innerHTML = cell.flagged ? SPRITES.flag : '';
        st.flagsLeft += cell.flagged ? -1 : 1;
        updateCounters();
      }

      function resetGame() {
        stopTimerMs();
        startTime = null;
        msResetBtn.innerHTML = SPRITES.faceSmile;
        st = createState(getLevel());
        renderBoard();
      }

      msResetBtn.addEventListener('click', resetGame);
      if (msLevelSel) msLevelSel.addEventListener('change', resetGame);

      // Classic Win95: show 'oh' face while mouse is down on the board
      msBoard.addEventListener('mousedown', () => {
        if (!st.over) msResetBtn.innerHTML = SPRITES.faceOh;
      });
      msBoard.addEventListener('mouseup', () => {
        if (!st.over) msResetBtn.innerHTML = SPRITES.faceSmile;
      });
      msBoard.addEventListener('mouseleave', () => {
        if (!st.over) msResetBtn.innerHTML = SPRITES.faceSmile;
      });

      resetGame();
    })();

});