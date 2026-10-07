// Globazo!! — globos de agua estilo Win95 para el escritorio de GDLDENOXE.
//
// Corre solo (globos/index.html) o dentro de un iframe: el widget "Globos"
// del escritorio. El fondo es liso: es de relleno.
//
// Por dentro es de maquinita, con los colores y biseles de Win95: pantalla
// de inicio con la cabeza y el nombre parpadeando, la ronda de 60 s y al
// final la ronda bonus de inflar la cabeza a puro botonazo, como la de los
// Simpsons de Konami.
(function () {
    'use strict';

    // ── Ajustes para afinar ───────────────────────────────────────────────
    var NOMBRE = 'Globazo!!';
    var TITULO = NOMBRE.toUpperCase();
    var SUBTITULO = 'EL AGUA LIMPIA ES DE TODXS';   // en rojo, abajo de la cabeza
    var AJUSTES = {
        duracion: 60,         // segundos por ronda
        gravedad: 1.7,        // × alto del campo por s² (se siente igual en cualquier tamaño)
        vueloMin: 0.18,       // s que tarda el globo en llegar a un punto cercano
        vueloPorAlto: 0.24,   // s extra por cada "campo" de distancia
        ayudaTactil: 1.35,    // con el dedo se apunta peor: salpicón más grande
        ventanaCombo: 0.7     // s entre aciertos para que siga el combo
    };
    var BONUS = {
        duracion: 10,         // segundos para tronarla
        porBombazo: 0.045,    // lo que infla cada toque (de 0 a 1)
        fuga: 0.05,           // lo que se desinfla por segundo...
        fugaExtra: 0.12,      // ...y más entre más inflada: hay que darle rápido
        premioTrono: 300,     // si truena
        porSegundo: 50,       // más esto por cada segundo que sobre
        premioMax: 150        // si no truena: proporcional a lo inflada
    };
    var FONDO = '#008080';    // de relleno: el fondo de verdad llega después
    var TAM = 32;             // lado de cada cosa, en pixeles del juego
    var ANCHO_TELEFONO = 260; // ancho del campo en el teléfono, en pixeles del juego
    var COSAS_TELEFONO = 1.55; // en el teléfono las cosas que se mojan van así de más grandes (el campo no cambia)

    // Cosas que salen. Para cambiarlas basta con otra imagen (con
    // transparencia) y sus puntos. Las que tienen `castigo` no se mojan: te
    // quitan puntos. Se dibujan a 32x32; las `nativo` van a su tamaño porque
    // traen letras (de tamaño normal, palabras enteras).
    var ICONOS = '../indexPage/indexImages/icons/';
    var TIPOS = [
        // El blanco principal: icono de 40x40 hecho de su foto de canal, con barra en los ojos
        { id: 'lemus',       src: 'cosas/lemus.png',                 puntos: 25, peso: 4, nativo: true },
        // Cybertruck de 40x40 en pixeles (paleta de Win95, contorno negro), hecha a mano en código
        { id: 'cybertruck',  src: 'cosas/cybertruck.png',            puntos: 20, peso: 3, nativo: true },
        // Carpeta manila de 44x33 (proporción de carpeta de verdad) con sello rojo de "CARPETAZO"
        { id: 'investigacion', src: 'cosas/carpetazo.png', puntos: 15, peso: 3, nativo: true },
        // Recibo con la orilla rota: "RECIBO / DE AGUA", gota y total en rojo (sin nombre de nadie)
        { id: 'recibo',      src: 'cosas/recibo.png',                puntos: 15, peso: 3 },
        // Letrero "SE RENTA" en tabla clavada a un palo, como los del Coyote (39x32)
        { id: 'se-renta',    src: 'cosas/se-renta.png',              puntos: 20, peso: 2, nativo: true },
        // La torta es lo único que queda de los iconos del escritorio
        { id: 'torta',       src: ICONOS + 'lonche-icon.png',        puntos: -25, peso: 0, castigo: true, grito: '¡La torta no!' },
        // Ventanita de 52x32 "⚠ AVISO: HACER ALGO / AL RESPECTO" con dos botones: este no se moja.
        { id: 'hacer-algo',  src: 'cosas/hacer-algo.png',            puntos: -25, peso: 0, castigo: true, nativo: true, grito: '¡Eso no!' }
    ];
    var LEMUS = TIPOS[0];
    var CASTIGOS = TIPOS.filter(function (t) { return t.castigo; });
    function porId(id) { return TIPOS.filter(function (t) { return t.id === id; })[0]; }

    // El globo, pixel por pixel. X contorno, b cuerpo,
    // d sombra, c brillo, w blanco.
    var GLOBO_MAPA = [
        '......XXXX......',
        '....XXbbbbXX....',
        '...XbbbbbbbbX...',
        '..XbbccbbbbbbX..',
        '..XbcwbbbbbbbX..',
        '.XbbcbbbbbbbbdX.',
        '.XbcbbbbbbbbddX.',
        '.XbcbbbbbbbbddX.',
        '.XbbbbbbbbbdddX.',
        '..XbbbbbbbbdbX..',
        '..XbbbbbbbddbX..',
        '...XbbbbbbdbX...',
        '....XXbbddXX....',
        '......XbdX......',
        '.......XX.......',
        '........X.......'
    ];
    var COLORES = [
        { b: '#0000ff', d: '#000080', c: '#00ffff' },
        { b: '#ff0000', d: '#800000', c: '#ff8080' },
        { b: '#00ff00', d: '#008000', c: '#c0ffc0' },
        { b: '#ffff00', d: '#808000', c: '#ffffc0' },
        { b: '#ff00ff', d: '#800080', c: '#ffc0ff' }
    ];

    function rand(a, b) { return a + Math.random() * (b - a); }
    function clamp(v, a, b) { return v < a ? a : v > b ? b : v; }

    function lienzoNuevo(w, h) {
        var c = document.createElement('canvas');
        c.width = w; c.height = h;
        return c;
    }

    // Trama de puntitos 50%: la "transparencia" de los 16 colores.
    function trama(color) {
        var c = lienzoNuevo(2, 2), x = c.getContext('2d');
        x.fillStyle = color; x.fillRect(0, 0, 1, 1); x.fillRect(1, 1, 1, 1);
        return c;
    }

    // ── Sprites ───────────────────────────────────────────────────────────
    COLORES.forEach(function (col) {
        var c = lienzoNuevo(16, 16), x = c.getContext('2d');
        var pal = { X: '#000', b: col.b, d: col.d, c: col.c, w: '#fff' };
        GLOBO_MAPA.forEach(function (fila, y) {
            for (var i = 0; i < fila.length; i++) {
                if (pal[fila[i]]) { x.fillStyle = pal[fila[i]]; x.fillRect(i, y, 1, 1); }
            }
        });
        col.sprite = c;
    });

    TIPOS.forEach(function (t) {
        t.ancho = t.alto = TAM;
        var img = new Image();
        img.onload = function () {
            var w = t.nativo ? img.naturalWidth : TAM, h = t.nativo ? img.naturalHeight : TAM;
            var seco = lienzoNuevo(w, h), s = seco.getContext('2d');
            // La torta viene más grande: se achica suave; los iconos van tal cual.
            s.imageSmoothingEnabled = !t.nativo && img.naturalWidth > TAM;
            s.drawImage(img, 0, 0, w, h);
            var mojado = lienzoNuevo(w, h), m = mojado.getContext('2d');
            m.drawImage(seco, 0, 0);
            m.globalCompositeOperation = 'source-atop';
            m.fillStyle = m.createPattern(trama('#0000ff'), 'repeat');
            m.fillRect(0, 0, w, h);
            m.fillStyle = '#fff';
            for (var i = 0; i < 6; i++) m.fillRect(rand(4, w - 4) | 0, rand(4, h - 4) | 0, 1, 2);
            t.ancho = w; t.alto = h;
            t.seco = seco; t.mojado = mojado;
        };
        img.src = t.src;
    });

    // ── Letras de maquinita: 5x7, cada renglón en un dígito base 32 ───────
    var FUENTE = {
        A: 'ehhvhhh', B: 'uhhuhhu', C: 'ehggghe', D: 'uhhhhhu', E: 'vgguggv', F: 'vgguggg',
        G: 'ehgnhhf', H: 'hhhvhhh', I: 'e44444e', J: '72222ic', K: 'hikokih', L: 'ggggggv',
        M: 'hrllhhh', N: 'hhpljhh', O: 'ehhhhhe', P: 'uhhuggg', Q: 'ehhhlid', R: 'uhhukih',
        S: 'fgge11u', T: 'v444444', U: 'hhhhhhe', V: 'hhhhha4', W: 'hhhllla', X: 'hha4ahh',
        Y: 'hha4444', Z: 'v1248gv',
        '0': 'ehjlphe', '1': '4c4444e', '2': 'eh1248v', '3': 'v2421he', '4': '26aiv22',
        '5': 'vgu11he', '6': '68guhhe', '7': 'v124888', '8': 'ehhehhe', '9': 'ehhf12c',
        '!': '4444404', '¡': '4044444', '?': 'eh12404', '¿': '4048ghe', '.': '00000cc',
        ',': '0000c48', ':': '0cc0cc0', '-': '000e000', '+': '044v440', '×': '0ha4ah0',
        '/': '11248gg', "'": '4480000', '(': '2488842', ')': '8422248', ' ': '0000000'
    };
    // Acentos: la letra de abajo más dos renglones encima
    var ACENTOS = { 'Á': ['A', '24'], 'É': ['E', '24'], 'Í': ['I', '24'], 'Ó': ['O', '24'], 'Ú': ['U', '24'], 'Ñ': ['N', 'dm'] };

    function anchoTexto(txt, s) { return String(txt).length * 6 * s - s; }
    function escalaQueQuepa(txt, ancho, max) {
        return clamp(Math.floor((ancho + 1) / (String(txt).length * 6)), 1, max);
    }

    // Una pasada de letras en un solo color (o un color por renglón)
    function capaTexto(txt, x, y, s, color) {
        for (var i = 0; i < txt.length; i++) {
            var ch = txt[i], acento = ACENTOS[ch];
            var glifo = FUENTE[acento ? acento[0] : ch] || FUENTE['?'];
            var gx = x + i * 6 * s;
            var filas = acento ? [[-2, acento[1][0]], [-1, acento[1][1]]] : [];
            for (var r = 0; r < 7; r++) filas.push([r, glifo[r]]);
            for (var k = 0; k < filas.length; k++) {
                var fila = filas[k][0], bits = parseInt(filas[k][1], 32);
                if (!bits) continue;
                ctx.fillStyle = typeof color === 'function' ? color(i, fila)
                    : typeof color === 'string' ? color : color[clamp(fila, 0, color.length - 1)];
                for (var c = 0; c < 5; c++) {
                    if (bits & (16 >> c)) ctx.fillRect(gx + c * s, y + fila * s, s, s);
                }
            }
        }
    }

    // Texto con contorno y sombra, centrado en x
    function pintarTexto(txt, x, y, s, color, contorno, sombra) {
        txt = String(txt).toUpperCase();
        x = Math.round(x - anchoTexto(txt, s) / 2); y = Math.round(y);
        var g = Math.max(1, Math.floor(s / 2));
        if (sombra) capaTexto(txt, x + g + 1, y + g + 1, s, sombra);
        if (contorno) {
            for (var dy = -g; dy <= g; dy += g) {
                for (var dx = -g; dx <= g; dx += g) if (dx || dy) capaTexto(txt, x + dx, y + dy, s, contorno);
            }
        }
        capaTexto(txt, x, y, s, color);
    }

    // ── Campo ─────────────────────────────────────────────────────────────
    // Se pinta en pixeles grandes: cada pixel del juego mide PX pixeles de
    // pantalla. W y H van en pixeles del juego.
    var campo = document.getElementById('campo');
    var lienzo = document.getElementById('lienzo');
    var ctx = lienzo.getContext('2d');
    var manchas = lienzoNuevo(0, 0), mctx = manchas.getContext('2d');
    var W = 0, H = 0, PX = 2, U = 1, RB = 8, ESC = 1, KC = 1;   // KC: escala de las cosas

    function redimensionar() {
        var cw = campo.clientWidth, ch = campo.clientHeight;
        if (!cw || !ch) { pausar(); return; }
        var px = Math.max(2, Math.floor(Math.min(cw, ch) / 220));
        var dpr = window.devicePixelRatio || 1;
        if (esTelefono) {
            // Teléfono: campo de unos ANCHO_TELEFONO de ancho, con cada pixel
            // del juego de un número entero de pixeles de la pantalla (3 a 5)
            px = Math.max(2, Math.round(dpr * cw / ANCHO_TELEFONO)) / dpr;
        }
        var w = Math.ceil(cw / px), h = Math.ceil(ch / px);
        if (w === W && h === H && px === PX) return;
        // Las manchas se quedan al maximizar o girar el teléfono.
        var viejas = null;
        if (manchas.width) {
            viejas = lienzoNuevo(manchas.width, manchas.height);
            viejas.getContext('2d').drawImage(manchas, 0, 0);
        }
        PX = px; W = w; H = h; U = Math.min(W, H) / 100;
        // En el teléfono el lienzo va a la resolución de la pantalla (ESC
        // pixeles por pixel del juego) para que las cosas puedan ir más
        // grandes que el campo y seguir nítidas: cada pixel de una cosa mide
        // un número entero de pixeles de la pantalla. En la compu, todo igual.
        ESC = esTelefono ? Math.max(1, Math.round(px * dpr)) : 1;
        KC = esTelefono ? Math.round(COSAS_TELEFONO * ESC) / ESC : 1;
        lienzo.width = W * ESC; lienzo.height = H * ESC;
        lienzo.style.width = W * PX + 'px'; lienzo.style.height = H * PX + 'px';
        manchas.width = W; manchas.height = H;
        ctx.imageSmoothingEnabled = false;
        mctx.imageSmoothingEnabled = false;
        if (viejas) mctx.drawImage(viejas, 0, 0, W, H);
    }

    // ── Estado ────────────────────────────────────────────────────────────
    // 'titulo' → 'jugando' → 'bonusIntro' → 'bonus' → 'bonusFin' → 'fin'
    var cosas = [], globos = [], particulas = [], anillos = [], pendientes = [];
    var estado = 'titulo', estadoT = 0;
    var reloj = 0, jugado = 0, restante = AJUSTES.duracion, proxima = 0.4;
    var puntos = 0, combo = 0, ultimoAcierto = -9, sacudida = 0, caraMalaHasta = 0, flash = 0;
    var stats = { tirados: 0, aciertos: 0, malos: 0, mejorCombo: 0 };
    var modo = 'tocar', mudo = false, recordNuevo = false, menuAbierto = false;
    var bonus = { inflado: 0, resta: 0, bombeo: 0, trono: false, ganado: 0, toques: 0, ultimo: -1e9 };
    var conDedo = window.matchMedia && matchMedia('(pointer: coarse)').matches;
    // Lo que cambia el juego (escala y cuántas cosas salen) se decide una vez,
    // al cargar; conDedo sigue al último toque y solo cambia los letreros.
    var esTelefono = conDedo;

    function cambiar(nuevo) { estado = nuevo; estadoT = 0; }
    function enPartida() { return estado !== 'titulo' && estado !== 'instrucciones' && estado !== 'fin'; }

    function congelado() {
        return enPartida() && (menuAbierto || !dlg.hidden);
    }

    function elegirTipo() {
        var d = clamp(jugado / AJUSTES.duracion, 0, 1);
        if (jugado > 8 && Math.random() < 0.05 + d * 0.08) {
            var malos = CASTIGOS.filter(function (t) { return t.seco; });
            if (malos.length) return malos[Math.floor(Math.random() * malos.length)];
        }
        var listos = TIPOS.filter(function (t) { return t.seco && t.peso; });
        if (!listos.length) return null;
        var total = 0, i;
        for (i = 0; i < listos.length; i++) total += listos[i].peso;
        var x = Math.random() * total;
        for (i = 0; i < listos.length; i++) { x -= listos[i].peso; if (x <= 0) return listos[i]; }
        return listos[0];
    }

    // Sale desde abajo del campo en parábola, como en Fruit Ninja.
    // Sale a lo ancho, entera (la carpeta y el aviso miden 54 y 52) y con
    // aire respecto a las que van saliendo, para que no se encimen y un
    // globo no moje la torta de rebote.
    function lugarDeSalida(tipo) {
        var min = tipo.ancho * KC / 2 + 2, max = W - tipo.ancho * KC / 2 - 2;
        if (max <= min) return W / 2;
        var recien = cosas.filter(function (c) { return !c.mojado && c.y > H * 0.55; });
        var mejor = 0, holgura = -Infinity;
        for (var i = 0; i < 10; i++) {
            var x = rand(min, max), h = Infinity;
            recien.forEach(function (c) { h = Math.min(h, Math.abs(c.x - x) - (c.tipo.ancho + tipo.ancho) * KC / 2); });
            if (h >= 6) return x;
            if (h > holgura) { holgura = h; mejor = x; }
        }
        return mejor;
    }

    function lanzarCosa(tipo) {
        if (!tipo || !tipo.seco) return;
        var g = H * AJUSTES.gravedad * (tipo.rapida ? 1.35 : 1);
        var x = lugarDeSalida(tipo);
        var y = H + tipo.alto * KC / 2 + 2;
        var subida = y - H * (0.1 + Math.random() * 0.42);
        var tAire = 2 * Math.sqrt(2 * subida / g);
        // Cada una se va de lado poquito desde donde salió, sin cruzarse todas al centro
        var destino = clamp(x + W * rand(-0.25, 0.25), tipo.ancho * KC / 2, W - tipo.ancho * KC / 2);
        cosas.push({
            tipo: tipo, x: x, y: y, r: (tipo.ancho + tipo.alto) * KC / 2 * 0.42, g: g,
            vx: (destino - x) / tAire, vy: -Math.sqrt(2 * g * subida),
            mojado: false, volteo: 0, goteo: 0
        });
    }

    function lanzarOla() {
        var d = clamp(jugado / AJUSTES.duracion, 0, 1);
        var n = 1 + Math.floor(Math.random() * (1.8 + d * 3));
        // En el teléfono el campo es angosto: menos a la vez para que quepan
        if (esTelefono) n = Math.min(n, Math.max(2, Math.floor(W / 55)));
        for (var i = 0; i < n; i++) pendientes.push({ t: i === 0 ? 0 : rand(0.05, 0.35), tipo: elegirTipo() });
        proxima = (1.4 - d * 0.7) * rand(0.8, 1.2);
    }

    // ── Tirar globos ──────────────────────────────────────────────────────
    function tirarGlobo(x0, y0, x1, y1, tactil) {
        if (globos.length > 24) return;
        var dist = Math.hypot(x1 - x0, y1 - y0);
        globos.push({
            x0: x0, y0: y0, x1: x1, y1: y1, t: 0,
            dur: AJUSTES.vueloMin + AJUSTES.vueloPorAlto * dist / H,
            arco: Math.min(dist * 0.22, H * 0.14),
            color: COLORES[Math.floor(Math.random() * COLORES.length)], tactil: tactil
        });
        stats.tirados++;
        sonido('lanzar');
    }

    // Tocar: el globo sale de abajo hacia donde tocaste.
    function tirarHacia(x, y, tactil) {
        tirarGlobo(W / 2 + (x - W / 2) * 0.55, H + 12, x, y, tactil);
    }

    function posGlobo(g) {
        var u = Math.min(g.t / g.dur, 1), e = 1 - (1 - u) * (1 - u);
        return {
            x: g.x0 + (g.x1 - g.x0) * e,
            y: g.y0 + (g.y1 - g.y0) * e - g.arco * 4 * u * (1 - u),
            s: 1.6 - 0.7 * e
        };
    }

    function reventar(g) {
        var x = g.x1, y = g.y1;
        // Con el dedo el salpicón mide al menos 22px de pantalla, aunque los
        // pixeles del juego sean más chicos en el teléfono
        var rs = g.tactil ? Math.max(RB * AJUSTES.ayudaTactil, 22 / PX) : RB;
        var tocados = cosas.filter(function (c) { return !c.mojado && Math.hypot(c.x - x, c.y - y) < c.r + rs; });
        salpicar(x, y, g.color, tocados.length ? 0.6 : 1);
        sonido('chapuzon');
        var buenos = 0;
        tocados.forEach(function (c) { mojar(c, x); if (!c.tipo.castigo) buenos++; });
        if (estado === 'jugando') {
            if (buenos) stats.aciertos++;
            if (buenos >= 2) {
                var bono = buenos === 2 ? 20 : buenos === 3 ? 50 : 100;
                puntos += bono;
                tip(x, y - TAM * 0.8, (buenos === 2 ? '¡Doble!' : buenos === 3 ? '¡Triple!' : '¡Mojada masiva!') + ' +' + bono, 'bonus');
            }
        }
    }

    function mojar(c, x) {
        c.mojado = true;
        var lado = c.x - x >= 0 ? 1 : -1;
        if (c.tipo.castigo) {
            // Se va brincando, ofendida.
            c.vy = -H * 0.9; c.vx = lado * W * 0.45;
            if (estado === 'jugando') {
                puntos = Math.max(0, puntos + c.tipo.puntos); combo = 0; stats.malos++;
                tip(c.x, c.y - c.r, c.tipo.grito + ' ' + c.tipo.puntos, 'malo');
            }
            sacudida = 3; caraMalaHasta = reloj + 0.8;
            sonido('torta'); vibrar(70);
            return;
        }
        c.vy = Math.max(c.vy, 0) + H * 0.15;
        c.vx += (c.x - x) * 4;
        if (estado !== 'jugando') { sonido('acierto', 1); return; }
        combo = reloj - ultimoAcierto < AJUSTES.ventanaCombo ? combo + 1 : 1;
        ultimoAcierto = reloj;
        stats.mejorCombo = Math.max(stats.mejorCombo, combo);
        var gana = Math.round(c.tipo.puntos * (1 + Math.min(combo - 1, 4) * 0.5));
        puntos += gana;
        tip(c.x, c.y - c.r, '+' + gana + (combo >= 2 ? '  ×' + combo : ''));
        sonido('acierto', combo); vibrar(12);
    }

    function salpicar(x, y, color, fuerza) {
        var n = Math.round(16 * fuerza) + 6, i;
        for (i = 0; i < n; i++) {
            var a = rand(0, Math.PI * 2), v = rand(0.3, 1) * U * 60;
            particulas.push({
                x: x, y: y, vx: Math.cos(a) * v, vy: Math.sin(a) * v - U * 25,
                lado: Math.random() < 0.3 ? 2 : 1, vida: rand(0.35, 0.7), t: 0,
                color: Math.random() < 0.4 ? color.b : Math.random() < 0.5 ? '#00ffff' : '#fff'
            });
        }
        for (i = 0; i < 4; i++) {
            var b = rand(0, Math.PI * 2), w = rand(0.5, 1) * U * 45;
            particulas.push({ x: x, y: y, vx: Math.cos(b) * w, vy: Math.sin(b) * w - U * 30, lado: 2, vida: 0.6, t: 0, color: color.d });
        }
        if (particulas.length > 600) particulas.splice(0, particulas.length - 600);
        anillos.push({ x: x, y: y, t: 0, vida: 0.25 });
        mancha(x, y, color.b, fuerza);
    }

    // La pared se queda manchada, en trama de puntitos: entre más globos,
    // más pintado queda el campo (y nunca lo tapa del todo).
    function mancha(x, y, color, fuerza) {
        x = Math.round(x); y = Math.round(y);
        var R = Math.round(RB * (0.7 + fuerza * 0.6));
        var gotas = [{ x: 0, y: 0, r: R }], i;
        for (i = 0; i < 6; i++) {
            var a = rand(0, Math.PI * 2), d = R * rand(0.9, 1.6);
            gotas.push({ x: Math.cos(a) * d, y: Math.sin(a) * d, r: R * rand(0.15, 0.35) });
        }
        mctx.fillStyle = color;
        var lim = Math.ceil(R * 2);
        for (var py = -lim; py <= lim; py++) {
            for (var px = -lim; px <= lim; px++) {
                if ((x + px + y + py) & 1) continue;
                for (i = 0; i < gotas.length; i++) {
                    var dx = px - gotas[i].x, dy = py - gotas[i].y;
                    if (dx * dx + dy * dy <= gotas[i].r * gotas[i].r) { mctx.fillRect(x + px, y + py, 1, 1); break; }
                }
            }
        }
        // Escurridos hacia abajo
        for (i = 0; i < 3; i++) {
            var cx = x + Math.round(rand(-R * 0.6, R * 0.6)), largo = Math.round(R * rand(0.8, 2.4));
            for (var k = 0; k < largo; k++) {
                if (!((cx + y + k) & 1)) mctx.fillRect(cx, y + k, 1, 1);
            }
        }
    }

    // ── Puntos que brincan (tooltips de Win95, en el DOM para que el texto
    //    salga nítido) ────────────────────────────────────────────────────
    var tips = document.getElementById('tips');
    function tip(x, y, txt, clase) {
        if (tips.childElementCount > 12) tips.firstChild.remove();
        var el = document.createElement('div');
        el.className = 'tip' + (clase ? ' ' + clase : '');
        el.textContent = txt;
        el.style.top = Math.max(Math.round(y * PX), 24) + 'px';
        el.addEventListener('animationend', function () { el.remove(); });
        tips.appendChild(el);
        // Los que traen nombre son largos: que no se salgan por la orilla
        var medio = el.offsetWidth / 2 + 2;
        el.style.left = clamp(Math.round(x * PX), medio, Math.max(medio, W * PX - medio)) + 'px';
    }

    // ── Ronda bonus: inflar la cabeza hasta que truene ────────────────────
    function empezarBonus() {
        cambiar('bonus');
        bonus.inflado = 0; bonus.resta = BONUS.duracion; bonus.bombeo = 0;
        bonus.trono = false; bonus.ganado = 0; bonus.toques = 0; bonus.ultimo = -1e9;
    }

    // Tope de bombazos por segundo: lo más que alcanza una persona. Así dos
    // dedos, dedo y tecla juntos o un autoclic no truenan la cabeza antes.
    var BOMBAZOS_MAX = 16;
    function bombear(cuando) {
        if (estado !== 'bonus') return;
        // Con la hora del toque mismo (e.timeStamp), no la de cuando el juego
        // lo atiende: en un aparato lento los toques llegan amontonados entre
        // cuadro y cuadro y aun así cuentan como lo que fueron
        var ya = typeof cuando === 'number' ? cuando : performance.now();
        if (ya - bonus.ultimo < 1000 / BOMBAZOS_MAX) return;
        bonus.ultimo = ya;
        bonus.inflado += BONUS.porBombazo * (1 - bonus.inflado * 0.35);
        bonus.bombeo = 1;
        bonus.toques++;
        var cab = cabezaBonus();
        for (var i = 0; i < 4; i++) {
            particulas.push({ x: cab.cx + rand(-4, 4), y: cab.nudo + rand(0, 3), vx: rand(-1, 1) * U * 15, vy: -rand(0.5, 1) * U * 30,
                              lado: Math.random() < 0.3 ? 2 : 1, vida: rand(0.15, 0.3), t: 0, color: Math.random() < 0.5 ? '#fff' : '#c0c0c0' });
        }
        sonido('bomba', bonus.inflado);
        if (bonus.inflado >= 1) tronar();
    }

    // Dónde va la cabeza en la ronda bonus (en pixeles del juego)
    // La bomba y la cabeza se acomodan en un alto de a lo más 1.6 veces el
    // ancho; en teléfonos altos lo que sobra se reparte arriba y abajo, para
    // que no queden pegadas al piso con media pantalla vacía encima.
    function escenaBonus() {
        var h = Math.min(H, Math.round(W * 1.6));
        return { h: h, dy: Math.round((H - h) / 2) };
    }
    function cabezaBonus() {
        var esc = escenaBonus();
        var max = Math.min(W * 0.56, esc.h * 0.5) / LEMUS.alto;
        var s = 1 + clamp(bonus.inflado, 0, 1) * (max - 1);
        var cx = Math.round(W * 0.63), nudo = Math.round(esc.h * 0.8) + esc.dy;
        return { s: s, cx: cx, nudo: nudo, cy: nudo - LEMUS.alto * s / 2 - 2 };
    }

    function tronar() {
        if (bonus.trono) return;
        bonus.inflado = 1;
        bonus.trono = true;
        bonus.ganado = BONUS.premioTrono + BONUS.porSegundo * Math.ceil(bonus.resta);
        puntos += bonus.ganado;
        var cab = cabezaBonus(), i;
        for (i = 0; i < 110; i++) {
            var a = rand(0, Math.PI * 2), v = rand(0.3, 1) * U * 110;
            particulas.push({
                x: cab.cx + Math.cos(a) * LEMUS.alto * cab.s * 0.3, y: cab.cy + Math.sin(a) * LEMUS.alto * cab.s * 0.3,
                vx: Math.cos(a) * v, vy: Math.sin(a) * v - U * 40, lado: Math.random() < 0.4 ? 2 : 1,
                vida: rand(0.5, 1.1), t: 0,
                color: ['#0000ff', '#00ffff', '#fff', '#e0a080', '#c07050'][Math.floor(Math.random() * 5)]
            });
        }
        for (i = 0; i < 9; i++) {
            mancha(cab.cx + rand(-1, 1) * LEMUS.alto * cab.s * 0.6, cab.cy + rand(-1, 1) * LEMUS.alto * cab.s * 0.5,
                   i % 2 ? '#0000ff' : '#00ffff', 1.6);
        }
        anillos.push({ x: cab.cx, y: cab.cy, t: 0, vida: 0.4 });
        sacudida = 7; flash = 1;
        sonido('trueno'); vibrar(250);
        cambiar('bonusFin');
    }

    // ── Entrada: mouse y dedo con Pointer Events ──────────────────────────
    var dedos = {};
    function aJuego(e) {
        var r = lienzo.getBoundingClientRect();
        return { x: (e.clientX - r.left) / PX, y: (e.clientY - r.top) / PX };
    }
    lienzo.addEventListener('pointerdown', function (e) {
        e.preventDefault();
        cerrarMenus();
        desbloquearAudio();
        if (congelado()) return;
        var tactil = e.pointerType !== 'mouse';
        conDedo = tactil;
        if (estado === 'titulo') { mostrarInstrucciones(); return; }
        if (estado === 'instrucciones') { if (estadoT > 0.4) empezar(); return; }
        if (estado === 'bonus') { bombear(e.timeStamp); return; }
        if (estado !== 'jugando') return;
        var p = aJuego(e);
        dedos[e.pointerId] = { x0: p.x, y0: p.y, pts: [{ x: p.x, y: p.y, t: performance.now() }], tactil: tactil };
        if (modo === 'tocar') tirarHacia(p.x, p.y, tactil);
    });
    lienzo.addEventListener('pointermove', function (e) {
        var d = dedos[e.pointerId];
        if (!d) return;
        var p = aJuego(e);
        d.pts.push({ x: p.x, y: p.y, t: performance.now() });
        if (d.pts.length > 8) d.pts.shift();
    });
    function soltar(e) {
        var d = dedos[e.pointerId];
        delete dedos[e.pointerId];
        if (!d || modo !== 'deslizar' || estado !== 'jugando' || e.type === 'pointercancel' || congelado()) return;
        var p = aJuego(e);
        var movido = Math.hypot(p.x - d.x0, p.y - d.y0);
        if (movido < 10) { tirarHacia(p.x, p.y, d.tactil); return; }
        // Deslizar: el globo sale de donde empezó el dedo, en esa dirección,
        // y llega más lejos entre más rápido el gesto.
        var ahora = performance.now(), q = d.pts[0];
        for (var i = d.pts.length - 1; i >= 0; i--) { if (ahora - d.pts[i].t > 100) { q = d.pts[i]; break; } }
        var dt = Math.max((ahora - q.t) / 1000, 0.016);
        var vel = Math.hypot(p.x - q.x, p.y - q.y) / dt;
        var dx = (p.x - d.x0) / movido, dy = (p.y - d.y0) / movido;
        var largo = clamp(vel * 0.3, movido, Math.hypot(W, H) * 0.9);
        tirarGlobo(d.x0, d.y0, clamp(d.x0 + dx * largo, 4, W - 4), clamp(d.y0 + dy * largo, 4, H - 4), d.tactil);
    }
    lienzo.addEventListener('pointerup', soltar);
    lienzo.addEventListener('pointercancel', soltar);
    lienzo.addEventListener('contextmenu', function (e) { e.preventDefault(); });

    // ── Sonido: sintetizado, nada que bajar ───────────────────────────────
    var actx = null, ruido = null;
    function desbloquearAudio() {
        if (!actx) {
            var AC = window.AudioContext || window.webkitAudioContext;
            if (!AC) return;
            actx = new AC();
            ruido = actx.createBuffer(1, actx.sampleRate, actx.sampleRate);
            var d = ruido.getChannelData(0);
            for (var i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
        }
        if (actx.state === 'suspended') actx.resume();
    }
    function env(g, t, pico, ataque, caida) {
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(pico, t + ataque);
        g.gain.exponentialRampToValueAtTime(0.0001, t + ataque + caida);
    }
    // Una nota cuadrada de maquinita
    function nota(t, frec, dur, vol) {
        var o = actx.createOscillator(), g = actx.createGain();
        o.type = 'square'; o.frequency.value = frec;
        env(g, t, vol || 0.06, 0.01, dur);
        o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + 0.05);
    }
    function sonido(cual, n) {
        if (!actx || mudo) return;
        var t = actx.currentTime, s, f, g, o;
        if (cual === 'lanzar') {
            s = actx.createBufferSource(); s.buffer = ruido;
            f = actx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
            f.frequency.setValueAtTime(500, t); f.frequency.exponentialRampToValueAtTime(2600, t + 0.16);
            g = actx.createGain(); env(g, t, 0.08, 0.04, 0.14);
            s.connect(f); f.connect(g); g.connect(actx.destination); s.start(t, Math.random() * 0.5, 0.2);
        } else if (cual === 'chapuzon') {
            s = actx.createBufferSource(); s.buffer = ruido;
            f = actx.createBiquadFilter(); f.type = 'lowpass';
            f.frequency.setValueAtTime(2400, t); f.frequency.exponentialRampToValueAtTime(260, t + 0.35);
            g = actx.createGain(); env(g, t, 0.4, 0.005, 0.35);
            s.connect(f); f.connect(g); g.connect(actx.destination); s.start(t, Math.random() * 0.5, 0.4);
            o = actx.createOscillator(); o.type = 'square';
            o.frequency.setValueAtTime(900, t); o.frequency.exponentialRampToValueAtTime(140, t + 0.07);
            var g2 = actx.createGain(); env(g2, t, 0.08, 0.003, 0.07);
            o.connect(g2); g2.connect(actx.destination); o.start(t); o.stop(t + 0.1);
        } else if (cual === 'acierto') {
            var notas = [0, 2, 4, 7, 9, 12, 14, 16];
            nota(t + 0.03, 523 * Math.pow(2, notas[Math.min((n || 1) - 1, 7)] / 12), 0.12);
        } else if (cual === 'torta') {
            // El "chord" de error de Win95, más o menos
            nota(t, 220, 0.4); nota(t, 220 * Math.pow(2, 6 / 12), 0.4);
        } else if (cual === 'moneda') {
            // La moneda de las maquinitas: dos notas para arriba
            nota(t, 988, 0.06, 0.07); nota(t + 0.07, 1319, 0.3, 0.07);
        } else if (cual === 'arranque') {
            nota(t, 784, 0.08, 0.07); nota(t + 0.09, 1047, 0.08, 0.07); nota(t + 0.18, 1568, 0.25, 0.07);
        } else if (cual === 'tiempo') {
            nota(t, 196, 0.5, 0.08); nota(t, 185, 0.5, 0.05);
        } else if (cual === 'bonus') {
            [0, 4, 7, 12, 16, 19, 24].forEach(function (st, i) { nota(t + i * 0.07, 392 * Math.pow(2, st / 12), 0.1); });
        } else if (cual === 'bomba') {
            // Pff de la bomba, y el globo rechinando más agudo entre más inflado
            s = actx.createBufferSource(); s.buffer = ruido;
            f = actx.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 2;
            f.frequency.setValueAtTime(400, t); f.frequency.exponentialRampToValueAtTime(1200, t + 0.08);
            g = actx.createGain(); env(g, t, 0.12, 0.005, 0.08);
            s.connect(f); f.connect(g); g.connect(actx.destination); s.start(t, Math.random() * 0.5, 0.1);
            o = actx.createOscillator(); o.type = 'triangle';
            o.frequency.value = 300 + (n || 0) * 900;
            var g3 = actx.createGain(); env(g3, t, 0.04, 0.01, 0.06);
            o.connect(g3); g3.connect(actx.destination); o.start(t); o.stop(t + 0.1);
        } else if (cual === 'trueno') {
            s = actx.createBufferSource(); s.buffer = ruido;
            f = actx.createBiquadFilter(); f.type = 'lowpass';
            f.frequency.setValueAtTime(3500, t); f.frequency.exponentialRampToValueAtTime(90, t + 0.7);
            g = actx.createGain(); env(g, t, 0.7, 0.003, 0.7);
            s.connect(f); f.connect(g); g.connect(actx.destination); s.start(t, 0, 0.8);
            o = actx.createOscillator(); o.type = 'square';
            o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.3);
            var g4 = actx.createGain(); env(g4, t, 0.12, 0.003, 0.3);
            o.connect(g4); g4.connect(actx.destination); o.start(t); o.stop(t + 0.35);
            [0, 4, 7, 12].forEach(function (st, i) { nota(t + 0.45 + i * 0.09, 523 * Math.pow(2, st / 12), 0.15); });
        } else if (cual === 'fin') {
            [0, 4, 7, 12].forEach(function (st, i) { nota(t + i * 0.11, 392 * Math.pow(2, st / 12), 0.2); });
        }
    }
    function vibrar(ms) { try { if (navigator.vibrate) navigator.vibrate(ms); } catch (e) {} }

    // ── Ciclo ─────────────────────────────────────────────────────────────
    function actualizar(dt) {
        reloj += dt;
        estadoT += dt;

        if (estado === 'jugando') {
            jugado += dt;
            restante -= dt;
            proxima -= dt;
            if (proxima <= 0) lanzarOla();
            if (restante <= 0) {
                restante = 0;
                pendientes = [];
                cambiar('bonusIntro');
                sonido('tiempo');
                setTimeout(function () { if (estado === 'bonusIntro') sonido('bonus'); }, 900);
            }
        } else if (estado === 'bonusIntro') {
            // Al salir el letrero de la bonus, lo que quedaba volando se va
            if (estadoT > 1 && (cosas.length || globos.length)) { cosas = []; globos = []; }
            if (estadoT > 3) empezarBonus();
        } else if (estado === 'bonus') {
            bonus.resta -= dt;
            bonus.bombeo = Math.max(0, bonus.bombeo - dt * 8);
            bonus.inflado = Math.max(0, bonus.inflado - dt * (BONUS.fuga + bonus.inflado * BONUS.fugaExtra));
            if (bonus.resta <= 0) {
                bonus.resta = 0;
                bonus.ganado = Math.round(bonus.inflado * BONUS.premioMax);
                puntos += bonus.ganado;
                sonido('tiempo');
                cambiar('bonusFin');
            }
        } else if (estado === 'bonusFin') {
            if (estadoT > 3) terminar();
        }

        for (var i = pendientes.length - 1; i >= 0; i--) {
            pendientes[i].t -= dt;
            if (pendientes[i].t <= 0) { lanzarCosa(pendientes[i].tipo); pendientes.splice(i, 1); }
        }

        cosas = cosas.filter(function (c) {
            c.vy += c.g * dt; c.x += c.vx * dt; c.y += c.vy * dt;
            if (c.mojado) {
                c.volteo = Math.min(c.volteo + dt * 10, Math.PI);
                c.goteo -= dt;
                if (c.goteo <= 0) {
                    c.goteo = 0.06;
                    particulas.push({ x: c.x + rand(-c.r, c.r), y: c.y, vx: c.vx * 0.3, vy: c.vy * 0.5, lado: 1, vida: 0.5, t: 0, color: '#00ffff' });
                }
            }
            var fuera = c.vy > 0 && c.y > H + c.tipo.alto * KC;
            if (fuera && !c.mojado && !c.tipo.castigo && estado === 'jugando') combo = 0;
            return !fuera && c.x > -W && c.x < W * 2;
        });

        globos = globos.filter(function (g) {
            g.t += dt;
            if (g.t >= g.dur) { reventar(g); return false; }
            return true;
        });

        particulas = particulas.filter(function (p) {
            p.t += dt; p.vy += H * 1.2 * dt; p.x += p.vx * dt; p.y += p.vy * dt;
            return p.t < p.vida;
        });
        anillos = anillos.filter(function (a) { a.t += dt; return a.t < a.vida; });
        sacudida *= Math.pow(0.002, dt);
        flash = Math.max(0, flash - dt * 6);
    }

    // Círculo punteado, pixel por pixel (como el rectángulo de foco de Win95)
    function punteado(x, y, r, giro) {
        var n = Math.max(12, Math.round(r * 2.2));
        for (var i = 0; i < n; i += 2) {
            var a = i / n * Math.PI * 2 + giro;
            ctx.fillRect(Math.round(x + Math.cos(a) * r), Math.round(y + Math.sin(a) * r), 1, 1);
        }
    }

    // Colores de la bandera de Windows: el nombre los va rotando letra por
    // letra. Contorno negro y sombra gris, como todo lo demás de Win95.
    var BANDERA = ['#ff0000', '#00ff00', '#0000ff', '#ffff00'];
    function colorBandera(giro) { return function (i) { return BANDERA[(i + giro) % BANDERA.length]; }; }

    // ── Piezas de Win95 dibujadas en pixeles ──────────────────────────────
    // Realzado (botones, paneles): luz arriba a la izquierda, sombra abajo
    function realce(x, y, w, h, cara) {
        ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w - 1, h - 1);
        ctx.fillStyle = '#808080'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        ctx.fillStyle = cara || '#c0c0c0'; ctx.fillRect(x + 1, y + 1, w - 3, h - 3);
    }
    // Hundido (cajas como los contadores)
    function hundido(x, y, w, h, cara) {
        ctx.fillStyle = '#fff'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#808080'; ctx.fillRect(x, y, w - 1, h - 1);
        ctx.fillStyle = cara; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
    }
    // Barra de título azul de lado a lado, con su marco gris
    function banda(txt, y, s) {
        var alto = 7 * s + 8;
        realce(2, y - 2, W - 4, alto + 4);
        var g = ctx.createLinearGradient(4, 0, W - 4, 0);
        g.addColorStop(0, '#000080'); g.addColorStop(1, '#1084d0');
        ctx.fillStyle = g; ctx.fillRect(4, y, W - 8, alto);
        pintarTexto(txt, W / 2, y + 4, s, '#fff');
        return alto + 4;
    }
    // Panel gris con renglones en negro (el cuerpo de un cuadro de mensaje)
    function panel(lineas, y, s) {
        var ancho = 0;
        lineas.forEach(function (l) { ancho = Math.max(ancho, anchoTexto(l, s)); });
        var w = Math.min(W - 8, ancho + 14), alto = lineas.length * 10 * s - 3 * s + 12;
        realce(Math.round((W - w) / 2), y, w, alto);
        lineas.forEach(function (l, i) { pintarTexto(l, W / 2, y + 6 + i * 10 * s, s, '#000'); });
        return alto;
    }
    // Globito amarillo de ayuda (como los puntos que brincan)
    function globito(txt, y, s, color) {
        var w = anchoTexto(txt, s) + 8, h = 7 * s + 6, x = Math.round((W - w) / 2);
        ctx.fillStyle = '#000'; ctx.fillRect(x, y, w, h);
        ctx.fillStyle = '#ffffe1'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        pintarTexto(txt, W / 2, y + 3, s, color || '#000');
    }
    // Botón por defecto (con el borde negro de más)
    function boton(txt, y, s) {
        var w = anchoTexto(txt, s) + 18, h = 7 * s + 10, x = Math.round((W - w) / 2);
        ctx.fillStyle = '#000'; ctx.fillRect(x - 1, y - 1, w + 2, h + 2);
        realce(x, y, w, h);
        pintarTexto(txt, W / 2, y + 5, s, '#000');
    }
    // Contador de LED rojo, como los de arriba
    function led(txt, y, s) {
        var w = anchoTexto(txt, s) + 8, h = 7 * s + 6;
        hundido(Math.round((W - w) / 2), y, w, h, '#000');
        pintarTexto(txt, W / 2, y + 3, s, '#ff0000');
    }

    // Pantalla de inicio: el nombre parpadeando, la cabeza, el subtítulo en
    // rojo y el botón. Las letras entran una por una; luego el nombre prende
    // y apaga y los colores le van dando la vuelta.
    function dibujarIntro() {
        var s = escalaQueQuepa(TITULO, W - 12, 6);
        var k = Math.max(2, Math.floor(Math.min(W * 0.55, H * 0.36) / LEMUS.alto));
        var altoCabeza = LEMUS.alto * k;
        var ss = escalaQueQuepa(SUBTITULO, W - 12, 2), sub = [SUBTITULO];
        // En un renglón el subtítulo sale chiquito junto al título grande del
        // teléfono: si cabe al doble en dos renglones, va en dos
        if (ss < 2 && s >= 3) {
            var mitad = SUBTITULO.length / 2, corte = -1;
            SUBTITULO.split('').forEach(function (c, i) { if (c === ' ' && (corte < 0 || Math.abs(i - mitad) < Math.abs(corte - mitad))) corte = i; });
            var dos = [SUBTITULO.slice(0, corte), SUBTITULO.slice(corte + 1)];
            if (corte > 0 && escalaQueQuepa(dos[0], W - 12, 2) >= 2 && escalaQueQuepa(dos[1], W - 12, 2) >= 2) { sub = dos; ss = 2; }
        }
        var altoSub = sub.length * 10 * ss - 3 * ss;
        var aviso = conDedo ? 'TOCA PARA JUGAR' : 'HAZ CLIC PARA JUGAR';
        var sa = escalaQueQuepa(aviso, W - 30, 2);
        var bloque = 7 * s + 14 + altoCabeza + 10 + altoSub + 18 + 7 * sa + 10;
        var y = Math.round((H - bloque) / 2);

        var letras = Math.min(TITULO.length, Math.floor(estadoT / 0.11) + 1);
        var entrando = letras < TITULO.length;
        var fase = Math.floor(estadoT * 2.6);
        if (entrando || fase % 4 !== 3) {
            var visible = TITULO.slice(0, letras);
            var relleno = visible + TITULO.slice(letras).replace(/./g, ' ');
            var x = Math.round(W / 2 - anchoTexto(relleno, s) / 2 + anchoTexto(visible, s) / 2);
            pintarTexto(visible, x, y, s, colorBandera(entrando ? 0 : fase), '#000', '#808080');
        }
        y += 7 * s + 14;

        if (LEMUS.seco) {
            var brinco = Math.round(Math.sin(reloj * 3) * 2);
            ctx.drawImage(LEMUS.seco, Math.round(W / 2 - altoCabeza / 2), y + brinco, altoCabeza, altoCabeza);
        }
        y += altoCabeza + 10;

        sub.forEach(function (l, i) { pintarTexto(l, W / 2, y + i * 10 * ss, ss, '#ff0000', '#000'); });
        y += altoSub + 18;

        boton(aviso, y, sa);
    }

    // Win95: barra de progreso hundida con cuadritos azules
    function barraProgreso(x, y, w, h, valor) {
        ctx.fillStyle = '#808080'; ctx.fillRect(x, y, w, 1); ctx.fillRect(x, y, 1, h);
        ctx.fillStyle = '#fff'; ctx.fillRect(x, y + h - 1, w, 1); ctx.fillRect(x + w - 1, y, 1, h);
        ctx.fillStyle = '#c0c0c0'; ctx.fillRect(x + 1, y + 1, w - 2, h - 2);
        var dentro = w - 6, cuadros = Math.floor(dentro * clamp(valor, 0, 1) / 6);
        ctx.fillStyle = '#000080';
        for (var i = 0; i < cuadros; i++) ctx.fillRect(x + 3 + i * 6, y + 3, 5, h - 6);
    }

    // Pantalla de instrucciones: qué sí se moja (con sus puntos) y qué no.
    var BUENOS = ['lemus', 'cybertruck', 'se-renta', 'investigacion', 'recibo'];
    var MALOS = ['torta', 'hacer-algo'];
    // Cada fila va centrada, con el mismo aire entre icono e icono; los
    // iconos se centran en el alto de su fila y los puntos van en un mismo
    // renglón abajo. Si una fila no cabe, sus iconos van a la mitad.
    var MITAD = Math.ceil(BUENOS.length / 2);     // 5 → 3 + 2, 4 → 2 + 2
    var FILAS = [BUENOS.slice(0, MITAD), BUENOS.slice(MITAD), MALOS];
    // Letras de la pantalla al doble cuando el campo es ancho (teléfono, o la
    // ventana maximizada); en la ventana normal del escritorio, sencillas.
    function letraInstr() { return W >= 180 ? 2 : 1; }   // la ventana del escritorio mide 172
    // El mismo aire para todas las filas: el que deje caber a la más ancha
    function aireFilas() {
        var aire = 24 * letraInstr();
        FILAS.forEach(function (ids) {
            if (ids.length < 2) return;
            var suma = 0;
            ids.forEach(function (id) { suma += porId(id).ancho * KC; });
            aire = Math.min(aire, Math.floor((W - 8 - suma) / (ids.length - 1)));
        });
        return Math.max(6, aire);
    }
    function medidas(ids) {
        var aire = aireFilas();
        var tipos = ids.map(porId), total = aire * (ids.length - 1), alto = TAM;
        alto = TAM * KC;
        tipos.forEach(function (t) { total += t.ancho * KC; alto = Math.max(alto, t.alto * KC); });
        var k = total <= W - 4 ? 1 : 0.5;
        return { tipos: tipos, aire: aire * k, total: total * k, alto: Math.round(alto * k), k: k };
    }
    function altoFila(ids) { return medidas(ids).alto + 3 + 7 * letraInstr(); }   // iconos, aire y puntos
    function filaIconos(ids, y, color) {
        var m = medidas(ids), x = W / 2 - m.total / 2;
        m.tipos.forEach(function (t) {
            // Sin redondear el tamaño: cada pixel de la cosa sigue midiendo pixeles enteros de pantalla
            var w = t.ancho * KC * m.k, h = t.alto * KC * m.k, cx = Math.round(x + w / 2);
            if (t.seco) ctx.drawImage(t.seco, Math.round(cx - w / 2), y + Math.round((m.alto - h) / 2), w, h);
            pintarTexto((t.puntos > 0 ? '+' : '') + t.puntos, cx, y + m.alto + 3, letraInstr(), color, '#000');
            x += w + m.aire;
        });
        return m.alto + 3 + 7 * letraInstr();
    }
    // Tres medidas, de la más holgada a la más apretada; se usa la primera
    // que quepa. En la última se va la barra de título (teléfonos chaparros,
    // con las barras de Safari). El botón siempre va al final, nunca encima.
    var MEDIDAS_INSTR = [
        { barra: true,  E: 8, fila: 4, globo: 5 },
        { barra: true,  E: 4, fila: 1, globo: 3 },
        { barra: false, E: 3, fila: 1, globo: 2 }
    ];
    function dibujarInstrucciones() {
        var l1 = conDedo ? 'TOCA DONDE QUIERAS' : 'HAZ CLIC DONDE QUIERAS', l2 = 'QUE CAIGA EL GLOBO';
        var sT = letraInstr(), sP = escalaQueQuepa(l1, W - 22, sT);
        var altoGlobo = 7 * sT + 6, altoBoton = 7 * sT + 10, altoPanel = 17 * sP + 12;
        var sBarra = escalaQueQuepa('INSTRUCCIONES', W - 20, 2);
        var m, arriba, bloque;
        for (var i = 0; i < MEDIDAS_INSTR.length; i++) {
            m = MEDIDAS_INSTR[i];
            arriba = m.barra ? 6 + 7 * sBarra + 12 : 2;
            bloque = altoGlobo + m.globo + altoFila(FILAS[0]) + m.fila + altoFila(FILAS[1]) + m.E +
                     altoGlobo + m.globo + altoFila(FILAS[2]) + m.E + altoBoton;
            if (arriba + bloque + 2 * m.E <= H) break;
        }
        var conPanel = arriba + bloque + altoPanel + m.E + 2 * m.E <= H;
        if (conPanel) bloque += altoPanel + m.E;
        var y = 6;
        if (m.barra) y += banda('INSTRUCCIONES', y, sBarra);
        else y = arriba;
        // Centrado en lo que queda abajo de la barra
        y += Math.max(m.E, Math.round((H - y - bloque) / 2));
        globito('¡MÓJALOS!', y, sT); y += altoGlobo + m.globo;
        y += filaIconos(FILAS[0], y, '#fff') + m.fila;
        y += filaIconos(FILAS[1], y, '#fff') + m.E;
        globito('¡NO LOS MOJES!', y, sT, '#ff0000'); y += altoGlobo + m.globo;
        y += filaIconos(FILAS[2], y, '#ff0000') + m.E;
        if (conPanel) y += panel([l1, l2], y, sP) + m.E;
        boton('¡A JUGAR!', y, sT);
    }

    // La bomba, ahora sí de lámina: base con biselado, cilindro sombreado con
    // aros, manómetro con aguja, palanca con mangos
    // de hule y manguera gruesa con boquilla de latón. Todo se apachurra un
    // poquito con cada bombazo.
    var CILINDRO = ['#000', '#fff', '#dfdfdf', '#dfdfdf', '#c0c0c0', '#c0c0c0', '#c0c0c0', '#c0c0c0',
                    '#c0c0c0', '#a0a0a0', '#808080', '#808080', '#606060', '#404040', '#000'];
    function dibujarBomba() {
        var cab = cabezaBonus(), esc = escenaBonus();
        var suelo = esc.h - 6 + esc.dy, bx = Math.round(W * 0.2);
        // En el teléfono el campo es más ancho: la bomba va al doble para que
        // no se vea enana junto a la cabeza (escala entera: sigue nítida)
        var kb = W >= 190 ? 2 : 1;   // la ventana del escritorio mide 172
        var aEscala = function () { ctx.save(); ctx.translate(bx, suelo); ctx.scale(kb, kb); ctx.translate(-bx, -suelo); };
        var baja = Math.round(bonus.bombeo * 2);
        var baseY = suelo - 5, cilTop = baseY - 40 + baja;
        var palanca = cilTop - 18 + Math.round(bonus.bombeo * 14);
        var i, x, y;

        // Sombra en trama
        aEscala();
        ctx.fillStyle = '#000';
        for (y = 0; y < 3; y++) for (x = -18 + y * 2; x <= 18 - y * 2; x++) if ((x + y) & 1) ctx.fillRect(bx + x, suelo + y, 1, 1);
        ctx.restore();

        // Manguera gruesa: del pie de la bomba al nudo, colgando
        var x0 = bx + 9 * kb, y0 = suelo - (suelo - baseY + 3) * kb, x1 = cab.cx, y1 = cab.nudo + 4, mx = (x0 + x1) / 2, my = suelo + 3;
        var puntos = [];
        for (i = 0; i <= 80; i++) {
            var u = i / 80, a = (1 - u) * (1 - u), b = 2 * u * (1 - u), c = u * u;
            puntos.push([Math.round(a * x0 + b * mx + c * x1), Math.round(a * y0 + b * my + c * y1)]);
        }
        ctx.fillStyle = '#000'; puntos.forEach(function (p) { ctx.fillRect(p[0] - 1, p[1] - 1, 4, 4); });
        ctx.fillStyle = '#404040'; puntos.forEach(function (p) { ctx.fillRect(p[0], p[1], 2, 2); });
        ctx.fillStyle = '#808080'; puntos.forEach(function (p) { ctx.fillRect(p[0], p[1], 1, 1); });
        // Conector a la bomba
        aEscala();
        realce(bx + 6, baseY - 7, 6, 6, '#808080');

        // Varilla cromada
        var largo = cilTop - palanca;
        ctx.fillStyle = '#000'; ctx.fillRect(bx - 2, palanca, 5, largo);
        ctx.fillStyle = '#fff'; ctx.fillRect(bx - 1, palanca, 1, largo);
        ctx.fillStyle = '#c0c0c0'; ctx.fillRect(bx, palanca, 1, largo);
        ctx.fillStyle = '#808080'; ctx.fillRect(bx + 1, palanca, 1, largo);

        // Palanca: centro rojo, mangos de hule con estrías
        ctx.fillStyle = '#000'; ctx.fillRect(bx - 16, palanca - 4, 33, 7);
        ctx.fillStyle = '#ff8080'; ctx.fillRect(bx - 7, palanca - 3, 15, 1);
        ctx.fillStyle = '#ff0000'; ctx.fillRect(bx - 7, palanca - 2, 15, 3);
        ctx.fillStyle = '#800000'; ctx.fillRect(bx - 7, palanca + 1, 15, 1);
        [-15, 9].forEach(function (g) {
            ctx.fillStyle = '#404040'; ctx.fillRect(bx + g, palanca - 3, 7, 5);
            ctx.fillStyle = '#808080'; ctx.fillRect(bx + g, palanca - 3, 7, 1);
            ctx.fillStyle = '#000'; for (var k = 1; k < 7; k += 2) ctx.fillRect(bx + g + k, palanca - 2, 1, 4);
        });

        // Cilindro sombreado, columna por columna
        for (i = 0; i < CILINDRO.length; i++) {
            ctx.fillStyle = CILINDRO[i];
            ctx.fillRect(bx - 7 + i, cilTop, 1, baseY - cilTop);
        }
        // Aros de arriba y de abajo
        realce(bx - 9, cilTop - 2, 19, 5, '#808080');
        realce(bx - 9, baseY - 5, 19, 5, '#808080');

        // Manómetro: carátula blanca, rayitas, zona roja y la aguja
        var gx = bx - 15, gy = baseY - 17;
        ctx.fillStyle = '#808080'; ctx.fillRect(gx + 5, gy - 1, 4, 3);
        for (y = -7; y <= 7; y++) for (x = -7; x <= 7; x++) {
            var d = Math.sqrt(x * x + y * y);
            if (d <= 6.6) { ctx.fillStyle = d > 5.4 ? '#000' : d > 4.6 ? '#c0c0c0' : '#fff'; ctx.fillRect(gx + x, gy + y, 1, 1); }
        }
        for (i = 0; i <= 6; i++) {
            var ar = (135 + i * 45) * Math.PI / 180;
            ctx.fillStyle = i >= 5 ? '#ff0000' : '#000';
            ctx.fillRect(gx + Math.round(Math.cos(ar) * 4), gy + Math.round(Math.sin(ar) * 4), 1, 1);
        }
        var aguja = (135 + clamp(bonus.inflado, 0, 1) * 270) * Math.PI / 180;
        ctx.fillStyle = '#ff0000';
        for (i = 0; i <= 4; i++) ctx.fillRect(gx + Math.round(Math.cos(aguja) * i), gy + Math.round(Math.sin(aguja) * i), 1, 1);
        ctx.fillStyle = '#000'; ctx.fillRect(gx, gy, 1, 1);

        // Base de lámina con biselado y patitas
        realce(bx - 17, baseY, 35, 5);
        ctx.fillStyle = '#000'; ctx.fillRect(bx - 16, suelo, 5, 2); ctx.fillRect(bx + 12, suelo, 5, 2);
        ctx.restore();

        // La cabeza, inflándose; ya mero, tiembla
        if (!LEMUS.seco || bonus.trono) return;
        var tiembla = bonus.inflado > 0.75 ? Math.round(rand(-1, 1) * (bonus.inflado - 0.7) * 8) : 0;
        var apachurre = bonus.bombeo * 0.06;
        var lado = LEMUS.alto * cab.s, ancho = Math.round(lado * (1 + apachurre)), alto = Math.round(lado * (1 - apachurre));
        // Boquilla de latón y nudo
        ctx.fillStyle = '#000'; ctx.fillRect(cab.cx - 4, cab.nudo + 1, 9, 5);
        ctx.fillStyle = '#808000'; ctx.fillRect(cab.cx - 3, cab.nudo + 2, 7, 3);
        ctx.fillStyle = '#ffff00'; ctx.fillRect(cab.cx - 3, cab.nudo + 2, 7, 1);
        ctx.fillStyle = '#000'; ctx.fillRect(cab.cx - 3, cab.nudo - 2, 7, 4);
        ctx.fillStyle = '#c07050'; ctx.fillRect(cab.cx - 2, cab.nudo - 1, 5, 2);
        ctx.drawImage(LEMUS.seco, cab.cx - Math.round(ancho / 2) + tiembla, cab.nudo - alto - 2, ancho, alto);
        if (bonus.inflado > 0.85 && Math.floor(reloj * 12) % 2) {
            ctx.globalAlpha = 0.35;
            ctx.drawImage(LEMUS.mojado, cab.cx - Math.round(ancho / 2) + tiembla, cab.nudo - alto - 2, ancho, alto);
            ctx.globalAlpha = 1;
        }
    }

    function dibujarBonus() {
        var cx = W / 2;
        if (estado === 'bonusIntro') {
            if (estadoT < 1) {
                if (Math.floor(estadoT * 8) % 2 === 0) banda('¡TIEMPO!', Math.round(H * 0.4), escalaQueQuepa('¡TIEMPO!', W - 20, 4));
                return;
            }
            dibujarBomba();
            var y = 8;
            y += banda('RONDA BONUS', y, escalaQueQuepa('RONDA BONUS', W - 20, 3)) + 10;
            var linea1 = '¡INFLA LA CABEZA', linea2 = 'HASTA QUE TRUENE!';
            var s1 = escalaQueQuepa(linea2, W - 22, 2);
            y += panel([linea1, linea2], y, s1) + 10;
            var ayuda = conDedo ? '¡TOCA RÁPIDO!' : '¡CLIC O ESPACIO RÁPIDO!';
            if (Math.floor(estadoT * 3) % 2) globito(ayuda, y, escalaQueQuepa(ayuda, W - 16, 2));
            return;
        }

        dibujarBomba();
        barraProgreso(8, 6, W - 16, 12, bonus.inflado);
        led(String(Math.ceil(bonus.resta)).padStart(2, '0'), 24, 2);
        if (estado === 'bonus') {
            if (bonus.inflado > 0.8 && Math.floor(reloj * 6) % 2) globito('¡YA MERO!', 48, 2, '#ff0000');
            else if (estadoT < 1.5) globito(conDedo ? '¡TOCA!' : '¡DALE!', 48, 2);
            return;
        }

        // bonusFin
        var yf = Math.round(H * 0.3);
        if (bonus.trono) {
            var st = escalaQueQuepa('¡TRONÓ!', W - 12, 5);
            pintarTexto('¡TRONÓ!', cx, yf, st, colorBandera(Math.floor(estadoT * 8)), '#000', '#808080');
            yf += 7 * st + 16;
        } else {
            yf += banda('¡SE ACABÓ!', yf, escalaQueQuepa('¡SE ACABÓ!', W - 20, 3)) + 12;
        }
        if (estadoT > 0.6) {
            var cuenta = Math.round(bonus.ganado * clamp((estadoT - 0.6) / 0.8, 0, 1));
            var txt = 'BONUS +' + cuenta;
            panel([txt], yf, escalaQueQuepa(txt, W - 22, 2));
        }
    }

    function dibujar() {
        ctx.setTransform(ESC, 0, 0, ESC, 0, 0);
        ctx.save();
        if (sacudida > 0.5) ctx.translate(Math.round(rand(-sacudida, sacudida)), Math.round(rand(-sacudida, sacudida)));
        ctx.fillStyle = FONDO;
        ctx.fillRect(-8, -8, W + 16, H + 16);
        ctx.drawImage(manchas, 0, 0);

        cosas.forEach(function (c) {
            ctx.save();
            ctx.translate(Math.round(c.x), Math.round(c.y));
            // Mojada, se voltea de cabeza y se cae
            if (c.volteo) ctx.scale(1, Math.cos(c.volteo) || 0.1);
            var cw = c.tipo.ancho * KC, ch = c.tipo.alto * KC;
            ctx.drawImage(c.mojado ? c.tipo.mojado : c.tipo.seco, -Math.round(cw / 2), -Math.round(ch / 2), cw, ch);
            ctx.restore();
        });

        // Dónde va a caer cada globo
        ctx.fillStyle = '#fff';
        globos.forEach(function (g) {
            punteado(g.x1, g.y1, RB * (0.6 + (1 - g.t / g.dur) * 0.9), reloj * 3);
        });
        globos.forEach(function (g) {
            var p = posGlobo(g), lado = Math.round(16 * p.s);
            ctx.drawImage(g.color.sprite, Math.round(p.x - lado / 2), Math.round(p.y - lado / 2), lado, lado);
        });

        if (estado === 'titulo') dibujarIntro();
        else if (estado === 'instrucciones') dibujarInstrucciones();
        else if (estado === 'bonusIntro' || estado === 'bonus' || estado === 'bonusFin') dibujarBonus();

        ctx.fillStyle = '#00ffff';
        anillos.forEach(function (a) { punteado(a.x, a.y, RB * (0.6 + 2 * a.t / a.vida) * (a.vida > 0.3 ? 4 : 1), 0); });

        particulas.forEach(function (p) {
            ctx.fillStyle = p.color;
            ctx.fillRect(Math.round(p.x), Math.round(p.y), p.lado, p.lado);
        });
        ctx.restore();

        if (flash > 0) {
            ctx.globalAlpha = flash * 0.8;
            ctx.fillStyle = '#fff';
            ctx.fillRect(0, 0, W, H);
            ctx.globalAlpha = 1;
        }
    }

    // ── Marcador ──────────────────────────────────────────────────────────
    var elPuntos = document.getElementById('puntos'), elTiempo = document.getElementById('tiempo'), elCara = document.getElementById('cara');
    var ultimoHud = '', caraActual = '';
    function pintarHud() {
        var enBonus = estado === 'bonus' || estado === 'bonusFin';
        var seg = Math.ceil(enBonus ? bonus.resta : (estado === 'titulo' || estado === 'instrucciones') ? AJUSTES.duracion : restante);
        var hud = puntos + '|' + seg;
        if (hud !== ultimoHud) {
            ultimoHud = hud;
            elPuntos.textContent = String(puntos).padStart(4, '0');
            elTiempo.textContent = String(seg).padStart(3, '0');
            elTiempo.classList.toggle('poco', (estado === 'jugando' && seg <= 10) || (estado === 'bonus' && seg <= 3));
        }
        var cara = '🙂';
        if (estado === 'fin' && recordNuevo) cara = '😎';
        if (globos.length) cara = '😮';
        if (estado === 'bonus') cara = bonus.bombeo > 0 ? '😤' : '😬';
        if (estado === 'bonusFin') cara = bonus.trono ? '😆' : '😐';
        if (reloj < caraMalaHasta) cara = '😵';
        if (cara !== caraActual) { caraActual = cara; elCara.textContent = cara; }
    }

    var antes = performance.now();
    // El juego corre en tiempo real aunque el aparato vaya lento: el tiempo
    // que pasó se reparte en pasos de a lo más 1/30 s. Así la ronda dura lo
    // mismo en cualquier aparato y nadie juega en cámara lenta. Un atorón de
    // más de 1/4 s (pestaña escondida, que además pausa) no se cuenta.
    function cuadro(ahora) {
        var falta = Math.min((ahora - antes) / 1000, 0.25);
        antes = ahora;
        while (W && falta > 0 && !congelado()) {
            var paso = Math.min(falta, 1 / 30);
            actualizar(paso);
            falta -= paso;
        }
        if (W) dibujar();
        pintarHud();
        requestAnimationFrame(cuadro);
    }

    // ── Cuadro de mensaje ─────────────────────────────────────────────────
    var dlg = document.getElementById('dlg');
    var dlgTitulo = document.getElementById('dlgTitulo'), dlgTexto = document.getElementById('dlgTexto'), dlgBotones = document.getElementById('dlgBotones');
    function dialogo(titulo, html, botones) {
        dlgTitulo.textContent = titulo;
        dlgTexto.innerHTML = html;
        dlgBotones.innerHTML = '';
        botones.forEach(function (b, i) {
            var el = document.createElement('button');
            el.className = 'w95-btn' + (i === 0 ? ' defecto' : '');
            el.textContent = b.texto;
            el.addEventListener('click', function (e) {
                e.stopPropagation();
                dlg.hidden = true;
                if (b.accion) b.accion();
            });
            dlgBotones.appendChild(el);
        });
        dlg.hidden = false;
    }
    var COMO = '<p>Las cosas salen desde abajo. Toca o haz clic donde quieras que caiga el globo: tarda un poquito en llegar, así que apunta adelante.</p>' +
               '<p>Mójalos: Lemus (25), la Cybertruck (20), el letrero de SE RENTA (20), la carpeta con el sello de CARPETAZO (15) y el Recibo de agua (15).</p>' +
               '<p><b>No mojes la torta ni el aviso de «Hacer algo al respecto»:</b> te quitan 25.</p>' +
               '<p>Al final viene la ronda bonus: toca rápido (o dale a la barra espaciadora) para inflar la cabeza hasta que truene.</p>';

    function empezar() {
        desbloquearAudio();
        cerrarMenus();
        dlg.hidden = true;
        cambiar('jugando');
        puntos = 0; combo = 0; ultimoAcierto = -9; jugado = 0; recordNuevo = false;
        restante = AJUSTES.duracion; proxima = 0.6;
        stats = { tirados: 0, aciertos: 0, malos: 0, mejorCombo: 0 };
        cosas = []; pendientes = []; globos = [];
        mctx.clearRect(0, 0, W, H); // pared limpia en cada ronda
        tips.innerHTML = '';
        sonido('arranque');
    }

    // Entre la pantalla de inicio y la ronda: qué sí se moja y qué no
    function mostrarInstrucciones() {
        desbloquearAudio();
        cambiar('instrucciones');
        sonido('moneda');
    }

    function alTitulo() {
        cambiar('titulo');
        cosas = []; pendientes = []; globos = [];
        mctx.clearRect(0, 0, W, H);
    }

    function leerRecord() {
        try { return +localStorage.getItem('globos-record') || 0; } catch (e) { return 0; }
    }

    function terminar() {
        cambiar('fin');
        var record = leerRecord();
        recordNuevo = puntos > record && puntos > 0;
        if (recordNuevo) { record = puntos; try { localStorage.setItem('globos-record', String(puntos)); } catch (e) {} }
        var tino = stats.tirados ? Math.round(stats.aciertos / stats.tirados * 100) : 0;
        sonido('fin');
        dialogo(NOMBRE,
            '<p>¡Se acabó!</p>' +
            marcador(puntos, recordNuevo ? '<b>¡Nuevo récord!</b>' : 'Récord: ' + record) +
            resumen([
                ['Puntos de la ronda', puntos - bonus.ganado],
                ['Ronda bonus', '+' + bonus.ganado + (bonus.trono ? ' ¡tronó!' : '')],
                ['Globos tirados', stats.tirados],
                ['Le atinaste', tino + '%'],
                ['Mejor combo', '×' + stats.mejorCombo],
                ['Castigos', stats.malos]
            ]),
            [{ texto: 'Otra vez', accion: empezar }, { texto: 'Aceptar', accion: alTitulo }]);
    }

    // Los puntos en LED rojo, como el contador de arriba
    function marcador(n, nota) {
        return '<div class="marcador"><span class="counter">' + String(n).padStart(4, '0') + '</span>' +
               (nota ? '<span>' + nota + '</span>' : '') + '</div>';
    }
    // Renglones de nombre y número, alineados, en una caja hundida
    function resumen(filas) {
        return '<table class="resumen">' + filas.map(function (f) {
            return '<tr><td>' + f[0] + '</td><td>' + f[1] + '</td></tr>';
        }).join('') + '</table>';
    }

    function pausar() {
        if (!enPartida() || !dlg.hidden) return;
        dialogo(NOMBRE, '<p>Juego en pausa.</p>', [{ texto: 'Seguir' }]);
    }

    // ── Menús ─────────────────────────────────────────────────────────────
    var menubar = document.getElementById('menubar');
    function cerrarMenus() {
        menubar.querySelectorAll('.menu.open').forEach(function (m) { m.classList.remove('open'); });
        menuAbierto = false;
    }
    menubar.querySelectorAll('.menu').forEach(function (m) {
        var titulo = m.querySelector('span');
        titulo.addEventListener('click', function (e) {
            e.stopPropagation();
            var abrir = !m.classList.contains('open');
            cerrarMenus();
            if (abrir) { m.classList.add('open'); menuAbierto = true; }
        });
        // Como en Win95: con un menú abierto, pasar el mouse abre el vecino.
        titulo.addEventListener('mouseenter', function () {
            if (!menuAbierto || m.classList.contains('open')) return;
            cerrarMenus(); m.classList.add('open'); menuAbierto = true;
        });
    });
    document.addEventListener('click', cerrarMenus);

    function marcar(accion, si) {
        menubar.querySelector('[data-accion="' + accion + '"]').classList.toggle('check', si);
    }
    var ACCIONES = {
        nuevo: empezar,
        tocar: function () { modo = 'tocar'; marcar('tocar', true); marcar('deslizar', false); },
        deslizar: function () { modo = 'deslizar'; marcar('tocar', false); marcar('deslizar', true); },
        sonido: function () { mudo = !mudo; marcar('sonido', !mudo); },
        record: function () {
            dialogo('Mejor puntuación', '<p>Tu récord en este navegador:</p>' + marcador(leerRecord()), [{ texto: 'Aceptar' }]);
        },
        como: function () { dialogo('Cómo jugar', COMO, [{ texto: 'Aceptar' }]); },
        acerca: function () {
            dialogo('Acerca de ' + NOMBRE, '<p><b>' + NOMBRE + '</b><br>Guadalajara De Noche</p><p class="chico">Maqueta: el fondo es de relleno.</p>', [{ texto: 'Aceptar' }]);
        }
    };
    menubar.addEventListener('click', function (e) {
        var li = e.target.closest('[data-accion]');
        if (!li) return;
        e.stopPropagation();
        cerrarMenus();
        ACCIONES[li.dataset.accion]();
    });

    elCara.addEventListener('click', empezar);

    document.addEventListener('keydown', function (e) {
        if (e.key === 'Enter' && !dlg.hidden) { e.preventDefault(); dlgBotones.querySelector('.defecto').click(); return; }
        if (e.key === 'F2') { e.preventDefault(); empezar(); return; }
        if (e.key === 'Escape') { cerrarMenus(); return; }
        if ((e.key === ' ' || e.key === 'Enter') && !congelado()) {
            e.preventDefault();
            desbloquearAudio();
            // Dejar la tecla apretada no cuenta: hay que machacarla
            if (estado === 'bonus' && !e.repeat) bombear(e.timeStamp);
            else if (estado === 'titulo') mostrarInstrucciones();
            else if (estado === 'instrucciones' && estadoT > 0.4) empezar();
        }
    });

    // ── Con la ventana del escritorio ─────────────────────────────────────
    // Un clic dentro del iframe no le llega al escritorio: se avisa para que
    // la ventana pase al frente. Al cerrarla o minimizarla, el escritorio
    // manda pausar.
    var enMarco = window.parent !== window;
    document.addEventListener('pointerdown', function () {
        if (enMarco) try { parent.postMessage({ type: 'globos-frente' }, location.origin); } catch (e) {}
    }, true);
    window.addEventListener('message', function (e) {
        if (e.origin !== location.origin) return;
        if (e.data && e.data.type === 'globos-pausa') pausar();
    });
    document.addEventListener('visibilitychange', function () { if (document.hidden) pausar(); });

    // ?debug deja ver el estado desde la consola para probar sin dedos
    var enCasa = /^(localhost|127\.0\.0\.1|\[::1\]|192\.168\.\d+\.\d+|10\.\d+\.\d+\.\d+)$/.test(location.hostname);
    if (enCasa && /[?&]debug\b/.test(location.search)) {
        window.globos = {
            cosas: function () { return cosas; }, globos: function () { return globos; },
            puntos: function () { return puntos; }, estado: function () { return estado; },
            bonus: function () { return bonus; }, bombear: bombear, empezar: empezar,
            lanzar: function (id) { lanzarCosa(porId(id)); },
            tirarHacia: tirarHacia, AJUSTES: AJUSTES, BONUS: BONUS,
            W: function () { return W; }, H: function () { return H; }, PX: function () { return PX; }
        };
    }

    if (window.ResizeObserver) new ResizeObserver(redimensionar).observe(campo);
    else window.addEventListener('resize', redimensionar);
    redimensionar();
    requestAnimationFrame(cuadro);
})();
