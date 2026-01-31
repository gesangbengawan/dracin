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
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalDramas: 0,
        totalVideos: 0,
    });

    const fileInputRef = useRef<HTMLInputElement>(null);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);

    // Check session on mount
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

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) {
            setSelectedFile(file);
        }
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
                setImportStatus({
                    loading: false,
                    success: true,
                    message: result.message,
                    count: result.imported,
                });
                setSelectedFile(null);
                loadData();
            } else {
                setImportStatus({
                    loading: false,
                    success: false,
                    message: result.error || "Import failed",
                });
            }
        } catch (err) {
            setImportStatus({
                loading: false,
                success: false,
                message: err instanceof Error ? err.message : "Failed to parse JSON",
            });
        }
    };

    const tabs = [
        { id: "dashboard", label: "Dashboard", icon: Activity },
        { id: "users", label: "Users", icon: Users },
        { id: "import", label: "Import Data", icon: Upload },
        { id: "settings", label: "Settings", icon: Settings },
    ];

    // Login Form
    if (!isLoggedIn) {
        return (
            <div className="min-h-screen flex items-center justify-center px-4 grid-bg">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="glass-card p-8 max-w-md w-full"
                >
                    <div className="flex justify-center mb-6">
                        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
                            <Shield className="w-8 h-8 text-black" />
                        </div>
                    </div>

                    <h1 className="text-2xl font-bold text-center gradient-text mb-2">
                        Admin Panel
                    </h1>
                    <p className="text-gray-400 text-center text-sm mb-6">
                        Dracin Management System
                    </p>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Username</label>
                            <input
                                type="text"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                                className="input-cyber"
                                placeholder="Enter username"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-sm text-gray-400 mb-2">Password</label>
                            <div className="relative">
                                <input
                                    type={showPassword ? "text" : "password"}
                                    value={password}
                                    onChange={(e) => setPassword(e.target.value)}
                                    className="input-cyber pr-12"
                                    placeholder="Enter password"
                                    required
                                />
                                <button
                                    type="button"
                                    onClick={() => setShowPassword(!showPassword)}
                                    className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400"
                                >
                                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                                </button>
                            </div>
                        </div>

                        {loginError && (
                            <p className="text-red-400 text-sm text-center">{loginError}</p>
                        )}

                        <button
                            type="submit"
                            className="btn-primary w-full flex items-center justify-center gap-2"
                            disabled={loginLoading}
                        >
                            {loginLoading ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <Lock className="w-4 h-4" />
                                    Login
                                </>
                            )}
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
            <aside className="w-64 glass-card border-0 border-r min-h-screen p-6 flex flex-col">
                <div className="flex items-center gap-3 mb-10">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-black" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold gradient-text">Admin</h1>
                        <p className="text-xs text-gray-500">Dracin Panel</p>
                    </div>
                </div>

                <nav className="space-y-2 flex-1">
                    {tabs.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeTab === tab.id
                                    ? "bg-cyan-500/20 text-cyan-400 border border-cyan-500/50"
                                    : "hover:bg-white/5 text-gray-400"
                                }`}
                        >
                            <tab.icon className="w-5 h-5" />
                            <span>{tab.label}</span>
                        </button>
                    ))}
                </nav>

                <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all"
                >
                    <LogOut className="w-5 h-5" />
                    <span>Logout</span>
                </button>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8">
                {/* Dashboard Tab */}
                {activeTab === "dashboard" && (
                    <div>
                        <h2 className="text-2xl font-bold mb-6">Dashboard</h2>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="glass-card p-6"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-400">Total Users</p>
                                        <p className="text-3xl font-bold gradient-text">{stats.totalUsers}</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-cyan-500/20 flex items-center justify-center">
                                        <Users className="w-6 h-6 text-cyan-400" />
                                    </div>
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.1 }}
                                className="glass-card p-6"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-400">Cached Dramas</p>
                                        <p className="text-3xl font-bold gradient-text">{stats.totalDramas}</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                                        <Film className="w-6 h-6 text-purple-400" />
                                    </div>
                                </div>
                            </motion.div>

                            <motion.div
                                initial={{ opacity: 0, y: 20 }}
                                animate={{ opacity: 1, y: 0 }}
                                transition={{ delay: 0.2 }}
                                className="glass-card p-6"
                            >
                                <div className="flex items-center justify-between">
                                    <div>
                                        <p className="text-sm text-gray-400">Total Videos</p>
                                        <p className="text-3xl font-bold gradient-text">{stats.totalVideos}</p>
                                    </div>
                                    <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                                        <Database className="w-6 h-6 text-green-400" />
                                    </div>
                                </div>
                            </motion.div>
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
                                <button onClick={loadData} className="btn-secondary py-2 px-4 text-sm">
                                    <RefreshCw className="w-4 h-4" />
                                </button>
                            </div>
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th className="text-left p-4 text-sm text-gray-400">User</th>
                                        <th className="text-left p-4 text-sm text-gray-400">Role</th>
                                        <th className="text-left p-4 text-sm text-gray-400">Joined</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user) => (
                                        <tr key={user.id} className="border-b border-white/5">
                                            <td className="p-4">
                                                <div>
                                                    <p className="font-medium">{user.display_name || "No name"}</p>
                                                    <p className="text-sm text-gray-500">{user.email}</p>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className="px-3 py-1 rounded-full text-xs bg-cyan-500/20 text-cyan-400">
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm text-gray-400">
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </td>
                                        </tr>
                                    ))}
                                    {users.length === 0 && (
                                        <tr>
                                            <td colSpan={3} className="p-8 text-center text-gray-500">
                                                No users found
                                            </td>
                                        </tr>
                                    )}
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
                            <p className="text-gray-400 mb-6">
                                Upload file JSON dari automation script (format: final_progress.json).
                                File harus berisi <code className="text-cyan-400">dramas_done</code> array.
                            </p>

                            {/* File Upload */}
                            <div className="mb-6">
                                <input
                                    ref={fileInputRef}
                                    type="file"
                                    accept=".json"
                                    onChange={handleFileSelect}
                                    className="hidden"
                                />

                                <div
                                    onClick={() => fileInputRef.current?.click()}
                                    className="border-2 border-dashed border-white/20 rounded-xl p-8 text-center cursor-pointer hover:border-cyan-500/50 transition-colors"
                                >
                                    {selectedFile ? (
                                        <div className="flex items-center justify-center gap-3">
                                            <FileJson className="w-8 h-8 text-cyan-400" />
                                            <div className="text-left">
                                                <p className="font-medium">{selectedFile.name}</p>
                                                <p className="text-sm text-gray-500">
                                                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                                                </p>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <Upload className="w-10 h-10 text-gray-500 mx-auto mb-3" />
                                            <p className="text-gray-400">Klik untuk pilih file JSON</p>
                                            <p className="text-xs text-gray-600 mt-1">atau drag & drop</p>
                                        </>
                                    )}
                                </div>
                            </div>

                            {/* Import Button */}
                            <button
                                onClick={handleImport}
                                disabled={!selectedFile || importStatus.loading}
                                className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                {importStatus.loading ? (
                                    <Loader2 className="w-5 h-5 animate-spin" />
                                ) : (
                                    <Upload className="w-5 h-5" />
                                )}
                                Import Data
                            </button>

                            {/* Status */}
                            {importStatus.message && (
                                <div
                                    className={`mt-4 p-4 rounded-lg flex items-center gap-3 ${importStatus.success
                                            ? "bg-green-500/20 text-green-400"
                                            : "bg-red-500/20 text-red-400"
                                        }`}
                                >
                                    {importStatus.success ? <Check className="w-5 h-5" /> : <X className="w-5 h-5" />}
                                    <span>{importStatus.message}</span>
                                    {importStatus.count !== undefined && (
                                        <span className="ml-auto font-bold">{importStatus.count} dramas</span>
                                    )}
                                </div>
                            )}

                            {/* Instructions */}
                            <div className="mt-6 p-4 bg-white/5 rounded-lg">
                                <h4 className="font-medium text-cyan-400 mb-2">Format JSON:</h4>
                                <pre className="text-xs text-gray-400 overflow-x-auto">
                                    {`{
  "dramas_done": [
    { "id": "10600", "title": "...", "episodes": 4 },
    { "id": "10599", "title": "...", "episodes": 3 }
  ],
  "total_videos": 38717
}`}
                                </pre>
                            </div>
                        </div>
                    </div>
                )}

                {/* Settings Tab */}
                {activeTab === "settings" && (
                    <div>
                        <h2 className="text-2xl font-bold mb-6">Settings</h2>
                        <div className="glass-card p-6 max-w-xl">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Site Name</label>
                                    <input type="text" defaultValue="Dracin" className="input-cyber" />
                                </div>
                                <div>
                                    <label className="block text-sm text-gray-400 mb-2">Site Description</label>
                                    <textarea
                                        defaultValue="Stream your favorite Asian dramas"
                                        className="input-cyber min-h-[100px]"
                                    />
                                </div>
                                <button className="btn-primary">Save Settings</button>
                            </div>
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
}
