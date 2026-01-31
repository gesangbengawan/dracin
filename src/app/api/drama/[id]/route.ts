import { NextRequest, NextResponse } from "next/server";
import { getDramaById } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        const drama = await getDramaById(id);

        if (drama) {
            return NextResponse.json({
                id: drama.id,
                title: drama.title,
                poster_url: drama.poster_url,
                total_episodes: drama.total_episodes,
                source: "database",
            });
        } else {
            // Fallback: return basic info
            return NextResponse.json({
                id,
                title: `Drama ${id}`,
                poster_url: null,
                total_episodes: 0,
                source: "fallback",
            });
        }
    } catch (error) {
        console.error("API error:", error);
        return NextResponse.json(
            { error: "Failed to fetch drama", id, title: `Drama ${id}` },
            { status: 500 }
        );
    }
}
