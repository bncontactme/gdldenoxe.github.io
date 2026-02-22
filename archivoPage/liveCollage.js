// Live Collage Gallery - Optimized
(function() {
  'use strict';

  const collageContainer = document.getElementById('live-collage-container');
  const _mobile = window.innerWidth <= 768;
  const RESET_INTERVAL = 300000; // 5 min — only reset to reclaim memory
  const MIN_DISTANCE = _mobile ? 100 : 150;
  const IMAGE_INTERVAL = _mobile ? 3000 : 2000;
  const MAX_IMAGES = _mobile ? 20 : 52; // DOM ceiling before baking to canvas
  const MAX_Z = 500;

  // Background canvas — old images get painted here so they never disappear
  const bgCanvas = document.createElement('canvas');
  bgCanvas.style.cssText = 'position:absolute;top:0;left:0;width:100%;height:100%;z-index:0;cursor:pointer;';
  let bgCtx = null; // lazily initialized after container has dimensions

  // Hitmap — lightweight array of baked image rects + metadata for click detection
  // Each entry: { left, top, w, h, src, artista, descripcion, naturalW, naturalH }
  let bakedHits = [];

  function ensureCanvas() {
    if (bgCtx) return;
    const w = collageContainer.offsetWidth || window.innerWidth;
    const h = collageContainer.offsetHeight || window.innerHeight;
    // Use CSS pixels (not device pixels) to keep memory low on mobile
    bgCanvas.width = w;
    bgCanvas.height = h;
    bgCtx = bgCanvas.getContext('2d', { alpha: false });
    bgCtx.fillStyle = '#ffffff';
    bgCtx.fillRect(0, 0, w, h);
    collageContainer.prepend(bgCanvas);
  }

  // Bake a DOM image onto the canvas, then remove it from DOM
  function bakeImage(el) {
    ensureCanvas();
    // Only draw if the image actually loaded (complete & has real dimensions)
    if (el.complete && el.naturalWidth > 0) {
      try {
        const top = parseFloat(el.style.top) || 0;
        const left = parseFloat(el.style.left) || 0;
        const cssW = parseFloat(el.style.width) || el.offsetWidth || 100;
        const aspect = el.naturalHeight / el.naturalWidth;
        const cssH = el.offsetHeight || Math.round(cssW * aspect) || 100;
        bgCtx.drawImage(el, left, top, cssW, cssH);
        // Store hit region for click detection on canvas
        bakedHits.push({
          left: left, top: top, w: cssW, h: cssH,
          src: el.dataset.src || el.src,
          artista: el.dataset.artista || '',
          descripcion: el.dataset.descripcion || '',
          naturalW: el.naturalWidth,
          naturalH: el.naturalHeight
        });
      } catch (e) { /* tainted canvas / broken — skip silently */ }
    }
    el.onload = el.onerror = el.onclick = null;
    el.removeAttribute('src');
    el.remove();
  }

  // Canvas click handler — find topmost baked image under the tap
  bgCanvas.addEventListener('click', function(e) {
    const rect = bgCanvas.getBoundingClientRect();
    const scaleX = bgCanvas.width / rect.width;
    const scaleY = bgCanvas.height / rect.height;
    const x = (e.clientX - rect.left) * scaleX;
    const y = (e.clientY - rect.top) * scaleY;
    // Iterate in reverse — last baked = visually on top
    for (let i = bakedHits.length - 1; i >= 0; i--) {
      const h = bakedHits[i];
      if (x >= h.left && x <= h.left + h.w && y >= h.top && y <= h.top + h.h) {
        // Build a fake img-like object with the data openDetails expects
        const fakeImg = {
          dataset: {
            src: h.src,
            artista: h.artista,
            descripcion: h.descripcion,
            width: h.naturalW,
            height: h.naturalH
          },
          src: h.src,
          naturalWidth: h.naturalW,
          naturalHeight: h.naturalH
        };
        openDetails(fakeImg);
        return;
      }
    }
  });

  // State
  let lastPos = { top: null, left: null, size: null };
  let zIndex = 1;
  let recentNonGifs = [];
  let recentGifs = [];
  let archiveImages = []; // Ordered list of image paths (ALL images, including GIFs)
  let displayImages = []; // Shuffled subset for collage display (GIFs thinned)
  let imageMetadata = {}; // path -> { artista, descripcion }
  let imageTimeout = null;
  let resetTimeout = null;

  // Calculate distance between two points
  function distance(x1, y1, x2, y2) {
    const dx = x2 - x1;
    const dy = y2 - y1;
    return Math.sqrt(dx * dx + dy * dy);
  }

  // Get random position avoiding last placement
  function getRandomPosition(size) {
    // Use viewport size as fallback since container is position:fixed inset:0
    const containerH = collageContainer.offsetHeight || window.innerHeight;
    const containerW = collageContainer.offsetWidth || window.innerWidth;
    const maxTop = Math.max(0, containerH - size);
    const maxLeft = Math.max(0, containerW - size);
    let top, left, attempts = 0;

    do {
      top = Math.random() * maxTop;
      left = Math.random() * maxLeft;
      attempts++;

      if (lastPos.top === null || attempts >= 50) break;

      const dist = distance(
        left + size / 2, top + size / 2,
        lastPos.left + lastPos.size / 2, lastPos.top + lastPos.size / 2
      );
      if (dist >= MIN_DISTANCE) break;
    } while (attempts < 50);

    return { top, left };
  }

  // Clean up an image element to prevent leaks
  function cleanupImg(el) {
    el.onload = el.onerror = el.onclick = null;
    el.removeAttribute('src');
    el.remove();
  }

  // Place image in collage
  function placeImage(src) {
    const size = _mobile ? Math.random() * 130 + 90 : Math.random() * 180 + 120;
    const pos = getRandomPosition(size);

    // Wrap z-index to avoid unbounded growth
    if (++zIndex > MAX_Z) zIndex = 1;

    const img = document.createElement('img');
    img.dataset.src = src; // always store original full-res path for details
    img.style.cssText = `top:${pos.top}px;left:${pos.left}px;width:${size}px;height:auto;z-index:${zIndex}`;
    img.draggable = false;
    img.decoding = 'async';
    if (_mobile) img.loading = 'lazy';

    // Attach metadata from JSON (sourced from EXIF at build time)
    const meta = imageMetadata[src];
    if (meta) {
      if (meta.artista) img.dataset.artista = meta.artista;
      if (meta.descripcion) img.dataset.descripcion = meta.descripcion;
    }

    img.onload = function() {
      this.dataset.width = this.naturalWidth;
      this.dataset.height = this.naturalHeight;
      this.onload = null; // free handler after use
    };

    img.onerror = function() {
      cleanupImg(this);
    };

    img.onclick = function(e) {
      e.stopPropagation();
      openDetails(this);
    };

    // Set src last so handlers are attached before load fires
    img.src = src;

    collageContainer.appendChild(img);
    lastPos = { top: pos.top, left: pos.left, size };

    // Bake oldest images onto canvas when DOM ceiling reached
    const images = collageContainer.getElementsByTagName('img');
    while (images.length > MAX_IMAGES) {
      bakeImage(images[0]);
    }
  }

  // Extract filename from path
  function getFileName(path) {
    return path.split('/').pop() || path;
  }

  // Get file extension
  function getExtension(fileName) {
    const parts = fileName.split('.');
    return parts.length > 1 ? parts.pop().toUpperCase() : 'Archivo';
  }

  // Image details popup elements
  const detailsOverlay = document.getElementById('img-details-overlay');
  const detailsPreview = document.getElementById('img-details-preview');
  const detailsFilename = document.getElementById('detail-filename');
  const detailsType = document.getElementById('detail-type');
  const detailsDimensions = document.getElementById('detail-dimensions');
  const detailsArtista = document.getElementById('detail-artista');
  const detailsArtistaRow = document.getElementById('detail-artista-row');
  const detailsDescripcion = document.getElementById('detail-descripcion');
  const detailsDescripcionRow = document.getElementById('detail-descripcion-row');
  const detailsCloseBtn = document.getElementById('img-details-close');
  const detailsOkBtn = document.getElementById('img-details-ok');

  function closeDetailsPopup() {
    if (detailsOverlay) detailsOverlay.classList.remove('open');
  }

  if (detailsCloseBtn) detailsCloseBtn.onclick = closeDetailsPopup;
  if (detailsOkBtn) detailsOkBtn.onclick = closeDetailsPopup;
  if (detailsOverlay) detailsOverlay.onclick = function(e) {
    if (e.target === detailsOverlay) closeDetailsPopup();
  };

  // ===== File Explorer =====
  const explorerOverlay = document.getElementById('file-explorer-overlay');
  const explorerBody = document.getElementById('file-explorer-body');
  const explorerBack = document.getElementById('file-explorer-back');
  const explorerPath = document.getElementById('file-explorer-path');
  const explorerStatus = document.getElementById('file-explorer-status');
  const explorerClose = document.getElementById('file-explorer-close');
  const explorerTitle = document.getElementById('file-explorer-title');
  const exploreBtn = document.getElementById('img-details-explore');

  let explorerCurrentFolder = null; // null = root (folder list)

  // SVG folder icon (XP-style yellow folder)
  const FOLDER_SVG = '<svg class="fe-folder-icon" viewBox="0 0 32 32" xmlns="http://www.w3.org/2000/svg">'
    + '<path d="M2 6 L2 26 L30 26 L30 10 L14 10 L12 6 Z" fill="#F5D73A" stroke="#C4A82A" stroke-width="1"/>'
    + '<path d="M2 10 L30 10 L30 26 L2 26 Z" fill="#FFEC80" stroke="#C4A82A" stroke-width="0.5"/>'
    + '</svg>';

  function buildFolderMap() {
    // Group images by artist — use @handle for folder label
    const folders = {};
    for (const path of archiveImages) {
      const meta = imageMetadata[path];
      const fullArtist = (meta && meta.artista) ? meta.artista : '';
      let folderName;
      if (fullArtist) {
        const handleMatch = fullArtist.match(/@\w+/);
        folderName = handleMatch ? handleMatch[0] : fullArtist;
      } else {
        folderName = 'Archivo GDN';
      }
      if (!folders[folderName]) folders[folderName] = [];
      folders[folderName].push(path);
    }
    return folders;
  }

  function renderFolderList() {
    explorerCurrentFolder = null;
    explorerBody.innerHTML = '';
    if (explorerBack) explorerBack.disabled = true;
    if (explorerPath) explorerPath.textContent = 'Archivo GDN';
    if (explorerTitle) explorerTitle.textContent = 'Archivo GDN';

    const folders = buildFolderMap();
    const sortedNames = Object.keys(folders).sort((a, b) => {
      // "Archivo GDN" always first
      if (a === 'Archivo GDN') return -1;
      if (b === 'Archivo GDN') return 1;
      return a.localeCompare(b);
    });

    const frag = document.createDocumentFragment();
    for (const name of sortedNames) {
      const count = folders[name].length;
      const item = document.createElement('div');
      item.className = 'fe-folder';
      item.innerHTML = FOLDER_SVG + '<span class="fe-label">' + escapeHtml(name) + '</span>';
      item.title = name + ' (' + count + ' imágenes)';
      item.onclick = function() { renderFolder(name, folders[name]); };
      frag.appendChild(item);
    }
    explorerBody.appendChild(frag);

    if (explorerStatus) explorerStatus.textContent = sortedNames.length + ' carpetas';
  }

  function renderFolder(name, images) {
    explorerCurrentFolder = name;
    explorerBody.innerHTML = '';
    if (explorerBack) explorerBack.disabled = false;
    if (explorerPath) explorerPath.textContent = 'Archivo GDN \\ ' + name;
    if (explorerTitle) explorerTitle.textContent = name;

    // Pre-compute listData once per folder (lazy, cached for all clicks)
    let cachedListData = null;
    function getListData() {
      if (!cachedListData) {
        cachedListData = images.map(function(p) {
          const m = imageMetadata[p];
          return {
            src: new URL(p, location.href).href,
            fileName: getFileName(p),
            fileType: getExtension(getFileName(p)),
            artista: (m && m.artista) || '',
            descripcion: (m && m.descripcion) || ''
          };
        });
      }
      return cachedListData;
    }

    // Detect desktop mode once, not per click
    let parentHandled = false;
    if (parent !== window) {
      try {
        parentHandled = !!parent.document.getElementById('win95-player-panel');
      } catch (e) { /* cross-origin */ }
    }

    const frag = document.createDocumentFragment();

    for (let i = 0; i < images.length; i++) {
      const path = images[i];
      const idx = i;
      const item = document.createElement('div');
      item.className = 'fe-image';
      const fileName = getFileName(path);

      // Use pre-generated 96px thumbnail (all stored as .jpg in thumbs/)
      const baseName = fileName.replace(/\.[^.]+$/, '');
      const thumbPath = 'archiveImages/thumbs/' + baseName + '.jpg';

      const img = document.createElement('img');
      img.className = 'fe-image-thumb';
      img.src = thumbPath;
      img.alt = fileName;
      img.loading = 'lazy';
      img.decoding = 'async';
      img.width = 48;
      img.height = 48;

      const label = document.createElement('span');
      label.className = 'fe-label';
      label.textContent = fileName;

      item.appendChild(img);
      item.appendChild(label);
      item.title = fileName;

      item.onclick = function() {
        if (parentHandled) {
          parent.postMessage({ type: 'galeria-open-player', list: getListData(), index: idx }, '*');
        } else {
          // Mobile / standalone — open built-in details popup
          // Load full image to get real dimensions before opening details
          const fakeImg = new Image();
          fakeImg.dataset.src = path;
          const meta = imageMetadata[path];
          if (meta) {
            if (meta.artista) fakeImg.dataset.artista = meta.artista;
            if (meta.descripcion) fakeImg.dataset.descripcion = meta.descripcion;
          }
          closeExplorer();
          fakeImg.onload = function() {
            fakeImg.dataset.width = fakeImg.naturalWidth;
            fakeImg.dataset.height = fakeImg.naturalHeight;
            openDetails(fakeImg);
          };
          fakeImg.onerror = function() {
            fakeImg.dataset.width = '';
            fakeImg.dataset.height = '';
            openDetails(fakeImg);
          };
          fakeImg.src = path;
        }
      };

      frag.appendChild(item);
    }

    explorerBody.appendChild(frag);
    if (explorerStatus) explorerStatus.textContent = images.length + ' imágenes';
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function openExplorer() {
    if (!explorerOverlay) return;
    renderFolderList();
    explorerOverlay.classList.add('open');
  }

  function closeExplorer() {
    if (explorerOverlay) explorerOverlay.classList.remove('open');
  }

  if (explorerClose) explorerClose.onclick = closeExplorer;
  if (explorerBack) explorerBack.onclick = function() {
    if (explorerCurrentFolder !== null) renderFolderList();
  };
  if (explorerOverlay) explorerOverlay.onclick = function(e) {
    if (e.target === explorerOverlay) closeExplorer();
  };
  if (exploreBtn) exploreBtn.onclick = function() {
    closeDetailsPopup();
    openExplorer();
  };

  // Listen for parent requesting explorer open (desktop mode, origin-validated)
  window.addEventListener('message', function(e) {
    if (e.origin !== location.origin) return;
    if (e.data?.type === 'open-file-explorer') openExplorer();
  });

  // Show image details — use parent panel on desktop, built-in popup otherwise
  function openDetails(img) {
    const src = img.dataset.src || img.src;
    const fileName = getFileName(src);
    const fullSrc = new URL(src, location.href).href;
    const dims = `${img.dataset.width || img.naturalWidth || '—'} × ${img.dataset.height || img.naturalHeight || '—'}`;
    const fileType = getExtension(fileName);
    const artista = img.dataset.artista || '';
    const descripcion = img.dataset.descripcion || '';
    const data = { src: fullSrc, fileName, fileType, dimensions: dims, path: src, artista, descripcion };

    // On desktop, the parent index.html has the details panel — send message there
    // On mobile (frame.html), parent won't have the handler, so show built-in popup
    let parentHandled = false;
    if (parent !== window) {
      try {
        parentHandled = !!parent.document.getElementById('win95-details-panel');
      } catch (e) { /* cross-origin */ }
      if (parentHandled) {
        parent.postMessage({ type: 'galeria-open-details', data }, '*');
      }
    }

    // Show built-in popup when standalone or when parent doesn't have the panel
    if (!parentHandled) {
      if (detailsPreview) detailsPreview.src = fullSrc;
      if (detailsFilename) detailsFilename.textContent = fileName;
      if (detailsType) detailsType.textContent = fileType;
      if (detailsDimensions) detailsDimensions.textContent = dims;

      // Show artista & descripcion only when non-empty
      if (detailsArtistaRow) detailsArtistaRow.style.display = artista ? '' : 'none';
      if (detailsArtista) detailsArtista.textContent = artista;
      if (detailsDescripcionRow) detailsDescripcionRow.style.display = descripcion ? '' : 'none';
      if (detailsDescripcion) detailsDescripcion.textContent = descripcion;

      if (detailsOverlay) detailsOverlay.classList.add('open');
    }
  }

  // Local manifest listing all images (no API rate limits)
  // To update after adding images:  cd archivoPage && bash generate-manifest.sh
  const MANIFEST_URL = 'images.json';

  async function discoverImages() {
    let files = null;

    try {
      const res = await fetch(MANIFEST_URL);
      if (res.ok) {
        const entries = await res.json();
        files = [];
        for (const entry of entries) {
          if (typeof entry === 'string') {
            files.push('archiveImages/' + entry);
          } else if (entry && entry.filename) {
            const path = 'archiveImages/' + entry.filename;
            files.push(path);
            if (entry.artista || entry.descripcion) {
              imageMetadata[path] = {
                artista: entry.artista || '',
                descripcion: entry.descripcion || ''
              };
            }
          }
        }
      }
    } catch (e) { /* network error */ }

    if (!files || !files.length) return;

    // archiveImages = complete list (explorer uses this)
    archiveImages = files;

    // displayImages = thinned-out copy for collage (GIFs reduced, shuffled)
    for (const path of files) {
      if (path.endsWith('.gif') && Math.random() < 0.35) continue;
      displayImages.push(path);
    }
    // Fisher-Yates shuffle
    for (let i = displayImages.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [displayImages[i], displayImages[j]] = [displayImages[j], displayImages[i]];
    }

    if (displayImages.length) startDisplaying();
  }

  // Select next image avoiding recent ones
  function selectImage() {
    if (!displayImages.length) return null;

    let idx, attempts = 0;
    do {
      idx = Math.floor(Math.random() * displayImages.length);
      const path = displayImages[idx];
      const isGif = path.endsWith('.gif');
      const recent = isGif ? recentGifs : recentNonGifs;

      if (!recent.includes(path) || attempts >= 100) break;
      attempts++;
    } while (true);

    const path = displayImages[idx];
    const isGif = path.endsWith('.gif');

    if (isGif) {
      recentGifs.push(path);
      if (recentGifs.length > 3) recentGifs.shift();
    } else {
      recentNonGifs.push(path);
      if (recentNonGifs.length > 15) recentNonGifs.shift();
    }

    return path;
  }

  // Pause collage when page is not visible (saves CPU + network in background tabs/hidden iframes)
  let collagePaused = false;
  let collageEverStarted = false;
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      // Don't pause if collage hasn't started yet (Instagram/WebView may fire hidden early)
      if (!collageEverStarted) return;
      collagePaused = true;
      clearTimeout(imageTimeout);
      imageTimeout = null;
    } else {
      if (collagePaused) {
        collagePaused = false;
        if (displayImages.length) startDisplaying();
      }
    }
  });

  // Display images periodically
  function startDisplaying() {
    if (imageTimeout) return; // don't double-start
    collageEverStarted = true;
    collagePaused = false; // force unpause in case WebView fired hidden during load
    let dimensionRetries = 0;
    function addNext() {
      if (collagePaused) return;
      // Wait for container to have layout dimensions before placing
      const w = collageContainer.offsetWidth || window.innerWidth;
      const h = collageContainer.offsetHeight || window.innerHeight;
      if (w < 10 || h < 10) {
        dimensionRetries++;
        // After many retries, force dimensions via JS (WebView workaround)
        if (dimensionRetries > 30) {
          collageContainer.style.width = window.innerWidth + 'px';
          collageContainer.style.height = window.innerHeight + 'px';
        }
        requestAnimationFrame(addNext);
        return;
      }
      dimensionRetries = 0;
      const path = selectImage();
      if (path) placeImage(path);
      imageTimeout = setTimeout(addNext, IMAGE_INTERVAL);
    }

    addNext();
  }

  // Reset gallery — bake remaining DOM images to canvas, reclaim DOM memory (every 5 min)
  function reset() {
    clearTimeout(imageTimeout);
    clearTimeout(resetTimeout);
    imageTimeout = null;
    resetTimeout = null;

    // Bake all live DOM images onto canvas so nothing disappears visually
    const imgs = collageContainer.getElementsByTagName('img');
    while (imgs.length) bakeImage(imgs[0]);

    // Reset state
    lastPos = { top: null, left: null, size: null };
    zIndex = 1;
    recentNonGifs = [];
    recentGifs = [];

    // Restart
    startDisplaying();
    resetTimeout = setTimeout(reset, RESET_INTERVAL);
  }

  // Initialize gallery — start discovery + display immediately
  function init() {
    collageContainer.style.display = 'block';
    // Force explicit dimensions for WebViews where position:absolute/fixed
    // may not compute proper dimensions inside iframes (Instagram, TikTok, etc.)
    if (collageContainer.offsetWidth < 10 || collageContainer.offsetHeight < 10) {
      collageContainer.style.width = '100vw';
      collageContainer.style.height = '100vh';
    }
    discoverImages();
  }

  // Setup popup handlers
  function setupPopup() {
    const overlay = document.getElementById('xp-popup-overlay');
    const okBtn = document.getElementById('xp-popup-ok');
    const closeBtn = document.getElementById('xp-popup-close');

    // Start images loading behind the popup right away
    init();

    function dismiss() {
      overlay.style.display = 'none';
      resetTimeout = setTimeout(reset, RESET_INTERVAL);
    }

    okBtn.onclick = dismiss;
    closeBtn.onclick = dismiss;
  }

  // Start when DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupPopup);
  } else {
    setupPopup();
  }
})();
