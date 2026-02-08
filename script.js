// Funcionalidad para el dashboard estilo Windows 95

document.addEventListener('DOMContentLoaded', () => {
    
    let highestZIndex = 100;
    let draggedWindow = null;
    let offsetX = 0;
    let offsetY = 0;

    // Funciones para controlar audio de tienda
    function pauseTiendaAudio() {
        try {
            const tiendaIframe = document.getElementById('tienda-iframe');
            if (tiendaIframe && tiendaIframe.contentWindow) {
                const audio = tiendaIframe.contentWindow.document.getElementById('background-music');
                const adAudio = tiendaIframe.contentWindow.document.getElementById('ad-audio');
                if (audio) {
                    audio.pause();
                }
                if (adAudio) {
                    adAudio.pause();
                }
            }
        } catch (e) {
            // Ignorar errores de cross-origin
        }
    }

    function playTiendaAudio() {
        try {
            const tiendaIframe = document.getElementById('tienda-iframe');
            if (tiendaIframe && tiendaIframe.contentWindow) {
                const audio = tiendaIframe.contentWindow.document.getElementById('background-music');
                if (audio) {
                    audio.muted = false; // Quitar mute
                    audio.volume = 0.15; // 15% del volumen
                    // Iniciar en un punto aleatorio (entre 0 y la duración del audio)
                    if (audio.duration && !isNaN(audio.duration)) {
                        audio.currentTime = Math.random() * audio.duration;
                    }
                    audio.play();
                }
            }
        } catch (e) {
            // Ignorar errores de cross-origin
        }
    }

    // Pausar audio de tienda al cargar
    setTimeout(() => {
        const tiendaWindow = document.querySelector('[data-window-id="tienda"]');
        if (tiendaWindow && tiendaWindow.classList.contains('hidden')) {
            pauseTiendaAudio();
        }
    }, 1000);

    // Funcionalidad de iconos del escritorio
    const desktopIcons = document.querySelectorAll('.desktop-icon');
    let selectedIcon = null;

    desktopIcons.forEach(icon => {
        icon.addEventListener('click', (e) => {
            e.stopPropagation();
            // Deseleccionar todos
            desktopIcons.forEach(i => i.classList.remove('selected'));
            // Seleccionar este
            icon.classList.add('selected');
            selectedIcon = icon;
        });

        icon.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            const link = icon.dataset.link;
            const folder = icon.dataset.folder;
            
            if (link) {
                window.location.href = link;
            } else if (folder === 'articulos') {
                // Abrir ventana de carpeta de artículos
                const folderWindow = document.querySelector('[data-window-id="folder-articulos"]');
                if (folderWindow) {
                    folderWindow.classList.remove('hidden', 'minimized');
                    bringToFront(folderWindow);
                    updateTaskbar();
                }
            } else if (folder === 'galeria') {
                // Abrir ventana de galería
                const galeriaWindow = document.querySelector('[data-window-id="galeria"]');
                if (galeriaWindow) {
                    galeriaWindow.classList.remove('hidden', 'minimized');
                    bringToFront(galeriaWindow);
                    updateTaskbar();
                }
            } else if (folder === 'tienda') {
                // Abrir ventana de tienda
                const tiendaWindow = document.querySelector('[data-window-id="tienda"]');
                if (tiendaWindow) {
                    // Posicionar aleatoriamente antes de mostrar
                    const screenWidth = globalThis.innerWidth;
                    const screenHeight = globalThis.innerHeight;
                    const windowWidth = 750; // Ancho de la tienda
                    const windowHeight = 650; // Alto de la tienda
                    const taskbarHeight = 40;
                    const iconAreaWidth = 150;
                    
                    const x = Math.random() * (screenWidth - windowWidth - iconAreaWidth - 100) + iconAreaWidth + 50;
                    const y = Math.random() * (screenHeight - windowHeight - taskbarHeight - 100) + 30;
                    
                    // Asegurar que no toque los bordes ni la taskbar
                    tiendaWindow.style.left = Math.floor(Math.max(iconAreaWidth + 50, Math.min(x, screenWidth - windowWidth - 20))) + 'px';
                    tiendaWindow.style.top = Math.floor(Math.max(30, Math.min(y, screenHeight - windowHeight - taskbarHeight - 20))) + 'px';
                    
                    tiendaWindow.classList.remove('hidden', 'minimized');
                    bringToFront(tiendaWindow);
                    updateTaskbar();
                    // Reproducir audio cuando se abre
                    setTimeout(() => playTiendaAudio(), 500);
                }
            }
        });
    });

    // Funcionalidad de carpeta de artículos
    const folderItems = document.querySelectorAll('.folder-item');
    let selectedFolderItem = null;

    folderItems.forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            folderItems.forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
            selectedFolderItem = item;
        });

        item.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            const articleId = item.dataset.openArticle;
            const articleWindow = document.querySelector(`[data-window-id="${articleId}"]`);
            
            if (articleWindow) {
                articleWindow.classList.remove('hidden', 'minimized');
                bringToFront(articleWindow);
                updateTaskbar();
            }
        });
    });

    // Deseleccionar al hacer click en el escritorio
    document.querySelector('.desktop').addEventListener('click', () => {
        desktopIcons.forEach(i => i.classList.remove('selected'));
        selectedIcon = null;
    });

    // Deseleccionar items de carpeta al hacer click en window-body
    document.querySelectorAll('.folder-content').forEach(folder => {
        folder.addEventListener('click', (e) => {
            if (e.target === folder) {
                folderItems.forEach(i => i.classList.remove('selected'));
                selectedFolderItem = null;
            }
        });
    });

    // Funcionalidad de imagen random
    const imagePaths = [
        "indexPage/indexImages/2 Intro.jpeg",
        "indexPage/indexImages/3 Intro.jpeg",
        "indexPage/indexImages/4 Intro.jpeg",
        "indexPage/indexImages/6 Intro.jpeg",
        "indexPage/indexImages/7 Intro.JPG"
    ];

    function loadRandomImage() {
        const randomImage = imagePaths[Math.floor(Math.random() * imagePaths.length)];
        document.getElementById('randomWindowImage').src = randomImage;
    }

    // Cargar imagen inicial
    loadRandomImage();

    // Cargar imágenes random para artículos
    const articleImages = document.querySelectorAll('.article-random-img');
    articleImages.forEach(img => {
        const randomImage = imagePaths[Math.floor(Math.random() * imagePaths.length)];
        img.src = randomImage;
    });

    // Sistema de poemas random
    const poemas = [
        `En la noche tapatía,
donde el mezcal fluye libre,
las calles cobran vida
y el alma se vuelve fibre.

Entre luces y neones,
historias se van tejiendo,
la ciudad que no duerme
sigue su ritmo creciendo.`,

        `Después de las doce,
cuando la luna se asoma,
Guadalajara despierta
con su propio idioma.

De Chapultepec al centro,
la movida está encendida,
cada rincón un encuentro,
cada encuentro una vida.`,

        `Tacos al pastor a las tres,
amistades que nacen al azar,
la noche tapatía es
un eterno despertar.

No hay reloj que nos detenga,
ni mañana que nos asuste,
somos dueños del momento
antes de que el día nos ajuste.`,

        `En cada bar una historia,
en cada copa un sueño,
GDL de noche es gloria,
puro pinche diseño.

Underground o mainstream,
todos somos iguales,
cuando cae la noche, wey,
no existen los niveles.`,

        `La ciudad respira trap,
respira corridos, respira amor,
desde San Juan hasta Tlaquepaque
todo es puro sabor.

Aquí no hay pretensiones,
solo ganas de vivir,
Guadalajara de noche
es imposible de describir.`,

        `Cuando el sol se despide
y las estrellas aparecen,
los que saben, saben
dónde las cosas suceden.

No está en el mapa,
no está en Google tampoco,
está en el corazón
de los que viven el rollo loco.`
    ];

    // Cargar poemas random en los frames
    const poemTexts = document.querySelectorAll('.poem-text');
    poemTexts.forEach(poemElement => {
        const randomPoem = poemas[Math.floor(Math.random() * poemas.length)];
        poemElement.textContent = randomPoem;
    });

    // Posicionar ventanas aleatoriamente al inicio
    function randomizeWindowPositions() {
        const windows = document.querySelectorAll('.win95-window:not(.hidden)');
        const screenWidth = globalThis.innerWidth;
        const screenHeight = globalThis.innerHeight;
        const windowWidth = 420;
        const windowHeight = 500;
        const iconAreaWidth = 150; // Espacio reservado para iconos a la izquierda
        const minPadding = 50; // Espacio mínimo entre ventanas
        const taskbarHeight = 40; // Altura de la barra de tareas
        const positions = [];
        
        windows.forEach(win => {
            let x, y, hasOverlap;
            let attempts = 0;
            
            do {
                // Solo posicionar en el lado derecho (después del área de iconos)
                x = Math.random() * (screenWidth - windowWidth - iconAreaWidth - 100) + iconAreaWidth + 50;
                y = Math.random() * (screenHeight - windowHeight - taskbarHeight - 100) + 30;
                
                // Asegurar que no toque los bordes ni la taskbar
                x = Math.max(iconAreaWidth + 50, Math.min(x, screenWidth - windowWidth - 20));
                y = Math.max(30, Math.min(y, screenHeight - windowHeight - taskbarHeight - 20));
                
                // Verificar que no se superponga con ninguna ventana ya colocada
                hasOverlap = positions.some(pos => {
                    const dx = Math.abs(pos.x - x);
                    const dy = Math.abs(pos.y - y);
                    // Usar distancia para asegurar separación
                    return dx < (windowWidth + minPadding) && dy < (windowHeight + minPadding);
                });
                
                attempts++;
            } while (hasOverlap && attempts < 300);
            
            positions.push({ x, y });
            win.style.left = Math.floor(x) + 'px';
            win.style.top = Math.floor(y) + 'px';
        });
    }

    // Hacer las ventanas arrastrables
    function makeDraggable(windowElement) {
        const titleBar = windowElement.querySelector('.title-bar');
        
        titleBar.addEventListener('mousedown', (e) => {
            if (e.target.closest('.title-bar-controls')) return;
            
            draggedWindow = windowElement;
            offsetX = e.clientX - windowElement.offsetLeft;
            offsetY = e.clientY - windowElement.offsetTop;
            
            bringToFront(windowElement);
            
            e.preventDefault();
        });
    }

    document.addEventListener('mousemove', (e) => {
        if (!draggedWindow) return;
        
        const x = e.clientX - offsetX;
        const y = e.clientY - offsetY;
        
        const maxX = window.innerWidth - draggedWindow.offsetWidth;
        const maxY = window.innerHeight - draggedWindow.offsetHeight - 40;
        
        draggedWindow.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
        draggedWindow.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
    });

    document.addEventListener('mouseup', () => {
        draggedWindow = null;
    });

    // Traer ventana al frente
    function bringToFront(windowElement) {
        document.querySelectorAll('.win95-window').forEach(w => w.classList.remove('active'));
        windowElement.classList.add('active');
        highestZIndex++;
        windowElement.style.zIndex = highestZIndex;
        updateTaskbar();
    }

    // Click en ventana para traerla al frente
    document.querySelectorAll('.win95-window').forEach(windowElement => {
        makeDraggable(windowElement);
        
        windowElement.addEventListener('mousedown', () => {
            bringToFront(windowElement);
        });
    });

    // Funcionalidad del botón cerrar
    document.querySelectorAll('.close-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const window = btn.closest('.win95-window');
            window.classList.add('hidden');
            
            // Pausar audio de tienda si se cierra
            if (window.dataset.windowId === 'tienda') {
                pauseTiendaAudio();
            }
            
            // Cerrar panel de detalles si se cierra la galería
            if (window.dataset.windowId === 'galeria') {
                const dp = document.getElementById('win95-details-panel');
                if (dp) { dp.classList.remove('open'); dp.setAttribute('aria-hidden', 'true'); }
            }
            
            updateTaskbar();
        });
    });

    // Funcionalidad del botón minimizar
    document.querySelectorAll('.minimize-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const window = btn.closest('.win95-window');
            window.classList.add('minimized');
            
            // Pausar audio de tienda si se minimiza
            if (window.dataset.windowId === 'tienda') {
                pauseTiendaAudio();
            }
            
            updateTaskbar();
        });
    });

    // Funcionalidad del botón maximizar
    document.querySelectorAll('.maximize-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const window = btn.closest('.win95-window');
            window.classList.toggle('maximized');
            
            if (window.classList.contains('maximized')) {
                // Guardar posición y tamaño original
                window.dataset.originalLeft = window.style.left;
                window.dataset.originalTop = window.style.top;
                window.dataset.originalWidth = window.style.width || '';
                
                // Maximizar
                window.style.left = '0';
                window.style.top = '0';
                window.style.width = '100%';
                window.style.height = 'calc(100vh - 40px)';
            } else {
                // Restaurar posición y tamaño original
                window.style.left = window.dataset.originalLeft;
                window.style.top = window.dataset.originalTop;
                window.style.width = window.dataset.originalWidth;
                window.style.height = '';
            }
        });
    });

    // Funcionalidad del botón "Leer más"
    document.querySelectorAll('.read-more-btn').forEach((btn, index) => {
        btn.addEventListener('click', () => {
            const articleNum = index + 1;
            window.location.href = `articulosPage/articulo${articleNum}.html`;
        });
    });

    // Barra de tareas
    function updateTaskbar() {
        const taskbarItems = document.getElementById('taskbar-items');
        taskbarItems.innerHTML = '';
        
        document.querySelectorAll('.win95-window:not(.hidden)').forEach(window => {
            const windowId = window.dataset.windowId;
            const title = window.querySelector('.title-bar-text').textContent;
            const isActive = window.classList.contains('active');
            
            const item = document.createElement('button');
            item.className = 'taskbar-item' + (isActive ? ' active' : '');
            item.textContent = title;
            item.addEventListener('click', () => {
                if (window.classList.contains('minimized')) {
                    window.classList.remove('minimized');
                    // Reproducir audio si es tienda
                    if (window.dataset.windowId === 'tienda') {
                        setTimeout(() => playTiendaAudio(), 500);
                    }
                }
                bringToFront(window);
            });
            
            taskbarItems.appendChild(item);
        });
    }

    // Menú de inicio
    const startButton = document.querySelector('.start-button');
    const startMenu = document.getElementById('start-menu');

    startButton.addEventListener('click', (e) => {
        e.stopPropagation();
        startMenu.classList.toggle('active');
        startButton.classList.toggle('active');
    });

    document.addEventListener('click', (e) => {
        if (!startMenu.contains(e.target) && !startButton.contains(e.target)) {
            startMenu.classList.remove('active');
            startButton.classList.remove('active');
        }
    });

    // Elementos del menú
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', () => {
            const shortcut = item.dataset.shortcut;
            
            if (shortcut === 'galeria') {
                const galeriaWindow = document.querySelector('[data-window-id="galeria"]');
                if (galeriaWindow) {
                    galeriaWindow.classList.remove('hidden', 'minimized');
                    bringToFront(galeriaWindow);
                }
            } else if (shortcut === 'tienda') {
                const tiendaWindow = document.querySelector('[data-window-id="tienda"]');
                if (tiendaWindow) {
                    // Posicionar aleatoriamente
                    const screenWidth = globalThis.innerWidth;
                    const screenHeight = globalThis.innerHeight;
                    const windowWidth = 750;
                    const windowHeight = 650;
                    const taskbarHeight = 40;
                    const iconAreaWidth = 150;
                    
                    const x = Math.random() * (screenWidth - windowWidth - iconAreaWidth - 100) + iconAreaWidth + 50;
                    const y = Math.random() * (screenHeight - windowHeight - taskbarHeight - 100) + 30;
                    
                    tiendaWindow.style.left = Math.floor(Math.max(iconAreaWidth + 50, Math.min(x, screenWidth - windowWidth - 20))) + 'px';
                    tiendaWindow.style.top = Math.floor(Math.max(30, Math.min(y, screenHeight - windowHeight - taskbarHeight - 20))) + 'px';
                    
                    tiendaWindow.classList.remove('hidden', 'minimized');
                    bringToFront(tiendaWindow);
                    setTimeout(() => playTiendaAudio(), 500);
                }
            } else if (shortcut === 'articulos') {
                const folderWindow = document.querySelector('[data-window-id="folder-articulos"]');
                if (folderWindow) {
                    folderWindow.classList.remove('hidden', 'minimized');
                    bringToFront(folderWindow);
                }
            } else if (shortcut === 'links') {
                window.location.href = 'https://linktr.ee/guadalajaradenoche';
            } else if (shortcut === 'minesweeper') {
                const minesweeperWindow = document.querySelector('[data-window-id="minesweeper"]');
                if (minesweeperWindow) {
                    minesweeperWindow.classList.remove('hidden', 'minimized');
                    bringToFront(minesweeperWindow);
                }
            } else if (shortcut === 'radio') {
                musicPlayer.classList.remove('hidden');
                const radioBtn = document.getElementById('taskbar-radio');
                if (radioBtn) radioBtn.remove();
            }
            
            startMenu.classList.remove('active');
            startButton.classList.remove('active');
            updateTaskbar();
        });
    });

    // Reloj
    function updateClock() {
        const clock = document.getElementById('clock');
        const now = new Date();
        const hours = now.getHours() % 12 || 12;
        const minutes = now.getMinutes().toString().padStart(2, '0');
        const ampm = now.getHours() >= 12 ? 'PM' : 'AM';
        clock.textContent = `${hours}:${minutes} ${ampm}`;
    }

    updateClock();
    setInterval(updateClock, 1000);

    // Inicializar taskbar
    updateTaskbar();
    
    // Posicionar ventanas aleatoriamente
    randomizeWindowPositions();

    // ==================== REPRODUCTOR DE MÚSICA ====================
    
    const musicPlayer = document.getElementById('musicPlayer');
    const playBtn = document.getElementById('playBtn');
    const prevBtn = document.getElementById('prevBtn');
    const nextBtn = document.getElementById('nextBtn');
    const stopBtn = document.getElementById('stopBtn');
    const progressFill = document.getElementById('progressFill');
    const trackInfo = document.getElementById('trackInfo');
    const timeDisplay = document.getElementById('timeDisplay');
    const playerMinimizeBtn = musicPlayer.querySelector('.player-minimize-btn');
    const playerCloseBtn = musicPlayer.querySelector('.player-close-btn');
    
    // Playlist: Radio en vivo + tracks locales
    const playlist = [
        {
            title: "RADIO GDN 🔴 LIVE",
            url: "https://soil-copy-effort-cio.trycloudflare.com/stream.mp3",
            isLive: true
        },
        {
            title: "GDL Nights Vol.1",
            url: "tiendaPage/assets/images/BACKGROUND WEB TIENDA MUSIC.mp3",
            isLive: false
        }
    ];
    
    let currentTrackIndex = 0;
    let isPlaying = false;
    let audioPlayer = new Audio();
    audioPlayer.volume = 0.5;
    
    // Cargar track
    function loadTrack(index) {
        if (index >= 0 && index < playlist.length) {
            currentTrackIndex = index;
            const track = playlist[currentTrackIndex];
            audioPlayer.src = track.url;
            
            if (track.isLive) {
                trackInfo.textContent = `🔴 ${track.title}`;
                timeDisplay.textContent = 'STREAMING...';
            } else {
                trackInfo.textContent = `♪ ${track.title}`;
                updateTimeDisplay();
            }
        }
    }
    
    // Play/Pause
    playBtn.addEventListener('click', () => {
        if (isPlaying) {
            audioPlayer.pause();
            playBtn.textContent = '▶';
            isPlaying = false;
            if (playlist[currentTrackIndex].isLive) {
                trackInfo.textContent = `⏸ ${playlist[currentTrackIndex].title}`;
            }
        } else {
            audioPlayer.play();
            playBtn.textContent = '⏸';
            isPlaying = true;
            if (playlist[currentTrackIndex].isLive) {
                trackInfo.textContent = `🔴 ${playlist[currentTrackIndex].title}`;
            }
        }
    });
    
    // Stop
    stopBtn.addEventListener('click', () => {
        audioPlayer.pause();
        audioPlayer.currentTime = 0;
        playBtn.textContent = '▶';
        isPlaying = false;
        progressFill.style.width = '0%';
        updateTimeDisplay();
    });
    
    // Anterior
    prevBtn.addEventListener('click', () => {
        currentTrackIndex = (currentTrackIndex - 1 + playlist.length) % playlist.length;
        const wasPlaying = isPlaying;
        loadTrack(currentTrackIndex);
        if (wasPlaying) {
            audioPlayer.play();
        }
    });
    
    // Siguiente
    nextBtn.addEventListener('click', () => {
        currentTrackIndex = (currentTrackIndex + 1) % playlist.length;
        const wasPlaying = isPlaying;
        loadTrack(currentTrackIndex);
        if (wasPlaying) {
            audioPlayer.play();
        }
    });
    
    // Actualizar barra de progreso (solo para tracks no-live)
    audioPlayer.addEventListener('timeupdate', () => {
        if (!playlist[currentTrackIndex].isLive && audioPlayer.duration) {
            const progress = (audioPlayer.currentTime / audioPlayer.duration) * 100;
            progressFill.style.width = progress + '%';
            updateTimeDisplay();
        }
    });
    
    // Click en barra de progreso para saltar (solo tracks no-live)
    const progressBar = document.querySelector('.progress-bar');
    progressBar.addEventListener('click', (e) => {
        if (!playlist[currentTrackIndex].isLive && audioPlayer.duration) {
            const rect = progressBar.getBoundingClientRect();
            const percent = (e.clientX - rect.left) / rect.width;
            audioPlayer.currentTime = percent * audioPlayer.duration;
        }
    });
    
    // Cuando termina una canción no-live, pasar a la siguiente
    audioPlayer.addEventListener('ended', () => {
        if (!playlist[currentTrackIndex].isLive) {
            nextBtn.click();
        }
    });
    
    // Formatear tiempo
    function formatTime(seconds) {
        if (isNaN(seconds)) return '00:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    
    function updateTimeDisplay() {
        if (!playlist[currentTrackIndex].isLive) {
            const current = formatTime(audioPlayer.currentTime);
            const total = formatTime(audioPlayer.duration);
            timeDisplay.textContent = `${current} / ${total}`;
        } else {
            timeDisplay.textContent = 'STREAMING...';
        }
    }
    
    // Minimizar reproductor
    playerMinimizeBtn.addEventListener('click', () => {
        musicPlayer.classList.add('hidden');
        // Agregar botón a taskbar
        const taskbarItems = document.getElementById('taskbar-items');
        if (!document.getElementById('taskbar-radio')) {
            const radioBtn = document.createElement('button');
            radioBtn.id = 'taskbar-radio';
            radioBtn.className = 'taskbar-item';
            radioBtn.innerHTML = '<img src="https://win98icons.alexmeub.com/icons/png/media_player-0.png" alt="" class="taskbar-icon"> LaMovida95';
            radioBtn.addEventListener('click', () => {
                musicPlayer.classList.remove('hidden');
                radioBtn.remove();
            });
            taskbarItems.appendChild(radioBtn);
        }
    });
    
    // Cerrar reproductor (pausa audio también)
    playerCloseBtn.addEventListener('click', () => {
        audioPlayer.pause();
        isPlaying = false;
        playBtn.textContent = '▶';
        musicPlayer.classList.add('hidden');
        // Remover botón de taskbar si existe
        const radioBtn = document.getElementById('taskbar-radio');
        if (radioBtn) radioBtn.remove();
    });
    
    // Hacer el reproductor draggable
    let isDraggingPlayer = false;
    let playerOffsetX = 0;
    let playerOffsetY = 0;
    
    const playerTitleBar = musicPlayer.querySelector('.player-title-bar');
    
    playerTitleBar.addEventListener('mousedown', (e) => {
        isDraggingPlayer = true;
        playerOffsetX = e.clientX - musicPlayer.offsetLeft;
        playerOffsetY = e.clientY - musicPlayer.offsetTop;
        musicPlayer.style.cursor = 'grabbing';
    });
    
    document.addEventListener('mousemove', (e) => {
        if (isDraggingPlayer) {
            const x = e.clientX - playerOffsetX;
            const y = e.clientY - playerOffsetY;
            
            // Mantener dentro de los límites
            const maxX = window.innerWidth - musicPlayer.offsetWidth;
            const maxY = window.innerHeight - musicPlayer.offsetHeight;
            
            musicPlayer.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
            musicPlayer.style.bottom = 'auto';
            musicPlayer.style.right = 'auto';
            musicPlayer.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
        }
    });
    
    document.addEventListener('mouseup', () => {
        isDraggingPlayer = false;
        musicPlayer.style.cursor = 'default';
    });
    
    // Cargar primera canción
    loadTrack(0);
    
    // DEBUG: Dejar siempre visible
    musicPlayer.classList.remove('hidden');

    // ===== Panel de detalles de imagen (Galería) =====
    // Ventana independiente que aparece a la derecha de la Galería, draggable.
    const detailsPanel = document.getElementById('win95-details-panel');
    const detailsImage = document.getElementById('win95-details-image');
    const detailsFilename = document.getElementById('win95-details-filename');
    const detailsType = document.getElementById('win95-details-type');
    const detailsDimensions = document.getElementById('win95-details-dimensions');
    const detailsPath = document.getElementById('win95-details-path');
    const detailsClose = document.getElementById('win95-details-close');
    const detailsOk = document.getElementById('win95-details-ok');
    const detailsTitlebar = document.getElementById('win95-details-titlebar');
    let detailsPanelHasBeenPositioned = false; // track if user moved or panel was placed

    function openDetailsPanel(data) {
      if (!detailsPanel) return;
      detailsImage.src = data.src;
      detailsFilename.textContent = data.fileName;
      detailsType.textContent = data.fileType;
      detailsDimensions.textContent = data.dimensions;
      detailsPath.textContent = data.path;

      // Only position the panel if it hasn't been placed yet
      if (!detailsPanelHasBeenPositioned) {
        const galeriaWin = document.querySelector('[data-window-id="galeria"]');
        if (galeriaWin) {
          const gRect = galeriaWin.getBoundingClientRect();
          const gap = 8;
          let panelLeft = gRect.right + gap;
          let panelTop = gRect.top;
          const panelHeight = gRect.height;

          if (panelLeft + 280 > window.innerWidth) {
            panelLeft = gRect.left - 280 - gap;
          }
          if (panelTop < 0) panelTop = 0;

          detailsPanel.style.left = panelLeft + 'px';
          detailsPanel.style.top = panelTop + 'px';
          detailsPanel.style.height = panelHeight + 'px';
        }
        detailsPanelHasBeenPositioned = true;
      }

      detailsPanel.classList.add('open');
      detailsPanel.setAttribute('aria-hidden', 'false');
      // Bring panel to front
      highestZIndex++;
      detailsPanel.style.zIndex = highestZIndex;
    }

    function closeDetailsPanel() {
      if (!detailsPanel) return;
      detailsPanel.classList.remove('open');
      detailsPanel.setAttribute('aria-hidden', 'true');
      detailsPanelHasBeenPositioned = false; // reset so next open re-positions
    }

    if (detailsClose) {
      detailsClose.addEventListener('click', closeDetailsPanel);
    }
    if (detailsOk) {
      detailsOk.addEventListener('click', closeDetailsPanel);
    }

    // Make the details panel draggable by its titlebar
    if (detailsTitlebar && detailsPanel) {
      let isDraggingDetails = false;
      let detailsOffX = 0;
      let detailsOffY = 0;

      detailsTitlebar.addEventListener('mousedown', (e) => {
        if (e.target === detailsClose) return; // don't drag on close button
        isDraggingDetails = true;
        detailsOffX = e.clientX - detailsPanel.offsetLeft;
        detailsOffY = e.clientY - detailsPanel.offsetTop;
        // Bring to front
        highestZIndex++;
        detailsPanel.style.zIndex = highestZIndex;
        e.preventDefault();
      });

      document.addEventListener('mousemove', (e) => {
        if (!isDraggingDetails) return;
        const x = e.clientX - detailsOffX;
        const y = e.clientY - detailsOffY;
        const maxX = window.innerWidth - detailsPanel.offsetWidth;
        const maxY = window.innerHeight - detailsPanel.offsetHeight - 40;
        detailsPanel.style.left = Math.max(0, Math.min(x, maxX)) + 'px';
        detailsPanel.style.top = Math.max(0, Math.min(y, maxY)) + 'px';
      });

      document.addEventListener('mouseup', () => {
        isDraggingDetails = false;
      });
    }

    // Listen for messages from the gallery iframe
    window.addEventListener('message', (event) => {
      if (event.data && event.data.type === 'galeria-open-details') {
        openDetailsPanel(event.data.data);
      }
    });

    // ─── Buscaminas (embedded) ───
    (function() {
      const msBoard = document.getElementById('msBoard');
      const msMineCount = document.getElementById('msMineCount');
      const msTimer = document.getElementById('msTimer');
      const msResetBtn = document.getElementById('msResetBtn');
      const msLevelSel = document.getElementById('msLevel');

      if (!msBoard) return;

      // Win95 Minesweeper pixel-art sprites as inline SVGs
      const SPRITES = {
        faceSmile: `<img class="ms-face-icon" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Crect width='20' height='20' fill='%23FFFF00'/%3E%3Ccircle cx='10' cy='10' r='9' fill='%23FFFF00' stroke='%23000' stroke-width='1'/%3E%3Crect x='6' y='6' width='2' height='3' fill='%23000'/%3E%3Crect x='12' y='6' width='2' height='3' fill='%23000'/%3E%3Cpath d='M6 12 Q10 16 14 12' fill='none' stroke='%23000' stroke-width='1.2'/%3E%3C/svg%3E" alt=":)">`,
        faceCool: `<img class="ms-face-icon" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Crect width='20' height='20' fill='%23FFFF00'/%3E%3Ccircle cx='10' cy='10' r='9' fill='%23FFFF00' stroke='%23000' stroke-width='1'/%3E%3Crect x='4' y='7' width='5' height='2' rx='1' fill='%23000'/%3E%3Crect x='11' y='7' width='5' height='2' rx='1' fill='%23000'/%3E%3Cpath d='M6 12 Q10 16 14 12' fill='none' stroke='%23000' stroke-width='1.2'/%3E%3C/svg%3E" alt="B)">`,
        faceDead: `<img class="ms-face-icon" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Crect width='20' height='20' fill='%23FFFF00'/%3E%3Ccircle cx='10' cy='10' r='9' fill='%23FFFF00' stroke='%23000' stroke-width='1'/%3E%3Cline x1='5' y1='5' x2='9' y2='9' stroke='%23000' stroke-width='1.3'/%3E%3Cline x1='9' y1='5' x2='5' y2='9' stroke='%23000' stroke-width='1.3'/%3E%3Cline x1='11' y1='5' x2='15' y2='9' stroke='%23000' stroke-width='1.3'/%3E%3Cline x1='15' y1='5' x2='11' y2='9' stroke='%23000' stroke-width='1.3'/%3E%3Ccircle cx='10' cy='14' rx='3' ry='2' fill='none' stroke='%23000' stroke-width='1.2'/%3E%3C/svg%3E" alt="X(">`,
        faceOh: `<img class="ms-face-icon" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 20 20'%3E%3Crect width='20' height='20' fill='%23FFFF00'/%3E%3Ccircle cx='10' cy='10' r='9' fill='%23FFFF00' stroke='%23000' stroke-width='1'/%3E%3Crect x='6' y='6' width='2' height='3' fill='%23000'/%3E%3Crect x='12' y='6' width='2' height='3' fill='%23000'/%3E%3Ccircle cx='10' cy='14' r='2' fill='none' stroke='%23000' stroke-width='1.2'/%3E%3C/svg%3E" alt=":O">`,
        mine: `<img class="ms-sprite" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14'%3E%3Ccircle cx='7' cy='7' r='4' fill='%23000'/%3E%3Cline x1='7' y1='1' x2='7' y2='13' stroke='%23000' stroke-width='1.2'/%3E%3Cline x1='1' y1='7' x2='13' y2='7' stroke='%23000' stroke-width='1.2'/%3E%3Cline x1='3' y1='3' x2='11' y2='11' stroke='%23000' stroke-width='1'/%3E%3Cline x1='11' y1='3' x2='3' y2='11' stroke='%23000' stroke-width='1'/%3E%3Crect x='5' y='4' width='2' height='2' fill='%23fff'/%3E%3C/svg%3E" alt="*">`,
        flag: `<img class="ms-sprite" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14'%3E%3Cpolygon points='4,2 4,8 10,5' fill='%23FF0000'/%3E%3Cline x1='4' y1='2' x2='4' y2='11' stroke='%23000' stroke-width='1.3'/%3E%3Crect x='2' y='11' width='5' height='1.5' fill='%23000'/%3E%3Crect x='1' y='12' width='7' height='1.5' fill='%23000'/%3E%3C/svg%3E" alt="F">`,
        wrongFlag: `<img class="ms-sprite" src="data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 14 14'%3E%3Ccircle cx='7' cy='7' r='4' fill='%23000'/%3E%3Cline x1='7' y1='1' x2='7' y2='13' stroke='%23000' stroke-width='1.2'/%3E%3Cline x1='1' y1='7' x2='13' y2='7' stroke='%23000' stroke-width='1.2'/%3E%3Cline x1='3' y1='3' x2='11' y2='11' stroke='%23000' stroke-width='1'/%3E%3Cline x1='11' y1='3' x2='3' y2='11' stroke='%23000' stroke-width='1'/%3E%3Cline x1='2' y1='2' x2='12' y2='12' stroke='%23FF0000' stroke-width='1.8'/%3E%3Cline x1='12' y1='2' x2='2' y2='12' stroke='%23FF0000' stroke-width='1.8'/%3E%3C/svg%3E" alt="X">`
      };

      const levels = {
        beginner:     { rows: 9,  cols: 9,  mines: 10 },
        intermediate: { rows: 16, cols: 16, mines: 40 },
        expert:       { rows: 16, cols: 30, mines: 99 }
      };

      let st = null;
      let timerId = null;
      let startTime = null;

      function pad(n) { return String(n).padStart(3, '0'); }

      function getLevel() {
        return levels[msLevelSel ? msLevelSel.value : 'beginner'];
      }

      function createState(lv) {
        const { rows, cols, mines } = lv;
        const cells = Array.from({ length: rows }, () =>
          Array.from({ length: cols }, () => ({
            mine: false, revealed: false, flagged: false, count: 0
          }))
        );
        let placed = 0;
        while (placed < mines) {
          const r = Math.floor(Math.random() * rows);
          const c = Math.floor(Math.random() * cols);
          if (!cells[r][c].mine) { cells[r][c].mine = true; placed++; }
        }
        for (let r = 0; r < rows; r++) {
          for (let c = 0; c < cols; c++) {
            if (cells[r][c].mine) continue;
            let cnt = 0;
            for (let dr = -1; dr <= 1; dr++) {
              for (let dc = -1; dc <= 1; dc++) {
                if (!dr && !dc) continue;
                const nr = r + dr, nc = c + dc;
                if (nr >= 0 && nr < rows && nc >= 0 && nc < cols && cells[nr][nc].mine) cnt++;
              }
            }
            cells[r][c].count = cnt;
          }
        }
        return { rows, cols, mines, flagsLeft: mines, revealedCount: 0, over: false, cells };
      }

      function renderBoard() {
        msBoard.innerHTML = '';
        msBoard.style.gridTemplateColumns = `repeat(${st.cols}, 20px)`;
        for (let r = 0; r < st.rows; r++) {
          for (let c = 0; c < st.cols; c++) {
            const el = document.createElement('div');
            el.className = 'ms-cell';
            el.dataset.r = r;
            el.dataset.c = c;
            el.addEventListener('click', onReveal);
            el.addEventListener('contextmenu', onFlag);
            msBoard.appendChild(el);
          }
        }
        updateCounters();
      }

      function updateCounters() {
        msMineCount.textContent = pad(Math.max(0, st.flagsLeft));
        msTimer.textContent = pad(getElapsed());
      }

      function getElapsed() {
        if (!startTime) return 0;
        return Math.min(999, Math.floor((Date.now() - startTime) / 1000));
      }

      function startTimerMs() {
        if (timerId) return;
        startTime = Date.now();
        timerId = setInterval(() => { msTimer.textContent = pad(getElapsed()); }, 250);
      }

      function stopTimerMs() {
        if (timerId) { clearInterval(timerId); timerId = null; }
      }

      function getCellEl(r, c) {
        return msBoard.querySelector(`.ms-cell[data-r="${r}"][data-c="${c}"]`);
      }

      function revealCell(r, c) {
        const cell = st.cells[r][c];
        if (cell.revealed || cell.flagged) return;
        cell.revealed = true;
        st.revealedCount++;
        const el = getCellEl(r, c);
        el.classList.add('revealed');
        if (cell.mine) {
          el.innerHTML = SPRITES.mine;
          el.classList.add('mine-hit');
          endGame(false);
          return;
        }
        if (cell.count > 0) {
          el.textContent = cell.count;
          el.classList.add('ms-n' + cell.count);
        } else {
          for (let dr = -1; dr <= 1; dr++) {
            for (let dc = -1; dc <= 1; dc++) {
              if (!dr && !dc) continue;
              const nr = r + dr, nc = c + dc;
              if (nr >= 0 && nr < st.rows && nc >= 0 && nc < st.cols) revealCell(nr, nc);
            }
          }
        }
        checkWin();
      }

      function checkWin() {
        if (st.revealedCount === st.rows * st.cols - st.mines) endGame(true);
      }

      function endGame(win) {
        st.over = true;
        stopTimerMs();
        msResetBtn.innerHTML = win ? SPRITES.faceCool : SPRITES.faceDead;
        for (let r = 0; r < st.rows; r++) {
          for (let c = 0; c < st.cols; c++) {
            const cell = st.cells[r][c];
            const el = getCellEl(r, c);
            if (cell.mine && !cell.revealed) {
              el.classList.add('revealed');
              el.innerHTML = SPRITES.mine;
            }
            if (!win && cell.flagged && !cell.mine) {
              el.classList.add('revealed', 'wrong-flag');
              el.innerHTML = SPRITES.wrongFlag;
            }
            el.removeEventListener('click', onReveal);
            el.removeEventListener('contextmenu', onFlag);
          }
        }
      }

      function onReveal(e) {
        if (st.over) return;
        const r = Number(e.currentTarget.dataset.r);
        const c = Number(e.currentTarget.dataset.c);
        startTimerMs();
        revealCell(r, c);
      }

      function onFlag(e) {
        e.preventDefault();
        if (st.over) return;
        const r = Number(e.currentTarget.dataset.r);
        const c = Number(e.currentTarget.dataset.c);
        const cell = st.cells[r][c];
        if (cell.revealed) return;
        cell.flagged = !cell.flagged;
        const el = getCellEl(r, c);
        el.classList.toggle('flagged', cell.flagged);
        el.innerHTML = cell.flagged ? SPRITES.flag : '';
        st.flagsLeft += cell.flagged ? -1 : 1;
        updateCounters();
      }

      function resetGame() {
        stopTimerMs();
        startTime = null;
        msResetBtn.innerHTML = SPRITES.faceSmile;
        st = createState(getLevel());
        renderBoard();
      }

      msResetBtn.addEventListener('click', resetGame);
      if (msLevelSel) msLevelSel.addEventListener('change', resetGame);

      // Classic Win95: show 'oh' face while mouse is down on the board
      msBoard.addEventListener('mousedown', () => {
        if (!st.over) msResetBtn.innerHTML = SPRITES.faceOh;
      });
      msBoard.addEventListener('mouseup', () => {
        if (!st.over) msResetBtn.innerHTML = SPRITES.faceSmile;
      });
      msBoard.addEventListener('mouseleave', () => {
        if (!st.over) msResetBtn.innerHTML = SPRITES.faceSmile;
      });

      resetGame();
    })();

});