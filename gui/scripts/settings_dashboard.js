function initSettings() {
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
                if(settingsLoadModelBlockAudio) settingsLoadModelBlockAudio.style.display = 'none';
                if(settingsLoadModelBlockText) settingsLoadModelBlockText.style.display = 'block'; 
            } else {
                if(settingsLoadModelBlockText) settingsLoadModelBlockText.style.display = 'none'; 
                if(settingsLoadModelBlockAudio) settingsLoadModelBlockAudio.style.display = 'block';
            }
        } else {
            if(settingsLoadModelBlockAudio) settingsLoadModelBlockAudio.style.display = 'none';
            if(settingsLoadModelBlockText) settingsLoadModelBlockText.style.display = 'none';
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

                    if (window.pywebview && window.pywebview.api) {
                        window.pywebview.api.save_theme(mode); 
                    }
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
}