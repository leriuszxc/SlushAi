document.addEventListener('DOMContentLoaded', () => {
    // Инициализация даты
    if (typeof initDateDisplay === 'function') initDateDisplay();

    // Инициализация редактора
    if (typeof initEditor === 'function') initEditor();

    // Инициализация настроек
    if (typeof initSettings === 'function') initSettings();

    // Инициализация поиска
    if (typeof initSearch === 'function') initSearch();

    // Инициализация транскрибации
    if (typeof initTranscription === 'function') initTranscription();
});