import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

interface DramaData {
    id: string;
    title: string;
    episodes: number;
}

interface ImportData {
    dramas_done?: DramaData[];
    total_videos?: number;
}

export async function POST(request: NextRequest) {
    try {
        const data: ImportData = await request.json();

        if (!data.dramas_done || !Array.isArray(data.dramas_done)) {
            return NextResponse.json(
                { error: "Invalid JSON format. Expected { dramas_done: [...] }" },
                { status: 400 }
            );
        }

        console.log(`Importing ${data.dramas_done.length} dramas...`);

        // Deduplicate by ID (keep first occurrence)
        const uniqueDramas = new Map<string, DramaData>();
        for (const drama of data.dramas_done) {
            if (!uniqueDramas.has(drama.id)) {
                uniqueDramas.set(drama.id, drama);
            }
        }

        console.log(`Unique dramas: ${uniqueDramas.size}`);

        let importedCount = 0;
        let errorCount = 0;

        // Insert in batches
        const dramasArray = Array.from(uniqueDramas.values());
        const batchSize = 50;

        for (let i = 0; i < dramasArray.length; i += batchSize) {
            const batch = dramasArray.slice(i, i + batchSize);

            const records = batch.map((d) => ({
                id: d.id,
                title: d.title,
                total_episodes: d.episodes,
                updated_at: new Date().toISOString(),
            }));

            const { error } = await supabaseAdmin
                .from("dramas")
                .upsert(records, { onConflict: "id" });

            if (error) {
                console.error(`Batch error:`, error);
                errorCount += batch.length;
            } else {
                importedCount += batch.length;
            }
        }

        return NextResponse.json({
            success: true,
            message: `Imported ${importedCount} dramas (${errorCount} errors)`,
            imported: importedCount,
            errors: errorCount,
            totalVideos: data.total_videos || 0,
        });
    } catch (error) {
        console.error("Import error:", error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : "Import failed" },
            { status: 500 }
        );
    }
}
