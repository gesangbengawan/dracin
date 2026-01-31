"use client";

import { useSearchParams } from "next/navigation";
import { Suspense, useState, useEffect } from "react";
import { ArrowLeft, Download, Maximize2, Film } from "lucide-react";
import Link from "next/link";

function VideoPlayerContent() {
    const searchParams = useSearchParams();
    const d = searchParams.get("d"); // dramaId
    const e = searchParams.get("e"); // episode
    const t = searchParams.get("t"); // title (optional)

    const [isFullscreen, setIsFullscreen] = useState(false);

    if (!d || !e) {
        return (
            <div className="min-h-screen flex items-center justify-center">
                <div className="text-center">
                    <Film className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                    <h1 className="text-xl font-bold mb-2">Video Tidak Ditemukan</h1>
                    <p className="text-gray-500 mb-4">Parameter video tidak valid</p>
                    <Link href="/" className="btn-primary">Kembali ke Home</Link>
                </div>
            </div>
        );
    }

    // Construct the EC2 video URL (hidden from user)
    const videoUrl = `http://ec2-100-49-45-36.compute-1.amazonaws.com:3001/api/stream/${d}/${e}`;
    const downloadUrl = `/api/dramas/${d}/download/${e}`;

    const toggleFullscreen = () => {
        const video = document.querySelector("video");
        if (video) {
            if (!document.fullscreenElement) {
                video.requestFullscreen();
                setIsFullscreen(true);
            } else {
                document.exitFullscreen();
                setIsFullscreen(false);
            }
        }
    };

    return (
        <div className="min-h-screen bg-black">
            {/* Header */}
            <div className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-black/80 to-transparent p-4">
                <div className="container mx-auto flex items-center justify-between">
                    <Link href="/" className="flex items-center gap-2 text-white hover:text-cyan-400 transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                        <span className="hidden sm:inline">Kembali</span>
                    </Link>
                    <div className="text-center flex-1 px-4">
                        <h1 className="text-sm sm:text-lg font-medium truncate">{t ? decodeURIComponent(t) : `Drama ${d}`}</h1>
                        <p className="text-xs text-gray-400">Episode {e}</p>
                    </div>
                    <div className="flex items-center gap-2">
                        <a href={downloadUrl} download className="p-2 hover:bg-white/10 rounded-lg text-white" title="Download">
                            <Download className="w-5 h-5" />
                        </a>
                        <button onClick={toggleFullscreen} className="p-2 hover:bg-white/10 rounded-lg text-white" title="Fullscreen">
                            <Maximize2 className="w-5 h-5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* Video Player */}
            <div className="flex items-center justify-center min-h-screen">
                <video
                    src={videoUrl}
                    controls
                    autoPlay
                    className="max-w-full max-h-screen"
                    style={{ maxHeight: "100vh" }}
                />
            </div>
        </div>
    );
}

export default function WatchPage() {
    return (
        <Suspense fallback={
            <div className="min-h-screen flex items-center justify-center bg-black">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin mx-auto mb-4" />
                    <p className="text-gray-400">Loading video...</p>
                </div>
            </div>
        }>
            <VideoPlayerContent />
        </Suspense>
    );
}
