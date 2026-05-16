// Shared Win95-style helpers.
// Currently exposes: makeDraggable() for panel-style dialogs (Properties /
// Image Viewer panels). The window-mode draggable in indexPage/script.js is
// specialized (rAF batching, CSS-var mode for !important overrides on mobile,
// shared global state across many windows) and is kept inline there.
//
// Loaded as a plain <script> on pages that need it. Exports onto window.win95.
(function (global) {
  'use strict';

  const TASKBAR_H = 40;

  /**
   * Make an absolutely-positioned element draggable by a handle.
   *
   * @param {HTMLElement} element            The element to move.
   * @param {object}      [opts]
   * @param {HTMLElement|string} [opts.handle]   Drag handle (element or selector
   *                                              within element). Defaults to
   *                                              the element itself.
   * @param {HTMLElement|string} [opts.ignore]   Mousedown targets to ignore
   *                                              (e.g. the panel's close button).
   * @param {(el: HTMLElement) => void} [opts.onStart]  Called on drag start
   *                                              (e.g. bump z-index).
   * @param {number} [opts.bottomPadding=40]   Viewport bottom inset when
   *                                              clamping (taskbar height).
   */
  function makeDraggable(element, opts) {
    if (!element) return;
    opts = opts || {};
    const handle = resolveEl(element, opts.handle) || element;
    const ignoreEl = opts.ignore && resolveEl(element, opts.ignore);
    const bottom = typeof opts.bottomPadding === 'number' ? opts.bottomPadding : TASKBAR_H;
    if (!handle) return;

    let dragging = false;
    let offX = 0, offY = 0;

    handle.addEventListener('mousedown', function (e) {
      if (ignoreEl && (e.target === ignoreEl || ignoreEl.contains(e.target))) return;
      dragging = true;
      offX = e.clientX - element.offsetLeft;
      offY = e.clientY - element.offsetTop;
      if (typeof opts.onStart === 'function') opts.onStart(element);
      e.preventDefault();
    });

    document.addEventListener('mousemove', function (e) {
      if (!dragging) return;
      const x = e.clientX - offX;
      const y = e.clientY - offY;
      const maxX = window.innerWidth - element.offsetWidth;
      const maxY = window.innerHeight - element.offsetHeight - bottom;
      element.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
      element.style.top  = Math.max(0, Math.min(y, maxY)) + 'px';
    });

    document.addEventListener('mouseup', function () { dragging = false; });
  }

  function resolveEl(root, ref) {
    if (!ref) return null;
    if (typeof ref === 'string') return root.querySelector(ref);
    return ref;
  }

  global.win95 = global.win95 || {};
  global.win95.makeDraggable = makeDraggable;
}(typeof window !== 'undefined' ? window : globalThis));
