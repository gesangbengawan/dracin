import { TelegramClient } from "telegram";
import { StringSession } from "telegram/sessions";

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

export interface VideoInfo {
    messageId: number;
    dramaId: string;
    episodeNum: number;
    size: number;
    mimeType: string;
    duration: number;
    thumbUrl?: string;
}

export interface DramaVideoIndex {
    dramaId: string;
    title: string;
    videos: VideoInfo[];
}

/**
 * Scrape all videos from Telegram chat and index by drama ID
 */
export async function scrapeAllVideos(limit = 2000): Promise<Map<string, DramaVideoIndex>> {
    const client = await getTelegramClient();
    const bot = await client.getEntity(BOT_USERNAME);

    const index = new Map<string, DramaVideoIndex>();
    let currentDramaId: string | null = null;
    let currentTitle = "";
    let episodeCounter = 0;

    // Get messages (newest first, so we iterate in reverse)
    const messages = await client.getMessages(bot, { limit });

    // Process in chronological order (oldest first)
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        const text = msg.message || "";

        // Detect drama title message (sent by us)
        const idMatch = text.match(/Drama ID[:\s]+(\d+)/i) ||
            text.match(/playfirst-(\d+)/);

        if (idMatch) {
            currentDramaId = idMatch[1];
            episodeCounter = 0;

            // Extract title
            const titleMatch = text.match(/🎬\s*(.+?)[\n\r]/);
            currentTitle = titleMatch ? titleMatch[1].trim() : `Drama ${currentDramaId}`;

            if (!index.has(currentDramaId)) {
                index.set(currentDramaId, {
                    dramaId: currentDramaId,
                    title: currentTitle,
                    videos: [],
                });
            }
            continue;
        }

        // Detect video message (from bot)
        if (currentDramaId && msg.media) {
            const media = msg.media as any;

            // Check if it's a document (video)
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

                    const videoInfo: VideoInfo = {
                        messageId: msg.id,
                        dramaId: currentDramaId,
                        episodeNum: episodeCounter,
                        size: doc.size || 0,
                        mimeType,
                        duration,
                    };

                    const dramaData = index.get(currentDramaId);
                    if (dramaData) {
                        dramaData.videos.push(videoInfo);
                    }
                }
            }
        }
    }

    return index;
}

/**
 * Get videos for a specific drama ID
 */
export async function getVideosForDrama(dramaId: string): Promise<VideoInfo[]> {
    const client = await getTelegramClient();
    const bot = await client.getEntity(BOT_USERNAME);

    const videos: VideoInfo[] = [];
    let foundDrama = false;
    let episodeCounter = 0;

    const messages = await client.getMessages(bot, { limit: 2000 });

    // Process chronologically
    for (let i = messages.length - 1; i >= 0; i--) {
        const msg = messages[i];
        const text = msg.message || "";

        // Check for drama ID marker
        if (text.includes(`playfirst-${dramaId}`) || text.includes(`Drama ID: ${dramaId}`)) {
            foundDrama = true;
            episodeCounter = 0;
            continue;
        }

        // If we found the drama, collect videos
        if (foundDrama) {
            // Stop if we hit another drama
            if (text.match(/playfirst-\d+/) || text.match(/Drama ID:\s*\d+/)) {
                break;
            }

            // Check for video
            if (msg.media) {
                const media = msg.media as any;
                if (media.document && media.document.mimeType?.startsWith("video/")) {
                    episodeCounter++;
                    const doc = media.document;

                    let duration = 0;
                    if (doc.attributes) {
                        for (const attr of doc.attributes) {
                            if (attr.className === "DocumentAttributeVideo") {
                                duration = attr.duration || 0;
                            }
                        }
                    }

                    videos.push({
                        messageId: msg.id,
                        dramaId,
                        episodeNum: episodeCounter,
                        size: doc.size || 0,
                        mimeType: doc.mimeType,
                        duration,
                    });
                }
            }
        }
    }

    return videos;
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
        requestSize: 512 * 1024, // 512KB chunks
    })) {
        yield chunk as Buffer;
    }
}

/**
 * Get video file info
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
