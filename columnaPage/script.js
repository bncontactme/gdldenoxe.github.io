// Funcionalidad para el dashboard estilo Windows 95

document.addEventListener('DOMContentLoaded', () => {
    
    let highestZIndex = 100;
    let draggedWindow = null;
    let offsetX = 0;
    let offsetY = 0;

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
                    tiendaWindow.classList.remove('hidden', 'minimized');
                    bringToFront(tiendaWindow);
                    updateTaskbar();
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
        "../indexPage/indexImages/2 Intro.jpeg",
        "../indexPage/indexImages/3 Intro.jpeg",
        "../indexPage/indexImages/4 Intro.jpeg",
        "../indexPage/indexImages/6 Intro.jpeg",
        "../indexPage/indexImages/7 Intro.JPG"
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
        const positions = [];
        
        windows.forEach(win => {
            let x, y, hasOverlap;
            let attempts = 0;
            
            do {
                // Solo posicionar en el lado derecho (después del área de iconos)
                x = Math.random() * (screenWidth - windowWidth - iconAreaWidth - 100) + iconAreaWidth + 50;
                y = Math.random() * (screenHeight - windowHeight - 150) + 30;
                
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
            updateTaskbar();
        });
    });

    // Funcionalidad del botón minimizar
    document.querySelectorAll('.minimize-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const window = btn.closest('.win95-window');
            window.classList.add('minimized');
            updateTaskbar();
        });
    });

    // Funcionalidad del botón "Leer más"
    document.querySelectorAll('.read-more-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            alert('Aquí se abrirá el artículo completo');
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
            const action = item.dataset.action;
            const windowId = item.dataset.window;
            
            if (action === 'restore-all') {
                document.querySelectorAll('.win95-window').forEach(w => {
                    w.classList.remove('hidden', 'minimized');
                });
            } else if (windowId) {
                const window = document.querySelector(`[data-window-id="${windowId}"]`);
                if (window) {
                    window.classList.remove('hidden', 'minimized');
                    bringToFront(window);
                }
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
});