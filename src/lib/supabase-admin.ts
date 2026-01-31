import { createClient } from "@supabase/supabase-js";

// Server-side Supabase client with service role for admin operations
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export interface DramaRecord {
    id: string;
    title: string;
    poster_url: string | null;
    total_episodes: number;
    page_number: number | null;
}

/**
 * Search dramas from Supabase (fast indexed search)
 */
export async function searchDramasDB(query: string, limit = 50): Promise<DramaRecord[]> {
    const { data, error } = await supabaseAdmin
        .from("dramas")
        .select("*")
        .ilike("title", `%${query}%`)
        .limit(limit);

    if (error) {
        console.error("Search error:", error);
        return [];
    }

    return data || [];
}

/**
 * Get all dramas with pagination
 */
export async function getAllDramasDB(page = 1, perPage = 24): Promise<{ dramas: DramaRecord[]; total: number }> {
    const start = (page - 1) * perPage;

    const { data, error, count } = await supabaseAdmin
        .from("dramas")
        .select("*", { count: "exact" })
        .order("created_at", { ascending: false })
        .range(start, start + perPage - 1);

    if (error) {
        console.error("Get dramas error:", error);
        return { dramas: [], total: 0 };
    }

    return {
        dramas: data || [],
        total: count || 0,
    };
}

/**
 * Upsert drama to cache
 */
export async function cacheDrama(drama: DramaRecord): Promise<boolean> {
    const { error } = await supabaseAdmin
        .from("dramas")
        .upsert(drama, { onConflict: "id" });

    return !error;
}

/**
 * Bulk insert dramas
 */
export async function cacheDramasBulk(dramas: DramaRecord[]): Promise<number> {
    const { data, error } = await supabaseAdmin
        .from("dramas")
        .upsert(dramas, { onConflict: "id" })
        .select();

    if (error) {
        console.error("Bulk cache error:", error);
        return 0;
    }

    return data?.length || 0;
}
