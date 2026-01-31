import { NextRequest, NextResponse } from "next/server";
import { getDramaVideos } from "@/lib/telegram";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const videos = await getDramaVideos(id);
        return NextResponse.json({ videos });
    } catch (error) {
        console.error("Get videos error:", error);
        return NextResponse.json(
            { error: "Failed to get drama videos" },
            { status: 500 }
        );
    }
}
