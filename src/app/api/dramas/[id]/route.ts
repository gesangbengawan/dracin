import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const EC2_VIDEO_SERVER = "http://ec2-100-49-45-36.compute-1.amazonaws.com:3001";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const res = await fetch(`${EC2_VIDEO_SERVER}/api/videos/${id}`, {
            headers: { Origin: "https://dracin-delta.vercel.app" },
        });
        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("EC2 fetch error:", error);
        return NextResponse.json({
            dramaId: id,
            videos: [],
            total: 0,
            error: "Cannot connect to video server",
        });
    }
}
