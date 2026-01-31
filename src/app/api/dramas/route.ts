import { NextRequest, NextResponse } from "next/server";
import { searchDramasHybrid, fetchDramasFromWebApp } from "@/lib/webapp";
import { searchDramasDB, getAllDramasDB } from "@/lib/supabase-admin";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "24");

    try {
        if (query && query.length >= 2) {
            // Search mode - use hybrid search
            const dramas = await searchDramasHybrid(query, limit);
            return NextResponse.json({
                dramas: dramas.map(d => ({
                    id: d.id,
                    title: d.title,
                    poster_url: d.poster_url,
                })),
                total: dramas.length,
                source: "webapp",
            });
        } else {
            // Browse mode - try Supabase first, fallback to WebApp
            const dbResult = await getAllDramasDB(page, limit);

            if (dbResult.dramas.length > 0) {
                return NextResponse.json({
                    dramas: dbResult.dramas,
                    total: dbResult.total,
                    page,
                    source: "database",
                });
            }

            // Fallback to WebApp
            const dramas = await fetchDramasFromWebApp(page);
            return NextResponse.json({
                dramas: dramas.map(d => ({
                    id: d.id,
                    title: d.title,
                    poster_url: d.poster_url,
                })),
                total: 10000, // Approximate
                page,
                source: "webapp",
            });
        }
    } catch (error) {
        console.error("API error:", error);
        return NextResponse.json(
            { error: "Failed to fetch dramas", dramas: [] },
            { status: 500 }
        );
    }
}
