import os
import time
import threading
from watchdog.observers import Observer
from watchdog.events import FileSystemEventHandler

import db
import extractor
import ai_engine

class FileHandler(FileSystemEventHandler):
    def __init__(self, process_callback=None):
        self.process_callback = process_callback
        # Keep track of recently seen paths to avoid processing duplicates
        self.processed_paths = {}
        self.lock = threading.Lock()

    def on_created(self, event):
        if event.is_directory:
            return
        self.handle_file_event(event.src_path)

    def on_modified(self, event):
        if event.is_directory:
            return
        self.handle_file_event(event.src_path)

    def handle_file_event(self, filepath):
        # Ignore temp files (common in Windows/Word) or non-supported files
        filename = os.path.basename(filepath)
        if filename.startswith("~$") or filename.startswith(".") or filename.endswith(".tmp"):
            return
            
        ext = os.path.splitext(filepath)[1].lower()
        allowed_exts = ('.txt', '.md', '.pdf', '.docx', '.doc', '.py', '.js', '.html', '.css', '.json', '.csv')
        if ext not in allowed_exts:
            return

        with self.lock:
            now = time.time()
            # Avoid processing the same file within 2 seconds
            if filepath in self.processed_paths:
                if now - self.processed_paths[filepath] < 2:
                    return
            self.processed_paths[filepath] = now

        # Start processing in a background thread so we don't block the watchdog
        threading.Thread(target=self._process_file, args=(filepath,), daemon=True).start()

    def _process_file(self, filepath):
        # Wait a brief moment to ensure the file is fully written and unlocked
        time.sleep(1.0)
        
        if not os.path.exists(filepath):
            return

        filename = os.path.basename(filepath)
        try:
            file_size = os.path.getsize(filepath)
        except OSError:
            return

        # Add pending record in database
        file_id = db.add_pending_file(filepath, filename, file_size)
        if not file_id:
            # File is already processed or exists in db
            return

        print(f"[Watcher] Processing new file: {filename} ({file_size} bytes)")
        
        # Trigger UI callback if registered (allows real-time update in pywebview)
        if self.process_callback:
            self.process_callback({"file_id": file_id, "status": "pending", "filename": filename})

        try:
            # 1. Extract text
            try:
                text = extractor.extract_text_from_file(filepath)
            except Exception as e:
                db.update_file_error(file_id, f"Extraction failed: {str(e)}")
                if self.process_callback:
                    self.process_callback({"file_id": file_id, "status": "error", "filename": filename, "error": str(e)})
                return

            if not text.strip():
                db.update_file_error(file_id, "Extracted text is empty.")
                if self.process_callback:
                    self.process_callback({"file_id": file_id, "status": "error", "filename": filename, "error": "Empty content"})
                return

            # 2. Query AI engine
            try:
                metadata = ai_engine.analyze_file_content(filename, text)
                db.update_file_success(
                    file_id=file_id,
                    summary=metadata.get("summary", ""),
                    category=metadata.get("category", "Uncategorized"),
                    tags=metadata.get("tags", [])
                )
                print(f"[Watcher] Successfully processed file: {filename} -> {metadata.get('category')}")
                
                if self.process_callback:
                    self.process_callback({"file_id": file_id, "status": "processed", "filename": filename})
                    
            except ai_engine.OllamaConnectionError as e:
                # Retain pending status or set to error with connection message
                db.update_file_error(file_id, "Ollama connection error. Ensure Ollama is running and llama3.2 is pulled.")
                if self.process_callback:
                    self.process_callback({"file_id": file_id, "status": "error", "filename": filename, "error": str(e)})
            except Exception as e:
                db.update_file_error(file_id, f"AI analysis failed: {str(e)}")
                if self.process_callback:
                    self.process_callback({"file_id": file_id, "status": "error", "filename": filename, "error": str(e)})

        except Exception as e:
            print(f"[Watcher] Uncaught error processing {filename}: {str(e)}")
            db.update_file_error(file_id, f"System error: {str(e)}")


class FolderWatcher:
    def __init__(self, watch_path, process_callback=None):
        self.watch_path = watch_path
        self.process_callback = process_callback
        self.observer = None
        self.is_running = False

    def start(self):
        if not self.watch_path or not os.path.exists(self.watch_path):
            print(f"[Watcher] Cannot start: path '{self.watch_path}' does not exist.")
            return False

        self.observer = Observer()
        handler = FileHandler(process_callback=self.process_callback)
        self.observer.schedule(handler, self.watch_path, recursive=False)
        self.observer.start()
        self.is_running = True
        print(f"[Watcher] Started monitoring: {self.watch_path}")
        
        # Scan for existing unprocessed or modified files on start
        threading.Thread(target=self._scan_existing_files, args=(handler,), daemon=True).start()
        return True

    def stop(self):
        if self.observer:
            self.observer.stop()
            self.observer.join()
            self.is_running = False
            print("[Watcher] Stopped monitoring.")

    def _scan_existing_files(self, handler):
        """Scans the directory for existing supported files and processes them if not already in DB."""
        if not os.path.exists(self.watch_path):
            return
            
        print("[Watcher] Scanning for existing files in watch directory...")
        allowed_exts = ('.txt', '.md', '.pdf', '.docx', '.doc', '.py', '.js', '.html', '.css', '.json', '.csv')
        
        try:
            for entry in os.scandir(self.watch_path):
                if entry.is_file():
                    filename = entry.name
                    if filename.startswith("~$") or filename.startswith(".") or filename.endswith(".tmp"):
                        continue
                    ext = os.path.splitext(filename)[1].lower()
                    if ext in allowed_exts:
                        # Check if already processed or exists in database
                        conn = db.get_db_connection()
                        cursor = conn.cursor()
                        cursor.execute("SELECT status FROM files WHERE filepath = ?", (entry.path,))
                        row = cursor.fetchone()
                        conn.close()
                        
                        if not row:
                            # File is completely new to FolderMind, process it
                            handler.handle_file_event(entry.path)
        except Exception as e:
            print(f"[Watcher] Error scanning directory: {str(e)}")
