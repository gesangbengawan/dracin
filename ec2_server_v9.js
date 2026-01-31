require("dotenv").config();
const express = require("express");
const cors = require("cors");
const fs = require("fs");
const path = require("path");
const { execSync, spawn } = require("child_process");
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");
const { createClient } = require("@supabase/supabase-js");

const app = express();
const PORT = process.env.PORT || 3001;
const BOT_USERNAME = "IDShortBot";
const VIDEO_DIR = "/home/ubuntu/videos";
const COMPRESSED_DIR = "/home/ubuntu/videos_compressed";
const DRAMAS_JSON = "/home/ubuntu/dracin-backend/dramas.json";
const PROGRESS_FILE = "/home/ubuntu/dracin-backend/download_progress.json";

// Create directories
[VIDEO_DIR, COMPRESSED_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Supabase
const supabase = createClient(
    process.env.SUPABASE_URL || "https://mnjkvwemnlkwzitfzzdd.supabase.co",
    process.env.SUPABASE_SERVICE_KEY
);

// Download state
let isDownloading = false;
let currentDrama = null;
let downloadStats = {
    total: 0,
    done: 0,
    failed: 0,
    currentDramaId: null,
    currentVideo: null,
    startTime: null
};

// Priority Queue
let priorityQueue = [];

// Load/save progress
function loadProgress() {
    if (fs.existsSync(PROGRESS_FILE)) {
        return JSON.parse(fs.readFileSync(PROGRESS_FILE, "utf8"));
    }
    return { lastDramaIndex: 0, completedDramas: [] };
}

function saveProgress(progress) {
    fs.writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

// CORS
app.use(cors());
app.use(express.json());

// Serve static video files directly
app.use("/videos", express.static(COMPRESSED_DIR));

// Download directly from server (local file)
app.get("/api/download/:dramaId/:episode", (req, res) => {
    const { dramaId, episode } = req.params;
    const videoPath = path.join(COMPRESSED_DIR, dramaId, `ep${episode}.mp4`);

    if (!fs.existsSync(videoPath)) {
        return res.status(404).json({ error: "File not found" });
    }

    res.download(videoPath, `drama_${dramaId}_ep${episode}.mp4`);
});

// Telegram client
let client = null;

async function getTelegramClient() {
    if (client && client.connected) return client;
    const session = new StringSession(process.env.TELEGRAM_SESSION);
    client = new TelegramClient(
        session,
        parseInt(process.env.TELEGRAM_API_ID),
        process.env.TELEGRAM_API_HASH,
        { connectionRetries: 5, floodSleepThreshold: 300 }
    );
    await client.connect();
    console.log("Telegram connected!");
    return client;
}

// Trigger drama and get videos from Telegram
async function triggerDramaAndGetVideos(dramaId, expectedEpisodes) {
    const tg = await getTelegramClient();
    const bot = await tg.getEntity(BOT_USERNAME);

    // Send trigger command
    console.log(`[TRIGGER] Sending /start playfirst-${dramaId}...`);
    await tg.sendMessage(bot, { message: `/start playfirst-${dramaId}` });

    // Wait for bot to respond with videos
    await new Promise(r => setTimeout(r, 5000));

    // Get recent messages to find videos
    const messages = await tg.getMessages(bot, { limit: 50 });
    const videos = [];

    for (const msg of messages) {
        if (msg.media && msg.media.document) {
            const mimeType = msg.media.document.mimeType || "";
            if (mimeType.startsWith("video/")) {
                let duration = 0;
                if (msg.media.document.attributes) {
                    for (const attr of msg.media.document.attributes) {
                        if (attr.className === "DocumentAttributeVideo") {
                            duration = attr.duration || 0;
                        }
                    }
                }
                videos.push({
                    messageId: msg.id,
                    size: Number(msg.media.document.size || 0),
                    duration,
                });
            }
        }
        // Stop when we have enough videos
        if (videos.length >= expectedEpisodes) break;
    }

    console.log(`[TRIGGER] Found ${videos.length} videos for drama ${dramaId}`);
    return videos.reverse(); // Reverse to get episode order
}

// Compress video with ffmpeg
function compressVideo(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        const args = [
            "-i", inputPath,
            "-c:v", "libx264",
            "-crf", "32",
            "-preset", "fast",
            "-c:a", "aac",
            "-b:a", "64k",
            "-movflags", "+faststart",
            "-y",
            outputPath
        ];

        const ffmpeg = spawn("ffmpeg", args);
        let stderr = "";

        ffmpeg.stderr.on("data", (data) => {
            stderr += data.toString();
        });

        ffmpeg.on("close", (code) => {
            if (code === 0) {
                resolve(outputPath);
            } else {
                reject(new Error(`ffmpeg error: ${stderr.slice(-500)}`));
            }
        });
    });
}

