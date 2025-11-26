import webview
import os
import sys
import shutil

# Получаем путь к папке, где лежит main.py
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
# Папка docs будет создана рядом с main.py
DATA_DIR = os.path.join(BASE_DIR, 'docs')

if not os.path.exists(DATA_DIR):
    os.makedirs(DATA_DIR)
    print(f"Создана папка для данных: {DATA_DIR}")

class Api:
    def get_initial_structure(self):
        print("JS запрашивает список папок...") # Лог в консоль Python
        structure = {}
        if os.path.exists(DATA_DIR):
            for folder in os.listdir(DATA_DIR):
                folder_path = os.path.join(DATA_DIR, folder)
                if os.path.isdir(folder_path):
                    files = [f for f in os.listdir(folder_path) if not f.startswith('.')]
                    structure[folder] = files
        return structure

    def create_real_folder(self, name):
        print(f"Попытка создать папку: {name}")
        path = os.path.join(DATA_DIR, name)
        try:
            if not os.path.exists(path):
                os.makedirs(path)
                return {"status": "ok"}
            return {"status": "error", "message": "Папка уже существует"}
        except Exception as e:
            print(f"Ошибка создания папки: {e}")
            return {"status": "error", "message": str(e)}

    def create_real_file(self, folder_name, file_name):
        print(f"Попытка создать файл: {folder_name}/{file_name}")
        folder_path = os.path.join(DATA_DIR, folder_name)
        file_path = os.path.join(folder_path, f"{file_name}.txt")
        try:
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(f"Конспект: {file_name}")
            return {"status": "ok"}
        except Exception as e:
            return {"status": "error", "message": str(e)}
            # ... (методы create_real_folder и create_real_file остаются)

    def read_file(self, folder_name, file_name):
        """Читает содержимое файла и возвращает текст"""
        print(f"Запрос на чтение: {folder_name}/{file_name}")
        
        # Добавляем .txt, если его нет в переданном имени
        if not file_name.endswith('.txt'):
            file_name += '.txt'
            
        file_path = os.path.join(DATA_DIR, folder_name, file_name)
        
        try:
            if os.path.exists(file_path):
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                return {"status": "ok", "content": content}
            else:
                return {"status": "error", "message": "Файл не найден"}
        except Exception as e:
            return {"status": "error", "message": str(e)}
    def _safe_path(self, *parts):
        """
        Безопасно склеивает путь внутри DATA_DIR.
        Не позволяет вылезти выше папки docs через ../
        """
        path = os.path.abspath(os.path.join(DATA_DIR, *parts))
        if not path.startswith(os.path.abspath(DATA_DIR)):
            raise ValueError("Запрещённый путь")
        return path

    def delete_file(self, folder_name, file_name):
        """
        Удаляет текстовый файл внутри указанной папки.
        file_name — без .txt (как ты его показываешь в интерфейсе).
        """
        # поддержим оба варианта: с .txt и без
        candidate_names = [file_name, f"{file_name}.txt"]
        removed = False

        for name in candidate_names:
            file_path = self._safe_path(folder_name, name)
            if os.path.exists(file_path) and os.path.isfile(file_path):
                os.remove(file_path)
                removed = True
                break

        if removed:
            print(f"Файл удалён: {folder_name}/{file_name}")
            return {"ok": True}
        else:
            return {"ok": False, "error": "Файл не найден"}

    def delete_folder(self, folder_name):
        """
        Полностью удаляет папку внутри docs (рекурсивно, со всеми файлами).
        """
        folder_path = self._safe_path(folder_name)

        if not os.path.exists(folder_path):
            return {"ok": False, "error": "Папка не найдена"}

        if not os.path.isdir(folder_path):
            return {"ok": False, "error": "Это не папка"}

        # На всякий случай не даём удалить корневую docs
        if os.path.abspath(folder_path) == os.path.abspath(DATA_DIR):
            return {"ok": False, "error": "Нельзя удалить корневую папку данных"}

        shutil.rmtree(folder_path)
        print(f"Папка удалена: {folder_name}")
        return {"ok": True}


if __name__ == '__main__':
    api = Api()
    # ВАЖНО: Указываем точный путь к index.html
    start_url = os.path.join(BASE_DIR, 'index.html')
    
    window = webview.create_window(
        'СлушАй', 
        url=start_url, 
        js_api=api, 
        width=1200, 
        height=800
    )

    """ 
    #TODO
    ПОСТАВИТЬ FALSE ПРИ РЕЛИЗЕ
    """
    webview.start(debug=True)
