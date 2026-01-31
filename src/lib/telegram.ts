import { TelegramClient, Api } from "telegram";
import { StringSession } from "telegram/sessions";
import * as cheerio from "cheerio";

const API_ID = parseInt(process.env.TELEGRAM_API_ID || "0");
const API_HASH = process.env.TELEGRAM_API_HASH || "";
const SESSION_STRING = process.env.TELEGRAM_SESSION || "";

let clientInstance: TelegramClient | null = null;

const BOT_USERNAME = "IDShortBot";
const BASE_URL = "https://mtshort.com";
const WEBAPP_URL = `${BASE_URL}/webapp/dramas`;

export async function getTelegramClient(): Promise<TelegramClient> {
    if (clientInstance && clientInstance.connected) {
        return clientInstance;
    }

    const session = new StringSession(SESSION_STRING);
    clientInstance = new TelegramClient(session, API_ID, API_HASH, {
        connectionRetries: 5,
    });

    await clientInstance.connect();
    return clientInstance;
}

export interface Drama {
    id: string;
    title: string;
    poster?: string;
    messageId?: number;
    date?: Date;
}

export interface VideoMessage {
    messageId: number;
    title: string;
    size: number;
    duration: number;
    mimeType: string;
}

/**
 * Fetch dramas from WebApp (mtshort.com)
 */
async function fetchDramasFromWebApp(page = 1): Promise<Drama[]> {
    const url = `${WEBAPP_URL}?page=${page}&tab=latest`;

    try {
        const response = await fetch(url, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Linux; Android 12) Chrome/120.0.0.0 Mobile",
            },
        });

        if (!response.ok) return [];

        const html = await response.text();
        const $ = cheerio.load(html);
        const dramas: Drama[] = [];

        // Parse drama cards
        $('div[data-drama-id]').each((_, el) => {
            const $el = $(el);
            const id = $el.attr('data-drama-id');
            const title = $el.attr('title') || $el.find('.title').text().trim();
            const img = $el.find('img').attr('src');

            if (id && title) {
                dramas.push({
                    id,
                    title: title.substring(0, 100),
                    poster: img ? (img.startsWith('http') ? img : `${BASE_URL}${img}`) : undefined,
                });
            }
        });

        return dramas;
    } catch (error) {
        console.error("Fetch WebApp error:", error);
        return [];
    }
}

/**
 * Search dramas - fetches from WebApp and filters by query
 */
export async function searchDramas(query: string, limit = 50): Promise<Drama[]> {
    // Fetch multiple pages to have more data
    const allDramas: Drama[] = [];

    for (let page = 1; page <= 5; page++) {
        const dramas = await fetchDramasFromWebApp(page);
        allDramas.push(...dramas);
        if (dramas.length === 0) break;
    }

    // Filter by query
    const filtered = query
        ? allDramas.filter(d => d.title.toLowerCase().includes(query.toLowerCase()))
        : allDramas;

    return filtered.slice(0, limit);
}

/**
 * Get all dramas with pagination
 */
export async function getAllDramas(page = 1, perPage = 24): Promise<{ dramas: Drama[]; total: number }> {
    // Calculate which WebApp pages to fetch
    const webAppPage = Math.ceil(page * perPage / 24);
    const dramas = await fetchDramasFromWebApp(webAppPage);

    return {
        dramas: dramas.slice(0, perPage),
        total: 419 * 24, // Approximate total (419 pages)
    };
}

/**
 * Get videos for a drama from chat history
 */
export async function getDramaVideos(dramaId: string): Promise<VideoMessage[]> {
    const client = await getTelegramClient();
    const bot = await client.getEntity(BOT_USERNAME);

    const messages = await client.getMessages(bot, { limit: 1000 });
    const videos: VideoMessage[] = [];

    let foundDrama = false;
    let episodeCount = 0;

    // Look for drama ID in messages
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        const text = msg.message || "";

        // Check if this message mentions our drama ID
        if (text.includes(`Drama ID: ${dramaId}`) || text.includes(`playfirst-${dramaId}`)) {
            foundDrama = true;
            continue;
        }

        // Collect videos after finding the drama
        if (foundDrama) {
            // Stop if we hit another drama marker
            if (text.includes("Drama ID:") || text.includes("playfirst-")) {
                break;
            }

            // Check for video
            if (msg.media && (msg.media as any).document) {
                const doc = (msg.media as any).document;
                const isVideo = doc.mimeType?.startsWith("video/");

                if (isVideo) {
                    episodeCount++;
                    videos.push({
                        messageId: msg.id,
                        title: `Episode ${episodeCount}`,
                        size: doc.size || 0,
                        duration: 0,
                        mimeType: doc.mimeType,
                    });
                }
            }
        }
    }

    return videos;
}

/**
 * Trigger drama and get first video
 */
export async function triggerDrama(dramaId: string, title: string): Promise<boolean> {
    try {
        const client = await getTelegramClient();
        const bot = await client.getEntity(BOT_USERNAME);

        // Send title marker
        await client.sendMessage(bot, {
            message: `🎬 ${title}\n\n📌 Drama ID: ${dramaId}`,
        });

        // Send trigger command
        await client.sendMessage(bot, {
            message: `/start playfirst-${dramaId}`,
        });

        return true;
    } catch (error) {
        console.error("Trigger error:", error);
        return false;
    }
}

/**
 * Stream video from a message
 */
export async function* streamVideo(messageId: number): AsyncGenerator<Buffer> {
    const client = await getTelegramClient();
    const bot = await client.getEntity(BOT_USERNAME);

    const messages = await client.getMessages(bot, { ids: [messageId] });
    if (!messages.length || !messages[0].media) {
        throw new Error("Video not found");
    }

    const msg = messages[0];

    for await (const chunk of client.iterDownload({
        file: msg.media,
        requestSize: 512 * 1024,
    })) {
        yield chunk as Buffer;
    }
}
