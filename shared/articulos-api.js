// Lectura de artículos / poemas.
//
// La fuente real es el worker (KV). articulosPage/articulos.json se quedó como
// respaldo congelado: si el worker no contesta, el sitio sigue mostrando lo que
// había al momento de migrar en vez de una carpeta vacía.
//
// NO editar articulos.json a mano — ya no se publica desde ahí. Los poemas
// nuevos entran por articulosPage/upload.html.
(function (global) {
  'use strict';

  var WORKER = 'https://archivo-upload.guadalajaradenoxe.workers.dev';

  // Ruta al JSON de respaldo, relativa a quien llame.
  function rutaRespaldo(base) {
    return (base || '') + 'articulos.json';
  }

  function conTiempoLimite(url, ms) {
    // Si el worker tarda, no dejamos la carpeta cargando para siempre.
    var ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    var t = ctrl ? setTimeout(function () { ctrl.abort(); }, ms || 6000) : null;
    return fetch(url, ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (r) {
        if (t) clearTimeout(t);
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .catch(function (e) {
        if (t) clearTimeout(t);
        throw e;
      });
  }

  // Índice de publicados: [{id, titulo, meta, clase, imagen, descripcion}]
  function listar(base) {
    return conTiempoLimite(WORKER + '/articulos')
      .then(function (d) {
        if (!d || !Array.isArray(d.articulos)) throw new Error('respuesta rara');
        return d.articulos;
      })
      .catch(function (e) {
        console.warn('Artículos: worker no disponible, usando respaldo local.', e);
        return fetch(rutaRespaldo(base)).then(function (r) { return r.json(); });
      });
  }

  // Un artículo completo, con su contenido.
  function obtener(id, base) {
    return conTiempoLimite(WORKER + '/articulo?id=' + encodeURIComponent(id))
      .then(function (d) {
        if (!d || !d.articulo) throw new Error('respuesta rara');
        return d.articulo;
      })
      .catch(function (e) {
        console.warn('Artículo ' + id + ': worker no disponible, usando respaldo local.', e);
        return fetch(rutaRespaldo(base))
          .then(function (r) { return r.json(); })
          .then(function (lista) {
            return lista.find(function (a) { return String(a.id) === String(id); }) || null;
          });
      });
  }

  // ===== Autores =====
  // El autor viaja dentro de `meta`, con el formato "Autor • Categoría".
  function autorDe(art) {
    var autor = String((art && art.meta) || '').split('•')[0].trim();
    return autor || 'Sin autor';
  }

  // Un mismo autor que firma distinto. Va a mano porque las firmas no se
  // parecen lo suficiente para juntarlas solas: clave normalizada -> nombre
  // de la carpeta. Para juntar otro caso basta una línea más aquí.
  var ALIAS = {
    'mmayorga': 'Miguel Mayorga',
    'maayorga': 'Miguel Mayorga'
  };

  // Clave para agrupar: sin acentos ni mayúsculas, para que "Zoe Nuño" y
  // "Zoe nuño" caigan en la misma carpeta.
  function claveAutor(nombre) {
    var s = String(nombre).trim().replace(/\s+/g, ' ').toLowerCase();
    return s.normalize ? s.normalize('NFD').replace(/[\u0300-\u036f]/g, '') : s;
  }

  // Clave de la carpeta donde cae una firma, ya con los alias aplicados. Con
  // esto la forma de subir sabe si un autor recién escrito ya tiene carpeta.
  function claveCarpeta(nombre) {
    var clave = claveAutor(nombre);
    return ALIAS[clave] ? claveAutor(ALIAS[clave]) : clave;
  }

  // Entre variantes del mismo nombre se queda la mejor escrita: la que
  // arranca más palabras con mayúscula ("Zoe Nuño" le gana a "Zoe nuño").
  function mayusculasIniciales(nombre) {
    var partes = String(nombre).split(/\s+/);
    var n = 0;
    for (var i = 0; i < partes.length; i++) {
      if (/^[A-ZÁÉÍÓÚÜÑ]/.test(partes[i])) n++;
    }
    return n;
  }

  // Agrupa artículos en carpetas de autor, en orden alfabético:
  // [{ nombre, clave, articulos: [...] }]
  function agruparPorAutor(lista) {
    var porClave = {};
    var orden = [];
    (lista || []).forEach(function (art) {
      var nombre = autorDe(art);
      var alias = ALIAS[claveAutor(nombre)];
      if (alias) nombre = alias;
      var clave = claveCarpeta(nombre);
      if (!porClave[clave]) {
        porClave[clave] = { nombre: nombre, clave: clave, articulos: [] };
        orden.push(clave);
      }
      var carpeta = porClave[clave];
      if (mayusculasIniciales(nombre) > mayusculasIniciales(carpeta.nombre)) {
        carpeta.nombre = nombre;
      }
      carpeta.articulos.push(art);
    });
    return orden
      .map(function (clave) { return porClave[clave]; })
      .sort(function (a, b) { return a.nombre.localeCompare(b.nombre, 'es'); });
  }

  global.ArticulosAPI = {
    WORKER: WORKER,
    listar: listar,
    obtener: obtener,
    autorDe: autorDe,
    claveCarpeta: claveCarpeta,
    agruparPorAutor: agruparPorAutor
  };
})(window);
