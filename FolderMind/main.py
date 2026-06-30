import os
import sys
import json
import subprocess
import threading
import webview

import db
import extractor
import ai_engine
from watcher import FolderWatcher

# Globals to reference the webview window and current watcher
window = None
current_watcher = None

class FolderMindAPI:
    """API exposed to the pywebview frontend."""
    
    def get_all_files(self):
        """Returns all registered files in the DB."""
        try:
            return db.get_all_files()
        except Exception as e:
            print(f"Error in get_all_files: {str(e)}")
            return []

    def search_files(self, query):
        """Searches files by query string."""
        try:
            return db.search_files(query)
        except Exception as e:
            print(f"Error in search_files: {str(e)}")
            return []

    def get_file_categories(self):
        """Returns distinct categories and counts, plus overall status."""
        try:
            return db.get_categories_with_counts()
        except Exception as e:
            print(f"Error in get_file_categories: {str(e)}")
            return {"categories": {}, "status_counts": {}}

    def add_watch_folder(self):
        """Opens a native directory dialog, starts watching it, and saves setting."""
        global window, current_watcher
        if not window:
            return None
            
        folders = window.create_file_dialog(webview.FOLDER_DIALOG)
        if folders and len(folders) > 0:
            folder_path = folders[0]
            db.save_setting("watch_folder", folder_path)
            
            # Stop existing watcher if any
            if current_watcher:
                current_watcher.stop()
                
            # Start new watcher
            current_watcher = FolderWatcher(folder_path, process_callback=on_file_processed_event)
            started = current_watcher.start()
            
            return {
                "success": started,
                "folder_path": folder_path
            }
        return None

    def get_app_status(self):
        """Returns current configuration status, watched path, and Ollama status."""
        watched_folder = db.get_setting("watch_folder", "")
        ollama_running = ai_engine.check_ollama_status()
        
        return {
            "watched_folder": watched_folder,
            "ollama_running": ollama_running,
            "watcher_running": current_watcher.is_running if current_watcher else False
        }

    def reprocess_file(self, file_id):
        """Manually re-runs AI extraction on a specific file."""
        file_record = db.get_file_by_id(file_id)
        if not file_record:
            return {"success": False, "error": "File not found in database."}

        filepath = file_record["filepath"]
        filename = file_record["filename"]

        if not os.path.exists(filepath):
            db.update_file_error(file_id, "File no longer exists on disk.")
            return {"success": False, "error": "File no longer exists on disk."}

        # Run extraction and Ollama in a background thread so the UI remains fluid
        threading.Thread(target=self._run_manual_reprocess, args=(file_id, filepath, filename), daemon=True).start()
        return {"success": True, "message": "Reprocessing started in background."}

    def open_file(self, filepath):
        """Opens the file with the operating system's default application."""
        if not os.path.exists(filepath):
            return False
            
        try:
            if os.name == 'nt':  # Windows
                os.startfile(filepath)
            elif sys.platform == 'darwin':  # macOS
                subprocess.call(('open', filepath))
            else:  # Linux
                subprocess.call(('xdg-open', filepath))
            return True
        except Exception as e:
            print(f"Failed to open file {filepath}: {str(e)}")
            return False

    def _run_manual_reprocess(self, file_id, filepath, filename):
        """Internal background task for manual reprocessing."""
        try:
            # Update DB and notify UI of status change to pending
            db.update_file_error(file_id, None) # Clear error or status
            # Create helper update status
            conn = db.get_db_connection()
            cursor = conn.cursor()
            cursor.execute("UPDATE files SET status = 'pending' WHERE id = ?", (file_id,))
            conn.commit()
            conn.close()
            
            on_file_processed_event({"file_id": file_id, "status": "pending", "filename": filename})

            # Extract text
            try:
                text = extractor.extract_text_from_file(filepath)
            except Exception as e:
                db.update_file_error(file_id, f"Extraction failed: {str(e)}")
                on_file_processed_event({"file_id": file_id, "status": "error", "filename": filename, "error": str(e)})
                return

            # Analyze
            metadata = ai_engine.analyze_file_content(filename, text)
            db.update_file_success(
                file_id=file_id,
                summary=metadata.get("summary", ""),
                category=metadata.get("category", "Uncategorized"),
                tags=metadata.get("tags", [])
            )
            on_file_processed_event({"file_id": file_id, "status": "processed", "filename": filename})
            
        except Exception as e:
            db.update_file_error(file_id, f"Error: {str(e)}")
            on_file_processed_event({"file_id": file_id, "status": "error", "filename": filename, "error": str(e)})


def on_file_processed_event(data):
    """Fires a javascript event to the pywebview window to refresh UI elements dynamically."""
    global window
    if window:
        # Check thread context, execute_js is safe to run from other threads
        try:
            js_data = json.dumps(data)
            window.evaluate_js(f"if (typeof onFileUpdate === 'function') {{ onFileUpdate({js_data}); }}")
        except Exception as e:
            print(f"Failed to evaluate js event: {str(e)}")


def start_app():
    global window, current_watcher
    
    # 1. Initialize DB
    db.init_db()
    
    # 2. Look for previously configured watched folder
    watched_folder = db.get_setting("watch_folder", "")
    if watched_folder and os.path.exists(watched_folder):
        current_watcher = FolderWatcher(watched_folder, process_callback=on_file_processed_event)
        current_watcher.start()
    else:
        current_watcher = FolderWatcher("", process_callback=on_file_processed_event)
        
    # 3. Resolve path to the frontend assets
    # Support running from script directory or PyInstaller binary bundle directory
    if getattr(sys, 'frozen', False):
        frontend_dir = os.path.join(sys._MEIPASS, 'frontend')
    else:
        frontend_dir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'frontend')
        
    index_html_path = os.path.join(frontend_dir, 'index.html')
    
    # Fallback to local server or absolute file url
    if os.path.exists(index_html_path):
        url = index_html_path
    else:
        url = "frontend/index.html" # Fallback relative path
        
    # 4. Spin up pywebview
    api = FolderMindAPI()
    window = webview.create_window(
        title="FolderMind — Personal AI File Organizer",
        url=url,
        js_api=api,
        width=1100,
        height=720,
        min_size=(900, 600),
        background_color='#121214'
    )
    
    # Ensure background worker stops when window is closed
    webview.start(debug=False)
    
    # Cleanup on exit
    if current_watcher:
        current_watcher.stop()


if __name__ == "__main__":
    start_app()
