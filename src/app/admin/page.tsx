"use client";

import { useState, useEffect, useRef } from "react";
import { motion } from "framer-motion";
import {
    Users,
    Film,
    Settings,
    LogOut,
    Shield,
    Activity,
    RefreshCw,
    Database,
    Lock,
    Eye,
    EyeOff,
    Loader2,
    Check,
    X,
    Upload,
    FileJson,
    Server,
    Play,
    Download,
    List,
} from "lucide-react";

interface User {
    id: string;
    email: string;
    display_name: string;
    role: string;
    created_at: string;
}

interface ImportStatus {
    loading: boolean;
    success?: boolean;
    message?: string;
    count?: number;
}

interface ServerStatus {
    status: string;
    version?: string;
    isDownloading?: boolean;
    currentProcessing?: string;
    currentVideo?: string;
    priorityQueue?: string[];
    progress?: { processed: number; total: number; completedCount: number };
    system?: { diskFree: string; memory: string; uptime: string };
}

interface QueueData {
    current?: { id: string; title: string; video?: string; status: string };
    priorityQueue?: Array<{ id: string; title: string }>;
    requestQueue?: Array<{ id: string; title: string }>;
    upcoming?: Array<{ id: string; title: string; episodes: number }>;
    totalQueued?: number;
}

interface ReadyFilm {
    dramaId: string;
    title: string;
    episodeCount: number;
    episodes: number[];
}

