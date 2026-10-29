// Motor de portadas de la radio: dibuja la portada y el tracklist de cada
// sesión en un canvas de 1080×1350 (el 4:5 de Instagram). La foto y el texto
// libre cambian cada semana; la ventana del reproductor, la barra de tareas y
// la carpeta del tracklist son la plantilla. Todo el cromo de Windows 95 va a
// escala 2: un pixel de Windows son 2 del canvas.
(function (global) {
  'use strict';

  const W = 1080, H = 1350, P = 2;
  const FUENTE_95 = '"W95", "MS Sans Serif", "Microsoft Sans Serif", Tahoma, sans-serif';
  const fuenteLibre = t => '900 ' + t + 'px "Roboto", "Arial Black", Arial, sans-serif';

  const GRIS = '#c0c0c0', CLARO = '#dfdfdf', OSCURO = '#808080', NEGRO = '#000', BLANCO = '#fff';
  const AZUL = '#000080', AZUL2 = '#1084d0';

  // Biseles de afuera hacia adentro: [arriba-izquierda, abajo-derecha].
  const VENTANA  = [[CLARO, NEGRO], [BLANCO, OSCURO]];
  const BOTON    = [[BLANCO, NEGRO], [CLARO, OSCURO]];
  const HUNDIDO  = [[OSCURO, BLANCO], [NEGRO, CLARO]];
  const APRETADO = [[NEGRO, BLANCO], [OSCURO, CLARO]];
  const PANEL    = [[OSCURO, BLANCO]];

  const BARRA_H = 56;                       // barra de tareas
  const REPRO_H = 202;                      // ventana del reproductor en la portada
  const REPRO_Y = H - BARRA_H - REPRO_H;    // donde termina la foto

  const f95 = (px, negritas) => (negritas ? 'bold ' : '') + px + 'px ' + FUENTE_95;

  // ── Fechas ─────────────────────────────────────────────────────────────────
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const dos = n => String(n).padStart(2, '0');

  function fechaBonita(iso) {           // 2026-10-30 → Viernes 30.10.26
    const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || '');
    if (!m) return '';
    const f = new Date(+m[1], +m[2] - 1, +m[3]);
    return DIAS[f.getDay()] + ' ' + m[3] + '.' + m[2] + '.' + m[1].slice(2);
  }

  function horaBonita(hhmm) {           // 19:00 → 7:00 PM
    const m = /^(\d{1,2}):(\d{2})/.exec(hhmm || '');
    if (!m) return '';
    const h = +m[1];
    return (h % 12 || 12) + ':' + m[2] + (h < 12 ? ' AM' : ' PM');
  }

  const juntar = partes => partes.filter(Boolean).join('  ·  ');

  // ── Primitivas ─────────────────────────────────────────────────────────────
  function marco(ctx, x, y, w, h, capas) {
    capas.forEach(([a, b], i) => {
      const o = i * P;
      ctx.fillStyle = a;
      ctx.fillRect(x + o, y + o, w - 2 * o - P, P);
      ctx.fillRect(x + o, y + o, P, h - 2 * o - P);
      ctx.fillStyle = b;
      ctx.fillRect(x + o, y + h - o - P, w - 2 * o, P);
      ctx.fillRect(x + w - o - P, y + o, P, h - 2 * o);
    });
  }

  // Imagen chiquita al doble sin suavizar, para que se vea el pixel.
  function pixeles(ctx, img, x, y, w, h) {
    if (!img) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, Math.round(x), Math.round(y), w, h);
    ctx.imageSmoothingEnabled = true;
  }

  // Dibujos de 1px de Windows (cada '#' es un pixel) escalados a P.
  function glifo(ctx, filas, x, y, color) {
    ctx.fillStyle = color;
    filas.forEach((fila, j) => {
      for (let i = 0; i < fila.length; i++) if (fila[i] === '#') ctx.fillRect(x + i * P, y + j * P, P, P);
    });
  }
  const G_MIN = ['######', '######'];
  const G_MAX = ['#########', '#########', '#.......#', '#.......#', '#.......#', '#.......#', '#.......#', '#.......#', '#########'];
  const G_X = ['##....##', '.##..##.', '..####..', '...##...', '..####..', '.##..##.', '##....##'];

  // Corta con "..." lo que no cabe en una línea.
  function cabe(ctx, texto, ancho) {
    if (ctx.measureText(texto).width <= ancho) return texto;
    let t = texto;
    while (t && ctx.measureText(t + '...').width > ancho) t = t.slice(0, -1);
    return t ? t.trimEnd() + '...' : '';
  }

  // Parte en líneas que quepan en `ancho`. Respeta los saltos que puso quien escribe.
  function partir(ctx, texto, ancho) {
    const lineas = [];
    String(texto || '').split('\n').forEach(parrafo => {
      let linea = '';
      parrafo.split(/\s+/).filter(Boolean).forEach(p => {
        const prueba = linea ? linea + ' ' + p : p;
        if (!linea || ctx.measureText(prueba).width <= ancho) linea = prueba;
        else { lineas.push(linea); linea = p; }
      });
      if (linea) lineas.push(linea);
    });
    return lineas.map(l => cabe(ctx, l, ancho));
  }

  function recortar(ctx, lineas, max, ancho) {
    if (lineas.length <= max) return lineas;
    const r = lineas.slice(0, max);
    if (max > 0) {
      let l = r[max - 1].replace(/\.\.\.$/, '');
      while (l && ctx.measureText(l + '...').width > ancho) l = l.slice(0, -1);
      r[max - 1] = l.trimEnd() + '...';
    }
    return r;
  }

  let trama = null;
  function tramado(ctx, x, y, w, h) {
    if (!trama) {
      const c = document.createElement('canvas');
      c.width = c.height = 2 * P;
      const t = c.getContext('2d');
      t.fillStyle = GRIS; t.fillRect(0, 0, 2 * P, 2 * P);
      t.fillStyle = BLANCO; t.fillRect(0, 0, P, P); t.fillRect(P, P, P, P);
      trama = ctx.createPattern(c, 'repeat');
    }
    ctx.fillStyle = trama;
    ctx.fillRect(x, y, w, h);
  }

  // Ícono seleccionado: tramado azul encima, como en el escritorio de Windows.
  const seleccionados = new WeakMap();
  function seleccionado(icono) {
    if (seleccionados.has(icono)) return seleccionados.get(icono);
    const c = document.createElement('canvas');
    c.width = icono.width; c.height = icono.height;
    const ctx = c.getContext('2d');
    const celda = Math.max(1, Math.round(icono.width / 32));
    ctx.drawImage(icono, 0, 0);
    ctx.globalCompositeOperation = 'source-atop';
    ctx.fillStyle = AZUL;
    for (let y = 0; y < c.height; y += celda) {
      for (let x = ((y / celda) % 2) * celda; x < c.width; x += 2 * celda) ctx.fillRect(x, y, celda, celda);
    }
    seleccionados.set(icono, c);
    return c;
  }

  // ── Cromo ──────────────────────────────────────────────────────────────────
  function botonTitulo(ctx, x, y, w, h, g) {
    ctx.fillStyle = GRIS; ctx.fillRect(x, y, w, h);
    marco(ctx, x, y, w, h, BOTON);
    const gw = g[0].length * P, gh = g.length * P;
    const gy = g === G_MIN ? y + h - 6 - gh : y + Math.round((h - gh) / 2) - 1;
    glifo(ctx, g, x + Math.round((w - gw) / 2) - 1, gy, NEGRO);
  }

  function barraTitulo(ctx, x, y, w, h, icono, texto) {
    const deg = ctx.createLinearGradient(x, 0, x + w, 0);
    deg.addColorStop(0, AZUL); deg.addColorStop(1, AZUL2);
    ctx.fillStyle = deg; ctx.fillRect(x, y, w, h);

    const bw = 32, bh = h - 8, by = y + 4;
    const xc = x + w - 4 - bw, xm = xc - 4 - bw, xn = xm - bw;
    botonTitulo(ctx, xn, by, bw, bh, G_MIN);
    botonTitulo(ctx, xm, by, bw, bh, G_MAX);
    botonTitulo(ctx, xc, by, bw, bh, G_X);

    let tx = x + 8;
    if (icono) { pixeles(ctx, icono, x + 4, y + (h - 32) / 2, 32, 32); tx = x + 44; }
    ctx.font = f95(22, true); ctx.fillStyle = BLANCO;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(cabe(ctx, texto, xn - 10 - tx), tx, y + h / 2 + 1);
  }

  function botonBarra(ctx, x, y, w, h, icono, texto, apretado) {
    if (apretado) { tramado(ctx, x, y, w, h); marco(ctx, x, y, w, h, APRETADO); }
    else { ctx.fillStyle = GRIS; ctx.fillRect(x, y, w, h); marco(ctx, x, y, w, h, BOTON); }
    const d = apretado ? P : 0;
    let tx = x + 10 + d;
    if (icono) { pixeles(ctx, icono, tx, y + (h - 32) / 2 + d, 32, 32); tx += 40; }
    ctx.font = f95(22, apretado); ctx.fillStyle = NEGRO;
    ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(cabe(ctx, texto, x + w - 10 - tx), tx, y + h / 2 + 1 + d);
  }

  function barraTareas(ctx, s, a, tarea) {
    const y = H - BARRA_H;
    ctx.fillStyle = GRIS; ctx.fillRect(0, y, W, BARRA_H);
    ctx.fillStyle = CLARO; ctx.fillRect(0, y, W, P);
    ctx.fillStyle = BLANCO; ctx.fillRect(0, y + P, W, P);

    const by = y + 8, bh = BARRA_H - 12;
    // "Inicio" va en negritas aunque no esté apretado.
    ctx.fillStyle = GRIS; ctx.fillRect(4, by, 118, bh); marco(ctx, 4, by, 118, bh, BOTON);
    pixeles(ctx, a.computadora, 12, by + (bh - 32) / 2, 32, 32);
    ctx.font = f95(22, true); ctx.fillStyle = NEGRO; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText('Inicio', 50, by + bh / 2 + 1);

    botonBarra(ctx, 128, by, 320, bh, tarea.icono, tarea.texto, true);
    botonBarra(ctx, 454, by, 320, bh, a.ie, s.sitio, false);

    const rw = 126, rx = W - 4 - rw;
    marco(ctx, rx, by, rw, bh, PANEL);
    ctx.font = f95(22); ctx.fillStyle = NEGRO; ctx.textAlign = 'center';
    ctx.fillText(horaBonita(s.hora), rx + rw / 2, by + bh / 2 + 1);
    ctx.textAlign = 'left';
  }

  // ── Portada ────────────────────────────────────────────────────────────────
  // Dónde cae la foto: llena el hueco arriba del reproductor (como "cover").
  function medidasFoto(s, img) {
    const w = W, h = REPRO_Y;
    if (!img) return { w, h, dw: w, dh: h, dx: 0, dy: 0 };
    const f = s.foto || {};
    const esc = Math.max(w / img.naturalWidth, h / img.naturalHeight) * (f.zoom || 1);
    const dw = img.naturalWidth * esc, dh = img.naturalHeight * esc;
    return { w, h, dw, dh, dx: (w - dw) * (f.x ?? 0.5), dy: (h - dh) * (f.y ?? 0.5) };
  }

  function foto(ctx, s, img) {
    const m = medidasFoto(s, img);
    if (!img) {
      const deg = ctx.createLinearGradient(0, 0, 0, m.h);
      deg.addColorStop(0, '#1d2b33'); deg.addColorStop(1, '#070b0e');
      ctx.fillStyle = deg; ctx.fillRect(0, 0, m.w, m.h);
      return;
    }
    ctx.save();
    ctx.beginPath(); ctx.rect(0, 0, m.w, m.h); ctx.clip();
    ctx.imageSmoothingQuality = 'high';
    ctx.drawImage(img, m.dx, m.dy, m.dw, m.dh);
    ctx.restore();
  }

  // ── Texto libre ────────────────────────────────────────────────────────────
  // Una capa de texto que se arrastra a donde sea sobre la foto, con tres
  // estilos. texto.x / texto.y son el centro del bloque, en fracción del área
  // de la foto; el bloque nunca se sale de ella.
  const MARGEN = 16, ANCHO_MAX = W - 120;
  const NOTA_TITULO = 'Nota.txt - Bloc de notas';
  const NOTA_ARRIBA = 80, NOTA_PAD = 14;     // barra + menú, y aire adentro del papel
  const tamNota = t => Math.min(66, Math.max(22, Math.round(t * 0.5 / 11) * 11));   // múltiplos de 11: pixel limpio
  let medidor = null;

  // Blanco o negro, lo que se lea mejor sobre `hex`.
  function contraste(hex) {
    const n = parseInt(String(hex).slice(1), 16) || 0;
    return 0.299 * (n >> 16 & 255) + 0.587 * (n >> 8 & 255) + 0.114 * (n & 255) > 150 ? NEGRO : BLANCO;
  }

  // Mide y acomoda el bloque. Lo usan el dibujo y el arrastre del editor.
  function cajaTexto(s, ctx) {
    const tx = s.texto || {};
    const contenido = String(tx.contenido || '').trim();
    if (!contenido) return null;
    ctx = ctx || medidor || (medidor = document.createElement('canvas').getContext('2d'));
    const estilo = tx.estilo || 'limpio', t = tx.tam || 64;
    let c;
    ctx.save();
    if (estilo === 'ventana') {
      const fs = tamNota(t);
      ctx.font = f95(fs); ctx.wordSpacing = ESPACIO;
      const lineas = partir(ctx, contenido, ANCHO_MAX - 16 - 2 * NOTA_PAD);
      const anchos = lineas.map(l => ctx.measureText(l).width);
      const lh = Math.round(fs * 1.25);
      const w = Math.min(ANCHO_MAX, Math.max(460, Math.ceil(Math.max(...anchos)) + 16 + 2 * NOTA_PAD));
      c = { estilo, fs, lineas, anchos, lh, w, h: NOTA_ARRIBA + 8 + 2 * NOTA_PAD + lineas.length * lh + 6 };
    } else {
      ctx.font = fuenteLibre(t); ctx.wordSpacing = '0px';
      const relleno = estilo === 'etiqueta' ? Math.round(t * 0.3) : 0;
      const lineas = partir(ctx, contenido, ANCHO_MAX - 2 * relleno);
      const anchos = lineas.map(l => ctx.measureText(l).width);
      const alto = estilo === 'etiqueta' ? Math.round(t * 1.22) : Math.round(t * 1.1);
      const hueco = estilo === 'etiqueta' ? Math.round(t * 0.08) : 0;
      c = { estilo, t, lineas, anchos, relleno, alto, hueco, lh: alto + hueco,
        w: Math.ceil(Math.max(...anchos)) + 2 * relleno, h: lineas.length * (alto + hueco) - hueco };
    }
    ctx.restore();
    c.alinear = tx.alinear || 'izq';
    c.color = tx.color || BLANCO;
    c.x = Math.round(Math.min(Math.max(MARGEN, (tx.x ?? 0.5) * W - c.w / 2), Math.max(MARGEN, W - MARGEN - c.w)));
    c.y = Math.round(Math.min(Math.max(MARGEN, (tx.y ?? 0.8) * REPRO_Y - c.h / 2), Math.max(MARGEN, REPRO_Y - MARGEN - c.h)));
    return c;
  }

  // Cuánto se recorre una línea dentro de su espacio según la alineación.
  const corrimiento = (alinear, espacio, ancho) =>
    alinear === 'centro' ? (espacio - ancho) / 2 : alinear === 'der' ? espacio - ancho : 0;

  function textoLibre(ctx, s, a) {
    const c = cajaTexto(s, ctx);
    if (!c) return;
    ctx.save();
    ctx.textAlign = 'left';
    if (c.estilo === 'ventana') {
      // Un Bloc de notas de Windows 95 con el texto adentro.
      ctx.fillStyle = GRIS; ctx.fillRect(c.x, c.y, c.w, c.h);
      marco(ctx, c.x, c.y, c.w, c.h, VENTANA);
      barraTitulo(ctx, c.x + 6, c.y + 6, c.w - 12, 36, a.notas, NOTA_TITULO);
      menu(ctx, ['Archivo', 'Edición', 'Buscar', 'Ayuda'], c.x + 14, c.y + 69);
      const px = c.x + 4, py = c.y + NOTA_ARRIBA, pw = c.w - 8, ph = c.h - NOTA_ARRIBA - 6;
      ctx.fillStyle = BLANCO; ctx.fillRect(px, py, pw, ph);
      marco(ctx, px, py, pw, ph, HUNDIDO);
      ctx.font = f95(c.fs); ctx.fillStyle = NEGRO; ctx.textBaseline = 'top';
      const espacio = pw - 8 - 2 * NOTA_PAD;
      c.lineas.forEach((l, i) => ctx.fillText(l,
        Math.round(px + 4 + NOTA_PAD + corrimiento(c.alinear, espacio, c.anchos[i])), py + 4 + NOTA_PAD + i * c.lh));
    } else {
      ctx.wordSpacing = '0px';
      ctx.font = fuenteLibre(c.t); ctx.textBaseline = 'alphabetic';
      const espacio = c.w - 2 * c.relleno;
      if (c.estilo === 'etiqueta') {
        // Un cuadro por línea, como los subtítulos pegados.
        ctx.fillStyle = c.color;
        c.lineas.forEach((l, i) => ctx.fillRect(
          Math.round(c.x + corrimiento(c.alinear, espacio, c.anchos[i])), c.y + i * c.lh,
          Math.ceil(c.anchos[i]) + 2 * c.relleno, c.alto));
        ctx.fillStyle = contraste(c.color);
      } else {
        const oscuro = contraste(c.color) === NEGRO;     // letra clara: sombra oscura, y al revés
        ctx.shadowColor = oscuro ? 'rgba(0,0,0,.6)' : 'rgba(255,255,255,.55)';
        ctx.shadowBlur = Math.round(c.t * 0.2); ctx.shadowOffsetY = 3;
        ctx.fillStyle = c.color;
      }
      const base = c.estilo === 'etiqueta' ? Math.round(c.alto / 2 + c.t * 0.36) : Math.round(c.t * 0.9);
      c.lineas.forEach((l, i) => ctx.fillText(l,
        Math.round(c.x + c.relleno + corrimiento(c.alinear, espacio, c.anchos[i])), c.y + i * c.lh + base));
    }
    ctx.restore();
  }

  function logo(ctx, s, a, x, y, lado) {
    marco(ctx, x, y, lado, lado, HUNDIDO);
    const ix = x + 2 * P, iy = y + 2 * P, il = lado - 4 * P;
    ctx.fillStyle = NEGRO; ctx.fillRect(ix, iy, il, il);
    if (a.logo) {
      const esc = Math.max(il / a.logo.naturalWidth, il / a.logo.naturalHeight);
      const dw = a.logo.naturalWidth * esc, dh = a.logo.naturalHeight * esc;
      ctx.save(); ctx.beginPath(); ctx.rect(ix, iy, il, il); ctx.clip();
      ctx.drawImage(a.logo, ix + (il - dw) / 2, iy + (il - dh) / 2, dw, dh);
      ctx.restore();
      return;
    }
    // Sin imagen: el cuadro negro con el nombre en letras blancas.
    const lineas = String(s.logoTexto || '').split('\n').map(l => l.trim()).filter(Boolean);
    if (!lineas.length) return;
    let t = 22;
    ctx.font = f95(t, true);
    while (t > 10 && (Math.max(...lineas.map(l => ctx.measureText(l).width)) > il - 14 || lineas.length * t * 1.15 > il - 14)) {
      t--; ctx.font = f95(t, true);
    }
    const lh = Math.round(t * 1.15), alto = lineas.length * lh;
    ctx.fillStyle = BLANCO; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
    lineas.forEach((l, i) => ctx.fillText(l, ix + 7, iy + Math.round((il - alto) / 2) + i * lh));
  }

  function botonEscuchar(ctx, x, y, w, h, texto) {
    ctx.fillStyle = NEGRO; ctx.fillRect(x, y, w, h);              // borde del botón por defecto
    ctx.fillStyle = GRIS; ctx.fillRect(x + P, y + P, w - 2 * P, h - 2 * P);
    marco(ctx, x + P, y + P, w - 2 * P, h - 2 * P, BOTON);
    // Rectángulo punteado del foco
    const fx = x + 5 * P, fy = y + 5 * P, fw = w - 10 * P, fh = h - 10 * P;
    ctx.fillStyle = NEGRO;
    for (let i = 0; i < fw; i += 2 * P) { ctx.fillRect(fx + i, fy, P, P); ctx.fillRect(fx + i, fy + fh - P, P, P); }
    for (let j = 0; j < fh; j += 2 * P) { ctx.fillRect(fx, fy + j, P, P); ctx.fillRect(fx + fw - P, fy + j, P, P); }
    ctx.font = f95(22); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(cabe(ctx, texto, fw - 12), x + w / 2, y + h / 2 + 1);
    ctx.textAlign = 'left';
  }

  function reproductor(ctx, s, a) {
    const x = 0, y = REPRO_Y, w = W, h = REPRO_H;
    ctx.fillStyle = GRIS; ctx.fillRect(x, y, w, h);
    marco(ctx, x, y, w, h, VENTANA);
    barraTitulo(ctx, x + 6, y + 6, w - 12, 36, a.media, 'Sesión #' + s.numero + ' - ' + s.radio);

    const cy = y + 42;
    logo(ctx, s, a, x + 22, cy + 14, 128);

    const tx = x + 174, der = x + w - 22;
    const bw = 196, bh = 50, bx = der - bw, by = cy + 88;
    ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';

    let t = 33;
    ctx.font = f95(t, true);
    while (t > 18 && ctx.measureText(s.titulo || '').width > der - tx) { t--; ctx.font = f95(t, true); }
    ctx.fillStyle = AZUL; ctx.fillText(cabe(ctx, s.titulo || '', der - tx), tx, cy + 56);

    ctx.font = f95(22);
    ctx.fillStyle = '#404040';
    ctx.fillText(cabe(ctx, juntar([s.hashtag, fechaBonita(s.fecha), horaBonita(s.hora)]), bx - 16 - tx), tx, cy + 94);
    ctx.fillStyle = '#707070';
    ctx.fillText(cabe(ctx, s.vivo || '', bx - 16 - tx), tx, cy + 126);

    if (s.boton) botonEscuchar(ctx, bx, by, bw, bh, s.boton);
  }

  // La letra de 98.css trae el espacio muy angosto a 2×; se abre un poco
  // (donde el navegador lo soporta) para que respire como la de Windows.
  const ESPACIO = '4px';

  function dibujarPortada(ctx, s, a) {
    ctx.save();
    ctx.wordSpacing = ESPACIO;
    ctx.clearRect(0, 0, W, H);
    foto(ctx, s, a.foto);
    textoLibre(ctx, s, a);
    reproductor(ctx, s, a);
    barraTareas(ctx, s, a, { icono: a.media, texto: 'Sesión #' + s.numero });
    ctx.restore();
  }

  // ── Tracklist ──────────────────────────────────────────────────────────────
  const VEN = { x: 16, y: 14, w: W - 32, h: H - BARRA_H - 6 - 14 };
  const ESTADO_H = 38, ESTADO_Y = VEN.y + VEN.h - 54;
  const CONT = { x: VEN.x + 4, y: VEN.y + 80, w: VEN.w - 8, h: ESTADO_Y - 6 - (VEN.y + 80) };
  const LH = 26, ICONO = 64;

  function rejilla(s) {
    const n = s.tracks.length;
    const cols = +s.columnas || (n <= 16 ? 4 : n <= 25 ? 5 : 6);
    const filas = Math.max(1, Math.ceil(n / cols));
    const ix = CONT.x + 4, iy = CONT.y + 4, iw = CONT.w - 8, ih = CONT.h - 8;
    const arriba = 18;
    return { cols, ix, iy, iw, ih, arriba, colW: iw / cols, filaH: Math.min(280, (ih - arriba) / filas) };
  }

  function celdaEn(s, x, y) {
    const r = rejilla(s);
    const c = Math.floor((x - r.ix) / r.colW), f = Math.floor((y - r.iy - r.arriba) / r.filaH);
    if (c < 0 || c >= r.cols || f < 0 || x > r.ix + r.iw) return -1;
    const i = f * r.cols + c;
    return i < s.tracks.length ? i : -1;
  }

  // Para reconocer el mismo track aunque cambie de lugar (al pegar una lista
  // nueva conserva su ícono y su resaltado).
  const claveTrack = t => String(t.titulo || '').toLowerCase().replace(/\s+/g, ' ').trim();

  function iconoDe(t, s, a) {
    const id = t.icono || s.icono;
    if (id === 'propio') return a.iconoPropio || null;
    return global.iconosRadio.porId[id] || global.iconosRadio.porId.cuchillo;
  }

  function menu(ctx, items, x, y) {
    ctx.font = f95(22); ctx.fillStyle = NEGRO; ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    items.forEach(item => {
      ctx.fillText(item, x, y);
      ctx.fillRect(x, y + 3, Math.round(ctx.measureText(item[0]).width), P);  // la letra del atajo
      x += ctx.measureText(item).width + 24;
    });
  }

  function dibujarTracklist(ctx, s, a) {
    ctx.save();
    ctx.wordSpacing = ESPACIO;
    ctx.fillStyle = s.fondo || '#008080'; ctx.fillRect(0, 0, W, H);

    ctx.fillStyle = GRIS; ctx.fillRect(VEN.x, VEN.y, VEN.w, VEN.h);
    marco(ctx, VEN.x, VEN.y, VEN.w, VEN.h, VENTANA);
    barraTitulo(ctx, VEN.x + 6, VEN.y + 6, VEN.w - 12, 36, a.carpeta, 'Sesión #' + s.numero + ' - Tracklist');
    menu(ctx, ['Archivo', 'Edición', 'Ver', 'Ayuda'], VEN.x + 14, VEN.y + 69);

    ctx.fillStyle = BLANCO; ctx.fillRect(CONT.x, CONT.y, CONT.w, CONT.h);
    marco(ctx, CONT.x, CONT.y, CONT.w, CONT.h, HUNDIDO);

    const r = rejilla(s);
    const caben = Math.max(1, Math.floor((r.filaH - ICONO - 8 - 10) / LH));
    ctx.save();
    ctx.beginPath(); ctx.rect(r.ix, r.iy, r.iw, r.ih); ctx.clip();
    ctx.font = f95(22); ctx.textAlign = 'center'; ctx.textBaseline = 'alphabetic';
    s.tracks.forEach((t, i) => {
      const mx = Math.round(r.ix + r.colW * (i % r.cols) + r.colW / 2);
      const top = Math.round(r.iy + r.arriba + r.filaH * Math.floor(i / r.cols));
      const sel = !!t.resaltar;
      const icono = iconoDe(t, s, a);
      if (icono) pixeles(ctx, sel ? seleccionado(icono) : icono, mx - ICONO / 2, top, ICONO, ICONO);

      const ancho = r.colW - 18;
      const nombre = (s.numerar ? dos(i + 1) + ' ' : '') + (t.titulo || '');
      const conArtista = t.artista ? 1 : 0;
      const lt = recortar(ctx, partir(ctx, nombre, ancho), Math.max(1, Math.min(3, caben - conArtista)), ancho);
      const la = recortar(ctx, partir(ctx, t.artista, ancho), Math.max(0, Math.min(3, caben - lt.length)), ancho);

      let y = top + ICONO + 8;
      if (sel && lt.length) {
        const anchoSel = Math.max(...lt.map(l => ctx.measureText(l).width)) + 8;
        ctx.fillStyle = AZUL;
        ctx.fillRect(Math.round(mx - anchoSel / 2), y - 2, Math.round(anchoSel), lt.length * LH + 4);
      }
      ctx.fillStyle = sel ? BLANCO : NEGRO;
      lt.forEach(l => { ctx.fillText(l, mx, y + 19); y += LH; });
      ctx.fillStyle = OSCURO;
      y += 4;
      la.forEach(l => { ctx.fillText(l, mx, y + 19); y += LH; });
    });
    ctx.restore();

    // Barra de estado
    const p1 = { x: CONT.x, w: 198 }, p2 = { x: CONT.x + 206, w: CONT.w - 206 };
    marco(ctx, p1.x, ESTADO_Y, p1.w, ESTADO_H, PANEL);
    marco(ctx, p2.x, ESTADO_Y, p2.w, ESTADO_H, PANEL);
    ctx.font = f95(22); ctx.fillStyle = NEGRO; ctx.textAlign = 'left'; ctx.textBaseline = 'middle';
    ctx.fillText(cabe(ctx, s.tracks.length + ' objeto(s)', p1.w - 20), p1.x + 10, ESTADO_Y + ESTADO_H / 2 + 1);
    ctx.fillText(cabe(ctx, juntar([s.titulo, fechaBonita(s.fecha), horaBonita(s.hora)]), p2.w - 20), p2.x + 10, ESTADO_Y + ESTADO_H / 2 + 1);

    barraTareas(ctx, s, a, { icono: a.carpeta, texto: 'Sesión #' + s.numero + ' - Tracklist' });
    ctx.restore();
  }

  global.motorPortada = {
    W, H, REPRO_Y, fechaBonita, horaBonita, claveTrack,
    dibujarPortada, dibujarTracklist, medidasFoto, cajaTexto, celdaEn,
  };
}(window));
