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
  let archiveImages = [];
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
    const data = { src: fullSrc, fileName, fileType, dimensions: dims, path: src };

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
      if (detailsOverlay) detailsOverlay.classList.add('open');
    }
  }

  // Check if image exists
  function checkImage(path) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = path;
    });
  }

  // Check a single image number against all extensions in parallel
  function checkNum(num) {
    const extensions = ['jpg', 'jpeg', 'gif', 'png', 'webp'];
    const paths = extensions.map(ext => `archiveImages/archiveImage${num}.${ext}`);
    return Promise.all(paths.map(p => checkImage(p).then(ok => ok ? p : null)))
      .then(results => results.find(p => p !== null) || null);
  }

  // Discover available images — probe in parallel batches, then shuffle
  async function discoverImages() {
    const BATCH = 10;
    let start = 1;
    let consecutiveMisses = 0;

    while (consecutiveMisses < 10) {
      const nums = Array.from({ length: BATCH }, (_, i) => start + i);
      const hits = await Promise.all(nums.map(n => checkNum(n)));

      let batchHadHit = false;
      for (const hit of hits) {
        if (hit) {
          if (hit.endsWith('.gif')) {
            if (Math.random() < 0.65) archiveImages.push(hit);
          } else {
            archiveImages.push(hit);
          }
          batchHadHit = true;
        }
      }

      // Count consecutive misses from the end of current range
      if (batchHadHit) {
        consecutiveMisses = 0;
      } else {
        consecutiveMisses += BATCH;
      }
      start += BATCH;
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
