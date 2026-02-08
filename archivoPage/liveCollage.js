// Live Collage Gallery - Archive Images Only
const collageContainer = document.getElementById('live-collage-container');

// Track last placed image position
let lastImagePosition = { top: null, left: null, size: null };
// Track z-index to ensure new images are always on top
let currentZIndex = 1;
// Track last 15 non-GIF image paths to avoid repetition
let recentNonGifPaths = [];
const maxRecentNonGifHistory = 15;
// Track last 3 GIF paths to avoid repeating same GIF
let recentGifPaths = [];
const maxRecentGifHistory = 3;

// Performance reset: Track intervals and timeouts for cleanup
let archiveImageTimeout = null;
let resetTimer = null;
const RESET_INTERVAL = 5 * 60 * 1000; // 5 minutes in milliseconds

// Helper: Calculate distance between two points
function calculateDistance(x1, y1, x2, y2) {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

// Helper: Place image randomly in collage, ensuring distance from last image
function placeImageRandomly(imgSrc) {
  const img = document.createElement('img');
  const size = Math.random() * 180 + 120;
  img.style.position = 'absolute';
  img.style.width = size + 'px';
  img.style.height = 'auto';
  img.dataset.src = imgSrc;
  
  // Handle image load errors gracefully (treat all formats equally)
  img.onerror = function() {
    // If image fails to load, remove it silently
    if (img.parentNode) {
      img.parentNode.removeChild(img);
    }
  };
  
  img.src = imgSrc;
  img.addEventListener('load', () => {
    img.dataset.width = img.naturalWidth;
    img.dataset.height = img.naturalHeight;
  });
  
  // Find a position that's at least 150px away from the last image
  let top, left;
  let attempts = 0;
  const minDistance = 150;
  const maxAttempts = 50;
  
  do {
    top = Math.random() * (collageContainer.offsetHeight - size);
    left = Math.random() * (collageContainer.offsetWidth - size);
    attempts++;
    
    // If no last position exists, use first attempt
    if (lastImagePosition.top === null) {
      break;
    }
    
    // Calculate center points
    const currentCenterX = left + size / 2;
    const currentCenterY = top + size / 2;
    const lastCenterX = lastImagePosition.left + lastImagePosition.size / 2;
    const lastCenterY = lastImagePosition.top + lastImagePosition.size / 2;
    
    const distance = calculateDistance(currentCenterX, currentCenterY, lastCenterX, lastCenterY);
    
    // If distance is sufficient, use this position
    if (distance >= minDistance) {
      break;
    }
    
  } while (attempts < maxAttempts);
  
  img.style.top = top + 'px';
  img.style.left = left + 'px';
  img.style.transform = 'rotate(0deg)'; // No rotation
  img.style.boxShadow = 'none';
  img.style.border = 'none';
  img.draggable = false;
  img.style.pointerEvents = 'auto';
  // Always increment z-index so new images appear on top
  currentZIndex++;
  img.style.zIndex = currentZIndex;
  img.addEventListener('click', (event) => {
    event.stopPropagation();
    openImageDetails(img);
  });
  collageContainer.appendChild(img);
  
  // Update last image position
  lastImagePosition = { top, left, size };
}

// Helper functions for image details
function getFileNameFromPath(path) {
  const parts = path.split('/');
  return parts[parts.length - 1] || path;
}

function getFileExtension(fileName) {
  const segments = fileName.split('.');
  return segments.length > 1 ? segments.pop().toUpperCase() : 'Archivo';
}

// Send image details to parent window to open the side panel
function openImageDetails(imgElement) {
  const imgSrc = imgElement.dataset.src || imgElement.src;
  const fileName = getFileNameFromPath(imgSrc);
  const typeLabel = getFileExtension(fileName);
  const width = imgElement.dataset.width || imgElement.naturalWidth || '—';
  const height = imgElement.dataset.height || imgElement.naturalHeight || '—';

  // Build the full image URL so parent can display it
  const fullSrc = new URL(imgSrc, window.location.href).href;

  // Send to parent
  if (window.parent && window.parent !== window) {
    window.parent.postMessage({
      type: 'galeria-open-details',
      data: {
        src: fullSrc,
        fileName: fileName,
        fileType: typeLabel,
        dimensions: `${width} × ${height}`,
        path: imgSrc
      }
    }, '*');
  }
}

// Listen for close message from parent (optional, for syncing state)
window.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'galeria-close-details') {
    // Parent closed the panel, nothing to do in iframe
  }
});

