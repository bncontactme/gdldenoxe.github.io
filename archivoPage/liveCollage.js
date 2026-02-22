// Live Collage Gallery - Optimized
(function() {
  'use strict';

  const collageContainer = document.getElementById('live-collage-container');
  const RESET_INTERVAL = 300000; // 5 minutes
  const MIN_DISTANCE = 150;
  const IMAGE_INTERVAL = 2000;
  const MAX_IMAGES = 50; // Limit DOM nodes for performance

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

  // Place image in collage
  function placeImage(src) {
    const size = Math.random() * 180 + 120;
    const pos = getRandomPosition(size);

    const img = document.createElement('img');
    img.src = src;
    img.dataset.src = src;
    img.style.cssText = `top:${pos.top}px;left:${pos.left}px;width:${size}px;height:auto;z-index:${++zIndex}`;
    img.draggable = false;

    // Attach metadata from JSON (sourced from EXIF at build time)
    const meta = imageMetadata[src];
    if (meta) {
      if (meta.artista) img.dataset.artista = meta.artista;
      if (meta.descripcion) img.dataset.descripcion = meta.descripcion;
    }

    img.onload = function() {
      this.dataset.width = this.naturalWidth;
      this.dataset.height = this.naturalHeight;
    };

    img.onerror = function() {
      this.remove();
    };

    img.onclick = function(e) {
      e.stopPropagation();
      openDetails(this);
    };

    collageContainer.appendChild(img);
    lastPos = { top: pos.top, left: pos.left, size };

    // Remove oldest images if too many on screen
    const images = collageContainer.getElementsByTagName('img');
    if (images.length > MAX_IMAGES) {
      images[0].remove();
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

    for (const name of sortedNames) {
      const count = folders[name].length;
      const item = document.createElement('div');
      item.className = 'fe-folder';
      item.innerHTML = FOLDER_SVG + '<span class="fe-label">' + escapeHtml(name) + '</span>';
      item.title = name + ' (' + count + ' imágenes)';
      item.onclick = function() { renderFolder(name, folders[name]); };
      explorerBody.appendChild(item);
    }

    if (explorerStatus) explorerStatus.textContent = sortedNames.length + ' carpetas';
  }

  function renderFolder(name, images) {
    explorerCurrentFolder = name;
    explorerBody.innerHTML = '';
    if (explorerBack) explorerBack.disabled = false;
    if (explorerPath) explorerPath.textContent = 'Archivo GDN \\ ' + name;
    if (explorerTitle) explorerTitle.textContent = name;

    for (const path of images) {
      const item = document.createElement('div');
      item.className = 'fe-image';
      const fileName = getFileName(path);
      item.innerHTML = '<img class="fe-image-thumb" src="' + path + '" alt="' + escapeHtml(fileName) + '" loading="lazy">'
        + '<span class="fe-label">' + escapeHtml(fileName) + '</span>';
      item.title = fileName;
      item.onclick = function() {
        // On desktop (inside iframe), send to parent for the desktop player
        // On mobile/standalone, open the built-in details popup
        let parentHandled = false;
        if (parent !== window) {
          try {
            parentHandled = !!parent.document.getElementById('win95-player-panel');
          } catch (e) { /* cross-origin */ }
        }

        if (parentHandled) {
          const listData = images.map(function(p) {
            const m = imageMetadata[p];
            return {
              src: new URL(p, location.href).href,
              fileName: getFileName(p),
              fileType: getExtension(getFileName(p)),
              artista: (m && m.artista) || '',
              descripcion: (m && m.descripcion) || ''
            };
          });
          const idx = images.indexOf(path);
          parent.postMessage({ type: 'galeria-open-player', list: listData, index: idx }, '*');
        } else {
          // Mobile / standalone — open built-in details popup
          const fakeImg = document.createElement('img');
          fakeImg.src = path;
          fakeImg.dataset.src = path;
          const thumb = item.querySelector('img');
          fakeImg.dataset.width = thumb ? (thumb.naturalWidth || '') : '';
          fakeImg.dataset.height = thumb ? (thumb.naturalHeight || '') : '';
          const meta = imageMetadata[path];
          if (meta) {
            if (meta.artista) fakeImg.dataset.artista = meta.artista;
            if (meta.descripcion) fakeImg.dataset.descripcion = meta.descripcion;
          }
          closeExplorer();
          openDetails(fakeImg);
        }
      };
      explorerBody.appendChild(item);
    }

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
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      collagePaused = true;
      clearTimeout(imageTimeout);
      imageTimeout = null;
    } else if (collagePaused) {
      collagePaused = false;
      if (displayImages.length) startDisplaying();
    }
  });

  // Display images periodically
  function startDisplaying() {
    if (imageTimeout) return; // don't double-start
    function addNext() {
      if (collagePaused) return;
      // Wait for container to have layout dimensions before placing
      const w = collageContainer.offsetWidth || window.innerWidth;
      const h = collageContainer.offsetHeight || window.innerHeight;
      if (w < 10 || h < 10) {
        requestAnimationFrame(addNext);
        return;
      }
      const path = selectImage();
      if (path) placeImage(path);
      imageTimeout = setTimeout(addNext, IMAGE_INTERVAL);
    }

    addNext();
  }

  // Reset gallery for performance
  function reset() {
    clearTimeout(imageTimeout);
    clearTimeout(resetTimeout);
    imageTimeout = null;
    resetTimeout = null;

    // Clear all images efficiently
    collageContainer.textContent = '';

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
