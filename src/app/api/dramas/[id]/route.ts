import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const EC2_VIDEO_SERVER = "http://ec2-100-49-45-36.compute-1.amazonaws.com:3001";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        // Create an abort controller with 15 second timeout
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 15000);

        const res = await fetch(`${EC2_VIDEO_SERVER}/api/videos/${id}`, {
            headers: {
                Origin: "https://dracin-delta.vercel.app",
            },
            signal: controller.signal,
            cache: "no-store",
        });

        clearTimeout(timeoutId);

        if (!res.ok) {
            throw new Error(`EC2 returned ${res.status}`);
        }

        const data = await res.json();

        // Return with cache control headers
        return NextResponse.json(data, {
            headers: {
                "Cache-Control": "no-cache, no-store, must-revalidate",
            },
        });
    } catch (error) {
        console.error("EC2 fetch error:", error);

        // Return error response with more details
        return NextResponse.json({
            dramaId: id,
            videos: [],
            total: 0,
            error: error instanceof Error ? error.message : "Cannot connect to video server",
            message: "Video server tidak dapat dihubungi. Coba lagi nanti.",
        }, { status: 500 });
    }
}
