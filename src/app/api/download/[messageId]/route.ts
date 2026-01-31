import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

const EC2_VIDEO_SERVER = "http://ec2-100-31-156-119.compute-1.amazonaws.com:3001";

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
        console.log(`Downloading video ${msgId} from EC2...`);

        const res = await fetch(`${EC2_VIDEO_SERVER}/api/download/${msgId}`, {
            headers: {
                Origin: "https://dracin-delta.vercel.app",
            },
        });

        if (!res.ok) {
            throw new Error(`EC2 returned ${res.status}`);
        }

        // Stream the response
        const headers = new Headers();
        headers.set("Content-Type", "video/mp4");
        headers.set("Content-Disposition", `attachment; filename="episode_${msgId}.mp4"`);

        const contentLength = res.headers.get("content-length");
        if (contentLength) {
            headers.set("Content-Length", contentLength);
        }

        return new Response(res.body, {
            status: 200,
            headers,
        });
    } catch (error) {
        console.error("Download error:", error);
        return NextResponse.json(
            {
                error: "Download failed",
                message: error instanceof Error ? error.message : "Unknown error",
                tip: "Pastikan EC2 Security Group sudah open port 3001"
            },
            { status: 500 }
        );
    }
}
