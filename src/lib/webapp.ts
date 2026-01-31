import * as cheerio from "cheerio";
import { cacheDramasBulk, DramaRecord } from "./supabase-admin";

const BASE_URL = "https://mtshort.com";
const WEBAPP_URL = `${BASE_URL}/webapp/dramas`;

export interface Drama {
    id: string;
    title: string;
    poster_url?: string;
}

/**
 * Fetch and parse dramas from WebApp
 */
export async function fetchDramasFromWebApp(page = 1): Promise<Drama[]> {
    const url = `${WEBAPP_URL}?page=${page}&tab=latest`;

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Linux; Android 12) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36",
                "Accept": "text/html,application/xhtml+xml",
            },
            next: { revalidate: 300 }, // Cache for 5 minutes
        });

        if (!response.ok) {
            console.error(`Fetch failed: ${response.status}`);
            return [];
        }

        const html = await response.text();
        const $ = cheerio.load(html);
        const dramas: Drama[] = [];

        // Parse drama cards - multiple selectors for robustness
        $("[data-drama-id], .drama-card, .card").each((_, el) => {
            const $el = $(el);

            // Get drama ID
            const id = $el.attr("data-drama-id") ||
                $el.find("[data-drama-id]").attr("data-drama-id") ||
                $el.attr("data-id");

            if (!id) return;

            // Get title from multiple possible locations
            const title = $el.attr("title") ||
                $el.find(".title, .drama-title, h3, h4").first().text().trim() ||
                $el.find("img").attr("alt") ||
                `Drama ${id}`;

            // Get poster image
            let poster = $el.find("img").attr("src") ||
                $el.find("img").attr("data-src") ||
                $el.attr("data-poster");

            if (poster && !poster.startsWith("http")) {
                poster = `${BASE_URL}${poster.startsWith("/") ? "" : "/"}${poster}`;
            }

            dramas.push({
                id,
                title: title.substring(0, 150),
                poster_url: poster,
            });
        });

        return dramas;
    } catch (error) {
        console.error("Fetch WebApp error:", error);
        return [];
    }
}

/**
 * Sync dramas from WebApp to Supabase
 */
export async function syncDramasToSupabase(pages = 5): Promise<number> {
    let total = 0;

    for (let page = 1; page <= pages; page++) {
        const dramas = await fetchDramasFromWebApp(page);

        if (dramas.length === 0) break;

        const records: DramaRecord[] = dramas.map((d) => ({
            id: d.id,
            title: d.title,
            poster_url: d.poster_url || null,
            total_episodes: 0,
            page_number: page,
        }));

        const count = await cacheDramasBulk(records);
        total += count;
    }

    return total;
}

/**
 * Search with fallback: try Supabase first, then WebApp
 */
export async function searchDramasHybrid(query: string, limit = 50): Promise<Drama[]> {
    // First, try to sync some data if query is short (browsing)
    if (query.length <= 2) {
        await syncDramasToSupabase(3);
    }

    // Fetch from multiple WebApp pages and filter
    const allDramas: Drama[] = [];
    const seenIds = new Set<string>();

    for (let page = 1; page <= 10; page++) {
        const dramas = await fetchDramasFromWebApp(page);

        for (const d of dramas) {
            if (!seenIds.has(d.id)) {
                seenIds.add(d.id);
                if (!query || d.title.toLowerCase().includes(query.toLowerCase())) {
                    allDramas.push(d);
                    if (allDramas.length >= limit) break;
                }
            }
        }

        if (dramas.length === 0 || allDramas.length >= limit) break;
    }

    return allDramas.slice(0, limit);
}