// 1. Dynamically discover and show archive images
function loadArchiveImages() {
  const archiveImages = [];
  const imageExtensions = ['jpg', 'jpeg', 'gif', 'png', 'webp']; // Try common formats
  let currentNumber = 1;
  let consecutiveFailures = 0;
  const maxConsecutiveFailures = 10; // Stop after 10 consecutive missing images
  
  // Function to check if an image exists by attempting to load it
  function checkImageExists(path) {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(true);
      img.onerror = () => resolve(false);
      img.src = path;
    });
  }
  
  // Dynamically discover all available images
  async function discoverImages() {
    while (consecutiveFailures < maxConsecutiveFailures) {
      let foundAny = false;
      
      // Try all extensions for current number
      for (const ext of imageExtensions) {
        const imagePath = `archiveImages/archiveImage${currentNumber}.${ext}`;
        const exists = await checkImageExists(imagePath);
        if (exists) {
          // Limit GIFs to 65% probability to keep them limited
          if (ext.toLowerCase() === 'gif') {
            if (Math.random() < 0.65) {
              archiveImages.push(imagePath);
            }
            // Mark as found even if GIF wasn't added (to avoid incrementing consecutiveFailures)
            foundAny = true;
            break; // Found GIF (added or not), no need to check other extensions
          } else {
            archiveImages.push(imagePath);
            foundAny = true;
            break; // Found non-GIF image, no need to check other extensions
          }
        }
      }
      
      if (foundAny) {
        consecutiveFailures = 0;
      } else {
        consecutiveFailures++;
      }
      
      currentNumber++;
    }
    
    // Start displaying once discovery is complete
    startDisplayingImages();
    }
  
  // Start displaying images once discovery is complete
  function startDisplayingImages() {
    if (archiveImages.length === 0) {
      console.warn('No archive images found');
      return;
    }
    
  function addNextArchiveImage() {
    if (archiveImages.length > 0) {
        let randomIndex;
        let attempts = 0;
        const maxAttempts = 100; // Prevent infinite loop
        
        // Make sure we don't repeat images:
        // - GIFs: don't repeat same GIF in last 3 positions
        // - Non-GIFs: don't repeat same image in last 15 positions
        do {
          randomIndex = Math.floor(Math.random() * archiveImages.length);
          attempts++;
          
          const selectedImagePath = archiveImages[randomIndex];
          const isGif = selectedImagePath.toLowerCase().endsWith('.gif');
          
          // Check if it's a GIF and if it's in the recent GIF history
          const isRecentGif = isGif && recentGifPaths.includes(selectedImagePath);
          
          // Check if it's a non-GIF and if it's in the recent non-GIF history
          const isRecentNonGif = !isGif && recentNonGifPaths.includes(selectedImagePath);
          
          // Check if we should skip this image
          const shouldSkip = isRecentGif || isRecentNonGif;
          
          // If we shouldn't skip, break out of the loop
          if (!shouldSkip) {
            break;
          }
          
        } while (attempts < maxAttempts);
        
        // Track image paths based on type
        const selectedImagePath = archiveImages[randomIndex];
        const isGif = selectedImagePath.toLowerCase().endsWith('.gif');
        
        if (isGif) {
          // Track GIF paths (last 3)
          recentGifPaths.push(selectedImagePath);
          if (recentGifPaths.length > maxRecentGifHistory) {
            recentGifPaths.shift(); // Remove oldest GIF
          }
        } else {
          // Track non-GIF paths (last 15)
          recentNonGifPaths.push(selectedImagePath);
          if (recentNonGifPaths.length > maxRecentNonGifHistory) {
            recentNonGifPaths.shift(); // Remove oldest non-GIF
          }
        }
        
      placeImageRandomly(archiveImages[randomIndex]);
        // Store timeout reference for cleanup
        archiveImageTimeout = setTimeout(addNextArchiveImage, 2000); // cada 2 segundos
    }
  }
  addNextArchiveImage();
  }
  
  // Start discovery process
  discoverImages();
}

// Reset function to clear everything and restart (performance optimization)
function resetGallery() {
  console.log('Resetting gallery after 5 minutes for performance...');
  
  // Clear all timeouts and intervals
  if (archiveImageTimeout) {
    clearTimeout(archiveImageTimeout);
    archiveImageTimeout = null;
  }
  if (resetTimer) {
    clearTimeout(resetTimer);
    resetTimer = null;
  }
  
  // Remove all images from DOM
  const images = collageContainer.querySelectorAll('img');
  images.forEach(img => {
    if (img.parentNode) {
      img.parentNode.removeChild(img);
    }
  });
  
  // Reset all state variables
  lastImagePosition = { top: null, left: null, size: null };
  currentZIndex = 1;
  recentNonGifPaths = [];
  recentGifPaths = [];
  
  // Restart gallery
  console.log('Restarting gallery...');
  loadArchiveImages();
  
  // Schedule next reset
  resetTimer = setTimeout(resetGallery, RESET_INTERVAL);
}

// Initialize gallery (only called after popup is dismissed)
function initializeGallery() {
  const collageContainer = document.getElementById('live-collage-container');
  collageContainer.style.display = 'block';
  loadArchiveImages();
  
  // Schedule first reset after 5 minutes
  resetTimer = setTimeout(resetGallery, RESET_INTERVAL);
}

// Windows XP Popup handler
function setupXPPopup() {
  const popupOverlay = document.getElementById('xp-popup-overlay');
  const popupOk = document.getElementById('xp-popup-ok');
  const popupClose = document.getElementById('xp-popup-close');

  function dismissPopup() {
    popupOverlay.style.display = 'none';
    initializeGallery();
  }

  popupOk.addEventListener('click', dismissPopup);
  popupClose.addEventListener('click', dismissPopup);
  
  // Show popup on page load
  popupOverlay.style.display = 'flex';
}

// Initialize popup when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', setupXPPopup);
} else {
  setupXPPopup();
}
