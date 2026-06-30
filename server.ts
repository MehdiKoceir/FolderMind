import express from "express";
import path from "path";
import fs from "fs/promises";
import { createServer as createViteServer } from "vite";
import { GoogleGenAI, Type } from "@google/genai";

const app = express();
const PORT = 3000;

// Middleware for parsing JSON
app.use(express.json({ limit: '10mb' }));

// In-Memory Virtual Database to simulate SQLite for the Web Preview
interface VirtualFile {
  id: number;
  filename: string;
  filepath: string;
  summary: string;
  category: string;
  tags: string[];
  date_added: string;
  file_size: number;
  status: "pending" | "processed" | "error";
  error_reason?: string;
  content: string;
}

let fileIdCounter = 4;
let virtualWatchFolder = "/Users/developer/desktop-watch-folder";
let filesDb: VirtualFile[] = [
  {
    id: 1,
    filename: "Project_Proposal_AI.pdf",
    filepath: "/Users/developer/desktop-watch-folder/Project_Proposal_AI.pdf",
    summary: "A comprehensive project proposal outlines integrating local AI intelligence with offline folder watchdogs to group enterprise documents.",
    category: "Work",
    tags: ["proposal", "ai", "local", "enterprise"],
    date_added: new Date(Date.now() - 3600000 * 2).toISOString(), // 2 hours ago
    file_size: 1450200,
    status: "processed",
    content: "Project FolderMind is a personal AI-powered file organizer. Built with Python and pywebview, it indexes files."
  },
  {
    id: 2,
    filename: "Quarterly_Budget_Q3.docx",
    filepath: "/Users/developer/desktop-watch-folder/Quarterly_Budget_Q3.docx",
    summary: "Financial spreadsheets details highlighting 14% growth in operating budgets and allocation of $45k for local hardware testing.",
    category: "Finance",
    tags: ["budget", "finance", "growth", "quarterly"],
    date_added: new Date(Date.now() - 3600000 * 5).toISOString(), // 5 hours ago
    file_size: 284100,
    status: "processed",
    content: "Operating expenses for Q3 indicate substantial alignment with research. Hardware budget allocated: $45,000."
  },
  {
    id: 3,
    filename: "data_cleaner.py",
    filepath: "/Users/developer/desktop-watch-folder/data_cleaner.py",
    summary: "A Python utility script that walks directories, cleans duplicate CSV headers, and normalizes date columns using pandas.",
    category: "Code",
    tags: ["python", "pandas", "data-cleaning", "automation"],
    date_added: new Date(Date.now() - 3600000 * 24).toISOString(), // 1 day ago
    file_size: 12400,
    status: "processed",
    content: "import os\nimport pandas as pd\n\ndef clean_data(path):\n    # normalizes all header entries"
  }
];

// Lazy loader for Google Gemini API Client
let aiClient: GoogleGenAI | null = null;
function getGeminiClient(): GoogleGenAI {
  if (!aiClient) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "MY_GEMINI_API_KEY") {
      throw new Error("GEMINI_API_KEY is not set or holds placeholder value. Please set a valid Gemini API Key in the Secrets panel.");
    }
    aiClient = new GoogleGenAI({
      apiKey: key,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        }
      }
    });
  }
  return aiClient;
}

// Helper to run rule-based mock analyzer if Gemini API key is missing
function mockAnalyzeContent(filename: string, text: string) {
    const textLower = (filename + " " + text).toLowerCase();
    let category = "Documents";
    let tags = ["file", "offline"];
    let summary = `This file named "${filename}" contains notes about general topics.`;

    if (textLower.includes("import ") || textLower.includes("def ") || textLower.includes("function") || filename.endsWith(".py") || filename.endsWith(".js") || filename.endsWith(".ts")) {
        category = "Code";
        tags = ["programming", "developer", "automation", "source-code"];
        summary = `A source code file containing programming logic and script components.`;
    } else if (textLower.includes("budget") || textLower.includes("revenue") || textLower.includes("finance") || textLower.includes("invoice") || textLower.includes("expense") || textLower.includes("$")) {
        category = "Finance";
        tags = ["money", "accounting", "budget", "invoice"];
        summary = `A financial document discussing cost allocation, invoices, or revenue budgets.`;
    } else if (textLower.includes("meeting") || textLower.includes("sync") || textLower.includes("proposal") || textLower.includes("milestone") || textLower.includes("project")) {
        category = "Work";
        tags = ["corporate", "collaboration", "project", "work-log"];
        summary = `A work-related document detailing project plans, meeting agendas, or milestones.`;
    } else if (textLower.includes("journal") || textLower.includes("diary") || textLower.includes("memories") || textLower.includes("personal")) {
        category = "Personal";
        tags = ["journal", "private", "diary", "personal-notes"];
        summary = `A personal journal entry or reflective log containing individual notes.`;
    } else if (textLower.includes("class") || textLower.includes("lecture") || textLower.includes("assignment") || textLower.includes("school") || textLower.includes("study")) {
        category = "Education";
        tags = ["learning", "homework", "lecture", "study-guide"];
        summary = `An educational paper or academic note regarding student coursework or study guidelines.`;
    }

    return {
        summary: text.trim().length > 0 ? (text.trim().substring(0, 140) + "...") : summary,
        category,
        tags
    };
}

