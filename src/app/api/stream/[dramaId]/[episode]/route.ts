import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const EC2_VIDEO_SERVER = "http://ec2-100-49-45-36.compute-1.amazonaws.com:3001";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ dramaId: string; episode: string }> }
) {
    const { dramaId, episode } = await params;

    try {
        console.log(`Streaming drama ${dramaId} ep ${episode} from EC2...`);

        // Forward range header if present
        const range = request.headers.get("range") || "";

        const res = await fetch(`${EC2_VIDEO_SERVER}/api/stream/${dramaId}/${episode}`, {
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
            },
            { status: 500 }
        );
    }
}
