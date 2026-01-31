"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Play, Film, Loader2, X, LogIn, Clock, Download } from "lucide-react";
import Link from "next/link";

interface Drama {
  id: string;
  title: string;
  poster_url?: string;
}

interface Video {
  messageId: number;
  title: string;
  episode: number;
  size: number;
  duration: number;
}

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [dramas, setDramas] = useState<Drama[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDrama, setSelectedDrama] = useState<Drama | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [playingVideo, setPlayingVideo] = useState<number | null>(null);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [page, setPage] = useState(1);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Debounced search
  const handleQueryChange = (value: string) => {
    setQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (value.length >= 2) {
        setPage(1);
        fetchDramas(value, 1);
      } else if (value.length === 0) {
        setPage(1);
        fetchDramas("", 1);
      }
    }, 200); // Faster debounce
  };

  const fetchDramas = useCallback(async (searchQuery = "", pageNum = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      params.set("page", pageNum.toString());
      params.set("limit", "24");

      const res = await fetch(`/api/dramas?${params}`);
      const data = await res.json();

      if (pageNum === 1) {
        setDramas(data.dramas || []);
      } else {
        setDramas(prev => [...prev, ...(data.dramas || [])]);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDramas("", 1);
  }, [fetchDramas]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchDramas(query, 1);
  };

  const loadMore = () => {
    const nextPage = page + 1;
    setPage(nextPage);
    fetchDramas(query, nextPage);
  };

  const selectDrama = async (drama: Drama) => {
    setSelectedDrama(drama);
    setLoadingVideos(true);
    setVideos([]);
    setPlayingVideo(null);

    try {
      const res = await fetch(`/api/dramas/${drama.id}`);
      const data = await res.json();
      setVideos(data.videos || []);

      // Auto-play first video if available
      if (data.videos && data.videos.length > 0) {
        setPlayingVideo(data.videos[0].messageId);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingVideos(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (!bytes || bytes === 0) return "";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-card border-0 border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
              <Film className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-2xl font-bold gradient-text">Dracin</h1>
          </Link>

          <Link
            href="/login"
            className="flex items-center gap-2 btn-secondary py-2 px-4 text-sm"
          >
            <LogIn className="w-4 h-4" />
            <span className="hidden sm:inline">Login</span>
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <section className="py-10 px-4">
        <div className="container mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-4xl font-bold mb-4"
          >
            Stream <span className="gradient-text">Asian Dramas</span>
          </motion.h2>

          {/* Search Bar - FIXED ICON */}
          <motion.form
            onSubmit={handleSearch}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="max-w-xl mx-auto relative"
          >
            <div className="relative">
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => handleQueryChange(e.target.value)}
                placeholder="Cari judul drama..."
                className="input-cyber w-full py-4 px-5 pr-28 text-lg"
              />
              {/* Search button */}
              <button
                type="submit"
                className="btn-primary absolute right-2 top-1/2 -translate-y-1/2 py-2 px-5 flex items-center gap-2"
                disabled={loading}
              >
                {loading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Search className="w-4 h-4" />
                    <span className="hidden sm:inline">Cari</span>
                  </>
                )}
              </button>
            </div>
            {query.length > 0 && query.length < 2 && (
              <p className="text-xs text-gray-500 mt-2">Ketik minimal 2 karakter</p>
            )}
          </motion.form>
        </div>
      </section>

      {/* Content */}
      <section className="px-4 pb-16">
        <div className="container mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Film className="w-5 h-5 text-cyan-400" />
              {query ? `Hasil: "${query}"` : "Drama Terbaru"}
              {dramas.length > 0 && (
                <span className="text-sm text-gray-500 font-normal">
                  ({dramas.length})
                </span>
              )}
            </h3>
          </div>

          {loading && dramas.length === 0 ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
            </div>
          ) : dramas.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <Film className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Tidak ada drama ditemukan.</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {dramas.map((drama, index) => (
                  <motion.div
                    key={`${drama.id}-${index}`}
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: Math.min(index * 0.02, 0.2) }}
                    onClick={() => selectDrama(drama)}
                    className="glass-card p-2 cursor-pointer group hover:border-cyan-500/50"
                  >
                    <div className="aspect-[3/4] relative rounded-lg overflow-hidden mb-2 bg-gradient-to-br from-purple-900/50 to-cyan-900/50">
                      {drama.poster_url ? (
                        <img
                          src={drama.poster_url}
                          alt={drama.title}
                          className="w-full h-full object-cover transition-transform group-hover:scale-105"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film className="w-8 h-8 text-cyan-400/30" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-3">
                        <Play className="w-8 h-8 text-white drop-shadow-lg" />
                      </div>
                    </div>
                    <h4 className="font-medium text-xs line-clamp-2 group-hover:text-cyan-400 transition-colors px-1 leading-tight">
                      {drama.title}
                    </h4>
                  </motion.div>
                ))}
              </div>

              <div className="mt-8 text-center">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="btn-secondary px-8"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Load More"}
                </button>
              </div>
            </>
          )}
        </div>
      </section>

      {/* Video Modal */}
      <AnimatePresence>
        {selectedDrama && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/95 overflow-y-auto"
            onClick={() => {
              setSelectedDrama(null);
              setPlayingVideo(null);
            }}
          >
            <div className="min-h-screen py-8 px-4">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="max-w-5xl mx-auto"
              >
                {/* Header */}
                <div className="flex items-start gap-4 mb-6">
                  {selectedDrama.poster_url && (
                    <div className="w-20 h-28 rounded-lg overflow-hidden flex-shrink-0 hidden sm:block">
                      <img
                        src={selectedDrama.poster_url}
                        alt={selectedDrama.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl sm:text-2xl font-bold gradient-text mb-1 truncate">
                      {selectedDrama.title}
                    </h3>
                    <p className="text-sm text-gray-400">
                      ID: {selectedDrama.id} • {videos.length} Episode
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedDrama(null);
                      setPlayingVideo(null);
                    }}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Video Player */}
                {playingVideo && (
                  <div className="video-container mb-6 rounded-xl overflow-hidden border border-cyan-500/30">
                    <video
                      key={playingVideo}
                      src={`/api/stream/${playingVideo}`}
                      controls
                      autoPlay
                      playsInline
                      className="w-full h-full bg-black"
                    />
                  </div>
                )}

                {/* Episode List */}
                <div className="glass-card p-4 rounded-xl">
                  <h4 className="font-semibold mb-4 text-gray-300 flex items-center gap-2">
                    <Play className="w-4 h-4 text-cyan-400" />
                    Daftar Episode
                  </h4>

                  {loadingVideos ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                    </div>
                  ) : videos.length === 0 ? (
                    <div className="text-center py-10">
                      <p className="text-gray-500 mb-2">
                        Belum ada episode yang tersedia.
                      </p>
                      <p className="text-xs text-gray-600">
                        Drama ini belum pernah di-trigger dari Telegram.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
                      {videos.map((video) => (
                        <button
                          key={video.messageId}
                          onClick={() => setPlayingVideo(video.messageId)}
                          className={`p-3 rounded-lg text-left transition-all ${playingVideo === video.messageId
                              ? "bg-cyan-500/30 border border-cyan-500"
                              : "bg-white/5 hover:bg-white/10 border border-transparent"
                            }`}
                        >
                          <div className="flex items-center gap-2 mb-1">
                            <Play className={`w-3 h-3 ${playingVideo === video.messageId ? "text-cyan-400" : "text-gray-400"}`} />
                            <span className="font-medium text-sm">{video.title}</span>
                          </div>
                          <div className="flex items-center gap-2 text-xs text-gray-500">
                            {video.duration > 0 && (
                              <span className="flex items-center gap-1">
                                <Clock className="w-3 h-3" />
                                {formatDuration(video.duration)}
                              </span>
                            )}
                            {video.size > 0 && (
                              <span>{formatSize(video.size)}</span>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
