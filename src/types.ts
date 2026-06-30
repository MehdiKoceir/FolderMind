export interface VirtualFile {
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

export interface CodebaseFile {
  name: string;
  path: string;
  language: string;
  content: string;
}

export interface AppStatus {
  watched_folder: string;
  ollama_running: boolean;
  watcher_running: boolean;
  has_gemini_key: boolean;
  environment: string;
}
