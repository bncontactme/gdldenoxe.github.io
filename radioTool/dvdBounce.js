

// Create a link wrapping the GIF
const link = document.createElement('a');
link.href = 'https://www.unrwa.org/';
link.target = '_blank';
link.style.position = 'fixed';
link.style.zIndex = '9999';
link.style.pointerEvents = 'auto';

const gif = document.createElement('img');

gif.src = 'radioTool/Animated-Flag-Palestine.gif';
gif.style.pointerEvents = 'auto';

// Responsive size
let gifWidth = 180;
let gifHeight = 120;
if (window.innerWidth <= 768) {
    gifWidth = 50;
    gifHeight = 33;
}
gif.style.width = gifWidth + 'px';
gif.style.height = gifHeight + 'px';

link.appendChild(gif);
document.body.appendChild(link);

let x = Math.random() * (window.innerWidth - gifWidth);
let y = Math.random() * (window.innerHeight - gifHeight);
let dx = 1.5;
let dy = 1;

function moveGif() {
    x += dx;
    y += dy;

    if (x <= 0 || x + gifWidth >= window.innerWidth) {
        dx = -dx;
    }
    if (y <= 0 || y + gifHeight >= window.innerHeight) {
        dy = -dy;
    }

    link.style.left = x + 'px';
    link.style.top = y + 'px';
    requestAnimationFrame(moveGif);
}

moveGif();
