import React, { useState, useEffect, useMemo } from "react";
import { VirtualFile, CodebaseFile, AppStatus } from "./types";
import CodebaseExplorer from "./components/CodebaseExplorer";
import FileDropsSimulator from "./components/FileDropsSimulator";
import { 
  Search, Folder, Terminal, Play, FileText, RefreshCw, Plus, Check, 
  AlertCircle, ExternalLink, Copy, FileCode, MonitorPlay, Code2, 
  HelpCircle, ChevronRight, HardDrive, Cpu, AlertTriangle, Sparkles, BookOpen,
  Edit2, GitMerge, X
} from "lucide-react";

export default function App() {
  // Tabs: 'simulator' | 'codebase' | 'guide'
  const [activeTab, setActiveTab] = useState<"simulator" | "codebase" | "guide">("simulator");
  const [files, setFiles] = useState<VirtualFile[]>([]);
  const [codebase, setCodebase] = useState<CodebaseFile[]>([]);
  const [appStatus, setAppStatus] = useState<AppStatus | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [toastMessage, setToastMessage] = useState<{ title: string; desc: string } | null>(null);
  const [watchFolderInput, setWatchFolderInput] = useState<string>("");
  const [isChangingFolder, setIsChangingFolder] = useState<boolean>(false);

  // Taxonomy Editing & Merging States
  const [isTaxonomyModalOpen, setIsTaxonomyModalOpen] = useState<boolean>(false);
  const [renamingCategory, setRenamingCategory] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState<string>("");
  const [mergingCategory, setMergingCategory] = useState<string | null>(null);
  const [mergeTarget, setMergeTarget] = useState<string>("");
  const [isTaxonomySubmitting, setIsTaxonomySubmitting] = useState<boolean>(false);
  const [taxonomyError, setTaxonomyError] = useState<string | null>(null);

  const handleRenameCategory = async (oldCategory: string) => {
    const cleanNewName = renameValue.trim();
    if (!cleanNewName || cleanNewName === oldCategory) {
      setRenamingCategory(null);
      return;
    }
    setIsTaxonomySubmitting(true);
    setTaxonomyError(null);
    try {
      const res = await fetch("/api/taxonomy/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ oldCategory, newCategory: cleanNewName })
      });
      if (res.ok) {
        triggerToast("Taxonomy Updated", `Category "${oldCategory}" successfully renamed to "${cleanNewName}"`);
        setRenamingCategory(null);
        setRenameValue("");
        // If the selected category was the one renamed, update it
        if (selectedCategory === oldCategory) {
          setSelectedCategory(cleanNewName);
        }
        fetchStatusAndData();
      } else {
        const errData = await res.json();
        setTaxonomyError(errData.error || "Failed to rename category.");
      }
    } catch (err) {
      setTaxonomyError("Network error occurred.");
    } finally {
      setIsTaxonomySubmitting(false);
    }
  };

  const handleMergeCategory = async (sourceCategory: string) => {
    if (!mergeTarget) {
      setMergingCategory(null);
      return;
    }
    setIsTaxonomySubmitting(true);
    setTaxonomyError(null);
    try {
      const res = await fetch("/api/taxonomy/merge", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sourceCategory, targetCategory: mergeTarget })
      });
      if (res.ok) {
        triggerToast("Categories Merged", `Merged all files in "${sourceCategory}" into "${mergeTarget}"`);
        setMergingCategory(null);
        setMergeTarget("");
        // If the selected category was the merged one, fallback to 'all' or target
        if (selectedCategory === sourceCategory) {
          setSelectedCategory("all");
        }
        fetchStatusAndData();
      } else {
        const errData = await res.json();
        setTaxonomyError(errData.error || "Failed to merge categories.");
      }
    } catch (err) {
      setTaxonomyError("Network error occurred.");
    } finally {
      setIsTaxonomySubmitting(false);
    }
  };

  // Fetch initial app status, virtual files database, and local codebase files
  const fetchStatusAndData = async () => {
    try {
      const resStatus = await fetch("/api/status");
      if (resStatus.ok) {
        const dataStatus = await resStatus.json();
        setAppStatus(dataStatus);
        setWatchFolderInput(dataStatus.watched_folder);
      }

      const resFiles = await fetch("/api/files");
      if (resFiles.ok) {
        const dataFiles = await resFiles.json();
        setFiles(dataFiles);
      }
    } catch (err) {
      console.error("Failed to load virtual database status:", err);
    }
  };

  const fetchCodebase = async () => {
    try {
      const resCodebase = await fetch("/api/codebase");
      if (resCodebase.ok) {
        const dataCodebase = await resCodebase.json();
        setCodebase(dataCodebase);
      }
    } catch (err) {
      console.error("Failed to load codebase files:", err);
    }
  };

  useEffect(() => {
    fetchStatusAndData();
    fetchCodebase();

    // Set up polling (every 1 second) to capture simulated background processing events
    const interval = setInterval(fetchStatusAndData, 1000);
    return () => clearInterval(interval);
  }, []);

  // Show sliding notification toast
  const triggerToast = (title: string, desc: string) => {
    setToastMessage({ title, desc });
    setTimeout(() => {
      setToastMessage(null);
    }, 4500);
  };

  // Trigger watch folder configuration updates
  const handleUpdateWatchFolder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!watchFolderInput.trim()) return;
    try {
      const res = await fetch("/api/config/watch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: watchFolderInput.trim() })
      });
      if (res.ok) {
        const data = await res.json();
        triggerToast("Watch folder updated", `Monitoring: ${data.folder_path}`);
        fetchStatusAndData();
        setIsChangingFolder(false);
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Trigger file re-summarize manually
  const handleReprocessFile = async (id: number, filename: string) => {
    try {
      const res = await fetch("/api/files/reprocess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id })
      });
      if (res.ok) {
        triggerToast("Reprocessing triggered", `Rerunning AI analysis for ${filename}...`);
        fetchStatusAndData();
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Ingest/drop a simulated file in the watch folder
  const handleIngestFile = async (filename: string, content: string) => {
    try {
      const res = await fetch("/api/files/add", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ filename, content })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          triggerToast("Watchdog Event", `Detected added file: ${filename}`);
          fetchStatusAndData();
        }
      }
    } catch (err) {
      console.error(err);
    }
  };

  // Helper simulated action for opening physical file path
  const handleOpenFileSimulated = (filepath: string, filename: string) => {
    triggerToast("System Open Triggered", `Simulating launch of native application for ${filename}...`);
  };

  // Compute category counts from processed files
  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    let pendingCount = 0;
    let errorCount = 0;

    files.forEach((file) => {
      if (file.status === "pending") {
        pendingCount++;
      } else if (file.status === "error") {
        errorCount++;
      } else if (file.status === "processed" && file.category) {
        counts[file.category] = (counts[file.category] || 0) + 1;
      }
    });

    return {
      categories: counts,
      pending: pendingCount,
      error: errorCount,
      total: files.filter(f => f.status === 'processed').length
    };
  }, [files]);

  // Filter files based on selected category in sidebar + active search query
  const filteredFiles = useMemo(() => {
    let result = files;

    // Apply search query
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        (f) =>
          f.filename.toLowerCase().includes(q) ||
          f.summary.toLowerCase().includes(q) ||
          f.category.toLowerCase().includes(q) ||
          f.tags.some((t) => t.toLowerCase().includes(q))
      );
    }

    // Apply category filter
    if (selectedCategory === "pending") {
      result = result.filter((f) => f.status === "pending");
    } else if (selectedCategory === "error") {
      result = result.filter((f) => f.status === "error");
    } else if (selectedCategory !== "all") {
      result = result.filter((f) => f.category === selectedCategory && f.status === "processed");
    }

    return result;
  }, [files, selectedCategory, searchQuery]);

  const formatBytes = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "";
    try {
      const d = new Date(dateStr);
      return d.toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        hour: "2-digit",
        minute: "2-digit"
      });
    } catch {
      return dateStr;
    }
  };

  return (
    <div className="min-h-screen h-screen flex flex-row bg-bg-dark text-slate-300 font-sans antialiased overflow-hidden">
      
      {/* Left Sidebar Panel */}
      <aside className="w-64 border-r border-white/5 bg-panel-dark flex flex-col justify-between shrink-0 font-sans select-none overflow-hidden">
        
        {/* Top brand & Navigation tabs */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="p-6 pb-2 shrink-0">
            <div className="flex items-center gap-2.5 mb-8 select-none">
              <div className="w-3 h-3 rounded-full bg-sky-accent shadow-[0_0_8px_rgba(14,165,233,0.6)] animate-pulse"></div>
              <h1 className="text-base font-bold tracking-tight text-white font-sans">FolderMind</h1>
            </div>
            
            {/* Sidebar Tab Navigation (Modern Rounded Buttons) */}
            <div className="space-y-1">
              <p className="text-[10px] uppercase tracking-widest text-slate-500 font-bold mb-3 px-3">NAVIGATION</p>
              <button
                onClick={() => setActiveTab("simulator")}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all ${
                  activeTab === "simulator"
                    ? "bg-white/5 text-sky-accent"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <MonitorPlay className="w-4 h-4" />
                <span>Interactive Simulator</span>
              </button>
              <button
                onClick={() => setActiveTab("codebase")}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all ${
                  activeTab === "codebase"
                    ? "bg-white/5 text-sky-accent"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <Code2 className="w-4 h-4" />
                <span>Codebase Explorer</span>
              </button>
              <button
                onClick={() => setActiveTab("guide")}
                className={`w-full px-3.5 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2.5 transition-all ${
                  activeTab === "guide"
                    ? "bg-white/5 text-sky-accent"
                    : "text-slate-400 hover:text-slate-200 hover:bg-white/5"
                }`}
              >
                <BookOpen className="w-4 h-4" />
                <span>Ollama Setup Guide</span>
              </button>
            </div>
          </div>

          {/* Tab-specific sidebar modules */}
          {activeTab === "simulator" && (
            <div className="flex-1 overflow-y-auto px-6 py-4 space-y-6">
              
              {/* Virtual Library */}
              <div>
                <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-3 px-3">VIRTUAL LIBRARY</h3>
                <nav className="space-y-1">
                  <button
                    onClick={() => setSelectedCategory("all")}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors ${
                      selectedCategory === "all"
                        ? "bg-white/5 text-sky-accent font-medium"
                        : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <Folder className="w-4 h-4 text-slate-500 shrink-0" />
                      <span>All Files</span>
                    </span>
                    <span className="text-[10px] bg-bg-dark border border-white/5 text-slate-400 px-2 py-0.5 rounded-full font-mono">
                      {categoryCounts.total}
                    </span>
                  </button>

                  <button
                    onClick={() => setSelectedCategory("pending")}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors ${
                      selectedCategory === "pending"
                        ? "bg-white/5 text-sky-accent font-medium"
                        : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <RefreshCw className={`w-4 h-4 text-amber-500 shrink-0 ${categoryCounts.pending > 0 ? "animate-spin" : ""}`} />
                      <span>Analyzing</span>
                    </span>
                    <span className="text-[10px] bg-amber-500/10 text-amber-400 px-2 py-0.5 rounded-full font-mono font-bold">
                      {categoryCounts.pending}
                    </span>
                  </button>

                  <button
                    onClick={() => setSelectedCategory("error")}
                    className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-xs transition-colors ${
                      selectedCategory === "error"
                        ? "bg-white/5 text-sky-accent font-medium"
                        : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                    }`}
                  >
                    <span className="flex items-center gap-2.5">
                      <AlertCircle className="w-4 h-4 text-rose-500 shrink-0" />
                      <span>Failed Ingest</span>
                    </span>
                    <span className="text-[10px] bg-rose-500/10 text-rose-400 px-2 py-0.5 rounded-full font-mono font-bold">
                      {categoryCounts.error}
                    </span>
                  </button>
                </nav>
              </div>

              {/* Dynamic AI Taxonomy */}
              <div>
                <div className="flex items-center justify-between mb-3 px-3">
                  <h3 className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">AI TAXONOMY</h3>
                  <button
                    onClick={() => setIsTaxonomyModalOpen(true)}
                    className="text-[10px] text-sky-400 hover:text-sky-300 font-bold uppercase tracking-wider flex items-center gap-1 transition-all"
                  >
                    <Edit2 className="w-3 h-3" />
                    <span>Edit</span>
                  </button>
                </div>
                <div className="space-y-1">
                  {Object.entries(categoryCounts.categories).length === 0 ? (
                    <p className="text-[10px] text-slate-500 italic px-3 py-2">No categories classified yet.</p>
                  ) : (
                    Object.entries(categoryCounts.categories)
                      .sort((a, b) => (b[1] as number) - (a[1] as number))
                      .map(([catName, count]) => {
                        const isSelected = selectedCategory === catName;
                        return (
                          <button
                            key={catName}
                            onClick={() => setSelectedCategory(catName)}
                            className={`w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs transition-colors ${
                              isSelected
                                ? "bg-white/5 text-sky-accent font-medium"
                                : "text-slate-400 hover:bg-white/5 hover:text-slate-200"
                            }`}
                          >
                            <span className="flex items-center gap-2.5 overflow-hidden">
                              <ChevronRight className="w-3 h-3 text-slate-500 shrink-0" />
                              <span className="truncate">{catName}</span>
                            </span>
                            <span className="text-[10px] bg-bg-dark border border-white/5 text-slate-400 px-1.5 py-0.5 rounded-full font-mono">
                              {count}
                            </span>
                          </button>
                        );
                      })
                  )}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Sidebar Footer: Ollama Status */}
        <div className="p-6 border-t border-white/5 bg-[#141417]/50 shrink-0">
          <div className="bg-sky-500/5 border border-sky-500/10 rounded-2xl p-4">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] text-sky-400 uppercase tracking-widest font-bold">Ollama Core</span>
              <span className="w-2 h-2 rounded-full bg-sky-500 shadow-[0_0_6px_rgba(14,165,233,0.8)] animate-pulse"></span>
            </div>
            <p className="text-xs text-white font-semibold">Llama 3.2 3B</p>
            <p className="text-[10px] text-slate-500 mt-1">Status: Running Locally</p>
          </div>
        </div>
      </aside>

      {/* Main Container Workspace */}
      <div className="flex-1 flex flex-col overflow-hidden bg-bg-dark">
        
        {/* Top Main Header */}
        <header className="h-20 border-b border-white/5 flex items-center justify-between px-8 bg-bg-dark/80 backdrop-blur-md sticky top-0 shrink-0 z-10">
          
          {/* Header Left (Search or Tab title) */}
          {activeTab === "simulator" ? (
            <div className="w-80 relative select-none">
              <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none text-slate-500">
                <Search className="w-4 h-4" />
              </div>
              <input
                type="text"
                placeholder="Search database index..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-input-dark border border-white/5 rounded-full pl-11 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-sky-accent/50 transition-all duration-200"
              />
            </div>
          ) : (
            <div>
              <h2 className="text-sm font-semibold text-white uppercase tracking-widest">
                {activeTab === "codebase" ? "Local Codebase" : "Setup Guide"}
              </h2>
            </div>
          )}

          {/* Header Right (Watch Folder Status & Config) */}
          <div className="flex items-center gap-4 text-xs">
            <div className="hidden md:flex flex-col text-right">
              <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">WATCH FOLDER ACTIVE</span>
              <span className="text-sky-400 font-mono text-[11px] mt-0.5 max-w-[240px] truncate" title={appStatus?.watched_folder}>
                {appStatus?.watched_folder || "None"}
              </span>
            </div>
            {isChangingFolder ? (
              <form onSubmit={handleUpdateWatchFolder} className="flex items-center gap-2">
                <input
                  type="text"
                  value={watchFolderInput}
                  onChange={(e) => setWatchFolderInput(e.target.value)}
                  placeholder="Enter virtual directory path"
                  className="bg-input-dark border border-white/5 text-xs px-3.5 py-1.5 rounded-full text-slate-200 focus:outline-none focus:border-sky-accent/50 w-48 font-mono"
                />
                <button type="submit" className="px-3.5 py-1.5 bg-white text-slate-900 rounded-full text-[10px] font-bold hover:bg-slate-200 transition-colors">
                  Save
                </button>
                <button type="button" onClick={() => setIsChangingFolder(false)} className="px-3.5 py-1.5 bg-[#1c1c1f] text-slate-400 rounded-full text-[10px] font-semibold hover:text-white transition-colors">
                  Cancel
                </button>
              </form>
            ) : (
              <button
                onClick={() => {
                  setWatchFolderInput(appStatus?.watched_folder || "");
                  setIsChangingFolder(true);
                }}
                className="px-3.5 py-1.5 bg-white text-slate-900 rounded-full text-[11px] font-semibold hover:bg-slate-200 transition-colors flex items-center gap-1.5"
              >
                <Folder className="w-3 h-3" />
                <span>Change Folder</span>
              </button>
            )}
          </div>
        </header>

        {/* Workspace views */}
        <div className="flex-1 overflow-hidden">
          
          {/* TAB 1: INTERACTIVE DESKTOP SIMULATOR */}
          {activeTab === "simulator" && (
            <div className="h-full flex overflow-hidden">
              
              {/* Grid lists of files (Middle section) */}
              <div className="flex-1 overflow-y-auto p-8 flex flex-col justify-between">
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-bold text-white tracking-tight">Virtual Files Index</h2>
                      <p className="text-xs text-slate-500 mt-1">Database view of processed files in watched folder (purely virtual metadata)</p>
                    </div>
                    {/* Count marker */}
                    <span className="px-3 py-1 bg-white/5 border border-white/5 text-slate-400 text-[10px] rounded-full font-mono">
                      Showing {filteredFiles.length} of {files.length}
                    </span>
                  </div>
                  
                  {/* Cards or Empty State */}
                  {filteredFiles.length === 0 ? (
                    <div className="h-96 flex flex-col items-center justify-center text-center max-w-sm mx-auto select-none">
                      <div className="w-14 h-14 rounded-2xl bg-[#141417] border border-white/5 flex items-center justify-center text-slate-500 mb-4 shadow">
                        <Folder className="w-6 h-6" />
                      </div>
                      <h3 className="text-sm font-semibold text-slate-300 mb-1">No matching files found</h3>
                      <p className="text-xs text-slate-500 leading-normal">
                        Drop a simulated file in the watch folder on the right to trigger the watcher process!
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
                      {filteredFiles.map((file) => {
                        // Determine extension
                        const extension = file.filename.split('.').pop()?.toUpperCase() || "TXT";
                        let extColor = "bg-sky-500/10 text-sky-400 border-sky-500/20";
                        if (["PY", "JS", "TS", "GO"].includes(extension)) {
                          extColor = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                        } else if (["PDF"].includes(extension)) {
                          extColor = "bg-rose-500/10 text-rose-400 border-rose-500/20";
                        } else if (["MD", "TXT", "JSON"].includes(extension)) {
                          extColor = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                        }
                        return (
                          <div
                            key={file.id}
                            className="bg-panel-dark border border-white/5 hover:border-sky-accent/30 rounded-2xl p-5 shadow-lg flex flex-col justify-between transition-all duration-300 hover:-translate-y-[1px] hover:shadow-sky-950/5 group relative overflow-hidden"
                          >
                            {/* Card Header Info */}
                            <div>
                              <div className="flex items-start justify-between gap-4 mb-3">
                                <div className="flex items-center gap-3 overflow-hidden">
                                  <div className={`w-10 h-10 rounded-xl ${extColor} border flex items-center justify-center font-bold text-xs shrink-0 select-none`}>
                                    {extension}
                                  </div>
                                  <div className="overflow-hidden">
                                    <h4 className="text-sm font-semibold text-white truncate pr-1" title={file.filename}>
                                      {file.filename}
                                    </h4>
                                    <div className="flex items-center gap-1.5 mt-1">
                                      {file.status === "processed" && (
                                        <span className="inline-flex text-[9px] font-bold bg-white/5 border border-white/5 text-sky-400 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                          {file.category}
                                        </span>
                                      )}
                                      {file.status === "pending" && (
                                        <span className="inline-flex text-[9px] font-bold bg-amber-500/10 border border-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full uppercase tracking-wider animate-pulse">
                                          Analyzing...
                                        </span>
                                      )}
                                      {file.status === "error" && (
                                        <span className="inline-flex text-[9px] font-bold bg-rose-500/10 border border-rose-500/20 text-rose-400 px-2 py-0.5 rounded-full uppercase tracking-wider">
                                          Error
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                </div>
                                <span className="text-[10px] text-slate-500 font-mono shrink-0 select-none">
                                  {formatBytes(file.file_size)}
                                </span>
                              </div>

                              {/* Card Content based on Ingestion Status */}
                              {file.status === "pending" ? (
                                <div className="py-2.5 flex flex-col justify-center min-h-[64px]">
                                  <div className="w-full bg-[#1c1c1f] rounded-full h-1 overflow-hidden">
                                    <div className="bg-sky-accent h-1 rounded-full animate-[pulse_1.5s_infinite]" style={{ width: "70%" }}></div>
                                  </div>
                                  <p className="text-[11px] text-slate-500 italic mt-3 leading-relaxed">
                                    Processing text content locally using Ollama neural models...
                                  </p>
                                </div>
                              ) : file.status === "error" ? (
                                <div className="py-2.5 bg-rose-950/20 border border-rose-900/20 rounded-xl px-4 mb-3">
                                  <p className="text-[11px] text-rose-400 font-mono break-all leading-normal">
                                    {file.error_reason || "Check file reader content for syntax errors."}
                                  </p>
                                </div>
                              ) : (
                                <div className="min-h-[44px] flex flex-col justify-between">
                                  <p className="text-xs text-slate-400 leading-relaxed italic mb-4">
                                    "{file.summary}"
                                  </p>
                                  
                                  {/* Keyword Tags */}
                                  <div className="flex flex-wrap gap-1.5 mb-4">
                                    {file.tags && file.tags.length > 0 ? (
                                      file.tags.map((t) => (
                                        <span
                                          key={t}
                                          className="text-[10px] font-mono bg-[#1c1c1f]/60 border border-white/5 text-slate-400 px-2.5 py-0.5 rounded-md transition-colors hover:border-sky-accent/30 hover:text-sky-300"
                                        >
                                          {t}
                                        </span>
                                      ))
                                    ) : (
                                      <span className="text-[10px] text-slate-600 italic">No tags computed</span>
                                    )}
                                  </div>
                                </div>
                              )}
                            </div>

                            {/* Card Actions Bottom */}
                            {file.status !== "pending" && (
                              <div className="flex items-center justify-between border-t border-white/5 pt-3.5 mt-2">
                                <span className="text-[10px] text-slate-500 font-mono select-none">
                                  {formatDate(file.date_added)}
                                </span>
                                
                                <div className="flex items-center gap-1.5">
                                  <button
                                    onClick={() => handleReprocessFile(file.id, file.filename)}
                                    className="p-1.5 bg-[#1c1c1f] hover:bg-[#252529] text-slate-400 hover:text-white rounded-lg border border-white/5 transition-colors"
                                    title="Reprocess with Llama 3.2"
                                  >
                                    <RefreshCw className="w-3.5 h-3.5" />
                                  </button>
                                  
                                  {file.status === "processed" && (
                                    <button
                                      onClick={() => handleOpenFileSimulated(file.filepath, file.filename)}
                                      className="px-3.5 py-1.5 bg-white hover:bg-slate-200 text-slate-900 rounded-full text-xs font-semibold transition-all flex items-center gap-1"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                      <span>Open File</span>
                                    </button>
                                  )}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Footer inside the simulator panel */}
                <div className="h-10 border-t border-white/5 flex items-center justify-between bg-bg-dark pt-4 mt-8">
                  <div className="flex items-center gap-4 text-[10px] uppercase tracking-widest text-slate-500 font-bold">
                    <span>DATABASE: <span className="text-white">SQLITE (LOCAL)</span></span>
                    <span>FILES WATCHED: <span className="text-white">{files.length}</span></span>
                  </div>
                  <div className="text-[10px] uppercase tracking-widest text-slate-500 font-bold flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-sky-accent animate-pulse"></span>
                    <span>Offline Mode Engaged</span>
                  </div>
                </div>
              </div>

              {/* Watchdog dropper panel (right section) */}
              <div className="w-80 border-l border-white/5 bg-[#141417]/30 flex flex-col shrink-0 p-6 overflow-y-auto">
                <FileDropsSimulator onDropFile={handleIngestFile} />
              </div>
            </div>
          )}

          {/* TAB 2: CODEBASE EXPLORER */}
          {activeTab === "codebase" && (
            <div className="h-full flex flex-col p-8 bg-[#0c0c0e] overflow-hidden">
              <div className="mb-6 shrink-0">
                <h2 className="text-lg font-bold text-white tracking-tight">Python Service Architecture</h2>
                <p className="text-xs text-slate-500 mt-1">
                  Review the Python background service code that manages native watchdog directory events, processes PDFs, and persists metadata to SQLite.
                </p>
              </div>
              <div className="flex-1 overflow-hidden">
                <CodebaseExplorer codebase={codebase} />
              </div>
            </div>
          )}

          {/* TAB 3: OLLAMA SETUP GUIDE */}
          {activeTab === "guide" && (
            <div className="h-full overflow-y-auto p-8 bg-[#0c0c0e]">
              <div className="max-w-3xl mx-auto space-y-8">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-sky-accent/10 flex items-center justify-center text-sky-accent">
                    <Cpu className="w-5 h-5" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white tracking-tight">Ollama setup & Orchestration</h2>
                    <p className="text-xs text-slate-500 mt-1">Configure your local server to execute open-weight intelligence privately.</p>
                  </div>
                </div>

                <div className="space-y-5 text-sm text-slate-300">
                  {/* Guide Box 1 */}
                  <div className="bg-panel-dark border border-white/5 rounded-2xl p-6 space-y-3 shadow-lg">
                    <h3 className="font-semibold text-white flex items-center gap-2">
                      <span className="w-2 h-2 bg-sky-accent rounded-full"></span>
                      <span>1. Install Ollama Locally</span>
                    </h3>
                    <p className="text-slate-400 pl-4 leading-relaxed text-xs">
                      Ollama runs as a native background daemon on your machine.
                    </p>
                    <ul className="list-disc pl-9 space-y-1.5 text-xs text-slate-400">
                      <li><strong>Windows & macOS</strong>: Download the click-to-run installer from <a href="https://ollama.com" target="_blank" rel="noreferrer" className="text-sky-400 hover:underline">ollama.com</a>.</li>
                      <li><strong>Linux Standard</strong>: Bootstrapped via shell: <code className="bg-bg-dark text-sky-300 px-2 py-0.5 rounded font-mono border border-white/5">curl -fsSL https://ollama.com/install.sh | sh</code>.</li>
                    </ul>
                  </div>

                  {/* Guide Box 2 */}
                  <div className="bg-panel-dark border border-white/5 rounded-2xl p-6 space-y-3 shadow-lg">
                    <h3 className="font-semibold text-white flex items-center gap-2">
                      <span className="w-2 h-2 bg-sky-accent rounded-full"></span>
                      <span>2. Download Llama 3.2 weight model</span>
                    </h3>
                    <p className="text-slate-400 pl-4 leading-relaxed text-xs">
                      Download the 3-billion parameter quantized model directly to your disk. This model runs securely without network requests.
                    </p>
                    <div className="bg-bg-dark p-4 rounded-xl font-mono text-xs border border-white/5 text-sky-400 ml-4">
                      ollama pull llama3.2
                    </div>
                  </div>

                  {/* Guide Box 3 */}
                  <div className="bg-panel-dark border border-white/5 rounded-2xl p-6 space-y-3 shadow-lg">
                    <h3 className="font-semibold text-white flex items-center gap-2">
                      <span className="w-2 h-2 bg-sky-accent rounded-full"></span>
                      <span>3. Starting FolderMind Desktop</span>
                    </h3>
                    <p className="text-slate-400 pl-4 leading-relaxed text-xs">
                      Install pywebview, watchdog and pypdf dependencies, then launch:
                    </p>
                    <div className="bg-bg-dark p-4 rounded-xl font-mono text-xs border border-white/5 text-sky-400 ml-4">
                      python main.py
                    </div>
                  </div>

                  {/* Guide Box 4 */}
                  <div className="bg-panel-dark border border-white/5 rounded-2xl p-6 space-y-3 shadow-lg">
                    <h3 className="font-semibold text-white flex items-center gap-2">
                      <span className="w-2 h-2 bg-sky-accent rounded-full"></span>
                      <span>4. Local Confidentiality Assured</span>
                    </h3>
                    <p className="text-xs text-slate-500 pl-4 leading-relaxed">
                      No tokens are shipped to cloud vendors. All document indexes, folder scanning, PyPDF extractions, and metadata taxonomies stay entirely on physical storage, satisfying corporate governance or private usage.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Edit Taxonomy Dialog Modal */}
      {isTaxonomyModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-bg-dark/80 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-panel-dark border border-white/5 shadow-2xl rounded-2xl w-full max-w-xl flex flex-col max-h-[85vh] overflow-hidden">
            
            {/* Modal Header */}
            <div className="p-6 border-b border-white/5 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2.5">
                <div className="w-8 h-8 rounded-lg bg-sky-accent/10 flex items-center justify-center text-sky-accent">
                  <Edit2 className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Manage AI Taxonomy</h3>
                  <p className="text-[11px] text-slate-500">Rename or merge categories generated by the local AI models.</p>
                </div>
              </div>
              <button
                onClick={() => {
                  setIsTaxonomyModalOpen(false);
                  setRenamingCategory(null);
                  setMergingCategory(null);
                  setTaxonomyError(null);
                }}
                className="p-1.5 hover:bg-white/5 text-slate-400 hover:text-white rounded-lg transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Error Message if any */}
            {taxonomyError && (
              <div className="mx-6 mt-4 p-3 bg-rose-500/10 border border-rose-500/20 text-rose-400 rounded-xl text-xs flex items-center gap-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{taxonomyError}</span>
              </div>
            )}

            {/* Modal Body / Categories List */}
            <div className="flex-1 overflow-y-auto p-6 space-y-4">
              <div className="flex items-center justify-between text-[10px] font-bold text-slate-500 uppercase tracking-widest px-1">
                <span>Category Name</span>
                <span>Actions</span>
              </div>

              <div className="space-y-3">
                {Object.entries(categoryCounts.categories).length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500 italic">
                    No active classified categories to display.
                  </div>
                ) : (
                  Object.entries(categoryCounts.categories).map(([catName, count]) => {
                    const isRenaming = renamingCategory === catName;
                    const isMerging = mergingCategory === catName;

                    return (
                      <div
                        key={catName}
                        className="bg-bg-dark border border-white/5 rounded-xl p-4 flex flex-col gap-3.5 transition-all hover:border-white/10"
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-white">{catName}</span>
                            <span className="text-[10px] bg-[#1c1c1f] text-slate-400 px-2 py-0.5 rounded-full font-mono border border-white/5">
                              {count} {count === 1 ? 'file' : 'files'}
                            </span>
                          </div>

                          {!isRenaming && !isMerging && (
                            <div className="flex items-center gap-2">
                              <button
                                onClick={() => {
                                  setRenamingCategory(catName);
                                  setRenameValue(catName);
                                  setMergingCategory(null);
                                  setTaxonomyError(null);
                                }}
                                className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg text-[10px] font-semibold transition-all flex items-center gap-1"
                              >
                                <Edit2 className="w-3 h-3" />
                                <span>Rename</span>
                              </button>
                              <button
                                onClick={() => {
                                  setMergingCategory(catName);
                                  setRenamingCategory(null);
                                  // Set target category default to first other available category
                                  const others = Object.keys(categoryCounts.categories).filter(c => c !== catName);
                                  setMergeTarget(others[0] || "");
                                  setTaxonomyError(null);
                                }}
                                className="px-2.5 py-1 bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white rounded-lg text-[10px] font-semibold transition-all flex items-center gap-1"
                              >
                                <GitMerge className="w-3 h-3" />
                                <span>Merge</span>
                              </button>
                            </div>
                          )}
                        </div>

                        {/* Inline Renaming Form */}
                        {isRenaming && (
                          <div className="flex items-center gap-2 animate-fade-in">
                            <input
                              type="text"
                              value={renameValue}
                              onChange={(e) => setRenameValue(e.target.value)}
                              disabled={isTaxonomySubmitting}
                              placeholder="New category name"
                              className="flex-1 bg-input-dark border border-white/5 focus:border-sky-accent/50 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none transition-colors"
                            />
                            <button
                              onClick={() => handleRenameCategory(catName)}
                              disabled={isTaxonomySubmitting || !renameValue.trim() || renameValue.trim() === catName}
                              className="p-1.5 bg-sky-accent text-white hover:bg-sky-400 disabled:opacity-50 rounded-lg transition-colors"
                              title="Save Changes"
                            >
                              <Check className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => {
                                setRenamingCategory(null);
                                setTaxonomyError(null);
                              }}
                              disabled={isTaxonomySubmitting}
                              className="p-1.5 bg-white/5 text-slate-400 hover:text-white rounded-lg transition-colors"
                              title="Cancel"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}

                        {/* Inline Merging Form */}
                        {isMerging && (
                          <div className="flex flex-col gap-2.5 animate-fade-in bg-white/5 p-3 rounded-lg border border-white/5">
                            <span className="text-[10px] font-semibold text-slate-400">Merge into another existing category:</span>
                            <div className="flex items-center gap-2">
                              <select
                                value={mergeTarget}
                                onChange={(e) => setMergeTarget(e.target.value)}
                                disabled={isTaxonomySubmitting}
                                className="flex-1 bg-input-dark border border-white/5 rounded-lg px-3 py-1.5 text-xs text-slate-200 focus:outline-none focus:border-sky-accent/50"
                              >
                                {Object.keys(categoryCounts.categories)
                                  .filter(c => c !== catName)
                                  .map(c => (
                                    <option key={c} value={c}>{c}</option>
                                  ))
                                }
                              </select>
                              <button
                                onClick={() => handleMergeCategory(catName)}
                                disabled={isTaxonomySubmitting || !mergeTarget}
                                className="px-3 py-1.5 bg-sky-accent text-white hover:bg-sky-400 rounded-lg text-xs font-semibold flex items-center gap-1 transition-colors"
                              >
                                <GitMerge className="w-3.5 h-3.5" />
                                <span>Confirm Merge</span>
                              </button>
                              <button
                                onClick={() => {
                                  setMergingCategory(null);
                                  setTaxonomyError(null);
                                }}
                                disabled={isTaxonomySubmitting}
                                className="p-1.5 bg-white/5 text-slate-400 hover:text-white rounded-lg transition-colors"
                              >
                                <X className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-6 border-t border-white/5 flex justify-end shrink-0">
              <button
                onClick={() => {
                  setIsTaxonomyModalOpen(false);
                  setRenamingCategory(null);
                  setMergingCategory(null);
                  setTaxonomyError(null);
                }}
                className="px-4 py-2 bg-white text-slate-900 hover:bg-slate-200 rounded-full text-xs font-bold transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Notification Toast Banner */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 bg-panel-dark border border-white/5 shadow-2xl rounded-2xl p-4 max-w-sm flex items-start gap-3.5 transform translate-y-0 opacity-100 transition-all duration-300 z-50 select-none">
          <div className="w-8 h-8 rounded-lg bg-sky-accent/10 flex items-center justify-center text-sky-accent shrink-0">
            <Sparkles className="w-4 h-4 animate-bounce" />
          </div>
          <div>
            <h4 className="text-xs font-bold text-white">{toastMessage.title}</h4>
            <p className="text-[11px] text-slate-500 mt-1 leading-normal">{toastMessage.desc}</p>
          </div>
        </div>
      )}
    </div>
  );
}
