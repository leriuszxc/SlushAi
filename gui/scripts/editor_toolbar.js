document.addEventListener('DOMContentLoaded', () => {
    initFloatingToolbar();
});

function initFloatingToolbar() {
    const contentArea = document.getElementById('lecture-text');
    const toolbar = document.getElementById('floating-toolbar');
    
    // Элементы UI
    const submenuFormat = document.getElementById('ft-submenu-format');
    const mainButtons = document.getElementById('ft-main-buttons');
    const aiContainer = document.getElementById('ft-ai-container');
    
    // Элементы AI Views
    const viewInput = document.getElementById('ft-ai-view-input');
    const viewLoading = document.getElementById('ft-ai-view-loading');
    const viewResponse = document.getElementById('ft-ai-view-response');
    
    // Inputs & Content
    const inputMain = document.getElementById('ft-ai-input');
    const inputReply = document.getElementById('ft-ai-reply-input');
    const contextBlock = document.getElementById('ft-ai-context');
    const responseText = document.getElementById('ft-ai-response-text');
    const sourcesContainer = document.getElementById('ft-ai-sources');

    // Кнопки
    const btnSendMain = document.getElementById('btn-ft-ai-send');
    const btnSendReply = document.getElementById('btn-ft-ai-reply-send');

    let savedSelectionText = "";

    if (!contentArea || !toolbar) return;

    // === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
    function setAiState(state) {
        // state: 'input' | 'loading' | 'response'
        if (viewInput) viewInput.style.display = (state === 'input') ? 'block' : 'none';
        if (viewLoading) viewLoading.style.display = (state === 'loading') ? 'flex' : 'none';
        if (viewResponse) viewResponse.style.display = (state === 'response') ? 'flex' : 'none';
    }

    // Красивое отображение домена из ссылки
    function getDomain(url) {
        try {
            return new URL(url).hostname.replace('www.', '');
        } catch (e) {
            return "Источник";
        }
    }

    // Рендеринг источников
    function renderSources(citations) {
        if (!sourcesContainer) return;
        sourcesContainer.innerHTML = '';
        
        if (!citations || citations.length === 0) {
            sourcesContainer.style.display = 'none';
            return;
        }
        sourcesContainer.style.display = 'flex';

        citations.forEach((url, index) => {
            const domain = getDomain(url);
            
            const chip = document.createElement('a');
            chip.className = 'ft-source-chip';
            chip.href = url;
            chip.target = '_blank'; // Открывать в браузере
            chip.title = url;
            
            // Если индекс >= 3, скрываем по умолчанию
            if (index >= 3) {
                chip.classList.add('ft-source-hidden');
            }

            chip.innerHTML = `
                <span>${domain}</span>
            `;
            
            sourcesContainer.appendChild(chip);
        });

        // Если источников больше 3, добавляем кнопку "+"
        if (citations.length > 3) {
            const moreBtn = document.createElement('button');
            moreBtn.className = 'ft-source-more-btn';
            moreBtn.innerHTML = `<i class="fa-solid fa-plus"></i>`;
            moreBtn.title = "Показать все источники";
            
            moreBtn.onclick = () => {
                // Показываем скрытые
                const hiddenItems = sourcesContainer.querySelectorAll('.ft-source-hidden');
                hiddenItems.forEach(item => item.classList.remove('ft-source-hidden'));
                // Удаляем кнопку "+"
                moreBtn.remove();
            };
            
            sourcesContainer.appendChild(moreBtn);
        }
    }

    // Общая функция отправки запроса
    async function handleAiRequest(question) {
        if (!question) return;

        // Переключаем на загрузку
        setAiState('loading');
        
        // Очищаем инпуты
        if (inputMain) inputMain.value = '';
        if (inputReply) inputReply.value = '';

        try {
            if (window.pywebview && window.pywebview.api) {
                const res = await window.pywebview.api.ask_ai(question, savedSelectionText);

                if (res.status === 'ok') {
                    let rawText = res.answer;

                    // 1. Заменяем LaTeX скобки, чтобы Marked их не съел
                    // \[ ... \]  ->  $$ ... $$  (Блочная формула)
                    // \( ... \)  ->  $ ... $    (Строчная формула)
                    
                    // Заменяем \[ и \] на $$
                    let safeText = rawText.replace(/\\\[/g, '$$').replace(/\\\]/g, '$$');
                    
                    // Заменяем \( и \) на $
                    safeText = safeText.replace(/\\\(/g, '$').replace(/\\\)/g, '$');

                    // 2. Обработка цитат [1] -> <sup>[1]</sup>
                    safeText = safeText.replace(/\[(\d+)\]/g, '<sup>[$1]</sup>');

                    // 3. Теперь безопасно прогоняем через Marked
                    responseText.innerHTML = marked.parse(safeText);

                    // 4. Заставляем MathJax отрисовать формулы
                    if (window.MathJax && window.MathJax.typesetPromise) {
                        window.MathJax.typesetPromise([responseText])
                            .then(() => {
                                // Формулы отрисовались
                            })
                            .catch((err) => console.error('MathJax error:', err));
                    }
                    
                    renderSources(res.citations);
                    setAiState('response');
                } else {
                    responseText.innerText = "Ошибка: " + res.message;
                    renderSources([]);
                    setAiState('response');
                }
            } else {
                // ДЕМО
                setTimeout(() => {
                    responseText.innerText = "Демо-ответ.\nВы спросили: " + question + "\n\n(Подключите backend для реального ответа)";
                    renderSources([
                        "https://ru.wikipedia.org/wiki/Искусственный_интеллект",
                        "https://habr.com/ru/articles/",
                        "https://google.com/search?q=test",
                        "https://yandex.ru"
                    ]);
                    setAiState('response');
                }, 1500);
            }
        } catch (e) {
            responseText.innerText = "Ошибка JS: " + e;
            setAiState('response');
        }
    }

    // === ЛОГИКА ТУЛБАРА (Позиционирование и открытие) ===
    contentArea.addEventListener('contextmenu', (e) => {
        if (contentArea.contains(e.target)) {
            e.preventDefault(); 
            const selection = window.getSelection();
            savedSelectionText = selection.toString().trim();
            showToolbar(e.clientX, e.clientY, true);
        } else {
            hideToolbar();
        }
    });

    document.addEventListener('mousedown', (e) => {
        if (toolbar.contains(e.target)) return; 
        hideToolbar();
    });

    function showToolbar(mouseX, mouseY, shouldReset = true) {
        toolbar.classList.add('visible');
        if (shouldReset) resetToolbarState();

        const width = toolbar.offsetWidth;
        const height = toolbar.offsetHeight;
        
        let left = mouseX + 10;
        let top = mouseY + 10;

        // Базовая проверка границ
        if (left + width > window.innerWidth) left = mouseX - 10 - width;
        if (top + height > window.innerHeight) top = mouseY - 10 - height;
        if (left < 10) left = 10;
        if (top < 10) top = 10;

        toolbar.style.left = `${left + window.scrollX}px`;
        toolbar.style.top = `${top + window.scrollY}px`;
    }

    function hideToolbar() {
        toolbar.classList.remove('visible');
        closeAllSubmenus();
    }

    function resetToolbarState() {
        if (mainButtons) mainButtons.style.display = 'flex';
        closeAllSubmenus();
    }

    function closeAllSubmenus() {
        if (submenuFormat) submenuFormat.classList.remove('visible');
        if (aiContainer) aiContainer.classList.remove('visible');
    }

    // === ОБРАБОТЧИКИ СОБЫТИЙ ===

    // 1. Открытие окна AI
    const btnAi = document.getElementById('btn-ft-ai');
    if (btnAi) {
        btnAi.addEventListener('click', () => {
            const isVisible = aiContainer.classList.contains('visible');
            closeAllSubmenus();

            if (!isVisible) {
                aiContainer.classList.add('visible');
                setAiState('input'); // Всегда начинаем с чистого ввода
                
                // Контекст
                if (contextBlock) {
                    if (savedSelectionText) {
                        contextBlock.style.display = 'block';
                        const txt = savedSelectionText.length > 50 ? savedSelectionText.substring(0,50)+'...' : savedSelectionText;
                        contextBlock.textContent = `Контекст: "${txt}"`;
                    } else {
                        contextBlock.style.display = 'none';
                    }
                }
                setTimeout(() => inputMain.focus(), 50);
            }
        });
    }

    // 2. Отправка ПЕРВОГО запроса
    if (btnSendMain) {
        btnSendMain.addEventListener('click', () => handleAiRequest(inputMain.value.trim()));
    }
    // Enter в первом инпуте
    if (inputMain) {
        inputMain.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleAiRequest(inputMain.value.trim());
        });
    }

    // 3. Отправка УТОЧНЕНИЯ (Reply)
    if (btnSendReply) {
        btnSendReply.addEventListener('click', () => handleAiRequest(inputReply.value.trim()));
    }
    // Enter во втором инпуте
    if (inputReply) {
        inputReply.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') handleAiRequest(inputReply.value.trim());
        });
    }

    // 4. Форматирование
    const btnFormat = document.getElementById('btn-ft-format');
    if (btnFormat) {
        btnFormat.addEventListener('click', () => {
            const isVisible = submenuFormat.classList.contains('visible');
            closeAllSubmenus();
            if (!isVisible) submenuFormat.classList.add('visible');
        });
    }

    // 5. Команды редактора
    document.querySelectorAll('[data-cmd]').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            document.execCommand(btn.dataset.cmd, false, btn.dataset.val || null);
            if (btn.closest('.ft-submenu')) closeAllSubmenus();
        });
    });

    ['copy', 'cut'].forEach(action => {
        const btn = document.getElementById(`btn-ft-${action}`);
        if (btn) btn.addEventListener('click', () => {
            document.execCommand(action);
            hideToolbar();
        });
    });
    
    const btnPaste = document.getElementById('btn-ft-paste');
    if (btnPaste) btnPaste.addEventListener('click', async () => {
        try {
            const text = await navigator.clipboard.readText();
            document.execCommand('insertText', false, text);
        } catch (err) { alert('Используйте Ctrl+V'); }
        hideToolbar();
    });
}