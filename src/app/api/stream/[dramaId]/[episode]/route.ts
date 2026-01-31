import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const EC2_VIDEO_SERVER = "http://ec2-100-49-45-36.compute-1.amazonaws.com:3001";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ dramaId: string; episode: string }> }
) {
    const { dramaId, episode } = await params;

    try {
        // Forward range header if present
        const range = request.headers.get("range") || "";

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000);

        const res = await fetch(`${EC2_VIDEO_SERVER}/api/stream/${dramaId}/${episode}`, {
            headers: {
                Range: range,
                Origin: "https://dracin-delta.vercel.app",
            },
            signal: controller.signal,
        });

        clearTimeout(timeoutId);

        if (!res.ok && res.status !== 206) {
            return NextResponse.json(
                { error: `Video not available: ${res.status}` },
                { status: res.status }
            );
        }

        // Create response headers from EC2 response
        const headers = new Headers();

        // Copy important headers from EC2
        const contentType = res.headers.get("content-type");
        const contentLength = res.headers.get("content-length");
        const contentRange = res.headers.get("content-range");
        const acceptRanges = res.headers.get("accept-ranges");

        if (contentType) headers.set("Content-Type", contentType);
        if (contentLength) headers.set("Content-Length", contentLength);
        if (contentRange) headers.set("Content-Range", contentRange);
        if (acceptRanges) headers.set("Accept-Ranges", acceptRanges);

        // Add CORS headers
        headers.set("Access-Control-Allow-Origin", "*");
        headers.set("Access-Control-Allow-Methods", "GET, HEAD, OPTIONS");
        headers.set("Access-Control-Allow-Headers", "Range");

        // Stream the response
        return new Response(res.body, {
            status: res.status,
            headers,
        });
    } catch (error) {
        console.error("Stream error:", error);

        if (error instanceof Error && error.name === "AbortError") {
            return NextResponse.json(
                { error: "Stream timeout - video server not responding" },
                { status: 504 }
            );
        }

        return NextResponse.json(
            { error: "Stream failed", message: error instanceof Error ? error.message : "Unknown error" },
            { status: 500 }
        );
    }
}

// Handle OPTIONS for CORS preflight
export async function OPTIONS() {
    return new Response(null, {
        status: 204,
        headers: {
            "Access-Control-Allow-Origin": "*",
            "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
            "Access-Control-Allow-Headers": "Range",
        }
    });
}
