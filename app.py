import webview
import os
import shutil
import time
import json
import base64
from env import PERPLEXITY_API_KEY
import logging

torch = None
requests = None
WhisperModel = None
subprocess = None
gc = None
loadeding = False

class AccessibilityErrorFilter(logging.Filter):
    def filter(self, record):
        msg = record.getMessage()
        blocked = [
            "window.native.AccessibilityObject.Bounds",
            "window.native.ControlCollection.__abstractmethods__",
            "window.native.DockPaddingEdgesConverter"
        ]
        return not any(pattern in msg for pattern in blocked)

    
logger = logging.getLogger("pywebview")
logger.addFilter(AccessibilityErrorFilter())

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'docs')
CONFIG_PATH = os.path.join('config', 'config.json')
PROJECTS_DIR = os.path.join(BASE_DIR, 'projects')

BD_HISTORY_DIR = os.path.join(BASE_DIR, 'BD', 'historyAI')

if not os.path.exists(PROJECTS_DIR):
    os.makedirs(PROJECTS_DIR)
if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)
if not os.path.exists(BD_HISTORY_DIR):
    os.makedirs(BD_HISTORY_DIR)

class ConfigManager:
    """ Класс для управления конфигом """
    
    @staticmethod
    def load():
        default_config = {
            "zoom": 1.0, 
            "theme": "light", 
            "last_opened_file": "",
            "bookmarks": []
        }
        
        if not os.path.exists(CONFIG_PATH):
            return default_config
            
        try:
            with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                data = json.load(f)
                # Если в файле каких-то полей нет, дополняем дефолтными
                for key, value in default_config.items():
                    if key not in data:
                        data[key] = value
                return data
        except Exception:
            return default_config

    @staticmethod
    def save(data):
        """ Создаем папку config, если её нет """
        os.makedirs(os.path.dirname(CONFIG_PATH), exist_ok=True)
        
        current_config = ConfigManager.load()
        current_config.update(data)
        
        with open(CONFIG_PATH, 'w', encoding='utf-8') as f:
            json.dump(current_config, f, indent=4, ensure_ascii=False)


