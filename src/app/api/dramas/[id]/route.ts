import { NextRequest, NextResponse } from "next/server";
import { getVideosFromDB } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        console.log(`Getting videos for drama: ${id}`);

        // Get videos from database (scraped data)
        const videos = await getVideosFromDB(id);

        console.log(`Found ${videos.length} videos in database`);

        return NextResponse.json({
            dramaId: id,
            videos: videos.map((v) => ({
                messageId: v.messageId,
                title: `Episode ${v.episodeNum}`,
                episode: v.episodeNum,
                size: v.fileSize,
                duration: v.duration,
                mimeType: v.mimeType,
            })),
            total: videos.length,
            source: "database",
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
