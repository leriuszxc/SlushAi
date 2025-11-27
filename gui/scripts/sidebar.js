document.addEventListener('DOMContentLoaded', () => {
    // Ждём готовности API Python
    window.addEventListener('pywebviewready', initApp);
    // На случай, если событие уже прошло
    if (window.pywebview) {
        initApp();
    }
});

function initApp() {
    console.log("Инициализация Sidebar...");

    const addFolderBtn = document.getElementById('add-folder-btn');
    const addFileGlobalBtn = document.getElementById('add-file-global-btn');
    const folderContainer = document.getElementById('folder-container');
    const searchInput = document.querySelector('.search-bar input');

    // --- 1. ЗАГРУЗКА СТРУКТУРЫ ИЗ PYTHON ---
    if (window.pywebview && window.pywebview.api) {
        window.pywebview.api.get_initial_structure().then((structure) => {
            console.log("Структура загружена:", structure);
            folderContainer.innerHTML = ''; // Очистка

            // Отрисовка папок и файлов
            for (const [folderName, files] of Object.entries(structure)) {
                const folderEl = createFolderElement(folderName);

                if (files && files.length > 0) {
                    const ul = folderEl.querySelector('.sub-list');
                    files.forEach(fileName => {
                        const cleanName = fileName.replace('.txt', '');
                        addFileVisual(ul, cleanName);
                    });
                }
            }

            // --- АВТО-ОТКРЫТИЕ ФАЙЛА "Мат. Анализ" ---
            setTimeout(() => {
                const targetFolder = "ПетрГУ Лекции";
                const targetFile = "Мат. Анализ"; // Без .txt

                const folderEl = findFolderElementByName(targetFolder);
                if (folderEl) {
                    folderEl.classList.remove('collapsed'); // Разворачиваем нужную папку

                    // Ищем файл
                    const filesLi = folderEl.querySelectorAll('li');
                    for (let li of filesLi) {
                        const nameEl = li.querySelector('.file-name') || li;
                        if (nameEl.textContent === targetFile) {
                            li.click(); // Имитируем клик для загрузки
                            break;
                        }
                    }
                }
            }, 200);
        }).catch(err => console.error("Ошибка получения структуры:", err));
    }

    // --- 2. КНОПКА: СОЗДАТЬ ПАПКУ ---
    if (addFolderBtn) {
        addFolderBtn.addEventListener('click', () => {
            const folderName = prompt('Название новой папки:', 'Новая папка');
            if (folderName) {
                window.pywebview.api.create_real_folder(folderName).then(res => {
                    if (res.status === 'ok') {
                        createFolderElement(folderName);
                    } else {
                        alert('Ошибка: ' + (res.message || 'неизвестная ошибка'));
                    }
                });
            }
        });
    }

    // --- 3. КНОПКА: СОЗДАТЬ ФАЙЛ (ПЛЮС) ---
    if (addFileGlobalBtn) {
        addFileGlobalBtn.addEventListener('click', () => {
            const folderName = prompt('В какой папке создать файл?', 'ПетрГУ Лекции');
            if (!folderName) return;

            const targetFolderEl = findFolderElementByName(folderName);
            if (!targetFolderEl) {
                alert(`Папка "${folderName}" не найдена!`);
                return;
            }

            const fileName = prompt('Название файла:', 'Новая заметка');
            if (fileName) {
                window.pywebview.api.create_real_file(folderName, fileName).then(res => {
                    if (res.status === 'ok') {
                        const ul = targetFolderEl.querySelector('.sub-list');
                        addFileVisual(ul, fileName);
                        targetFolderEl.classList.remove('collapsed');

                        // Сразу открываем созданный файл
                        const newLi = ul.lastElementChild;
                        if (newLi) newLi.click();
                    } else {
                        alert('Ошибка: ' + (res.message || 'неизвестная ошибка'));
                    }
                });
            }
        });
    }

    // --- 4. ПОИСК ПО ПАПКАМ И ФАЙЛАМ ---
    if (searchInput) {
        searchInput.addEventListener('input', () => {
            const query = searchInput.value.trim().toLowerCase();
            applySearchFilter(query);
        });
    }
}

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

function createFolderElement(name) {
    const container = document.getElementById('folder-container');
    const div = document.createElement('div');
    div.className = 'folder-group collapsed'; // Создаем свернутой по умолчанию

    div.innerHTML = `
        <div class="folder-header">
            <div class="folder-title-click">
                <span class="folder-name">${name}</span>
                <i class="fa-solid fa-chevron-down arrow-icon"></i>
            </div>
            <button class="icon-btn-sm delete-folder-btn" title="Удалить папку">
                <i class="fa-solid fa-trash"></i>
            </button>
        </div>
        <ul class="sub-list"></ul>
    `;

    container.appendChild(div);

    // Логика сворачивания
    const titleClick = div.querySelector('.folder-title-click');
    titleClick.addEventListener('click', () => {
        div.classList.toggle('collapsed');
    });

    // Удаление папки
    const deleteFolderBtn = div.querySelector('.delete-folder-btn');
    deleteFolderBtn.addEventListener('click', async (event) => {
        event.stopPropagation();

        const folderName = div.querySelector('.folder-name').textContent;
        const ok = confirm(`Удалить папку "${folderName}" вместе со всеми файлами? Это действие нельзя отменить.`);
        if (!ok) return;

        try {
            const res = await window.pywebview.api.delete_folder(folderName);
            if (res && res.status === 'ok') {
                const contentSection = document.getElementById('lecture-text');
                if (contentSection && contentSection.dataset.currentFolder === folderName) {
                    clearContentArea('Папка удалена.');
                }
                div.remove();
            } else {
                alert('Ошибка: ' + (res && res.message || 'не удалось удалить папку'));
            }
        } catch (e) {
            console.error(e);
            alert('Ошибка при удалении папки.');
        }
    });

    return div;
}

