/**
 * Articulos — folder-style list, or article detail when ?id=N is present.
 * Loads from data/articulos.json. Used by pages/articulos.html.
 */
(() => {
  const id = new URLSearchParams(location.search).get('id');
  const fetchJson = () => fetch('../data/articulos.json').then(r => r.json());

  if (id) renderDetail(id, fetchJson);
  else renderList(fetchJson);

  function renderList(loader) {
    document.body.dataset.mode = 'list';
    const grid = document.getElementById('folder-grid');
    const status = document.getElementById('status-text');

    loader().then(articulos => {
      const frag = document.createDocumentFragment();
      articulos.forEach(art => {
        const item = document.createElement('a');
        item.className = 'folder-item';
        item.href = 'frame.html?p=articulo&id=' + art.id;
        item.target = '_top';
        item.innerHTML = `<img src="../assets/icons/notepad_file-0.png" alt="" loading="lazy"><span class="folder-item-label">${art.titulo}.txt</span>`;
        frag.appendChild(item);
      });
      grid.appendChild(frag);
      status.textContent = articulos.length + ' objeto(s)';
    }).catch(() => status.textContent = 'Error al cargar');
  }

  function renderDetail(articleId, loader) {
    document.body.dataset.mode = 'detail';
    const title = document.getElementById('art-title');
    const meta  = document.getElementById('art-meta');
    const hero  = document.getElementById('art-hero');
    const body  = document.getElementById('art-body');

    loader().then(articulos => {
      const art = articulos.find(a => String(a.id) === articleId);
      if (!art) { title.textContent = 'Artículo no encontrado'; return; }

      document.title = art.titulo + ' - GDLDENOXE';
      title.textContent = art.titulo;
      meta.textContent = art.meta;
      hero.src = '../' + art.imagen;
      hero.alt = art.titulo;
      hero.style.display = '';

      const typeMap = { lead: 'p', h2: 'h2', quote: 'blockquote' };
      const frag = document.createDocumentFragment();
      art.contenido.forEach(block => {
        const tag = typeMap[block.tipo] || 'p';
        const el = document.createElement(tag);
        if (block.tipo === 'lead') el.className = 'lead';
        el.textContent = block.tipo === 'quote' ? '"' + block.texto + '"' : block.texto;
        frag.appendChild(el);
      });
      body.appendChild(frag);
    }).catch(() => title.textContent = 'Error al cargar');
  }

  // Back-link handlers — used by article detail to navigate the top window
  window.articulosBack = () => {
    if (window.top !== window.self) {
      window.top.location.href = 'frame.html?p=articulos';
      return false;
    }
    return true;
  };
  window.articulosHome = () => {
    if (window.top !== window.self) {
      window.top.location.href = '../index.html';
      return false;
    }
    return true;
  };
})();
