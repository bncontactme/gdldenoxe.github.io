/*********************
* ADVERTISEMENT SYSTEM *
*********************/

const adAudio = document.getElementById("ad-audio");
const AD_INTERVAL_MINUTES = 2; // Play ads every 2 minutes
const AD_VOLUME_RATIO = 0.35; // 35% of background music volume
let adTimer = null;
let adsList = ['Anuncio1.mp3']; // Will be expanded later

if (adAudio) {
    // Set initial volume
    adAudio.volume = 0;

    // Function to play random advertisement (overlays on background music)
    function playRandomAd() {
        const backgroundMusic = document.getElementById("background-music");
        if (backgroundMusic) { // No need to check if background is playing, ads play over it
            // Set ad volume to 35% of current background volume
            adAudio.volume = backgroundMusic.volume * AD_VOLUME_RATIO;

            // Reset to beginning and play over background music
            adAudio.currentTime = 0;
            adAudio.play().catch(function(error) {
                console.log("Ad autoplay blocked:", error);
            });
        }
    }

    // Schedule next advertisement (random timing within 2 minutes)
    function scheduleNextAd() {
        // Random time between 1.5 and 2.5 minutes to avoid predictability
        const randomDelay = (1.5 + Math.random()) * 60 * 1000; // Convert to milliseconds

        if (adTimer) {
            clearTimeout(adTimer);
        }

        adTimer = setTimeout(function() {
            playRandomAd();
            scheduleNextAd(); // Schedule the next one
        }, randomDelay);
    }

    // Global function to start ads (will be called from background music section)
    window.startAds = function() {
        setTimeout(scheduleNextAd, 30000); // Start ads after 30 seconds
    };
}

/*********************
* BACKGROUND MUSIC *
*********************/

const backgroundMusic = document.getElementById("background-music");
const START_TIME = 5; // Start from second 5
const END_OFFSET = 5; // Cut 5 seconds before the end
const FADE_DURATION = 7; // 7-second fade in/out duration for smooth transitions

if (backgroundMusic) {
    let duration = 0;
    let endTime = 0;
    let fadeInterval = null;
    
    // Set initial volume
    backgroundMusic.volume = 0;
    
    // Wait for metadata to load to get duration
    backgroundMusic.addEventListener('loadedmetadata', function() {
        duration = backgroundMusic.duration;
        endTime = duration - END_OFFSET;
        
        // Set initial start time
        backgroundMusic.currentTime = START_TIME;
        
        // Start playing
        backgroundMusic.play().then(function() {
            console.log("Background music started successfully");
            // Start ads after music begins
            if (window.startAds) {
                window.startAds();
            }
        }).catch(function(error) {
            // Autoplay might be blocked, user will need to interact first
            console.log("Background music autoplay blocked. Click to start:", error);
        });
    });
    
    // Create TRUE overlap: fade out and fade in happen simultaneously
    function updateVolume() {
        if (fadeInterval) {
            clearInterval(fadeInterval);
        }

        fadeInterval = setInterval(function() {
            const currentTime = backgroundMusic.currentTime;

            // Calculate overlap zone (last 7 seconds before end)
            const overlapZoneStart = endTime - FADE_DURATION;

            // Check if we're in the overlap zone where BOTH fades happen simultaneously
            if (currentTime >= overlapZoneStart && currentTime <= endTime) {
                // Calculate how far we are through the overlap zone
                const overlapProgress = (currentTime - overlapZoneStart) / FADE_DURATION;

                // During overlap: fade out the ending AND fade in the beginning simultaneously
                // This creates a smooth crossfade without any silence or cut

                const fadeOutVolume = Math.max(0, 1 - overlapProgress); // Fade out to 0
                const fadeInVolume = Math.min(1, overlapProgress); // Fade in from 0

                // The magic: blend both volumes during the overlap
                // At overlapProgress = 0: 100% fade out volume, 0% fade in volume
                // At overlapProgress = 1: 0% fade out volume, 100% fade in volume
                // In between: smooth crossfade
                backgroundMusic.volume = fadeOutVolume * (1 - overlapProgress) + fadeInVolume * overlapProgress;

            } else {
                // Normal operation outside overlap zone
                const timeFromStart = currentTime - START_TIME;

                if (timeFromStart >= 0 && timeFromStart <= FADE_DURATION) {
                    // Fade in at the beginning
                    const fadeInProgress = timeFromStart / FADE_DURATION;
                    backgroundMusic.volume = Math.min(1, fadeInProgress);
                } else if (currentTime > START_TIME + FADE_DURATION && currentTime < overlapZoneStart) {
                    // Full volume in the middle section
                    backgroundMusic.volume = 1;
                }
            }
        }, 50);
    }
    
    // Listen for time updates - the overlap handles the loop seamlessly
    backgroundMusic.addEventListener('timeupdate', function() {
        const currentTime = backgroundMusic.currentTime;

        // When we reach the end, the overlap has already created smooth transition
        if (currentTime >= endTime) {
            // Jump back to start - volume is already managed by the overlap above
            backgroundMusic.currentTime = START_TIME;
        }
    });
    
    // Start volume management
    updateVolume();
    
    // Handle user interaction to start music if autoplay was blocked
    document.addEventListener('click', function() {
        console.log("User clicked - attempting to start audio");
        if (backgroundMusic.paused && backgroundMusic.readyState >= 2) {
            console.log("Starting background music");
            backgroundMusic.currentTime = START_TIME;
            backgroundMusic.volume = 0;
            backgroundMusic.play().then(function() {
                console.log("Background music started from user interaction");
                if (window.startAds) {
                    window.startAds();
                }
            }).catch(function(error) {
                console.log("Failed to start background music:", error);
            });
        }
    }, { once: true });
}