function addFileVisual(ul, fileName) {
    const li = document.createElement('li');
    li.classList.add('file-item');

    const nameSpan = document.createElement('span');
    nameSpan.classList.add('file-name');
    nameSpan.textContent = fileName;

    const deleteBtn = document.createElement('button');
    deleteBtn.classList.add('icon-btn-sm', 'delete-file-btn');
    deleteBtn.title = 'Удалить файл';
    deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';

    // Клик по строке файла — открыть
    li.addEventListener('click', () => {
        // Визуал
        document.querySelectorAll('.sub-list li').forEach(i => i.classList.remove('active'));
        li.classList.add('active');

        // Находим имя папки
        const folderName = li.closest('.folder-group').querySelector('.folder-name').textContent;

        // Обновляем шапку (мета-инфо)
        const metaFolder = document.getElementById('meta-folder-name');
        if (metaFolder) metaFolder.textContent = folderName;

        // Запрос содержимого
        if (window.pywebview && window.pywebview.api) {
            window.pywebview.api.read_file(folderName, fileName).then(res => {
                if (res.status === 'ok') {
                    updateContentArea(fileName, res.content, folderName);
                } else {
                    alert('Ошибка чтения: ' + (res.message || 'неизвестная ошибка'));
                }
            });
        }
    });

    // Клик по корзинке — удалить файл
    deleteBtn.addEventListener('click', async (event) => {
        event.stopPropagation(); // чтобы не срабатывало открытие файла

        const folderName = li.closest('.folder-group').querySelector('.folder-name').textContent;
        const ok = confirm(`Удалить файл "${fileName}"?`);
        if (!ok) return;

        try {
            const res = await window.pywebview.api.delete_file(folderName, fileName);
            if (res && res.status === 'ok') {
                const contentSection = document.getElementById('lecture-text');
                if (contentSection &&
                    contentSection.dataset.currentFolder === folderName &&
                    contentSection.dataset.currentFile === fileName) {
                    clearContentArea('Файл удалён.');
                }
                li.remove();
            } else {
                alert('Ошибка: ' + (res && res.message || 'не удалось удалить файл'));
            }
        } catch (e) {
            console.error(e);
            alert('Ошибка при удалении файла.');
        }
    });

    li.appendChild(nameSpan);
    li.appendChild(deleteBtn);
    ul.appendChild(li);
}

function updateContentArea(title, content, folderName) {
    const titleEl = document.getElementById('lecture-title');
    const contentSection = document.getElementById('lecture-text');

    if (titleEl) titleEl.textContent = title;

    if (contentSection) {
        contentSection.innerHTML = '';

        // Сохраняем, какой файл сейчас открыт
        contentSection.dataset.currentFolder = folderName || '';
        contentSection.dataset.currentFile = title || '';

        // Разбиваем текст на абзацы для красоты
        const paragraphs = content.split('\n');
        paragraphs.forEach(line => {
            if (line.trim()) {
                const p = document.createElement('p');
                p.textContent = line;
                contentSection.appendChild(p);
            } else {
                contentSection.appendChild(document.createElement('br'));
            }
        });
    }
}

function clearContentArea(message) {
    const titleEl = document.getElementById('lecture-title');
    const contentSection = document.getElementById('lecture-text');

    if (titleEl) {
        titleEl.textContent = '';
    }
    if (contentSection) {
        contentSection.innerHTML = '';
        contentSection.dataset.currentFolder = '';
        contentSection.dataset.currentFile = '';

        if (message) {
            const p = document.createElement('p');
            p.textContent = message;
            contentSection.appendChild(p);
        }
    }
}

function findFolderElementByName(name) {
    const allFolders = document.querySelectorAll('.folder-group');
    for (let folder of allFolders) {
        const folderNameEl = folder.querySelector('.folder-name');
        if (folderNameEl && folderNameEl.textContent === name) {
            return folder;
        }
    }
    return null;
}

// === ПОИСК: ФИЛЬТРАЦИЯ ПО ЗАПРОСУ ===
function applySearchFilter(query) {
    const groups = document.querySelectorAll('.folder-group');

    if (!query) {
        // Пустой запрос — показываем всё как было
        groups.forEach(group => {
            group.style.display = '';
            const items = group.querySelectorAll('li');
            items.forEach(li => {
                li.style.display = '';
            });
        });
        return;
    }

    groups.forEach(group => {
        const folderNameEl = group.querySelector('.folder-name');
        const folderName = folderNameEl ? folderNameEl.textContent.toLowerCase() : '';
        const items = group.querySelectorAll('li');

        let folderMatches = folderName.includes(query);
        let anyFileMatches = false;

        items.forEach(li => {
            const nameEl = li.querySelector('.file-name') || li;
            const fileName = nameEl.textContent.toLowerCase();
            const match = fileName.includes(query);
            li.style.display = match ? '' : 'none';
            if (match) anyFileMatches = true;
        });

        // Показываем папку, если совпало название папки или хотя бы один файл
        if (folderMatches || anyFileMatches) {
            group.style.display = '';
            // При поиске автоматически разворачиваем папку
            group.classList.remove('collapsed');
        } else {
            group.style.display = 'none';
        }
    });
}
