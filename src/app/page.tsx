"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Play, Film, Loader2, X, User, LogIn } from "lucide-react";
import Link from "next/link";
import Image from "next/image";

interface Drama {
  id: string;
  title: string;
  poster_url?: string;
}

interface Video {
  messageId: number;
  title: string;
  size: number;
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
  const [searchTimeout, setSearchTimeout] = useState<NodeJS.Timeout | null>(null);

  // Debounced search
  const handleQueryChange = (value: string) => {
    setQuery(value);

    if (searchTimeout) clearTimeout(searchTimeout);

    const timeout = setTimeout(() => {
      if (value.length >= 2) {
        fetchDramas(value);
      } else if (value.length === 0) {
        fetchDramas("");
      }
    }, 300);

    setSearchTimeout(timeout);
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
    try {
      const res = await fetch(`/api/dramas/${drama.id}`);
      const data = await res.json();
      setVideos(data.videos || []);
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingVideos(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 B";
    const k = 1024;
    const sizes = ["B", "KB", "MB", "GB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
  };

  return (
    <div className="min-h-screen">
      {/* Header */}
      <header className="sticky top-0 z-50 glass-card border-0 border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
              <Film className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-2xl font-bold gradient-text">Dracin</h1>
          </div>

          {/* Login Button */}
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
      <section className="py-12 px-4">
        <div className="container mx-auto text-center">
          <motion.h2
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="text-3xl md:text-5xl font-bold mb-4"
          >
            Stream Your Favorite{" "}
            <span className="gradient-text">Asian Dramas</span>
          </motion.h2>
          <motion.p
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="text-gray-400 mb-8 max-w-xl mx-auto"
          >
            Search and watch dramas instantly. Fast & free streaming.
          </motion.p>

          {/* Search Bar */}
          <motion.form
            onSubmit={handleSearch}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="max-w-2xl mx-auto relative"
          >
            <Search className="absolute left-5 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => handleQueryChange(e.target.value)}
              placeholder="Ketik judul drama... (min. 2 karakter)"
              className="input-cyber pl-14 pr-32"
            />
            <button
              type="submit"
              className="btn-primary absolute right-2 top-1/2 -translate-y-1/2 py-2 px-6"
              disabled={loading}
            >
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Cari"}
            </button>
          </motion.form>
        </div>
      </section>

      {/* Content */}
      <section className="px-4 pb-16">
        <div className="container mx-auto">
          <h3 className="text-xl font-semibold mb-6 flex items-center gap-2">
            <Film className="w-5 h-5 text-cyan-400" />
            {query ? `Hasil: "${query}"` : "Drama Terbaru"}
            {dramas.length > 0 && (
              <span className="text-sm text-gray-500 font-normal">
                ({dramas.length} drama)
              </span>
            )}
          </h3>

          {loading && dramas.length === 0 ? (
            <div className="flex justify-center py-20">
              <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
            </div>
          ) : dramas.length === 0 ? (
            <div className="text-center py-20 text-gray-400">
              <Film className="w-16 h-16 mx-auto mb-4 opacity-50" />
              <p>Tidak ada drama ditemukan.</p>
              <p className="text-sm mt-2">Coba kata kunci lain!</p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {dramas.map((drama, index) => (
                  <motion.div
                    key={`${drama.id}-${index}`}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: Math.min(index * 0.03, 0.3) }}
                    onClick={() => selectDrama(drama)}
                    className="glass-card p-2 cursor-pointer group"
                  >
                    <div className="aspect-[3/4] relative rounded-lg overflow-hidden mb-2 bg-gradient-to-br from-purple-900/50 to-cyan-900/50">
                      {drama.poster_url ? (
                        <img
                          src={drama.poster_url}
                          alt={drama.title}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = "none";
                          }}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Film className="w-10 h-10 text-cyan-400/50" />
                        </div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-4">
                        <Play className="w-10 h-10 text-white" />
                      </div>
                    </div>
                    <h4 className="font-medium text-xs line-clamp-2 group-hover:text-cyan-400 transition-colors px-1">
                      {drama.title}
                    </h4>
                  </motion.div>
                ))}
              </div>

              {/* Load More */}
              <div className="mt-8 text-center">
                <button
                  onClick={loadMore}
                  disabled={loading}
                  className="btn-secondary"
                >
                  {loading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    "Load More"
                  )}
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
            className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
            onClick={() => {
              setSelectedDrama(null);
              setPlayingVideo(null);
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card w-full max-w-4xl max-h-[90vh] overflow-auto"
            >
              <div className="p-6">
                <div className="flex items-start gap-4 mb-6">
                  {/* Poster */}
                  {selectedDrama.poster_url && (
                    <div className="w-24 h-32 rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={selectedDrama.poster_url}
                        alt={selectedDrama.title}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  )}

                  <div className="flex-1">
                    <h3 className="text-2xl font-bold gradient-text mb-2">
                      {selectedDrama.title}
                    </h3>
                    <p className="text-sm text-gray-400">
                      ID: {selectedDrama.id}
                    </p>
                  </div>

                  <button
                    onClick={() => {
                      setSelectedDrama(null);
                      setPlayingVideo(null);
                    }}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Video Player */}
                {playingVideo && (
                  <div className="video-container mb-6 neon-border">
                    <video
                      src={`/api/stream/${playingVideo}`}
                      controls
                      autoPlay
                      className="w-full h-full"
                    />
                  </div>
                )}

                {/* Episode List */}
                <h4 className="font-semibold mb-4 text-gray-300">Episodes</h4>
                {loadingVideos ? (
                  <div className="flex justify-center py-10">
                    <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                  </div>
                ) : videos.length === 0 ? (
                  <div className="text-center py-10">
                    <p className="text-gray-500 mb-4">
                      Belum ada episode yang tersedia.
                    </p>
                    <p className="text-xs text-gray-600">
                      Video akan muncul setelah drama di-trigger dari Telegram.
                    </p>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
                    {videos.map((video) => (
                      <button
                        key={video.messageId}
                        onClick={() => setPlayingVideo(video.messageId)}
                        className={`p-4 rounded-xl text-left transition-all ${playingVideo === video.messageId
                            ? "bg-cyan-500/20 border border-cyan-500"
                            : "bg-white/5 hover:bg-white/10 border border-transparent"
                          }`}
                      >
                        <div className="flex items-center gap-2 mb-1">
                          <Play className="w-4 h-4 text-cyan-400" />
                          <span className="font-medium">{video.title}</span>
                        </div>
                        <span className="text-xs text-gray-500">
                          {formatSize(video.size)}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
