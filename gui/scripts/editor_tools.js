// ПО УМОЛЧАНИЮ: Режим редактирования ВКЛЮЧЕН
let isEditMode = true; 

function initEditor() {
    const editModeBtn = document.querySelector('.edit-mode-btn');
    const contentArea = document.getElementById('lecture-text') || document.querySelector('.lecture-content');
    const copyBtn = document.querySelector('.copy-btn');
    const bookmarkBtn = document.querySelector('.tool-btn i.fa-bookmark')?.parentElement;

    if (bookmarkBtn) initBookmarkLogic(bookmarkBtn);
    if (!contentArea) return;

    // === 1. ИНИЦИАЛИЗАЦИЯ (СТАРТ) ===
    
    // Сразу включаем режим редактирования
    contentArea.contentEditable = 'true';
    contentArea.classList.add('raw-mode');
    
    // Если текст уже есть, сохраняем его в dataset
    if (contentArea.innerText.trim().length > 0) {
        contentArea.dataset.rawContent = contentArea.innerText;
    }

    // Ставим правильную иконку
    if (editModeBtn) updateEditIcon(editModeBtn);

    // === 2. КНОПКА ПЕРЕКЛЮЧЕНИЯ ===
    if (editModeBtn) {
        editModeBtn.addEventListener('click', () => {
            if (isEditMode) {
                // >>> ПЕРЕХОД В РЕЖИМ ЧТЕНИЯ (КРАСИВО) >>>
                
                // 1. Сохраняем текущий текст
                const rawText = contentArea.innerText;
                contentArea.dataset.rawContent = rawText;
                
                // 2. Выключаем редактор
                isEditMode = false;
                contentArea.contentEditable = 'false';
                contentArea.classList.remove('raw-mode');
                
                // 3. Рендерим Markdown
                renderMarkdown(contentArea, rawText);

            } else {
                // >>> ПЕРЕХОД В РЕЖИМ РЕДАКТИРОВАНИЯ (СЫРОЙ) >>>
                
                // 1. Достаем сохраненный текст
                const rawText = contentArea.dataset.rawContent || "";
                
                // 2. Включаем редактор
                isEditMode = true;
                contentArea.innerText = rawText; // Убираем HTML, ставим текст
                contentArea.contentEditable = 'true';
                contentArea.classList.add('raw-mode');
                
                contentArea.focus();
            }
            updateEditIcon(editModeBtn);
        });
    }

    // === 3. АВТО-ОБНОВЛЕНИЕ ДЛЯ СОХРАНЕНИЯ ===
    // Чтобы sidebar.js мог сохранить файл, обновляем dataset при вводе
    contentArea.addEventListener('input', () => {
        if (isEditMode) {
            contentArea.dataset.rawContent = contentArea.innerText;
        }
    });

    // === 4. КОПИРОВАНИЕ ===
    if (copyBtn) {
        copyBtn.addEventListener('click', () => {
            const text = contentArea.dataset.rawContent || contentArea.innerText;
            navigator.clipboard.writeText(text).then(() => {
                const icon = copyBtn.querySelector('i');
                if (icon) {
                    const old = icon.className;
                    icon.className = 'fa-solid fa-check';
                    setTimeout(() => icon.className = old, 2000);
                }
            });
        });
    }
}

// === ЗАГРУЗКА ФАЙЛА (ИЗ SIDEBAR) ===
window.loadContentIntoEditor = function(text) {
    const contentArea = document.getElementById('lecture-text') || document.querySelector('.lecture-content');
    if (!contentArea) return;

    // Сохраняем исходник
    contentArea.dataset.rawContent = text;

    // Если мы сейчас в режиме редактирования (по дефолту да) -> показываем сырой текст
    if (isEditMode) {
        contentArea.innerText = text;
        contentArea.contentEditable = 'true';
        contentArea.classList.add('raw-mode');
    } else {
        // Если пользователь переключился в чтение -> рендерим
        renderMarkdown(contentArea, text);
    }
};

// === РЕНДЕР ===
function renderMarkdown(element, text) {
    if (!text) {
        element.innerHTML = '';
        return;
    }
    if (typeof marked === 'undefined') {
        element.innerText = text;
        return;
    }
    try {
        const html = marked.parse(text, { breaks: true, gfm: true });
        element.innerHTML = html;
        if (window.MathJax && window.MathJax.typesetPromise) {
            window.MathJax.typesetPromise([element]).catch(err => {});
        }
    } catch (e) {
        element.innerText = text;
    }
}

// === UI ===
function updateEditIcon(btn) {
    const icon = btn.querySelector('i');
    if (!icon) return;

    if (isEditMode) {
        // Сейчас Редактирование -> Кнопка предлагает "Читать"
        icon.className = 'fa-solid fa-book-open'; 
        btn.title = 'Перейти в режим чтения';
    } else {
        // Сейчас Чтение -> Кнопка предлагает "Редактировать"
        icon.className = 'fa-solid fa-pen-nib'; 
        btn.title = 'Режим редактирования';
    }
}

// === ЗАКЛАДКИ ===
function initBookmarkLogic(btn) {
    btn.addEventListener('click', async () => {
        const activeElement = document.querySelector('.fs-item.file.active');
        if (!activeElement) return;
        if (window.pywebview?.api) {
            try {
                const res = await window.pywebview.api.toggle_bookmark(activeElement.dataset.id);
                if (res.status === 'ok') updateBookmarkIcon(btn, activeElement.dataset.id);
                if (window.renderFileSystem) {
                    window.renderFileSystem();
                        }
            } catch(e){}
        }
    });
}
window.updateBookmarkIcon = async function(btn, fileId) {
    const icon = btn.querySelector('i');
    if (!icon) return;
    if (window.pywebview?.api) {
        try {
            const b = await window.pywebview.api.get_bookmarks();
            icon.className = b.includes(fileId) ? 'fa-solid fa-bookmark' : 'fa-regular fa-bookmark';
        } catch(e) {}
    }
};