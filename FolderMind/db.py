import sqlite3
import json
import os
from datetime import datetime

DB_NAME = "foldermind.db"

def get_db_connection():
    conn = sqlite3.connect(DB_NAME)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    """Initializes the SQLite database and creates necessary tables."""
    conn = get_db_connection()
    cursor = conn.cursor()
    
    # Create files table
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS files (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            filepath TEXT UNIQUE NOT NULL,
            filename TEXT NOT NULL,
            summary TEXT,
            category TEXT,
            tags TEXT, -- JSON-encoded string
            date_added TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            file_size INTEGER,
            status TEXT CHECK(status IN ('pending', 'processed', 'error')) DEFAULT 'pending',
            error_reason TEXT
        )
    """)
    
    # Create configuration/settings table to persist watch folder
    cursor.execute("""
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT
        )
    """)
    
    conn.commit()
    conn.close()

def save_setting(key, value):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)", (key, value))
    conn.commit()
    conn.close()

def get_setting(key, default=None):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT value FROM settings WHERE key = ?", (key,))
    row = cursor.fetchone()
    conn.close()
    if row:
        return row['value']
    return default

def add_pending_file(filepath, filename, file_size):
    """Inserts a new file into the database with pending status, or returns existing if found."""
    conn = get_db_connection()
    cursor = conn.cursor()
    try:
        cursor.execute("""
            INSERT INTO files (filepath, filename, file_size, status)
            VALUES (?, ?, ?, 'pending')
        """, (filepath, filename, file_size))
        conn.commit()
        file_id = cursor.lastrowid
    except sqlite3.IntegrityError:
        # File already exists in DB, fetch its ID
        cursor.execute("SELECT id FROM files WHERE filepath = ?", (filepath,))
        row = cursor.fetchone()
        file_id = row['id'] if row else None
    finally:
        conn.close()
    return file_id

def update_file_success(file_id, summary, category, tags):
    """Updates a file record with AI extraction results and marks as processed."""
    conn = get_db_connection()
    cursor = conn.cursor()
    tags_json = json.dumps(tags) if isinstance(tags, list) else tags
    cursor.execute("""
        UPDATE files 
        SET summary = ?, category = ?, tags = ?, status = 'processed', error_reason = NULL
        WHERE id = ?
    """, (summary, category, tags_json, file_id))
    conn.commit()
    conn.close()

def update_file_error(file_id, error_reason):
    """Marks a file record as errored with a reason."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        UPDATE files 
        SET status = 'error', error_reason = ?
        WHERE id = ?
    """, (error_reason, file_id))
    conn.commit()
    conn.close()

def get_file_by_id(file_id):
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM files WHERE id = ?", (file_id,))
    row = cursor.fetchone()
    conn.close()
    if row:
        res = dict(row)
        try:
            res['tags'] = json.loads(res['tags']) if res['tags'] else []
        except Exception:
            res['tags'] = []
        return res
    return None

def get_all_files():
    """Returns all records from the database, parsed and dictionary-formatted."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT * FROM files ORDER BY date_added DESC")
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for row in rows:
        item = dict(row)
        try:
            item['tags'] = json.loads(item['tags']) if item['tags'] else []
        except Exception:
            item['tags'] = []
        result.append(item)
    return result

def search_files(query):
    """Searches files by filename, summary, or category."""
    conn = get_db_connection()
    cursor = conn.cursor()
    # Search with LIKE operator
    search_pattern = f"%{query}%"
    cursor.execute("""
        SELECT * FROM files 
        WHERE filename LIKE ? OR summary LIKE ? OR category LIKE ?
        ORDER BY date_added DESC
    """, (search_pattern, search_pattern, search_pattern))
    rows = cursor.fetchall()
    conn.close()
    
    result = []
    for row in rows:
        item = dict(row)
        try:
            item['tags'] = json.loads(item['tags']) if item['tags'] else []
        except Exception:
            item['tags'] = []
        result.append(item)
    return result

def get_categories_with_counts():
    """Returns a dictionary of category: count."""
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("""
        SELECT category, COUNT(*) as count 
        FROM files 
        WHERE status = 'processed'
        GROUP BY category
    """)
    rows = cursor.fetchall()
    conn.close()
    
    # Also count pending and error
    conn = get_db_connection()
    cursor = conn.cursor()
    cursor.execute("SELECT status, COUNT(*) as count FROM files GROUP BY status")
    status_rows = cursor.fetchall()
    conn.close()
    
    categories = {row['category']: row['count'] for row in rows if row['category']}
    status_counts = {row['status']: row['count'] for row in status_rows}
    
    return {
        "categories": categories,
        "status_counts": status_counts
    }