// ---------------- API ENDPOINTS ----------------

// Get status parameters
app.get("/api/status", (req, res) => {
  const hasKey = !!process.env.GEMINI_API_KEY && process.env.GEMINI_API_KEY !== "MY_GEMINI_API_KEY";
  res.json({
    watched_folder: virtualWatchFolder,
    ollama_running: true, // Always return true for simulated environment
    watcher_running: !!virtualWatchFolder,
    has_gemini_key: hasKey,
    environment: "Web Simulation (Google Gemini)"
  });
});

// Get all virtual files
app.get("/api/files", (req, res) => {
  res.json(filesDb);
});

// Configure watch folder path
app.post("/api/config/watch", (req, res) => {
  const { path: folderPath } = req.body;
  if (!folderPath) {
    return res.status(400).json({ error: "Path is required" });
  }
  virtualWatchFolder = folderPath;
  res.json({ success: true, folder_path: virtualWatchFolder });
});

// Add and process a virtual file in background
app.post("/api/files/add", async (req, res) => {
  const { filename, content, file_size } = req.body;
  if (!filename || content === undefined) {
    return res.status(400).json({ error: "Filename and content are required" });
  }

  const cleanFilename = path.basename(filename);
  const size = file_size || Buffer.byteLength(content, 'utf8');
  const filepath = path.join(virtualWatchFolder, cleanFilename);

  // Avoid duplicates
  const existing = filesDb.find(f => f.filepath === filepath);
  if (existing) {
    return res.status(400).json({ error: "File already monitored in this watch folder." });
  }

  // Create active entry with pending status
  const newFileId = fileIdCounter++;
  const newFile: VirtualFile = {
    id: newFileId,
    filename: cleanFilename,
    filepath,
    summary: "",
    category: "",
    tags: [],
    date_added: new Date().toISOString(),
    file_size: size,
    status: "pending",
    content
  };

  filesDb.unshift(newFile);

  // Return pending response instantly to simulate async watchdog processing
  res.json({ success: true, file: newFile });

  // Process AI analysis with a simulated 1-second timeout
  setTimeout(async () => {
    try {
      let analysisResult;
      try {
        const client = getGeminiClient();
        const systemPrompt = 
          "You are an expert file organizer AI. " +
          "Analyze the document text and return JSON metadata. " +
          "You MUST output exactly a JSON object matching this schema:\n" +
          "{\n" +
          '  "summary": "1-2 sentences summarizing the document.",\n' +
          '  "category": "One capitalized category like Code, Finance, Work, Personal, Education, Notes, or create one if needed.",\n' +
          '  "tags": ["3 to 5 lowercase string tags"]\n' +
          "}\n" +
          "Return ONLY JSON. Do not write markdown blocks.";

        const prompt = `Filename: ${cleanFilename}\nContent:\n${content.substring(0, 8000)}`;

        const response = await client.models.generateContent({
          model: "gemini-3.5-flash",
          contents: prompt,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                category: { type: Type.STRING },
                tags: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING }
                }
              },
              required: ["summary", "category", "tags"]
            }
          }
        });

        const textResponse = response.text || "";
        analysisResult = JSON.parse(textResponse.trim());
      } catch (geminiError: any) {
        console.warn("Gemini execution failed or Key missing, falling back to rule-based parser:", geminiError.message);
        analysisResult = mockAnalyzeContent(cleanFilename, content);
      }

      // Update db
      const idx = filesDb.findIndex(f => f.id === newFileId);
      if (idx !== -1) {
        filesDb[idx].summary = analysisResult.summary || "Summary generation failed.";
        filesDb[idx].category = (analysisResult.category || "Uncategorized").trim();
        filesDb[idx].tags = Array.isArray(analysisResult.tags) ? analysisResult.tags : [];
        filesDb[idx].status = "processed";
      }
    } catch (err: any) {
      console.error("Critical simulation process failure:", err);
      const idx = filesDb.findIndex(f => f.id === newFileId);
      if (idx !== -1) {
        filesDb[idx].status = "error";
        filesDb[idx].error_reason = err.message || "An unexpected error occurred during ingestion.";
      }
    }
  }, 1000);
});

