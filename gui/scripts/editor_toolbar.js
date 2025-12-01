document.addEventListener('DOMContentLoaded', () => {
    initFloatingToolbar();
});

function initFloatingToolbar() {
    const contentArea = document.getElementById('lecture-text');
    const toolbar = document.getElementById('floating-toolbar');
    
    // Элементы
    const submenuFormat = document.getElementById('ft-submenu-format');
    const mainButtons = document.getElementById('ft-main-buttons');
    const aiContainer = document.getElementById('ft-ai-container');
    const aiInput = document.getElementById('ft-ai-input');
    const aiContext = document.getElementById('ft-ai-context');

    let savedSelectionText = "";

    if (!contentArea || !toolbar) return;

    // === 1. ОТСЛЕЖИВАНИЕ ПРАВОЙ КНОПКИ МЫШИ ===
    contentArea.addEventListener('contextmenu', (e) => {
        if (contentArea.contains(e.target)) {
            e.preventDefault(); 
            const selection = window.getSelection();
            savedSelectionText = selection.toString().trim();

            // Показываем тулбар (с полным сбросом состояния)
            showToolbar(e.clientX, e.clientY, true);
        } else {
            hideToolbar();
        }
    });

    document.addEventListener('mousedown', (e) => {
        // Если клик внутри тулбара, подменю или AI окна — не закрываем
        if (toolbar.contains(e.target)) return; 
        hideToolbar();
    });

    // === 2. ПОЗИЦИОНИРОВАНИЕ ===
    function showToolbar(mouseX, mouseY, shouldReset = true) {
        toolbar.classList.add('visible');
        
        if (shouldReset) {
            resetToolbarState();
        }

        const width = toolbar.offsetWidth;
        const height = toolbar.offsetHeight;
        
        const offsetX = 10;
        const offsetY = 10;
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;

        let left, top;

        // X: Справа или Слева
        if (mouseX + offsetX + width < winWidth) {
            left = mouseX + offsetX;
        } else {
            left = mouseX - offsetX - width;
        }

        // Y: Снизу или Сверху
        if (mouseY + offsetY + height < winHeight) {
            top = mouseY + offsetY;
        } else {
            top = mouseY - offsetY - height;
        }

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
        // Убеждаемся, что основные кнопки видны (хотя мы их теперь и не скрываем)
        if (mainButtons) mainButtons.style.display = 'flex';
        // Очищаем инпут
        if (aiInput) aiInput.value = ''; 
        // Закрываем все выпадающие меню
        closeAllSubmenus();
    }

    function closeAllSubmenus() {
        // Закрываем меню форматирования
        if (submenuFormat) submenuFormat.classList.remove('visible');
        // Закрываем окно AI
        if (aiContainer) aiContainer.classList.remove('visible');
    }

    // === 3. ОБРАБОТКА КНОПОК ===

    // -- AI Кнопка (теперь работает как toggle меню) --
    const btnAi = document.getElementById('btn-ft-ai');
    if (btnAi) {
        btnAi.addEventListener('click', () => {
            // Проверяем, открыто ли уже окно
            const isVisible = aiContainer.classList.contains('visible');
            
            // Сначала закрываем всё (включая меню форматирования)
            closeAllSubmenus();

            if (!isVisible) {
                // Открываем AI окно
                aiContainer.classList.add('visible');
                
                // Логика контекста
                if (aiContext) {
                    if (savedSelectionText) {
                        aiContext.style.display = 'block';
                        const displayText = savedSelectionText.length > 40 
                            ? savedSelectionText.substring(0, 40) + '...' 
                            : savedSelectionText;
                        aiContext.textContent = `Контекст: "${displayText}"`;
                    } else {
                        aiContext.style.display = 'none';
                    }
                }
                
                // Фокус на инпут
                setTimeout(() => aiInput.focus(), 50);
            }
        });
    }

    // -- Отправка AI --
    const btnAiSend = document.getElementById('btn-ft-ai-send');
    if (btnAiSend) {
        btnAiSend.addEventListener('click', () => {
            const query = aiInput.value;
            let fullPrompt = query;
            if (savedSelectionText) {
                fullPrompt += `\n\nКонтекст:\n${savedSelectionText}`;
            }
            alert(`AI Запрос:\n${fullPrompt}`);
            // window.pywebview.api.ask_ai(...)
            hideToolbar();
        });
    }

    // -- Форматирование --
    const btnFormat = document.getElementById('btn-ft-format');
    if (btnFormat) {
        btnFormat.addEventListener('click', () => {
            const isVisible = submenuFormat.classList.contains('visible');
            
            // Закрываем всё (в том числе AI, если был открыт)
            closeAllSubmenus();
            
            if (!isVisible) {
                submenuFormat.classList.add('visible');
            }
        });
    }

    // -- Команды (Bold, etc) --
    const cmdButtons = document.querySelectorAll('[data-cmd]');
    cmdButtons.forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            const cmd = btn.dataset.cmd;
            const val = btn.dataset.val || null;
            document.execCommand(cmd, false, val);
            if (btn.closest('.ft-submenu')) closeAllSubmenus();
        });
    });

    // -- Copy/Paste --
    ['copy', 'cut'].forEach(action => {
        const btn = document.getElementById(`btn-ft-${action}`);
        if (btn) {
            btn.addEventListener('click', () => {
                document.execCommand(action);
                hideToolbar();
            });
        }
    });
    
    const btnPaste = document.getElementById('btn-ft-paste');
    if (btnPaste) {
        btnPaste.addEventListener('click', async () => {
            try {
                const text = await navigator.clipboard.readText();
                document.execCommand('insertText', false, text);
            } catch (err) {
                alert('Используйте Ctrl+V');
            }
            hideToolbar();
        });
    }
}