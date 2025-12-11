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

    // Открытие модального окна - СОЗДАЁМ ПРОЕКТ СРАЗУ
    if (listenBtn && audioModal) {
        listenBtn.addEventListener('click', () => {
            // 1. Создаём новый проект через Python
            if (window.pywebview && window.pywebview.api) {
                window.pywebview.api.create_new_project().then(res => {
                    if (res.status === 'ok') {
                        currentProjectName = res.project_name;
                        console.log('Создан новый проект:', currentProjectName);
                        
                        // 2. Показываем модалку
                        audioModal.classList.add('active');
                        document.body.style.overflow = 'hidden';
                        transcriptionCreated = false;
                        
                        // 3. Показываем пустое состояние
                        showAudioEmptyState();
                        if (transcribeBtn) transcribeBtn.style.display = 'none';
                    } else {
                        alert('Ошибка создания проекта: ' + res.message);
                    }
                }).catch(err => {
                    console.error('Ошибка создания проекта:', err);
                });
            }
        });
    }

    const closeAudioModal = () => {
        if (audioModal) {
            audioModal.classList.remove('active');
            document.body.style.overflow = '';

            // Если транскрибация НЕ создана - удаляем проект
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
            
            // Сбрасываем состояние
            currentProjectName = null;
            transcriptionCreated = false;
        }
    };

    if (audioCloseBtn) audioCloseBtn.addEventListener('click', closeAudioModal);
    if (audioOverlay) audioOverlay.addEventListener('click', closeAudioModal);

    // Загрузка файлов - ДОБАВЛЯЕМ В УЖЕ СОЗДАННЫЙ ПРОЕКТ
    if (audioUploadBtn) {
    audioUploadBtn.addEventListener('click', () => {
        if (!currentProjectName) {
            alert('Ошибка: проект не создан');
            return;
        }
        
        if (window.pywebview && window.pywebview.api) {
            window.pywebview.api.upload_audio_to_project(currentProjectName).then(res => {
                if (res.status === 'ok') {
                    console.log('Файлы загружены в проект:', res.project_name);
                    console.log('Файлы:', res.files);
                    
                    // ⚠️ ОБНОВЛЯЕМ ИМЯПРОЕКТА после переименования
                    currentProjectName = res.project_name;
                    
                    // Показываем список файлов
                    displayAudioFiles(res.files);
                    if (transcribeBtn) transcribeBtn.style.display = 'block';
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
            transcriptionCreated = true;
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
                playBtn.onclick = () => window.openAudioPlayer(file, files, index, currentProjectName);
                
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
                    // Обновляем список
                    window.pywebview.api.get_project_files(currentProjectName).then(res => {
                        if (res.status === 'ok' && res.files.length > 0) {
                            displayAudioFiles(res.files);
                        } else {
                            showAudioEmptyState();
                            if (transcribeBtn) transcribeBtn.style.display = 'none';
                        }
                    });
                } else {
                    alert('Ошибка: ' + res.message);
                }
            });
        }
    }

    function moveAudioFile(index, direction) {
        if (!currentProjectName) {
            console.error('Проект не определён');
            return;
        }
        
        if (window.pywebview && window.pywebview.api) {
            window.pywebview.api.move_audio_file(currentProjectName, index, direction).then(res => {
                if (res.status === 'ok') {
                    console.log('Новый порядок:', res.order);
                    // Обновляем список с новым порядком
                    displayAudioFiles(res.order);
                } else {
                    console.error('Ошибка перемещения:', res.message);
                }
            }).catch(err => {
                console.error('Ошибка перемещения:', err);
            });
        }
    }


    function createTranscription() {
        alert('Создание транскрибации (функционал будет добавлен позже)');
        closeAudioModal();
    }
});