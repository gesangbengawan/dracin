import { NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET() {
    try {
        // Get users count
        const { count: userCount } = await supabaseAdmin
            .from("profiles")
            .select("*", { count: "exact", head: true });

        // Get dramas count
        const { count: dramaCount } = await supabaseAdmin
            .from("dramas")
            .select("*", { count: "exact", head: true });

        return NextResponse.json({
            totalUsers: userCount || 0,
            totalDramas: dramaCount || 0,
            totalVideos: 0, // Will be updated when we sync
        });
    } catch (error) {
        console.error("Stats error:", error);
        return NextResponse.json({
            totalUsers: 0,
            totalDramas: 0,
            totalVideos: 0,
        });
    }
}
