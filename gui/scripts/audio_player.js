class AudioPlayer {
    constructor() {
        this.modal = null;
        this.audio = null;
        this.currentFile = null;
        this.playlist = [];
        this.currentIndex = 0;
        this.isPlaying = false;
        this.init();
    }

    init() {
        this.modal = document.getElementById('audio-player-modal');
        this.titleEl = document.getElementById('audio-player-title');
        this.currentTimeEl = document.getElementById('audio-current-time');
        this.totalTimeEl = document.getElementById('audio-total-time');
        this.progressBar = document.getElementById('audio-progress-bar');
        this.playPauseBtn = document.getElementById('audio-play-pause-btn');
        this.prevBtn = document.getElementById('audio-prev-btn');
        this.nextBtn = document.getElementById('audio-next-btn');
        this.rewindBtn = document.getElementById('audio-rewind-btn');
        this.forwardBtn = document.getElementById('audio-forward-btn');

        // HTML5 Audio
        this.audio = new Audio();
        this.bindEvents();
    }

    bindEvents() {
        if (!this.audio) return;

        // Обновление прогресса
        this.audio.addEventListener('timeupdate', () => {
            if (this.audio.duration && !isNaN(this.audio.duration) && isFinite(this.audio.duration)) {
                const percent = (this.audio.currentTime / this.audio.duration) * 100;
                this.progressBar.value = percent;
                this.currentTimeEl.textContent = this.formatTime(this.audio.currentTime);
            }
        });

        // Загрузка метаданных
        this.audio.addEventListener('loadedmetadata', () => {
            if (this.audio.duration && !isNaN(this.audio.duration) && isFinite(this.audio.duration)) {
                this.totalTimeEl.textContent = this.formatTime(this.audio.duration);
                this.progressBar.max = 100;
            }
        });

        // Конец трека
        this.audio.addEventListener('ended', () => {
            this.isPlaying = false;
            this.updatePlayPauseIcon();
            this.playNext();
        });

        // Ошибка загрузки
        this.audio.addEventListener('error', (e) => {
            console.error('Ошибка аудио:', e);
            alert('Не удалось загрузить аудиофайл. Проверьте путь.');
        });

        // Кнопка Play/Pause
        if (this.playPauseBtn) {
            this.playPauseBtn.addEventListener('click', () => this.togglePlayPause());
        }

        // Прогресс-бар (перемотка)
        if (this.progressBar) {
            this.progressBar.addEventListener('input', (e) => {
                if (this.audio.duration && !isNaN(this.audio.duration) && isFinite(this.audio.duration)) {
                    const time = (e.target.value / 100) * this.audio.duration;
                    this.audio.currentTime = time;
                }
            });
        }

        // Кнопка -10 сек
        if (this.rewindBtn) {
            this.rewindBtn.addEventListener('click', () => {
                if (this.audio.duration && !isNaN(this.audio.duration) && isFinite(this.audio.duration)) {
                    this.audio.currentTime = Math.max(0, this.audio.currentTime - 10);
                }
            });
        }

        // Кнопка +10 сек
        if (this.forwardBtn) {
            this.forwardBtn.addEventListener('click', () => {
                if (this.audio.duration && !isNaN(this.audio.duration) && isFinite(this.audio.duration)) {
                    this.audio.currentTime = Math.min(this.audio.duration, this.audio.currentTime + 10);
                }
            });
        }

        // Предыдущий трек
        if (this.prevBtn) {
            this.prevBtn.addEventListener('click', () => this.playPrev());
        }

        // Следующий трек
        if (this.nextBtn) {
            this.nextBtn.addEventListener('click', () => this.playNext());
        }

        // Закрытие по клику вне плеера
        document.addEventListener('click', (e) => {
            if (this.modal && this.modal.classList.contains('active')) {
                if (!this.modal.contains(e.target) && !e.target.closest('.audio-file-play-btn')) {
                    this.close();
                }
            }
        });
    }

    open(filename, playlist = [], index = 0) {
        this.currentFile = filename;
        this.playlist = playlist;
        this.currentIndex = index;

        this.updateTrackInfo();
        this.loadCurrentTrack();

        if (this.modal) {
            this.modal.classList.add('active');
        }

        this.updateNavigationButtons();
    }

    updateTrackInfo() {
        if (this.titleEl) {
            // Убираем расширение из названия
            this.titleEl.textContent = this.currentFile.replace(/\.(mp3|wav|m4a|ogg|flac)$/i, '');
        }
    }

    loadCurrentTrack() {
        if (window.pywebview && window.pywebview.api) {
            // Получаем base64 данные вместо file:// пути
            window.pywebview.api.get_audio_file_base64(this.currentFile).then(res => {
                if (res.status === 'ok') {
                    console.log('Аудио загружено (base64)');
                    // Формат: data:audio/mpeg;base64,<данные>
                    this.audio.src = `data:audio/mpeg;base64,${res.data}`;
                    this.audio.load();
                    
                    // Автоплей после загрузки
                    this.audio.addEventListener('canplay', () => {
                        this.play();
                    }, { once: true });
                } else {
                    alert('Ошибка загрузки: ' + res.message);
                }
            }).catch(err => {
                console.error('Ошибка получения аудио:', err);
            });
        }
    }

    updateNavigationButtons() {
        if (this.prevBtn) {
            this.prevBtn.disabled = this.currentIndex === 0;
        }
        if (this.nextBtn) {
            this.nextBtn.disabled = this.currentIndex === this.playlist.length - 1;
        }
    }

    playNext() {
        if (this.currentIndex < this.playlist.length - 1) {
            this.currentIndex++;
            this.currentFile = this.playlist[this.currentIndex];
            this.updateTrackInfo();
            this.loadCurrentTrack();
            this.updateNavigationButtons();
        }
    }

    playPrev() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this.currentFile = this.playlist[this.currentIndex];
            this.updateTrackInfo();
            this.loadCurrentTrack();
            this.updateNavigationButtons();
        }
    }

    close() {
        this.pause();
        if (this.modal) {
            this.modal.classList.remove('active');
        }
    }

    togglePlayPause() {
        if (this.isPlaying) {
            this.pause();
        } else {
            this.play();
        }
    }

    play() {
        if (this.audio) {
            this.audio.play().catch(err => {
                console.error('Ошибка воспроизведения:', err);
            });
            this.isPlaying = true;
            this.updatePlayPauseIcon();
        }
    }

    pause() {
        if (this.audio) {
            this.audio.pause();
            this.isPlaying = false;
            this.updatePlayPauseIcon();
        }
    }

    updatePlayPauseIcon() {
        if (this.playPauseBtn) {
            const icon = this.playPauseBtn.querySelector('i');
            if (icon) {
                if (this.isPlaying) {
                    icon.className = 'fa-solid fa-pause';
                } else {
                    icon.className = 'fa-solid fa-play';
                }
            }
        }
    }

    formatTime(seconds) {
        if (!seconds || isNaN(seconds) || !isFinite(seconds)) return '0:00';
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    }
}

// Глобальная инициализация
let globalAudioPlayer = null;

document.addEventListener('DOMContentLoaded', () => {
    globalAudioPlayer = new AudioPlayer();
});

// Функция для открытия плеера из audio_modal.js
window.openAudioPlayer = function(filename, playlist = [filename], index = 0) {
    if (!globalAudioPlayer) {
        console.error('Audio player not initialized');
        return;
    }
    globalAudioPlayer.open(filename, playlist, index);
};

// Экспорт для использования
window.AudioPlayer = AudioPlayer;
window.globalAudioPlayer = globalAudioPlayer;