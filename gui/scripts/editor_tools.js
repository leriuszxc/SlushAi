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