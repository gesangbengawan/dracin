import { NextRequest, NextResponse } from "next/server";

const EC2_VIDEO_SERVER = "http://ec2-100-49-45-36.compute-1.amazonaws.com:3001";

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ dramaId: string }> }
) {
    const { dramaId } = await params;

    try {
        const res = await fetch(`${EC2_VIDEO_SERVER}/api/request/${dramaId}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
        });

        const data = await res.json();

        if (!res.ok) {
            return NextResponse.json(data, { status: res.status });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("Request priority error:", error);
        return NextResponse.json(
            { error: "Failed to request priority" },
            { status: 500 }
        );
    }
}
