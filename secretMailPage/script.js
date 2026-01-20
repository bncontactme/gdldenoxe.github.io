// Handle form submission - create postal
document.getElementById('mailForm').addEventListener('submit', function(e) {
    e.preventDefault();
    
    const from = document.getElementById('from').value;
    const to = document.getElementById('to').value;
    const message = document.getElementById('message').value;
    
    // Update postal content
    document.getElementById('postalTo').textContent = to;
    document.getElementById('postalFrom').textContent = from;
    document.getElementById('postalMessage').textContent = message;
    
    // Hide form, show postal
    document.getElementById('formSection').style.display = 'none';
    document.getElementById('postalSection').style.display = 'block';
});

// Back to form
document.getElementById('backBtn').addEventListener('click', function() {
    document.getElementById('formSection').style.display = 'block';
    document.getElementById('postalSection').style.display = 'none';
});

// Download button - will implement later
document.getElementById('downloadBtn').addEventListener('click', function() {
    alert('Download functionality - to be implemented');
});

// Email button - will implement later
document.getElementById('emailBtn').addEventListener('click', function() {
    alert('Email functionality - to be implemented');
});

// Optional: Add floating hearts animation
function createHeart() {
    const heart = document.createElement('div');
    heart.innerHTML = '❤️';
    heart.style.position = 'fixed';
    heart.style.left = Math.random() * 100 + 'vw';
    heart.style.bottom = '-50px';
    heart.style.fontSize = Math.random() * 20 + 10 + 'px';
    heart.style.opacity = '0.6';
    heart.style.pointerEvents = 'none';
    heart.style.zIndex = '1000';
    heart.style.animation = 'float 4s ease-in forwards';
    
    document.body.appendChild(heart);
    
    setTimeout(() => {
        heart.remove();
    }, 4000);
}

// Add CSS animation for floating hearts
const style = document.createElement('style');
style.textContent = `
    @keyframes float {
        0% {
            transform: translateY(0) rotate(0deg);
            opacity: 0.6;
        }
        100% {
            transform: translateY(-100vh) rotate(360deg);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);

// Create a heart every 3 seconds
setInterval(createHeart, 3000);
