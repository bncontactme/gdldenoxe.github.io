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
  // Track in-flight preloads so we can cancel them on pause/reset
  var pendingPreloads = [];

  function evictOldest() {
    var imgs = collageContainer.querySelectorAll('img');
    while (imgs.length >= MAX_IMAGES) {
      imgs[0].remove();
      placedPositions.shift();
      imgs = collageContainer.querySelectorAll('img');
    }
  }

  // Returns a resized Cloudinary URL for collage display, or the original if not Cloudinary
  function collageSrc(url) {
    if (url.indexOf('res.cloudinary.com') === -1) return url;
    // q_auto:best = near-lossless quality, f_auto = WebP/AVIF (90%+ smaller than original JPEG)
    // w_800 = enough for retina at max collage display size (~300px)
    return url.replace('/upload/', '/upload/w_800,q_auto:best,f_auto/');
  }

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

    // Cap DOM images — smooth fade out oldest
    evictOldest();

    // Preload image off-DOM so it appears fully loaded (no progressive/choppy render)
    const preload = new Image();
    preload.src = collageSrc(src);
    pendingPreloads.push(preload);

    function insert() {
      // Remove from pending list
      var idx = pendingPreloads.indexOf(preload);
      if (idx !== -1) pendingPreloads.splice(idx, 1);
      if (paused) return; // Don't insert if gallery was closed/paused while loading
      const img = document.createElement('img');
      img.dataset.src = src;
      // Use transform for GPU-compositor positioning (no layout recalc)
      img.style.cssText = 'transform:translate3d(' + bestLeft + 'px,' + bestTop + 'px,0);width:' + size + 'px;height:auto;z-index:' + (++zIndex);
      img.draggable = false;
      img.decoding = 'async';

      const meta = imageMetadata[src];
      if (meta) {
        if (meta.artista) img.dataset.artista = meta.artista;
        if (meta.descripcion) img.dataset.descripcion = meta.descripcion;
        if (meta.fecha) img.dataset.fecha = meta.fecha;
      }

      img.dataset.width = preload.naturalWidth;
      img.dataset.height = preload.naturalHeight;
      img.onclick = function(e) { e.stopPropagation(); openDetails(this); };

      img.src = collageSrc(src);
      collageContainer.appendChild(img);
    }
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
  const detailsFecha = document.getElementById('detail-fecha');
  const detailsFechaRow = document.getElementById('detail-fecha-row');
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

    // Upload folder — always last
    const uploadFolder = document.createElement('div');
    uploadFolder.className = 'fe-folder fe-folder-upload';
    uploadFolder.title = 'Subir fotos al archivo';
    uploadFolder.innerHTML = '<img src="../indexPage/indexImages/icons/camera3_plus-0.png" class="fe-folder-icon fe-folder-icon-upload" alt="" width="32" height="32">'
      + '<span class="fe-label">Subir fotos</span>';
    uploadFolder.onclick = function() {
      closeExplorer();
      openUploadPopup();
    };
    explorerBody.appendChild(uploadFolder);

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
      // Use Cloudinary-derived thumb URL if available, else fall back to local thumbs
      const thumbPath = (imageMetadata[path] && imageMetadata[path].thumbUrl)
        ? imageMetadata[path].thumbUrl
        : 'archiveImages/thumbs/' + baseName + '.jpg';

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

      // Store Cloudinary public_id for delete mode
      // URL pattern: .../upload/vTIMESTAMP/archivo/NAME.ext → public_id = archivo/NAME
      const pubIdMatch = path.match(/\/upload\/(?:v\d+\/)?(.+)\.[^.]+$/);
      if (pubIdMatch) item.dataset.publicId = pubIdMatch[1];

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
            if (meta.fecha) fakeImg.dataset.fecha = meta.fecha;
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
    // Re-apply delete mode if active
    if (_deleteMode) {
      _selectedPublicIds = new Set();
      explorerBody?.querySelectorAll('.fe-image').forEach(addDeleteableToImage);
      updateDeleteCount();
    }
  }

  function escapeHtml(str) {
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function openExplorer() {
    if (!explorerOverlay || !explorerBody) {
      console.error('Explorer elements missing:', { explorerOverlay, explorerBody });
      return;
    }
    renderFolderList();
    explorerOverlay.classList.add('open');
  }

  function closeExplorer() {
    if (explorerOverlay) explorerOverlay.classList.remove('open');
  }

  // ===== Upload Popup =====
  const uploadPopupOverlay = document.getElementById('upload-popup-overlay');
  const uploadPopupClose   = document.getElementById('upload-popup-close');
  const uploadPopupFrame   = document.getElementById('upload-popup-frame');

  function openUploadPopup() {
    // If inside an iframe (frame.html / index.html), let the parent render the popup
    if (parent !== window) {
      try {
        parent.postMessage({ type: 'open-upload-popup' }, location.origin);
        return;
      } catch (e) { /* cross-origin — fall through to local popup */ }
    }
    if (!uploadPopupOverlay) return;
    // Lazy-load the iframe only on first open (use getAttribute to avoid resolved-URL false positive)
    if (uploadPopupFrame && uploadPopupFrame.getAttribute('src') !== 'upload.html') {
      uploadPopupFrame.src = 'upload.html';
    }
    uploadPopupOverlay.classList.add('open');
  }

  function closeUploadPopup() {
    if (uploadPopupOverlay) uploadPopupOverlay.classList.remove('open');
  }

  if (uploadPopupClose) uploadPopupClose.onclick = closeUploadPopup;
  if (uploadPopupOverlay) uploadPopupOverlay.onclick = function(e) {
    if (e.target === uploadPopupOverlay) closeUploadPopup();
  };
  // ========================

  if (explorerClose) explorerClose.onclick = closeExplorer;

  // ===== Win95 Menu Bar =====
  const WORKER_URL = 'https://archivo-upload.guadalajaradenoxe.workers.dev';
  const PW_HASH_DELETE = '2e7c9afc24a98a5fef53a99fedfd88199fa6ae3a2b255e85a3e97df9b9ce6590';

  async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
  }

  // Menu open/close
  const menubar = document.getElementById('fe-menubar');
  let openMenu = null;

  function openDropdown(menuItem, dropdownId) {
    closeAllMenus();
    menuItem.classList.add('open');
    const dd = document.getElementById(dropdownId);
    if (dd) { dd.classList.add('open'); dd.style.left = menuItem.offsetLeft + 'px'; }
    openMenu = { item: menuItem, dd };
  }

  function closeAllMenus() {
    if (openMenu) {
      openMenu.item.classList.remove('open');
      if (openMenu.dd) openMenu.dd.classList.remove('open');
      openMenu = null;
    }
  }

  document.getElementById('fe-menu-archivo')?.addEventListener('click', function(e) {
    e.stopPropagation(); openDropdown(this, 'fe-dropdown-archivo');
  });
  document.getElementById('fe-menu-editar')?.addEventListener('click', function(e) {
    e.stopPropagation(); openDropdown(this, 'fe-dropdown-editar');
  });
  document.getElementById('fe-menu-ver')?.addEventListener('click', function(e) {
    e.stopPropagation(); openDropdown(this, 'fe-dropdown-ver');
  });
  document.addEventListener('click', closeAllMenus);

  // Menu item actions (delegation)
  menubar?.addEventListener('click', function(e) {
    const item = e.target.closest('.fe-dd-item');
    if (!item) return;
    closeAllMenus();
    const action = item.dataset.action;
    if (action === 'upload')      { closeExplorer(); openUploadPopup(); }
    if (action === 'close')       { closeExplorer(); }
    if (action === 'select-all')  { selectAllImages(); }
    if (action === 'delete-mode') { openDeletePasswordDialog(); }
    if (action === 'view-icons')  { /* already icon view */ }
    if (action === 'view-list')   { /* future */ }
  });

  // ===== Delete mode =====
  let _deleteAuthed = false;
  let _deletePassword = '';
  let _deleteMode = false;
  let _selectedPublicIds = new Set();

  const deletePwOverlay  = document.getElementById('delete-pw-overlay');
  const deletePwInput    = document.getElementById('delete-pw-input');
  const deletePwSubmit   = document.getElementById('delete-pw-submit');
  const deletePwCancel   = document.getElementById('delete-pw-cancel');
  const deletePwError    = document.getElementById('delete-pw-error');
  const deleteActionbar  = document.getElementById('delete-actionbar');
  const deleteCount      = document.getElementById('delete-selected-count');
  const deleteCancelMode = document.getElementById('delete-cancel-mode');
  const deleteConfirmBtn = document.getElementById('delete-confirm-btn');

  function openDeletePasswordDialog() {
    if (_deleteAuthed) { enterDeleteMode(); return; }
    if (deletePwOverlay) { deletePwOverlay.classList.remove('hidden'); deletePwInput?.focus(); }
  }

  async function submitDeletePassword() {
    const typed = deletePwInput?.value || '';
    const hash = await sha256(typed);
    if (hash === PW_HASH_DELETE) {
      _deleteAuthed = true;
      _deletePassword = typed;
      if (deletePwOverlay) deletePwOverlay.classList.add('hidden');
      if (deletePwInput) deletePwInput.value = '';
      if (deletePwError) deletePwError.textContent = '';
      enterDeleteMode();
    } else {
      if (deletePwError) deletePwError.textContent = 'Contraseña incorrecta.';
      if (deletePwInput) { deletePwInput.value = ''; deletePwInput.focus(); }
    }
  }

  deletePwSubmit?.addEventListener('click', submitDeletePassword);
  deletePwInput?.addEventListener('keydown', function(e) { if (e.key === 'Enter') submitDeletePassword(); });
  deletePwCancel?.addEventListener('click', function() {
    if (deletePwOverlay) deletePwOverlay.classList.add('hidden');
    if (deletePwInput) deletePwInput.value = '';
    if (deletePwError) deletePwError.textContent = '';
  });

  function enterDeleteMode() {
    _deleteMode = true;
    _selectedPublicIds = new Set();
    if (deleteActionbar) deleteActionbar.classList.remove('hidden');
    updateDeleteCount();
    // Make all images in current folder selectable
    explorerBody?.querySelectorAll('.fe-image').forEach(addDeleteableToImage);
  }

  function exitDeleteMode() {
    _deleteMode = false;
    _selectedPublicIds = new Set();
    if (deleteActionbar) deleteActionbar.classList.add('hidden');
    explorerBody?.querySelectorAll('.fe-image').forEach(function(el) {
      el.classList.remove('deletable', 'selected');
      el.querySelector('.fe-delete-check')?.remove();
    });
  }

  function addDeleteableToImage(el) {
    el.classList.add('deletable');
    if (!el.querySelector('.fe-delete-check')) {
      const chk = document.createElement('span');
      chk.className = 'fe-delete-check';
      el.prepend(chk);
    }
    const publicId = el.dataset.publicId;
    el.onclick = function(e) {
      e.stopPropagation();
      if (!publicId) return;
      if (_selectedPublicIds.has(publicId)) {
        _selectedPublicIds.delete(publicId);
        el.classList.remove('selected');
      } else {
        _selectedPublicIds.add(publicId);
        el.classList.add('selected');
      }
      updateDeleteCount();
    };
  }

  function selectAllImages() {
    if (!_deleteMode) return;
    explorerBody?.querySelectorAll('.fe-image.deletable').forEach(function(el) {
      const pid = el.dataset.publicId;
      if (pid) { _selectedPublicIds.add(pid); el.classList.add('selected'); }
    });
    updateDeleteCount();
  }

  function updateDeleteCount() {
    const n = _selectedPublicIds.size;
    if (deleteCount) deleteCount.textContent = n + (n === 1 ? ' seleccionada' : ' seleccionadas');
    if (deleteConfirmBtn) deleteConfirmBtn.disabled = n === 0;
  }

  deleteCancelMode?.addEventListener('click', exitDeleteMode);

  deleteConfirmBtn?.addEventListener('click', async function() {
    const ids = Array.from(_selectedPublicIds);
    if (!ids.length) return;
    deleteConfirmBtn.disabled = true;
    deleteConfirmBtn.textContent = 'Eliminando...';
    try {
      const res = await fetch(WORKER_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', password: _deletePassword, public_ids: ids }),
      });
      const data = await res.json();
      if (res.ok) {
        const deleted = Object.values(data.deleted || {}).filter(v => v === 'deleted').length;
        exitDeleteMode();
        alert(deleted + ' foto' + (deleted !== 1 ? 's' : '') + ' eliminada' + (deleted !== 1 ? 's' : '') + '.\nActualiza images.json para reflejar los cambios.');
      } else {
        alert('Error: ' + (data.error || res.status));
      }
    } catch (err) {
      alert('Error de red al contactar el servidor.');
    }
    deleteConfirmBtn.disabled = false;
    deleteConfirmBtn.textContent = 'Eliminar seleccionadas';
  });

  // Patch renderFolder to store public_id on each image element
  const _origRenderFolder = renderFolder;
  // Note: renderFolder is already defined above and closes over archiveImages/imageMetadata
  // We patch it here by overriding the image onclick to not interfere with delete mode,
  // and by adding data-public-id to each .fe-image item.
  // The actual patching happens inside renderFolder via a post-render hook below.

  // After renderFolderList/renderFolder, re-apply delete mode if active
  const _origOpenExplorer = openExplorer;

  // ========================
  if (explorerBack) explorerBack.onclick = function() {
    if (explorerCurrentFolder !== null) { exitDeleteMode(); renderFolderList(); }
  };
  if (explorerOverlay) explorerOverlay.onclick = function(e) {
    if (e.target === explorerOverlay) { exitDeleteMode(); closeExplorer(); }
  };
  if (exploreBtn) exploreBtn.onclick = function(e) {
    e.stopPropagation();
    closeDetailsPopup();
    try { openExplorer(); } catch(err) { console.error('Explorer error:', err); }
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
    const fecha = img.dataset.fecha || '';
    const data = { src: fullSrc, fileName, fileType, dimensions: dims, path: src, artista, descripcion, fecha };

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
      if (detailsFilename) detailsFilename.textContent = 'Galeria/' + (artista ? artista + '/' : '') + fileName;
      if (detailsType) detailsType.textContent = fileType;
      if (detailsDimensions) detailsDimensions.textContent = dims;

      // Show artista & descripcion only when non-empty
      if (detailsArtistaRow) detailsArtistaRow.style.display = artista ? '' : 'none';
      if (detailsArtista) detailsArtista.textContent = artista;
      if (detailsDescripcionRow) detailsDescripcionRow.style.display = descripcion ? '' : 'none';
      if (detailsDescripcion) detailsDescripcion.textContent = descripcion;
      if (detailsFechaRow) detailsFechaRow.style.display = fecha ? '' : 'none';
      if (detailsFecha) detailsFecha.textContent = fecha;

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
          } else if (entry && entry.url) {
            // Cloudinary entry: full delivery URL
            const path = entry.url;
            files.push(path);
            imageMetadata[path] = {
              artista:     entry.artista     || '',
              descripcion: entry.descripcion || '',
              fecha:       entry.fecha       || '',
              thumbUrl:    entry.thumbUrl    || ''
            };
          } else if (entry && entry.filename) {
            // Legacy local entry
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
      // Cancel in-flight preloads
      pendingPreloads.forEach(function(p) { p.src = ''; });
      pendingPreloads = [];
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
      // Cancel in-flight preloads
      pendingPreloads.forEach(function(p) { p.src = ''; });
      pendingPreloads = [];
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
      // Guard: if all images are in recent (e.g. only 1 image), just use the next one
      var src = displayImages[imgIndex % displayImages.length];
      imgIndex++;
      var attempts = 0;
      while (recent.indexOf(src) !== -1 && attempts < displayImages.length) {
        src = displayImages[imgIndex % displayImages.length];
        imgIndex++;
        attempts++;
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
    // Cancel any pending preloads
    pendingPreloads.forEach(function(p) { p.src = ''; });
    pendingPreloads = [];
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
