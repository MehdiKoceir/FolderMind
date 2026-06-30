// Global state
let currentCategory = 'all';
let searchQuery = '';
let filesList = [];
let categoryCounts = { categories: {}, status_counts: {} };
let statusInfo = { watched_folder: '', ollama_running: false, watcher_running: false };

// Debounce helper for search
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Check if running inside pywebview or a normal browser mock
const getApi = () => {
    if (window.pywebview && window.pywebview.api) {
        return window.pywebview.api;
    }
    // Mock API for browser testing/fallbacks
    return {
        get_all_files: async () => {
            console.log("Mock API: get_all_files");
            return [
                {
                    id: 1,
                    filename: "annual_report_2025.pdf",
                    filepath: "C:/Users/User/Documents/annual_report_2025.pdf",
                    summary: "The annual financial overview highlighting record Q4 revenue and positive growth metrics.",
                    category: "Finance",
                    tags: ["revenue", "growth", "annual", "report"],
                    date_added: "2026-06-30 12:00:00",
                    file_size: 1423000,
                    status: "processed"
                },
                {
                    id: 2,
                    filename: "server_script.py",
                    filepath: "C:/Users/User/Documents/server_script.py",
                    summary: "A robust server automation script implementing Flask API endpoints and secure authentication headers.",
                    category: "Code",
                    tags: ["python", "api", "backend", "flask"],
                    date_added: "2026-06-30 11:45:00",
                    file_size: 4500,
                    status: "processed"
                }
            ];
        },
        search_files: async (q) => {
            console.log("Mock API: search_files", q);
            const all = await getApi().get_all_files();
            return all.filter(f => f.filename.toLowerCase().includes(q.toLowerCase()) || f.summary.toLowerCase().includes(q.toLowerCase()));
        },
        get_file_categories: async () => {
            return {
                categories: { "Finance": 1, "Code": 1 },
                status_counts: { "processed": 2, "pending": 0, "error": 0 }
            };
        },
        add_watch_folder: async () => {
            return { success: true, folder_path: "C:/Users/User/Desktop/WatchedFolder" };
        },
        get_app_status: async () => {
            return { watched_folder: "C:/Users/User/Desktop/WatchedFolder", ollama_running: true, watcher_running: true };
        },
        reprocess_file: async (id) => {
            console.log("Mock API: reprocess_file", id);
            return { success: true, message: "Started" };
        },
        open_file: async (path) => {
            alert(`Opening local file: ${path}`);
            return true;
        }
    };
};

// Initialize Application
document.addEventListener('DOMContentLoaded', () => {
    // Wait for pywebview to inject api or fallback
    if (window.pywebview) {
        window.addEventListener('pywebviewready', () => {
            initApp();
        });
    } else {
        // Fallback for standalone preview
        setTimeout(initApp, 500);
    }
});

async function initApp() {
    // Set up search listener
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce((e) => {
            searchQuery = e.target.value.trim();
            refreshFiles();
        }, 300));
    }

    // Load initial data
    await checkStatus();
    await loadCategories();
    await refreshFiles();
    
    // Poll status periodically (every 10 seconds) for Ollama connection updates
    setInterval(checkStatus, 10000);
}

// Check application running parameters
async function checkStatus() {
    const api = getApi();
    try {
        statusInfo = await api.get_app_status();
        
        // Update watch folder indicator
        const indicator = document.getElementById('watch-folder-indicator');
        if (indicator) {
            indicator.textContent = statusInfo.watched_folder || "No folder selected. Click 'Watch Folder' to begin.";
        }

        // Update badges
        updateBadge('ollama-badge', statusInfo.ollama_running, "Running", "Offline");
        updateBadge('watcher-badge', statusInfo.watcher_running, "Active", "Off");
        
        // Error Banner triggers if Ollama is offline and a watch folder is selected
        const errorBanner = document.getElementById('error-banner');
        if (errorBanner) {
            if (!statusInfo.ollama_running && statusInfo.watched_folder) {
                errorBanner.classList.remove('hidden');
            } else {
                errorBanner.classList.add('hidden');
            }
        }
    } catch (e) {
        console.error("Status check failed", e);
    }
}

function updateBadge(id, isActive, activeText, inactiveText) {
    const badge = document.getElementById(id);
    if (!badge) return;
    
    const dot = badge.querySelector('span:first-child');
    const text = badge.querySelector('span:last-child');
    
    if (isActive) {
        dot.className = "w-2 h-2 rounded-full bg-emerald-500 animate-pulse";
        text.className = "text-slate-300 font-medium";
        text.textContent = activeText;
    } else {
        dot.className = "w-2 h-2 rounded-full bg-slate-600";
        text.className = "text-slate-500";
        text.textContent = inactiveText;
    }
}

