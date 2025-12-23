// Live Collage Gallery using Laptop Camera
const video = document.getElementById('collage-video');
const collageContainer = document.getElementById('live-collage-container');

// Track last placed image position
let lastImagePosition = { top: null, left: null, size: null };
// Track z-index to ensure new images are always on top
let currentZIndex = 1;
// Track last 5 archive image indices to avoid repetition
let recentArchiveImageIndices = [];
const maxRecentHistory = 5;

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
  
  // Handle image load errors gracefully (treat all formats equally)
  img.onerror = function() {
    // If image fails to load, remove it silently
    if (img.parentNode) {
      img.parentNode.removeChild(img);
    }
  };
  
  img.src = imgSrc;
  
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
  img.style.pointerEvents = 'none';
  // Always increment z-index so new images appear on top
  currentZIndex++;
  img.style.zIndex = currentZIndex;
  collageContainer.appendChild(img);
  
  // Update last image position
  lastImagePosition = { top, left, size };
}

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
          archiveImages.push(imagePath);
          foundAny = true;
          break; // Found one, no need to check other extensions for this number
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
        
        // Make sure we don't repeat any of the last 5 images
        do {
          randomIndex = Math.floor(Math.random() * archiveImages.length);
          attempts++;
        } while (
          recentArchiveImageIndices.includes(randomIndex) && 
          archiveImages.length > recentArchiveImageIndices.length &&
          attempts < maxAttempts
        );
        
        // Add to recent history, maintaining max size
        recentArchiveImageIndices.push(randomIndex);
        if (recentArchiveImageIndices.length > maxRecentHistory) {
          recentArchiveImageIndices.shift(); // Remove oldest
        }
        
      placeImageRandomly(archiveImages[randomIndex]);
        setTimeout(addNextArchiveImage, 2000); // cada 2 segundos
    }
  }
  addNextArchiveImage();
  }
  
  // Start discovery process
  discoverImages();
}

// 2. Camera logic: take image every 8 seconds and add to collage
function startCameraCollage() {
  navigator.mediaDevices.getUserMedia({ video: true })
    .then(stream => {
      video.srcObject = stream;
      setInterval(() => {
        if (video.videoWidth && video.videoHeight) {
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
          placeImageRandomly(canvas.toDataURL('image/jpeg'));
        }
      }, 5600); // every 5.6 seconds (30% faster)
    })
    .catch(err => {
      // Silently handle camera access denial - archive images will still display
      console.log('Camera access denied or not available');
    });
}

// Initialize gallery (only called after popup is dismissed)
function initializeGallery() {
  const collageContainer = document.getElementById('live-collage-container');
  collageContainer.style.display = 'block';
  loadArchiveImages();
  // Request webcam permissions only after popup is dismissed
  startCameraCollage();
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
