const AppZoom = {
    currentZoom: 0.9,

    // Применить зум визуально
    apply: function() {
        document.body.style.zoom = this.currentZoom;
    },

    saveToConfig: function() {
        if (window.pywebview && window.pywebview.api) {
            window.pywebview.api.save_zoom(this.currentZoom);
        }
    },

    set: function(value) {
        this.currentZoom = parseFloat(value);
        this.apply();
        this.saveToConfig();
    },
    
    zoomIn: function() {
        this.set(Math.min(this.currentZoom + 0.1, 2.0));
    },

    zoomOut: function() {
        this.set(Math.max(this.currentZoom - 0.1, 0.5));
    }
};

window.addEventListener('pywebviewready', () => {
    // Запрашиваем настройки из Python
    window.pywebview.api.get_settings().then((settings) => {
        if (settings && settings.zoom) {
            AppZoom.currentZoom = settings.zoom;
            AppZoom.apply();
            console.log('Zoom loaded from config:', settings.zoom);
        }
    });
});

// Горячие клавиши (Ctrl +/-)
document.addEventListener('keydown', (e) => {
    if (e.ctrlKey) {
        if (e.key === '=' || e.key === '+') {
            e.preventDefault();
            AppZoom.zoomIn();
        } else if (e.key === '-') {
            e.preventDefault();
            AppZoom.zoomOut();
        } else if (e.key === '0') {
            e.preventDefault();
            AppZoom.set(1.0);
        }
    }
});
