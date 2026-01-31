import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { supabaseAdmin } from "./supabase-admin";

const API_ID = parseInt(process.env.TELEGRAM_API_ID || "0");
const API_HASH = process.env.TELEGRAM_API_HASH || "";
const SESSION_STRING = process.env.TELEGRAM_SESSION || "";

let clientInstance: TelegramClient | null = null;

const BOT_USERNAME = "IDShortBot";

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

export interface ScrapedVideo {
    dramaId: string;
    messageId: number;
    episodeNum: number;
    fileSize: number;
    duration: number;
    mimeType: string;
}

export interface ScrapeResult {
    totalDramas: number;
    totalVideos: number;
    dramas: Map<string, { title: string; episodes: number }>;
}

/**
 * Scrape all videos from Telegram chat and save to Supabase
 */
export async function scrapeAndIndexVideos(messageLimit = 3000): Promise<ScrapeResult> {
    console.log("Starting Telegram scrape...");

    const client = await getTelegramClient();
    const bot = await client.getEntity(BOT_USERNAME);

    console.log("Connected to Telegram, fetching messages...");

    const messages = await client.getMessages(bot, { limit: messageLimit });
    console.log(`Fetched ${messages.length} messages`);

    // Track dramas and their videos
    const dramaVideos = new Map<string, ScrapedVideo[]>();
    const dramaTitles = new Map<string, string>();

    let currentDramaId: string | null = null;
    let episodeCounter = 0;

    // Process messages in chronological order (reverse since getMessages returns newest first)
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        const text = msg.message || "";
        const isOutgoing = msg.out; // true if message is from us

        // Look for drama ID triggers (messages we sent)
        // Format: /start playfirst-12345 or just the ID
        const triggerMatch = text.match(/playfirst[-_]?(\d+)/i) ||
            text.match(/\/start\s+(\d+)/i) ||
            text.match(/Drama ID[:\s]+(\d+)/i);

        if (triggerMatch && isOutgoing) {
            currentDramaId = triggerMatch[1];
            episodeCounter = 0;

            // Try to extract title from the same message
            const titleMatch = text.match(/🎬\s*(.+?)[\n\r]/);
            if (titleMatch) {
                dramaTitles.set(currentDramaId, titleMatch[1].trim());
            }

            if (!dramaVideos.has(currentDramaId)) {
                dramaVideos.set(currentDramaId, []);
            }
            continue;
        }

        // Also detect when bot sends drama info (not from us)
        if (!isOutgoing && text.includes("playfirst-")) {
            const match = text.match(/playfirst[-_]?(\d+)/i);
            if (match) {
                currentDramaId = match[1];
                episodeCounter = 0;
                if (!dramaVideos.has(currentDramaId)) {
                    dramaVideos.set(currentDramaId, []);
                }
            }
        }

        // Check if this is a video message from bot
        if (currentDramaId && !isOutgoing && msg.media) {
            const media = msg.media as any;

            // Check if it's a video document
            if (media.document) {
                const doc = media.document;
                const mimeType = doc.mimeType || "";

                if (mimeType.startsWith("video/")) {
                    episodeCounter++;

                    // Get duration from attributes
                    let duration = 0;
                    if (doc.attributes) {
                        for (const attr of doc.attributes) {
                            if (attr.className === "DocumentAttributeVideo") {
                                duration = attr.duration || 0;
                                break;
                            }
                        }
                    }

                    const video: ScrapedVideo = {
                        dramaId: currentDramaId,
                        messageId: msg.id,
                        episodeNum: episodeCounter,
                        fileSize: doc.size || 0,
                        duration,
                        mimeType,
                    };

                    dramaVideos.get(currentDramaId)!.push(video);
                }
            }
        }

        // Reset if we see another user message (new conversation)
        if (isOutgoing && !text.match(/playfirst/i) && !text.match(/Drama ID/i) && text.length > 5) {
            // Keep currentDramaId but reset episode counter for potential new batch
        }
    }

    console.log(`Found ${dramaVideos.size} dramas`);

    // Save to Supabase
    let totalVideosSaved = 0;

    for (const [dramaId, videos] of dramaVideos) {
        if (videos.length === 0) continue;

        // Upsert drama
        const title = dramaTitles.get(dramaId) || `Drama ${dramaId}`;
        await supabaseAdmin.from("dramas").upsert({
            id: dramaId,
            title,
            total_episodes: videos.length,
            updated_at: new Date().toISOString(),
        }, { onConflict: "id" });

        // Upsert videos
        for (const video of videos) {
            const { error } = await supabaseAdmin.from("videos").upsert({
                drama_id: video.dramaId,
                message_id: video.messageId,
                episode_num: video.episodeNum,
                file_size: video.fileSize,
                duration: video.duration,
                mime_type: video.mimeType,
                scraped_at: new Date().toISOString(),
            }, { onConflict: "message_id" });

            if (!error) {
                totalVideosSaved++;
            }
        }
    }

    console.log(`Saved ${totalVideosSaved} videos to database`);

    // Return result
    const result: ScrapeResult = {
        totalDramas: dramaVideos.size,
        totalVideos: totalVideosSaved,
        dramas: new Map(),
    };

    for (const [id, videos] of dramaVideos) {
        result.dramas.set(id, {
            title: dramaTitles.get(id) || `Drama ${id}`,
            episodes: videos.length,
        });
    }

    return result;
}

/**
 * Get videos for a drama from database
 */
export async function getVideosFromDB(dramaId: string): Promise<ScrapedVideo[]> {
    const { data, error } = await supabaseAdmin
        .from("videos")
        .select("*")
        .eq("drama_id", dramaId)
        .order("episode_num", { ascending: true });

    if (error || !data) {
        console.error("Get videos error:", error);
        return [];
    }

    return data.map((v: any) => ({
        dramaId: v.drama_id,
        messageId: v.message_id,
        episodeNum: v.episode_num,
        fileSize: v.file_size,
        duration: v.duration,
        mimeType: v.mime_type,
    }));
}

/**
 * Stream video from Telegram
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

/**
 * Download full video from Telegram
 */
export async function downloadVideo(messageId: number): Promise<Buffer | null> {
    const client = await getTelegramClient();
    const bot = await client.getEntity(BOT_USERNAME);

    const messages = await client.getMessages(bot, { ids: [messageId] });
    if (!messages.length || !messages[0].media) {
        return null;
    }

    const buffer = await client.downloadMedia(messages[0], {});
    return buffer as Buffer;
}

/**
 * Get video info
 */
export async function getVideoInfo(messageId: number): Promise<{ size: number; mimeType: string } | null> {
    const client = await getTelegramClient();
    const bot = await client.getEntity(BOT_USERNAME);

    const messages = await client.getMessages(bot, { ids: [messageId] });
    if (!messages.length || !messages[0].media) {
        return null;
    }

    const media = messages[0].media as any;
    if (media.document) {
        return {
            size: media.document.size || 0,
            mimeType: media.document.mimeType || "video/mp4",
        };
    }

    return null;
}
