// Editor de portadas de la radio: cada control cambia `estado` y el motor
// vuelve a dibujar la imagen que se está viendo (portada o tracklist). Todo
// vive en este navegador (localStorage); no sube nada a ningún lado.
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const app = $('app');
  const motor = window.motorPortada;
  const iconos = window.iconosRadio;
  const CLAVE = 'gdn-radio-portada-v4', CLAVE_FOTO = 'gdn-radio-foto';
  const CLAVE_V3 = 'gdn-radio-portada-v3', CLAVE_V2 = 'gdn-radio-portada-v2', CLAVE_V1 = 'gdn-radio-portada-v1';
  const PAGINAS = ['portada', 'tracklist'];

  // Cada sesión empieza en blanco: ni textos, ni tracks, ni ícono. Solo queda
  // cómo se ve el texto libre (que algo tiene que tener) y el fondo de Windows.
  const VACIO = {
    numero: '', titulo: '', hashtag: '', fecha: '', hora: '', retransFecha: '', retransHora: '',
    radio: '', vivo: '', boton: '', sitio: '', logoTexto: '', logo: '',
    foto: { zoom: 1, x: 0.5, y: 0.5 },          // la imagen va aparte (CLAVE_FOTO)
    texto: { contenido: '', estilo: 'limpio', tam: 64, color: '#ffffff', x: 0.5, y: 0.8, alinear: 'izq' },
    icono: '',
    iconoPropio: '',
    fondo: '#008080',
    columnas: 'auto',
    numerar: true,
    tracks: [],
    pagina: 'portada',
  };

  const copia = o => JSON.parse(JSON.stringify(o));
  let estado = copia(VACIO);
  let fotoSrc = '';
  const assets = { foto: null, logo: null, iconoPropio: null };

  const avisar = (msg, malo) => { $('aviso').textContent = msg; $('aviso').className = malo ? 'malo' : ''; };
  const dos = n => String(n).padStart(2, '0');

  // ── Imágenes ───────────────────────────────────────────────────────────────
  const cargarImg = src => new Promise(ok => {
    if (!src) return ok(null);
    const i = new Image();
    i.onload = () => ok(i); i.onerror = () => ok(null);
    i.src = src;
  });

  const leerArchivo = file => new Promise((ok, mal) => {
    const r = new FileReader();
    r.onload = () => ok(r.result); r.onerror = () => mal(r.error);
    r.readAsDataURL(file);
  });

  // Achica para que quepa en localStorage; 2160 alcanza para zoom 2× en el 1080.
  async function reducir(src, max, tipo, calidad) {
    const img = await cargarImg(src);
    if (!img) throw new Error('No se pudo leer esa imagen.');
    const esc = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.round(img.naturalWidth * esc); c.height = Math.round(img.naturalHeight * esc);
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, 0, 0, c.width, c.height);
    return c.toDataURL(tipo, calidad);
  }

  // El ícono propio se pasa a 32×32 para que combine con los de pixel.
  async function hacerIconoPropio(src) {
    const img = await cargarImg(src);
    if (!img) return null;
    const c = document.createElement('canvas');
    c.width = c.height = iconos.N;
    const esc = Math.min(c.width / img.naturalWidth, c.height / img.naturalHeight);
    const w = img.naturalWidth * esc, h = img.naturalHeight * esc;
    c.getContext('2d').drawImage(img, (c.width - w) / 2, (c.height - h) / 2, w, h);
    return c;
  }

  async function cargarAssets() {
    const ruta = '../indexPage/indexImages/icons/';
    const [computadora, media, carpeta, ie, notas] = await Promise.all(
      ['computer_explorer-0.png', 'media_player-0.png', 'directory_closed-0.png', 'msie1-0.png', 'notepad_file-0.png']
        .map(f => cargarImg(ruta + f)));
    Object.assign(assets, { computadora, media, carpeta, ie, notas });
  }

  async function cargarImagenesDelEstado() {
    [assets.foto, assets.logo, assets.iconoPropio] = await Promise.all([
      cargarImg(fotoSrc), cargarImg(estado.logo), hacerIconoPropio(estado.iconoPropio),
    ]);
  }

  // Las letras llegan de la red. Se espera a lo mucho 3 s; si no, Tahoma.
  function cargarLetras() {
    const cdn = 'https://cdn.jsdelivr.net/npm/98.css@0.1.21/dist/';
    const caras = [
      new FontFace('W95', 'url(' + cdn + 'ms_sans_serif.woff2)'),
      new FontFace('W95', 'url(' + cdn + 'ms_sans_serif_bold.woff2)', { weight: 'bold' }),
    ];
    caras.forEach(f => document.fonts.add(f));
    const hoja = $('letra-roboto');
    const roboto = new Promise(ok => {
      if (!hoja || hoja.sheet) return ok();
      hoja.addEventListener('load', ok); hoja.addEventListener('error', ok);
    }).then(() => document.fonts.load('900 64px Roboto'));
    const todas = Promise.all([...caras.map(f => f.load()), roboto]).catch(() => {});
    return Promise.race([todas, new Promise(ok => setTimeout(ok, 3000))]);
  }

  // "Título - Artista" (o al revés), uno por línea. Los números del principio
  // (01, 1., 1)) se quitan; un "99 Luftballons" se queda como está.
  function partirLista(texto, alReves) {
    return String(texto || '').split('\n')
      .map(l => l.replace(/^\s*(?:\d{1,3}\s*[.)\-–:]|0\d)\s+/, '').trim())
      .filter(Boolean)
      .map(l => {
        const m = /^(.*?)\s+[-–—]\s+(.*)$/.exec(l) || /^(.*?)\t+(.*)$/.exec(l);
        let [titulo, artista] = m ? [m[1], m[2]] : [l, ''];
        if (alReves && m) [titulo, artista] = [artista, titulo];
        return { titulo: titulo.trim(), artista: artista.trim() };
      });
  }

  // ── Dibujar: solo la imagen que se ve ──────────────────────────────────────
  const lienzos = { portada: $('cv-portada'), tracklist: $('cv-tracklist') };
  const sucio = { portada: true, tracklist: true };
  let listo = false, cuadro = 0;

  function dibujarEn(cv, p, op) {
    const ctx = cv.getContext('2d');
    if (p === 'portada') motor.dibujarPortada(ctx, estado, assets, op);
    else motor.dibujarTracklist(ctx, estado, assets, op);
  }

  function pintar(p) { dibujarEn(lienzos[p], p); sucio[p] = false; }

  function pintarVisible() { if (listo && sucio[estado.pagina]) pintar(estado.pagina); }

  function dibujar() {
    sucio.portada = sucio.tracklist = true;
    $('titulo-app').textContent = estado.numero ? 'Sesión #' + estado.numero : 'Sesión nueva';
    $('pista').hidden = !listo || !!assets.foto;
    guardarLuego();
    if (!listo) return;
    // En una pestaña oculta requestAnimationFrame no corre: se dibuja directo.
    if (document.hidden) return pintarVisible();
    if (!cuadro) cuadro = requestAnimationFrame(() => { cuadro = 0; pintarVisible(); });
  }
  document.addEventListener('visibilitychange', pintarVisible);

  // ── Guardado ───────────────────────────────────────────────────────────────
  // El estado va en una clave y la foto en otra: escribir no vuelve a guardar
  // los megas de la foto en cada tecla.
  let reloj = 0;
  function guardarLuego() { clearTimeout(reloj); reloj = setTimeout(guardarAhora, 400); }

  function guardarAhora() {
    clearTimeout(reloj);
    try { localStorage.setItem(CLAVE, JSON.stringify(estado)); }
    catch (_) { avisar('No se pudo guardar en este navegador.', true); }
  }

  function guardarFoto() {
    try {
      if (fotoSrc) localStorage.setItem(CLAVE_FOTO, fotoSrc);
      else localStorage.removeItem(CLAVE_FOTO);
    } catch (_) {
      // Que no se quede guardada la foto de la sesión pasada.
      try { localStorage.removeItem(CLAVE_FOTO); } catch (__) { /* sin storage */ }
      avisar('La foto es muy pesada para guardarse: se pierde si cierras.', true);
    }
  }

  const esImagen = v => typeof v === 'string' && /^data:image\//.test(v);
  const esColor = v => typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v);

  // Lo guardado se completa con lo vacío por si le faltan campos. Solo se
  // aceptan imágenes data: (nada que venga de otro sitio).
  function normalizar(o) {
    const s = { ...copia(VACIO), ...o };
    s.foto = { ...VACIO.foto, ...(o.foto || {}) };
    delete s.foto.src;
    s.texto = { ...VACIO.texto, ...(o.texto || {}) };
    s.texto.contenido = String(s.texto.contenido || '');
    if (!esColor(s.texto.color)) s.texto.color = VACIO.texto.color;
    if (!esColor(s.fondo)) s.fondo = VACIO.fondo;
    if (!esImagen(s.logo)) s.logo = '';
    if (!esImagen(s.iconoPropio)) s.iconoPropio = '';
    s.tracks = Array.isArray(o.tracks)
      ? o.tracks.map(t => ({
        titulo: String((t && t.titulo) || ''), artista: String((t && t.artista) || ''),
        icono: String((t && t.icono) || ''), resaltar: !!(t && t.resaltar),
      }))
      : [];
    if (!PAGINAS.includes(s.pagina)) s.pagina = 'portada';
    ['lista', 'orden', 'porTrack', 'resaltado', 'titular', 'titularTam', 'titularColor', 'barra', 'barraColor', 'oscurecer']
      .forEach(k => delete s[k]);
    return s;
  }

  // Versiones viejas de lo guardado. La 2 tenía la lista como texto y los
  // ajustes por título; la 1 guardaba la foto adentro y el titular de noticia.
  function deV2(o) {
    const ajustes = o.porTrack || {};
    const tracks = partirLista(o.lista, o.orden === 'at').map(t => {
      const a = ajustes[motor.claveTrack(t)] || {};
      return { ...t, icono: a.icono || '', resaltar: !!a.resaltar };
    });
    return normalizar({ ...o, tracks });
  }

  function deV1(o) {
    const titular = String(o.titular || '');
    return normalizar({
      ...o,
      tracks: (Array.isArray(o.tracks) ? o.tracks : []).map((t, i) => ({ ...t, resaltar: i === o.resaltado })),
      // El titular de ejemplo era parte de esa foto; uno escrito a mano se queda.
      texto: { contenido: titular.startsWith('Fantasma se queda') ? '' : titular },
    });
  }

  // Las versiones de antes arrancaban con el ejemplo de la sesión #19. Si nadie
  // lo tocó, se tira (la foto, si pusieron una, se queda).
  const esElEjemplo = o => +o.numero === 19 && o.titulo === '¡Me gusta pero me asusta!';

  function leerGuardado() {
    try {
      const actual = localStorage.getItem(CLAVE);
      const f = localStorage.getItem(CLAVE_FOTO);
      fotoSrc = esImagen(f) ? f : '';
      if (actual) return normalizar(JSON.parse(actual));
      for (const [clave, migrar] of [[CLAVE_V3, normalizar], [CLAVE_V2, deV2], [CLAVE_V1, deV1]]) {
        const txt = localStorage.getItem(clave);
        if (!txt) continue;
        const viejo = JSON.parse(txt);
        if (clave === CLAVE_V1) fotoSrc = esImagen(viejo.foto && viejo.foto.src) ? viejo.foto.src : '';
        estado = esElEjemplo(viejo) ? normalizar({ foto: viejo.foto }) : migrar(viejo);
        guardarAhora(); localStorage.removeItem(clave);
        if (clave === CLAVE_V1) guardarFoto();
        return estado;
      }
    } catch (_) { /* sin storage o JSON roto: se empieza en blanco */ }
    return copia(VACIO);
  }

  // ── Páginas y flechas ──────────────────────────────────────────────────────
  function irA(p, dir) {
    if (!PAGINAS.includes(p)) return;
    cerrarMenuTrack();
    estado.pagina = p;
    app.dataset.pagina = p;
    $('tab-imagen').textContent = p === 'portada' ? 'Portada' : 'Tracklist';
    document.querySelectorAll('[data-ir]').forEach(b => b.setAttribute('aria-current', b.dataset.ir === p));
    if (dir) {
      const cv = lienzos[p];
      cv.classList.remove('entra-der', 'entra-izq');
      void cv.offsetWidth;       // reinicia la animación
      cv.classList.add(dir > 0 ? 'entra-der' : 'entra-izq');
    }
    pintarVisible();
    guardarLuego();
  }
  const mover = d => irA(PAGINAS[(PAGINAS.indexOf(estado.pagina) + d + PAGINAS.length) % PAGINAS.length], d);

  $('ant').addEventListener('click', () => mover(-1));
  $('sig').addEventListener('click', () => mover(1));
  document.querySelectorAll('[data-ir]').forEach(b => b.addEventListener('click', () =>
    irA(b.dataset.ir, PAGINAS.indexOf(b.dataset.ir) - PAGINAS.indexOf(estado.pagina))));

  const escribiendo = el => !!(el && el.closest && el.closest('input, textarea, select, [contenteditable]'));
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape') cerrarMenuTrack();
    if (escribiendo(e.target) || document.querySelector('dialog[open]') || e.altKey || e.ctrlKey || e.metaKey) return;
    if (e.key === 'ArrowLeft') mover(-1);
    else if (e.key === 'ArrowRight') mover(1);
  });

  // Celular: el panel de abajo cambia entre los datos de la sesión y la imagen.
  function hoja(cual) {
    app.dataset.hoja = cual;
    document.querySelectorAll('#tabs [data-hoja]').forEach(b => b.setAttribute('aria-current', b.dataset.hoja === cual));
  }
  document.querySelectorAll('#tabs [data-hoja]').forEach(b => b.addEventListener('click', () => hoja(b.dataset.hoja)));

  // ── Campos ─────────────────────────────────────────────────────────────────
  const campos = [...document.querySelectorAll('[data-campo]')];
  const camposTexto = [...document.querySelectorAll('[data-texto]')];

  const valorDe = el =>
    el.type === 'checkbox' ? el.checked
      : el.type === 'number' || el.type === 'range' ? (el.value === '' ? '' : +el.value)
        : el.value;
  const ponerValor = (el, v) => { if (el.type === 'checkbox') el.checked = !!v; else el.value = v ?? ''; };
  const alCambiar = (el, fn) => { el.addEventListener('input', fn); el.addEventListener('change', fn); };

  campos.forEach(el => alCambiar(el, () => { estado[el.dataset.campo] = valorDe(el); dibujar(); }));
  camposTexto.forEach(el => alCambiar(el, () => { estado.texto[el.dataset.texto] = valorDe(el); pintarEstiloTexto(); dibujar(); }));

  function pintarCampos() {
    campos.forEach(el => ponerValor(el, estado[el.dataset.campo]));
    camposTexto.forEach(el => ponerValor(el, estado.texto[el.dataset.texto]));
    $('f-zoom').value = estado.foto.zoom;
    pintarEstiloTexto();
  }

  function pintarEstiloTexto() {
    const t = estado.texto;
    document.querySelectorAll('[data-estilo]').forEach(b => b.classList.toggle('activo', b.dataset.estilo === t.estilo));
    document.querySelectorAll('[data-alinear]').forEach(b => b.classList.toggle('activo', b.dataset.alinear === t.alinear));
    document.querySelectorAll('[data-color]').forEach(b => b.classList.toggle('activo', b.dataset.color === t.color.toLowerCase()));
    $('grupo-portada').dataset.estilo = t.estilo;
  }

  document.querySelectorAll('[data-estilo]').forEach(b => b.addEventListener('click', () => {
    estado.texto.estilo = b.dataset.estilo; pintarEstiloTexto(); dibujar();
  }));
  document.querySelectorAll('[data-alinear]').forEach(b => b.addEventListener('click', () => {
    estado.texto.alinear = b.dataset.alinear; pintarEstiloTexto(); dibujar();
  }));
  document.querySelectorAll('[data-color]').forEach(b => b.addEventListener('click', () => {
    estado.texto.color = b.dataset.color;
    ponerValor(document.querySelector('[data-texto=color]'), b.dataset.color);
    pintarEstiloTexto(); dibujar();
  }));

  // ── Foto ───────────────────────────────────────────────────────────────────
  async function ponerFoto(file) {
    if (!file || !file.type.startsWith('image/')) return;
    avisar('Cargando foto...');
    try {
      fotoSrc = await reducir(await leerArchivo(file), 2160, 'image/jpeg', 0.86);
      estado.foto = { zoom: 1, x: 0.5, y: 0.5 };
      assets.foto = await cargarImg(fotoSrc);
      avisar('Foto lista. Arrástrala para encuadrar.');
      guardarFoto();
      pintarCampos();
      irA('portada');
      dibujar();
    } catch (e) { avisar(e.message, true); }
  }

  $('btn-foto').addEventListener('click', () => $('in-foto').click());
  $('in-foto').addEventListener('change', e => { ponerFoto(e.target.files[0]); e.target.value = ''; });
  $('btn-quitar-foto').addEventListener('click', () => {
    if (!assets.foto) return;
    fotoSrc = ''; assets.foto = null; estado.foto = { zoom: 1, x: 0.5, y: 0.5 };
    guardarFoto(); pintarCampos(); dibujar();
  });
  alCambiar($('f-zoom'), () => { estado.foto.zoom = +$('f-zoom').value; dibujar(); });
  $('btn-centrar').addEventListener('click', () => { estado.foto = { zoom: 1, x: 0.5, y: 0.5 }; pintarCampos(); dibujar(); });

  // Pegar una imagen la pone de foto, salvo que estés pegando texto en un campo
  // (las páginas copian texto e imagen juntos y aquí lo que quieres es el texto).
  document.addEventListener('paste', e => {
    const items = [...(e.clipboardData ? e.clipboardData.items : [])];
    const img = items.find(i => i.type.startsWith('image/'));
    if (!img) return;
    if (escribiendo(e.target) && items.some(i => i.type === 'text/plain')) return;
    e.preventDefault();
    ponerFoto(img.getAsFile());
  });

  // Soltar una foto en cualquier lado.
  const env = $('lienzo-env');
  document.addEventListener('dragover', e => { e.preventDefault(); env.classList.add('encima'); });
  document.addEventListener('dragleave', e => { if (!e.relatedTarget) env.classList.remove('encima'); });
  document.addEventListener('drop', e => {
    e.preventDefault(); env.classList.remove('encima');
    const f = [...(e.dataTransfer ? e.dataTransfer.files : [])].find(x => x.type.startsWith('image/'));
    if (f) ponerFoto(f);
  });

  // ── Arrastrar en la portada: el texto si lo agarras, si no la foto ─────────
  const cvP = lienzos.portada;
  let arrastre = null;
  const enLienzo = (e, cv) => {
    const r = cv.getBoundingClientRect(), k = motor.W / r.width;
    return { x: (e.clientX - r.left) * k, y: (e.clientY - r.top) * k, k };
  };
  const sobreTexto = p => {
    const c = motor.cajaTexto(estado);
    return !!c && p.x >= c.x && p.x <= c.x + c.w && p.y >= c.y && p.y <= c.y + c.h;
  };

  cvP.addEventListener('pointerdown', e => {
    const p = enLienzo(e, cvP);
    if (sobreTexto(p)) arrastre = { tipo: 'texto', x0: e.clientX, y0: e.clientY, k: p.k, a: estado.texto.x, b: estado.texto.y };
    else if (!assets.foto) { $('in-foto').click(); return; }
    else if (p.y < motor.REPRO_Y) arrastre = { tipo: 'foto', x0: e.clientX, y0: e.clientY, k: p.k, a: estado.foto.x, b: estado.foto.y };
    else return;
    try { cvP.setPointerCapture(e.pointerId); } catch (_) { /* el dedo ya se fue */ }
    cvP.classList.add('arrastrando');
  });

  cvP.addEventListener('pointermove', e => {
    if (!arrastre) {
      const p = enLienzo(e, cvP);
      cvP.style.cursor = sobreTexto(p) ? 'move' : !assets.foto ? 'pointer' : p.y < motor.REPRO_Y ? '' : 'default';
      return;
    }
    const dx = (e.clientX - arrastre.x0) * arrastre.k, dy = (e.clientY - arrastre.y0) * arrastre.k;
    if (arrastre.tipo === 'texto') {
      estado.texto.x = arrastre.a + dx / motor.W;
      estado.texto.y = arrastre.b + dy / motor.REPRO_Y;
      // Que lo guardado sea donde quedó de verdad (el motor no lo deja salirse).
      const c = motor.cajaTexto(estado);
      if (c) { estado.texto.x = (c.x + c.w / 2) / motor.W; estado.texto.y = (c.y + c.h / 2) / motor.REPRO_Y; }
    } else {
      const m = motor.medidasFoto(estado, assets.foto);
      const sobraX = m.w - m.dw, sobraY = m.h - m.dh;    // negativos: lo que se sale
      const lim = v => Math.min(1, Math.max(0, v));
      if (sobraX < 0) estado.foto.x = lim(arrastre.a + dx / sobraX);
      if (sobraY < 0) estado.foto.y = lim(arrastre.b + dy / sobraY);
    }
    dibujar();
  });

  const soltar = () => { arrastre = null; cvP.classList.remove('arrastrando'); };
  cvP.addEventListener('pointerup', soltar);
  cvP.addEventListener('pointercancel', soltar);

  // La rueda: tamaño del texto si estás encima de él, zoom de la foto si no.
  cvP.addEventListener('wheel', e => {
    const p = enLienzo(e, cvP), f = e.deltaY < 0 ? 1.06 : 1 / 1.06;
    if (sobreTexto(p)) {
      estado.texto.tam = Math.round(Math.min(140, Math.max(28, estado.texto.tam * f)));
      ponerValor($('t-tam'), estado.texto.tam);
    } else if (assets.foto) {
      estado.foto.zoom = Math.min(3, Math.max(1, estado.foto.zoom * f));
      $('f-zoom').value = estado.foto.zoom;
    } else return;
    e.preventDefault();
    dibujar();
  }, { passive: false });

  // ── Íconos ─────────────────────────────────────────────────────────────────
  function opcionesIcono() {
    const ops = iconos.lista.map(i => ({ id: i.id, nombre: i.nombre, canvas: i.canvas }));
    if (assets.iconoPropio) ops.push({ id: 'propio', nombre: 'El tuyo', canvas: assets.iconoPropio });
    return ops;
  }

  function miniatura(canvas) {
    const c = document.createElement('canvas');
    c.width = c.height = iconos.N;
    c.getContext('2d').drawImage(canvas, 0, 0);
    return c;
  }

  function botonIcono(o, activo, conNombre, alElegir) {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'ico' + (activo ? ' activo' : ''); b.title = o.nombre;
    b.append(miniatura(o.canvas));
    if (conNombre) { const n = document.createElement('span'); n.textContent = o.nombre; b.append(n); }
    b.addEventListener('click', alElegir);
    return b;
  }

  function pintarIconos() {
    const caja = $('iconos');
    caja.textContent = '';
    // Otro clic en el que ya está lo quita: el tracklist se queda sin ícono.
    opcionesIcono().forEach(o => caja.append(botonIcono(o, estado.icono === o.id, true, () => {
      estado.icono = estado.icono === o.id ? '' : o.id; pintarIconos(); dibujar();
    })));
    const subir = document.createElement('button');
    subir.type = 'button'; subir.className = 'ico'; subir.title = 'Usar una imagen tuya como ícono';
    const mas = document.createElement('span'); mas.className = 'mas'; mas.textContent = '+';
    const txt = document.createElement('span'); txt.textContent = 'Subir';
    subir.append(mas, txt);
    subir.addEventListener('click', () => $('in-icono').click());
    caja.append(subir);
  }

  $('in-icono').addEventListener('change', async e => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    try {
      estado.iconoPropio = await reducir(await leerArchivo(file), 128, 'image/png');
      assets.iconoPropio = await hacerIconoPropio(estado.iconoPropio);
      estado.icono = 'propio';
      pintarIconos(); pintarTracks(); dibujar();
    } catch (err) { avisar(err.message, true); }
  });

  // ── Tracks: una fila por track ─────────────────────────────────────────────
  function opcionesSelect(sel, actual) {
    [['', '(igual)'], ...opcionesIcono().map(o => [o.id, o.nombre])].forEach(([id, nombre]) => {
      const o = document.createElement('option');
      o.value = id; o.textContent = nombre; o.selected = id === actual;
      sel.append(o);
    });
  }

  function botonChico(texto, titulo, onClick) {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = texto; b.title = titulo;
    b.addEventListener('click', onClick);
    return b;
  }

  function moverTrack(i, d) {
    const j = i + d;
    if (j < 0 || j >= estado.tracks.length) return;
    [estado.tracks[i], estado.tracks[j]] = [estado.tracks[j], estado.tracks[i]];
    pintarTracks(); dibujar();
  }

  function quitarTrack(i) {
    estado.tracks.splice(i, 1);
    pintarTracks(); dibujar();
  }

  function pintarTracks() {
    const caja = $('tracks');
    caja.textContent = '';
    estado.tracks.forEach((t, i) => {
      const fila = document.createElement('div');
      fila.className = 'track' + (t.resaltar ? ' sel' : '');
      const n = document.createElement('span'); n.className = 'n'; n.textContent = dos(i + 1);
      const titulo = document.createElement('input');
      titulo.type = 'text'; titulo.placeholder = 'Título'; titulo.value = t.titulo; titulo.title = 'Título';
      titulo.addEventListener('input', () => { t.titulo = titulo.value; dibujar(); });
      titulo.addEventListener('change', pintarResaltado);
      const artista = document.createElement('input');
      artista.type = 'text'; artista.placeholder = 'Artista'; artista.value = t.artista; artista.title = 'Artista';
      artista.addEventListener('input', () => { t.artista = artista.value; dibujar(); });
      const ico = document.createElement('select');
      ico.title = 'Ícono de este track';
      opcionesSelect(ico, t.icono);
      ico.addEventListener('change', () => { t.icono = ico.value; dibujar(); });
      fila.append(n, titulo, artista, ico,
        botonChico('▲', 'Subir', () => moverTrack(i, -1)),
        botonChico('▼', 'Bajar', () => moverTrack(i, 1)),
        botonChico('✕', 'Quitar', () => quitarTrack(i)));
      caja.append(fila);
    });
    pintarResaltado();
  }

  // El selector marca uno solo; el clic en la imagen deja marcar varios.
  function pintarResaltado() {
    const sel = $('f-resaltado');
    sel.textContent = '';
    const primero = estado.tracks.findIndex(t => t.resaltar);
    [['-1', '(ninguno)'], ...estado.tracks.map((t, i) => [String(i), dos(i + 1) + ' ' + (t.titulo || '')])]
      .forEach(([v, txt]) => {
        const o = document.createElement('option');
        o.value = v; o.textContent = txt; o.selected = +v === primero;
        sel.append(o);
      });
    document.querySelectorAll('#tracks .track').forEach((f, i) => f.classList.toggle('sel', !!estado.tracks[i].resaltar));
  }

  $('f-resaltado').addEventListener('change', e => {
    const v = +e.target.value;
    estado.tracks.forEach((t, i) => { t.resaltar = i === v; });
    pintarResaltado(); dibujar();
  });

  $('btn-agregar').addEventListener('click', () => {
    estado.tracks.push({ titulo: '', artista: '', icono: '', resaltar: false });
    pintarTracks(); dibujar();
    const nueva = $('tracks').querySelector('.track:last-child input');
    if (nueva) { nueva.scrollIntoView({ block: 'nearest' }); nueva.focus(); }
  });

  $('btn-vaciar').addEventListener('click', () => {
    if (!estado.tracks.length || !confirm('¿Borrar los ' + estado.tracks.length + ' tracks?')) return;
    estado.tracks = [];
    pintarTracks(); dibujar();
  });

  // Pegar la lista completa. Un track que ya estaba (mismo título) conserva su
  // ícono y su resaltado aunque cambie de lugar.
  const dlgPegar = $('dlg-pegar');
  $('btn-pegar').addEventListener('click', () => {
    $('pegar-texto').value = estado.tracks.map(t => [t.titulo, t.artista].filter(Boolean).join(' - ')).join('\n');
    document.querySelector('input[name=orden][value=ta]').checked = true;
    dlgPegar.showModal();
    $('pegar-texto').select();
  });
  $('pegar-cancelar').addEventListener('click', () => dlgPegar.close());
  $('pegar-ok').addEventListener('click', () => {
    const alReves = document.querySelector('input[name=orden]:checked').value === 'at';
    const antes = new Map(estado.tracks.map(t => [motor.claveTrack(t), t]));
    estado.tracks = partirLista($('pegar-texto').value, alReves).map(t => {
      const viejo = antes.get(motor.claveTrack(t)) || {};
      return { ...t, icono: viejo.icono || '', resaltar: !!viejo.resaltar };
    });
    dlgPegar.close();
    pintarTracks(); dibujar();
    avisar(estado.tracks.length + ' tracks.');
  });

  // ── Menú de un track: clic en la imagen del tracklist ──────────────────────
  const menuTrack = $('menu-track');
  function cerrarMenuTrack() { menuTrack.hidden = true; }

  function ajustar(t, cambio) {
    Object.assign(t, cambio);
    cerrarMenuTrack();
    pintarTracks(); dibujar();
  }

  function abrirMenuTrack(i, e) {
    const t = estado.tracks[i];
    menuTrack.textContent = '';
    const nombre = document.createElement('div');
    nombre.className = 'nombre'; nombre.textContent = dos(i + 1) + ' ' + (t.titulo || '(sin título)');
    const rejilla = document.createElement('div');
    rejilla.className = 'rejilla';
    const igual = document.createElement('button');
    igual.type = 'button'; igual.className = 'ico igual' + (t.icono ? '' : ' activo');
    igual.textContent = 'Igual'; igual.title = 'El mismo ícono que todos';
    igual.addEventListener('click', () => ajustar(t, { icono: '' }));
    rejilla.append(igual);
    opcionesIcono().forEach(o => rejilla.append(botonIcono(o, t.icono === o.id, false, () => ajustar(t, { icono: o.id }))));
    const resaltar = document.createElement('button');
    resaltar.type = 'button'; resaltar.className = 'resaltar';
    resaltar.textContent = t.resaltar ? 'Quitar resaltado' : '★ Resaltar';
    resaltar.addEventListener('click', () => ajustar(t, { resaltar: !t.resaltar }));
    menuTrack.append(nombre, rejilla, resaltar);
    menuTrack.hidden = false;

    // Junto al dedo, sin salirse de la imagen.
    const r = env.getBoundingClientRect();
    const mw = menuTrack.offsetWidth, mh = menuTrack.offsetHeight;
    const x = e.clientX - r.left, y = e.clientY - r.top;
    menuTrack.style.left = Math.max(4, Math.min(x - mw / 2, r.width - mw - 4)) + 'px';
    menuTrack.style.top = (y + 14 + mh < r.height ? y + 14 : Math.max(4, y - mh - 14)) + 'px';

    // Y su fila en el panel, a la vista.
    const fila = $('tracks').children[i];
    if (fila) fila.scrollIntoView({ block: 'nearest' });
  }

  lienzos.tracklist.addEventListener('click', e => {
    const p = enLienzo(e, lienzos.tracklist);
    const i = motor.celdaEn(estado, p.x, p.y);
    if (i < 0) return cerrarMenuTrack();
    abrirMenuTrack(i, e);
  });
  document.addEventListener('pointerdown', e => {
    if (!menuTrack.hidden && !menuTrack.contains(e.target) && e.target !== lienzos.tracklist) cerrarMenuTrack();
  });

  // ── Plantilla ──────────────────────────────────────────────────────────────
  const dlgPlantilla = $('dlg-plantilla');
  const abrirPlantilla = () => { pintarCampos(); dlgPlantilla.showModal(); };
  $('btn-plantilla').addEventListener('click', abrirPlantilla);
  $('plantilla-ok').addEventListener('click', () => { dlgPlantilla.close(); pintarCampos(); });
  $('btn-logo').addEventListener('click', () => $('in-logo').click());
  $('in-logo').addEventListener('change', async e => {
    const file = e.target.files[0]; e.target.value = '';
    if (!file) return;
    try {
      estado.logo = await reducir(await leerArchivo(file), 360, 'image/png');
      assets.logo = await cargarImg(estado.logo);
      dibujar();
    } catch (err) { avisar(err.message, true); }
  });
  $('btn-logo-quitar').addEventListener('click', () => { estado.logo = ''; assets.logo = null; dibujar(); });

  // ── Exportar ───────────────────────────────────────────────────────────────
  const nombreArchivo = (p, marco) =>
    (estado.numero ? 'sesion-' + estado.numero + '-' : '') + (marco ? 'marco-' : '') + p + '.png';
  const enCelular = () => matchMedia('(pointer: coarse)').matches;

  function bajar(file) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(file);
    a.download = file.name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
  }

  // marco: solo el cromo de Windows, transparente donde van la foto, el texto
  // y los tracks. Se dibuja en un canvas aparte para no tocar la vista.
  async function exportar(cuales, marco) {
    // Se dibuja ya, sin esperar al siguiente cuadro, para no bajar algo a medias.
    const archivos = await Promise.all(cuales.map(p => new Promise(ok => {
      let cv = lienzos[p];
      if (marco) {
        cv = document.createElement('canvas');
        cv.width = motor.W; cv.height = motor.H;
        dibujarEn(cv, p, { marco: true });
      } else pintar(p);
      cv.toBlob(b => ok(new File([b], nombreArchivo(p, marco), { type: 'image/png' })), 'image/png');
    })));
    // En el cel, "Compartir" deja guardarlas directo en Fotos.
    if (enCelular() && navigator.canShare && navigator.canShare({ files: archivos })) {
      try { await navigator.share({ files: archivos }); return; }
      catch (e) { if (e.name === 'AbortError') return; }
    }
    archivos.forEach((f, i) => setTimeout(() => bajar(f), i * 400));
    avisar(marco ? 'Descargando los marcos.'
      : archivos.length > 1 ? 'Descargando las dos.' : 'Descargando ' + archivos[0].name + '.');
  }

  $('btn-esta').addEventListener('click', () => exportar([estado.pagina]));
  $('btn-ambas').addEventListener('click', () => exportar(PAGINAS));
  $('btn-marcos').addEventListener('click', () => exportar(PAGINAS, true));

  // ── Sesión nueva ───────────────────────────────────────────────────────────
  // Desde cero: no se queda nada de la sesión pasada, ni la plantilla.
  function sesionNueva() {
    if (!confirm('¿Empezar una sesión nueva desde cero? Se borra todo lo de esta.')) return;
    estado = copia(VACIO);
    fotoSrc = '';
    Object.assign(assets, { foto: null, logo: null, iconoPropio: null });
    guardarFoto(); guardarAhora();
    pintarTodo(); irA('portada');
    hoja('sesion');
    $('f-numero').focus();
    avisar('Sesión nueva: todo en blanco.');
  }

  function cerrar() {
    guardarAhora();
    cerrarMenuTrack();
    if (window.parent !== window) window.parent.postMessage({ gdn: 'cerrar-portada' }, location.origin);
    else location.href = '../articulosPage/admin.html';
  }

  // ── Menú ───────────────────────────────────────────────────────────────────
  const cerrarMenus = () => document.querySelectorAll('.fe-menu-item.open, .fe-dropdown.open').forEach(x => x.classList.remove('open'));
  document.querySelectorAll('.fe-menu-item').forEach(mi => {
    mi.addEventListener('click', e => {
      e.stopPropagation();
      const dd = $('fe-dropdown-' + mi.dataset.menu);
      const abierto = mi.classList.contains('open');
      cerrarMenus();
      if (!abierto && dd) { mi.classList.add('open'); dd.classList.add('open'); }
    });
  });
  document.querySelectorAll('.fe-dd-item').forEach(li => {
    li.addEventListener('click', e => {
      e.stopPropagation();
      const a = li.dataset.action;
      cerrarMenus();
      if (a === 'nueva') sesionNueva();
      else if (a === 'plantilla') abrirPlantilla();
      else if (a === 'cerrar') cerrar();
    });
  });
  document.addEventListener('click', cerrarMenus);
  $('btn-cerrar').addEventListener('click', cerrar);

  // ── Arranque ───────────────────────────────────────────────────────────────
  function pintarTodo() { pintarCampos(); pintarIconos(); pintarTracks(); dibujar(); }

  (async () => {
    estado = leerGuardado();
    pintarCampos();
    pintarTracks();
    irA(estado.pagina);
    hoja('imagen');
    await Promise.all([cargarAssets(), cargarImagenesDelEstado(), cargarLetras()]);
    listo = true;
    $('cargando').hidden = true;
    pintarTodo();
    // Una letra que llegue tarde (después de los 3 s) también se nota.
    document.fonts.addEventListener('loadingdone', dibujar);
  })();
})();
