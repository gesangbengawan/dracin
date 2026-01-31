"use client";

import { use, useEffect, useState } from "react";
import { Play, ArrowLeft } from "lucide-react";
import Link from "next/link";

interface VideoData {
    episode: number;
    ready: boolean;
    size?: number;
}

export default function WatchPage({ params }: { params: Promise<{ dramaId: string; episode: string }> }) {
    const { dramaId, episode } = use(params);
    const [videoSrc, setVideoSrc] = useState("");
    const [title, setTitle] = useState("Loading...");

    useEffect(() => {
        // Fetch drama details for title (optional)
        fetch(`/api/dramas/${dramaId}`).then(res => res.json()).then(data => {
            if (data.title) setTitle(data.title);
        });

        // Set Proxy URL (Masked)
        // /cdn/10695/ep1.mp4 -> Proxies to EC2
        setVideoSrc(`/cdn/${dramaId}/ep${episode}.mp4`);
    }, [dramaId, episode]);

    return (
        <div className="bg-black min-h-screen text-white flex flex-col">
            <div className="p-4 flex items-center gap-4 bg-gradient-to-b from-black/80 to-transparent absolute top-0 left-0 right-0 z-10">
                <Link href="/" className="p-2 hover:bg-white/10 rounded-full transition-colors">
                    <ArrowLeft className="w-6 h-6" />
                </Link>
                <div>
                    <h1 className="font-bold text-lg leading-tight line-clamp-1">{title}</h1>
                    <p className="text-sm text-gray-400">Episode {episode}</p>
                </div>
            </div>

            <div className="flex-1 flex items-center justify-center">
                <video
                    src={videoSrc}
                    controls
                    autoPlay
                    className="w-full h-full max-h-screen object-contain"
                    controlsList="nodownload"
                    playsInline
                />
            </div>
        </div>
    );
}
