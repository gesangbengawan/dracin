import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;

    try {
        console.log(`Getting drama info for ID: ${id}`);

        // Get drama from database
        const { data: drama, error } = await supabaseAdmin
            .from("dramas")
            .select("*")
            .eq("id", id)
            .single();

        if (error || !drama) {
            return NextResponse.json({
                dramaId: id,
                title: `Drama ${id}`,
                videos: [],
                total: 0,
                message: "Drama not found in database. Import the JSON data first.",
            });
        }

        // Generate episode list based on total_episodes
        const episodes = drama.total_episodes || 0;
        const videos = [];

        for (let i = 1; i <= episodes; i++) {
            videos.push({
                episode: i,
                title: `Episode ${i}`,
                // We don't have messageId yet - user needs to trigger from Telegram
                // For now, we just show the count
            });
        }

        return NextResponse.json({
            dramaId: id,
            title: drama.title,
            posterUrl: drama.poster_url,
            videos,
            total: episodes,
            source: "database",
            message: episodes > 0
                ? `Found ${episodes} episodes`
                : "No episodes indexed. Trigger this drama from Telegram first.",
        });
    } catch (error) {
        console.error("Get drama error:", error);
        return NextResponse.json(
            {
                error: "Failed to get drama info",
                videos: [],
            },
            { status: 500 }
        );
    }
}
