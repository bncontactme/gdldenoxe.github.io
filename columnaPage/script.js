// Funcionalidad para los botones de la ventana Windows 95

document.addEventListener('DOMContentLoaded', () => {
    
    // Funcionalidad del botón cerrar
    const closeBtns = document.querySelectorAll('.close-btn');
    closeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const window = btn.closest('.win95-window');
            window.style.display = 'none';
        });
    });

    // Funcionalidad del botón minimizar (animación simple)
    const minimizeBtns = document.querySelectorAll('.minimize-btn');
    minimizeBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            const windowBody = btn.closest('.win95-window').querySelector('.window-body');
            if (windowBody.style.display === 'none') {
                windowBody.style.display = 'block';
            } else {
                windowBody.style.display = 'none';
            }
        });
    });

    // Funcionalidad del botón "Leer más"
    const readMoreBtns = document.querySelectorAll('.read-more-btn');
    readMoreBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            alert('Aquí se abrirá el artículo completo');
            // Aquí puedes agregar la lógica para abrir el artículo completo
        });
    });

});