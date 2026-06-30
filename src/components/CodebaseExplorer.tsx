import React, { useState } from "react";
import { CodebaseFile } from "../types";
import { Folder, FolderOpen, FileCode, Copy, Check, Terminal, Info, BookOpen } from "lucide-react";

interface Props {
  codebase: CodebaseFile[];
}

export default function CodebaseExplorer({ codebase }: Props) {
  const [selectedFile, setSelectedFile] = useState<string>("main.py");
  const [copied, setCopied] = useState<boolean>(false);
  const [expandedFolders, setExpandedFolders] = useState<Record<string, boolean>>({
    root: true,
    frontend: true,
  });

  const activeFile = codebase.find((f) => f.name === selectedFile) || codebase[0];

  const handleCopy = async () => {
    if (!activeFile) return;
    try {
      await navigator.clipboard.writeText(activeFile.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy", err);
    }
  };

  const toggleFolder = (folder: string) => {
    setExpandedFolders((prev) => ({
      ...prev,
      [folder]: !prev[folder],
    }));
  };

  // Group codebase files into logical structures
  const rootFiles = codebase.filter((f) => !f.path.includes("/") || f.path.startsWith("FolderMind/") && f.path.split("/").length === 2 && !f.path.includes("frontend/"));
  const frontendFiles = codebase.filter((f) => f.path.includes("frontend/"));

  const getIconForFile = (name: string) => {
    if (name.endsWith(".py")) return <FileCode className="w-4 h-4 text-sky-400 shrink-0" />;
    if (name.endsWith(".html")) return <FileCode className="w-4 h-4 text-orange-400 shrink-0" />;
    if (name.endsWith(".js")) return <FileCode className="w-4 h-4 text-amber-400 shrink-0" />;
    if (name.endsWith(".css")) return <FileCode className="w-4 h-4 text-teal-400 shrink-0" />;
    if (name === "README.md") return <BookOpen className="w-4 h-4 text-emerald-400 shrink-0" />;
    return <Terminal className="w-4 h-4 text-slate-400 shrink-0" />;
  };

  return (
    <div className="flex-1 flex overflow-hidden bg-[#0c0c0e] rounded-2xl border border-white/5 shadow-2xl">
      
      {/* File Explorer Sidebar */}
      <div className="w-72 border-r border-white/5 bg-[#141417] flex flex-col overflow-y-auto p-4 shrink-0 font-sans select-none">
        <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-4 px-2">Project Workspace</h3>
        
        <div className="space-y-1">
          {/* Main Directory Folder */}
          <div>
            <button
              onClick={() => toggleFolder("root")}
              className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm font-medium text-slate-200 hover:bg-white/5 transition-colors"
            >
              {expandedFolders.root ? (
                <FolderOpen className="w-4 h-4 text-sky-500 shrink-0" />
              ) : (
                <Folder className="w-4 h-4 text-sky-500 shrink-0" />
              )}
              <span>FolderMind/</span>
            </button>

            {expandedFolders.root && (
              <div className="pl-4 mt-0.5 space-y-0.5 border-l border-white/5 ml-3.5">
                {rootFiles
                  .filter((f) => f.name !== "requirements.txt" && f.name !== "README.md")
                  .map((file) => {
                    const isSelected = selectedFile === file.name;
                    return (
                      <button
                        key={file.path}
                        onClick={() => setSelectedFile(file.name)}
                        className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-mono transition-all text-left ${
                          isSelected
                            ? "bg-white/5 border-l-2 border-sky-500 text-sky-400 font-medium pl-1.5"
                            : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                        }`}
                      >
                        {getIconForFile(file.name)}
                        <span className="truncate">{file.name}</span>
                      </button>
                    );
                  })}

                {/* Frontend Subdirectory Folder */}
                <div>
                  <button
                    onClick={() => toggleFolder("frontend")}
                    className="w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-xs font-medium text-slate-300 hover:bg-white/5 transition-colors"
                  >
                    {expandedFolders.frontend ? (
                      <FolderOpen className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    ) : (
                      <Folder className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                    )}
                    <span>frontend/</span>
                  </button>

                  {expandedFolders.frontend && (
                    <div className="pl-4 mt-0.5 space-y-0.5 border-l border-white/5 ml-3.5">
                      {frontendFiles.map((file) => {
                        const isSelected = selectedFile === file.name;
                        return (
                          <button
                            key={file.path}
                            onClick={() => setSelectedFile(file.name)}
                            className={`w-full flex items-center gap-2 px-2 py-1 rounded-lg text-xs font-mono transition-all text-left ${
                              isSelected
                                ? "bg-white/5 border-l-2 border-sky-500 text-sky-400 font-medium pl-1.5"
                                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                            }`}
                          >
                            {getIconForFile(file.name)}
                            <span className="truncate">{file.name}</span>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Standalone files in workspace root */}
          {codebase
            .filter((f) => f.name === "requirements.txt" || f.name === "README.md")
            .map((file) => {
              const isSelected = selectedFile === file.name;
              return (
                <button
                  key={file.path}
                  onClick={() => setSelectedFile(file.name)}
                  className={`w-full flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-all text-left ${
                    isSelected
                      ? "bg-white/5 border-l-2 border-sky-500 text-sky-400 font-medium pl-1.5"
                      : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                  }`}
                >
                  {getIconForFile(file.name)}
                  <span className="font-mono text-xs">{file.name}</span>
                </button>
              );
            })}
        </div>

        {/* Tip Badge */}
        <div className="mt-auto p-3.5 bg-[#1c1c1f]/40 border border-white/5 rounded-xl text-[11px] text-slate-400 leading-relaxed font-sans">
          <div className="flex items-center gap-1.5 text-slate-300 font-semibold mb-1">
            <Info className="w-3.5 h-3.5 text-sky-500" />
            <span>Local Copying</span>
          </div>
          Select any file and click <strong className="text-slate-300">Copy Code</strong> to paste directly into your offline desktop codebase!
        </div>
      </div>

      {/* Code Viewer Panel */}
      <div className="flex-1 flex flex-col overflow-hidden bg-[#0c0c0e] font-mono">
        <div className="h-11 border-b border-white/5 bg-[#141417]/40 px-5 flex items-center justify-between shrink-0 select-none">
          <div className="flex items-center gap-2.5">
            <span className="text-slate-500 text-xs font-mono">path:</span>
            <span className="text-xs text-sky-400 font-mono">{activeFile?.path || ""}</span>
          </div>
          
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 px-3 py-1 bg-white text-slate-900 hover:bg-slate-200 text-xs font-sans font-semibold rounded-full transition-all active:scale-95"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span className="text-emerald-600 font-sans font-medium">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5 text-slate-800" />
                <span className="font-sans font-medium">Copy Code</span>
              </>
            )}
          </button>
        </div>

        {/* Scrollable code layout */}
        <div className="flex-1 overflow-auto p-5 text-xs text-slate-300 leading-relaxed selection:bg-sky-950 selection:text-sky-200">
          <pre className="font-mono overflow-x-auto">
            <code>{activeFile?.content || ""}</code>
          </pre>
        </div>
      </div>
    </div>
  );
}
