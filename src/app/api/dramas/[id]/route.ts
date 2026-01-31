import { NextRequest, NextResponse } from "next/server";
import { getVideosForDrama } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 30; // Allow 30s for Telegram connection

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        console.log(`Fetching videos for drama: ${id}`);
        const videos = await getVideosForDrama(id);

        console.log(`Found ${videos.length} videos`);

        return NextResponse.json({
            dramaId: id,
            videos: videos.map((v) => ({
                messageId: v.messageId,
                title: `Episode ${v.episodeNum}`,
                episode: v.episodeNum,
                size: v.size,
                duration: v.duration,
                mimeType: v.mimeType,
            })),
            total: videos.length,
        });
    } catch (error) {
        console.error("Get videos error:", error);
        return NextResponse.json(
            {
                error: "Failed to get drama videos",
                message: error instanceof Error ? error.message : "Unknown error",
                videos: [],
            },
            { status: 500 }
        );
    }
}
