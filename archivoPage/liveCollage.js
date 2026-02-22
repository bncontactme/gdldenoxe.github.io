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
  let archiveImages = []; // Each entry: { path, artista?, descripcion? }
  let imageMetadata = {}; // path -> { artista?, descripcion? }
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

    // Attach metadata if available
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
        // Check if parent has the details panel (desktop mode)
        parentHandled = !!parent.document.getElementById('win95-details-panel');
      } catch (e) { /* cross-origin */ }
      parent.postMessage({ type: 'galeria-open-details', data }, '*');
    }

    // Show built-in popup when standalone or when parent doesn't have the panel
    if (!parentHandled) {
      if (detailsPreview) detailsPreview.src = fullSrc;
      if (detailsFilename) detailsFilename.textContent = fileName;
      if (detailsType) detailsType.textContent = fileType;
      if (detailsDimensions) detailsDimensions.textContent = dims;

      // Show artista & descripcion (debug: always visible)
      if (detailsArtista) detailsArtista.textContent = artista || '—';
      if (detailsDescripcion) detailsDescripcion.textContent = descripcion || '—';

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
            // Store metadata keyed by path
            const meta = {};
            if (entry.artista) meta.artista = entry.artista;
            if (entry.descripcion) meta.descripcion = entry.descripcion;
            if (Object.keys(meta).length) imageMetadata[path] = meta;
          }
        }
      }
    } catch (e) { /* network error */ }

    if (!files || !files.length) return;

    // Add images, randomly thin out GIFs
    for (const path of files) {
      if (path.endsWith('.gif') && Math.random() < 0.35) continue;
      archiveImages.push(path);
    }

    // Shuffle so display order is random
    for (let i = archiveImages.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [archiveImages[i], archiveImages[j]] = [archiveImages[j], archiveImages[i]];
    }

    if (archiveImages.length) startDisplaying();
  }

  // Select next image avoiding recent ones
  function selectImage() {
    if (!archiveImages.length) return null;

    let idx, attempts = 0;
    do {
      idx = Math.floor(Math.random() * archiveImages.length);
      const path = archiveImages[idx];
      const isGif = path.endsWith('.gif');
      const recent = isGif ? recentGifs : recentNonGifs;

      if (!recent.includes(path) || attempts >= 100) break;
      attempts++;
    } while (true);

    const path = archiveImages[idx];
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

  // Display images periodically
  function startDisplaying() {
    function addNext() {
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
