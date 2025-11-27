function initDateDisplay() {
    const dateEl = document.getElementById('current-date');
    if (dateEl) {
        const now = new Date();
        dateEl.textContent = now.toLocaleDateString('ru-RU');
    }
}

// Вспомогательная функция для экранирования спецсимволов regex (используется в поиске)
function escapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}