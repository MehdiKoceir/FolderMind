# FolderMind — Offline AI File Organizer 🧠📁

FolderMind is a lightweight, personal AI-powered desktop application that monitors a watched folder in real time, extracts raw text content, and uses a locally running Ollama model to summarize and organize files. 

Best of all: **Categorization is purely virtual!** Your files are never moved, modified, or renamed on disk. FolderMind builds a clean, searchable, tagged, and categorized view on top of your physical filesystem.

## 🚀 Architecture & Tech Stack

- **Frontend**: Clean HTML5/TailwindCSS/VanillaJS rendered via `pywebview`.
- **Backend**: Python 3.11+ managing the database, file watchdog, and file content extractors.
- **Database**: Standard, lightweight, local SQLite (`foldermind.db`).
- **File Watching**: Real-time folder monitoring with the `watchdog` library.
- **Local AI**: Orchestrated using **Ollama** running offline on your localhost (Model: `llama3.2`).
- **File Extractions**: Fully supports extracting text from `.pdf` (via `pypdf`), `.docx` (via `python-docx`), `.txt`, `.md`, `.py`, `.js`, `.json`, `.csv`, `.html`, `.css`.

---

## 🛠️ Step-by-Step Local Setup

Follow these simple steps to run FolderMind locally on Windows, macOS, or Linux.

### Step 1: Install & Set Up Local Ollama (Local AI)

Ollama is a lightweight CLI that lets you run powerful large language models locally on your GPU/CPU.

1. **Download Ollama**:
   - **Windows/macOS/Linux**: Download from [https://ollama.com](https://ollama.com) and follow the installation wizard.
2. **Launch Ollama**: Ensure Ollama is running in your background tray.
3. **Pull the Llama 3.2 Model**:
   Open a terminal (Command Prompt/PowerShell on Windows, Terminal on Mac/Linux) and run the following command to download the extremely fast and efficient 3B parameters Llama 3.2 model:
   ```bash
   ollama pull llama3.2
   ```
4. **Verify Ollama Status**:
   Ensure it's reachable by opening [http://localhost:11434](http://localhost:11434) in your browser. You should see `"Ollama is running"`.

---

### Step 2: Clone or Copy FolderMind Codebase

Make sure you have this `FolderMind/` directory downloaded on your local computer. It should contain:
```text
FolderMind/
├── main.py             # App entry point (Starts pywebview window + backend)
├── watcher.py          # Monitors selected directory for new/modified files
├── extractor.py        # Handles extracting raw text from PDFs, Word, text files
├── ai_engine.py        # Communicates with localhost:11434 Ollama API
├── db.py               # SQLite database setup and persistent settings
├── requirements.txt    # Python requirements
└── frontend/           # Rendered UI pages
    ├── index.html      
    ├── style.css       
    └── app.js          
```

---

### Step 3: Install Python Dependencies

Open your terminal, navigate to the `FolderMind` directory, and run `pip` to install the requirements:

```bash
cd FolderMind
pip install -r requirements.txt
```

> **Note for Windows Users**: If you get a pywebview error during install, make sure you have standard python development tools or `.NET` installed. On Windows, pywebview runs using the native Edge Chromium engine (`WebView2`).

---

### Step 4: Run FolderMind

Run the app with a single command:

```bash
python main.py
```

---

## 🌟 How It Works

1. **Launch**: When FolderMind starts, it looks for a previously saved watch folder in its local database (`foldermind.db`). If found, it automatically starts watching it in real-time.
2. **Select Folder**: Click the **Watch Folder** button in the top right to select a folder on your hard drive (e.g. your Downloads or Documents directory).
3. **Drop Files**: Drag and drop any supported file (e.g., `resume.pdf`, `finance.docx`, `notes.txt`) into that directory on your system.
4. **Instant Ingestion**: Watchdog immediately detects the addition, puts it in **Analyzing** status, extracts the text content in a background worker, and shoots the text to Ollama.
5. **Categorization**: Llama 3.2 reads the content, determines the perfect category (Finance, Personal, Development, Education, Work, etc.), writes a custom 1-2 sentence summary, and generates 3-5 tags.
6. **Seamless Update**: The UI receives an event through pywebview and seamlessly renders a stunning document card under its new category, complete with tags and an **Open** button to load the file instantly!

---

## 🔒 Private, Secure, and 100% Offline

FolderMind sends **zero bytes** to external cloud servers.
- **Your files stay on your disk.**
- **Summaries are computed on your GPU/CPU.**
- **Metadata is stored in a local SQLite database file.**
- Ideal for sensitive corporate documents, personal journals, and private research.
