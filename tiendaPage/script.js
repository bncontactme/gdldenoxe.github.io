/***********************
 * ADVERTISEMENT SYSTEM *
 ***********************/

(() => {
    const adAudio = document.getElementById('ad-audio');
    if (!adAudio) return;

    const AD_VOLUME_RATIO = 0.35;
    let adTimer = null;

    const playRandomAd = () => {
        if (document.hidden) return;
        const bgMusic = document.getElementById('background-music');
        if (bgMusic?.paused === false) {
            adAudio.volume = bgMusic.volume * AD_VOLUME_RATIO;
            adAudio.currentTime = 0;
            adAudio.play().catch(() => {});
        }
    };

    const scheduleNextAd = () => {
        const delay = (90 + Math.random() * 60) * 1000;
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
        adTimer = setTimeout(scheduleNextAd, 30000);
    };
})();

/*****************************
 * BACKGROUND MUSIC (CROSSFADE)
 *****************************/

(() => {
    const backgroundMusic = document.getElementById('background-music');
    if (!backgroundMusic) return;

    const START_TIME = 5;
    const END_OFFSET = 5;
    const FADE_DURATION = 7;
    const FADE_STEPS = 30;

    const bgClone = backgroundMusic.cloneNode(true);
    backgroundMusic.parentNode.appendChild(bgClone);

    let active = backgroundMusic;
    let inactive = bgClone;
    let crossfadeTimer = null;
    const fadeIntervals = new Set();

    const fade = (audio, from, to, duration) => {
        const stepTime = (duration * 1000) / FADE_STEPS;
        const step = (to - from) / FADE_STEPS;
        let volume = from;
        audio.volume = from;

        const interval = setInterval(() => {
            volume += step;
            audio.volume = Math.max(0, Math.min(1, volume));
            if ((step > 0 && volume >= to) || (step < 0 && volume <= to)) {
                audio.volume = to;
                clearInterval(interval);
                fadeIntervals.delete(interval);
            }
        }, stepTime);
        fadeIntervals.add(interval);
    };

    const scheduleNextLoop = (audio) => {
        const delay = Math.max(0, (audio.duration - END_OFFSET - FADE_DURATION) * 1000);
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
        fadeIntervals.forEach(clearInterval);
        fadeIntervals.clear();
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
})();

/******************
 * MARQUEE BAR SETUP
 ******************/

(() => {
    const marqueeContent = document.querySelector('.marquee-content');
    const marqueeText = document.querySelector('.marquee-text');
    if (marqueeContent && marqueeText) {
        marqueeContent.appendChild(marqueeText.cloneNode(true));
    }
})();

/**********************
 * MODE TOGGLE BEHAVIOR
 **********************/

(() => {
    const toggleModeBtn = document.getElementById('toggle-mode-btn');
    const responsiveWarning = document.getElementById('responsive-warning');
    if (!toggleModeBtn) return;

    const { body } = document;
    const LIGHT = 'light-mode';
    const DARK = 'dark-mode';

    const applyMode = (mode) => {
        body.classList.remove(LIGHT, DARK);
        body.classList.add(mode);

        const isDark = mode === DARK;
        toggleModeBtn.style.color = isDark ? '#f5f5f5' : '#020408';
        toggleModeBtn.innerHTML = `<i class="bi bi-${isDark ? 'sun-fill' : 'moon-stars-fill'}"></i>`;
        if (responsiveWarning) {
            responsiveWarning.style.backgroundColor = isDark ? '#020408' : '#f5f5f5';
        }
    };

    applyMode(localStorage.getItem('mode') || LIGHT);

    toggleModeBtn.addEventListener('click', () => {
        const newMode = body.classList.contains(LIGHT) ? DARK : LIGHT;
        applyMode(newMode);
        localStorage.setItem('mode', newMode);
    });

    // Show responsive warning on mobile
    if (responsiveWarning && window.innerWidth <= 768) {
        responsiveWarning.classList.add('show');
    }
})();

/************************
 * VISIBILITY SAFETY NET
 ************************/

document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
        window.stopMusic?.();
        window.stopAds?.();
    }
}, { passive: true });
