/*********************
* BACKGROUND MUSIC *
*********************/

const backgroundMusic = document.getElementById("background-music");
const START_TIME = 5; // Start from second 5
const END_OFFSET = 5; // Cut 5 seconds before the end
const FADE_DURATION = 1.5; // Fade in/out duration in seconds
const OVERLAP_DURATION = 0.5; // Overlap duration for smooth transition

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
        backgroundMusic.play().catch(function(error) {
            // Autoplay might be blocked, user will need to interact first
            console.log("Autoplay blocked. User interaction required.");
        });
    });
    
    // Update volume based on current time
    function updateVolume() {
        if (fadeInterval) {
            clearInterval(fadeInterval);
        }
        
        fadeInterval = setInterval(function() {
            const currentTime = backgroundMusic.currentTime;
            const fadeOutStart = endTime - FADE_DURATION;
            const fadeInEnd = START_TIME + FADE_DURATION;
            
            // Handle fade in at the start
            if (currentTime >= START_TIME && currentTime <= fadeInEnd) {
                const progress = (currentTime - START_TIME) / FADE_DURATION;
                // Start from a small volume for overlap (not 0)
                const overlapVolume = OVERLAP_DURATION / FADE_DURATION * 0.3;
                backgroundMusic.volume = overlapVolume + (1 - overlapVolume) * progress;
            }
            // Handle fade out before the end
            else if (currentTime >= fadeOutStart && currentTime <= endTime) {
                const progress = (currentTime - fadeOutStart) / FADE_DURATION;
                // End at a small volume for overlap (not 0)
                const overlapVolume = OVERLAP_DURATION / FADE_DURATION * 0.3;
                backgroundMusic.volume = 1 - (1 - overlapVolume) * progress;
            }
            // Full volume in the middle
            else if (currentTime > fadeInEnd && currentTime < fadeOutStart) {
                backgroundMusic.volume = 1;
            }
        }, 50);
    }
    
    // Listen for time updates to create seamless loop with fade
    backgroundMusic.addEventListener('timeupdate', function() {
        const currentTime = backgroundMusic.currentTime;
        
        // If we've reached the end time, loop back to start
        if (currentTime >= endTime) {
            // Set volume to overlap level before jumping
            const overlapVolume = OVERLAP_DURATION / FADE_DURATION * 0.3;
            backgroundMusic.volume = overlapVolume;
            backgroundMusic.currentTime = START_TIME;
            // Volume will continue to fade in from overlap level
        }
    });
    
    // Start volume management
    updateVolume();
    
    // Handle user interaction to start music if autoplay was blocked
    document.addEventListener('click', function() {
        if (backgroundMusic.paused && backgroundMusic.readyState >= 2) {
            backgroundMusic.currentTime = START_TIME;
            backgroundMusic.volume = 0;
            backgroundMusic.play();
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