// Reprocess a file manually
app.post("/api/files/reprocess", async (req, res) => {
  const { id } = req.body;
  const idx = filesDb.findIndex(f => f.id === id);
  if (idx === -1) {
    return res.status(404).json({ error: "File not found" });
  }

  filesDb[idx].status = "pending";
  filesDb[idx].error_reason = undefined;
  
  res.json({ success: true, message: "Reprocessing launched" });

  setTimeout(async () => {
    try {
      const fileRecord = filesDb[idx];
      let analysisResult;
      
      try {
        const client = getGeminiClient();
        const systemPrompt = 
          "You are an expert file organizer AI. Analyze content and return JSON:\n" +
          "{\n" +
          '  "summary": "1-2 sentences summarizing.",\n' +
          '  "category": "Capitalized category.",\n' +
          '  "tags": ["3 to 5 tags"]\n' +
          "}";

        const response = await client.models.generateContent({
          model: "gemini-3.5-flash",
          contents: `Filename: ${fileRecord.filename}\nContent:\n${fileRecord.content}`,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: "application/json",
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                summary: { type: Type.STRING },
                category: { type: Type.STRING },
                tags: { type: Type.ARRAY, items: { type: Type.STRING } }
              },
              required: ["summary", "category", "tags"]
            }
          }
        });
        analysisResult = JSON.parse(response.text?.trim() || "{}");
      } catch (err) {
        analysisResult = mockAnalyzeContent(fileRecord.filename, fileRecord.content);
      }

      filesDb[idx].summary = analysisResult.summary || "Summary failed.";
      filesDb[idx].category = analysisResult.category || "Uncategorized";
      filesDb[idx].tags = analysisResult.tags || [];
      filesDb[idx].status = "processed";
    } catch (err: any) {
      filesDb[idx].status = "error";
      filesDb[idx].error_reason = err.message || "Reprocess analysis failed.";
    }
  }, 800);
});

// Rename a category across all files
app.post("/api/taxonomy/rename", (req, res) => {
  const { oldCategory, newCategory } = req.body;
  if (!oldCategory || !newCategory) {
    return res.status(400).json({ error: "Both oldCategory and newCategory are required." });
  }

  const cleanOld = oldCategory.trim();
  const cleanNew = newCategory.trim();

  if (cleanOld.toLowerCase() === cleanNew.toLowerCase()) {
    // Just a case change or no-op, let's rename them
  }

  let count = 0;
  filesDb.forEach(f => {
    if (f.category && f.category.toLowerCase() === cleanOld.toLowerCase()) {
      f.category = cleanNew;
      count++;
    }
  });

  res.json({ success: true, count, message: `Successfully renamed "${cleanOld}" to "${cleanNew}" for ${count} file(s).` });
});

// Merge duplicate or alternative categories
app.post("/api/taxonomy/merge", (req, res) => {
  const { sourceCategory, targetCategory } = req.body;
  if (!sourceCategory || !targetCategory) {
    return res.status(400).json({ error: "Both sourceCategory and targetCategory are required." });
  }

  const cleanSource = sourceCategory.trim();
  const cleanTarget = targetCategory.trim();

  if (cleanSource.toLowerCase() === cleanTarget.toLowerCase()) {
    return res.status(400).json({ error: "Source and target categories cannot be the same." });
  }

  let count = 0;
  filesDb.forEach(f => {
    if (f.category && f.category.toLowerCase() === cleanSource.toLowerCase()) {
      f.category = cleanTarget;
      count++;
    }
  });

  res.json({ success: true, count, message: `Successfully merged "${cleanSource}" into "${cleanTarget}" for ${count} file(s).` });
});

// Read desktop app codebase files dynamically to power Codebase Explorer Tab
app.get("/api/codebase", async (req, res) => {
  try {
    const files = [
      { name: "main.py", path: "FolderMind/main.py", language: "python" },
      { name: "watcher.py", path: "FolderMind/watcher.py", language: "python" },
      { name: "extractor.py", path: "FolderMind/extractor.py", language: "python" },
      { name: "ai_engine.py", path: "FolderMind/ai_engine.py", language: "python" },
      { name: "db.py", path: "FolderMind/db.py", language: "python" },
      { name: "requirements.txt", path: "FolderMind/requirements.txt", language: "text" },
      { name: "README.md", path: "FolderMind/README.md", language: "markdown" },
      { name: "index.html", path: "FolderMind/frontend/index.html", language: "html" },
      { name: "style.css", path: "FolderMind/frontend/style.css", language: "css" },
      { name: "app.js", path: "FolderMind/frontend/app.js", language: "javascript" }
    ];

    const codebase = [];
    for (const file of files) {
      try {
        const fullPath = path.join(process.cwd(), file.path);
        const content = await fs.readFile(fullPath, "utf-8");
        codebase.push({
          name: file.name,
          path: file.path,
          language: file.language,
          content
        });
      } catch (err) {
        console.warn(`File not readable for explorer: ${file.path}`);
      }
    }

    res.json(codebase);
  } catch (err: any) {
    res.status(500).json({ error: "Failed to read local codebase files." });
  }
});


// ---------------- VITE MIDDLEWARE SETUP ----------------

async function startServer() {
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
