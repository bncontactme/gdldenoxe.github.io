/** Rotator-only script for tienda drop page **/

document.addEventListener('DOMContentLoaded', () => {
  const DROP_INTERVAL = 5000;
  const dropBlock = document.getElementById('drop-block');
  if (!dropBlock) return;

  const dropImagesContainer = document.getElementById('drop-images');
  const captionEl = document.getElementById('drop-caption');
  const prevBtn = document.getElementById('drop-prev');
  const nextBtn = document.getElementById('drop-next');

  let sources = [];

  // collect hidden images first
  if (dropImagesContainer) {
    const imgs = dropImagesContainer.querySelectorAll('img');
    imgs.forEach(img => { if (img.src) sources.push({ src: img.src, alt: img.alt || '' }); });
  }

  // fallback: read from product elements with data-main
  if (sources.length === 0) {
    const productEls = document.querySelectorAll('.product');
    productEls.forEach(p => {
      const main = p.getAttribute('data-main');
      const title = p.getAttribute('data-title') || '';
      if (main) sources.push({ src: main, alt: title });
    });
  }

  if (sources.length === 0) {
    if (captionEl) captionEl.textContent = 'No drops yet';
    return;
  }

  let currentIndex = Math.floor(Math.random() * sources.length);
  let timer = null;
  let isPaused = false;

  function createImageEl(item) {
    const img = document.createElement('img');
    img.className = 'current-drop';
    img.src = item.src;
    img.alt = item.alt || '';
    img.style.opacity = '0';
    return img;
  }

  function showIndex(idx, immediate) {
    idx = (idx + sources.length) % sources.length;
    currentIndex = idx;
    const item = sources[idx];
    const newImg = createImageEl(item);
    if (captionEl) captionEl.textContent = item.alt || `Drop ${idx + 1}`;

    dropBlock.appendChild(newImg);
    // trigger transition
    void newImg.offsetWidth;
    newImg.style.opacity = '1';

    // remove previous images (keep only newest)
    const others = dropBlock.querySelectorAll('img.current-drop');
    for (let i = 0; i < others.length - 1; i++) {
      const old = others[i];
      old.style.opacity = '0';
      setTimeout(() => old.remove(), 450);
    }

    if (immediate) {
      newImg.style.transition = 'none';
      requestAnimationFrame(() => { newImg.style.transition = 'opacity 400ms ease-in-out, transform 400ms ease'; });
    }
  }

  function next() { showIndex(currentIndex + 1); }
  function prev() { showIndex(currentIndex - 1); }

  function startTimer() { stopTimer(); timer = setInterval(() => { if (!isPaused) next(); }, DROP_INTERVAL); }
  function stopTimer() { if (timer) { clearInterval(timer); timer = null; } }

  if (nextBtn) nextBtn.addEventListener('click', () => { next(); startTimer(); });
  if (prevBtn) prevBtn.addEventListener('click', () => { prev(); startTimer(); });

  dropBlock.addEventListener('mouseenter', () => { isPaused = true; });
  dropBlock.addEventListener('mouseleave', () => { isPaused = false; });

  showIndex(currentIndex, true);
  startTimer();
});