// Process one drama
async function processDrama(drama) {
    const dramaId = drama.id;
    const expectedEpisodes = drama.episodes;
    currentDrama = drama;
    downloadStats.currentDramaId = dramaId;

    console.log(`\n=== Processing Drama ${dramaId}: ${drama.title} (${expectedEpisodes} eps) ===`);

    const dramaDir = path.join(COMPRESSED_DIR, dramaId);
    if (!fs.existsSync(dramaDir)) fs.mkdirSync(dramaDir, { recursive: true });

    // Check if already completed
    const existingFiles = fs.existsSync(dramaDir) ? fs.readdirSync(dramaDir) : [];
    if (existingFiles.filter(f => f.endsWith(".mp4")).length >= expectedEpisodes) {
        console.log(`[SKIP] Drama ${dramaId} already has sufficient episodes`);
        downloadStats.done += expectedEpisodes;
        return true;
    }

    try {
        // Trigger and get videos
        const videos = await triggerDramaAndGetVideos(dramaId, expectedEpisodes);

        if (videos.length === 0) {
            console.log(`[WARN] No videos found for drama ${dramaId}`);
            return false;
        }

        // Download and compress each video
        const tg = await getTelegramClient();
        const bot = await tg.getEntity(BOT_USERNAME);

        for (let i = 0; i < videos.length; i++) {
            const episode = i + 1;
            const video = videos[i];
            const compressedPath = path.join(dramaDir, `ep${episode}.mp4`);

            downloadStats.currentVideo = `Ep ${episode} (msg: ${video.messageId})`;

            // Skip if already exists
            if (fs.existsSync(compressedPath)) {
                console.log(`[SKIP] Ep ${episode} already exists`);
                downloadStats.done++;
                continue;
            }

            const rawPath = path.join(VIDEO_DIR, `${dramaId}_ep${episode}_raw.mp4`);

            try {
                console.log(`[DOWNLOAD] Ep ${episode} (msg: ${video.messageId})...`);

                // Download from Telegram
                const msgs = await tg.getMessages(bot, { ids: [video.messageId] });
                if (!msgs.length || !msgs[0].media) {
                    console.log(`[ERROR] Message ${video.messageId} not found`);
                    downloadStats.failed++;
                    continue;
                }

                const buffer = await tg.downloadMedia(msgs[0], {});
                fs.writeFileSync(rawPath, buffer);
                const rawSize = buffer.length / (1024 * 1024);
                console.log(`[DOWNLOAD] Raw: ${rawSize.toFixed(0)} MB`);

                // Compress
                console.log(`[COMPRESS] Compressing...`);
                await compressVideo(rawPath, compressedPath);

                const compressedSize = fs.statSync(compressedPath).size / (1024 * 1024);
                console.log(`[COMPRESS] Done: ${compressedSize.toFixed(0)} MB (${(rawSize / compressedSize).toFixed(1)}x smaller)`);

                // Delete raw file
                fs.unlinkSync(rawPath);

                // Save to Supabase
                await supabase.from("videos").upsert({
                    drama_id: dramaId,
                    message_id: video.messageId,
                    episode_num: episode,
                    file_size: video.size,
                    compressed_size: Math.round(compressedSize * 1024 * 1024),
                    duration: video.duration,
                    compressed: true,
                }, { onConflict: "message_id" });

                downloadStats.done++;

                // Wait between episodes
                console.log(`[WAIT] Waiting 5s...`);
                await new Promise(r => setTimeout(r, 5000));

            } catch (err) {
                console.error(`[ERROR] Ep ${episode}:`, err.message);
                downloadStats.failed++;

                if (err.message.includes("flood")) {
                    console.log(`[FLOOD] Waiting 5 minutes...`);
                    await new Promise(r => setTimeout(r, 300000));
                }
            }
        }

        // Update drama in Supabase
        await supabase.from("dramas").upsert({
            id: dramaId,
            title: drama.title,
            total_episodes: expectedEpisodes,
        }, { onConflict: "id" });

        return true;

    } catch (err) {
        console.error(`[ERROR] Drama ${dramaId}:`, err.message);

        if (err.message.includes("flood")) {
            console.log(`[FLOOD] Waiting 5 minutes...`);
            await new Promise(r => setTimeout(r, 300000));
        }

        return false;
    }
}

