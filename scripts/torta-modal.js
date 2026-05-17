/**
 * Torta donation modal — self-installing. Loaded by both root index.html and
 * pages/frame.html. Injects its own markup, wires close + overlay-click +
 * postMessage('open-torta-modal'), and exposes window.openTortaModal().
 *
 * The "lonche-spin.gif" path differs by depth: root uses 'assets/...',
 * pages/ uses '../assets/...'. We detect by document.currentScript.src depth.
 */
(() => {
  // The image lives at assets/img/intro/lonche-spin.gif. Resolve a path that
  // works whether the calling document is at the repo root or under pages/.
  const inPagesDir = location.pathname.includes('/pages/');
  const gifSrc = (inPagesDir ? '../' : '') + 'assets/img/intro/lonche-spin.gif';

  const HTML = `
    <div id="torta-modal-overlay" class="torta-modal-overlay">
      <div class="torta-modal-window">
        <div class="torta-modal-titlebar">
          <span>🌮 Cómprame Una Torta</span>
          <button id="torta-modal-close" class="torta-modal-close" aria-label="Cerrar">✕</button>
        </div>
        <div class="torta-modal-body">
          <img src="${gifSrc}" alt="Torta" class="torta-modal-image" loading="lazy">
          <div class="torta-modal-separator"></div>
          <div class="torta-modal-heading">CÓMPRAME UNA TORTA</div>
          <div class="torta-modal-text">Cada pesito hace la diferencia. Tu donación ayuda a mantener las operaciones de Guadalajara De Noche.<br><br>Este dinero va directo para el chesco y la torta.</div>
          <a class="torta-pay-btn" href="https://www.paypal.com/ncp/payment/8QT696H5AN2MU" target="_blank" rel="noopener noreferrer">🌮 Donativos Por PayPal</a>
        </div>
      </div>
    </div>`;

  function install() {
    document.body.insertAdjacentHTML('beforeend', HTML);
    const overlay = document.getElementById('torta-modal-overlay');
    const open  = () => { overlay.style.display = 'flex'; };
    const close = () => { overlay.style.display = 'none'; };

    document.getElementById('torta-modal-close').addEventListener('click', close);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(); });
    window.addEventListener('message', e => {
      if (e.origin !== location.origin) return;
      if (e.data === 'open-torta-modal' || e.data?.type === 'open-torta-modal') open();
    });

    window.openTortaModal = open;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', install);
  } else {
    install();
  }
})();
