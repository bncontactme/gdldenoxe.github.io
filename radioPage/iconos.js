// Íconos de 32×32 para el tracklist de la radio. Se pintan pixel por pixel con
// figuras (elipses, cajas, triángulos), al estilo de los de Windows 95: colores
// planos, luz arriba a la izquierda y contorno negro. Cada uno queda como un
// <canvas> de 32×32 que el motor dibuja al doble.
(function (global) {
  'use strict';

  const N = 32;

  // ── Figuras ────────────────────────────────────────────────────────────────
  // Reciben el centro del pixel (x + .5, y + .5). `caja` va en pixeles, inclusiva.
  const elipse = (cx, cy, rx, ry) => (x, y) => ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1;
  const circulo = (cx, cy, r) => elipse(cx, cy, r, r);
  const caja = (x0, y0, x1, y1) => (x, y) => x > x0 && x < x1 + 1 && y > y0 && y < y1 + 1;
  const triangulo = (ax, ay, bx, by, cx, cy) => (x, y) => {
    const d1 = (x - bx) * (ay - by) - (ax - bx) * (y - by);
    const d2 = (x - cx) * (by - cy) - (bx - cx) * (y - cy);
    const d3 = (x - ax) * (cy - ay) - (cx - ax) * (y - ay);
    return !((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0));
  };
  const union = (...fs) => (x, y) => fs.some(f => f(x, y));
  const resta = (a, b) => (x, y) => a(x, y) && !b(x, y);

  const nuevo = () => Array.from({ length: N }, () => new Array(N).fill(null));

  // Pinta donde `dentro` dice que sí. `color` puede ser una función del pixel
  // (para sombrear); si regresa null, borra (para hoyos).
  function pintar(g, dentro, color) {
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      const px = x + 0.5, py = y + 0.5;
      if (!dentro(px, py)) continue;
      const c = typeof color === 'function' ? color(px, py) : color;
      if (c !== undefined) g[y][x] = c;
    }
  }

  // Contorno de 1px por fuera de todo lo pintado.
  function contorno(g, color) {
    const marcar = [];
    for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
      if (g[y][x]) continue;
      if ((g[y - 1] && g[y - 1][x]) || (g[y + 1] && g[y + 1][x]) || g[y][x - 1] || g[y][x + 1]) marcar.push([x, y]);
    }
    marcar.forEach(([x, y]) => { g[y][x] = color || '#000'; });
  }

  function aCanvas(g) {
    const c = document.createElement('canvas');
    c.width = c.height = N;
    const ctx = c.getContext('2d');
    g.forEach((fila, y) => fila.forEach((col, x) => {
      if (!col) return;
      ctx.fillStyle = col;
      ctx.fillRect(x, y, 1, 1);
    }));
    return c;
  }

  // ── Los íconos ─────────────────────────────────────────────────────────────

  const SANGRE = '#ff0000', SANGRE_OSC = '#a00000';

  function cuchillo() {
    const g = nuevo();
    // u a lo largo (del mango a la punta), v a lo ancho (positivo hacia el filo).
    const bx = 3, by = 29, L = 36, k = Math.SQRT1_2;
    const uv = (x, y) => [((x - bx) - (y - by)) * k, ((x - bx) + (y - by)) * k];
    const lomo = u => (u < L - 5 ? -2.4 : -2.4 + 2.4 * ((u - (L - 5)) / 5) ** 2);
    const filo = u => (u < L - 14 ? 3 : 3 * (1 - ((u - (L - 14)) / 14) ** 2));

    pintar(g, (x, y) => { const [u, v] = uv(x, y); return u > 0.6 && u < 11 && Math.abs(v) <= (u < 1.8 ? 1.6 : 2.4); },
      (x, y) => {
        const [u, v] = uv(x, y);
        if ((Math.abs(u - 3.5) < 0.75 || Math.abs(u - 7.5) < 0.75) && Math.abs(v) < 0.75) return '#e0e0e0';
        return v < -0.9 ? '#b0b040' : v > 1.1 ? '#505000' : '#808000';
      });
    pintar(g, (x, y) => { const [u, v] = uv(x, y); return u >= 11 && u < 12.8 && Math.abs(v) <= 3; },
      (x, y) => (uv(x, y)[1] < 0 ? '#a0a0a0' : '#606060'));
    pintar(g, (x, y) => { const [u, v] = uv(x, y); return u >= 12.8 && u <= L && v >= lomo(u) && v <= filo(u); },
      (x, y) => {
        const [u, v] = uv(x, y);
        if (u > 22.5 + ((x * 5 + y * 3) % 4) * 0.7) return v > 1 ? SANGRE_OSC : SANGRE;
        return v < -1 ? '#ffffff' : v > 1.3 ? '#808080' : '#c0c0c0';
      });
    // Escurrimientos: bajan desde la sangre más baja de cada columna.
    [[21, 4], [24, 6], [27, 3]].forEach(([x, largo]) => {
      let fondo = -1;
      for (let y = 0; y < N; y++) if (g[y][x] === SANGRE || g[y][x] === SANGRE_OSC) fondo = y;
      if (fondo < 0) return;
      for (let i = 1; i <= largo && fondo + i < N; i++) g[fondo + i][x] = i === largo ? SANGRE : SANGRE_OSC;
    });
    contorno(g);
    return g;
  }

  function calabaza() {
    const g = nuevo();
    const cx = 16, cy = 18.5, rx = 14, ry = 10.5;
    pintar(g, union(caja(15, 4, 16, 9), elipse(20, 6.5, 3, 1.4)), (x) => (x < 16 ? '#00c000' : '#008000'));
    pintar(g, elipse(cx, cy, rx, ry), (x, y) => {
      const dx = x - cx, dy = (y - cy) / ry;
      const media = rx * Math.sqrt(Math.max(0, 1 - dy * dy));
      const gajo = [0.42, 0.78].some(t => Math.abs(Math.abs(dx) - t * media) < 0.6);
      if (gajo) return '#c05000';
      if (dx < -4 && dy < -0.1) return '#ffa040';
      if (dy > 0.6 || dx > 9) return '#d06000';
      return '#ff8000';
    });
    const cara = union(
      triangulo(8.5, 16.5, 13.5, 16.5, 11, 12),
      triangulo(18.5, 16.5, 23.5, 16.5, 21, 12),
      triangulo(14.5, 19.5, 17.5, 19.5, 16, 17.5),
      resta(elipse(16, 20.5, 9, 5.5), elipse(16, 18.6, 9.5, 4.6))
    );
    pintar(g, cara, '#000');
    pintar(g, union(caja(11, 22, 12, 22), caja(19, 22, 20, 22), caja(15, 25, 16, 25)), '#ff8000');
    contorno(g);
    return g;
  }

  function fantasma() {
    const g = nuevo();
    const base = x => 25.5 - 2.5 * Math.abs(Math.sin(((x - 5.5) / 21) * 3 * Math.PI));
    const cuerpo = union(
      circulo(16, 12.5, 10.5),
      (x, y) => x > 5.5 && x < 26.5 && y >= 12.5 && y <= base(x) + 2.5,
      elipse(4.8, 17, 2.6, 1.7),
      elipse(27.2, 15, 2.6, 1.7)
    );
    pintar(g, cuerpo, (x, y) => (x > 22.5 || y > base(x) + 1 ? '#c0c0c0' : '#ffffff'));
    pintar(g, union(elipse(12, 11, 1.8, 2.8), elipse(20, 11, 1.8, 2.8), elipse(16, 18, 2.1, 2.6)), '#000');
    pintar(g, union(caja(11, 9, 11, 9), caja(19, 9, 19, 9)), '#ffffff');
    contorno(g);
    return g;
  }

  function calavera() {
    const g = nuevo();
    const hueso = union(circulo(16, 12.5, 11), caja(10, 18, 21, 26), elipse(16, 26, 6, 2));
    pintar(g, hueso, (x, y) => (x > 21.5 || y > 26 ? '#c0c0a0' : '#ffffe8'));
    pintar(g, union(elipse(11.5, 14, 3.2, 3.6), elipse(20.5, 14, 3.2, 3.6), triangulo(16, 17.5, 14, 21.5, 18, 21.5)), '#000');
    pintar(g, union(caja(11, 14, 11, 14), caja(20, 14, 20, 14)), '#ff0000');
    pintar(g, union(caja(11, 23, 20, 23), (x, y) => y > 23 && y < 27 && [12, 14, 16, 18].includes(Math.floor(x)) ), '#000');
    contorno(g);
    return g;
  }

  function vinilo() {
    const g = nuevo();
    pintar(g, circulo(16, 16, 14.6), (x, y) => {
      const dx = x - 16, dy = y - 16, r = Math.hypot(dx, dy);
      if (r <= 1.3) return null;
      if (r <= 5.2) return dx + dy > 3 ? '#c00000' : '#ff0000';
      if (r <= 6.2) return '#202020';
      const ang = Math.atan2(dy, dx);
      const brillo = Math.abs(ang + Math.PI * 0.75) < 0.2 || Math.abs(ang - Math.PI * 0.25) < 0.2;
      const surco = Math.floor(r) % 2 === 0;
      if (brillo) return surco ? '#a0a0a0' : '#606060';
      return surco ? '#383838' : '#101010';
    });
    contorno(g);
    return g;
  }

  function cd() {
    const g = nuevo();
    pintar(g, circulo(16, 16, 14.6), (x, y) => {
      const dx = x - 16, dy = y - 16, r = Math.hypot(dx, dy);
      if (r <= 2.3) return null;
      if (r <= 3.4) return '#808080';
      if (r <= 5.4) return '#f0f0f0';
      if (r <= 6.3) return '#a0a0a0';
      // Arcoíris: dos bandas en diagonal, como el reflejo de un disco de verdad.
      const a = (Math.atan2(dy, dx) + Math.PI) / (2 * Math.PI);
      const d = Math.min(Math.abs(a - 0.125), Math.abs(a - 0.625));
      if (d < 0.025) return '#ffffff';
      if (d < 0.06) return a < 0.125 || (a > 0.5 && a < 0.625) ? '#80ffff' : '#ff80ff';
      if (d < 0.09) return '#ffff80';
      return '#c0c0c0';
    });
    contorno(g);
    return g;
  }

  function casete() {
    const g = nuevo();
    pintar(g, caja(1, 6, 30, 25), (x, y) => (y < 7 || x < 2 ? '#808080' : y > 25 || x > 30 ? '#202020' : '#404040'));
    pintar(g, caja(4, 8, 27, 18), '#ffffe0');
    pintar(g, caja(4, 8, 27, 9), '#ff8000');
    pintar(g, union(caja(6, 11, 16, 11), caja(18, 11, 24, 11)), '#000080');
    pintar(g, caja(9, 13, 22, 17), '#000');
    pintar(g, caja(13, 16, 18, 17), '#804000');
    pintar(g, union(circulo(11.5, 15.5, 2.2), circulo(20.5, 15.5, 2.2)), '#e0e0e0');
    pintar(g, union(caja(11, 15, 11, 15), caja(20, 15, 20, 15)), '#000');
    pintar(g, (x, y) => y > 20 && y < 26 && x > 9.5 - (y - 21) * 0.6 && x < 22.5 + (y - 21) * 0.6, '#606060');
    pintar(g, union(caja(10, 23, 11, 23), caja(20, 23, 21, 23)), '#000');
    pintar(g, union(caja(2, 7, 2, 7), caja(29, 7, 29, 7), caja(2, 24, 2, 24), caja(29, 24, 29, 24)), '#c0c0c0');
    contorno(g);
    return g;
  }

  function nota() {
    const g = nuevo();
    const cabeza = (cx, cy) => (x, y) => {
      const a = -0.35, dx = x - cx, dy = y - cy;
      const u = dx * Math.cos(a) + dy * Math.sin(a), v = -dx * Math.sin(a) + dy * Math.cos(a);
      return (u / 3.8) ** 2 + (v / 2.6) ** 2 <= 1;
    };
    const viga = (x, y) => x > 11 && x < 27 && y > 8 - (x - 12) * 0.2 - 0.1 && y < 11.6 - (x - 12) * 0.2;
    pintar(g, union(cabeza(9.5, 25), cabeza(22.5, 22), caja(12, 9, 13, 24), caja(25, 6, 26, 21), viga), '#000080');
    pintar(g, union(caja(7, 24, 8, 24), caja(20, 21, 21, 21), caja(12, 10, 12, 22), caja(25, 8, 25, 19)), '#4040ff');
    contorno(g);
    return g;
  }

  function corazon() {
    const g = nuevo();
    pintar(g, (x, y) => {
      const X = (x - 16) / 12.5, Y = 1.2 - (y - 2.5) / 12;
      return (X * X + Y * Y - 1) ** 3 - X * X * Y ** 3 <= 0;
    }, (x, y) => {
      if (elipse(10, 9, 2.6, 2)(x, y)) return '#ff9090';
      if (x - 16 + (y - 16) > 6) return '#c00000';
      return '#ff0000';
    });
    pintar(g, caja(9, 8, 9, 8), '#ffffff');
    contorno(g);
    return g;
  }

  function archivo() {
    const g = nuevo();
    const hoja = (x, y) => x > 6 && x < 26 && y > 2 && y < 30 && !(x > 20 && y < 8 && (x - 20) > (y - 2));
    pintar(g, hoja, (x, y) => (x > 25 || y > 29 ? '#c0c0c0' : '#ffffff'));
    pintar(g, triangulo(20, 2, 20, 8, 26, 8), '#c0c0c0');
    pintar(g, union(caja(9, 6, 17, 6), caja(9, 9, 15, 9)), '#808080');
    pintar(g, union(elipse(13.5, 23.5, 3, 2.2), caja(16, 12, 16, 23), caja(17, 12, 18, 13), caja(19, 14, 19, 16), caja(18, 17, 18, 17)), '#000');
    contorno(g);
    return g;
  }

  const LISTA = [
    ['cuchillo', 'Cuchillo', cuchillo],
    ['calabaza', 'Calabaza', calabaza],
    ['fantasma', 'Fantasma', fantasma],
    ['calavera', 'Calavera', calavera],
    ['vinilo', 'Vinilo', vinilo],
    ['cd', 'CD', cd],
    ['casete', 'Casete', casete],
    ['nota', 'Nota', nota],
    ['corazon', 'Corazón', corazon],
    ['archivo', 'Archivo', archivo],
  ].map(([id, nombre, hacer]) => ({ id, nombre, canvas: aCanvas(hacer()) }));

  global.iconosRadio = { N, lista: LISTA, porId: Object.fromEntries(LISTA.map(i => [i.id, i.canvas])) };
}(window));
