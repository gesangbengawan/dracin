require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3001;
const BOT_USERNAME = "IDShortBot";
const CACHE_DIR = path.join(__dirname, "video_cache");
const MAX_CACHED_DRAMAS = 10;

// Create cache directory
if (!fs.existsSync(CACHE_DIR)) {
    fs.mkdirSync(CACHE_DIR, { recursive: true });
}

// Supabase client
const supabase = createClient(
    process.env.SUPABASE_URL || "https://mnjkvwemnlkwzitfzzdd.supabase.co",
    process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_ANON_KEY
);

// LRU cache for downloaded dramas
let downloadedDramas = [];

// CORS
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",");
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin) || origin.includes("vercel.app") || origin.includes("localhost")) {
            callback(null, true);
        } else {
            callback(null, true); // Allow all for now
        }
    },
    credentials: true,
}));
app.use(express.json());

// Telegram client
let client = null;

async function getTelegramClient() {
    if (client && client.connected) return client;
    const session = new StringSession(process.env.TELEGRAM_SESSION);
    client = new TelegramClient(
        session,
        parseInt(process.env.TELEGRAM_API_ID),
        process.env.TELEGRAM_API_HASH,
        { connectionRetries: 5, floodSleepThreshold: 60 }
    );
    await client.connect();
    console.log("Telegram connected!");
    return client;
}

// Get all messages from Telegram (with caching)
let messagesCache = null;
let lastFetchTime = 0;

async function getAllMessages(forceRefresh = false) {
    const now = Date.now();
    if (!forceRefresh && messagesCache && (now - lastFetchTime) < 10 * 60 * 1000) {
        console.log("[CACHE] Using cached messages");
        return messagesCache;
    }

    console.log("[SYNC] Fetching all messages from Telegram...");
    const tg = await getTelegramClient();
    const bot = await tg.getEntity(BOT_USERNAME);

    const allMessages = [];
    let offsetId = 0;

    // Fetch up to 5000 messages (5 batches)
    for (let batch = 0; batch < 5; batch++) {
        try {
            const messages = await tg.getMessages(bot, { limit: 1000, offsetId });
            if (messages.length === 0) break;
            allMessages.push(...messages);
            offsetId = messages[messages.length - 1].id;
            console.log(`[SYNC] Batch ${batch + 1}: ${allMessages.length} total messages`);
            await new Promise(r => setTimeout(r, 1000)); // Delay to avoid flood
        } catch (err) {
            console.log(`[SYNC] Error on batch ${batch + 1}:`, err.message);
            if (err.message.includes("flood")) {
                await new Promise(r => setTimeout(r, 30000)); // Wait 30s on flood
            }
            break;
        }
    }

    messagesCache = allMessages;
    lastFetchTime = now;
    console.log(`[SYNC] Total: ${allMessages.length} messages`);
    return allMessages;
}

// Parse all dramas and videos from messages
function parseDramasFromMessages(messages) {
    const sorted = [...messages].sort((a, b) => a.id - b.id);
    const dramas = new Map(); // dramaId -> { title, videos: [] }

    let currentDramaId = null;
    let currentDramaTitle = "";

    for (const msg of sorted) {
        const text = msg.message || "";

        // Check for drama trigger
        const triggerMatch = text.match(/playfirst-(\d+)/);
        if (triggerMatch) {
            currentDramaId = triggerMatch[1];
            currentDramaTitle = ""; // Will be updated from bot response
            if (!dramas.has(currentDramaId)) {
                dramas.set(currentDramaId, { title: "", videos: [] });
            }
            continue;
        }

        // If we have a current drama and this is a video
        if (currentDramaId && msg.media && msg.media.document) {
            const doc = msg.media.document;
            const mimeType = doc.mimeType || "";

            if (mimeType.startsWith("video/")) {
                let duration = 0;
                let fileName = "";

                if (doc.attributes) {
                    for (const attr of doc.attributes) {
                        if (attr.className === "DocumentAttributeVideo") {
                            duration = attr.duration || 0;
                        }
                        if (attr.className === "DocumentAttributeFilename") {
                            fileName = attr.fileName || "";
                        }
                    }
                }

                const drama = dramas.get(currentDramaId);
                drama.videos.push({
                    messageId: msg.id,
                    episode: drama.videos.length + 1,
                    size: Number(doc.size || 0),
                    duration,
                    fileName,
                });

                // Extract title from filename if not set
                if (!drama.title && fileName) {
                    const titleMatch = fileName.match(/^(.+?)\s+part\s+\d+/i);
                    if (titleMatch) {
                        drama.title = titleMatch[1].trim();
                    }
                }
            }
        }
    }

    return dramas;
}

