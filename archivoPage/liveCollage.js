// Live Collage Gallery using Laptop Camera
const video = document.getElementById('collage-video');
const captureBtn = document.getElementById('capture-btn');
const collageContainer = document.getElementById('live-collage-container');

// Helper: Place image randomly in collage
function placeImageRandomly(imgSrc) {
  const img = document.createElement('img');
  img.src = imgSrc;
  const size = Math.random() * 180 + 120;
  img.style.position = 'absolute';
  img.style.width = size + 'px';
  img.style.height = 'auto';
  img.style.top = Math.random() * (collageContainer.offsetHeight - size) + 'px';
  img.style.left = Math.random() * (collageContainer.offsetWidth - size) + 'px';
  img.style.transform = 'rotate(0deg)'; // No rotation
  img.style.boxShadow = 'none';
  img.style.border = 'none';
  img.style.zIndex = Math.floor(Math.random()*100);
  collageContainer.appendChild(img);
}

// 1. Show archive images randomly in collage
function loadArchiveImages() {
  // Dynamically load all images from archiveImages folder
  const archiveImages = [];
  for (let i = 1; i <= 95; i++) {
    archiveImages.push(`archiveImages/archiveImage (${i}).jpg`);
    if ([2, 28, 43, 59, 77, 88, 89, 90].includes(i)) {
      archiveImages.push(`archiveImages/archiveImage (${i}).gif`);
    }
    if ([26, 48].includes(i)) {
      archiveImages.push(`archiveImages/archiveImage (${i})(1).jpg`);
    }
  }
  // Place 1 random archive image every 5 seconds
  function addNextArchiveImage() {
    if (archiveImages.length > 0) {
      const randomIndex = Math.floor(Math.random() * archiveImages.length);
      placeImageRandomly(archiveImages[randomIndex]);
      setTimeout(addNextArchiveImage, 3000); // now every 3 seconds
    }
  }
  addNextArchiveImage();
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
      }, 8000); // every 8 seconds
    })
    .catch(err => {
      alert('No se pudo acceder a la cámara: ' + err.message);
    });
}

// Init
loadArchiveImages();
startCameraCollage();

// Capture image and add to collage
captureBtn.addEventListener('click', () => {
  const canvas = document.createElement('canvas');
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
  placeImageRandomly(canvas.toDataURL('image/jpeg'));
});