// Load navigation categories
async function loadCategories() {
    const api = getApi();
    try {
        categoryCounts = await api.get_file_categories();
        
        // Update built-in category badges
        const allCount = Object.values(categoryCounts.categories).reduce((a, b) => a + b, 0);
        document.getElementById('count-all').textContent = allCount;
        document.getElementById('count-pending').textContent = categoryCounts.status_counts.pending || 0;
        document.getElementById('count-error').textContent = categoryCounts.status_counts.error || 0;
        
        // Handle pending spinner animation
        const pendingIcon = document.getElementById('spinner-pending-icon');
        if (pendingIcon) {
            if (categoryCounts.status_counts.pending > 0) {
                pendingIcon.classList.add('animate-spin');
            } else {
                pendingIcon.classList.remove('animate-spin');
            }
        }

        // Build dynamic category list
        const catListContainer = document.getElementById('category-list');
        if (catListContainer) {
            catListContainer.innerHTML = '';
            const cats = Object.entries(categoryCounts.categories).sort((a, b) => b[1] - a[1]);
            
            if (cats.length === 0) {
                catListContainer.innerHTML = '<div class="text-xs text-slate-500 px-3 py-2 italic">No categories yet.</div>';
                return;
            }
            
            cats.forEach(([category, count]) => {
                const isActive = currentCategory === category;
                const button = document.createElement('button');
                button.onclick = () => selectCategory(category);
                button.className = `w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-sm transition-all text-slate-300 hover:bg-slate-800/40 ${isActive ? 'active-sidebar-btn font-medium bg-slate-800/30' : ''}`;
                
                button.innerHTML = `
                    <span class="flex items-center gap-2.5 overflow-hidden">
                        <svg class="w-4 h-4 shrink-0 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 7h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
                        </svg>
                        <span class="truncate pr-1">${category}</span>
                    </span>
                    <span class="text-xs bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded font-mono">${count}</span>
                `;
                catListContainer.appendChild(button);
            });
        }
    } catch (e) {
        console.error("Categories loading failed", e);
    }
}

// Refresh files on page filter
async function refreshFiles() {
    const api = getApi();
    try {
        if (searchQuery) {
            filesList = await api.search_files(searchQuery);
        } else {
            filesList = await api.get_all_files();
        }
        
        // Filter in frontend if clicking category (all, pending, error, or dynamic)
        let filteredFiles = filesList;
        if (currentCategory === 'pending') {
            filteredFiles = filesList.filter(f => f.status === 'pending');
        } else if (currentCategory === 'error') {
            filteredFiles = filesList.filter(f => f.status === 'error');
        } else if (currentCategory !== 'all') {
            filteredFiles = filesList.filter(f => f.category === currentCategory && f.status === 'processed');
        }
        
        renderFiles(filteredFiles);
    } catch (e) {
        console.error("Failed to refresh files list", e);
    }
}

// Select Sidebar Categories
function selectCategory(cat) {
    currentCategory = cat;
    
    // Update active visual styles in Sidebar
    const navButtons = document.querySelectorAll('aside nav button');
    navButtons.forEach(btn => btn.className = btn.className.replace('active-sidebar-btn bg-slate-800', ''));
    
    const activeBtnMap = {
        'all': 'cat-all',
        'pending': 'cat-pending',
        'error': 'cat-error'
    };
    
    const targetId = activeBtnMap[cat];
    if (targetId) {
        const btn = document.getElementById(targetId);
        if (btn) btn.className += ' active-sidebar-btn bg-slate-800';
    }
    
    // Set headers
    const title = document.getElementById('current-view-title');
    if (title) title.textContent = cat === 'all' ? 'All Files' : (cat === 'pending' ? 'Currently Analyzing' : (cat === 'error' ? 'Failed Extraction' : cat));
    
    loadCategories();
    refreshFiles();
}

