/**
 * pages/frame.html — sub-page router. Loads a page by ?p=<key> into the
 * iframe and sets the title bar. Also exposes the upload popup, opened by
 * postMessage('open-upload-popup') from the archivo iframe.
 *
 * Torta donation modal is provided by scripts/torta-modal.js (auto-installs).
 */
(() => {
  const params = new URLSearchParams(location.search);
  const page  = params.get('p');
  const artId = params.get('id');

  const PAGES = {
    galeria:     { title: 'Galería',             icon: '../assets/icons/kodak_imaging-0.png',     src: 'archivo.html' },
    tienda:      { title: 'Tienda',              icon: '../assets/icons/directory_e-0.png',       src: 'tienda.html' },
    articulos:   { title: 'Artículos',           icon: '../assets/icons/directory_closed-0.png',  src: 'articulos.html' },
    articulo:    { title: 'Artículo',            icon: '../assets/icons/notepad_file-0.png',      src: 'articulos.html?id=' + (artId || '1') },
    minesweeper: { title: 'Buscaminas',          icon: '../assets/icons/minesweeper-0.png',       src: 'buscaminas.html' },
    lonche:      { title: 'Cómprame Una Torta',  icon: '../assets/icons/lonche-icon.png',         src: 'lonche.html' },
  };

  const config = PAGES[page];
  if (!config) { location.href = '../index.html'; return; }

  document.title = config.title + ' - GDLDENOXE';
  document.getElementById('frame-title').textContent = config.title;
  document.getElementById('frame-icon').src = config.icon;

  const iframe = document.getElementById('frame-iframe');

  if (page === 'tienda') showTiendaPlaceholder(iframe, config.src);
  else { iframe.src = config.src; iframe.style.display = ''; }

  installUploadPopup();

  // --- helpers ---------------------------------------------------------

  // Tienda is gated behind a 12-tap unlock on a logo placeholder.
  function showTiendaPlaceholder(iframe, src) {
    const ph = document.createElement('div');
    ph.id = 'tienda-placeholder';
    const logo = document.createElement('img');
    logo.src = '../assets/img/tienda/web/logo/path206.png';
    logo.alt = 'GDN';
    ph.appendChild(logo);
    document.getElementById('frame-content').insertBefore(ph, iframe);

    let taps = 0;
    let resetTimer = null;
    const onTap = () => {
      clearTimeout(resetTimer);
      if (++taps >= 12) {
        iframe.src = src;
        iframe.style.display = '';
        ph.style.display = 'none';
        taps = 0;
        return;
      }
      resetTimer = setTimeout(() => { taps = 0; }, 3000);
    };
    ph.addEventListener('click', onTap);
    ph.addEventListener('touchstart', onTap, { passive: true });
  }

  function installUploadPopup() {
    const popup       = document.getElementById('upload-frame-popup');
    const popupIframe = document.getElementById('upload-frame-iframe');
    const closeBtn    = document.getElementById('upload-frame-close');

    const open  = () => {
      if (popupIframe.getAttribute('src') !== 'archivo-upload.html') {
        popupIframe.src = 'archivo-upload.html';
      }
      popup.style.display = 'flex';
    };
    const close = () => { popup.style.display = 'none'; };

    closeBtn.addEventListener('click', close);
    popup.addEventListener('click', e => { if (e.target === popup) close(); });
    window.addEventListener('message', e => {
      if (e.origin !== location.origin) return;
      if (e.data && e.data.type === 'open-upload-popup') open();
    });
  }
})();
