"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { Search, Play, Film, Loader2, X, LogIn, Download, ChevronLeft, ChevronRight, Video, User, LogOut, AlertCircle } from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase";

interface Drama {
  id: string;
  title: string;
  poster_url?: string;
  total_episodes?: number;
}

interface VideoItem {
  messageId?: number;
  episode: number;
  title?: string;
  size?: number;
  duration?: number;
  ready?: boolean;
  dramaId?: string;
}

function HomeContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const [query, setQuery] = useState("");
  const [dramas, setDramas] = useState<Drama[]>([]);
  const [loading, setLoading] = useState(false);
  const [selectedDrama, setSelectedDrama] = useState<Drama | null>(null);
  const [videos, setVideos] = useState<VideoItem[]>([]);
  const [loadingVideos, setLoadingVideos] = useState(false);
  const [playingVideo, setPlayingVideo] = useState<number | null>(null);
  const [playingEpisode, setPlayingEpisode] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalDramas, setTotalDramas] = useState(0);
  const [videoMessage, setVideoMessage] = useState("");
  const [user, setUser] = useState<any>(null);
  const [showPriorityConfirm, setShowPriorityConfirm] = useState(false);
  const [pendingVideo, setPendingVideo] = useState<VideoItem | null>(null);
  const [prioritizing, setPrioritizing] = useState(false);
  const [priorityStatus, setPriorityStatus] = useState<string | null>(null);
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const ITEMS_PER_PAGE = 24;
  const supabase = createClient();

  // Read page from URL on mount
  useEffect(() => {
    const pageParam = searchParams.get("page");
    if (pageParam) {
      const pageNum = parseInt(pageParam, 10);
      if (!isNaN(pageNum) && pageNum > 0) {
        setCurrentPage(pageNum);
        fetchDramas("", pageNum);
        return;
      }
    }
    fetchDramas("", 1);
  }, []);

  const handleQueryChange = (value: string) => {
    setQuery(value);
    if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
    searchTimeoutRef.current = setTimeout(() => {
      if (value.length >= 2) {
        setCurrentPage(1);
        updateURL(1);
        fetchDramas(value, 1);
      } else if (value.length === 0) {
        setCurrentPage(1);
        updateURL(1);
        fetchDramas("", 1);
      }
    }, 200);
  };

  // Update URL with page number
  const updateURL = (page: number) => {
    const url = new URL(window.location.href);
    if (page > 1) {
      url.searchParams.set("page", page.toString());
    } else {
      url.searchParams.delete("page");
    }
    router.replace(url.pathname + url.search, { scroll: false });
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

  // Check auth state
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, []);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    setUser(null);
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setCurrentPage(1);
    updateURL(1);
    fetchDramas(query, 1);
  };

  const goToPage = (page: number) => {
    if (page < 1 || page > totalPages) return;
    setCurrentPage(page);
    updateURL(page);
    fetchDramas(query, page);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const selectDrama = async (drama: Drama) => {
    setSelectedDrama(drama);
    setLoadingVideos(true);
    setVideos([]);
    setPlayingVideo(null);
    setPlayingEpisode(null);
    setVideoMessage("");
    setPriorityStatus(null);

    try {
      const res = await fetch(`/api/dramas/${drama.id}`);
      const data = await res.json();

      if (data.error) {
        setVideoMessage(data.message || data.error);
        return;
      }

      // Tag videos with dramaId for streaming
      const videosWithDramaId = (data.videos || []).map((v: VideoItem) => ({
        ...v,
        dramaId: drama.id,
      }));
      setVideos(videosWithDramaId);
      setVideoMessage(data.message || "");

      // Auto-play first episode if available and ready
      if (videosWithDramaId.length > 0) {
        const firstVideo = videosWithDramaId[0];
        if (firstVideo.ready) {
          setPlayingEpisode(firstVideo.episode);
          setPlayingVideo(null);
        }
      }
    } catch (err) {
      console.error(err);
      setVideoMessage("Gagal mengambil video dari server");
    } finally {
      setLoadingVideos(false);
    }
  };

  // Play video with priority confirmation for unready videos
  const playVideo = async (video: VideoItem) => {
    if (video.ready) {
      setPlayingEpisode(video.episode);
      setPlayingVideo(null);
    } else if (video.messageId) {
      setPendingVideo(video);
      setShowPriorityConfirm(true);
    }
  };

  // Confirm priority download and play
  const confirmPriority = async () => {
    if (!pendingVideo || !selectedDrama) return;
    setPrioritizing(true);
    setPriorityStatus(null);

    try {
      await fetch(`/api/prioritize/${selectedDrama.id}`, { method: "POST" });
      setPriorityStatus(`✅ Drama "${selectedDrama.title}" masuk antrian prioritas!`);

      setTimeout(() => {
        setShowPriorityConfirm(false);
        setPendingVideo(null);
        setPriorityStatus(null);
      }, 2000);

    } catch (err) {
      console.error("Priority error:", err);
      setPriorityStatus("❌ Gagal menambahkan ke antrian prioritas");
    } finally {
      setPrioritizing(false);
    }
  };

  const cancelPriority = () => {
    setShowPriorityConfirm(false);
    setPendingVideo(null);
    setPriorityStatus(null);
  };

  const getVideoSrc = () => {
    if (playingEpisode && selectedDrama) {
      // Use Vercel proxy for HTTPS compatibility
      return `/api/stream/${selectedDrama.id}/${playingEpisode}`;
    }
    if (playingVideo) {
      return `/api/stream/${playingVideo}`;
    }
    return "";
  };

  const clearQuery = () => {
    setQuery("");
    setCurrentPage(1);
    updateURL(1);
    fetchDramas("", 1);
  };

  const formatSize = (bytes: number) => {
    if (!bytes) return "";
    const mb = bytes / (1024 * 1024);
    return `${mb.toFixed(0)} MB`;
  };

  const formatDuration = (seconds: number) => {
    if (!seconds) return "";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const getPageNumbers = () => {
    const pages: (number | string)[] = [];
    if (totalPages <= 7) {
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
      <header className="sticky top-0 z-50 glass-card border-0 border-b">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
              <Film className="w-5 h-5 text-black" />
            </div>
            <h1 className="text-2xl font-bold gradient-text">Dracin</h1>
          </Link>

          {user ? (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                {user.user_metadata?.avatar_url ? (
                  <img src={user.user_metadata.avatar_url} alt="" className="w-8 h-8 rounded-full" />
                ) : (
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-400 to-purple-500 flex items-center justify-center">
                    <User className="w-4 h-4 text-black" />
                  </div>
                )}
                <span className="text-sm text-gray-300 hidden sm:block max-w-[120px] truncate">
                  {user.user_metadata?.full_name || user.email?.split("@")[0]}
                </span>
              </div>
              <button onClick={handleLogout} className="p-2 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white" title="Logout">
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <Link href="/login" className="flex items-center gap-2 btn-secondary py-2 px-4 text-sm">
              <LogIn className="w-4 h-4" />
              <span className="hidden sm:inline">Login</span>
            </Link>
          )}
        </div>
      </header>

      <section className="py-10 px-4">
        <div className="container mx-auto text-center">
          <motion.h2 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-3xl md:text-4xl font-bold mb-4">
            Stream <span className="gradient-text">Asian Dramas</span>
          </motion.h2>
          <motion.form onSubmit={handleSearch} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="max-w-xl mx-auto relative">
            <input type="text" value={query} onChange={(e) => handleQueryChange(e.target.value)} placeholder="Cari judul drama..." className="input-cyber w-full py-4 px-5 pr-32 text-lg" />
            {query && (
              <button type="button" onClick={clearQuery} className="absolute right-[20%] top-1/2 -translate-y-1/2 p-2 text-gray-400 hover:text-white hover:bg-white/10 rounded-full transition-colors" title="Clear search">
                <X className="w-5 h-5" />
              </button>
            )}
            <button type="submit" className="btn-primary absolute right-2 top-1/2 -translate-y-1/2 py-2 px-5 flex items-center gap-2" disabled={loading}>
              {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Search className="w-4 h-4" />}
              <span className="hidden sm:inline">Cari</span>
            </button>
          </motion.form>
        </div>
      </section>

      <section className="px-4 pb-16">
        <div className="container mx-auto">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold flex items-center gap-2">
              <Film className="w-5 h-5 text-cyan-400" />
              {query ? `Hasil: "${query}"` : "Drama Terbaru"}
              <span className="text-sm text-gray-500 font-normal">({totalDramas})</span>
            </h3>
            {!query && totalPages > 1 && <span className="text-sm text-gray-500">Halaman {currentPage}/{totalPages}</span>}
          </div>

          {loading && dramas.length === 0 ? (
            <div className="flex justify-center py-20"><Loader2 className="w-10 h-10 text-cyan-400 animate-spin" /></div>
          ) : dramas.length === 0 ? (
            <div className="text-center py-20 text-gray-400"><Film className="w-16 h-16 mx-auto mb-4 opacity-50" /><p>Tidak ada drama.</p></div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
                {dramas.map((drama, index) => (
                  <motion.div key={`${drama.id}-${index}`} initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: Math.min(index * 0.02, 0.2) }} onClick={() => selectDrama(drama)} className="glass-card p-2 cursor-pointer group hover:border-cyan-500/50">
                    <div className="aspect-[3/4] relative rounded-lg overflow-hidden mb-2 bg-gradient-to-br from-purple-900/50 to-cyan-900/50">
                      {drama.poster_url ? (
                        <img src={drama.poster_url} alt={drama.title} className="w-full h-full object-cover transition-transform group-hover:scale-105" loading="lazy" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Film className="w-8 h-8 text-cyan-400/30" /></div>
                      )}
                      <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center pb-3">
                        <Play className="w-8 h-8 text-white drop-shadow-lg" />
                      </div>
                      {drama.total_episodes && <div className="absolute top-2 right-2 bg-black/70 text-xs px-2 py-1 rounded">{drama.total_episodes} Eps</div>}
                    </div>
                    <h4 className="font-medium text-xs line-clamp-2 group-hover:text-cyan-400 px-1 leading-tight">{drama.title}</h4>
                  </motion.div>
                ))}
              </div>

              {totalPages > 1 && !query && (
                <div className="mt-8 flex items-center justify-center gap-2">
                  <button onClick={() => goToPage(currentPage - 1)} disabled={currentPage === 1} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30"><ChevronLeft className="w-5 h-5" /></button>
                  {getPageNumbers().map((page, idx) => typeof page === "number" ? (
                    <button key={idx} onClick={() => goToPage(page)} className={`w-10 h-10 rounded-lg font-medium ${currentPage === page ? "bg-cyan-500 text-black" : "bg-white/5 hover:bg-white/10"}`}>{page}</button>
                  ) : <span key={idx} className="px-2 text-gray-500">...</span>)}
                  <button onClick={() => goToPage(currentPage + 1)} disabled={currentPage === totalPages} className="p-2 rounded-lg bg-white/5 hover:bg-white/10 disabled:opacity-30"><ChevronRight className="w-5 h-5" /></button>
                </div>
              )}
            </>
          )}
        </div>
      </section>

      <AnimatePresence>
        {selectedDrama && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-50 bg-black/95 overflow-y-auto" onClick={() => setSelectedDrama(null)}>
            <div className="min-h-screen py-4 px-4">
              <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.95, opacity: 0 }} onClick={(e) => e.stopPropagation()} className="max-w-4xl mx-auto">
                <div className="flex items-start gap-4 mb-4">
                  {selectedDrama.poster_url && <div className="w-16 h-24 rounded-lg overflow-hidden flex-shrink-0 hidden sm:block"><img src={selectedDrama.poster_url} alt={selectedDrama.title} className="w-full h-full object-cover" /></div>}
                  <div className="flex-1 min-w-0">
                    <h3 className="text-xl font-bold gradient-text truncate">{selectedDrama.title}</h3>
                    <p className="text-sm text-gray-400">ID: {selectedDrama.id} • {videos.length} Episode</p>
                  </div>
                  <button onClick={() => setSelectedDrama(null)} className="p-2 hover:bg-white/10 rounded-lg"><X className="w-6 h-6" /></button>
                </div>

                {/* Video Player Replacement - Direct Play New Tab */}
                {(playingVideo || playingEpisode) && (
                  <div className="mb-4 rounded-xl overflow-hidden bg-black flex flex-col items-center justify-center aspect-video relative group">
                    {selectedDrama.poster_url && (
                      <div className="absolute inset-0 opacity-30 blur-sm bg-cover bg-center" style={{ backgroundImage: `url(${selectedDrama.poster_url})` }} />
                    )}
                    <div className="relative z-10 flex flex-col items-center">
                      <Play className="w-16 h-16 text-cyan-400 mb-4 animate-pulse" />
                      <h3 className="text-xl font-bold mb-2">Episode {playingEpisode} siap</h3>
                      <p className="text-gray-300 text-sm mb-6 max-w-xs text-center">Klik tombol di bawah untuk memutar video di tab baru (Player Native).</p>
                      <Link
                        href={`/watch/${selectedDrama.id}/${playingEpisode}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="btn-primary py-3 px-8 flex items-center gap-2 text-lg hover:scale-105 transition-transform"
                      >
                        <Play className="w-5 h-5 fill-current" /> Putar Sekarang
                      </Link>
                    </div>
                  </div>
                )}

                {videoMessage && videos.length === 0 && (
                  <div className="mb-4 p-4 bg-yellow-500/20 border border-yellow-500/50 rounded-lg text-yellow-400 text-sm flex items-center gap-2">
                    <AlertCircle className="w-5 h-5 flex-shrink-0" />
                    {videoMessage}
                  </div>
                )}

                <div className="glass-card p-4 rounded-xl">
                  <h4 className="font-semibold text-gray-300 flex items-center gap-2 mb-4">
                    <Video className="w-4 h-4 text-cyan-400" />
                    Daftar Episode
                  </h4>

                  {loadingVideos ? (
                    <div className="flex flex-col items-center justify-center py-10">
                      <Loader2 className="w-8 h-8 text-cyan-400 animate-spin mb-2" />
                      <p className="text-sm text-gray-500">Mengambil daftar video...</p>
                    </div>
                  ) : videos.length === 0 ? (
                    <div className="text-center py-10">
                      <p className="text-gray-500 mb-2">Video belum tersedia di server.</p>
                      <p className="text-xs text-gray-600">Drama ini belum pernah di-download atau masih dalam antrian.</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                      {videos.map((video) => {
                        const isPlaying = video.ready
                          ? playingEpisode === video.episode
                          : playingVideo === video.messageId;
                        return (
                          <div key={video.episode} className={`p-3 rounded-lg transition-all ${isPlaying ? "bg-cyan-500/30 border border-cyan-500" : "bg-white/5 hover:bg-white/10"}`}>
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-sm">Ep {video.episode}</span>
                              {video.ready && <span className="text-xs text-green-400">✓ Ready</span>}
                              {video.duration && !video.ready && <span className="text-xs text-gray-500">{formatDuration(video.duration)}</span>}
                            </div>
                            {video.size && <p className="text-xs text-gray-500 mb-2">{formatSize(video.size)}</p>}
                            <div className="flex flex-col gap-1">
                              {video.ready && selectedDrama ? (
                                <>
                                  {/* Play via watch page - hides direct EC2 URL */}
                                  {/* Play via watch page - hides direct EC2 URL */}
                                  <Link
                                    href={`/watch/${selectedDrama.id}/${video.episode}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="w-full py-1.5 rounded bg-cyan-500/20 hover:bg-cyan-500/30 text-cyan-400 text-xs flex items-center justify-center gap-1"
                                    title="Play langsung (new tab)"
                                  >
                                    <Play className="w-3 h-3" /> Play (Fast)
                                  </Link>
                                  <a
                                    href={`/api/dramas/${selectedDrama.id}/download/${video.episode}`}
                                    download
                                    className="w-full py-1.5 rounded bg-green-500/20 hover:bg-green-500/30 text-green-400 text-xs flex items-center justify-center gap-1"
                                    onClick={(e) => e.stopPropagation()}
                                    title="Download video"
                                  >
                                    <Download className="w-3 h-3" /> Download
                                  </a>
                                </>
                              ) : (
                                <>
                                  <button onClick={() => playVideo(video)} className="w-full py-1.5 rounded bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 text-xs flex items-center justify-center gap-1"><Play className="w-3 h-3" /> Request Download</button>
                                  {video.messageId && <a href={`/api/download/${video.messageId}`} download className="w-full py-1.5 rounded bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 text-xs flex items-center justify-center gap-1" onClick={(e) => e.stopPropagation()} title="Download via Telegram"><Download className="w-3 h-3" /> Telegram</a>}
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Priority Confirmation Dialog */}
      <AnimatePresence>
        {showPriorityConfirm && pendingVideo && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[60] bg-black/80 flex items-center justify-center p-4"
            onClick={cancelPriority}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="glass-card p-6 rounded-xl max-w-md w-full text-center"
            >
              <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-yellow-500/20 flex items-center justify-center">
                <Download className="w-8 h-8 text-yellow-400" />
              </div>
              <h3 className="text-xl font-bold mb-2">Video Belum Tersedia</h3>

              {priorityStatus ? (
                <p className="text-lg py-4">{priorityStatus}</p>
              ) : (
                <>
                  <p className="text-gray-400 mb-4 text-sm">
                    Episode {pendingVideo.episode} belum di-download ke server. Apakah Anda ingin prioritaskan download ini sekarang?
                  </p>
                  <p className="text-xs text-gray-500 mb-6">
                    Drama akan ditambahkan ke antrian prioritas dan di-download setelah episode saat ini selesai.
                  </p>
                  <div className="flex gap-3">
                    <button
                      onClick={cancelPriority}
                      className="flex-1 py-3 rounded-lg bg-white/10 hover:bg-white/20 text-gray-300"
                    >
                      Batal
                    </button>
                    <button
                      onClick={confirmPriority}
                      disabled={prioritizing}
                      className="flex-1 py-3 rounded-lg bg-cyan-500 hover:bg-cyan-600 text-black font-medium flex items-center justify-center gap-2"
                    >
                      {prioritizing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                      Prioritaskan
                    </button>
                  </div>
                </>
              )}
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// Main export with Suspense boundary for useSearchParams
export default function HomePage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-10 h-10 text-cyan-400 animate-spin" />
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