// Render files list
function renderFiles(files) {
    const grid = document.getElementById('files-grid');
    const emptyState = document.getElementById('empty-state');
    const metaIndicator = document.getElementById('files-meta-indicator');
    
    if (!grid) return;
    grid.innerHTML = '';
    
    if (metaIndicator) {
        metaIndicator.textContent = `${files.length} file${files.length !== 1 ? 's' : ''} filtered`;
    }
    
    if (files.length === 0) {
        emptyState.classList.remove('hidden');
        grid.classList.add('hidden');
        return;
    }
    
    emptyState.classList.add('hidden');
    grid.classList.remove('hidden');
    
    files.forEach(file => {
        const card = document.createElement('div');
        card.className = "bg-dark-900 border border-slate-800/80 hover:border-slate-700 rounded-xl p-5 shadow-lg flex flex-col justify-between transition-all duration-200 hover:-translate-y-[2px] hover:shadow-indigo-950/10 animate-fade-in";
        card.id = `card-file-${file.id}`;
        
        let headerHtml = '';
        let bodyHtml = '';
        let actionsHtml = '';
        
        // Design card based on status (processed / pending / error)
        if (file.status === 'pending') {
            headerHtml = `
                <div class="flex items-start justify-between gap-4 mb-3">
                    <div class="flex items-center gap-2.5 overflow-hidden">
                        <div class="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-500 shrink-0">
                            <svg class="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 15H18"/>
                            </svg>
                        </div>
                        <div class="overflow-hidden">
                            <h3 class="text-sm font-semibold text-slate-200 truncate" title="${file.filename}">${file.filename}</h3>
                            <p class="text-[10px] text-amber-500 font-mono tracking-wider uppercase mt-0.5">PENDING ANALYSIS</p>
                        </div>
                    </div>
                    <span class="text-[11px] text-slate-500 font-mono shrink-0">${formatBytes(file.file_size)}</span>
                </div>
            `;
            bodyHtml = `
                <div class="flex-1 min-h-[70px] flex flex-col justify-center py-2">
                    <div class="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
                        <div class="bg-amber-500 h-1.5 rounded-full animate-[pulse_1.5s_infinite]" style="width: 60%"></div>
                    </div>
                    <p class="text-xs text-slate-400 mt-2.5 text-center italic">Extracting raw texts and calling Ollama llama3.2 locally...</p>
                </div>
            `;
        } else if (file.status === 'error') {
            headerHtml = `
                <div class="flex items-start justify-between gap-4 mb-3">
                    <div class="flex items-center gap-2.5 overflow-hidden">
                        <div class="w-9 h-9 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0">
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
                            </svg>
                        </div>
                        <div class="overflow-hidden">
                            <h3 class="text-sm font-semibold text-slate-200 truncate" title="${file.filename}">${file.filename}</h3>
                            <p class="text-[10px] text-rose-400 font-mono tracking-wider uppercase mt-0.5">PROCESSING FAILED</p>
                        </div>
                    </div>
                    <span class="text-[11px] text-slate-500 font-mono shrink-0">${formatBytes(file.file_size)}</span>
                </div>
            `;
            bodyHtml = `
                <div class="flex-1 min-h-[70px] py-2 bg-rose-950/20 border border-rose-900/30 rounded-lg p-3 mb-3">
                    <p class="text-xs text-rose-300 font-mono break-words leading-relaxed">${file.error_reason || "Unknown extraction error."}</p>
                </div>
            `;
            actionsHtml = `
                <div class="flex items-center justify-between border-t border-slate-800/80 pt-3.5 mt-2">
                    <span class="text-[11px] text-slate-500 font-mono">${formatDate(file.date_added)}</span>
                    <button onclick="reprocessFile(${file.id})" class="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white rounded-md text-xs font-medium transition-colors flex items-center gap-1.5">
                        <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 15H18"/>
                        </svg>
                        <span>Retry</span>
                    </button>
                </div>
            `;
        } else {
            // Processed success card
            const tagsHtml = file.tags && file.tags.length > 0 
                ? file.tags.map(t => `<span class="tag-badge text-[10px] bg-slate-800/60 text-slate-400 px-2 py-0.5 rounded font-mono border border-slate-700/30">${t}</span>`).join('')
                : '<span class="text-[10px] text-slate-600 italic">No tags</span>';
                
            headerHtml = `
                <div class="flex items-start justify-between gap-4 mb-2.5">
                    <div class="flex items-center gap-2.5 overflow-hidden">
                        <div class="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-400 shrink-0">
                            <svg class="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
                            </svg>
                        </div>
                        <div class="overflow-hidden">
                            <h3 class="text-sm font-semibold text-slate-200 truncate" title="${file.filename}">${file.filename}</h3>
                            <span class="inline-flex text-[10px] bg-indigo-600/10 border border-indigo-500/20 text-indigo-300 font-medium px-1.5 py-0.1 rounded uppercase tracking-wider mt-0.5">${file.category}</span>
                        </div>
                    </div>
                    <span class="text-[11px] text-slate-500 font-mono shrink-0">${formatBytes(file.file_size)}</span>
                </div>
            `;
            
            bodyHtml = `
                <p class="text-xs text-slate-300 leading-relaxed mb-4 min-h-[44px] line-clamp-3">${file.summary}</p>
                <div class="flex flex-wrap gap-1.5 mb-4">${tagsHtml}</div>
            `;
            
            actionsHtml = `
                <div class="flex items-center justify-between border-t border-slate-800/80 pt-3 mt-auto">
                    <span class="text-[11px] text-slate-500 font-mono">${formatDate(file.date_added)}</span>
                    <div class="flex items-center gap-2">
                        <button onclick="reprocessFile(${file.id})" class="p-1.5 bg-slate-800/40 hover:bg-slate-800 text-slate-400 hover:text-slate-200 rounded-md transition-colors" title="Re-summarize with Ollama">
                            <svg class="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 4v5h.582m15.356 2A8.001 8.001 0 1121.21 15H18"/>
                            </svg>
                        </button>
                        <button onclick="openFile('${file.filepath.replace(/\\/g, '\\\\')}')" class="px-2.5 py-1.5 bg-indigo-600/20 hover:bg-indigo-600 border border-indigo-500/30 hover:border-indigo-500 text-indigo-300 hover:text-white rounded-md text-xs font-semibold transition-all flex items-center gap-1">
                            <svg class="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/>
                            </svg>
                            <span>Open</span>
                        </button>
                    </div>
                </div>
            `;
        }
        
        card.innerHTML = headerHtml + bodyHtml + actionsHtml;
        grid.appendChild(card);
    });
}

