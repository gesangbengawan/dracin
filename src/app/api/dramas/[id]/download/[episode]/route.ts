import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const EC2_VIDEO_SERVER = "http://ec2-100-49-45-36.compute-1.amazonaws.com:3001";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string; episode: string }> }
) {
    const { id, episode } = await params;

    try {
        console.log(`Downloading drama ${id} ep ${episode} from EC2...`);
        const res = await fetch(`${EC2_VIDEO_SERVER}/api/download/${id}/${episode}`);

        if (!res.ok) {
            return NextResponse.json({ error: "File not found or server error" }, { status: res.status });
        }

        const headers = new Headers();
        res.headers.forEach((value, key) => {
            headers.set(key, value);
        });

        // Set proper content disposition for download
        headers.set("Content-Disposition", `attachment; filename="Dracin_${id}_Ep${episode}.mp4"`);

        return new Response(res.body, { status: 200, headers });
    } catch (error) {
        console.error("Download error:", error);
        return NextResponse.json({ error: "Download failed" }, { status: 500 });
    }
}
