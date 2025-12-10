document.addEventListener('DOMContentLoaded', () => {
    initFloatingToolbar();
});

function initFloatingToolbar() {
    const contentArea = document.getElementById('lecture-text');
    const toolbar = document.getElementById('floating-toolbar');
    
    // Меню
    const submenuParagraph = document.getElementById('ft-submenu-paragraph');
    const submenuInsert = document.getElementById('ft-submenu-insert');
    
    const mainButtons = document.getElementById('ft-main-buttons');
    const aiContainer = document.getElementById('ft-ai-container');
    
    // AI Views
    const viewInput = document.getElementById('ft-ai-view-input');
    const viewLoading = document.getElementById('ft-ai-view-loading');
    const viewResponse = document.getElementById('ft-ai-view-response');
    
    // Inputs & Content
    const inputMain = document.getElementById('ft-ai-input');
    const inputReply = document.getElementById('ft-ai-reply-input');
    const contextBlock = document.getElementById('ft-ai-context');
    const responseText = document.getElementById('ft-ai-response-text');
    const sourcesContainer = document.getElementById('ft-ai-sources');

    // Кнопки отправки
    const btnSendMain = document.getElementById('btn-ft-ai-send');
    const btnSendReply = document.getElementById('btn-ft-ai-reply-send');

    let savedSelectionText = "";

    if (!contentArea || !toolbar) return;

    // =========================================================
    // 1. ХЕЛПЕРЫ
    // =========================================================

    // Текст выделения с \n (selection.toString, а не range.toString) [web:57]
    function getSelectedText() {
        const sel = window.getSelection();
        if (!sel.rangeCount) return "";
        return sel.toString();
    }

    // Заменить текущее выделение текстом (1 операция для undo) [web:13]
    function replaceSelection(text) {
        document.execCommand('insertText', false, text);
    }

    // Поставить каретку на смещение относительно текущей позиции
    function moveCaretBy(offsetBackFromEnd) {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;
        const range = sel.getRangeAt(0);
        const node = range.startContainer;
        const pos = range.startOffset;
        const newRange = document.createRange();
        newRange.setStart(node, Math.max(0, pos - offsetBackFromEnd));
        newRange.collapse(true);
        sel.removeAllRanges();
        sel.addRange(newRange);
    }

    // =========================================================
    // 2. ОСНОВНАЯ ФУНКЦИЯ ВСТАВКИ MARKDOWN
    // =========================================================
    function insertMarkdownSyntax(startChars, endChars = "", type = "standard") {
        const sel = window.getSelection();
        if (!sel.rangeCount) return;

        const selectedText = getSelectedText();

        // ---------- ССЫЛКА ----------
        if (type === 'link') {
            if (selectedText) {
                replaceSelection('[' + selectedText + ']()');
            } else {
                replaceSelection('[]()');
                moveCaretBy(1); // поставить каретку внутрь []
            }
            triggerInput();
            hideToolbar();
            return;
        }

        // ---------- БЛОК КОДА ----------
        if (type === 'code-block') {
            if (selectedText) {
                const newText = "```\n" + selectedText + "\n```";
                replaceSelection(newText);
            } else {
                replaceSelection("```\n\n```");
                moveCaretBy(4); // между \n\n
            }
            triggerInput();
            hideToolbar();
            return;
        }

        // ---------- БЛОК МАТЕМАТИКИ ----------
        if (type === 'math-block') {
            if (selectedText) {
                const newText = "$$\n" + selectedText + "\n$$";
                replaceSelection(newText);
            } else {
                replaceSelection("$$\n\n$$");
                moveCaretBy(3);
            }
            triggerInput();
            hideToolbar();
            return;
        }

        // ---------- ЛИНЕЙНЫЕ БЛОЧНЫЕ (СПИСКИ, ЗАГОЛОВКИ, ЦИТАТЫ, TASK-LIST, remove-heading) ----------
        const lineTypes = ['remove-heading', 'ul', 'ol', 'task-list', 'quote', 'h1','h2','h3','h4','h5','h6'];
        const isLineBlock = lineTypes.includes(type);

        // если нет выделения и это блочный тип — просто вставляем префикс
        if (isLineBlock && !selectedText) {
            const prefix = getLinePrefix(type, 0);
            replaceSelection(prefix);
            triggerInput();
            hideToolbar();
            return;
        }

        if (isLineBlock && selectedText) {
            const lines = selectedText.split('\n');
            const newLines = lines.map((line, index) => {
                const trimmed = line.trim();
                if (!trimmed) return line;

                if (type === 'remove-heading') {
                    return line.replace(/^#+\s*/, "");
                }

                if (type === 'ol') {
                    return `${index + 1}. ${line.replace(/^\d+\.\s*/, "")}`;
                }

                if (type === 'task-list') {
                    return line.replace(/^- \[.\]\s*/, "").replace(/^/, "- [ ] ");
                }

                // заголовки
                if (type === 'h1') return "# " + line.replace(/^#+\s*/, "");
                if (type === 'h2') return "## " + line.replace(/^#+\s*/, "");
                if (type === 'h3') return "### " + line.replace(/^#+\s*/, "");
                if (type === 'h4') return "#### " + line.replace(/^#+\s*/, "");
                if (type === 'h5') return "##### " + line.replace(/^#+\s*/, "");
                if (type === 'h6') return "###### " + line.replace(/^#+\s*/, "");

                if (type === 'ul') {
                    return "- " + line.replace(/^- \s*/, "");
                }

                if (type === 'quote') {
                    return "> " + line.replace(/^>\s*/, "");
                }

                return line;
            });

            const newText = newLines.join('\n');
            replaceSelection(newText);
            triggerInput();
            hideToolbar();
            return;
        }

        // ---------- ИНЛАЙН-ФОРМАТЫ (жирный, курсив, ``, $, ~~ и т.п.) ----------
        if (type === 'standard' && (startChars || endChars)) {
            if (selectedText) {
                const newText = startChars + selectedText + endChars;
                replaceSelection(newText);
            } else {
                const insert = startChars + endChars;
                replaceSelection(insert);
                if (endChars) {
                    moveCaretBy(endChars.length);
                }
            }
            triggerInput();
            hideToolbar();
            return;
        }

        // fallback: ничего не делаем
    }

    function getLinePrefix(type, index) {
        switch (type) {
            case 'ul': return "- ";
            case 'ol': return (index + 1) + ". ";
            case 'task-list': return "- [ ] ";
            case 'quote': return "> ";
            case 'h1': return "# ";
            case 'h2': return "## ";
            case 'h3': return "### ";
            case 'h4': return "#### ";
            case 'h5': return "##### ";
            case 'h6': return "###### ";
            default: return "";
        }
    }

    function triggerInput() {
        const contentAreaEl = document.getElementById('lecture-text');
        if (contentAreaEl) {
            contentAreaEl.dispatchEvent(new Event('input', { bubbles: true }));
        }
    }

    // =========================================================
    // 3. ОБРАБОТКА КЛИКОВ
    // =========================================================
    
    document.addEventListener('click', (e) => {
        if (!toolbar.classList.contains('visible')) return;

        // Инлайновые: data-md-start / data-md-end
        const btnMd = e.target.closest('[data-md-start]');
        if (btnMd) {
            e.preventDefault();
            e.stopPropagation();
            const start = btnMd.getAttribute('data-md-start') || "";
            const end = btnMd.getAttribute('data-md-end') || "";
            insertMarkdownSyntax(start, end, "standard");
            return;
        }

        // Блочные/специальные: data-type
        const btnType = e.target.closest('[data-type]');
        if (btnType) {
            e.preventDefault();
            e.stopPropagation();
            const type = btnType.getAttribute('data-type');

            switch (type) {
                case 'code-block':
                    insertMarkdownSyntax("", "", "code-block");
                    break;
                case 'math-block':
                    insertMarkdownSyntax("", "", "math-block");
                    break;
                case 'link':
                    insertMarkdownSyntax("", "", "link");
                    break;
                case 'remove-heading':
                    insertMarkdownSyntax("", "", "remove-heading");
                    break;
                // списки
                case 'ul':
                    insertMarkdownSyntax("", "", "ul");
                    break;
                case 'ol':
                    insertMarkdownSyntax("", "", "ol");
                    break;
                case 'task-list':
                    insertMarkdownSyntax("", "", "task-list");
                    break;
                // заголовки h1–h6
                case 'h1':
                case 'h2':
                case 'h3':
                case 'h4':
                case 'h5':
                case 'h6':
                    insertMarkdownSyntax("", "", type);
                    break;
                // цитата
                case 'quote':
                    insertMarkdownSyntax("", "", "quote");
                    break;
                default:
                    insertMarkdownSyntax("", "", type);
            }
            return;
        }
    });

    // =========================================================
    // 4. УПРАВЛЕНИЕ МЕНЮ (Smart Open)
    // =========================================================

    function closeAllSubmenus() {
        if (submenuParagraph) submenuParagraph.classList.remove('visible', 'open-up');
        if (submenuInsert) submenuInsert.classList.remove('visible', 'open-up');
        if (aiContainer) aiContainer.classList.remove('visible', 'open-up');
    }

    function toggleSubmenuSmart(menu) {
        if (!menu) return;
        const isVisible = menu.classList.contains('visible');
        closeAllSubmenus(); 

        if (!isVisible) {
            const toolbarRect = toolbar.getBoundingClientRect();
            const spaceBelow = window.innerHeight - toolbarRect.bottom;
            if (spaceBelow < 300) {
                menu.classList.add('open-up');
            } else {
                menu.classList.remove('open-up');
            }
            menu.classList.add('visible');
        }
    }

    const btnParagraph = document.getElementById('btn-ft-paragraph');
    if (btnParagraph) {
        btnParagraph.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSubmenuSmart(submenuParagraph);
        });
    }

    const btnInsert = document.getElementById('btn-ft-insert');
    if (btnInsert) {
        btnInsert.addEventListener('click', (e) => {
            e.stopPropagation();
            toggleSubmenuSmart(submenuInsert);
        });
    }
    
    const btnAi = document.getElementById('btn-ft-ai');
    if (btnAi) {
        btnAi.addEventListener('click', (e) => {
            e.stopPropagation();
            const isVisible = aiContainer && aiContainer.classList.contains('visible');
            closeAllSubmenus();
            
            if (!isVisible && aiContainer) {
                const toolbarRect = toolbar.getBoundingClientRect();
                if ((window.innerHeight - toolbarRect.bottom) < 300) { 
                    aiContainer.classList.add('open-up');
                } else {
                    aiContainer.classList.remove('open-up');
                }
                aiContainer.classList.add('visible');
                setAiState('input');
                if (contextBlock) {
                    if (savedSelectionText) {
                        contextBlock.style.display = 'block';
                        const txt = savedSelectionText.length > 60 ? savedSelectionText.substring(0,60)+'...' : savedSelectionText;
                        contextBlock.textContent = `Контекст: "${txt}"`;
                    } else {
                        contextBlock.style.display = 'none';
                    }
                }
                setTimeout(() => inputMain && inputMain.focus(), 50);
            }
        });
    }

    // =========================================================
    // 5. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ (AI, Источники)
    // =========================================================

    function setAiState(state) {
        if (viewInput) viewInput.style.display = (state === 'input') ? 'block' : 'none';
        if (viewLoading) viewLoading.style.display = (state === 'loading') ? 'flex' : 'none';
        if (viewResponse) viewResponse.style.display = (state === 'response') ? 'flex' : 'none';
    }

    function renderSources(citations) {
        if (!sourcesContainer) return;
        sourcesContainer.innerHTML = '';
        
        if (!citations || citations.length === 0) {
            sourcesContainer.style.display = 'none';
            return;
        }
        sourcesContainer.style.display = 'flex';

        citations.forEach((url, index) => {
            let domain = "Источник";
            try { domain = new URL(url).hostname.replace('www.', ''); } catch(e){}
            const chip = document.createElement('a');
            chip.className = 'ft-source-chip';
            chip.href = url;
            chip.target = '_blank';
            if (index >= 3) chip.classList.add('ft-source-hidden');
            chip.innerHTML = `<span>${domain}</span>`;
            sourcesContainer.appendChild(chip);
        });

        if (citations.length > 3) {
            const moreBtn = document.createElement('button');
            moreBtn.className = 'ft-source-more-btn';
            moreBtn.innerHTML = `<i class="fa-solid fa-plus"></i>`;
            moreBtn.onclick = () => {
                sourcesContainer.querySelectorAll('.ft-source-hidden').forEach(item => item.classList.remove('ft-source-hidden'));
                moreBtn.remove();
            };
            sourcesContainer.appendChild(moreBtn);
        }
    }

    async function handleAiRequest(question) {
        if (!question) return;
        setAiState('loading');
        if (inputMain) inputMain.value = '';
        if (inputReply) inputReply.value = '';

        try {
            if (window.pywebview && window.pywebview.api) {
                const res = await window.pywebview.api.ask_ai(question, savedSelectionText);
                if (res.status === 'ok') {
                    let safeText = res.answer
                        .replace(/\\\[/g, '$$')
                        .replace(/\\\]/g, '$$')
                        .replace(/\\\(/g, '$')
                        .replace(/\\\)/g, '$')
                        .replace(/\[(\d+)\]/g, '<sup>[$1]</sup>');
                    responseText.innerHTML = marked.parse(safeText);
                    if (window.MathJax && window.MathJax.typesetPromise) {
                        window.MathJax.typesetPromise([responseText]).catch(() => {});
                    }
                    renderSources(res.citations);
                    setAiState('response');
                } else {
                    responseText.innerText = "Ошибка: " + res.message;
                    setAiState('response');
                }
            } else {
                setTimeout(() => {
                    responseText.innerText = "Демо-ответ.\nВы спросили: " + question;
                    setAiState('response');
                }, 1000);
            }
        } catch (e) {
            responseText.innerText = "Ошибка JS: " + e;
            setAiState('response');
        }
    }

    if (btnSendMain) btnSendMain.addEventListener('click', () => handleAiRequest(inputMain.value.trim()));
    if (inputMain) inputMain.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAiRequest(inputMain.value.trim()); });
    if (btnSendReply) btnSendReply.addEventListener('click', () => handleAiRequest(inputReply.value.trim()));
    if (inputReply) inputReply.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleAiRequest(inputReply.value.trim()); });

    // =========================================================
    // 6. ПОЗИЦИОНИРОВАНИЕ ТУЛБАРА
    // =========================================================

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
        if (shouldReset) {
            if (mainButtons) mainButtons.style.display = 'flex';
            closeAllSubmenus();
        }

        const width = toolbar.offsetWidth;
        const height = toolbar.offsetHeight;
        let left = mouseX + 10;
        let top = mouseY + 10;

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
            if (contentArea) contentArea.dispatchEvent(new Event('input', { bubbles: true }));
        } catch (err) { alert('Используйте Ctrl+V'); }
        hideToolbar();
    });
}