// Native trigger buttons
async function setupWatchFolder() {
    const api = getApi();
    try {
        const result = await api.add_watch_folder();
        if (result && result.success) {
            showToast("Watch folder updated", `Monitoring: ${result.folder_path}`);
            await checkStatus();
            await loadCategories();
            await refreshFiles();
        }
    } catch (e) {
        console.error("Failed to select folder", e);
    }
}

async function reprocessFile(fileId) {
    const api = getApi();
    try {
        const res = await api.reprocess_file(fileId);
        if (res.success) {
            showToast("Reprocessing triggered", "AI analysis launched in background...");
        } else {
            showToast("Reprocess failed", res.error);
        }
    } catch (e) {
        console.error("Failed to reprocess file", e);
    }
}

async function openFile(filepath) {
    const api = getApi();
    try {
        const opened = await api.open_file(filepath);
        if (!opened) {
            showToast("Failed to open file", "File could not be found or opened.");
        }
    } catch (e) {
        console.error("Open file call failed", e);
    }
}

// Callback invoked dynamically from pywebview thread via on_file_processed_event
window.onFileUpdate = function(data) {
    console.log("File updated event received from Python:", data);
    
    // Play a toast depending on state
    if (data.status === 'pending') {
        showToast("New file detected", `${data.filename} added to queue...`);
    } else if (data.status === 'processed') {
        showToast("Analysis complete", `${data.filename} has been categorized!`);
    } else if (data.status === 'error') {
        showToast("Processing failed", `${data.filename}: ${data.error || 'error'}`);
    }
    
    // Refresh the view
    loadCategories();
    refreshFiles();
};

// Toast utility
function showToast(title, desc) {
    const toast = document.getElementById('toast');
    if (!toast) return;
    
    document.getElementById('toast-title').textContent = title;
    document.getElementById('toast-desc').textContent = desc;
    
    // Slide in
    toast.className = toast.className.replace('translate-y-20 opacity-0 pointer-events-none', 'translate-y-0 opacity-100');
    
    // Dismiss after 4 seconds
    setTimeout(() => {
        toast.className = toast.className.replace('translate-y-0 opacity-100', 'translate-y-20 opacity-0 pointer-events-none');
    }, 4000);
}

// Dismiss Error Banner
function dismissError() {
    const banner = document.getElementById('error-banner');
    if (banner) banner.classList.add('hidden');
}

// Helpers
function formatBytes(bytes, decimals = 1) {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const dm = decimals < 0 ? 0 : decimals;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

function formatDate(dateStr) {
    if (!dateStr) return '';
    try {
        // Simple formatter
        const d = new Date(dateStr.replace(' ', 'T'));
        if (isNaN(d)) return dateStr;
        return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    } catch (e) {
        return dateStr;
    }
}
