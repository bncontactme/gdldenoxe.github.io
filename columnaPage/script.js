// Funcionalidad para el dashboard estilo Windows 95

document.addEventListener('DOMContentLoaded', () => {
    
    let highestZIndex = 100;
    let draggedWindow = null;
    let offsetX = 0;
    let offsetY = 0;

    // Posicionar ventanas aleatoriamente al inicio
    function randomizeWindowPositions() {
        const windows = document.querySelectorAll('.win95-window:not(.hidden)');
        const screenWidth = globalThis.innerWidth;
        const screenHeight = globalThis.innerHeight;
        const windowWidth = 420;
        const windowHeight = 500;
        const positions = [];
        
        windows.forEach(win => {
            let x, y, hasOverlap;
            let attempts = 0;
            
            do {
                x = Math.random() * (screenWidth - windowWidth - 40) + 20;
                y = Math.random() * (screenHeight - windowHeight - 100) + 20;
                
                // Verificar que no se superponga con ninguna ventana ya colocada
                hasOverlap = positions.some(pos => {
                    return !(x + windowWidth < pos.x || 
                             x > pos.x + windowWidth ||
                             y + windowHeight < pos.y || 
                             y > pos.y + windowHeight);
                });
                
                attempts++;
            } while (hasOverlap && attempts < 200);
            
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