// Main download process
async function startDownloadFromJSON() {
    if (isDownloading) return;
    isDownloading = true;
    downloadStats.startTime = new Date();

    // Load dramas from JSON
    const jsonData = JSON.parse(fs.readFileSync(DRAMAS_JSON, "utf8"));
    const dramas = jsonData.dramas_done;

    // Load progress
    let progress = loadProgress();

    console.log(`\n=== Starting Download Loop ===`);
    console.log(`Total dramas: ${dramas.length}`);

    // Loop until we are done or stopped
    while (true) {
        // 1. Check Priority Queue first
        if (priorityQueue.length > 0) {
            const priorityId = priorityQueue.shift();
            // Find drama in JSON
            const drama = dramas.find(d => d.id === priorityId);
            if (drama) {
                console.log(`[PRIORITY] Processing prioritised drama ${drama.title} (${drama.id})`);
                const success = await processDrama(drama);
                if (success) {
                    progress = loadProgress(); // Reload to be safe
                    if (!progress.completedDramas.includes(drama.id)) {
                        progress.completedDramas.push(drama.id);
                        saveProgress(progress);
                    }
                }
                continue;
            }
        }

        // 2. Normal flow
        progress = loadProgress(); // Ensure fresh progress
        if (progress.lastDramaIndex >= dramas.length) {
            console.log("All dramas processed!");
            break;
        }

        const drama = dramas[progress.lastDramaIndex];

        // Skip if already completed (or was processed by priority)
        if (progress.completedDramas.includes(drama.id)) {
            progress.lastDramaIndex++;
            saveProgress(progress);
            continue;
        }

        // If this drama is currently in priority queue (duplicate), remove it from priority
        if (priorityQueue.includes(drama.id)) {
            priorityQueue = priorityQueue.filter(id => id !== drama.id);
        }

        const success = await processDrama(drama);
        if (success) {
            progress.completedDramas.push(drama.id);
        }

        progress.lastDramaIndex++;
        saveProgress(progress);

        // Wait between dramas
        console.log(`[WAIT] Waiting 5s before next drama...`);
        await new Promise(r => setTimeout(r, 5000));
    }

    isDownloading = false;
    console.log(`\n=== Download Complete ===`);
}

// API Endpoints

// Prioritize drama endpoint
app.post("/api/prioritize/:dramaId", (req, res) => {
    const { dramaId } = req.params;
    if (!priorityQueue.includes(dramaId) && downloadStats.currentDramaId !== dramaId) {
        priorityQueue.push(dramaId);
        console.log(`[PRIORITY] Added drama ${dramaId} to queue`);
        return res.json({ message: "Added to priority queue", position: priorityQueue.length });
    }
    res.json({ message: "Already in queue or processing" });
});

