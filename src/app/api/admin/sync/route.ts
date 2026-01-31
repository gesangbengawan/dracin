import { NextResponse } from "next/server";
import { scrapeAndIndexVideos } from "@/lib/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // Allow 60s for scraping

export async function POST() {
    try {
        console.log("Starting Telegram scrape from admin API...");

        const result = await scrapeAndIndexVideos(3000);

        // Convert Map to array for JSON response
        const dramaList: { id: string; title: string; episodes: number }[] = [];
        result.dramas.forEach((value, key) => {
            dramaList.push({
                id: key,
                title: value.title,
                episodes: value.episodes,
            });
        });

        return NextResponse.json({
            success: true,
            message: `Scraped ${result.totalDramas} dramas, ${result.totalVideos} videos`,
            count: result.totalVideos,
            dramas: dramaList,
        });
    } catch (error) {
        console.error("Sync error:", error);
        return NextResponse.json(
            {
                success: false,
                error: error instanceof Error ? error.message : "Sync failed",
                details: String(error),
            },
            { status: 500 }
        );
    }
}