// Sync to Supabase
async function syncToSupabase(dramas) {
    console.log(`[SYNC] Syncing ${dramas.size} dramas to Supabase...`);

    let synced = 0;
    let videos = 0;

    for (const [dramaId, data] of dramas) {
        try {
            // Upsert drama
            await supabase.from("dramas").upsert({
                id: dramaId,
                title: data.title || `Drama ${dramaId}`,
                total_episodes: data.videos.length,
                updated_at: new Date().toISOString(),
            }, { onConflict: "id" });

            // Upsert videos
            for (const video of data.videos) {
                await supabase.from("videos").upsert({
                    drama_id: dramaId,
                    message_id: video.messageId,
                    episode_num: video.episode,
                    file_size: video.size,
                    duration: video.duration,
                }, { onConflict: "message_id" });
                videos++;
            }

            synced++;
        } catch (err) {
            console.log(`[SYNC] Error syncing drama ${dramaId}:`, err.message);
        }
    }

    console.log(`[SYNC] Done! ${synced} dramas, ${videos} videos`);
    return { dramas: synced, videos };
}

// Health check
app.get("/", (req, res) => {
    res.json({
        status: "ok",
        version: "v6",
        cachedMessages: messagesCache ? messagesCache.length : 0,
        downloadedDramas: downloadedDramas.length,
    });
});

