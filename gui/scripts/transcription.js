// Переменные для таймера
let transcriptionTimerInterval = null;
let transcriptionStartTime = 0;

// Функция инициализации (вызывается из dashboard.js)
function initTranscription() {
    const mainLogo = document.querySelector('.main-logo');
    if (!mainLogo) return;

    mainLogo.style.cursor = 'pointer';
    mainLogo.title = "Нажмите для запуска транскрибации";

    mainLogo.addEventListener('click', startTranscriptionProcess);
}

// Глобальная функция, которую будет дергать Python для обновления прогресса
// percent: число от 0 до 100
// statusText: текст (например "00:45 / 10:00")
window.updateTranscriptionProgress = function(percent, statusText) {
    const progressBar = document.getElementById('toast-progress-bar');
    const statusEl = document.getElementById('toast-status');
    
    if (progressBar) progressBar.style.width = `${percent}%`;
    if (statusEl && statusText) statusEl.textContent = statusText;
};

async function startTranscriptionProcess() {
    // Проверка Backend
    if (!window.pywebview || !window.pywebview.api) {
        alert("Backend не подключен.");
        return;
    }

    // Показываем уведомление
    showToast();
    
    const titleEl = document.getElementById('lecture-title');
    const contentSection = document.getElementById('lecture-text');
    
    // Заглушка во время загрузки
    if (contentSection) {
        contentSection.innerHTML = `
            <div style='text-align:center; padding-top: 50px; color: #888;'>
                <i class='fa-solid fa-wand-magic-sparkles' style='font-size: 3em; color:#e0e0e0; margin-bottom: 20px;'></i>
                <p>Идёт магия AI...<br>Следите за прогрессом вверху экрана.</p>
            </div>
        `;
    }

    try {
        // 1. ЗАПУСК ТРАНСКРИБАЦИИ
        const response = await window.pywebview.api.process_audio();

        // Скрываем Toast
        hideToast();

        if (response.status === 'ok') {
            const transcribedText = response.content;
            
            // === ИЗМЕНЕНИЯ ЗДЕСЬ ===
            
            // 2. БОЛЬШЕ НЕТ PROMPT. 
            // Мы просим Python создать файл с базовым именем "Новая лекция".
            // Python сам добавит (1), (2), если имя занято.
            const defaultName = "Новая лекция"; 

            const saveRes = await window.pywebview.api.create_transcribed_file(defaultName, transcribedText);

            if (saveRes.status === 'ok') {
                const newFileId = saveRes.new_file.id;
                // Имя, которое реально присвоил Python (например "Новая лекция (3)")
                const realName = saveRes.new_file.name; 

                // 3. Обновляем дерево файлов
                if (typeof window.loadFileSystem === 'function') {
                    await window.loadFileSystem(); 
                }
                
                // 4. Логика открытия и переименования
                // Даем небольшую задержку, чтобы Sidebar успел отрендериться
                setTimeout(() => {
                    // Экранируем слеши для селектора (важно для Windows путей)
                    const safeId = newFileId.replace(/\\/g, '\\\\');
                    
                    // 1. Находим элемент
                    const newFileEl = document.querySelector(`.fs-item[data-id="${safeId}"]`);
                    
                    if (newFileEl) {
                        // 2. Имитируем клик, чтобы открыть текст в редакторе (Dashboard.js логика)
                        newFileEl.click(); 
                        
                        // 3. СРАЗУ ВКЛЮЧАЕМ РЕЖИМ ПЕРЕИМЕНОВАНИЯ
                        // Вызываем функцию, которую мы добавили в sidebar.js
                        if (typeof window.editFileFromOutside === 'function') {
                            window.editFileFromOutside(newFileId);
                        }
                    } 
                }, 300); // 300мс обычно достаточно
                
            } else {
                alert("Ошибка сохранения: " + saveRes.message);
            }

        } else {
            alert("Ошибка транскрибации: " + response.message);
            // Возвращаем старый текст при ошибке, если нужно...
        }

    } catch (err) {
        hideToast();
        console.error(err);
        alert("Ошибка JS: " + err);
    }
}

// === Управление Toast ===
function showToast() {
    const toast = document.getElementById('transcription-toast');
    const timerEl = document.getElementById('toast-timer');
    const progress = document.getElementById('toast-progress-bar');
    const status = document.getElementById('toast-status');

    if (toast) toast.classList.add('visible');
    if (progress) progress.style.width = '0%';
    if (status) status.textContent = "Загрузка модели...";

    // Запуск секундомера
    transcriptionStartTime = Date.now();
    if (transcriptionTimerInterval) clearInterval(transcriptionTimerInterval);
    
    transcriptionTimerInterval = setInterval(() => {
        if (!timerEl) return;
        const diff = Math.floor((Date.now() - transcriptionStartTime) / 1000);
        const m = Math.floor(diff / 60).toString().padStart(2, '0');
        const s = (diff % 60).toString().padStart(2, '0');
        timerEl.textContent = `${m}:${s}`;
    }, 1000);
}

function hideToast() {
    const toast = document.getElementById('transcription-toast');
    if (toast) toast.classList.remove('visible');
    if (transcriptionTimerInterval) clearInterval(transcriptionTimerInterval);
}