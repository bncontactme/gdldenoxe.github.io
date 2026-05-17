(function() {
  'use strict';

  // Embed mode: strip redundant chrome + report height to parent
  if (new URLSearchParams(location.search).get('embed') === '1') {
    document.documentElement.classList.add('embedded');
    // Tell parent our content height whenever it changes
    // Use body.offsetHeight (not scrollHeight) so the iframe shrinks when thumbnails are removed
    function reportHeight() {
      document.documentElement.style.height = 'auto';
      var h = document.body.offsetHeight;
      parent.postMessage({ type: 'upload-resize', height: h }, location.origin);
    }
    var _ro = new ResizeObserver(reportHeight);
    _ro.observe(document.body);
  }

  // ── Load existing artists for datalist ───────────────────────────────────
  (async function() {
    try {
      var res = await fetch('../data/images.json');
      var imgs = await res.json();
      var seen = new Set();
      var dl = document.getElementById('artistas-list');
      imgs.forEach(function(img) {
        var a = (img.artista || '').trim();
        if (a) {
          _artistCounts[a] = (_artistCounts[a] || 0) + 1;
          if (!seen.has(a)) {
            seen.add(a);
            var opt = document.createElement('option');
            opt.value = a;
            dl.appendChild(opt);
          }
        }
      });
    } catch(e) { /* silently ignore */ }
  })();
  // ─────────────────────────────────────────────────────────────────────────

  // ── Password gate ─────────────────────────────────────────────────────────
  // SHA-256 hash of the password. To change it:
  // node -e "const c=require('crypto');console.log(c.createHash('sha256').update('NEW_PW').digest('hex'));"
  const PW_HASH = '2e7c9afc24a98a5fef53a99fedfd88199fa6ae3a2b255e85a3e97df9b9ce6590';
  const SESSION_KEY = 'archivo_auth';

  // Private auth flag — lives only in this closure, unreachable from DevTools console
  let _authed = false;
  let _password = ''; // kept in memory for Worker requests; never persisted

  // Brute-force protection (resets on page reload — intentional)
  let _attempts = 0;
  let _lockedUntil = 0;
  const MAX_ATTEMPTS = 5;
  const LOCKOUT_MS   = 60000; // 60 s
  let _lockTimer = null;

  async function sha256(str) {
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str));
    return Array.from(new Uint8Array(buf)).map(function(b) { return b.toString(16).padStart(2,'0'); }).join('');
  }

  const pwOverlay = document.getElementById('pw-overlay');
  const pwInput   = document.getElementById('pw-input');
  const pwSubmit  = document.getElementById('pw-submit');
  const pwError   = document.getElementById('pw-error');

  // Restore session only in non-Worker mode; Worker mode always needs the plaintext
  // password in memory. WORKER_URL is declared below — forward-ref resolved at runtime.
  function maybeRestoreSession() {
    if (!WORKER_URL && sessionStorage.getItem(SESSION_KEY) === PW_HASH) {
      _authed = true;
      pwOverlay.classList.add('hidden');
    }
  }

  function startLockoutTimer() {
    if (_lockTimer) clearInterval(_lockTimer);
    _lockTimer = setInterval(function() {
      var remaining = Math.ceil((_lockedUntil - Date.now()) / 1000);
      if (remaining <= 0) {
        clearInterval(_lockTimer);
        _lockTimer = null;
        pwSubmit.disabled = false;
        pwInput.disabled  = false;
        pwError.textContent = '';
        _attempts = 0;
      } else {
        pwError.textContent = 'Demasiados intentos. Espera ' + remaining + 's.';
      }
    }, 500);
  }

  async function checkPassword() {
    if (Date.now() < _lockedUntil) return;
    var typed = pwInput.value;
    var hash  = await sha256(typed);
    if (hash === PW_HASH) {
      _authed = true;
      _password = typed;
      sessionStorage.setItem(SESSION_KEY, PW_HASH);
      pwOverlay.classList.add('hidden');
      pwInput.value = '';
      _attempts = 0;
    } else {
      _attempts++;
      pwInput.value = '';
      if (_attempts >= MAX_ATTEMPTS) {
        _lockedUntil = Date.now() + LOCKOUT_MS;
        pwSubmit.disabled = true;
        pwInput.disabled  = true;
        startLockoutTimer();
      } else {
        var left = MAX_ATTEMPTS - _attempts;
        pwError.textContent = 'Contraseña incorrecta. (' + left + ' intento' + (left === 1 ? '' : 's') + ' restante' + (left === 1 ? '' : 's') + ')';
        pwInput.focus();
      }
    }
  }

  pwSubmit.addEventListener('click', checkPassword);
  pwInput.addEventListener('keydown', function(e) {
    if (e.key === 'Enter') checkPassword();
  });
  // ─────────────────────────────────────────────────────────────────────────

  // ── Config ────────────────────────────────────────────────────────────────
  const CLOUD_NAME    = 'duog120j4';
  const UPLOAD_PRESET = 'archivo_unsigned';  // disable this preset once WORKER_URL is set
  const FOLDER        = 'archivo';

  // Phase 2 — set this to your deployed Worker URL to enable server-side auth.
  // e.g. 'https://archivo-upload.YOUR-SUBDOMAIN.workers.dev'
  // When set: Worker verifies password + returns signed Cloudinary params.
  // When empty: direct unsigned upload (Phase 1 mode).
  const WORKER_URL = 'https://archivo-upload.guadalajaradenoxe.workers.dev';

  const MAX_SIZE_MB   = 10;
  const MAX_PER_UPLOAD = 5;
  const MAX_PER_ARTIST = 30;

  // Run session restore after WORKER_URL is defined
  maybeRestoreSession();
  if (!_authed) pwInput.focus();
  // ─────────────────────────────────────────────────────────────────────────

  const zone         = document.getElementById('upload-zone');
  const fileInput    = document.getElementById('file-input');
  const fileList     = document.getElementById('file-list');
  const uploadCounter = document.getElementById('upload-counter');
  const btnUpload    = document.getElementById('btn-upload');
  const btnCancel    = document.getElementById('btn-cancel');
  const statusBox    = document.getElementById('status-box');
  const progressWrap = document.getElementById('progress-wrap');
  const progressFill = document.getElementById('progress-fill');
  const inputArtista = document.getElementById('input-artista');
  const inputDesc    = document.getElementById('input-descripcion');
  const inputFecha   = document.getElementById('input-fecha');

  let selectedFiles = [];
  // artistCounts populated from images.json by the datalist loader
  var _artistCounts = {};

  function getArtistCount(name) {
    var key = (name || '').trim().toLowerCase();
    if (!key) return 0;
    // exact match first, then case-insensitive
    for (var k in _artistCounts) {
      if (k.toLowerCase() === key) return _artistCounts[k];
    }
    return 0;
  }
  function getArtistRemaining() {
    var name = inputArtista.value.trim();
    if (!name) return MAX_PER_ARTIST; // no artist typed = no limit yet
    return Math.max(0, MAX_PER_ARTIST - getArtistCount(name));
  }

  // ── File selection ────────────────────────────────────────────────────────
  zone.addEventListener('click', function() { fileInput.click(); });
  zone.addEventListener('keydown', function(e) {
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileInput.click(); }
  });
  zone.addEventListener('dragover', function(e) {
    e.preventDefault(); zone.classList.add('drag-over');
  });
  zone.addEventListener('dragleave', function(e) {
    // Only remove if the cursor actually left the zone (not just moved to a child element)
    if (!zone.contains(e.relatedTarget)) zone.classList.remove('drag-over');
  });
  zone.addEventListener('drop', function(e) {
    e.preventDefault(); zone.classList.remove('drag-over');
    addFiles(Array.from(e.dataTransfer.files));
  });
  fileInput.addEventListener('change', function() {
    addFiles(Array.from(fileInput.files));
    fileInput.value = '';
  });
  // Update counter when artist name changes
  inputArtista.addEventListener('input', function() { renderThumbs(); syncUploadBtn(); });

  function addFiles(files) {
    var remaining = getArtistRemaining();
    for (var i = 0; i < files.length; i++) {
      var f = files[i];
      if (!f.type.startsWith('image/')) {
        showStatus('Solo se permiten imágenes: ' + f.name, 'error'); continue;
      }
      if (f.size > MAX_SIZE_MB * 1024 * 1024) {
        showStatus(f.name + ' supera los ' + MAX_SIZE_MB + ' MB.', 'error'); continue;
      }
      if (selectedFiles.find(function(x) { return x.name === f.name; })) continue;
      if (selectedFiles.length >= MAX_PER_UPLOAD) {
        showStatus('Máximo ' + MAX_PER_UPLOAD + ' imágenes por subida.', 'error'); break;
      }
      if (selectedFiles.length >= remaining) {
        var name = inputArtista.value.trim();
        showStatus((name ? name : 'Este artista') + ' ya llegó al límite de ' + MAX_PER_ARTIST + ' fotos en el archivo.', 'error'); break;
      }
      selectedFiles.push(f);
    }
    renderThumbs();
    syncUploadBtn();
  }

  function renderThumbs() {
    fileList.innerHTML = '';
    if (selectedFiles.length === 0) {
      fileList.style.display = 'none';
      uploadCounter.style.display = 'none';
      return;
    }
    fileList.style.display = 'flex';
    uploadCounter.style.display = '';
    selectedFiles.forEach(function(f, i) {
      var wrap = document.createElement('div');
      wrap.className = 'file-thumb';
      var img = document.createElement('img');
      img.alt = f.name;
      var reader = new FileReader();
      reader.onload = function(e) { img.src = e.target.result; };
      reader.readAsDataURL(f);
      var btn = document.createElement('button');
      btn.className = 'file-thumb-remove';
      btn.type = 'button';
      btn.textContent = '×';
      btn.setAttribute('aria-label', 'Quitar ' + f.name);
      btn.addEventListener('click', function() {
        selectedFiles.splice(i, 1);
        renderThumbs();
        syncUploadBtn();
      });
      wrap.appendChild(img);
      wrap.appendChild(btn);
      fileList.appendChild(wrap);
    });
    var remaining = getArtistRemaining();
    var name = inputArtista.value.trim();
    uploadCounter.textContent = selectedFiles.length > 0
      ? selectedFiles.length + '/' + MAX_PER_UPLOAD + ' en esta subida'
        + (name ? ' · ' + remaining + ' restantes para ' + name : '')
      : (name && remaining < MAX_PER_ARTIST
        ? name + ' tiene ' + (MAX_PER_ARTIST - remaining) + '/' + MAX_PER_ARTIST + ' fotos en el archivo'
        : '');
  }

  function syncUploadBtn() {
    btnUpload.disabled = selectedFiles.length === 0;
  }

  // ── Upload ────────────────────────────────────────────────────────────────
  btnUpload.addEventListener('click', function() { startUpload(); });

  async function startUpload() {
    // Closed-over auth flag — cannot be set from DevTools console
    if (!_authed) return;

    // In Worker mode: password must be in memory (not just session flag)
    if (WORKER_URL && !_password) {
      _authed = false;
      sessionStorage.removeItem(SESSION_KEY);
      pwError.textContent = 'Sesión expirada. Ingresa la contraseña de nuevo.';
      pwOverlay.classList.remove('hidden');
      pwInput.focus();
      return;
    }

    if (!selectedFiles.length) return;

    const artista     = inputArtista.value.trim();
    const descripcion = inputDesc.value.trim();
    const fecha       = inputFecha.value.trim();

    btnUpload.disabled = true;
    btnCancel.disabled = true;
    progressWrap.classList.add('visible');

    // ── Phase 2: get signed params from Worker ──────────────────────────────
    let signedParams = null;
    if (WORKER_URL) {
      showStatus('Autenticando...', '');
      try {
        var signRes = await fetch(WORKER_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ password: _password, artista: artista, descripcion: descripcion, fecha: fecha }),
        });
        if (!signRes.ok) {
          showStatus('Error de autenticación (' + signRes.status + '). Contacta al admin.', 'error');
          btnUpload.disabled = false;
          btnCancel.disabled = false;
          syncUploadBtn();
          return;
        }
        signedParams = await signRes.json();
      } catch (err) {
        showStatus('Error de red al contactar el servidor.', 'error');
        btnUpload.disabled = false;
        btnCancel.disabled = false;
        syncUploadBtn();
        return;
      }
    }
    // ─────────────────────────────────────────────────────────────────────────

    showStatus('Subiendo...', '');

    let uploaded = 0;
    let failed   = 0;
    const uploadedEntries = [];

    for (let i = 0; i < selectedFiles.length; i++) {
      const file = selectedFiles[i];
      setProgress(Math.round((i / selectedFiles.length) * 100));

      try {
        const cloudRes = await uploadFile(file, artista, descripcion, fecha, signedParams);
        uploaded++;
        // Build the entry for images.json
        if (cloudRes && cloudRes.secure_url) {
          const thumbUrl = cloudRes.secure_url.replace('/upload/', '/upload/c_thumb,w_96,h_96,q_auto:best,f_auto/');
          uploadedEntries.push({
            url:         cloudRes.secure_url,
            thumbUrl:    thumbUrl,
            artista:     artista,
            descripcion: descripcion,
            fecha:       fecha,
          });
        }
      } catch (err) {
        failed++;
        console.error('Upload failed:', file.name, err);
      }
    }

    setProgress(100);

    if (failed === 0) {
      // bump artist count locally so the counter stays accurate this session
      var artistName = inputArtista.value.trim();
      if (artistName) {
        _artistCounts[artistName] = (_artistCounts[artistName] || 0) + uploaded;
      }
      selectedFiles = [];
      renderThumbs();
      showStatus(
        uploaded + (uploaded === 1 ? ' imagen subida' : ' imágenes subidas') +
        ' correctamente. Actualizando galería...',
        'success'
      );
      // Register new entries in images.json via the Worker
      if (WORKER_URL && uploadedEntries.length) {
        try {
          await fetch(WORKER_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'register', password: _password, entries: uploadedEntries }),
          });
        } catch (e) {
          console.error('Register failed:', e);
        }
      }
      showStatus(
        uploaded + (uploaded === 1 ? ' imagen subida' : ' imágenes subidas') +
        ' correctamente. La galería ya fue actualizada.',
        'success'
      );
    } else {
      showStatus(
        uploaded + ' subida(s) correctamente, ' + failed + ' fallida(s).\n' +
        'Intenta de nuevo con los archivos que fallaron.',
        'error'
      );
    }

    btnCancel.disabled = false;
    syncUploadBtn();
  }

  function uploadFile(file, artista, descripcion, fecha, signedParams) {
    return new Promise(function(resolve, reject) {
      var cloudName = signedParams ? signedParams.cloud_name : CLOUD_NAME;
      const url = 'https://api.cloudinary.com/v1_1/' + cloudName + '/image/upload';
      const fd  = new FormData();
      fd.append('file', file);

      if (signedParams) {
        // Signed upload via Worker (Phase 2)
        fd.append('upload_preset', signedParams.upload_preset);
        fd.append('folder',        signedParams.folder);
        fd.append('asset_folder',  signedParams.asset_folder || signedParams.folder);
        fd.append('timestamp',     signedParams.timestamp);
        fd.append('api_key',       signedParams.api_key);
        fd.append('signature',     signedParams.signature);
        if (signedParams.context) fd.append('context', signedParams.context);
      } else {
        // Unsigned direct upload (Phase 1)
        fd.append('upload_preset', UPLOAD_PRESET);
        fd.append('folder', FOLDER);
        const contextParts = [];
        if (artista)     contextParts.push('artista=' + artista.replace(/[|=]/g, ' '));
        if (descripcion) contextParts.push('descripcion=' + descripcion.replace(/[|=]/g, ' '));
        if (fecha)       contextParts.push('fecha=' + fecha.replace(/[|=]/g, '-'));
        if (contextParts.length) fd.append('context', contextParts.join('|'));
      }

      const xhr = new XMLHttpRequest();
      xhr.open('POST', url, true);
      xhr.onload = function() {
        if (xhr.status >= 200 && xhr.status < 300) {
          resolve(JSON.parse(xhr.responseText));
        } else {
          reject(new Error('HTTP ' + xhr.status));
        }
      };
      xhr.onerror = function() { reject(new Error('Network error')); };
      xhr.send(fd);
    });
  }

  // ── Cancel ────────────────────────────────────────────────────────────────
  btnCancel.addEventListener('click', function() {
    if (parent !== window) {
      try { parent.postMessage({ type: 'close-upload-window' }, location.origin); return; } catch(e) {}
    }
    window.history.length > 1 ? window.history.back() : window.close();
  });

  // ── Helpers ───────────────────────────────────────────────────────────────
  function showStatus(msg, type) {
    statusBox.textContent = msg;
    statusBox.className = 'visible' + (type ? ' ' + type : '');
  }

  function setProgress(pct) {
    progressFill.style.width = pct + '%';
  }

  function escHtml(str) {
    return str.replace(/[&<>"']/g, function(c) {
      return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
    });
  }
})();
