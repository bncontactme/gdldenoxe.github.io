// === CONFIGURATION ===
const YOUTUBE_VIDEO_ID = 'lNV4DiLbb9Y'; // Only the video ID
const PLAY_DATE = new Date().toISOString(); // Play immediately

// === UTILS ===
function getTimeUntilPlay() {
    const now = new Date();
    const playTime = new Date(PLAY_DATE);
    return playTime - now;
}

// === YOUTUBE IFRAME API LOADER ===
function loadYouTubeAPI(callback) {
    const tag = document.createElement('script');
    tag.src = "https://www.youtube.com/iframe_api";
    tag.onload = callback;
    document.body.appendChild(tag);
}

// === PLAYER SETUP ===
let player;
window.onYouTubeIframeAPIReady = function() {
    player = new YT.Player('yt-audio', {
        height: '0',
        width: '0',
        videoId: YOUTUBE_VIDEO_ID,
        playerVars: {
            autoplay: 1,
            controls: 0,
            modestbranding: 1,
            rel: 0,
            showinfo: 0
        },
        events: {
            'onReady': onPlayerReady
        }
    });
};

function onPlayerReady(event) {
    event.target.setVolume(100);
    event.target.playVideo();
}

// === SCHEDULER ===
function scheduleAudioPlay() {
    const timeUntilPlay = getTimeUntilPlay();
    if (timeUntilPlay <= 0) {
        // Play now
        loadYouTubeAPI(() => {});
    } else {
        setTimeout(() => {
            loadYouTubeAPI(() => {});
        }, timeUntilPlay);
    }
}

// === DOM SETUP ===
function setupAudioElement() {
    let div = document.createElement('div');
    div.id = 'yt-audio';
    div.style.width = '0';
    div.style.height = '0';
    div.style.overflow = 'hidden';
    div.style.position = 'absolute';
    div.style.left = '-9999px';
    document.body.appendChild(div);
}

// === INIT ===
window.addEventListener('DOMContentLoaded', () => {
    setupAudioElement();
    scheduleAudioPlay();
});