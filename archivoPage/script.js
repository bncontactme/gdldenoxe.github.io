// Define the base URL and extensions
const baseUrl = "https://raw.githubusercontent.com/gdldenoxe/gdldenoxe.github.io/main/archivoPage/archiveImages/archiveImage%20";
const extensions = [".gif", ".jpg"]; // Supported extensions
const owner = 'gdldenoxe'; // GitHub username
const repo = 'gdldenoxe.github.io'; // Repository name
const folder = 'archivoPage/archiveImages'; // Folder path in the repository
const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/${folder}`;

// Function to fetch the total number of images
async function getTotalImages() {
  try {
    const response = await fetch(apiUrl);
    const data = await response.json();
    if (Array.isArray(data)) {
      const imageFiles = data.filter(file =>
        /\.(jpg|gif)$/i.test(file.name)
      );
      const totalImages = imageFiles.length;
      return totalImages;
    } else {
      console.error('Unexpected response structure:', data);
      return 0;
    }
  } catch (error) {
    console.error('Error fetching folder contents:', error);
    return 0;
  }
}

// Function to shuffle an array
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// Function to display images in the gallery
async function displayImages(randomOrder = false) {
  const totalImages = await getTotalImages();

  const galleryContainer = document.getElementById('image-gallery');
  galleryContainer.innerHTML = ''; // Clear the existing images

  // Create an array of image URLs
  const imageArray = [];
  for (let i = totalImages; i >= 1; i--) { // Reverse order (last image first)
    extensions.forEach(ext => {
      const imgUrl = `${baseUrl}(${i})${ext}`;
      imageArray.push(imgUrl);
    });
  }

  // Shuffle the images if randomOrder is true
  if (randomOrder) {
    shuffleArray(imageArray);
  }

  // Add images to the gallery
  const fragment = document.createDocumentFragment();
  imageArray.forEach((imgUrl, index) => {
    const imgElement = document.createElement('div');
    imgElement.classList.add('grid-item');
    imgElement.innerHTML = `<img src="${imgUrl}" loading="lazy" alt="Image ${index + 1}" onerror="handleImageError(this)" />`;
    fragment.appendChild(imgElement);
  });

  galleryContainer.appendChild(fragment);

  // Initialize Packery after images are added
  const grid = document.querySelector('.grid');
  const pckry = new Packery(grid, {
    itemSelector: '.grid-item',
    percentPosition: true
  });

  // Layout Packery after each image loads
  imagesLoaded(grid).on('progress', function () {
    pckry.layout();
  });
}

// Error handling for images
function handleImageError(imgElement) {
  imgElement.parentElement.style.display = 'none'; // Hide the parent container if the image fails to load
}

// Event listener for dice click to randomize images
document.getElementById('dice-icon').addEventListener('click', () => {
  displayImages(true); // Randomize images when the dice is clicked
});

// Display images in reverse order by default
displayImages(false);
