import webview
import os
import shutil
import time
import threading
import json
from faster_whisper import WhisperModel
import subprocess
import gc # Сборщик мусора
import torch

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, 'docs')
CONFIG_PATH = os.path.join('config', 'config.json')

# Папки для аудио и json
BD_AUDIO_DIR = os.path.join(BASE_DIR, 'BD', 'audio')
BD_TRANSCRIPTION_DIR = os.path.join(BASE_DIR, 'BD', 'transcription')

# Создаем папки для BD, если их нет, чтобы не было ошибок
if not os.path.exists(BD_AUDIO_DIR):
    os.makedirs(BD_AUDIO_DIR)
if not os.path.exists(BD_TRANSCRIPTION_DIR):
    os.makedirs(BD_TRANSCRIPTION_DIR)

if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)

class ConfigManager:
    """ Класс для управления конфигом """
    @staticmethod
    def load():
        if not os.path.exists(CONFIG_PATH):
            """ Конфиг по умолчанию, если файла нет """
            return {"zoom": 1.0, "theme": "light", "last_opened_file": ""}
        try:
            with open(CONFIG_PATH, 'r', encoding='utf-8') as f:
                return json.load(f)
        except Exception:
            return {"zoom": 1.0, "theme": "light", "last_opened_file": ""}

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
    
    def create_folder(self, name):
        """ 
        СОЗДАНИЕ ПАПКИ
        Создаем папку в корне 
        """
        try:
            path = os.path.join(DATA_DIR, name)
            if not os.path.exists(path):
                os.makedirs(path)
                return {"status": "ok"}
            return {"status": "error", "message": "Папка уже существует"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def create_file(self, parent_id, file_name):
        """ СОЗДАНИЕ ФАЙЛА """
        try:
            if not parent_id:
                target_dir = DATA_DIR
            elif os.path.isabs(parent_id):
                target_dir = parent_id
            else:
                target_dir = os.path.join(DATA_DIR, parent_id)
            
            if not file_name.endswith('.txt'):
                file_name += '.txt'
            
            file_path = os.path.join(target_dir, file_name)
            
            if not os.path.exists(file_path):
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write("")
                return {"status": "ok"}
            return {"status": "error", "message": "Файл уже существует"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

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
        """
        Переименовывает файл или папку.
        
        Args:
            item_path (str): Относительный путь (ID) к элементу.
            new_name (str): Новое имя (без пути, просто имя файла/папки).
        """
        try:
            # Формируем полный путь к исходному файлу
            full_path = os.path.normpath(os.path.join(DATA_DIR, item_path))
            base_dir = os.path.normpath(os.path.abspath(DATA_DIR))

            # ПРОВЕРКА БЕЗОПАСНОСТИ
            if os.path.commonpath([base_dir, full_path]) != base_dir:
                 return {"status": "error", "message": "Доступ запрещен"}

            if not os.path.exists(full_path):
                return {"status": "error", "message": "Объект не найден"}
            
            # Определяем папку, где лежит файл (чтобы новое имя осталось в той же папке)
            parent_dir = os.path.dirname(full_path)
            
            """
            # Логика расширения .txt (сохраняем поведение)
            # Если это файл и пользователь не ввел расширение .txt - добавляем его
            """
            if os.path.isfile(full_path) and not new_name.endswith('.txt'):
                new_name += '.txt'
                
            # Формируем полный путь назначения
            new_path = os.path.join(parent_dir, new_name)
            
            # Проверяем, не занято ли имя
            if os.path.exists(new_path):
                return {"status": "error", "message": "Имя уже занято"}
                
            os.rename(full_path, new_path)
            return {"status": "ok"}
            
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
        print("Backend: Start Audio Processing...")
        
        audio_file = os.path.join(BD_AUDIO_DIR, "audio2.mp3")
        json_filename = "audio2.json"
        output_json_file = os.path.join(BD_TRANSCRIPTION_DIR, json_filename)
        
        if not os.path.exists(audio_file):
            return {"status": "error", "message": f"Файл не найден: {audio_file}"}

        model = None # Инициализируем переменную для модели

        try:
            # 1. Получаем длительность аудио для расчета прогресса
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

            # 2. Загрузка модели (ТОЛЬКО СЕЙЧАС)
            if self.window:
                self.window.evaluate_js("updateTranscriptionProgress(0, 'Загрузка модели AI в память...')")
            
            print("Загрузка модели Whisper в память...")
            # Если есть GPU, можно указать device="cuda", иначе "cpu"
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

            # 3. Перебор сегментов и обновление прогресса
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
            
            # Сохранение JSON (стандартная логика)
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
            # 4. ОЧИСТКА ПАМЯТИ (Выполняется всегда, даже при ошибке)
            print("Очистка памяти...")
            if model:
                del model
            
            # Принудительный запуск сборщика мусора Python
            gc.collect()
            
            # Очистка видеопамяти (если использовалась CUDA)
            try:
                if torch.cuda.is_available():
                    torch.cuda.empty_cache()
                    print("CUDA cache cleared.")
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
        
def monitor_changes(window, api_instance):
    last_state_json = ""
    time.sleep(1)
    while True:
        try:
            current = api_instance.get_files_structure()
            current_json = json.dumps(current, sort_keys=True)
            if current_json != last_state_json:
                if last_state_json != "":
                    window.evaluate_js('loadFileSystem()') 
                last_state_json = current_json
        except Exception as e:
            print(f"Monitor error: {e}")
        time.sleep(1)

if __name__ == '__main__':
    api = Api()
    start_url = os.path.join(BASE_DIR, 'gui', 'dashboard.html')
    # Создаем окно
    window = webview.create_window('СлушАй', url=start_url, js_api=api, maximized=True)
    # ВАЖНО: Передаем ссылку на окно внутрь API, чтобы Python мог вызывать JS
    api.window = window 
    threading.Thread(target=monitor_changes, args=(window, api), daemon=True).start()
    webview.start(debug=True)