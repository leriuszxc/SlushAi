function initEditor() {
    const editModeBtn = document.querySelector('.edit-mode-btn');
    const contentArea = document.getElementById('lecture-text') || document.querySelector('.lecture-content');
    const copyBtn = document.querySelector('.copy-btn');

    // Изначально включаем режим редактирования
    if (contentArea) {
        contentArea.contentEditable = 'true';

        if (editModeBtn) {
            const icon = editModeBtn.querySelector('i');
            if (icon) icon.className = 'fa-solid fa-book-open';
            editModeBtn.title = 'Режим чтения';
        }
    }

    // Смена режима
    if (editModeBtn && contentArea) {
        editModeBtn.addEventListener('click', () => {
            const isEditable = contentArea.isContentEditable;

            contentArea.contentEditable = (!isEditable).toString();

            if (!isEditable) {
                const icon = editModeBtn.querySelector('i');
                if (icon) icon.className = 'fa-solid fa-book-open';
                editModeBtn.title = 'Режим чтения';
            } else {
                const icon = editModeBtn.querySelector('i');
                if (icon) icon.className = 'fa-solid fa-pencil';
                editModeBtn.title = 'Режим редактирования';
                contentArea.focus();
            }
        });
    }

    // Копирование текста
    if (copyBtn && contentArea) {
        copyBtn.addEventListener('click', () => {
            const textToCopy = contentArea.innerText;
            const textArea = document.createElement("textarea");
            textArea.value = textToCopy;
            textArea.style.position = "fixed";
            textArea.style.left = "-9999px";
            document.body.appendChild(textArea);
            textArea.focus();
            textArea.select();
            
            try {
                document.execCommand('copy');
                const icon = copyBtn.querySelector('i');
                if (icon) {
                    const originalClass = icon.className;
                    icon.className = 'fa-solid fa-check';
                    setTimeout(() => { icon.className = originalClass; }, 2000);
                }
            } catch (err) {
                alert('Не удалось скопировать текст.');
            }
            document.body.removeChild(textArea);
        });
    }
}

function initEditor() {
    const editModeBtn = document.querySelector('.edit-mode-btn');
    const contentArea = document.getElementById('lecture-text') || document.querySelector('.lecture-content');
    const copyBtn = document.querySelector('.copy-btn');
    const bookmarkBtn = document.querySelector('.tool-btn i.fa-bookmark')?.parentElement;
    
    // === Избранные ===
    if (bookmarkBtn) {
        bookmarkBtn.addEventListener('click', async () => {
            // 1. Ищем элемент, который сейчас подсвечен (класс active) и является файлом
            const activeElement = document.querySelector('.fs-item.file.active');
            
            // Если ничего не выделено или выделена папка — выходим
            if (!activeElement) {
                alert('Сначала выберите файл в меню слева');
                return;
            }

            // 2. Берем ID прямо из data-атрибута выделенного элемента
            const currentFileId = activeElement.dataset.id;
            
        if (window.pywebview && window.pywebview.api) {
            try {
                const res = await window.pywebview.api.toggle_bookmark(currentFileId);
                
                if (res.status === 'ok') {
                    // Обновляем иконку
                    updateBookmarkIcon(bookmarkBtn, currentFileId);

                    // Обновляем сайдбар, если открыты избранные
                    const sidebarBookmarkBtn = document.querySelector('.icon-btn i.fa-bookmark')?.parentElement;
                    if (sidebarBookmarkBtn && sidebarBookmarkBtn.classList.contains('active') && window.renderFileSystem) {
                        window.renderFileSystem();
                    }
                } else {
                    console.error('Ошибка избранных:', res.message);
                }
            } catch (e) {
                console.error('Ошибка при работе с избранными:', e);
            }
        }
        });
    }
}

// Проверка, находится ли файл в закладках
async function isBookmarked(fileId) {
    if (window.pywebview && window.pywebview.api) {
        try {
            const bookmarks = await window.pywebview.api.get_bookmarks();
            return bookmarks.includes(fileId);
        } catch (e) {
            console.error(e);
            return false;
        }
    }
    return false;
}

// Обновление иконки избранных
async function updateBookmarkIcon(btn, fileId) {
    const icon = btn.querySelector('i');
    if (!icon) return;
    
    const bookmarked = await isBookmarked(fileId);
    
    if (bookmarked) {
        icon.className = 'fa-solid fa-bookmark'; // Заполненная иконка
        btn.title = 'Удалить из закладок';
    } else {
        icon.className = 'fa-regular fa-bookmark'; // Пустая иконка
        btn.title = 'Добавить в избранные';
    }
}

// Делаем функцию глобальной для вызова из sidebar.js
window.updateBookmarkIcon = updateBookmarkIcon;
