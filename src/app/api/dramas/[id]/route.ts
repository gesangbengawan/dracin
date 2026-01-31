import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const maxDuration = 120;

const EC2_VIDEO_SERVER = "http://ec2-100-31-156-119.compute-1.amazonaws.com:3001";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        console.log(`Fetching videos for drama ${id} from EC2...`);

        const res = await fetch(`${EC2_VIDEO_SERVER}/api/videos/${id}`, {
            headers: {
                "Origin": "https://dracin-delta.vercel.app",
            },
        });

        if (!res.ok) {
            throw new Error(`EC2 returned ${res.status}`);
        }

        const data = await res.json();

        return NextResponse.json({
            dramaId: id,
            videos: data.videos || [],
            total: data.total || 0,
            source: "ec2",
        });
    } catch (error) {
        console.error("EC2 video fetch error:", error);
        return NextResponse.json({
            dramaId: id,
            videos: [],
            total: 0,
            error: error instanceof Error ? error.message : "Failed to fetch videos from EC2",
            message: "Video server mungkin sedang offline. Pastikan EC2 Security Group sudah open port 3001.",
        });
    }
}
