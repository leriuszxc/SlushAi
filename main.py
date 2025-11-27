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
        print("JS запрашивает список папок...")
        structure = {}
        if os.path.exists(DATA_DIR):
            for folder in os.listdir(DATA_DIR):
                folder_path = os.path.join(DATA_DIR, folder)
                if os.path.isdir(folder_path):
                    files = [f for f in os.listdir(folder_path) if not f.startswith('.')]
                    structure[folder] = files
        return structure

    def _safe_path(self, *parts):
        """Безопасно склеивает путь"""
        path = os.path.abspath(os.path.join(DATA_DIR, *parts))
        if not path.startswith(os.path.abspath(DATA_DIR)):
            raise ValueError("Запрещённый путь")
        return path

    def create_real_folder(self, name):
        print(f"Попытка создать папку: {name}")
        path = os.path.join(DATA_DIR, name)
        try:
            if not os.path.exists(path):
                os.makedirs(path)
                return {"status": "ok"}
            return {"status": "error", "message": "Папка уже существует"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def create_real_file(self, folder_name, file_name):
        print(f"Попытка создать файл: {folder_name}/{file_name}")
        try:
            if not file_name.endswith('.txt'):
                file_name += '.txt'
            
            file_path = self._safe_path(folder_name, file_name)
            
            if not os.path.exists(file_path):
                with open(file_path, 'w', encoding='utf-8') as f:
                    f.write("") 
                return {"status": "ok"}
            else:
                return {"status": "error", "message": "Файл уже существует"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    def read_file(self, folder_name, file_name):
        print(f"Запрос на чтение: {folder_name}/{file_name}")
        if not file_name.endswith('.txt'):
            file_name += '.txt'     
        try:
            file_path = self._safe_path(folder_name, file_name)
            if os.path.exists(file_path):
                with open(file_path, 'r', encoding='utf-8') as f:
                    content = f.read()
                return {"status": "ok", "content": content}
            else:
                return {"status": "error", "message": "Файл не найден"}
        except Exception as e:
            return {"status": "error", "message": str(e)}

    # === ДОБАВЛЕН МЕТОД СОХРАНЕНИЯ ===
    def save_file(self, folder_name, old_file_name, new_file_name, content):
        print(f"Сохранение: {old_file_name} -> {new_file_name}")
        old_clean = old_file_name.replace('.txt', '')
        new_clean = new_file_name.replace('.txt', '')

        try:
            old_path = self._safe_path(folder_name, old_clean + '.txt')
            new_path = self._safe_path(folder_name, new_clean + '.txt')

            # Если имя изменилось, переименовываем
            if old_clean != new_clean:
                if os.path.exists(new_path):
                    return {'status': 'error', 'message': 'Файл с таким именем уже существует'}
                if os.path.exists(old_path):
                    os.rename(old_path, new_path)
            
            # Записываем контент
            with open(new_path, 'w', encoding='utf-8') as f:
                f.write(content)

            return {'status': 'ok', 'new_name': new_clean}
        except Exception as e:
            print(f"Ошибка сохранения: {e}")
            return {'status': 'error', 'message': str(e)}

    def delete_file(self, folder_name, file_name):
        candidate_names = [file_name, f"{file_name}.txt"]
        removed = False
        try:
            for name in candidate_names:
                file_path = self._safe_path(folder_name, name)
                if os.path.exists(file_path) and os.path.isfile(file_path):
                    os.remove(file_path)
                    removed = True
                    break
            if removed:
                return {"status": "ok"}
            else:
                return {"status": "error", "message": "Файл не найден"}
        except Exception as e:
             return {"status": "error", "message": str(e)}

    def delete_folder(self, folder_name):
        try:
            folder_path = self._safe_path(folder_name)
            if not os.path.exists(folder_path):
                return {"status": "error", "message": "Папка не найдена"}
            shutil.rmtree(folder_path)
            return {"status": "ok"}
        except Exception as e:
            return {"status": "error", "message": str(e)}


if __name__ == '__main__':
    api = Api()
    # Исправлен путь, чтобы не было Warning
    start_url = os.path.join(BASE_DIR, 'gui', 'index.html')
    
    window = webview.create_window(
        'СлушАй', 
        url=start_url, 
        js_api=api, 
        width=1200, 
        height=800
    )
    webview.start(debug=True)