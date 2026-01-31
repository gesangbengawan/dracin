import { NextRequest, NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const EC2_VIDEO_SERVER = "http://ec2-100-49-45-36.compute-1.amazonaws.com:3001";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ dramaId: string; episode: string }> }
) {
    const { dramaId, episode } = await params;

    if (!dramaId || !episode) {
        return new NextResponse("Missing parameters", { status: 400 });
    }

    // Redirect to the EC2 static file server
    // EC2 Server serves files from COMPRESSED_DIR under /stream path
    // Structure: /stream/[dramaId]/ep[episode].mp4
    const targetUrl = `${EC2_VIDEO_SERVER}/stream/${dramaId}/ep${episode}.mp4`;

    return NextResponse.redirect(targetUrl);
}
