// === МОДАЛЬНОЕ ОКНО ПОДТВЕРЖДЕНИЯ УДАЛЕНИЯ ===

class DeleteConfirmModal {
    constructor() {
        this.modal = null;
        this.overlay = null;
        this.noBtn = null;
        this.yesBtn = null;
        this.resolveCallback = null;
        this.init();
    }

    init() {
        this.modal = document.getElementById('delete-audio-confirm-modal');
        this.overlay = this.modal?.querySelector('.delete-confirm-overlay');
        this.noBtn = this.modal?.querySelector('.delete-confirm-no');
        this.yesBtn = this.modal?.querySelector('.delete-confirm-yes');

        if (!this.modal) {
            console.error('Delete confirm modal not found');
            return;
        }

        // Кнопка "Нет"
        this.noBtn?.addEventListener('click', () => {
            this.close(false);
        });

        // Кнопка "Да"
        this.yesBtn?.addEventListener('click', () => {
            this.close(true);
        });

        // Закрытие по клику на overlay
        this.overlay?.addEventListener('click', () => {
            this.close(false);
        });

        // Закрытие по Escape
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.modal.classList.contains('active')) {
                this.close(false);
            }
        });
    }

    show(message = 'Вы уверены что хотите удалить это аудио?') {
        return new Promise((resolve) => {
            this.resolveCallback = resolve;

            // Обновляем текст сообщения
            const messageEl = this.modal.querySelector('.delete-confirm-message');
            if (messageEl) {
                messageEl.textContent = message;
            }

            // Показываем модалку
            this.modal.classList.add('active');
            document.body.style.overflow = 'hidden';
        });
    }

    close(result) {
        this.modal.classList.remove('active');
        document.body.style.overflow = '';

        if (this.resolveCallback) {
            this.resolveCallback(result);
            this.resolveCallback = null;
        }
    }
}

// Глобальный экземпляр
let deleteConfirmModal = null;

document.addEventListener('DOMContentLoaded', () => {
    deleteConfirmModal = new DeleteConfirmModal();
});

// Глобальная функция для использования
window.showDeleteConfirm = function(message) {
    if (!deleteConfirmModal) {
        console.error('Delete confirm modal not initialized');
        return Promise.resolve(false);
    }
    return deleteConfirmModal.show(message);
};

window.DeleteConfirmModal = DeleteConfirmModal;
