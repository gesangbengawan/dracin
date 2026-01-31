import { NextRequest, NextResponse } from "next/server";
import { streamVideo, getVideoInfo } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow 60s for video streaming

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
        // Get video info first
        const info = await getVideoInfo(msgId);
        if (!info) {
            return NextResponse.json({ error: "Video not found" }, { status: 404 });
        }

        // Check for range request
        const range = request.headers.get("range");

        if (range) {
            // For range requests, we need to handle partial content
            // For simplicity, we'll stream the full video
            // (Proper range support requires knowing file size upfront)
        }

        // Create readable stream
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of streamVideo(msgId)) {
                        controller.enqueue(new Uint8Array(chunk));
                    }
                    controller.close();
                } catch (err) {
                    console.error("Stream error:", err);
                    controller.error(err);
                }
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": info.mimeType,
                "Accept-Ranges": "bytes",
                "Cache-Control": "public, max-age=3600",
                ...(info.size > 0 && { "Content-Length": info.size.toString() }),
            },
        });
    } catch (error) {
        console.error("Stream error:", error);
        return NextResponse.json(
            { error: "Failed to stream video" },
            { status: 500 }
        );
    }
}
