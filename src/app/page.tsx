"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Play, Film, Loader2, X, LogIn, Clock, Download, ChevronLeft, ChevronRight } from "lucide-react";
import Link from "next/link";

interface Drama {
  id: string;
  title: string;
  poster_url?: string;
  total_episodes?: number;
}

interface Video {
  episode: number;
  title: string;
}

export default function HomePage() {
  const [query, setQuery] = useState("");
  const [dramas, setDramas] = useState<Drama[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDrama, setSelectedDrama] = useState<Drama | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDramas, setTotalDramas] = useState(0);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const ITEMS_PER_PAGE = 24;

  // Debounced search
  const handleQueryChange = (value: string) => {
    setQuery(value);

    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }

    searchTimeoutRef.current = setTimeout(() => {
      if (value.length >= 2) {
        setCurrentPage(1);
        fetchDramas(value, 1);
      } else if (value.length === 0) {
        setCurrentPage(1);
        fetchDramas("", 1);
      }
    }, 200);
  };

  const fetchDramas = useCallback(async (searchQuery = "", pageNum = 1) => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery) params.set("q", searchQuery);
      params.set("page", pageNum.toString());
      params.set("limit", ITEMS_PER_PAGE.toString());

      const res = await fetch(`/api/dramas?${params}`);
      const data = await res.json();

      setDramas(data.dramas || []);
      setTotalDramas(data.total || 0);
      setTotalPages(Math.ceil((data.total || 0) / ITEMS_PER_PAGE));
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
    setCurrentPage(1);
    fetchDramas(query, 1);
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    fetchDramas(query, page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selectDrama = async (drama: Drama) => {
    setSelectedDrama(drama);
    setLoadingVideos(true);
    setVideos([]);

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

  // Generate page numbers to display
  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    const maxVisible = 5;

    if (totalPages <= maxVisible + 2) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      pages.push(1);

      if (currentPage > 3) pages.push("...");

      const start = Math.max(2, currentPage - 1);
      const end = Math.min(totalPages - 1, currentPage + 1);

      for (let i = start; i <= end; i++) pages.push(i);

      if (currentPage < totalPages - 2) pages.push("...");

      pages.push(totalPages);
    }

    return pages;
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
              <span className="text-sm text-gray-500 font-normal">
                ({totalDramas} drama)
              </span>
            </h3>
            {!query && totalPages > 1 && (
              <span className="text-sm text-gray-500">
                Halaman {currentPage} dari {totalPages}
              </span>
            )}
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
                      {drama.total_episodes && (
                        <div className="absolute top-2 right-2 bg-black/70 text-xs px-2 py-1 rounded">
                          {drama.total_episodes} Eps
                        </div>
                      )}
                    </div>
                    <h4 className="font-medium text-xs line-clamp-2 group-hover:text-cyan-400 transition-colors px-1 leading-tight">
                      {drama.title}
                    </h4>
                  </motion.div>
                ))}
              </div>

              {/* Pagination */}
              {totalPages > 1 && !query && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <button
                    onClick={() => goToPage(currentPage - 1)}
                    disabled={currentPage === 1 || loading}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronLeft className="w-5 h-5" />
                  </button>

                  {getPageNumbers().map((page, idx) => (
                    typeof page === "number" ? (
                      <button
                        key={idx}
                        onClick={() => goToPage(page)}
                        disabled={loading}
                        className={`w-10 h-10 rounded-lg font-medium transition-all ${currentPage === page
                            ? "bg-cyan-500 text-black"
                            : "bg-white/5 hover:bg-white/10"
                          }`}
                      >
                        {page}
                      </button>
                    ) : (
                      <span key={idx} className="px-2 text-gray-500">...</span>
                    )
                  ))}

                  <button
                    onClick={() => goToPage(currentPage + 1)}
                    disabled={currentPage === totalPages || loading}
                    className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30 disabled:cursor-not-allowed"
                  >
                    <ChevronRight className="w-5 h-5" />
                  </button>
                </div>
              )}
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
            onClick={() => setSelectedDrama(null)}
          >
            <div className="min-h-screen py-8 px-4">
              <motion.div
                initial={{ scale: 0.95, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.95, opacity: 0 }}
                onClick={(e) => e.stopPropagation()}
                className="max-w-3xl mx-auto"
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
                    onClick={() => setSelectedDrama(null)}
                    className="p-2 hover:bg-white/10 rounded-lg transition-colors flex-shrink-0"
                  >
                    <X className="w-6 h-6" />
                  </button>
                </div>

                {/* Episode Info */}
                <div className="glass-card p-6 rounded-xl mb-4">
                  <div className="flex items-center gap-3 mb-4">
                    <Play className="w-5 h-5 text-cyan-400" />
                    <h4 className="font-semibold">Cara Menonton</h4>
                  </div>

                  <p className="text-gray-400 text-sm mb-4">
                    Drama ini memiliki <span className="text-cyan-400 font-bold">{videos.length}</span> episode.
                    Untuk menonton, kamu perlu trigger drama ini dari Telegram bot @IDShortBot.
                  </p>

                  <div className="bg-white/5 rounded-lg p-4">
                    <p className="text-xs text-gray-500 mb-2">Kirim ke Telegram:</p>
                    <code className="text-cyan-400 text-sm break-all">
                      /start playfirst-{selectedDrama.id}
                    </code>
                  </div>
                </div>

                {/* Episode List */}
                <div className="glass-card p-4 rounded-xl">
                  <h4 className="font-semibold mb-4 text-gray-300 flex items-center gap-2">
                    <Film className="w-4 h-4 text-cyan-400" />
                    Daftar Episode
                  </h4>

                  {loadingVideos ? (
                    <div className="flex justify-center py-10">
                      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin" />
                    </div>
                  ) : videos.length === 0 ? (
                    <div className="text-center py-10">
                      <p className="text-gray-500 mb-2">
                        Belum ada data episode.
                      </p>
                      <p className="text-xs text-gray-600">
                        Import data JSON terlebih dahulu dari Admin Panel.
                      </p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                      {videos.map((video) => (
                        <div
                          key={video.episode}
                          className="p-3 rounded-lg bg-white/5 text-center"
                        >
                          <span className="text-sm font-medium">Ep {video.episode}</span>
                        </div>
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
