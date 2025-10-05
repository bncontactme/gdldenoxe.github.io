document.addEventListener("DOMContentLoaded", () => {
  const imageContainer = document.getElementById("image-container");

  const getProductData = () => {
    const products = [];
    const productElements = document.querySelectorAll('.product');
    
    productElements.forEach(productElement => {
      const title = productElement.getAttribute('data-title');
      const main = productElement.getAttribute('data-main');
      const sub = JSON.parse(productElement.getAttribute('data-sub'));
      const description = productElement.getAttribute('data-description');
      const price = productElement.getAttribute('data-price');
      const buyUrl = productElement.getAttribute('data-buy-url');
      const stock = productElement.getAttribute('data-stock') || "in"; // Default to "in" if not specified
  
      products.push({ title, main, sub, description, price, buyUrl, stock });
    });
  
    return products;
  };

  const desktopImageSize = { width: 180, height: 180 };
  const mobileImageSize = { width: 70, height: 70 };

  const getRandomPosition = () => {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;
    const x = Math.random() * screenWidth;
    const y = Math.random() * screenHeight;
    return { x, y };
  };

  const createImageElement = (product, isMobile) => {
    const img = document.createElement("img");
    img.src = product.main;
    img.classList.add("image");

    const { width, height } = isMobile ? mobileImageSize : desktopImageSize;
    img.style.width = `${width}px`;
    img.style.height = `${height}px`;
    
    const { x, y } = getRandomPosition();
    img.style.left = `${x}px`;
    img.style.top = `${y}px`;

    const randomZIndex = Math.floor(Math.random() * 1000);
    img.style.zIndex = randomZIndex;

    if (product.stock === "out") {
      img.style.opacity = "1";
      img.style.cursor = "allowed";
    }

    img.addEventListener("click", () => {
      showPreview(product);
    });

    return img;
  };

  const showPreview = (product) => {
    const previewModal = document.createElement("div");
    previewModal.classList.add("preview-modal");

    const modalContent = document.createElement("div");
    modalContent.classList.add("modal-content");

    const previewImage = document.createElement("img");
    previewImage.src = product.main;
    previewImage.classList.add("preview-image");

    const carouselContainer = document.createElement("div");
    carouselContainer.classList.add("carousel-container");

    product.sub.forEach(subImage => {
      const carouselImage = document.createElement("img");
      carouselImage.src = subImage;
      carouselImage.classList.add("carousel-image");
      carouselImage.addEventListener("click", () => {
        previewImage.src = subImage;
      });
      carouselContainer.appendChild(carouselImage);
    });

    const titleText = document.createElement("p");
    titleText.classList.add("product-title");
    titleText.textContent = product.title;

    const descriptionText = document.createElement("p");
    descriptionText.classList.add("description-text");
    descriptionText.textContent = product.description;

    const priceText = document.createElement("p");
    priceText.classList.add("price-text");
    if (product.stock === "out") {
      priceText.textContent = `${product.price}`;
      priceText.style.color = "red";
    } else {
      priceText.textContent = `${product.price}`;
    }

    const payButton = document.createElement("button");
    payButton.classList.add("pay-button");
    payButton.textContent = "Buy Now";
    if (product.stock === "out") {
      payButton.style.backgroundColor = "red";
      payButton.textContent = "Out Of Stock";
      payButton.disabled = true;
      payButton.style.cursor = "not-allowed";
    } else {
      payButton.addEventListener("click", () => {
        window.location.href = product.buyUrl;
      });
    }

    const closeButton = document.createElement("button");
    closeButton.textContent = "X";
    closeButton.classList.add("close-preview");
    closeButton.addEventListener("click", () => {
      previewModal.remove();
    });

    modalContent.appendChild(closeButton);
    modalContent.appendChild(previewImage);
    modalContent.appendChild(carouselContainer);
    modalContent.appendChild(titleText);
    modalContent.appendChild(descriptionText);
    modalContent.appendChild(priceText);
    modalContent.appendChild(payButton);
    previewModal.appendChild(modalContent);
    document.body.appendChild(previewModal);
  };

  const loadRandomImages = () => {
    const isMobile = window.innerWidth <= 768;
    const imageCount = 45;

    const products = getProductData();

    products.forEach(product => {
      for (let i = 0; i < imageCount; i++) {
        const img = createImageElement(product, isMobile);
        imageContainer.appendChild(img);
      }
    });
  };

  loadRandomImages();
});
