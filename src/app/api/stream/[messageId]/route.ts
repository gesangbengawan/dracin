import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

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
        console.log(`Streaming video ${msgId} from EC2...`);

        // Forward range header if present
        const range = request.headers.get("range") || "";

        const res = await fetch(`${EC2_VIDEO_SERVER}/api/stream/${msgId}`, {
            headers: {
                Range: range,
                Origin: "https://dracin-delta.vercel.app",
            },
        });

        if (!res.ok && res.status !== 206) {
            throw new Error(`EC2 returned ${res.status}`);
        }

        // Stream the response from EC2
        const headers = new Headers();
        res.headers.forEach((value, key) => {
            headers.set(key, value);
        });

        return new Response(res.body, {
            status: res.status,
            headers,
        });
    } catch (error) {
        console.error("Stream error:", error);
        return NextResponse.json(
            {
                error: "Stream failed",
                message: error instanceof Error ? error.message : "Unknown error",
                tip: "Pastikan EC2 Security Group sudah open port 3001"
            },
            { status: 500 }
        );
    }
}