/*********************
* MARQUEE BAR SETUP *
*********************/

const marqueeContent = document.querySelector('.marquee-content');
const marqueeText = document.querySelector('.marquee-text');

if (marqueeContent && marqueeText) {
    // Duplicate text for seamless scrolling
    const text = marqueeText.textContent;
    marqueeContent.setAttribute('data-text', text);
    
    // Clone the text element for seamless loop
    const clonedText = marqueeText.cloneNode(true);
    marqueeContent.appendChild(clonedText);
}

/*********************
* RESPONSIVE WARNING *
*********************/

const responsiveWarning = document.getElementById("responsive-warning");
// "true" if the site is optimized for responsive design, "false" if not.
const responsiveDesign = false;

// Show mobile warning if the user is on mobile and responsive-design is false.
if (!responsiveDesign && window.innerWidth <= 768) {
	responsiveWarning.classList.add("show");
}


/***********************
* MODE TOGGLE BEHAVIOR *
***********************/

// Get elements that change with the mode.
const toggleModeBtn = document.getElementById("toggle-mode-btn");
const body = document.body;

// Function to apply mode.
function applyMode(mode) {
	body.classList.remove("light-mode", "dark-mode");
	body.classList.add(mode);

	if (mode === "dark-mode") {
		// Set dark mode styles.
		toggleModeBtn.style.color = "rgb(245, 245, 245)";
		toggleModeBtn.innerHTML = '<i class="bi bi-sun-fill"></i>';

		responsiveWarning.style.backgroundColor = "rgb(2, 4, 8)";
	} else {
		// Set light mode styles.
		toggleModeBtn.style.color = "rgb(2, 4, 8)";
		toggleModeBtn.innerHTML = '<i class="bi bi-moon-stars-fill"></i>';

		responsiveWarning.style.backgroundColor = "rgb(245, 245, 245)";
	}
}

// Check and apply saved mode on page load
let savedMode = localStorage.getItem("mode");

if (savedMode === null) {
	savedMode = "light-mode"; // Default mode.
}
applyMode(savedMode);

// Toggle mode and save preference.
toggleModeBtn.addEventListener("click", function () {
	let newMode;

	if (body.classList.contains("light-mode")) {
		newMode = "dark-mode";
	} else {
		newMode = "light-mode";
	}

	applyMode(newMode);

	// Save choice.
	localStorage.setItem("mode", newMode);
});