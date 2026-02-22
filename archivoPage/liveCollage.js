// Live Collage Gallery
(function() {
  'use strict';

  const collageContainer = document.getElementById('live-collage-container');
  const _mobile = window.innerWidth <= 768;
  const IMAGE_INTERVAL = _mobile ? 3000 : 2000;
  const MAX_IMAGES = _mobile ? 30 : 50;

  let zIndex = 1;
  let archiveImages = [];
  let displayImages = [];
  let imageMetadata = {};
  let imageTimeout = null;
  let imgIndex = 0;
  let lastTop = -1;
  let lastLeft = -1;
  let recent = [];

  // Lightweight position tracking (avoids getBoundingClientRect / layout thrashing)
  var placedPositions = [];

  function placeImage(src) {
    const cH = collageContainer.offsetHeight || window.innerHeight;
    const cW = collageContainer.offsetWidth || window.innerWidth;
    const size = _mobile ? Math.random() * 130 + 90 : Math.random() * 180 + 120;

    // Find best spot with least overlap using stored positions (no layout queries)
    var bestTop = 0, bestLeft = 0, minOverlap = 1e9;
    for (var tries = 0; tries < 6; tries++) {
      var top = Math.random() * Math.max(0, cH - size);
      var left = Math.random() * Math.max(0, cW - size);
      var overlap = 0;
      for (var i = 0; i < placedPositions.length; i++) {
        var p = placedPositions[i];
        var ox = Math.max(0, Math.min(left + size, p.l + p.s) - Math.max(left, p.l));
        var oy = Math.max(0, Math.min(top + size, p.t + p.s) - Math.max(top, p.t));
        overlap += ox * oy;
      }
      if (overlap < minOverlap) {
        minOverlap = overlap;
        bestTop = top;
        bestLeft = left;
      }
      if (overlap < 10) break;
    }
    lastTop = bestTop;
    lastLeft = bestLeft;
    placedPositions.push({ t: bestTop, l: bestLeft, s: size });

    // Cap DOM images — fade out oldest before removing
    var imgs = collageContainer.querySelectorAll('img');
    while (imgs.length >= MAX_IMAGES) {
      var oldest = imgs[0];
      oldest.classList.remove('collage-visible');
      oldest.remove();
      placedPositions.shift();
      imgs = collageContainer.querySelectorAll('img');
    }

    // Preload image off-DOM so it appears fully loaded (no progressive/choppy render)
    const preload = new Image();
    preload.src = src;

    function insert() {
      if (paused) return; // Don't insert if gallery was closed/paused while loading
      const img = document.createElement('img');
      img.dataset.src = src;
      img.style.cssText = 'top:' + bestTop + 'px;left:' + bestLeft + 'px;width:' + size + 'px;height:auto;z-index:' + (++zIndex);
      img.draggable = false;
      img.decoding = 'async';

      const meta = imageMetadata[src];
      if (meta) {
        if (meta.artista) img.dataset.artista = meta.artista;
        if (meta.descripcion) img.dataset.descripcion = meta.descripcion;
      }

      img.dataset.width = preload.naturalWidth;
      img.dataset.height = preload.naturalHeight;
      img.onclick = function(e) { e.stopPropagation(); openDetails(this); };

      img.src = src;
      collageContainer.appendChild(img);
      // Trigger fade-in on next frame
      requestAnimationFrame(function() { img.classList.add('collage-visible'); });
    }

    // Use decode() for jank-free insertion when available, fallback to onload
    if (preload.decode) {
      preload.decode().then(insert).catch(function() { /* skip broken images */ });
    } else {
      preload.onload = insert;
      preload.onerror = function() { /* skip broken images */ };
    }
  }

  function getFileName(path) { return path.split('/').pop() || path; }
  function getExtension(fn) {
    const p = fn.split('.');
    return p.length > 1 ? p.pop().toUpperCase() : 'Archivo';
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
              imageMetadata[path] = { artista: entry.artista || '', descripcion: entry.descripcion || '' };
            }
          }
        }
      }
    } catch (e) { /* network error */ }

    if (!files || !files.length) return;
    archiveImages = files;

    // Shuffle all images
    displayImages = files.slice();
    for (let i = displayImages.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [displayImages[i], displayImages[j]] = [displayImages[j], displayImages[i]];
    }

    if (displayImages.length) startDisplaying();
  }

  // Pause when tab hidden or parent hides the gallery window
  let paused = false;
  let started = false;
  document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
      if (!started) return;
      paused = true;
      clearTimeout(imageTimeout);
      imageTimeout = null;
    } else if (paused) {
      paused = false;
      if (displayImages.length) startDisplaying();
    }
  });

  // Listen for pause/resume messages from parent (close/minimize gallery window)
  window.addEventListener('message', function(e) {
    if (!e.data || typeof e.data.type !== 'string') return;
    if (e.data.type === 'galeria-pause') {
      if (!started) return;
      paused = true;
      clearTimeout(imageTimeout);
      imageTimeout = null;
    } else if (e.data.type === 'galeria-resume') {
      if (paused) {
        paused = false;
        if (displayImages.length) startDisplaying();
      }
    }
  });

  function startDisplaying() {
    if (imageTimeout) return;
    started = true;
    paused = false;

    function addNext() {
      if (paused) return;
      if (collageContainer.offsetWidth < 10 || collageContainer.offsetHeight < 10) {
        collageContainer.style.width = '100vw';
        collageContainer.style.height = '100vh';
      }
      // Walk through shuffled list, skip if in recent 10
      var src = displayImages[imgIndex % displayImages.length];
      imgIndex++;
      while (recent.indexOf(src) !== -1) {
        src = displayImages[imgIndex % displayImages.length];
        imgIndex++;
      }
      recent.push(src);
      if (recent.length > 10) recent.shift();
      placeImage(src);
      imageTimeout = setTimeout(addNext, IMAGE_INTERVAL);
    }
    addNext();
  }

  // Every 5 min: wipe all images and start fresh
  function reset() {
    clearTimeout(imageTimeout);
    imageTimeout = null;
    // Remove all collage images
    var imgs = collageContainer.querySelectorAll('img');
    for (var i = 0; i < imgs.length; i++) imgs[i].remove();
    zIndex = 1;
    imgIndex = 0;
    lastTop = -1;
    lastLeft = -1;
    recent = [];
    placedPositions = [];
    // Reshuffle
    for (var i = displayImages.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var tmp = displayImages[i];
      displayImages[i] = displayImages[j];
      displayImages[j] = tmp;
    }
    startDisplaying();
  }

  function init() {
    collageContainer.style.display = 'block';
    if (collageContainer.offsetWidth < 10 || collageContainer.offsetHeight < 10) {
      collageContainer.style.width = '100vw';
      collageContainer.style.height = '100vh';
    }
    discoverImages();
  }

  function setupPopup() {
    const overlay = document.getElementById('xp-popup-overlay');
    const okBtn = document.getElementById('xp-popup-ok');
    const closeBtn = document.getElementById('xp-popup-close');
    init();
    function dismiss() {
      overlay.style.display = 'none';
      setInterval(reset, 300000); // clean & restart every 5 min
    }
    okBtn.onclick = dismiss;
    closeBtn.onclick = dismiss;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', setupPopup);
  } else {
    setupPopup();
  }
})();
