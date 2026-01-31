"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    Users,
    Film,
    Settings,
    LogOut,
    Search,
    Trash2,
    Shield,
    Activity,
} from "lucide-react";

interface User {
    id: string;
    email: string;
    display_name: string;
    role: string;
    created_at: string;
}

export default function AdminPage() {
    const [activeTab, setActiveTab] = useState("users");
    const [users, setUsers] = useState<User[]>([]);
    const [stats, setStats] = useState({
        totalUsers: 0,
        totalDramas: 0,
        activeToday: 0,
    });

    // Mock data for demo
    useEffect(() => {
        setUsers([
            {
                id: "1",
                email: "user1@example.com",
                display_name: "John Doe",
                role: "user",
                created_at: new Date().toISOString(),
            },
            {
                id: "2",
                email: "admin@example.com",
                display_name: "Admin User",
                role: "admin",
                created_at: new Date().toISOString(),
            },
        ]);
        setStats({
            totalUsers: 150,
            totalDramas: 420,
            activeToday: 45,
        });
    }, []);

    const tabs = [
        { id: "users", label: "Users", icon: Users },
        { id: "content", label: "Content", icon: Film },
        { id: "settings", label: "Settings", icon: Settings },
    ];

    return (
        <div className="min-h-screen flex">
            {/* Sidebar */}
            <aside className="w-64 glass-card border-0 border-r min-h-screen p-6">
                <div className="flex items-center gap-3 mb-10">
                    <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
                        <Shield className="w-5 h-5 text-black" />
                    </div>
                    <div>
                        <h1 className="text-lg font-bold gradient-text">Admin Panel</h1>
                        <p className="text-xs text-gray-500">Dracin Management</p>
                    </div>
                </div>

                <nav className="space-y-2">
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

                <div className="absolute bottom-6 left-6 right-6">
                    <button className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-red-400 hover:bg-red-500/10 transition-all">
                        <LogOut className="w-5 h-5" />
                        <span>Logout</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-8">
                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
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
                                <p className="text-sm text-gray-400">Total Dramas</p>
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
                                <p className="text-sm text-gray-400">Active Today</p>
                                <p className="text-3xl font-bold gradient-text">{stats.activeToday}</p>
                            </div>
                            <div className="w-12 h-12 rounded-xl bg-green-500/20 flex items-center justify-center">
                                <Activity className="w-6 h-6 text-green-400" />
                            </div>
                        </div>
                    </motion.div>
                </div>

                {/* Users Tab */}
                {activeTab === "users" && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="glass-card"
                    >
                        <div className="p-6 border-b border-white/10 flex items-center justify-between">
                            <h2 className="text-xl font-semibold">User Management</h2>
                            <div className="relative">
                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                                <input
                                    type="text"
                                    placeholder="Search users..."
                                    className="input-cyber pl-10 py-2 text-sm w-64"
                                />
                            </div>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full">
                                <thead>
                                    <tr className="border-b border-white/10">
                                        <th className="text-left p-4 text-sm text-gray-400">User</th>
                                        <th className="text-left p-4 text-sm text-gray-400">Role</th>
                                        <th className="text-left p-4 text-sm text-gray-400">Joined</th>
                                        <th className="text-right p-4 text-sm text-gray-400">Actions</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {users.map((user) => (
                                        <tr key={user.id} className="border-b border-white/5 hover:bg-white/5">
                                            <td className="p-4">
                                                <div>
                                                    <p className="font-medium">{user.display_name}</p>
                                                    <p className="text-sm text-gray-500">{user.email}</p>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span
                                                    className={`px-3 py-1 rounded-full text-xs ${user.role === "admin"
                                                            ? "bg-purple-500/20 text-purple-400"
                                                            : "bg-cyan-500/20 text-cyan-400"
                                                        }`}
                                                >
                                                    {user.role}
                                                </span>
                                            </td>
                                            <td className="p-4 text-sm text-gray-400">
                                                {new Date(user.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="p-4 text-right">
                                                <button className="p-2 hover:bg-red-500/20 rounded-lg transition-colors text-red-400">
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </motion.div>
                )}

                {/* Content Tab */}
                {activeTab === "content" && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="glass-card p-6"
                    >
                        <h2 className="text-xl font-semibold mb-4">Content Management</h2>
                        <p className="text-gray-400">Manage dramas and video content from here.</p>
                        {/* TODO: Content management UI */}
                    </motion.div>
                )}

                {/* Settings Tab */}
                {activeTab === "settings" && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="glass-card p-6"
                    >
                        <h2 className="text-xl font-semibold mb-6">Settings</h2>

                        <div className="space-y-6">
                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Site Name</label>
                                <input
                                    type="text"
                                    defaultValue="Dracin"
                                    className="input-cyber max-w-md"
                                />
                            </div>

                            <div>
                                <label className="block text-sm text-gray-400 mb-2">Maintenance Mode</label>
                                <button className="btn-secondary">
                                    Currently: OFF
                                </button>
                            </div>

                            <div>
                                <button className="btn-primary">Save Settings</button>
                            </div>
                        </div>
                    </motion.div>
                )}
            </main>
        </div>
    );
}
