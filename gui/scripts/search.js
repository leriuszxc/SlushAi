function toggleDocSearchPanel() {
    const panel = document.getElementById('doc-search-panel');
    const input = document.getElementById('doc-search-input');
    if (!panel) return;

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

function initSearch() {
    const docSearchToggle = document.getElementById('doc-search-toggle');
    const docSearchPanel = document.getElementById('doc-search-panel');
    const docSearchInput = document.getElementById('doc-search-input');
    const docSearchClose = document.getElementById('doc-search-close');
    const docSearchPrev = document.getElementById('doc-search-prev');
    const docSearchNext = document.getElementById('doc-search-next');
    const docSearchCounter = document.getElementById('doc-search-counter');
    const contentArea = document.getElementById('lecture-text'); 

    let searchMatches = [];
    let searchIndex = -1;

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

        // Находим все подсвеченные элементы
        const marks = container.querySelectorAll('mark.doc-highlight, mark.doc-highlight-current');
        
        marks.forEach(mark => {
            // Заменяем тег <mark> его содержимым (текстом)
            const text = document.createTextNode(mark.textContent);
            mark.parentNode.replaceChild(text, mark);
        });

        // Склеиваем соседние текстовые узлы (оптимизация DOM)
        container.normalize();
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

        // Используем TreeWalker для поиска всех текстовых узлов
        const treeWalker = document.createTreeWalker(
            container,
            NodeFilter.SHOW_TEXT,
            null,
            false
        );

        const textNodes = [];
        let currentNode;
        while (currentNode = treeWalker.nextNode()) {
            textNodes.push(currentNode);
        }

        // Проходим по всем найденным кускам текста
        textNodes.forEach(node => {
            const text = node.nodeValue;
            
            if (!text || !regex.test(text)) {
                regex.lastIndex = 0; 
                return;
            }

            // Создаем временную обертку, чтобы превратить текст в HTML с <mark>
            const tempDiv = document.createElement('div');
            tempDiv.innerHTML = text.replace(regex, '<mark class="doc-highlight">$1</mark>');

            // Создаем фрагмент документа для вставки
            const fragment = document.createDocumentFragment();
            while (tempDiv.firstChild) {
                fragment.appendChild(tempDiv.firstChild);
            }

            // Заменяем исходный текстовый узел на наш новый HTML с подсветкой
            node.parentNode.replaceChild(fragment, node);
            
            regex.lastIndex = 0;
        });

        // Собираем все созданные mark в массив для навигации (стрелочки вверх/вниз)
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
        docSearchPanel.style.display = 'flex';
        if (docSearchInput) {
            docSearchInput.focus();
            docSearchInput.select();
        }
    }

    function closeDocSearch() {
        if (!docSearchPanel) return;
        docSearchPanel.style.display = 'none';
        clearDocHighlights();
        if (docSearchInput) {
            docSearchInput.value = '';
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
}