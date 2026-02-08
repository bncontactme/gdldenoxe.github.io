/***********************
 * ADVERTISEMENT SYSTEM *
 ***********************/

const adAudio = document.getElementById('ad-audio');
const AD_VOLUME_RATIO = 0.35;
let adTimer = null;

if (adAudio) {
    adAudio.volume = 0;

    const playRandomAd = () => {
        if (document.hidden) return;
        const bgMusic = document.getElementById('background-music');
        if (bgMusic && !bgMusic.paused) {
            adAudio.volume = bgMusic.volume * AD_VOLUME_RATIO;
            adAudio.currentTime = 0;
            adAudio.play().catch(() => {});
        }
    };

    const scheduleNextAd = () => {
        const delay = (1.5 + Math.random()) * 60 * 1000;
        clearTimeout(adTimer);
        adTimer = setTimeout(() => {
            playRandomAd();
            scheduleNextAd();
        }, delay);
    };

    window.stopAds = () => {
        clearTimeout(adTimer);
        adTimer = null;
        adAudio.pause();
        adAudio.currentTime = 0;
    };

    window.startAds = () => {
        clearTimeout(adTimer);
        setTimeout(scheduleNextAd, 30000);
    };
}

/*****************************
 * BACKGROUND MUSIC (CROSSFADE)
 *****************************/

const backgroundMusic = document.getElementById('background-music');
const START_TIME = 5;
const END_OFFSET = 5;
const FADE_DURATION = 7;

if (backgroundMusic) {
    const bgClone = backgroundMusic.cloneNode(true);
    backgroundMusic.parentNode.appendChild(bgClone);

    let active = backgroundMusic;
    let inactive = bgClone;
    let crossfadeTimer = null;
    let fadeIntervals = [];

    const fade = (audio, from, to, duration) => {
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
    };

    const scheduleNextLoop = (audio) => {
        const delay = (audio.duration - END_OFFSET - FADE_DURATION) * 1000;
        clearTimeout(crossfadeTimer);
        crossfadeTimer = setTimeout(crossfade, delay);
    };

    const crossfade = () => {
        inactive.currentTime = START_TIME;
        inactive.play();
        fade(inactive, 0, 1, FADE_DURATION);
        fade(active, 1, 0, FADE_DURATION);
        [active, inactive] = [inactive, active];
        scheduleNextLoop(active);
    };

    backgroundMusic.volume = 0;
    bgClone.volume = 0;

    window.stopMusic = () => {
        clearTimeout(crossfadeTimer);
        crossfadeTimer = null;
        fadeIntervals.forEach(i => clearInterval(i));
        fadeIntervals = [];
        backgroundMusic.pause();
        backgroundMusic.volume = 0;
        bgClone.pause();
        bgClone.volume = 0;
    };

    window.startMusic = () => {
        if (!active.paused) return;
        active.currentTime = START_TIME;
        active.volume = 0;
        active.play().then(() => {
            fade(active, 0, 1, FADE_DURATION);
            scheduleNextLoop(active);
        }).catch(() => {});
    };
}

/******************
 * MARQUEE BAR SETUP
 ******************/

const marqueeContent = document.querySelector('.marquee-content');
const marqueeText = document.querySelector('.marquee-text');

if (marqueeContent && marqueeText) {
    marqueeContent.appendChild(marqueeText.cloneNode(true));
}

/********************
 * RESPONSIVE WARNING
 ********************/

const responsiveWarning = document.getElementById('responsive-warning');

if (responsiveWarning && window.innerWidth <= 768) {
    responsiveWarning.classList.add('show');
}

/**********************
 * MODE TOGGLE BEHAVIOR
 **********************/

const toggleModeBtn = document.getElementById('toggle-mode-btn');
const body = document.body;

const applyMode = (mode) => {
    body.classList.remove('light-mode', 'dark-mode');
    body.classList.add(mode);

    const isDark = mode === 'dark-mode';
    toggleModeBtn.style.color = isDark ? 'rgb(245, 245, 245)' : 'rgb(2, 4, 8)';
    toggleModeBtn.innerHTML = isDark ? '<i class="bi bi-sun-fill"></i>' : '<i class="bi bi-moon-stars-fill"></i>';
    if (responsiveWarning) {
        responsiveWarning.style.backgroundColor = isDark ? 'rgb(2, 4, 8)' : 'rgb(245, 245, 245)';
    }
};

if (toggleModeBtn) {
    applyMode(localStorage.getItem('mode') || 'light-mode');

    toggleModeBtn.addEventListener('click', () => {
        const newMode = body.classList.contains('light-mode') ? 'dark-mode' : 'light-mode';
        applyMode(newMode);
        localStorage.setItem('mode', newMode);
    });
}

/************************
 * VISIBILITY SAFETY NET
 ************************/

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        window.stopMusic?.();
        window.stopAds?.();
    }
});
