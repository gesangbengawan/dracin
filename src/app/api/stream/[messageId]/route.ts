import { NextRequest, NextResponse } from "next/server";
import { streamVideo } from "@/lib/telegram";

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
        // Create a readable stream from the async generator
        const stream = new ReadableStream({
            async start(controller) {
                try {
                    for await (const chunk of streamVideo(msgId)) {
                        controller.enqueue(chunk);
                    }
                    controller.close();
                } catch (err) {
                    controller.error(err);
                }
            },
        });

        return new Response(stream, {
            headers: {
                "Content-Type": "video/mp4",
                "Cache-Control": "public, max-age=3600",
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
