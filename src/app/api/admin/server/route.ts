import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const EC2_VIDEO_SERVER = "http://ec2-100-49-45-36.compute-1.amazonaws.com:3001";

// Get server status, queue, and ready films
export async function GET() {
    try {
        // Fetch queue status
        const queueRes = await fetch(`${EC2_VIDEO_SERVER}/api/queue`);
        const queueData = await queueRes.json();

        // Fetch server status
        const statusRes = await fetch(`${EC2_VIDEO_SERVER}/api/status`);
        const statusData = await statusRes.json();

        // Fetch ready films (list of downloaded videos)
        const readyRes = await fetch(`${EC2_VIDEO_SERVER}/api/ready`);
        let readyData = { films: [] };
        if (readyRes.ok) {
            readyData = await readyRes.json();
        }

        return NextResponse.json({
            queue: queueData,
            status: statusData,
            ready: readyData,
        });
    } catch (error) {
        console.error("Server status error:", error);
        return NextResponse.json({
            error: "Cannot connect to video server",
            queue: { current: null, priority: [], next: [] },
            status: { status: "offline" },
            ready: { films: [] },
        }, { status: 500 });
    }
}

// Force prioritize a drama by ID
export async function POST(request: NextRequest) {
    try {
        const { dramaId } = await request.json();

        if (!dramaId) {
            return NextResponse.json({ error: "Drama ID is required" }, { status: 400 });
        }

        const res = await fetch(`${EC2_VIDEO_SERVER}/api/force-priority/${dramaId}`, {
            method: "POST",
        });

        const data = await res.json();

        if (res.ok) {
            return NextResponse.json({
                success: true,
                message: `Drama ${dramaId} added to priority queue`,
                data,
            });
        } else {
            return NextResponse.json({
                success: false,
                error: data.error || "Failed to prioritize"
            }, { status: res.status });
        }
    } catch (error) {
        console.error("Prioritize error:", error);
        return NextResponse.json({ error: "Server error" }, { status: 500 });
    }
}
