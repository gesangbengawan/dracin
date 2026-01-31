import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const EC2_VIDEO_SERVER = "http://ec2-100-49-45-36.compute-1.amazonaws.com:3001";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ dramaId: string }> }
) {
    const { dramaId } = await params;

    try {
        const res = await fetch(`${EC2_VIDEO_SERVER}/api/prioritize/${dramaId}`, {
            method: "POST",
            headers: { Origin: "https://dracin-delta.vercel.app" },
        });
        const data = await res.json();
        return NextResponse.json(data);
    } catch (error) {
        console.error("Prioritize error:", error);
        return NextResponse.json({ error: "Failed to prioritize" }, { status: 500 });
    }
}