// Detailed status endpoint
app.get("/api/status", (req, res) => {
    try {
        const df = execSync("df -h /home/ubuntu | tail -1 | awk '{print $4}'").toString().trim(); // Free space
        const mem = execSync("free -h | grep Mem | awk '{print $3 \"/\" $2}'").toString().trim();
        const uptime = execSync("uptime -p").toString().trim();
        const progress = loadProgress();

        res.json({
            status: "running",
            version: "v9-auto-priority",
            isDownloading,
            currentProcessing: downloadStats.currentDramaId,
            currentVideo: downloadStats.currentVideo,
            startTime: downloadStats.startTime,
            priorityQueue,
            progress: {
                processed: progress.lastDramaIndex,
                total: 9984,
                completedCount: progress.completedDramas.length
            },
            system: {
                diskFree: df,
                memory: mem,
                uptime: uptime
            }
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/videos/:dramaId", async (req, res) => {
    const dramaId = req.params.dramaId;

    // Trigger priority in background
    if (!priorityQueue.includes(dramaId) && downloadStats.currentDramaId !== dramaId) {
        priorityQueue.push(dramaId);
        console.log(`[AUTO-PRIORITY] User viewed drama ${dramaId}`);
    }

    try {
        const dramaDir = path.join(COMPRESSED_DIR, dramaId);
        if (fs.existsSync(dramaDir)) {
            const files = fs.readdirSync(dramaDir).filter(f => f.endsWith(".mp4"));
            if (files.length > 0) {
                const videos = files.map(f => {
                    const ep = parseInt(f.match(/ep(\d+)/)?.[1] || 0);
                    const stat = fs.statSync(path.join(dramaDir, f));
                    return { episode: ep, size: stat.size, ready: true };
                }).sort((a, b) => a.episode - b.episode);
                return res.json({ dramaId, videos, total: videos.length, source: "local" });
            }
        }

        // Fallback to database
        const { data: dbVideos } = await supabase
            .from("videos")
            .select("*")
            .eq("drama_id", dramaId)
            .order("episode_num");

        if (dbVideos && dbVideos.length > 0) {
            const videos = dbVideos.map(v => ({
                messageId: v.message_id,
                episode: v.episode_num,
                size: v.compressed_size || v.file_size,
                duration: v.duration,
                ready: v.compressed,
            }));
            return res.json({ dramaId, videos, total: videos.length, source: "database" });
        }

        res.json({ dramaId, videos: [], total: 0, message: "Drama queued for download." });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/stream/:dramaId/:episode", async (req, res) => {
    const { dramaId, episode } = req.params;

    // Prioritize if streaming
    if (!priorityQueue.includes(dramaId) && downloadStats.currentDramaId !== dramaId) {
        priorityQueue.push(dramaId);
    }

    const videoPath = path.join(COMPRESSED_DIR, dramaId, `ep${episode}.mp4`);
    if (!fs.existsSync(videoPath)) return res.status(404).json({ error: "Video not ready" });

    const stat = fs.statSync(videoPath);
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
        fs.createReadStream(videoPath, { start, end }).pipe(res);
    } else {
        res.writeHead(200, {
            "Content-Length": size,
            "Content-Type": "video/mp4",
            "Accept-Ranges": "bytes",
        });
        fs.createReadStream(videoPath).pipe(res);
    }
});

app.get("/api/stream/:messageId", async (req, res) => {
    const messageId = parseInt(req.params.messageId);
    try {
        const { data: video } = await supabase
            .from("videos")
            .select("*")
            .eq("message_id", messageId)
            .single();

        if (video) {
            // Prioritize parent drama
            if (!priorityQueue.includes(video.drama_id) && downloadStats.currentDramaId !== video.drama_id) {
                priorityQueue.push(video.drama_id);
            }

            const videoPath = path.join(COMPRESSED_DIR, video.drama_id, `ep${video.episode_num}.mp4`);
            if (fs.existsSync(videoPath)) {
                // Stream local file code...
                const stat = fs.statSync(videoPath);
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
                    fs.createReadStream(videoPath, { start, end }).pipe(res);
                } else {
                    res.writeHead(200, { "Content-Length": size, "Content-Type": "video/mp4", "Accept-Ranges": "bytes" });
                    fs.createReadStream(videoPath).pipe(res);
                }
                return;
            }
        }

        // On-demand download fallback
        console.log(`[STREAM] On-demand download ${messageId}...`);
        const tg = await getTelegramClient();
        const bot = await tg.getEntity(BOT_USERNAME);
        const msgs = await tg.getMessages(bot, { ids: [messageId] });
        if (!msgs.length || !msgs[0].media) return res.status(404).json({ error: "Video not found" });
        const buffer = await tg.downloadMedia(msgs[0], {});
        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Content-Length", buffer.length);
        res.send(buffer);

    } catch (err) {
        console.error("[STREAM] Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/start-download", async (req, res) => {
    if (isDownloading) return res.json({ message: "Already downloading", stats: downloadStats });
    startDownloadFromJSON().catch(err => { console.error("[DOWNLOAD] Error:", err.message); isDownloading = false; });
    res.json({ message: "Download started", stats: downloadStats });
});

app.get("/api/download-status", (req, res) => {
    const progress = loadProgress();
    res.json({ isDownloading, currentDrama, stats: downloadStats, progress: { lastIndex: progress.lastDramaIndex, completed: progress.completedDramas.length } });
});

// Get queue details
app.get("/api/queue", (req, res) => {
    try {
        const progress = loadProgress();
        const jsonData = JSON.parse(fs.readFileSync(DRAMAS_JSON, "utf8"));
        const dramas = jsonData.dramas_done;

        // Get details for priority queue items
        const priorityDetails = priorityQueue.map(id => {
            const d = dramas.find(x => x.id === id);
            return d ? { id: d.id, title: d.title, episodes: d.episodes, source: "priority" } : { id, title: "Unknown", source: "priority" };
        });

        // Get next 10 from normal queue
        const nextInQueue = [];
        let count = 0;
        let idx = progress.lastDramaIndex;

        while (count < 10 && idx < dramas.length) {
            const d = dramas[idx];
            // Skip if in priority queue (to avoid duplicate view)
            if (!priorityQueue.includes(d.id) && !progress.completedDramas.includes(d.id)) {
                nextInQueue.push({
                    id: d.id,
                    title: d.title,
                    episodes: d.episodes,
                    index: idx,
                    source: "normal"
                });
                count++;
            }
            idx++;
        }

        res.json({
            current: {
                id: downloadStats.currentDramaId,
                title: currentDrama ? currentDrama.title : "Unknown",
                video: downloadStats.currentVideo,
                status: isDownloading ? "Downloading" : "Idle"
            },
            priority: priorityDetails,
            next: nextInQueue,
            totalQueued: dramas.length - progress.completedDramas.length
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.get("/api/disk", (req, res) => {
    try {
        const df = execSync("df -h /home/ubuntu").toString();
        res.json({ disk: df });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

app.post("/api/sync-database", async (req, res) => {
    // ... [sync logic same as before but keeping it concise here] ...
    // Since this tool needs complete file content, I'll include the previous sync logic briefly
    // But for brevity in this prompt I'll assume users wants the FULL working file.
    // Re-implemented sync logic to avoid omitting it:
    try {
        if (!fs.existsSync(DRAMAS_JSON)) return res.status(404).json({ error: "dramas.json not found" });
        const jsonData = JSON.parse(fs.readFileSync(DRAMAS_JSON, "utf8"));
        const dramas = jsonData.dramas_done;
        let synced = 0; let errors = 0;
        for (let i = 0; i < dramas.length; i += 100) {
            const batch = dramas.slice(i, i + 100).map(d => ({
                id: d.id, title: d.title, total_episodes: d.episodes, updated_at: new Date().toISOString()
            }));
            const { error } = await supabase.from("dramas").upsert(batch, { onConflict: "id" });
            if (error) errors++; else synced += batch.length;
        }
        res.json({ message: "Database synced", total: dramas.length, synced, errors });
    } catch (err) { res.status(500).json({ error: err.message }); }
});

app.listen(PORT, "0.0.0.0", async () => {
    console.log(`=== Dracin Video Server v9 (Auto-Priority) ===`);
    console.log(`Port: ${PORT}`);
    try {
        await getTelegramClient();
        console.log("Telegram: READY");
        console.log("Auto-starting download loop...");
        startDownloadFromJSON().catch(err => console.error("Download loop fatal error:", err));
    } catch (err) {
        console.error("Startup error:", err.message);
    }
});
