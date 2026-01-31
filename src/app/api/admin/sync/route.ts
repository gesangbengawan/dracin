import { NextResponse } from "next/server";
import { syncDramasToSupabase } from "@/lib/webapp";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow 60s for sync

export async function POST() {
    try {
        // Sync dramas from WebApp to Supabase
        const count = await syncDramasToSupabase(20); // Sync 20 pages

        return NextResponse.json({
            success: true,
            message: `Synced ${count} dramas successfully`,
            count,
        });
    } catch (error) {
        console.error("Sync error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Sync failed"
            },
            { status: 500 }
        );
    }
}
