document.addEventListener('DOMContentLoaded', async () => {
    // СОСТОЯНИЕ
    let fileSystem = []; // Изначально пусто, загрузим с бэкенда
    
    let activeFolderId = null;
    let sortOrder = 'asc'; // 'asc' или 'desc'
    let searchQuery = ''; // Поиск по директории

    // Элементы
    const container = document.getElementById('file-system-container');
    const sidebarSearchInput = document.getElementById('sidebar-search');
    const btnCreateFolder = document.getElementById('btn-create-folder');
    const btnCreateFile = document.getElementById('btn-create-file');
    const btnSort = document.getElementById('btn-sort');

    // Контекстное меню
    const contextMenu = document.createElement('div');
    contextMenu.className = 'context-menu';
    contextMenu.innerHTML = `
        <div class="context-menu-item" id="ctx-rename">
            <i class="fa-solid fa-pen"></i> Переименовать
        </div>
        <div class="context-menu-item" id="ctx-delete" style="color: #d32f2f;">
            <i class="fa-solid fa-trash"></i> Удалить
        </div>
    `;
    document.body.appendChild(contextMenu);
    let contextMenuTargetItem = null;    // Данные (JSON)
    let contextMenuTargetElement = null; // HTML-элемент (div), который будем менять

    // ЗАГРУЗКА ДАННЫХ ИЗ PYTHON 
    async function loadFileSystem() {
        if (window.pywebview && window.pywebview.api) {
            try {
                const data = await window.pywebview.api.get_files_structure(); 
                if (data) {
                    fileSystem = data;
                    render();
                }
            } catch (e) {
                console.error("Ошибка загрузки файлов из Python:", e);
            }
        } else {
            console.warn("Python backend не найден или не готов. Использую демо-данные.");
            fileSystem = [
                { id: 'demo1', type: 'folder', name: 'Демо папка', children: [], isOpen: true }
            ];
            render();
        }
    }
    
    window.loadFileSystem = loadFileSystem;


    // === 3. РЕНДЕРИНГ ===
    function render() {
        container.innerHTML = '';
        const filteredData = filterData(fileSystem, searchQuery);
        const sortedData = sortData([...filteredData]);
        renderRecursive(sortedData, container, 0);
    }

    function renderRecursive(items, parentElement, level) {
        items.forEach(item => {
            const itemDiv = document.createElement('div');
            itemDiv.className = `fs-item ${item.type}`;
            if (item.isOpen) itemDiv.classList.add('open'); // Для поворота стрелки
            
            itemDiv.dataset.id = item.id;
            itemDiv.draggable = true; // Включаем Drag & Drop
            
            if (item.id === activeFolderId) itemDiv.classList.add('active');
            
            // Отступ
            itemDiv.style.paddingLeft = `${5 + level * 15}px`;

            // 1. СТРЕЛОЧКА (Chevron)
            const arrow = document.createElement('i');
            arrow.className = 'arrow-icon fa-solid fa-chevron-right';
            // Если это файл или пустая папка (опционально), можно скрыть стрелку, 
            // но обычно у папок она есть всегда.
            if (item.type === 'file') {
                arrow.style.visibility = 'hidden';
            }
            
            // Клик по стрелочке — только открытие/закрытие
            arrow.onclick = (e) => {
                e.stopPropagation();
                toggleFolder(item);
            };

            // 2. ИКОНКА ПАПКИ/ФАЙЛА
            const icon = document.createElement('i');
            icon.className = item.type === 'folder' 
                ? (item.isOpen ? 'fa-regular fa-folder-open' : 'fa-regular fa-folder')
                : 'fa-regular fa-file-lines';
            
            // 3. НАЗВАНИЕ
            const nameSpan = document.createElement('span');
            nameSpan.textContent = item.name;
            nameSpan.className = 'fs-name';

            itemDiv.appendChild(arrow);
            itemDiv.appendChild(icon);
            itemDiv.appendChild(nameSpan);

            // СОБЫТИЯ
            itemDiv.onclick = (e) => handleItemClick(e, item);
            itemDiv.ondblclick = (e) => startEditing(itemDiv, item); // Редактирование
            
            // ПКМ
            itemDiv.addEventListener('contextmenu', (e) => {
                e.preventDefault();
                // Передаем сам DOM элемент третьим аргументом
                showContextMenu(e, item, itemDiv); 
            });

            addDragEvents(itemDiv, item);

            parentElement.appendChild(itemDiv);

            // Рекурсия
            if (item.type === 'folder' && item.isOpen && item.children) {
                renderRecursive(sortData([...item.children]), parentElement, level + 1);
            }
        });
    }

    function toggleFolder(item) {
        if (item.type === 'folder') {
            item.isOpen = !item.isOpen;
            render();
        }
    }

    // === ПЕРЕМЕННАЯ ДЛЯ ТАЙМЕРА АВТОСОХРАНЕНИЯ ===
    let saveTimeout = null; 

    async function handleItemClick(e, item) {
        if (item.type === 'folder') {
            activeFolderId = item.id;
            render();
        } else {
            activeFolderId = item.id;
            render();

            const titleEl = document.getElementById('lecture-title');
            if (titleEl) titleEl.textContent = 'Загрузка...';

            if (window.pywebview && window.pywebview.api) {
                try {
                    window.pywebview.api.save_last_file(item.id); // Последний файл
                    const res = await window.pywebview.api.read_file(item.id, item.name);
                    if (res.status === 'ok') {
                        // ПЕРЕДАЕМ item.id (ПОЛНЫЙ ПУТЬ) ДЛЯ СОХРАНЕНИЯ
                        updateContentArea(item.name, res.content, item.id);
                    } else {
                        updateContentArea("Ошибка", res.message, null);
                    }
                } catch (err) {
                    console.error(err);
                }
            } else {
                updateContentArea(item.name, "Backend не подключен.", null);
            }
        }
    }

    // === 5. СОЗДАНИЕ (И ВЫЗОВ PYTHON) ===

    // Кнопка: Создать папку
    btnCreateFolder.onclick = () => {
        // Создаем временный объект
        const newFolder = { 
            id: Date.now().toString(), 
            type: 'folder', 
            name: 'Новая папка', 
            children: [], 
            isOpen: true,
            isTemp: true // Флаг, что это только что созданный, еще не сохраненный в БД
        };
        fileSystem.push(newFolder);
        render();
        
        // Сразу включаем редактирование
        const el = document.querySelector(`[data-id="${newFolder.id}"]`);
        if (el) startEditing(el, newFolder);
    };

    // Кнопка: Создать файл
    btnCreateFile.onclick = () => {
        const newFile = { 
            id: Date.now().toString(), 
            type: 'file', 
            name: 'Новый файл',
            isTemp: true 
        };

        // Куда класть?
        if (activeFolderId) {
            const parent = findItemById(fileSystem, activeFolderId);
            if (parent && parent.type === 'folder') {
                parent.children.push(newFile);
                parent.isOpen = true;
            } else {
                // Если активен файл, кладем в его родительскую папку
                const parentFolder = getParentFolder(fileSystem, activeFolderId);
                if (parentFolder) {
                    parentFolder.children.push(newFile);
                    parentFolder.isOpen = true;
                } else {
                    fileSystem.push(newFile); // В корень
                }
            }
        } else {
            fileSystem.push(newFile); // В корень
        }

        render();
        const el = document.querySelector(`[data-id="${newFile.id}"]`);
        if (el) startEditing(el, newFile);
    };

    // === 6. РЕДАКТИРОВАНИЕ И СОХРАНЕНИЕ В PYTHON ===
    function startEditing(element, itemObj) {
        const span = element.querySelector('.fs-name');
        if (!span) return;
        
        const oldName = itemObj.name;
        const input = document.createElement('input');
        input.type = 'text';
        input.value = oldName;
        input.className = 'fs-input';

        // Заменяем текст на инпут
        span.replaceWith(input);
        input.focus();
        input.select();

        let isSaving = false;

        const save = async () => {
            if (isSaving) return;
            isSaving = true;

            const newName = input.value.trim();
            
            // Если имя пустое
            if (!newName) {
                if (itemObj.isTemp) removeItemFromTree(fileSystem, itemObj.id);
                render();
                return;
            }

            // Если имя не изменилось (и это не новый файл) — просто выходим
            if (!itemObj.isTemp && newName === oldName) {
                render();
                return;
            }

            // --- ОБЩЕНИЕ С PYTHON ---
            if (window.pywebview && window.pywebview.api) {
                try {
                    let res;
                    
                    if (itemObj.isTemp) {
                        // === СОЗДАНИЕ ===
                        if (itemObj.type === 'folder') {
                            res = await window.pywebview.api.create_folder(newName);
                        } else {
                            // Для создания нам нужно имя папки-родителя.
                            // Но т.к. мы теперь используем глобальный монитор, 
                            // нам важно просто создать файл, а монитор сам обновит дерево.
                            // Используем старую логику поиска родителя для создания
                            const parent = getParentFolder(fileSystem, itemObj.id);
                            // Если create_file в Python ожидает имя папки, а у нас вложенность...
                            // Лучше, если Python create_file будет умным. 
                            // Но пока используем имя родителя как есть.
                            const folderName = parent ? parent.name : ''; 
                            res = await window.pywebview.api.create_file(folderName, newName);
                        }
                    } else {
                        // === ПЕРЕИМЕНОВАНИЕ (НОВОЕ) ===
                        // Передаем ID (который является полным путем) и новое имя
                        res = await window.pywebview.api.rename_item(itemObj.id, newName);
                    }

                    if (res.status !== 'ok') {
                        alert('Ошибка: ' + res.message);
                        if (itemObj.isTemp) removeItemFromTree(fileSystem, itemObj.id);
                    } else {
                        // Успех!
                        // Мы можем даже не обновлять itemObj.name вручную, 
                        // так как Python Monitor заметит изменение файла на диске 
                        // и сам перезагрузит всё дерево через секунду.
                        // Но для мгновенного отклика можно обновить локально:
                        itemObj.name = newName;
                        delete itemObj.isTemp;
                    }

                } catch (e) {
                    console.error(e);
                    alert('Ошибка связи с Backend');
                    if (itemObj.isTemp) removeItemFromTree(fileSystem, itemObj.id);
                }
            } else {
                // Демо режим
                itemObj.name = newName;
                delete itemObj.isTemp;
            }

            render();
        };

        // Сохраняем по Enter или клику вне поля
        input.addEventListener('keydown', (e) => { 
            if (e.key === 'Enter') {
                input.blur(); // вызовет save через событие blur
            }
        });
        input.addEventListener('blur', save);
        input.onclick = (e) => e.stopPropagation();
    }

    // Позволяет другим скриптам (transcription.js) запустить переименование файла по ID
    window.editFileFromOutside = function(fileId) {
        // 1. Находим элемент в DOM
        const el = document.querySelector(`.fs-item[data-id="${fileId}"]`);
        
        // 2. Находим объект данных в массиве fileSystem (нужна функция поиска)
        // Если findItemById у вас не глобальная, убедитесь, что она доступна здесь
        const itemObj = findItemById(fileSystem, fileId);

        if (el && itemObj) {
            // Прокручиваем к файлу
            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
            
            // Запускаем режим редактирования (стандартная функция sidebar.js)
            startEditing(el, itemObj);
        } else {
            console.warn("Не удалось найти файл для редактирования:", fileId);
        }
    };

    // Кнопка "Переименовать"
    const renameBtn = document.getElementById('ctx-rename');
    if (renameBtn) {
        renameBtn.onclick = () => {
            // Если есть сохраненный элемент и данные
            if (contextMenuTargetElement && contextMenuTargetItem) {
                startEditing(contextMenuTargetElement, contextMenuTargetItem);
            }
            contextMenu.style.display = 'none';
        };
    }

    // === 7. УДАЛЕНИЕ (ЧЕРЕЗ PYTHON) ===
    document.getElementById('ctx-delete').onclick = async () => {
        if (!contextMenuTargetItem) return;
        
        const ok = confirm(`Удалить "${contextMenuTargetItem.name}"?`);
        if (!ok) return;

        const parent = getParentFolder(fileSystem, contextMenuTargetItem.id);
        const folderName = parent ? parent.name : '';
        
        if (window.pywebview && window.pywebview.api) {
            try {
                let res;
                if (contextMenuTargetItem.type === 'file') {
                    // Python: delete_file(folder, filename)
                    res = await window.pywebview.api.delete_file(contextMenuTargetItem.id);
                } else {
                    // Python: delete_folder(foldername) (убедитесь что метод есть)
                    // Если метода нет, можно запретить удалять папки
                    res = await window.pywebview.api.delete_folder(contextMenuTargetItem.id); 
                }

                if (res.status !== 'ok') {
                    alert('Ошибка удаления: ' + res.message);
                    return;
                }
            } catch(e) {
                console.error(e);
            }
        }

        // Если ок — удаляем из UI
        removeItemFromTree(fileSystem, contextMenuTargetItem.id);
        render();
    };

    // === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===

    function filterData(items, query) {
        if (!query) return items; // Если поиска нет, возвращаем как есть

        return items.reduce((acc, item) => {
            // Проверяем, совпадает ли имя самого элемента
            const matchesSelf = item.name.toLowerCase().includes(query);
            
            // Если это папка, рекурсивно ищем внутри
            let filteredChildren = [];
            if (item.children) {
                filteredChildren = filterData(item.children, query);
            }
            
            // Совпадает ли что-то внутри?
            const matchesChildren = filteredChildren.length > 0;

            // Если совпал сам элемент ИЛИ что-то внутри него
            if (matchesSelf || matchesChildren) {
                // Создаем копию элемента, чтобы не портить оригинальный массив
                const newItem = { ...item };
                
                // Если совпали дети, подменяем список детей на отфильтрованный
                if (matchesChildren) {
                    newItem.children = filteredChildren;
                    newItem.isOpen = true; // Важно: раскрываем папку, чтобы видеть найденное
                } else if (item.children) {
                    // Если совпало только имя папки, но не дети — показываем папку (можно с детьми или без)
                    // Здесь оставим детей как есть, либо [] если хотим скрыть несовпадающих детей
                    // Для удобства оставим item.children (показать всё в найденной папке) или filteredChildren (пустой)
                    // Обычно лучше показать пустую или полную. Сделаем так:
                        newItem.children = item.children; 
                }
                
                acc.push(newItem);
            }
            
            return acc;
        }, []);
    }
    
    function showContextMenu(e, item, element) {
        contextMenuTargetItem = item;
        contextMenuTargetElement = element;
        contextMenu.style.display = 'block';
        
        // Поправка, чтобы меню не улетало за край
        let x = e.clientX;
        let y = e.clientY;
        contextMenu.style.left = `${x}px`;
        contextMenu.style.top = `${y}px`;
    }
    
    document.addEventListener('click', () => { contextMenu.style.display = 'none'; });

    // Поиск родителя
    function getParentFolder(items, childId) {
        for (let item of items) {
            if (item.children) {
                if (item.children.some(c => c.id === childId)) return item;
                const found = getParentFolder(item.children, childId);
                if (found) return found;
            }
        }
        return null; // Значит в корне
    }

    function findItemById(items, id) {
        for (let item of items) {
            if (item.id === id) return item;
            if (item.children) {
                const f = findItemById(item.children, id);
                if (f) return f;
            }
        }
        return null;
    }

    function removeItemFromTree(items, id) {
        for (let i = 0; i < items.length; i++) {
            if (items[i].id === id) {
                items.splice(i, 1);
                return true;
            }lecture-meta
            if (items[i].children) {
                if (removeItemFromTree(items[i].children, id)) return true;
            }
        }
        return false;
    }
    
    // TODO
    function updateContentArea(title, content, fullPathId) {
        const titleEl = document.getElementById('lecture-title');
        const contentSection = document.getElementById('lecture-text');
        
        if (titleEl) titleEl.textContent = title;
        
        if (contentSection) {
            // Делаем область редактируемой
            contentSection.setAttribute('contenteditable', 'true');
            contentSection.style.outline = 'none'; // Убираем рамку при фокусе
            
            // Записываем текст
            // innerText сохраняет переносы строк лучше, чем innerHTML с <p> для редактора
            contentSection.innerText = content; 

            // === ЛОГИКА АВТОСОХРАНЕНИЯ ===
            contentSection.oninput = () => {
                // Сбрасываем предыдущий таймер
                if (saveTimeout) clearTimeout(saveTimeout);

                // Ставим новый таймер на 1 секунду
                saveTimeout = setTimeout(async () => {
                    if (fullPathId && window.pywebview && window.pywebview.api) {
                        const currentText = contentSection.innerText;
                        console.log("Автосохранение...");
                        const res = await window.pywebview.api.save_file_content(fullPathId, currentText);
                        if (res.status !== 'ok') {
                            console.error("Ошибка сохранения:", res.message);
                        }
                    }
                }, 50); // Задержка 50 мс
            };
        }
    }

    // TODO
    // Сортировка
    function sortData(items) {
        return items.sort((a, b) => {
            if (a.type !== b.type) return a.type === 'folder' ? -1 : 1;
            return sortOrder === 'asc' 
                ? a.name.localeCompare(b.name) 
                : b.name.localeCompare(a.name);
        });
    }

    if (sidebarSearchInput) {
        sidebarSearchInput.addEventListener('input', (e) => {
            searchQuery = e.target.value.trim().toLowerCase();
            render();
        });
    }

    btnSort.onclick = () => {
        sortOrder = sortOrder === 'asc' ? 'desc' : 'asc';
        btnSort.className = sortOrder === 'asc' ? 'fa-solid fa-arrow-down-a-z' : 'fa-solid fa-arrow-down-z-a';
        render();
    };

    // Drag & Drop (упрощенно, только визуал пока)
    // Drag & Drop
    let draggedItem = null;
    function addDragEvents(el, item) {
        el.addEventListener('dragstart', (e) => {
            draggedItem = item;
            e.dataTransfer.effectAllowed = 'move';
            // Небольшая задержка для визуала
            setTimeout(() => el.style.opacity = '0.5', 0);
        });

        el.addEventListener('dragend', () => {
            draggedItem = null;
            el.style.opacity = '1';
            document.querySelectorAll('.fs-item').forEach(x => x.classList.remove('drag-over'));
        });

        el.addEventListener('dragover', (e) => {
            e.preventDefault();
            // Подсветка только если наводим на папку и это не та же самая папка
            if (item.type === 'folder' && draggedItem !== item) {
                el.classList.add('drag-over');
            }
        });

        el.addEventListener('dragleave', () => el.classList.remove('drag-over'));

        // === БРОСОК В ПАПКУ ===
        el.addEventListener('drop', async (e) => {
            e.preventDefault();
            el.classList.remove('drag-over');

            // Проверки валидности
            if (!draggedItem || draggedItem.id === item.id || item.type !== 'folder') return;
            
            // ВАЖНО: Убираем вычисление старых папок.
            // Python теперь сам разберется по ID (путям).

            // ЗАПРОС В PYTHON
            if (window.pywebview && window.pywebview.api) {
                try {
                    // Передаем только: ЧТО тащим (ID) и КУДА тащим (ID папки)
                    const res = await window.pywebview.api.move_item(
                        draggedItem.id, 
                        item.id
                    );

                    if (res.status !== 'ok') {
                        // Если Python вернул ошибку (например, файл уже есть), показываем её
                        alert('Ошибка перемещения: ' + res.message);
                        return;
                    }

                    // УСПЕХ -> ПЕРЕЗАГРУЖАЕМ ДЕРЕВО
                    await loadFileSystem();

                } catch (err) {
                    console.error(err);
                    alert('Ошибка связи с Backend');
                }
            }
        });
    }

    if (container) {
        container.addEventListener('dragover', (e) => e.preventDefault());
        
        // === БРОСОК В ПУСТОЕ МЕСТО (В КОРЕНЬ) ===
        container.addEventListener('drop', async (e) => {
            // Проверяем, что бросили именно в фон контейнера, а не в конкретный элемент
            if (e.target === container && draggedItem) {
                e.preventDefault();
                
                if (window.pywebview && window.pywebview.api) {
                    try {
                        // Вызываем обновленный метод API
                        // 1 аргумент: ID (путь) того, что тащим
                        // 2 аргумент: "" (пустая строка означает корень)
                        const res = await window.pywebview.api.move_item(
                            draggedItem.id, 
                            "" 
                        );

                        if (res.status !== 'ok') {
                            // Можно использовать console.warn вместо alert, чтобы не надоедать, 
                            // если пользователь случайно дернул файл внутри корня
                            console.warn('Ошибка перемещения: ' + res.message); 
                            return;
                        }

                        // ПЕРЕЗАГРУЖАЕМ ДЕРЕВО
                        await loadFileSystem();

                    } catch (err) {
                        console.error(err);
                    }
                }
            }
        });
    }

    // ЗАПУСК: Грузим данные
    // 1. Функция инициализации
    function init() {
        // Проверяем, не загрузили ли мы уже данные, чтобы не дублировать
        if (fileSystem.length > 0 && !fileSystem[0].isTemp) return; 
        loadFileSystem();
    }

    // 2. Слушаем событие готовности pywebview
    window.addEventListener('pywebviewready', async () => {
        console.log("Pywebview API готов!");

        // 1. Загружаем настройки
        let settings = {};
        try {
            settings = await window.pywebview.api.get_settings();

            // Применяем зум (если есть такая функция)
            if (settings.zoom && window.AppZoom) {
                window.AppZoom.currentZoom = settings.zoom;
                window.AppZoom.apply();
            }
             // Применяем тему (если есть)
            if (settings.theme === 'dark') document.body.classList.add('theme-dark');
        } catch (e) { console.error(e); }

        // 2. Загружаем список файлов
        await loadFileSystem();

        // 3. ВОССТАНАВЛИВАЕМ ПОСЛЕДНИЙ ФАЙЛ
        if (settings.last_opened_file) {
            // Ищем этот файл в загруженном списке
            // Функция findItemById у вас уже есть в коде
            const fileItem = findItemById(fileSystem, settings.last_opened_file);
            
            if (fileItem) {
                console.log("Восстанавливаю файл:", fileItem.name);
                // Просто имитируем клик по файлу
                // Передаем null вместо события 'e', так как в ветке 'else' оно не используется
                handleItemClick(null, fileItem);
            }
        }
    });

    // 3. На случай, если pywebview уже загрузился до того, как сработал этот скрипт
    if (window.pywebview) {
        loadFileSystem();
    } else {
        // 4. ФОЛЛБЭК: Если через 0.5 сек pywebview не ответил, значит мы в браузере (тест верстки)
        // Это нужно, чтобы ДЕМО данные появились, если ты просто открыл html файл в Chrome
        setTimeout(() => {
            if (!window.pywebview) {
                console.log("Pywebview не обнаружен (таймаут). Грузим демо.");
                loadFileSystem();
            }
        }, 500);
    }
});