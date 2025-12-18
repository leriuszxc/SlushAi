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
            createTranscription(currentProjectName);
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

    async function deleteAudioFile(filename) {
        const confirmed = await window.showDeleteConfirm('Вы уверены что хотите удалить это аудио?');
        
        if (!confirmed) return;
        
        if (window.pywebview && window.pywebview.api) {
            window.pywebview.api.delete_audio_file(currentProjectName, filename).then(res => {
                if (res.status === 'ok') {
                    // ⚠️ Обновляем имя проекта, если оно изменилось
                    if (res.new_project_name && res.new_project_name !== currentProjectName) {
                        console.log(`Проект переименован: ${currentProjectName} → ${res.new_project_name}`);
                        currentProjectName = res.new_project_name;
                    }
                    
                    if (res.files_remaining > 0) {
                        // Обновляем список файлов
                        window.pywebview.api.get_project_files(currentProjectName).then(res => {
                            displayAudioFiles(res.files);
                        });
                    } else {
                        // Проект пустой - показываем пустое состояние (но НЕ удаляем проект)
                        showAudioEmptyState();
                        if (transcribeBtn) transcribeBtn.style.display = 'none';
                    }
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


    async function createTranscription(projectName) {
        if (!projectName) {
            alert('Ошибка: проект не определён');
            return;
        }

        if (!window.pywebview || !window.pywebview.api) {
            alert('Backend не подключен.');
            return;
        }

        // закрываем модалку с аудио
        closeAudioModal();

        // показываем тост прогресса
        if (typeof showToast === 'function') {
            showToast();
        }

        try {
            const res = await window.pywebview.api.create_transcription(projectName);

            if (typeof hideToast === 'function') {
                hideToast();
            }

            if (res.status === 'ok') {
                // обновляем файловое дерево
                if (typeof window.loadFileSystem === 'function') {
                    await window.loadFileSystem();
                }

                // автоматически открыть созданный текст
                if (res.new_file && typeof window.editFileFromOutside === 'function') {
                    setTimeout(() => {
                        window.editFileFromOutside(res.new_file.id);
                    }, 300);
                }

                alert('Транскрибация выполнена успешно.');
            } else {
                alert('Ошибка транскрибации: ' + res.message);
            }
        } catch (err) {
            if (typeof hideToast === 'function') {
                hideToast();
            }
            console.error(err);
            alert('Критическая ошибка: ' + err);
        }
    }

});