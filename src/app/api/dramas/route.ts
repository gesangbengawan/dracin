import { NextRequest, NextResponse } from "next/server";
import { searchDramas, getAllDramas } from "@/lib/telegram";

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams;
    const query = searchParams.get("q") || "";
    const page = parseInt(searchParams.get("page") || "1");
    const limit = parseInt(searchParams.get("limit") || "20");

    try {
        if (query) {
            // Search mode
            const dramas = await searchDramas(query, limit);
            return NextResponse.json({ dramas, total: dramas.length });
        } else {
            // Browse mode
            const result = await getAllDramas(page, limit);
            return NextResponse.json(result);
        }
    } catch (error) {
        console.error("Search error:", error);
        return NextResponse.json(
            { error: "Failed to search dramas" },
            { status: 500 }
        );
    }
}
