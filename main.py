import webview
import threading
import os
import time
import json
import app as app_module

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
_initialization_started = False


def background_loader(window, api_instance):
    """Фоновый процесс: загружает тяжелые библиотеки"""
    try:
        time.sleep(0.5)
        app_module.load_heavy_libs()
        
    except Exception as e:
        print(f"Ошибка загрузки: {e}")


def on_loading_complete(window, api_instance):
    """Вызывается когда экран загрузки готов"""
    global _initialization_started
    
    if _initialization_started:
        return
    
    _initialization_started = True
    threading.Thread(target=background_loader, args=(window, api_instance), daemon=True).start()
    
    def switch_to_dashboard():
        timeout = 10
        start = time.time()
        
        while not app_module.loadeding:
            if time.time() - start > timeout:
                print("Таймаут загрузки!")
                return
            time.sleep(0.1)
        window.evaluate_js('window.librariesLoaded = true;')
        time.sleep(2)
        threading.Thread(target=monitor_file_changes, args=(window, api_instance), daemon=True).start()
    
    threading.Thread(target=switch_to_dashboard, daemon=True).start()


def monitor_file_changes(window, api_instance):
    """Следит за изменениями файлов"""
    last_state_json = ""
    while True:
        try:
            url = window.get_current_url()
            if url and "dashboard.html" in url:
                current = api_instance.get_files_structure()
                current_json = json.dumps(current, sort_keys=True)
                if current_json != last_state_json:
                    if last_state_json != "":
                        window.evaluate_js('if(window.loadFileSystem) loadFileSystem()') 
                    last_state_json = current_json
        except Exception:
            pass
        time.sleep(1)


if __name__ == '__main__':
    api = app_module.Api()
    
    loading_path = os.path.join(BASE_DIR, 'gui', 'loading.html')
    loading_url = f"file:///{loading_path.replace(os.sep, '/')}"
    
    window = webview.create_window(
        'СлушАй', 
        url=loading_url, 
        js_api=api, 
        maximized=True
    )
    
    api.window = window
    window.events.loaded += lambda: on_loading_complete(window, api)
    
    webview.start(debug=False)
