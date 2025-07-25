

// Create a link wrapping the GIF
const link = document.createElement('a');
link.href = 'https://www.unrwa.org/';
link.target = '_blank';
link.style.position = 'fixed';
link.style.zIndex = '9999';
link.style.pointerEvents = 'auto';

const gif = document.createElement('img');
gif.src = 'radioTool/Animated-Flag-Palestine.gif';
gif.style.width = '180px';
gif.style.height = '120px';
gif.style.pointerEvents = 'auto';

link.appendChild(gif);
document.body.appendChild(link);

let x = Math.random() * (window.innerWidth - 180);
let y = Math.random() * (window.innerHeight - 120);
let dx = 1.5;
let dy = 1;

function moveGif() {
    x += dx;
    y += dy;

    if (x <= 0 || x + 180 >= window.innerWidth) {
        dx = -dx;
    }
    if (y <= 0 || y + 120 >= window.innerHeight) {
        dy = -dy;
    }

    link.style.left = x + 'px';
    link.style.top = y + 'px';
    requestAnimationFrame(moveGif);
}

moveGif();
