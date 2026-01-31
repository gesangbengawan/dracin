import { NextRequest, NextResponse } from "next/server";
import { getTelegramClient } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BOT_USERNAME = "IDShortBot";

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
        const client = await getTelegramClient();
        const bot = await client.getEntity(BOT_USERNAME);

        const messages = await client.getMessages(bot, { ids: [msgId] });
        if (!messages.length || !messages[0].media) {
            return NextResponse.json({ error: "Video not found" }, { status: 404 });
        }

        const msg = messages[0];
        const media = msg.media as any;
        const mimeType = media.document?.mimeType || "video/mp4";
        const size = media.document?.size || 0;

        // Download the entire file
        const buffer = await client.downloadMedia(msg, {});

        if (!buffer) {
            return NextResponse.json({ error: "Failed to download" }, { status: 500 });
        }

        // Return as downloadable file
        const uint8 = new Uint8Array(buffer as Buffer);
        return new Response(uint8, {
            headers: {
                "Content-Type": mimeType,
                "Content-Disposition": `attachment; filename="episode_${msgId}.mp4"`,
                "Content-Length": size.toString(),
                "Cache-Control": "public, max-age=86400",
            },
        });
    } catch (error) {
        console.error("Download error:", error);
        return NextResponse.json(
            { error: "Failed to download video" },
            { status: 500 }
        );
    }
}
