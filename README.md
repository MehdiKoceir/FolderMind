# FolderMind

A local, offline-first desktop app that watches a folder, automatically summarizes and categorizes the files you drop into it using a locally-running AI model, and gives you a searchable, organized view — without ever moving or modifying your original files.

## Features

- 📂 **Watch a folder** — drop files in, FolderMind picks them up automatically
- 🤖 **AI summarization & categorization** — powered by a local [Ollama](https://ollama.com) model, 100% offline, no API keys, no data leaving your machine
- 🏷️ **Auto-tagging** — each file gets a short summary, a category, and keyword tags
- 🔍 **Search** — find files by name or by what they're actually about
- 🗂️ **Non-destructive** — files stay exactly where they are on disk; categorization is virtual
- 🌙 **Simple dark-mode UI** — clean desktop window, no browser tab needed

## Requirements

- Python 3.11+
- [Ollama](https://ollama.com) installed and running locally
- An Ollama model pulled (default: `llama3.2`)

## Setup

### 1. Install Ollama

Download and install Ollama from [ollama.com](https://ollama.com), then pull the model:

```bash
ollama pull llama3.2
```

Make sure Ollama is running (it usually starts automatically, or run `ollama serve`).

### 2. Install Python dependencies

```bash
pip install -r requirements.txt
```

### 3. Run the app

```bash
python main.py
```

A desktop window will open. Click **Add Watch Folder** and select the folder you want FolderMind to monitor.

## How it works

1. You point FolderMind at a folder.
2. Whenever a new or changed file appears, FolderMind extracts its text content (PDF, DOCX, TXT/MD supported).
3. That text is sent to your local Ollama model, which returns a short summary, a category, and a few tags.
4. The result is stored in a local SQLite database (`foldermind.db`), and shown in the app's sidebar/grid view.
5. Your original files are **never moved, renamed, or edited** — FolderMind only reads them.

## Project structure

```
foldermind/
├── main.py            # entry point, starts the desktop window
├── watcher.py          # folder monitoring (watchdog)
├── extractor.py        # text extraction from pdf/docx/txt
├── ai_engine.py         # talks to Ollama, parses AI response
├── db.py               # SQLite schema + queries
├── config.json          # stores watched folder path (auto-created)
├── frontend/
│   ├── index.html
│   ├── style.css
│   └── app.js
├── requirements.txt
└── README.md
```

## Troubleshooting

**"Ollama not detected" banner**
Make sure Ollama is installed and running (`ollama serve`), and that you've pulled the model with `ollama pull llama3.2`.

**A file shows status "error"**
The file's text couldn't be extracted (e.g. corrupted PDF, scanned image with no text layer, password-protected file). It's skipped automatically so it doesn't block other files. You can retry with the "re-summarize" button once fixed.

**Summaries look generic or wrong**
Try a larger/better Ollama model (e.g. `llama3.1:8b` or `mistral`) for better quality, at the cost of slower processing.

## Roadmap ideas

- OCR support for scanned documents/images
- Move-to-folder option (physically reorganize files on disk)
- Multi-folder watching
- Cloud AI tier (Claude API) for higher-quality summaries as a paid option
- Export/import of the categorized index

## License

Personal project — license TBD if this becomes a public/commercial product.
