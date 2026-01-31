import { NextRequest, NextResponse } from "next/server";
import { downloadVideo, getVideoInfo } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ messageId: string }> }
) {
    const { messageId } = await params;
    const msgId = parseInt(messageId);

    if (isNaN(msgId)) {
        return NextResponse.json({ error: "Invalid message ID" }, { status: 400 });
    }

    try {
        console.log(`Downloading video: ${msgId}`);

        // Get video info first
        const info = await getVideoInfo(msgId);
        if (!info) {
            return NextResponse.json({ error: "Video not found" }, { status: 404 });
        }

        // Download the full video
        const buffer = await downloadVideo(msgId);

        if (!buffer) {
            return NextResponse.json({ error: "Failed to download" }, { status: 500 });
        }

        console.log(`Downloaded ${buffer.length} bytes`);

        // Convert Buffer to Uint8Array for Response
        const uint8Array = new Uint8Array(buffer);

        // Return as downloadable file
        return new Response(uint8Array, {
            headers: {
                "Content-Type": info.mimeType,
                "Content-Disposition": `attachment; filename="episode_${msgId}.mp4"`,
                "Content-Length": buffer.length.toString(),
                "Cache-Control": "public, max-age=86400",
            },
        });
    } catch (error) {
        console.error("Download error:", error);
        return NextResponse.json(
            { error: "Failed to download video", details: String(error) },
            { status: 500 }
        );
    }
}
