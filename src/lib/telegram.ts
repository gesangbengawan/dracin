import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";
import { Api } from "telegram/tl";

const API_ID = parseInt(process.env.TELEGRAM_API_ID || "0");
const API_HASH = process.env.TELEGRAM_API_HASH || "";
const SESSION_STRING = process.env.TELEGRAM_SESSION || "";

let clientInstance: TelegramClient | null = null;

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
    messageId: number;
    date: Date;
    hasVideo: boolean;
    videoSize?: number;
}

export interface VideoMessage {
    messageId: number;
    title: string;
    size: number;
    duration: number;
    mimeType: string;
}

const BOT_USERNAME = "IDShortBot";

/**
 * Search dramas from chat history with bot
 */
export async function searchDramas(query: string, limit = 50): Promise<Drama[]> {
    const client = await getTelegramClient();
    const bot = await client.getEntity(BOT_USERNAME);

    const results: Drama[] = [];

    // Get messages from bot chat
    const messages = await client.getMessages(bot, { limit: 500 });

    for (const msg of messages) {
        const text = msg.message || "";

        // Look for our title messages (🎬 Title format)
        if (text.startsWith("🎬 ") && text.includes("Drama ID:")) {
            const titleMatch = text.match(/🎬 (.+?)[\n\r]/);
            const idMatch = text.match(/Drama ID: (\d+)/);

            if (titleMatch && idMatch) {
                const title = titleMatch[1].trim();
                const dramaId = idMatch[1];

                // Check if query matches
                if (query === "" || title.toLowerCase().includes(query.toLowerCase())) {
                    results.push({
                        id: dramaId,
                        title,
                        messageId: msg.id,
                        date: new Date(msg.date * 1000),
                        hasVideo: false, // Will check next messages
                    });
                }
            }
        }
    }

    return results.slice(0, limit);
}

/**
 * Get videos for a specific drama (messages after the title)
 */
export async function getDramaVideos(dramaId: string): Promise<VideoMessage[]> {
    const client = await getTelegramClient();
    const bot = await client.getEntity(BOT_USERNAME);

    const messages = await client.getMessages(bot, { limit: 500 });
    const videos: VideoMessage[] = [];

    let foundDrama = false;
    let episodeCount = 0;

    // Messages are in reverse chronological order
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        const text = msg.message || "";

        // Find the drama title message
        if (text.includes(`Drama ID: ${dramaId}`)) {
            foundDrama = true;
            continue;
        }

        // If we found the drama, collect video messages until next title
        if (foundDrama) {
            // Check if this is a new drama title (stop collecting)
            if (text.startsWith("🎬 ") && text.includes("Drama ID:")) {
                break;
            }

            // Check if message has video
            if (msg.media && (msg.media as any).document) {
                const doc = (msg.media as any).document;
                const isVideo = doc.mimeType?.startsWith("video/");

                if (isVideo) {
                    episodeCount++;
                    videos.push({
                        messageId: msg.id,
                        title: `Episode ${episodeCount}`,
                        size: doc.size || 0,
                        duration: 0, // TODO: extract from attributes
                        mimeType: doc.mimeType,
                    });
                }
            }
        }
    }

    return videos;
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

    // Download and yield chunks
    for await (const chunk of client.iterDownload({
        file: msg.media,
        requestSize: 512 * 1024, // 512KB chunks
    })) {
        yield chunk as Buffer;
    }
}

/**
 * Get all unique dramas from chat (for browsing)
 */
export async function getAllDramas(page = 1, perPage = 20): Promise<{ dramas: Drama[]; total: number }> {
    const client = await getTelegramClient();
    const bot = await client.getEntity(BOT_USERNAME);

    const allDramas: Drama[] = [];
    const seenIds = new Set<string>();

    // Iterate through messages
    for await (const msg of client.iterMessages(bot, { limit: 1000 })) {
        const text = msg.message || "";

        if (text.startsWith("🎬 ") && text.includes("Drama ID:")) {
            const titleMatch = text.match(/🎬 (.+?)[\n\r]/);
            const idMatch = text.match(/Drama ID: (\d+)/);

            if (titleMatch && idMatch && !seenIds.has(idMatch[1])) {
                seenIds.add(idMatch[1]);
                allDramas.push({
                    id: idMatch[1],
                    title: titleMatch[1].trim(),
                    messageId: msg.id,
                    date: new Date(msg.date * 1000),
                    hasVideo: true,
                });
            }
        }
    }

    const start = (page - 1) * perPage;
    return {
        dramas: allDramas.slice(start, start + perPage),
        total: allDramas.length,
    };
}
