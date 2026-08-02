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

  global.ArticulosAPI = { WORKER: WORKER, listar: listar, obtener: obtener };
})(window);
