// <!-- /Окно настроек -->
document.addEventListener('DOMContentLoaded', () => {
    // --- КНОПКА ВЫХОДА (если появится) ---
    const closeAppBtn = document.querySelector('.close-app-btn');
    if (closeAppBtn) {
        closeAppBtn.addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    // --- ДАТА ---
    const dateEl = document.getElementById('current-date');
    if (dateEl) {
        const now = new Date();
        dateEl.textContent = now.toLocaleDateString('ru-RU');
    }
    
    const editModeBtn = document.querySelector('.edit-mode-btn');
    const contentArea = document.getElementById('lecture-text') || document.querySelector('.lecture-content');
    const titleArea = document.getElementById('lecture-title');
    let saveTimeout;
    
    // Функция автосохранения
    function triggerAutoSave() {
        clearTimeout(saveTimeout);
        // Ждем 500 мс после окончания ввода
        saveTimeout = setTimeout(() => {
            if (!contentArea || !titleArea) return;

            const currentFolder = contentArea.dataset.currentFolder;
            const currentFile = contentArea.dataset.currentFile;

            if (!currentFolder || !currentFile) return;

            const newTitle = titleArea.innerText.trim();
            const newContent = contentArea.innerText;

            if (window.pywebview && window.pywebview.api) {
                console.log("Saving...");
                window.pywebview.api.save_file(currentFolder, currentFile, newTitle, newContent)
                    .then(res => {
                        if (res.status === 'ok') {
                            console.log('Saved.');
                            // Если поменяли имя файла
                            if (res.new_name && res.new_name !== currentFile) {
                                contentArea.dataset.currentFile = res.new_name;
                                updateSidebarItemName(currentFile, res.new_name);
                            }
                        } else {
                            console.error('Ошибка сохранения:', res.message);
                        }
                    })
                    .catch(err => console.error(err));
            }
        }, 500);
    }

    function updateSidebarItemName(oldName, newName) {
        const activeItem = document.querySelector('.sub-list li.active');
        if (activeItem) {
            const nameSpan = activeItem.querySelector('.file-name');
            if (nameSpan && nameSpan.textContent === oldName) {
                nameSpan.textContent = newName;
            }
        }
    }

    // Включаем слушатели ввода
    if (titleArea) titleArea.addEventListener('input', triggerAutoSave);
    if (contentArea) contentArea.addEventListener('input', triggerAutoSave);

    // Сразу включаем режим редактирования
    if (contentArea && titleArea) {
        contentArea.contentEditable = 'true';
        titleArea.contentEditable = 'true';

        // Меняем иконку и title у кнопки (режим редактирования)
        if (editModeBtn) {
            const icon = editModeBtn.querySelector('i');
            icon.className = 'fa-solid fa-book-open';
            editModeBtn.title = 'Режим чтения';
        }
    }

    if (editModeBtn && contentArea && titleArea) {
        editModeBtn.addEventListener('click', () => {
            const isEditable = contentArea.isContentEditable;

            contentArea.contentEditable = (!isEditable).toString();
            titleArea.contentEditable = (!isEditable).toString();

            if (!isEditable) {
                // После клика — включаем редактирование
                const icon = editModeBtn.querySelector('i');
                icon.className = 'fa-solid fa-book-open';
                editModeBtn.title = 'Режим чтения';
            } else {
                // После клика — включаем чтение
                const icon = editModeBtn.querySelector('i');
                icon.className = 'fa-solid fa-pencil';
                editModeBtn.title = 'Режим редактирования';
                contentArea.focus();
            }
        });
    }



    // --- КОПИРОВАНИЕ ТЕКСТА ---
    const copyBtn = document.querySelector('.copy-btn');
    const lectureContent = document.getElementById('lecture-text') || document.querySelector('.lecture-content'); 

    if (copyBtn && lectureContent) {
        copyBtn.addEventListener('click', () => {
            const textToCopy = lectureContent.innerText;
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
                const originalClass = icon.className;
                icon.className = 'fa-solid fa-check';
                setTimeout(() => { icon.className = originalClass; }, 2000);
            } catch (err) {
                alert('Не удалось скопировать текст.');
            }
            document.body.removeChild(textArea);
        });
    }

    // === ОКНО НАСТРОЕК ===
    const settingsLoadModelBlockText = document.querySelector('.settings-load-model-text');
    const settingsLoadModelBlockAudio = document.querySelector('.settings-load-model-audio');

    const settingsBtn = document.querySelector('.settings-btn');
    const settingsOverlay = document.getElementById('settings-overlay');
    const settingsPanel = settingsOverlay ? settingsOverlay.querySelector('.settings-panel') : null;
    const settingsCloseBtn = document.getElementById('settings-close-btn');

    const settingsNavItems = document.querySelectorAll('.settings-nav-item');
    const settingsDetailTitle = document.getElementById('settings-detail-title');
    const settingsDetailSubtitle = document.getElementById('settings-detail-subtitle');
    const settingsDetailContent = document.getElementById('settings-detail-content');
    const navTextAiCurrent = document.getElementById('nav-text-ai-current');
    const applyModelBtnText = document.getElementById('settings-apply-model-text');
    const applyModelBtnAudio = document.getElementById('settings-apply-model-audio');

    const settingsState = {
        textModel: localStorage.getItem('slushai_text_model') || 'Gemma 3n',
        audioModel: localStorage.getItem('slushai_audio_model') || 'audio-nemotron-ru',
        theme: localStorage.getItem('slushai_theme') || 'light',
    };

    const defaultTextAiHTML = settingsDetailContent ? settingsDetailContent.innerHTML : '';

    function openSettings() {
        if (!settingsOverlay) return;
        settingsOverlay.classList.add('visible');
        document.body.style.overflow = 'hidden';
        switchSettingsSection('text-ai');
    }

    function closeSettings() {
        if (!settingsOverlay) return;
        settingsOverlay.classList.remove('visible');
        document.body.style.overflow = '';
    }

    function setActiveNav(section) {
        settingsNavItems.forEach(btn => {
            btn.classList.toggle('active', btn.dataset.section === section);
        });
    }

    function initTextModelCards() {
        if (!settingsDetailContent) return;
        const cards = settingsDetailContent.querySelectorAll('.settings-model-card');
        cards.forEach(card => {
            const model = card.dataset.model;
            card.classList.toggle('active', model === settingsState.textModel);
            card.addEventListener('click', () => {
                settingsState.textModel = model;
                localStorage.setItem('slushai_text_model', model);
                cards.forEach(c => c.classList.remove('active'));
                card.classList.add('active');
                if (navTextAiCurrent) navTextAiCurrent.textContent = model;
            });
        });
        if (navTextAiCurrent) navTextAiCurrent.textContent = settingsState.textModel;
    }

    function applyThemeClass() {
        if (settingsState.theme === 'dark') {
            document.body.classList.add('theme-dark');
        } else {
            document.body.classList.remove('theme-dark');
        }
    }

    function switchSettingsSection(section) {
        if (section === 'text-ai' || section === 'audio-ai') {
            if (section === 'text-ai'){
                settingsLoadModelBlockAudio.style.display = 'none';
                settingsLoadModelBlockText.style.display = 'block'; // Показываем
            } else {
                settingsLoadModelBlockText.style.display = 'none'; // Показываем
                settingsLoadModelBlockAudio.style.display = 'block';
            }
        } else {
            settingsLoadModelBlockAudio.style.display = 'none';
            settingsLoadModelBlockText.style.display = 'none';  // Скрываем для остальных вкладок
        }

        if (!settingsDetailContent || !settingsDetailTitle || !settingsDetailSubtitle) return;

        setActiveNav(section);

        if (section === 'text-ai') {
            settingsDetailTitle.textContent = 'Текстовые модели';
            settingsDetailSubtitle.textContent =
                'Выберите модель, с которой будут генерироваться конспекты и ответы в приложении.';
            settingsDetailContent.innerHTML = defaultTextAiHTML;
            initTextModelCards();

        } else if (section === 'audio-ai') {
            settingsDetailTitle.textContent = 'Модель для аудио';
            settingsDetailSubtitle.textContent =
                'Выберите голосовой движок и скорость чтения конспектов.';
            settingsDetailContent.innerHTML = `
                <div class="settings-model-list">
                    <button class="settings-model-card" data-audio="audio-nemotron-ru">
                        <span class="settings-model-name">audio-nemotron-ru</span>
                        <span class="settings-model-desc">
                            Русский голос, оптимальный по качеству и скорости. Хорош для лекций и конспектов.
                        </span>
                    </button>
                    <button class="settings-model-card" data-audio="tts-lite-ru">
                        <span class="settings-model-name">tts-lite-ru</span>
                        <span class="settings-model-desc">
                            Более лёгкий и быстрый голос. Подойдёт, если у устройства слабый процессор.
                        </span>
                    </button>
                    <div style="margin-top:10px; width:100%;">
                        <label style="font-size:0.8rem; color:#666;">Скорость чтения:</label>
                        <input type="range" min="0.8" max="1.4" step="0.1" value="1" id="audio-speed-range" style="width:100%;">
                        <div style="font-size:0.75rem; color:#777; margin-top:4px;">
                            Значение сохраняется только локально и пока не связано с backend.
                        </div>
                    </div>
                </div>
            `;

            const audioCards = settingsDetailContent.querySelectorAll('.settings-model-card');
            audioCards.forEach(card => {
                const model = card.dataset.audio;
                card.classList.toggle('active', model === settingsState.audioModel);
                card.addEventListener('click', () => {
                    settingsState.audioModel = model;
                    localStorage.setItem('slushai_audio_model', model);
                    audioCards.forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                });
            });

        } else if (section === 'theme') {
            settingsDetailTitle.textContent = 'Тема приложения';
            settingsDetailSubtitle.textContent =
                'Переключайте светлую и тёмную тему. Настройка действует только на этом устройстве.';
            settingsDetailContent.innerHTML = `
                <div class="settings-model-list">
                    <button class="settings-model-card" data-theme="light">
                        <span class="settings-model-name">Светлая тема</span>
                        <span class="settings-model-desc">
                            Классическое оформление с белым фоном — удобно для печати и чтения при дневном освещении.
                        </span>
                    </button>
                    <button class="settings-model-card" data-theme="dark">
                        <span class="settings-model-name">Тёмная тема</span>
                        <span class="settings-model-desc">
                            Снижает нагрузку на глаза в помещении и ночью. Фон и основные блоки затемняются.
                        </span>
                    </button>
                </div>
            `;

            const themeCards = settingsDetailContent.querySelectorAll('.settings-model-card');
            themeCards.forEach(card => {
                const mode = card.dataset.theme;
                card.classList.toggle('active', mode === settingsState.theme);
                card.addEventListener('click', () => {
                    settingsState.theme = mode;
                    localStorage.setItem('slushai_theme', mode);
                    themeCards.forEach(c => c.classList.remove('active'));
                    card.classList.add('active');
                    applyThemeClass();
                });
            });

        } else if (section === 'prompts') {
            settingsDetailTitle.textContent = 'Редактирование промптов AI';
            settingsDetailSubtitle.textContent =
                'Задайте стиль, в котором AI будет объяснять материал и оформлять конспекты.';
            settingsDetailContent.innerHTML = `
                <div class="settings-model-list">
                    <div style="cursor:default;">
                        <span class="settings-model-name">Основной промпт</span>
                        <br>
                        <span class="settings-model-desc">
                            Здесь в будущем можно будет настроить, как именно AI оформляет ваши лекции
                            (формулы, списки, примеры, стиль объяснения). Пока что это заглушка.
                        </span>
                    </div>
                    <textarea id="prompt-editor" rows="5" style="width:95%; border-radius:20px; border:1px solid #e3e6ee; padding:8px; font-size:0.95rem; resize: none; overflow-y: auto; max-height: 600px;">
AI-помощник, который помогает студенту ПетрГУ. Объясняй понятно, структурированно, с примерами и краткими выводами в конце.
                    </textarea>
                    <div style="font-size:0.75rem; color:#777;">
                        Текст промпта пока сохраняется только локально.
                    </div>
                </div>
            `;
            const promptTextarea = document.getElementById('prompt-editor');
            const savedPrompt = localStorage.getItem('slushai_main_prompt');
            if (savedPrompt) {
                promptTextarea.value = savedPrompt;
            }
            // Функция авто-высоты
            const autoResize = () => {
                promptTextarea.style.height = 'auto'; // Сброс
                promptTextarea.style.height = promptTextarea.scrollHeight + 'px'; // Установка по контенту
            };

            // Вызываем один раз при открытии, чтобы подстроить под сохраненный текст
            autoResize();

            promptTextarea.addEventListener('input', () => {
                autoResize(); // Вызываем при каждом вводе
                localStorage.setItem('slushai_main_prompt', promptTextarea.value);
            });

        } else if (section === 'model-params') {
            settingsDetailTitle.textContent = 'Параметры текстовой модели';
            settingsDetailSubtitle.textContent =
                'Базовые настройки креативности и длины ответа (пока только визуально).';
            settingsDetailContent.innerHTML = `
                <div class="settings-model-list">
                    <div style="cursor:default; padding-top:10px;">
                        <span class="settings-model-name">Температура</span>
                        <br>
                        <span class="settings-model-desc">
                            Чем выше температура, тем более креативные и разнообразные ответы (но может быть больше «фантазий»).
                        </span>
                        <input type="range" min="0.1" max="1.0" step="0.1" value="0.7" style="width:100%; margin-top:6px;">
                    </div>
                    <div style="cursor:default; padding-top:20px;">
                        <span class="settings-model-name" >Максимальная длина ответа</span>
                        <br>
                        <span class="settings-model-desc">
                            Сколько текста генерировать за один ответ. Настройка полезна для экономии трафика и времени.
                        </span>
                        <input type="range" min="512" max="4096" step="256" value="2048" style="width:100%; margin-top:6px;">
                    </div>
                </div>
            `;
        }
    }

    if (settingsBtn && settingsOverlay) {
        settingsBtn.addEventListener('click', openSettings);
    }
    if (settingsCloseBtn) {
        settingsCloseBtn.addEventListener('click', closeSettings);
    }
    if (settingsOverlay && settingsPanel) {
        settingsOverlay.addEventListener('click', (e) => {
            if (e.target === settingsOverlay) {
                closeSettings();
            }
        });
    }

    settingsNavItems.forEach(btn => {
        btn.addEventListener('click', () => {
            const section = btn.dataset.section;
            switchSettingsSection(section);
        });
    });

    if (applyModelBtnText) {
        applyModelBtnText.addEventListener('click', () => {
            alert(`Пока что это демонстрационное окно.\nВыбранная текстовая модель: ${settingsState.textModel}`);
        });
    }
    if (applyModelBtnAudio) {
        applyModelBtnAudio.addEventListener('click', () => {
            alert(`Пока что это демонстрационное окно.\nВыбранная аудио модель: ${settingsState.audioModel}`);
        });
    }

    applyThemeClass();

    // === ПОИСК ПО ДОКУМЕНТУ ===
    const docSearchToggle = document.getElementById('doc-search-toggle');
    const docSearchPanel = document.getElementById('doc-search-panel');
    const docSearchInput = document.getElementById('doc-search-input');
    const docSearchClose = document.getElementById('doc-search-close');
    const docSearchPrev = document.getElementById('doc-search-prev');
    const docSearchNext = document.getElementById('doc-search-next');
    const docSearchCounter = document.getElementById('doc-search-counter');

    let searchMatches = [];
    let searchIndex = -1;

    function escapeRegExp(str) {
        return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    }

    function updateSearchCounter() {
        if (!docSearchCounter) return;
        const total = searchMatches.length;
        if (!total || searchIndex < 0) {
            docSearchCounter.textContent = `0/${total}`;
        } else {
            docSearchCounter.textContent = `${searchIndex + 1}/${total}`;
        }
    }

    function clearDocHighlights() {
        const container = document.getElementById('lecture-text');
        if (!container) return;

        searchMatches = [];
        searchIndex = -1;
        updateSearchCounter();

        const elements = container.querySelectorAll('p, li, h1, h2, h3, h4');
        elements.forEach(el => {
            el.innerHTML = el.textContent;
        });
    }

    function applyCurrentMatch() {
        const textContainer = document.getElementById('lecture-text');
        if (textContainer) {
            textContainer.querySelectorAll('mark.doc-highlight-current')
                .forEach(m => m.classList.remove('doc-highlight-current'));
        }

        if (searchIndex < 0 || searchIndex >= searchMatches.length) return;

        const m = searchMatches[searchIndex];
        if (!m) return;

        m.classList.add('doc-highlight-current');
        const scrollContainer = document.querySelector('.content-area');

        if (scrollContainer) {
            const containerRect = scrollContainer.getBoundingClientRect();
            const elementRect = m.getBoundingClientRect();

            const currentScroll = scrollContainer.scrollTop;
            const relativeTop = elementRect.top - containerRect.top;

            const targetScroll = currentScroll + relativeTop - (scrollContainer.clientHeight / 2) + (elementRect.height / 2);

            scrollContainer.scrollTo({
                top: targetScroll,
                behavior: 'smooth'
            });
        } else {
            m.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
    }

    function highlightInDocument(query) {
        const container = document.getElementById('lecture-text');
        if (!container) return;

        clearDocHighlights();
        if (!query) return;

        const safeQuery = escapeRegExp(query);
        const regex = new RegExp(`(${safeQuery})`, 'gi');
        const elements = container.querySelectorAll('p, li, h1, h2, h3, h4');

        elements.forEach(el => {
            const text = el.textContent;
            if (!text) return;

            if (!regex.test(text)) {
                regex.lastIndex = 0;
                return;
            }

            const html = text.replace(regex, '<mark class="doc-highlight">$1</mark>');
            el.innerHTML = html;
            regex.lastIndex = 0;
        });

        searchMatches = Array.from(container.querySelectorAll('mark.doc-highlight'));
        if (searchMatches.length > 0) {
            searchIndex = 0;
            applyCurrentMatch();
        } else {
            searchIndex = -1;
        }
        updateSearchCounter();
    }

    function goToMatch(delta) {
        if (!searchMatches.length) return;

        searchIndex += delta;
        if (searchIndex < 0) {
            searchIndex = searchMatches.length - 1;
        } else if (searchIndex >= searchMatches.length) {
            searchIndex = 0;
        }
        applyCurrentMatch();
        updateSearchCounter();
    }

    function openDocSearch() {
    if (!docSearchPanel) return;
    docSearchPanel.style.display = 'flex';   // показываем панель
    if (docSearchInput) {
        docSearchInput.focus();
        docSearchInput.select();
    }
}

function closeDocSearch() {
    if (!docSearchPanel) return;
    docSearchPanel.style.display = 'none';   // ПРЯЧЕМ панель
    clearDocHighlights();                    // убираем подсветку
    if (docSearchInput) {
        docSearchInput.value = '';           // очищаем поле
    }
}


    if (docSearchToggle && docSearchPanel && docSearchInput) {
        docSearchToggle.addEventListener('click', () => {
            if (docSearchPanel.classList.contains('visible')) {
                closeDocSearch();
            } else {
                openDocSearch();
                const q = docSearchInput.value.trim();
                if (q) highlightInDocument(q);
            }
        });

        docSearchInput.addEventListener('input', () => {
            const value = docSearchInput.value.trim();
            highlightInDocument(value);
        });

        docSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                if (e.shiftKey) {
                    goToMatch(-1);
                } else {
                    goToMatch(1);
                }
            } else if (e.key === 'Escape') {
                closeDocSearch();
            }
        });
    }

    if (docSearchClose) {
        docSearchClose.addEventListener('click', () => {
            closeDocSearch();
        });
    }

    if (docSearchPrev) {
        docSearchPrev.addEventListener('click', () => {
            goToMatch(-1);
        });
    }

    if (docSearchNext) {
        docSearchNext.addEventListener('click', () => {
            goToMatch(1);
        });
    }
});

function toggleDocSearchPanel() {
    const panel = document.getElementById('doc-search-panel');
    const input = document.getElementById('doc-search-input');
    if (!panel) return;

    // Если явно стоит display:flex — прячем, иначе показываем
    if (panel.style.display === 'flex') {
        panel.style.display = 'none';
    } else {
        panel.style.display = 'flex';
        if (input) {
            input.focus();
            input.select();
        }
    }
}