export default function AdminPage() {
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const [showPassword, setShowPassword] = useState(false);
    const [loginError, setLoginError] = useState("");
    const [loginLoading, setLoginLoading] = useState(false);

    const [activeTab, setActiveTab] = useState("dashboard");
    const [users, setUsers] = useState<User[]>([]);
    const [importStatus, setImportStatus] = useState<ImportStatus>({ loading: false });
    const [stats, setStats] = useState({ totalUsers: 0, totalDramas: 0, totalVideos: 0 });

    // Server tab states
    const [serverStatus, setServerStatus] = useState<ServerStatus | null>(null);
    const [queueData, setQueueData] = useState<QueueData | null>(null);
    const [readyFilms, setReadyFilms] = useState<ReadyFilm[]>([]);
    const [loadingServer, setLoadingServer] = useState(false);
    const [forceQueueId, setForceQueueId] = useState("");
    const [forceQueueLoading, setForceQueueLoading] = useState(false);
    const [forceQueueResult, setForceQueueResult] = useState<{ success: boolean; message: string } | null>(null);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    useEffect(() => {
        const session = sessionStorage.getItem("admin_session");
        if (session === "authenticated") {
            setIsLoggedIn(true);
            loadData();
        }
    }, []);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoginError("");
        setLoginLoading(true);

        if (username === "admin" && password === "G@cor123") {
            sessionStorage.setItem("admin_session", "authenticated");
            setIsLoggedIn(true);
            loadData();
        } else {
            setLoginError("Username atau password salah");
        }
        setLoginLoading(false);
    };

    const handleLogout = () => {
        sessionStorage.removeItem("admin_session");
        setIsLoggedIn(false);
        setUsername("");
        setPassword("");
    };

    const loadData = async () => {
        try {
            const res = await fetch("/api/admin/users");
            if (res.ok) {
                const data = await res.json();
                setUsers(data.users || []);
                setStats((prev) => ({ ...prev, totalUsers: data.users?.length || 0 }));
            }
        } catch (err) {
            console.error(err);
        }

        try {
            const res = await fetch("/api/admin/stats");
            if (res.ok) {
                const data = await res.json();
                setStats(data);
            }
        } catch (err) {
            console.error(err);
        }
    };

    // Load server status
    const loadServerStatus = async () => {
        setLoadingServer(true);
        try {
            const res = await fetch("/api/admin/server");
            if (res.ok) {
                const data = await res.json();
                setServerStatus(data.status || null);
                setQueueData(data.queue || null);
                setReadyFilms(data.ready?.films || []);
            }
        } catch (err) {
            console.error(err);
        } finally {
            setLoadingServer(false);
        }
    };

    // Force add to queue
    const handleForceQueue = async () => {
        if (!forceQueueId.trim()) return;
        setForceQueueLoading(true);
        setForceQueueResult(null);

        try {
            const res = await fetch("/api/admin/server", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ dramaId: forceQueueId.trim() }),
            });
            const data = await res.json();

            if (data.success) {
                setForceQueueResult({ success: true, message: data.message });
                setForceQueueId("");
                loadServerStatus();
            } else {
                setForceQueueResult({ success: false, message: data.error || "Failed" });
            }
        } catch (err) {
            setForceQueueResult({ success: false, message: "Error connecting to server" });
        } finally {
            setForceQueueLoading(false);
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) setSelectedFile(file);
    };

    const handleImport = async () => {
        if (!selectedFile) return;
        setImportStatus({ loading: true, message: "Reading file..." });

        try {
            const text = await selectedFile.text();
            const data = JSON.parse(text);
            setImportStatus({ loading: true, message: "Uploading to server..." });

            const res = await fetch("/api/admin/import", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(data),
            });

            const result = await res.json();
            if (res.ok) {
                setImportStatus({ loading: false, success: true, message: result.message, count: result.imported });
                setSelectedFile(null);
                loadData();
            } else {
                setImportStatus({ loading: false, success: false, message: result.error || "Import failed" });
            }
        } catch (err) {
            setImportStatus({ loading: false, success: false, message: err instanceof Error ? err.message : "Failed to parse JSON" });
        }
    };

    const tabs = [
        { id: "dashboard", label: "Dashboard", icon: Activity },
        { id: "server", label: "Server", icon: Server },
        { id: "users", label: "Users", icon: Users },
        { id: "import", label: "Import", icon: Upload },
        { id: "settings", label: "Settings", icon: Settings },
    ];

    // Login Form
    if (!isLoggedIn) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4 grid-bg">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-8 max-w-md w-full">
                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
                            <Shield className="w-8 h-8 text-black" />
                        </div>
                    </div>
                    <h1 className="text-2xl font-bold text-center gradient-text mb-2">Admin Panel</h1>
                    <p className="text-gray-400 text-center text-sm mb-6">Dracin Management System</p>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Username</label>
                            <input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="input-cyber" placeholder="admin" />
                        </div>
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Password</label>
                            <div className="relative">
                                <input type={showPassword ? "text" : "password"} value={password} onChange={(e) => setPassword(e.target.value)} className="input-cyber pr-12" placeholder="••••••••" />
                                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>
                        {loginError && <div className="p-3 bg-red-500/20 border border-red-500/50 rounded-lg text-red-400 text-sm flex items-center gap-2"><X className="w-4 h-4" /> {loginError}</div>}
                        <button type="submit" disabled={loginLoading} className="btn-primary w-full flex items-center justify-center gap-2">
                            {loginLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Lock className="w-5 h-5" />} Login
                        </button>
                    </form>
                </motion.div>
            </div>
        );
    }

    // Admin Dashboard
    return (
        <div className="min-h-screen flex">
            {/* Sidebar */}
            <aside className="w-64 glass-card border-0 border-r min-h-screen p-4 hidden md:block">
                <div className="flex items-center gap-3 mb-8 px-2">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-black" />
                    </div>
                    <div><h2 className="font-bold">Admin</h2><p className="text-xs text-gray-500">Dracin</p></div>
                </div>

                <nav className="space-y-1">
                    {tabs.map((tab) => (
                        <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id === "server") loadServerStatus(); }} className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg transition-all ${activeTab === tab.id ? "bg-cyan-500/20 text-cyan-400" : "text-gray-400 hover:bg-white/5 hover:text-white"}`}>
                            <tab.icon className="w-5 h-5" /> {tab.label}
                        </button>
                    ))}
                </nav>

                <div className="absolute bottom-4 left-4 right-4">
                    <button onClick={handleLogout} className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-gray-400 hover:bg-red-500/20 hover:text-red-400 transition-all">
                        <LogOut className="w-5 h-5" /> Logout
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-6">
                {/* Mobile Header */}
                <div className="md:hidden flex items-center justify-between mb-6">
                    <h1 className="text-xl font-bold">Admin Panel</h1>
                    <button onClick={handleLogout} className="p-2 text-gray-400 hover:text-red-400"><LogOut className="w-5 h-5" /></button>
                </div>

                {/* Mobile Tabs */}
                <div className="md:hidden flex gap-2 mb-6 overflow-x-auto pb-2">
                    {tabs.map((tab) => (
                        <button key={tab.id} onClick={() => { setActiveTab(tab.id); if (tab.id === "server") loadServerStatus(); }} className={`flex items-center gap-2 px-4 py-2 rounded-lg whitespace-nowrap ${activeTab === tab.id ? "bg-cyan-500/20 text-cyan-400" : "bg-white/5 text-gray-400"}`}>
                            <tab.icon className="w-4 h-4" /> {tab.label}
                        </button>
                    ))}
                </div>

                {/* Dashboard Tab */}
                {activeTab === "dashboard" && (
                    <div>
                        <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="glass-card p-6">
                                <div className="flex items-center justify-between">
                                    <div><p className="text-sm text-gray-400">Total Users</p><p className="text-3xl font-bold gradient-text">{stats.totalUsers}</p></div>
                                    <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center"><Users className="w-6 h-6 text-cyan-400" /></div>
                                </div>
                            </motion.div>
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="glass-card p-6">
                                <div className="flex items-center justify-between">
                                    <div><p className="text-sm text-gray-400">Cached Dramas</p><p className="text-3xl font-bold gradient-text">{stats.totalDramas}</p></div>
                                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center"><Film className="w-6 h-6 text-purple-400" /></div>
                                </div>
                            </motion.div>
                            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="glass-card p-6">
                                <div className="flex items-center justify-between">
                                    <div><p className="text-sm text-gray-400">Total Videos</p><p className="text-3xl font-bold gradient-text">{stats.totalVideos}</p></div>
                                    <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center"><Database className="w-6 h-6 text-green-400" /></div>
                                </div>
                            </motion.div>
                        </div>
                    </div>
                )}

                {/* Server Tab */}
                {activeTab === "server" && (
                    <div>
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-2xl font-bold">Server Management</h2>
                            <button onClick={loadServerStatus} disabled={loadingServer} className="btn-secondary py-2 px-4 text-sm flex items-center gap-2">
                                <RefreshCw className={`w-4 h-4 ${loadingServer ? "animate-spin" : ""}`} /> Refresh
                            </button>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                            {/* Server Status */}
                            <div className="glass-card p-6">
                                <h3 className="font-semibold mb-4 flex items-center gap-2"><Activity className="w-5 h-5 text-cyan-400" /> Status Server</h3>
                                {loadingServer ? (
                                    <div className="flex items-center justify-center py-8"><Loader2 className="w-8 h-8 animate-spin text-cyan-400" /></div>
                                ) : serverStatus ? (
                                    <div className="space-y-3 text-sm">
                                        <div className="flex justify-between"><span className="text-gray-400">Status:</span><span className={serverStatus.isDownloading ? "text-green-400" : "text-yellow-400"}>{serverStatus.isDownloading ? "Downloading" : serverStatus.status}</span></div>
                                        <div className="flex justify-between"><span className="text-gray-400">Version:</span><span>{serverStatus.version || "N/A"}</span></div>
                                        {serverStatus.currentProcessing && <div className="flex justify-between"><span className="text-gray-400">Processing:</span><span className="text-cyan-400">Drama {serverStatus.currentProcessing}</span></div>}
                                        {serverStatus.currentVideo && <div className="flex justify-between"><span className="text-gray-400">Current:</span><span>{serverStatus.currentVideo}</span></div>}
                                        {serverStatus.system && (
                                            <>
                                                <div className="flex justify-between"><span className="text-gray-400">Disk Free:</span><span>{serverStatus.system.diskFree}</span></div>
                                                <div className="flex justify-between"><span className="text-gray-400">Memory:</span><span>{serverStatus.system.memory}</span></div>
                                                <div className="flex justify-between"><span className="text-gray-400">Uptime:</span><span>{serverStatus.system.uptime}</span></div>
                                            </>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-center py-4">Click Refresh to load</p>
                                )}
                            </div>

                            {/* Force Queue */}
                            <div className="glass-card p-6">
                                <h3 className="font-semibold mb-4 flex items-center gap-2"><Play className="w-5 h-5 text-green-400" /> Force Priority Download</h3>
                                <p className="text-sm text-gray-400 mb-4">Input Drama ID untuk memaksa download prioritas.</p>
                                <div className="flex gap-2">
                                    <input type="text" value={forceQueueId} onChange={(e) => setForceQueueId(e.target.value)} placeholder="Drama ID (contoh: 10600)" className="input-cyber flex-1" />
                                    <button onClick={handleForceQueue} disabled={forceQueueLoading || !forceQueueId.trim()} className="btn-primary px-4 flex items-center gap-2 disabled:opacity-50">
                                        {forceQueueLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />} Force
                                    </button>
                                </div>
                                {forceQueueResult && (
                                    <div className={`mt-3 p-3 rounded-lg text-sm ${forceQueueResult.success ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                                        {forceQueueResult.message}
                                    </div>
                                )}
                            </div>

                            {/* Current Queue */}
                            <div className="glass-card p-6">
                                <h3 className="font-semibold mb-4 flex items-center gap-2"><List className="w-5 h-5 text-purple-400" /> Antrian Download</h3>
                                {queueData ? (
                                    <div className="space-y-4 text-sm max-h-60 overflow-y-auto">
                                        {queueData.current && (
                                            <div className="p-3 bg-green-500/10 border border-green-500/30 rounded-lg">
                                                <div className="text-green-400 font-medium mb-1">🔄 Sedang Download</div>
                                                <div className="text-white">{queueData.current.title}</div>
                                                <div className="text-gray-400 text-xs">{queueData.current.video}</div>
                                            </div>
                                        )}
                                        {queueData.priorityQueue && queueData.priorityQueue.length > 0 && (
                                            <div>
                                                <div className="text-yellow-400 font-medium mb-2">⭐ Force Priority ({queueData.priorityQueue.length})</div>
                                                {queueData.priorityQueue.map((item, idx) => (
                                                    <div key={idx} className="p-2 bg-yellow-500/10 rounded mb-1 text-xs">{item.id}: {item.title}</div>
                                                ))}
                                            </div>
                                        )}
                                        {queueData.requestQueue && queueData.requestQueue.length > 0 && (
                                            <div>
                                                <div className="text-purple-400 font-medium mb-2">📥 Request Queue ({queueData.requestQueue.length})</div>
                                                {queueData.requestQueue.map((item, idx) => (
                                                    <div key={idx} className="p-2 bg-purple-500/10 rounded mb-1 text-xs">{item.id}: {item.title}</div>
                                                ))}
                                            </div>
                                        )}
                                        {queueData.upcoming && queueData.upcoming.length > 0 && (
                                            <div>
                                                <div className="text-gray-400 font-medium mb-2">📋 Antrian Berikutnya ({queueData.totalQueued || 0} total)</div>
                                                {queueData.upcoming.slice(0, 10).map((item, idx) => (
                                                    <div key={idx} className="p-2 bg-white/5 rounded mb-1 text-xs">{item.id}: {item.title} ({item.episodes} eps)</div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-center py-4">Click Refresh to load</p>
                                )}
                            </div>

                            {/* Ready Films */}
                            <div className="glass-card p-6">
                                <h3 className="font-semibold mb-4 flex items-center gap-2"><Download className="w-5 h-5 text-cyan-400" /> Video Ready ({readyFilms.length})</h3>
                                {readyFilms.length > 0 ? (
                                    <div className="space-y-2 text-sm max-h-60 overflow-y-auto">
                                        {readyFilms.slice(0, 20).map((film, idx) => (
                                            <div key={idx} className="flex justify-between items-center p-2 bg-white/5 rounded">
                                                <div>
                                                    <div className="font-medium text-sm">{film.title}</div>
                                                    <div className="text-xs text-cyan-400 font-mono">ID: {film.dramaId}</div>
                                                </div>
                                                <span className="text-gray-400 text-xs">{film.episodeCount} eps</span>
                                            </div>
                                        ))}
                                        {readyFilms.length > 20 && <div className="text-gray-500 text-center text-xs">...dan {readyFilms.length - 20} lainnya</div>}
                                    </div>
                                ) : (
                                    <p className="text-gray-500 text-center py-4">{loadingServer ? "Loading..." : "No ready films yet"}</p>
                                )}
                            </div>
                        </div>
                    </div>
                )}

                {/* Users Tab */}
                {activeTab === "users" && (
                    <div>
                        <h2 className="text-2xl font-bold mb-6">User Management</h2>
                        <div className="glass-card">
                            <div className="p-4 border-b border-white/10 flex items-center justify-between">
                                <span className="text-gray-400">{users.length} users</span>
                                <button onClick={loadData} className="btn-secondary py-2 px-4 text-sm"><RefreshCw className="w-4 h-4" /></button>
                            </div>
                            <table className="w-full">
                                <thead><tr className="border-b border-white/10"><th className="text-left p-4 text-sm text-gray-400">User</th><th className="text-left p-4 text-sm text-gray-400">Role</th><th className="text-left p-4 text-sm text-gray-400">Joined</th></tr></thead>
                                <tbody>
                                    {users.map((user) => (
                                        <tr key={user.id} className="border-b border-white/5">
                                            <td className="p-4"><div><p className="font-medium">{user.display_name || "No name"}</p><p className="text-sm text-gray-500">{user.email}</p></div></td>
                                            <td className="p-4"><span className="px-3 py-1 rounded-full text-xs bg-cyan-500/20 text-cyan-400">{user.role}</span></td>
                                            <td className="p-4 text-sm text-gray-400">{new Date(user.created_at).toLocaleDateString()}</td>
                                        </tr>
                                    ))}
                                    {users.length === 0 && <tr><td colSpan={3} className="p-8 text-center text-gray-500">No users found</td></tr>}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* Import Tab */}
                {activeTab === "import" && (
                    <div>
                        <h2 className="text-2xl font-bold mb-6">Import Data dari JSON</h2>
                        <div className="glass-card p-6 max-w-xl">
                            <p className="text-gray-400 mb-6">Upload file JSON dari automation script.</p>
                            <div className="mb-6">
                                <input ref={fileInputRef} type="file" accept=".json" onChange={handleFileSelect} className="hidden" />
                                <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer hover:border-cyan-500/50 transition-colors">
                                    {selectedFile ? (
                                        <div className="flex items-center justify-center gap-3"><FileJson className="w-8 h-8 text-cyan-400" /><div className="text-left"><p className="font-medium">{selectedFile.name}</p><p className="text-sm text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p></div></div>
                                    ) : (
                                        <><Upload className="w-10 h-10 text-gray-500 mx-auto mb-3" /><p className="text-gray-400">Klik untuk pilih file JSON</p></>
                                    )}
                                </div>
                            </div>
                            <button onClick={handleImport} disabled={!selectedFile || importStatus.loading} className="btn-primary flex items-center gap-2 disabled:opacity-50">
                                {importStatus.loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Upload className="w-5 h-5" />} Import
                            </button>
                            {importStatus.message && (
                                <div className={`mt-4 p-4 rounded-lg flex items-center gap-3 ${importStatus.success ? "bg-green-500/20 text-green-400" : "bg-red-500/20 text-red-400"}`}>
                                    {importStatus.success ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />} {importStatus.message}
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* Settings Tab */}
                {activeTab === "settings" && (
                    <div>
                        <h2 className="text-2xl font-bold mb-6">Settings</h2>
                        <div className="glass-card p-6 max-w-xl">
                            <div className="space-y-4">
                                <div><label className="block text-sm text-gray-400 mb-2">Site Name</label><input type="text" defaultValue="Dracin" className="input-cyber" /></div>
                                <div><label className="block text-sm text-gray-400 mb-2">Site Description</label><textarea defaultValue="Stream your favorite Asian dramas" className="input-cyber min-h-[100px]" /></div>
                                <button className="btn-primary">Save Settings</button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
