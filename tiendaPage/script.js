/*********************
* ADVERTISEMENT SYSTEM *
*********************/

const adAudio = document.getElementById("ad-audio");
const AD_INTERVAL_MINUTES = 2;
const AD_VOLUME_RATIO = 0.35;
let adTimer = null;
let adsList = ['Anuncio1.mp3'];

if (adAudio) {
    adAudio.volume = 0;

    function playRandomAd() {
        // Don't play if the page is hidden (store closed/minimized)
        if (document.hidden) return;
        const backgroundMusic = document.getElementById("background-music");
        if (backgroundMusic && !backgroundMusic.paused) {
            adAudio.volume = backgroundMusic.volume * AD_VOLUME_RATIO;
            adAudio.currentTime = 0;
            adAudio.play().catch(() => {});
        }
    }

    function scheduleNextAd() {
        const randomDelay = (1.5 + Math.random()) * 60 * 1000;
        clearTimeout(adTimer);
        adTimer = setTimeout(() => {
            playRandomAd();
            scheduleNextAd();
        }, randomDelay);
    }

    window.stopAds = function () {
        clearTimeout(adTimer);
        adTimer = null;
        adAudio.pause();
        adAudio.currentTime = 0;
    };

    window.startAds = function () {
        clearTimeout(adTimer);
        setTimeout(scheduleNextAd, 30000);
    };
}

/*********************
* BACKGROUND MUSIC (FIXED OVERLAP LOOP)
*********************/

const backgroundMusic = document.getElementById("background-music");
const START_TIME = 5;
const END_OFFSET = 5;
const FADE_DURATION = 7;

if (backgroundMusic) {
    // clone SAME element, SAME src, SAME path
    const backgroundMusicClone = backgroundMusic.cloneNode(true);
    backgroundMusic.parentNode.appendChild(backgroundMusicClone);

    let active = backgroundMusic;
    let inactive = backgroundMusicClone;
    let crossfadeTimer = null;
    let fadeIntervals = [];

    function fade(audio, from, to, duration) {
        const steps = 30;
        const stepTime = (duration * 1000) / steps;
        const step = (to - from) / steps;
        let volume = from;

        audio.volume = from;

        const interval = setInterval(() => {
            volume += step;
            audio.volume = Math.max(0, Math.min(1, volume));
            if ((step > 0 && volume >= to) || (step < 0 && volume <= to)) {
                audio.volume = to;
                clearInterval(interval);
                fadeIntervals = fadeIntervals.filter(i => i !== interval);
            }
        }, stepTime);
        fadeIntervals.push(interval);
    }

    function scheduleNextLoop(audio) {
        const loopDelay =
            (audio.duration - END_OFFSET - FADE_DURATION) * 1000;

        clearTimeout(crossfadeTimer);
        crossfadeTimer = setTimeout(crossfade, loopDelay);
    }

    function crossfade() {
        inactive.currentTime = START_TIME;
        inactive.play();

        fade(inactive, 0, 1, FADE_DURATION);
        fade(active, 1, 0, FADE_DURATION);

        [active, inactive] = [inactive, active];

        scheduleNextLoop(active);
    }

    // Do NOT auto-play on load; parent page controls playback via startMusic()
    backgroundMusic.volume = 0;
    backgroundMusicClone.volume = 0;

    // Expose stopMusic / startMusic so the parent page can control playback
    window.stopMusic = function () {
        clearTimeout(crossfadeTimer);
        crossfadeTimer = null;
        // Clear any ongoing fade intervals
        fadeIntervals.forEach(i => clearInterval(i));
        fadeIntervals = [];
        // Pause BOTH audio elements (active + inactive)
        backgroundMusic.pause();
        backgroundMusic.volume = 0;
        backgroundMusicClone.pause();
        backgroundMusicClone.volume = 0;
    };

    window.startMusic = function () {
        // Only start if not already playing
        if (!active.paused) return;
        active.currentTime = START_TIME;
        active.volume = 0;
        active.play().then(() => {
            fade(active, 0, 1, FADE_DURATION);
            scheduleNextLoop(active);
        }).catch(() => {});
    };
}

/*********************
* MARQUEE BAR SETUP *
*********************/

const marqueeContent = document.querySelector('.marquee-content');
const marqueeText = document.querySelector('.marquee-text');

if (marqueeContent && marqueeText) {
    const clonedText = marqueeText.cloneNode(true);
    marqueeContent.appendChild(clonedText);
}

/*********************
* RESPONSIVE WARNING *
*********************/

const responsiveWarning = document.getElementById("responsive-warning");
const responsiveDesign = false;

if (!responsiveDesign && window.innerWidth <= 768) {
    responsiveWarning.classList.add("show");
}

/***********************
* MODE TOGGLE BEHAVIOR *
***********************/

const toggleModeBtn = document.getElementById("toggle-mode-btn");
const body = document.body;

function applyMode(mode) {
    body.classList.remove("light-mode", "dark-mode");
    body.classList.add(mode);

    if (mode === "dark-mode") {
        toggleModeBtn.style.color = "rgb(245, 245, 245)";
        toggleModeBtn.innerHTML = '<i class="bi bi-sun-fill"></i>';
        responsiveWarning.style.backgroundColor = "rgb(2, 4, 8)";
    } else {
        toggleModeBtn.style.color = "rgb(2, 4, 8)";
        toggleModeBtn.innerHTML = '<i class="bi bi-moon-stars-fill"></i>';
        responsiveWarning.style.backgroundColor = "rgb(245, 245, 245)";
    }
}

let savedMode = localStorage.getItem("mode") || "light-mode";
applyMode(savedMode);

toggleModeBtn.addEventListener("click", () => {
    const newMode = body.classList.contains("light-mode")
        ? "dark-mode"
        : "light-mode";

    applyMode(newMode);
    localStorage.setItem("mode", newMode);
});

/*********************
* VISIBILITY SAFETY NET *
* Mute everything when the browser tab is hidden
*********************/

document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
        if (window.stopMusic) window.stopMusic();
        if (window.stopAds) window.stopAds();
    }
});
