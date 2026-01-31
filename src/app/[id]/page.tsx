"use client";

import { use, useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Play, X, Video, Download, Loader2, ArrowLeft, AlertCircle, Film } from "lucide-react";
import Link from "next/link";

interface Video {
    episode: number;
    ready: boolean;
    messageId?: number;
    duration?: number;
    size?: number;
}

interface Drama {
    id: string;
    title: string;
    poster_url?: string;
    total_episodes?: number;
}

export default function DramaDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = use(params);
    const [drama, setDrama] = useState<Drama | null>(null);
    const [videos, setVideos] = useState<Video[]>([]);
    const [loading, setLoading] = useState(true);
    const [playingEpisode, setPlayingEpisode] = useState<number | null>(null);
    const [videoMessage, setVideoMessage] = useState("");

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            try {
                // Fetch drama info from Supabase via API
                const dramaRes = await fetch(`/api/dramas?id=${id}`);
                const dramaData = await dramaRes.json();
                if (dramaData.dramas && dramaData.dramas.length > 0) {
                    setDrama(dramaData.dramas[0]);
                } else {
                    setDrama({ id, title: `Drama ${id}` });
                }

                // Fetch video availability from EC2
                const videoRes = await fetch(`/api/dramas/${id}`);
                const videoData = await videoRes.json();
                if (videoData.videos) {
                    setVideos(videoData.videos);
                }
                if (videoData.message) {
                    setVideoMessage(videoData.message);
                }
            } catch (e) {
                console.error(e);
                setVideoMessage("Gagal memuat data video.");
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [id]);

    const formatSize = (bytes: number) => {
        if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
        return `${(bytes / (1024 * 1024)).toFixed(0)} MB`;
    };

    if (loading) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900">
                <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900/20 to-slate-900 text-white">
            <div className="max-w-4xl mx-auto px-4 py-6">
                {/* Header */}
                <div className="flex items-start gap-4 mb-6">
                    <Link href="/" className="p-2 hover:bg-white/10 rounded-lg transition-colors">
                        <ArrowLeft className="w-6 h-6" />
                    </Link>
                    {drama?.poster_url && (
                        <div className="w-20 h-28 rounded-lg overflow-hidden flex-shrink-0 hidden sm:block">
                            <img src={drama.poster_url} alt={drama.title} className="w-full h-full object-cover" />
                        </div>
                    )}
                    <div className="flex-1 min-w-0">
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-cyan-400 to-purple-400 bg-clip-text text-transparent truncate">
                            {drama?.title || `Drama ${id}`}
                        </h1>
                        <p className="text-sm text-gray-400">ID: {id} • {videos.length} Episode</p>
                    </div>
                </div>

                {/* Video Player Area */}
                {playingEpisode && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 rounded-xl overflow-hidden bg-black aspect-video relative"
                    >
                        {drama?.poster_url && (
                            <div className="absolute inset-0 opacity-20 blur-md bg-cover bg-center" style={{ backgroundImage: `url(${drama.poster_url})` }} />
                        )}
                        <div className="relative z-10 flex flex-col items-center justify-center h-full">
                            <Play className="w-16 h-16 text-cyan-400 mb-4 animate-pulse" />
                            <h3 className="text-xl font-bold mb-2">Episode {playingEpisode} siap</h3>
                            <p className="text-gray-300 text-sm mb-6 max-w-xs text-center">Klik tombol di bawah untuk memutar video.</p>
                            <Link
                                href={`/watch/${id}/${playingEpisode}`}
                                target="_blank"
                                className="bg-gradient-to-r from-cyan-500 to-purple-500 text-black font-bold py-3 px-8 rounded-xl flex items-center gap-2 hover:scale-105 transition-transform"
                            >
                                <Play className="w-5 h-5 fill-current" /> Putar Sekarang
                            </Link>
                        </div>
                    </motion.div>
                )}

                {/* Error/Info Message */}
                {videoMessage && videos.length === 0 && (
                    <div className="mb-4 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg text-yellow-400 text-sm flex items-center gap-2">
                        <AlertCircle className="w-5 h-5 flex-shrink-0" />
                        {videoMessage}
                    </div>
                )}

                {/* Episode List */}
                <div className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4">
                    <h2 className="font-semibold text-gray-300 flex items-center gap-2 mb-4">
                        <Video className="w-4 h-4 text-cyan-400" />
                        Daftar Episode
                    </h2>

                    {videos.length === 0 ? (
                        <div className="text-center py-10">
                            <Film className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                            <p className="text-gray-500 mb-2">Video belum tersedia di server.</p>
                            <p className="text-xs text-gray-600">Drama ini belum pernah di-download atau masih dalam antrian.</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                            {videos.map((video) => (
                                <div
                                    key={video.episode}
                                    className={`p-3 rounded-lg transition-all cursor-pointer ${playingEpisode === video.episode ? "bg-cyan-500/30 border border-cyan-500" : "bg-white/5 hover:bg-white/10"}`}
                                    onClick={() => video.ready && setPlayingEpisode(video.episode)}
                                >
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="font-medium text-sm">Ep {video.episode}</span>
                                        {video.ready && <span className="text-xs text-green-400">✓ Ready</span>}
                                    </div>
                                    {video.size && <p className="text-xs text-gray-500 mb-2">{formatSize(video.size)}</p>}
                                    <div className="flex flex-col gap-1">
                                        {video.ready ? (
                                            <>
                                                <Link
                                                    href={`/watch/${id}/${video.episode}`}
                                                    target="_blank"
                                                    className="w-full py-1.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-xs flex items-center justify-center gap-1"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <Play className="w-3 h-3" /> Play (Fast)
                                                </Link>
                                                <a
                                                    href={`/api/dramas/${id}/download/${video.episode}`}
                                                    download
                                                    className="w-full py-1.5 rounded bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs flex items-center justify-center gap-1"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <Download className="w-3 h-3" /> Download
                                                </a>
                                            </>
                                        ) : (
                                            <button className="w-full py-1.5 rounded bg-yellow-500/20 text-yellow-400 text-xs flex items-center justify-center gap-1 cursor-not-allowed opacity-60">
                                                <Play className="w-3 h-3" /> Belum Tersedia
                                            </button>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
