document.addEventListener('DOMContentLoaded', () => {
    const audioModal = document.getElementById('audio-upload-modal');
    const audioCloseBtn = document.getElementById('audio-close-btn');
    const audioUploadBtn = document.getElementById('audio-upload-btn');
    const audioOverlay = audioModal ? audioModal.querySelector('.audio-modal-overlay') : null;
    const listenBtn = document.querySelector('.btn-logo');
    const transcribeBtn = document.getElementById('audio-create-transcription-btn');

    // Флаг: была ли создана транскрибация
    let transcriptionCreated = false;
    let currentProjectName = null;

    function loadAudioFiles() {
        if (window.pywebview && window.pywebview.api) {
            window.pywebview.api.get_uploaded_audio_files().then(res => {
                if (res.status === 'ok' && res.files.length > 0) {
                    displayAudioFiles(res.files);
                    currentProjectName = res.project_name; // Сохраняем имя проекта
                    // Показываем кнопку "Создать транскрибацию"
                    if (transcribeBtn) transcribeBtn.style.display = 'block';
                } else {
                    showAudioEmptyState();
                    currentProjectName = null;
                    // Скрываем кнопку "Создать транскрибацию"
                    if (transcribeBtn) transcribeBtn.style.display = 'none';
                }
            }).catch(err => {
                console.error('Ошибка получения файлов:', err);
            });
        }
    }

    // Открытие модального окна по клику на "СлушАй"
    if (listenBtn && audioModal) {
        listenBtn.addEventListener('click', () => {
            audioModal.classList.add('active');
            document.body.style.overflow = 'hidden';
            transcriptionCreated = false; // Сбрасываем флаг
            currentProjectName = null;
            // Загружаем файлы текущего проекта
            loadAudioFiles();
        });
    }

    const closeAudioModal = () => {
        if (audioModal) {
            audioModal.classList.remove('active');
            document.body.style.overflow = '';

            // Если транскрибация НЕ создана и есть проект - удаляем его
            if (!transcriptionCreated && currentProjectName) {
                console.log('Удаление проекта:', currentProjectName);
                if (window.pywebview && window.pywebview.api) {
                    window.pywebview.api.delete_project(currentProjectName).then(res => {
                        if (res.status === 'ok') {
                            console.log('Проект удалён');
                        }
                    });
                }
            }
        }
    };

    if (audioCloseBtn) audioCloseBtn.addEventListener('click', closeAudioModal);
    if (audioOverlay) audioOverlay.addEventListener('click', closeAudioModal);

    if (audioUploadBtn) {
        audioUploadBtn.addEventListener('click', () => {
            if (window.pywebview && window.pywebview.api) {
                window.pywebview.api.upload_audio_file().then(res => {
                    if (res.status === 'ok') {
                        console.log('Загружено в проект:', res.project_name);
                        console.log('Файлы:', res.files);
                        currentProjectName = res.project_name; // Сохраняем имя проекта
                        // Обновляем список после загрузки
                        loadAudioFiles();
                    } else if (res.status === 'error') {
                        alert('Ошибка: ' + res.message);
                    }
                }).catch(err => {
                    console.error('Ошибка загрузки:', err);
                });
            }
        });
    }

    // Обработчик кнопки "Создать транскрибацию"
    if (transcribeBtn) {
        transcribeBtn.addEventListener('click', () => {
            transcriptionCreated = true; // Устанавливаем флаг
            createTranscription();
        });
    }

    function displayAudioFiles(files) {
        const emptyMsg = document.getElementById('audio-empty-message');
        const fileList = document.getElementById('audio-file-list');
        const title = document.querySelector('.audio-panel-title');

        if (emptyMsg) emptyMsg.style.display = 'none';
        if (fileList) {
            fileList.style.display = 'block';
            fileList.innerHTML = '';

            files.forEach((file, index) => {
                const li = document.createElement('li');
                li.className = 'audio-file-item';
                
                // Кнопка воспроизведения
                const playBtn = document.createElement('button');
                playBtn.className = 'audio-file-play-btn';
                playBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
                playBtn.onclick = () => window.openAudioPlayer(file, files, index);
                
                // Название файла
                const nameSpan = document.createElement('span');
                nameSpan.className = 'audio-file-name';
                nameSpan.textContent = file;
                
                // Контейнер для кнопок действий
                const actionsDiv = document.createElement('div');
                actionsDiv.className = 'audio-file-actions';
                
                // Кнопка вверх
                const upBtn = document.createElement('button');
                upBtn.className = 'audio-file-action-btn';
                upBtn.innerHTML = '<i class="fa-solid fa-chevron-up"></i>';
                upBtn.onclick = () => moveAudioFile(index, 'up');
                if (index === 0) upBtn.disabled = true;
                
                // Кнопка вниз
                const downBtn = document.createElement('button');
                downBtn.className = 'audio-file-action-btn';
                downBtn.innerHTML = '<i class="fa-solid fa-chevron-down"></i>';
                downBtn.onclick = () => moveAudioFile(index, 'down');
                if (index === files.length - 1) downBtn.disabled = true;
                
                // Кнопка удаления
                const deleteBtn = document.createElement('button');
                deleteBtn.className = 'audio-file-action-btn delete';
                deleteBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
                deleteBtn.onclick = () => deleteAudioFile(file);
                
                actionsDiv.appendChild(upBtn);
                actionsDiv.appendChild(downBtn);
                actionsDiv.appendChild(deleteBtn);
                
                li.appendChild(playBtn);
                li.appendChild(nameSpan);
                li.appendChild(actionsDiv);
                
                fileList.appendChild(li);
            });
        }

        if (title) title.textContent = `Загруженные аудиофайлы (${files.length})`;
    }

    function showAudioEmptyState() {
        const emptyMsg = document.getElementById('audio-empty-message');
        const fileList = document.getElementById('audio-file-list');
        const title = document.querySelector('.audio-panel-title');

        if (emptyMsg) emptyMsg.style.display = 'block';
        if (fileList) fileList.style.display = 'none';
        if (title) title.textContent = 'У вас нет загруженных аудио файлов';
    }

    function deleteAudioFile(filename) {
        if (!confirm(`Удалить файл "${filename}"?`)) return;
        
        if (window.pywebview && window.pywebview.api) {
            window.pywebview.api.delete_audio_file(filename).then(res => {
                if (res.status === 'ok') {
                    loadAudioFiles(); // Обновляем список
                } else {
                    alert('Ошибка: ' + res.message);
                }
            });
        }
    }

    function moveAudioFile(index, direction) {
        if (window.pywebview && window.pywebview.api) {
            window.pywebview.api.move_audio_file(index, direction).then(res => {
                if (res.status === 'ok') {
                    loadAudioFiles(); // Обновляем список
                }
            });
        }
    }

    function createTranscription() {
        alert('Создание транскрибации (функционал будет добавлен позже)');
        // Здесь позже вызовем метод транскрибации
        closeAudioModal(); // Закрываем модалку после создания
    }
});