class Api:
    def __init__(self):
        """ Загружаем конфиг при старте """
        self.config = ConfigManager.load()
        self.window = None

    def get_settings(self):
        """ Получить все настройки """
        return self.config

    def save_zoom(self, zoom_level):
        """ Сохранить зум """
        self.config['zoom'] = float(zoom_level)
        ConfigManager.save({"zoom": float(zoom_level)})
    
    def save_last_file(self, file_path):
        """ Сохраняет путь к последнему открытому файлу """
        self.config['last_opened_file'] = file_path
        ConfigManager.save({'last_opened_file': file_path})

    def save_theme(self, theme_mode):
        """Сохраняет тему (light/dark)"""
        self.config['theme'] = theme_mode
        ConfigManager.save({'theme': theme_mode})

    """ 
    СКАНИРОВАНИЕ (РЕКУРСИЯ) 
    Возвращает дерево файлов. ID = полный абсолютный путь.
    """
    def get_files_structure(self):
        return self._scan_directory(DATA_DIR)

    def _scan_directory(self, path):
        items = []
        try:
            if not os.path.exists(path):
                return []
            
            """ Сортировка: папки сверху, потом файлы по алфавиту """
            entries = sorted(os.listdir(path))
            
            for entry in entries:
                full_path = os.path.join(path, entry)
                
                if os.path.isdir(full_path):
                    items.append({
                        "id": full_path,
                        "type": "folder",
                        "name": entry,
                        "isOpen": True,
                        "children": self._scan_directory(full_path)
                    })
                elif os.path.isfile(full_path) and entry.endswith('.txt'):
                    items.append({
                        "id": full_path,
                        "type": "file",
                        "name": entry.replace('.txt', '')
                    })
        except Exception as e:
            pass
        
        """ Сортировка списка: папки выше файлов """
        items.sort(key=lambda x: (x['type'] != 'folder', x['name'].lower()))
        return items
    
    def create_file(self, parent_id, file_name):
        try:
            # 1. ЗАПРЕТ НА КОРЕНЬ
            # Если parent_id нет, значит пытаются создать в DATA_DIR (в корне), а это "табу".
            if not parent_id:
                return {"status": "error", "message": "Создание файлов в корне запрещено. Выберите проект."}
            
            if os.path.isabs(parent_id):
                target_dir = parent_id
            else:
                target_dir = os.path.join(DATA_DIR, parent_id)
            
            # ВАЖНО: Проверяем, существует ли папка, в которую хотим сохранить
            if not os.path.exists(target_dir):
                return {"status": "error", "message": f"Папка проекта не найдена: {target_dir}"}

            # 2. Гарантируем расширение .txt
            if not file_name.endswith('.txt'):
                file_name += '.txt'
            
            file_path = os.path.join(target_dir, file_name)
            
            # 3. Логика уникального имени (1), (2)...
            base_name, ext = os.path.splitext(file_name)
            counter = 1
            final_name = file_name
            final_path = file_path

            while os.path.exists(final_path):
                final_name = f"{base_name} ({counter}){ext}"
                final_path = os.path.join(target_dir, final_name)
                counter += 1

            # 4. Создаем файл
            with open(final_path, 'w', encoding='utf-8') as f:
                f.write("")
            
            # 5. Возвращаем результат
            ui_name = final_name.replace('.txt', '')
            return {"status": "ok", "name": ui_name, "id": final_path}
            
        except Exception as e:
            return {"status": "error", "message": str(e)}



    def create_folder(self, name, parent_id=None):
        """
        СОЗДАНИЕ ПАПКИ (ПРОЕКТА)
        """
        try:
            # Если parent_id пустой или None — создаем в корне
            if not parent_id:
                target_dir = DATA_DIR
            elif os.path.isabs(parent_id):
                target_dir = parent_id
            else:
                target_dir = os.path.join(DATA_DIR, parent_id)
            
            # Проверка существования родителя
            if not os.path.exists(target_dir):
                return {'status': 'error', 'message': f'Родительская папка не найдена: {target_dir}'}

            base_name = name
            path = os.path.join(target_dir, name)
            
            # Уникальное имя (1), (2)...
            counter = 1
            final_name = name
            
            while os.path.exists(path):
                final_name = f"{base_name} ({counter})"
                path = os.path.join(target_dir, final_name)
                counter += 1
            
            os.makedirs(path)
            # Возвращаем status, name и id (полный путь)
            return {'status': 'ok', 'name': final_name, 'id': path}
        except Exception as e:
            return {'status': 'error', 'message': str(e)}


    def read_file(self, full_path, ignored_name=None):
        """ 
        ЧТЕНИЕ ФАЙЛА
        JS присылает (id, name). Нам нужен только id (full_path). 
        """
        try:
            if os.path.exists(full_path) and os.path.isfile(full_path):
                with open(full_path, 'r', encoding='utf-8') as f:
                    return {"status": "ok", "content": f.read()}
            return {"status": "error", "message": "Файл не найден"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def save_file_content(self, full_path, content):
        """ ЗАПИСЬ ФАЙЛА """
        try:
            if os.path.exists(full_path) and os.path.isfile(full_path):
                with open(full_path, 'w', encoding='utf-8') as f:
                    f.write(content)
                return {"status": "ok"}
            return {"status": "error", "message": "Файл для сохранения не найден"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def delete_file(self, file_path):
        """
        Удаляет файл по указанному пути.
            
        Args:
            file_path (str): Относительный путь к файлу (или ID).
        """
        try:
            # Формируем полный путь
            target_path = os.path.normpath(os.path.join(DATA_DIR, file_path))
            base_dir = os.path.normpath(os.path.abspath(DATA_DIR))

            # ПРОВЕРКА БЕЗОПАСНОСТИ (защита от выхода из папки)
            if os.path.commonpath([base_dir, target_path]) != base_dir:
                 return {"status": "error", "message": "Попытка удаления за пределами рабочей директории"}

            # Проверка существования
            if not os.path.exists(target_path):
                return {"status": "error", "message": "Файл не найден"}
            
            # Проверка, что это именно ФАЙЛ, а не папка
            if not os.path.isfile(target_path):
                return {"status": "error", "message": "Это папка, а не файл. Используйте delete_folder."}

            os.remove(target_path)
            return {"status": "ok"}
        
        except PermissionError:
            return {"status": "error", "message": "Файл занят другим процессом (например, открыт в Word)."}
        except Exception as e:
            return {"status": "error", "message": str(e)}
        
    """ УДАЛЕНИЕ ПАПКИ """
    def delete_folder(self, folder_path):
        """
        Удаляет папку и все её содержимое.
        
        Args:
            folder_path (str): Путь к папке (относительный от DATA_DIR или ID).
            
        Returns:
            dict: Статус операции.
        """
        try:
            """
            Приводим пути к нормальному виду
            # os.path.normpath исправляет слеши (\\ vs /) и убирает лишние точки
            """
            target_path = os.path.normpath(os.path.join(DATA_DIR, folder_path))
            base_dir = os.path.normpath(os.path.abspath(DATA_DIR))

            """
            ПРОВЕРКА БЕЗОПАСНОСТИ (Path Traversal)
            # Проверяем, что target_path действительно находится ВНУТРИ base_dir.
            # Это защищает от путей вида "../../Windows".
            """
            if os.path.commonpath([base_dir, target_path]) != base_dir:
                return {"status": "error", "message": "Попытка удаления за пределами рабочей директории"}

            if target_path == base_dir:
                """ Защита от удаления самого корня (DATA_DIR) """
                return {"status": "error", "message": "Нельзя удалить корневую директорию"}

            # Проверка существования
            if not os.path.exists(target_path):
                return {"status": "error", "message": "Папка не найдена"}

            # Проверка, что это именно папка
            if not os.path.isdir(target_path):
                return {"status": "error", "message": "Указанный путь не является папкой"}

            """ Удаление (рекурсивно) """
            shutil.rmtree(target_path)
            return {"status": "ok"}

        except PermissionError:
            return {"status": "error", "message": "Нет прав доступа. Закройте папку в других программах."}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def rename_item(self, item_path, new_name):
        try:
            # Формируем полный путь к исходному файлу
            full_path = os.path.normpath(os.path.join(DATA_DIR, item_path))
            base_dir = os.path.normpath(os.path.abspath(DATA_DIR))
            
            # ПРОВЕРКА БЕЗОПАСНОСТИ
            if os.path.commonpath([base_dir, full_path]) != base_dir:
                return {"status": "error", "message": "Доступ запрещен"}
            
            if not os.path.exists(full_path):
                return {"status": "error", "message": "Объект не найден"}
            
            # Определяем папку, где лежит файл
            parent_dir = os.path.dirname(full_path)
            is_file = os.path.isfile(full_path)
            
            # Логика расширения .txt для файлов
            if is_file and not new_name.endswith('.txt'):
                new_name += '.txt'
            
            # Исходное желаемое имя
            final_name = new_name
            new_path = os.path.join(parent_dir, final_name)
            
            # --- ЛОГИКА ПОДБОРА УНИКАЛЬНОГО ИМЕНИ ---
            root_name, ext = os.path.splitext(final_name)
            counter = 1
            
            # Пока путь занят
            while os.path.exists(new_path):
                # Если файл существует и это тот же самый файл (например, меняем регистр A.txt -> a.txt), 
                # то считать его занятым не нужно.
                if os.path.samefile(full_path, new_path):
                    break
                
                # Формируем новое имя: name (1).txt
                final_name = f"{root_name} ({counter}){ext}"
                new_path = os.path.join(parent_dir, final_name)
                counter += 1
            # ----------------------------------------
            
            # --- ОБНОВЛЕНИЕ ЗАКЛАДОК (BOOKMARKS) ---
            bookmarks = self.config.get('bookmarks', [])
            if full_path in bookmarks:
                bookmarks.remove(full_path)
                bookmarks.append(new_path)
                
                self.config['bookmarks'] = bookmarks
                ConfigManager.save({'bookmarks': bookmarks})
            # ---------------------------------------

            os.rename(full_path, new_path)
            
            # Подготовка имени для UI (убираем .txt если это файл)
            ui_name = final_name
            if is_file and ui_name.endswith('.txt'):
                ui_name = ui_name[:-4]
            
            # Возвращаем новые данные
            return {"status": "ok", "new_id": new_path, "name": ui_name}
        
        except Exception as e:
            return {"status": "error", "message": str(e)}




    def move_item(self, source_path, target_folder_path):
        """
        Перемещает файл или папку.
        
        Args:
            source_path (str): Путь к элементу, который тащим (ID).
            target_folder_path (str): Путь к ПАПКЕ, в которую бросаем (ID). 
                                      Пустая строка = корень.
        """
        try:
            base_dir = os.path.normpath(os.path.abspath(DATA_DIR))

            # Формируем полный путь к исходному файлу
            src_full = os.path.normpath(os.path.join(DATA_DIR, source_path))
            
            # ПРОВЕРКА БЕЗОПАСНОСТИ
            if os.path.commonpath([base_dir, src_full]) != base_dir:
                return {"status": "error", "message": "Hack attempt: source path invalid"}
            
            if not os.path.exists(src_full):
                return {"status": "error", "message": "Исходный файл не найден"}

            # Обработка ЦЕЛЕВОГО пути
            if not target_folder_path:
                # Если перетащили в корень (пустое имя папки)
                dst_folder_full = base_dir
            else:
                dst_folder_full = os.path.normpath(os.path.join(DATA_DIR, target_folder_path))

            # ПРОВЕРКА БЕЗОПАСНОСТИ
            if os.path.commonpath([base_dir, dst_folder_full]) != base_dir:
                return {"status": "error", "message": "Hack attempt: destination path invalid"}

            # Проверка, что целевая папка существует
            if not os.path.exists(dst_folder_full):
                 return {"status": "error", "message": "Целевая папка не найдена"}

            """
            Формирование финального пути
            # Нам нужно имя файла (basename) от исходника, чтобы приклеить его к новой папке
            """
            filename = os.path.basename(src_full)
            dst_full = os.path.join(dst_folder_full, filename)

            # Проверки перед перемещением
            if src_full == dst_full:
                return {"status": "error", "message": "Файл уже здесь"}
            
            if os.path.exists(dst_full):
                return {"status": "error", "message": "Файл с таким именем уже есть в папке назначения"}

            """
            Нельзя переместить папку внутрь самой себя
            # (Если dst начинается с src)
            """
            if dst_folder_full.startswith(src_full):
                 return {"status": "error", "message": "Нельзя переместить папку внутрь самой себя"}

            # Перемещение
            shutil.move(src_full, dst_full)
            return {"status": "ok"}

        except Exception as e:
            return {"status": "error", "message": str(e)}
        
    def process_audio(self):
        """
        Транскрибация аудиофайла
        """
        audio_file = os.path.join(PROJECTS_DIR, "audio2.mp3")
        json_filename = "audio2.json"
        output_json_file = os.path.join(PROJECTS_DIR, json_filename)
        
        if not os.path.exists(audio_file):
            return {"status": "error", "message": f"Файл не найден: {audio_file}"}

        model = None

        try:
            # Получаем длительность аудио для расчета прогресса
            audio_duration = 0
            try:
                # Используем ffprobe (убедитесь что он в PATH или укажите полный путь)
                cmd = [
                    'ffprobe', 
                    '-v', 'error', 
                    '-show_entries', 'format=duration', 
                    '-of', 'default=noprint_wrappers=1:nokey=1', 
                    audio_file
                ]
                # В Windows создание окна консоли можно скрыть флагом creationflags
                startupinfo = None
                if os.name == 'nt':
                    startupinfo = subprocess.STARTUPINFO()
                    startupinfo.dwFlags |= subprocess.STARTF_USESHOWWINDOW
                
                output = subprocess.check_output(cmd, startupinfo=startupinfo).decode().strip()
                audio_duration = float(output)
            except Exception as e:
                print(f"Не удалось получить длительность аудио: {e}")

            # Загрузка модели
            if self.window:
                self.window.evaluate_js("updateTranscriptionProgress(0, 'Загрузка модели AI в память...')")
            
            print("Загрузка модели Whisper в память...")
            model = WhisperModel("large-v3-turbo", device="cuda", compute_type="int8")
            print("Начало транскрибации...")
            start_time = time.time()
            
            segments_generator, info = model.transcribe(
                audio_file,
                language="ru",
                task="transcribe",
                beam_size=6,
                vad_filter=True,
                condition_on_previous_text=True,
            )

            transcription_results = []
            formatted_text = ""

            # Перебор сегментов и обновление прогресса
            for segment in segments_generator:
                segment_data = {
                    "start": round(segment.start, 2),
                    "end": round(segment.end, 2),
                    "text": segment.text.strip()
                }
                transcription_results.append(segment_data)
                
                # Форматирование текста
                m = int(segment.start // 60)
                s = int(segment.start % 60)
                time_str = f"{m:02}:{s:02}"
                formatted_text += f"({time_str}) {segment.text.strip()}\n"
                
                # ОБНОВЛЕНИЕ UI
                if self.window and audio_duration > 0:
                    percent = int((segment.end / audio_duration) * 100)
                    if percent > 100: percent = 100
                    
                    # Форматируем текущее время аудио
                    current_m = int(segment.end // 60)
                    current_s = int(segment.end % 60)
                    status_text = f"Обработано: {current_m:02}:{current_s:02}"
                    
                    # Отправляем в JS
                    self.window.evaluate_js(f"updateTranscriptionProgress({percent}, '{status_text}')")
                
                print(f"[{time_str}] {segment.text.strip()}")

            elapsed = time.time() - start_time
            
            # Сохранение JSON
            stats = { "processing_time": round(elapsed, 2), "audio_duration": round(audio_duration, 2) }
            final_json_data = {
                "meta": { "file_name": audio_file, "model": "large-v3-turbo", "stats": stats },
                "segments": transcription_results
            }
            with open(output_json_file, "w", encoding="utf-8") as f:
                json.dump(final_json_data, f, ensure_ascii=False, indent=4)
            
            return {"status": "ok", "content": formatted_text}

        except Exception as e:
            print(f"Ошибка Whisper: {e}")
            return {"status": "error", "message": str(e)}

        finally:
            # ОЧИСТКА ПАМЯТИ (Выполняется всегда, даже при ошибке)
            if model:
                del model
            
            # Принудительный запуск сборщика мусора Python
            gc.collect()
            
            # Очистка видеопамяти (если использовалась CUDA)
            try:
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
            except Exception:
                pass
            
            print("Модель выгружена.")

    def create_transcribed_file(self, filename, content):
        """
        Создает файл в КОРНЕ с заданным именем и контентом.
        Если имя занято, добавляет (1), (2) и т.д.
        """
        try:
            if not filename.endswith('.txt'):
                filename += '.txt'
            
            # Логика уникального имени
            base_name, ext = os.path.splitext(filename)
            counter = 1
            
            final_name = filename
            final_path = os.path.join(DATA_DIR, final_name)
            
            # Пока файл существует, увеличиваем счетчик
            while os.path.exists(final_path):
                final_name = f"{base_name} ({counter}){ext}"
                final_path = os.path.join(DATA_DIR, final_name)
                counter += 1
            
            # Записываем контент
            with open(final_path, 'w', encoding='utf-8') as f:
                f.write(content)
                
            # Возвращаем данные о новом файле (чтобы JS мог его открыть)
            new_file_info = {
                "id": final_path,
                "name": final_name.replace('.txt', ''),
                "type": "file"
            }
            
            return {"status": "ok", "new_file": new_file_info}
            
        except Exception as e:
            return {"status": "error", "message": str(e)}
        
    def ask_ai(self, user_query, selected_context=None):
        """
        1. Читает историю из BD/historyAI/history.json
        2. Формирует контекст (если есть выделенный текст)
        3. Отправляет запрос в Perplexity
        4. Сохраняет историю
        5. Возвращает ответ
        """
        
        history_file = os.path.join(BD_HISTORY_DIR, 'history.json')
        
        # 1. Загрузка истории
        messages = []
        if os.path.exists(history_file):
            try:
                with open(history_file, 'r', encoding='utf-8') as f:
                    messages = json.load(f)
            except Exception:
                messages = []

        # Если история пустая, добавляем системный промпт
        if not messages:
            messages.append({
                "role": "system",
                "content": "Ты полезный помощник для студента. Отвечай кратко, точно и по делу. Используй русский язык."
            })

        # 2. Формирование сообщения пользователя
        # Если есть выделенный текст, добавляем его в промпт
        full_content = user_query
        if selected_context:
            full_content += f"\n\nКонтекст:\n{selected_context}"

        messages.append({"role": "user", "content": full_content})

        # 3. Запрос к Perplexity API
        url = "https://api.perplexity.ai/chat/completions"
        payload = {
            "model": "sonar", # Или другая модель
            "messages": messages,
            "temperature": 0.2,
            "top_p": 0.9,
            "return_citations": True
        }
        headers = {
            "Authorization": f"Bearer {PERPLEXITY_API_KEY}",
            "Content-Type": "application/json"
        }

        try:
            response = requests.post(url, json=payload, headers=headers)
            
            if response.status_code == 200:
                data = response.json()
                ai_reply = data['choices'][0]['message']['content']
                
                # 1. Безопасно достаем список ссылок. Если их нет, будет пустой список.
                citations = data.get('citations', [])

                # 4. Сохраняем ответ ассистента в историю
                messages.append({"role": "assistant", "content": ai_reply})
                
                with open(history_file, 'w', encoding='utf-8') as f:
                    json.dump(messages, f, ensure_ascii=False, indent=4)
                
                return {"status": "ok", "answer": ai_reply, "citations": citations}
            else:
                return {"status": "error", "message": f"API Error: {response.status_code} - {response.text}"}
                
        except requests.exceptions.Timeout:
            return {"status": "error", "message": "Превышено время ожидания"}
        except requests.exceptions.ConnectionError:
            return {"status": "error", "message": "Ошибка подключения"}
        except requests.exceptions.HTTPError as e:
            if e.response.status_code == 429:
                return {"status": "error", "message": "Превышен лимит запросов"}
        except Exception as e:
            return {"status": "error", "message": str(e)}
            
    def get_bookmarks(self):
        """ Возвращает список закладок из конфига """
        return self.config.get('bookmarks', [])

    def add_bookmark(self, file_id):
        """Добавить файл в избранные"""
        try:
            bookmarks = self.get_bookmarks()
            
            # Проверяем, есть ли уже такая закладка
            if file_id in bookmarks:
                return {"status": "error", "message": "Файл уже в закладках"}
            
            bookmarks.append(file_id)
            
            bookmarks_file = os.path.join('config', 'bookmarks.json')
            os.makedirs(os.path.dirname(bookmarks_file), exist_ok=True)
            
            with open(bookmarks_file, 'w', encoding='utf-8') as f:
                json.dump(bookmarks, f, ensure_ascii=False, indent=4)
            
            return {"status": "ok"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def remove_bookmark(self, file_id):
        """Удалить файл из избранных"""
        try:
            bookmarks = self.get_bookmarks()
            
            if file_id not in bookmarks:
                return {"status": "error", "message": "Файл не найден в закладках"}
            
            bookmarks.remove(file_id)
            
            bookmarks_file = os.path.join('config', 'bookmarks.json')
            with open(bookmarks_file, 'w', encoding='utf-8') as f:
                json.dump(bookmarks, f, ensure_ascii=False, indent=4)
            
            return {"status": "ok"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def toggle_bookmark(self, file_path):
        """ Переключает закладку для файла """
        try:
            # Нормализуем путь
            full_path = os.path.normpath(os.path.join(DATA_DIR, file_path))
            
            # Получаем текущие закладки
            bookmarks = self.config.get('bookmarks', [])
            
            if full_path in bookmarks:
                bookmarks.remove(full_path)
            else:
                bookmarks.append(full_path)
            
            # Сохраняем в память и в файл
            self.config['bookmarks'] = bookmarks
            ConfigManager.save({'bookmarks': bookmarks})
            
            return {"status": "ok", "bookmarks": bookmarks}
        except Exception as e:
            return {"status": "error", "message": str(e)}
    
    def create_new_project(self):
        """
        Создаёт новый проект с уникальным именем.
        Вызывается при нажатии кнопки 'СлушАй'.
        """
        try:
            from datetime import datetime
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            project_name = f"Проект_{timestamp}"
            project_dir = os.path.join(PROJECTS_DIR, project_name)
            
            os.makedirs(project_dir)
            print(f"✅ Создан новый проект: {project_name}")
            
            return {"status": "ok", "project_name": project_name}
        
        except Exception as e:
            print(f"❌ Ошибка создания проекта: {e}")
            return {"status": "error", "message": str(e)}


    def upload_audio_to_project(self, project_name):
        """
        Загружает аудиофайлы в СУЩЕСТВУЮЩИЙ проект.
        После загрузки первого файла переименовывает проект в его имя.
        Сохраняет порядок файлов в order.json.
        """
        try:
            project_dir = os.path.join(PROJECTS_DIR, project_name)
            
            if not os.path.exists(project_dir):
                return {"status": "error", "message": "Проект не найден"}
            
            # Проверяем, есть ли уже файлы в проекте
            existing_files = [f for f in os.listdir(project_dir)
                            if f.endswith(('.mp3', '.wav', '.m4a', '.ogg', '.flac'))]
            is_first_upload = len(existing_files) == 0
            
            file_types = ('Audio Files (*.mp3;*.wav;*.m4a;*.ogg;*.flac)', 'All files (*.*)')
            result = self.window.create_file_dialog(
                webview.OPEN_DIALOG,
                allow_multiple=True,
                file_types=file_types
            )
            
            if not result:
                return {"status": "cancelled"}
            
            uploaded_files = []
            new_project_name = project_name  # По умолчанию оставляем старое имя
            
            for file_path in result:
                filename = os.path.basename(file_path)
                dest_path = os.path.join(project_dir, filename)
                
                # Уникальное имя, если файл уже существует
                if os.path.exists(dest_path):
                    base, ext = os.path.splitext(filename)
                    counter = 1
                    while os.path.exists(dest_path):
                        dest_path = os.path.join(project_dir, f"{base} ({counter}){ext}")
                        counter += 1
                
                shutil.copy2(file_path, dest_path)
                uploaded_files.append(os.path.basename(dest_path))
                print(f"📁 Файл скопирован: {os.path.basename(dest_path)}")
            
            # ПЕРЕИМЕНОВАНИЕ ПРОЕКТА по имени первого файла
            if is_first_upload and uploaded_files:
                first_file = uploaded_files[0]
                new_project_name = os.path.splitext(first_file)[0]  # Убираем расширение
                new_project_dir = os.path.join(PROJECTS_DIR, new_project_name)
                
                # Если папка с таким именем уже существует, добавляем (1), (2)...
                counter = 1
                original_name = new_project_name
                while os.path.exists(new_project_dir):
                    new_project_name = f"{original_name} ({counter})"
                    new_project_dir = os.path.join(PROJECTS_DIR, new_project_name)
                    counter += 1
                
                # Переименовываем папку
                os.rename(project_dir, new_project_dir)
                print(f"📝 Проект переименован: '{project_name}' → '{new_project_name}'")
                
                # Обновляем project_dir после переименования
                project_dir = new_project_dir
            
            # === РАБОТА С ПОРЯДКОМ ФАЙЛОВ ===
            
            # Получаем текущий порядок (или создаём новый)
            order_res = self.get_project_order(new_project_name)
            
            if order_res["status"] == "ok":
                current_order = order_res["order"]
                
                # Добавляем новые файлы в конец
                for new_file in uploaded_files:
                    if new_file not in current_order:
                        current_order.append(new_file)
                
                # Сохраняем обновлённый порядок
                self.save_project_order(new_project_name, current_order)
                
                # Возвращаем файлы в правильном порядке
                final_files = current_order
            else:
                # Если не удалось получить порядок - возвращаем отсортированные
                final_files = sorted(uploaded_files)
            
            return {
                "status": "ok",
                "files": final_files,  # Возвращаем в правильном порядке!
                "project_name": new_project_name
            }
        
        except Exception as e:
            print(f"❌ Ошибка загрузки: {e}")
            return {"status": "error", "message": str(e)}



    def get_project_files(self, project_name):
        """
        Получает список аудиофайлов проекта В СОХРАНЁННОМ ПОРЯДКЕ.
        """
        try:
            res = self.get_project_order(project_name)
            if res["status"] == "ok":
                return {"status": "ok", "files": res["order"]}
            
            return res
        
        except Exception as e:
            return {"status": "error", "message": str(e)}


    def delete_audio_file(self, project_name, filename):
        try:
            project_dir = os.path.join(PROJECTS_DIR, project_name)
            audio_path = os.path.join(project_dir, filename)
            
            if os.path.exists(audio_path):
                os.remove(audio_path)
                print(f"🗑️ Удалён файл: {filename} из {project_name}")
                
                # Обновляем order.json
                order_file = os.path.join(project_dir, 'order.json')
                if os.path.exists(order_file):
                    with open(order_file, 'r', encoding='utf-8') as f:
                        order = json.load(f)
                    
                    # Убираем удалённый файл
                    if filename in order:
                        order.remove(filename)
                        
                        with open(order_file, 'w', encoding='utf-8') as f:
                            json.dump(order, f, ensure_ascii=False, indent=2)
                
                # Проверяем, остались ли файлы
                remaining = [f for f in os.listdir(project_dir)
                            if f.endswith(('.mp3', '.wav', '.m4a', '.ogg', '.flac'))]
                
                # Если пусто - удаляем проект
                if not remaining:
                    shutil.rmtree(project_dir)
                    print(f"🗑️ Проект '{project_name}' удалён (пустой)")
                
                return {"status": "ok", "files_remaining": len(remaining)}
            
            return {"status": "error", "message": "Файл не найден"}
        
        except Exception as e:
            return {"status": "error", "message": str(e)}



    def get_project_order(self, project_name):
        """
        Получает порядок файлов из order.json или создаёт его.
        """
        try:
            project_dir = os.path.join(PROJECTS_DIR, project_name)
            order_file = os.path.join(project_dir, 'order.json')
            
            # Получаем все аудиофайлы
            audio_files = sorted([f for f in os.listdir(project_dir)
                                if f.endswith(('.mp3', '.wav', '.m4a', '.ogg', '.flac'))])
            
            # Если order.json существует - загружаем
            if os.path.exists(order_file):
                with open(order_file, 'r', encoding='utf-8') as f:
                    saved_order = json.load(f)
                
                # Убираем удалённые файлы и добавляем новые
                order = [f for f in saved_order if f in audio_files]
                new_files = [f for f in audio_files if f not in order]
                order.extend(new_files)
            else:
                # Если нет - используем алфавитный порядок
                order = audio_files
            
            return {"status": "ok", "order": order}
        
        except Exception as e:
            return {"status": "error", "message": str(e)}


    def save_project_order(self, project_name, order):
        """
        Сохраняет порядок файлов в order.json.
        """
        try:
            project_dir = os.path.join(PROJECTS_DIR, project_name)
            order_file = os.path.join(project_dir, 'order.json')
            
            with open(order_file, 'w', encoding='utf-8') as f:
                json.dump(order, f, ensure_ascii=False, indent=2)
            
            print(f"📝 Порядок сохранён для проекта '{project_name}'")
            return {"status": "ok"}
        
        except Exception as e:
            return {"status": "error", "message": str(e)}


    def move_audio_file(self, project_name, index, direction):
        """
        Перемещает файл вверх или вниз в списке.
        
        Args:
            project_name: Имя проекта
            index: Индекс файла (0-based)
            direction: "up" или "down"
        """
        try:
            # Получаем текущий порядок
            res = self.get_project_order(project_name)
            if res["status"] != "ok":
                return res
            
            order = res["order"]
            
            # Проверка индекса
            if index < 0 or index >= len(order):
                return {"status": "error", "message": "Неверный индекс"}
            
            # Перемещение
            if direction == "up" and index > 0:
                # Меняем местами с предыдущим
                order[index], order[index - 1] = order[index - 1], order[index]
            elif direction == "down" and index < len(order) - 1:
                # Меняем местами со следующим
                order[index], order[index + 1] = order[index + 1], order[index]
            else:
                return {"status": "error", "message": "Невозможно переместить"}
            
            # Сохраняем новый порядок
            self.save_project_order(project_name, order)
            
            return {"status": "ok", "order": order}
        
        except Exception as e:
            return {"status": "error", "message": str(e)}

        
    def get_audio_file_base64(self, project_name, filename):
        """
        Возвращает аудиофайл в формате base64 для плеера.
        """
        try:
            project_dir = os.path.join(PROJECTS_DIR, project_name)
            audio_path = os.path.join(project_dir, filename)
            
            if os.path.exists(audio_path):
                with open(audio_path, 'rb') as f:
                    audio_data = f.read()
                
                base64_data = base64.b64encode(audio_data).decode('utf-8')
                print(f"🎵 Аудио закодировано: {len(base64_data)} байт")
                
                return {"status": "ok", "data": base64_data}
            
            return {"status": "error", "message": "Файл не найден"}
        
        except Exception as e:
            return {"status": "error", "message": str(e)}
        
    def delete_project(self, project_name):
        """Удаляет проект полностью"""
        try:
            project_dir = os.path.join(PROJECTS_DIR, project_name)
            
            if os.path.exists(project_dir):
                shutil.rmtree(project_dir)
                print(f"Проект '{project_name}' удалён")
                return {"status": "ok"}
            
            return {"status": "error", "message": "Проект не найден"}
        except Exception as e:
            return {"status": "error", "message": str(e)}
        
def load_heavy_libs():
    """Загрузка тяжелых библиотек"""
    global torch, requests, WhisperModel, subprocess, gc, loadeding
    
    try:
        print("Загрузка библиотек...")
        import torch as torch_module
        import requests as requests_module
        from faster_whisper import WhisperModel as WhisperModelClass
        import subprocess as subprocess_module
        import gc as gc_module
        
        # Перезаписываем глобальные переменные
        torch = torch_module
        requests = requests_module
        WhisperModel = WhisperModelClass
        subprocess = subprocess_module
        gc = gc_module
        
        loadeding = True
        print("✓ Библиотеки загружены")
        
    except Exception as e:
        loadeding = False
        print(f"✗ Ошибка: {e}")
        raise