// Full sync endpoint
app.post("/api/sync", async (req, res) => {
    try {
        const messages = await getAllMessages(true);
        const dramas = parseDramasFromMessages(messages);
        const result = await syncToSupabase(dramas);
        res.json({
            success: true,
            totalMessages: messages.length,
            ...result,
        });
    } catch (err) {
        console.error("[SYNC] Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Get videos for drama (from Telegram)
app.get("/api/videos/:dramaId", async (req, res) => {
    const dramaId = req.params.dramaId;
    console.log(`[API] Videos for drama ${dramaId}`);

    try {
        // First check Supabase
        const { data: dbVideos } = await supabase
            .from("videos")
            .select("*")
            .eq("drama_id", dramaId)
            .order("episode_num");

        if (dbVideos && dbVideos.length > 0) {
            console.log(`[API] Found ${dbVideos.length} videos in database`);

            // Start pre-download in background
            preDownloadDrama(dramaId, dbVideos.map(v => ({
                messageId: v.message_id,
                episode: v.episode_num,
                size: v.file_size,
            }))).catch(err => console.log("[BG]", err.message));

            return res.json({
                dramaId,
                videos: dbVideos.map(v => ({
                    messageId: v.message_id,
                    episode: v.episode_num,
                    size: v.file_size,
                    duration: v.duration,
                })),
                total: dbVideos.length,
                source: "database",
            });
        }

        // Not in DB, search Telegram
        console.log(`[API] Searching Telegram for drama ${dramaId}...`);
        const messages = await getAllMessages();
        const dramas = parseDramasFromMessages(messages);
        const drama = dramas.get(dramaId);

        if (!drama || drama.videos.length === 0) {
            return res.json({
                dramaId,
                videos: [],
                total: 0,
                message: `Drama ${dramaId} tidak ditemukan. Trigger dari Telegram: /start playfirst-${dramaId}`,
            });
        }

        // Save to database
        await syncToSupabase(new Map([[dramaId, drama]]));

        // Start pre-download in background
        preDownloadDrama(dramaId, drama.videos).catch(err => console.log("[BG]", err.message));

        res.json({
            dramaId,
            title: drama.title,
            videos: drama.videos,
            total: drama.videos.length,
            source: "telegram",
        });
    } catch (err) {
        console.error("[API] Error:", err);
        res.status(500).json({ error: err.message });
    }
});

// Pre-download drama videos
async function preDownloadDrama(dramaId, videos) {
    const dramaDir = path.join(CACHE_DIR, dramaId);
    if (!fs.existsSync(dramaDir)) {
        fs.mkdirSync(dramaDir, { recursive: true });
    }

    // Check if already in LRU
    if (downloadedDramas.includes(dramaId)) {
        downloadedDramas = downloadedDramas.filter(id => id !== dramaId);
        downloadedDramas.push(dramaId);
        return;
    }

    console.log(`[DOWNLOAD] Pre-downloading drama ${dramaId} (${videos.length} videos)...`);
    const tg = await getTelegramClient();
    const bot = await tg.getEntity(BOT_USERNAME);

    for (const video of videos) {
        const videoFile = path.join(dramaDir, `${video.messageId}.mp4`);
        if (fs.existsSync(videoFile)) continue;

        try {
            console.log(`[DOWNLOAD] Ep ${video.episode}...`);
            const msgs = await tg.getMessages(bot, { ids: [video.messageId] });
            if (msgs.length && msgs[0].media) {
                const buffer = await tg.downloadMedia(msgs[0], {});
                fs.writeFileSync(videoFile, buffer);
                console.log(`[DOWNLOAD] Saved: ${videoFile}`);
            }
        } catch (err) {
            console.log(`[DOWNLOAD] Error:`, err.message);
        }
    }

    // Add to LRU and cleanup old
    downloadedDramas.push(dramaId);
    while (downloadedDramas.length > MAX_CACHED_DRAMAS) {
        const oldId = downloadedDramas.shift();
        const oldDir = path.join(CACHE_DIR, oldId);
        if (fs.existsSync(oldDir)) {
            fs.readdirSync(oldDir).forEach(f => fs.unlinkSync(path.join(oldDir, f)));
            fs.rmdirSync(oldDir);
            console.log(`[CLEANUP] Removed drama ${oldId}`);
        }
    }

    console.log(`[DOWNLOAD] Drama ${dramaId} complete!`);
}

// Stream video
app.get("/api/stream/:messageId", async (req, res) => {
    const msgId = parseInt(req.params.messageId);
    console.log(`[STREAM] ${msgId}`);

    try {
        // Find in cache
        const dirs = fs.readdirSync(CACHE_DIR).filter(f =>
            fs.statSync(path.join(CACHE_DIR, f)).isDirectory()
        );

        for (const dir of dirs) {
            const file = path.join(CACHE_DIR, dir, `${msgId}.mp4`);
            if (fs.existsSync(file)) {
                console.log(`[STREAM] From cache: ${file}`);
                const stat = fs.statSync(file);
                const size = stat.size;
                const range = req.headers.range;

                if (range) {
                    const parts = range.replace(/bytes=/, "").split("-");
                    const start = parseInt(parts[0], 10);
                    const end = parts[1] ? parseInt(parts[1], 10) : size - 1;
                    res.writeHead(206, {
                        "Content-Range": `bytes ${start}-${end}/${size}`,
                        "Accept-Ranges": "bytes",
                        "Content-Length": end - start + 1,
                        "Content-Type": "video/mp4",
                    });
                    fs.createReadStream(file, { start, end }).pipe(res);
                } else {
                    res.writeHead(200, { "Content-Length": size, "Content-Type": "video/mp4", "Accept-Ranges": "bytes" });
                    fs.createReadStream(file).pipe(res);
                }
                return;
            }
        }

        // Not in cache - download from Telegram
        console.log(`[STREAM] Downloading from Telegram...`);
        const tg = await getTelegramClient();
        const bot = await tg.getEntity(BOT_USERNAME);
        const msgs = await tg.getMessages(bot, { ids: [msgId] });

        if (!msgs.length || !msgs[0].media) {
            return res.status(404).json({ error: "Not found" });
        }

        const buffer = await tg.downloadMedia(msgs[0], {});

        // Save to temp
        const tempFile = path.join(CACHE_DIR, `temp_${msgId}.mp4`);
        fs.writeFileSync(tempFile, buffer);

        const size = buffer.length;
        const range = req.headers.range;
        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : size - 1;
            res.writeHead(206, {
                "Content-Range": `bytes ${start}-${end}/${size}`,
                "Accept-Ranges": "bytes",
                "Content-Length": end - start + 1,
                "Content-Type": "video/mp4",
            });
            fs.createReadStream(tempFile, { start, end }).pipe(res);
        } else {
            res.writeHead(200, { "Content-Length": size, "Content-Type": "video/mp4", "Accept-Ranges": "bytes" });
            fs.createReadStream(tempFile).pipe(res);
        }

        // Cleanup temp after 30 min
        setTimeout(() => {
            if (fs.existsSync(tempFile)) fs.unlinkSync(tempFile);
        }, 30 * 60 * 1000);

    } catch (err) {
        console.error("[STREAM] Error:", err);
        if (!res.headersSent) res.status(500).json({ error: err.message });
    }
});

// Download
app.get("/api/download/:messageId", async (req, res) => {
    const msgId = parseInt(req.params.messageId);

    try {
        // Check cache
        const dirs = fs.readdirSync(CACHE_DIR).filter(f =>
            fs.statSync(path.join(CACHE_DIR, f)).isDirectory()
        );

        for (const dir of dirs) {
            const file = path.join(CACHE_DIR, dir, `${msgId}.mp4`);
            if (fs.existsSync(file)) {
                res.setHeader("Content-Type", "video/mp4");
                res.setHeader("Content-Disposition", `attachment; filename="video_${msgId}.mp4"`);
                fs.createReadStream(file).pipe(res);
                return;
            }
        }

        // Download from Telegram
        const tg = await getTelegramClient();
        const bot = await tg.getEntity(BOT_USERNAME);
        const msgs = await tg.getMessages(bot, { ids: [msgId] });
        if (!msgs.length || !msgs[0].media) return res.status(404).json({ error: "Not found" });

        const buffer = await tg.downloadMedia(msgs[0], {});
        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Content-Disposition", `attachment; filename="video_${msgId}.mp4"`);
        res.send(buffer);
    } catch (err) {
        console.error("[DOWNLOAD]", err);
        res.status(500).json({ error: err.message });
    }
});

// List all synced dramas
app.get("/api/dramas", async (req, res) => {
    try {
        const { data, error } = await supabase
            .from("dramas")
            .select("id, title, total_episodes, poster_url")
            .order("id", { ascending: false });

        if (error) throw error;

        res.json({ dramas: data, total: data.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start server
app.listen(PORT, "0.0.0.0", async () => {
    console.log(`=== Dracin Video Server v6 ===`);
    console.log(`Port: ${PORT}`);
    console.log(`Max cached dramas: ${MAX_CACHED_DRAMAS}`);

    try {
        await getTelegramClient();
        console.log("Telegram: READY");

        // Initial sync on startup
        console.log("Starting initial sync...");
        const messages = await getAllMessages();
        const dramas = parseDramasFromMessages(messages);
        await syncToSupabase(dramas);
        console.log("Initial sync complete!");
    } catch (err) {
        console.error("Startup error:", err.message);
    }
});
