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

// Create directories
[VIDEO_DIR, COMPRESSED_DIR].forEach(dir => {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
});

// Supabase
const supabase = createClient(
    process.env.SUPABASE_URL || "https://mnjkvwemnlkwzitfzzdd.supabase.co",
    process.env.SUPABASE_SERVICE_KEY
);

// Download queue
let downloadQueue = [];
let isDownloading = false;
let downloadStats = { total: 0, done: 0, failed: 0 };

// CORS
app.use(cors());
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
        { connectionRetries: 5, floodSleepThreshold: 300 } // Wait up to 5 min on flood
    );
    await client.connect();
    console.log("Telegram connected!");
    return client;
}

// Compress video with ffmpeg (portrait videos)
function compressVideo(inputPath, outputPath) {
    return new Promise((resolve, reject) => {
        // Portrait video: keep aspect ratio, target ~100MB for 1GB input (10x compression)
        // Using CRF 28 for good compression, preset medium for balance
        const args = [
            "-i", inputPath,
            "-c:v", "libx264",
            "-crf", "32", // Higher CRF = more compression
            "-preset", "fast",
            "-c:a", "aac",
            "-b:a", "64k",
            "-movflags", "+faststart",
            "-y", // Overwrite
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
                reject(new Error(`ffmpeg exited with code ${code}: ${stderr.slice(-500)}`));
            }
        });
    });
}

// Process download queue (slow, one at a time)
async function processDownloadQueue() {
    if (isDownloading || downloadQueue.length === 0) return;
    isDownloading = true;

    while (downloadQueue.length > 0) {
        const task = downloadQueue.shift();
        const { dramaId, messageId, episode } = task;

        const rawPath = path.join(VIDEO_DIR, dramaId, `ep${episode}_raw.mp4`);
        const compressedPath = path.join(COMPRESSED_DIR, dramaId, `ep${episode}.mp4`);

        // Skip if already exists
        if (fs.existsSync(compressedPath)) {
            console.log(`[SKIP] Drama ${dramaId} Ep ${episode} already exists`);
            downloadStats.done++;
            continue;
        }

        try {
            // Create directories
            [path.dirname(rawPath), path.dirname(compressedPath)].forEach(dir => {
                if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
            });

            console.log(`[DOWNLOAD] Drama ${dramaId} Ep ${episode} (msg: ${messageId})...`);

            // Download from Telegram
            const tg = await getTelegramClient();
            const bot = await tg.getEntity(BOT_USERNAME);
            const msgs = await tg.getMessages(bot, { ids: [messageId] });

            if (!msgs.length || !msgs[0].media) {
                console.log(`[ERROR] Message ${messageId} not found`);
                downloadStats.failed++;
                continue;
            }

            const buffer = await tg.downloadMedia(msgs[0], {});
            fs.writeFileSync(rawPath, buffer);
            const rawSize = buffer.length / (1024 * 1024);
            console.log(`[DOWNLOAD] Saved raw: ${rawSize.toFixed(0)} MB`);

            // Compress
            console.log(`[COMPRESS] Compressing...`);
            await compressVideo(rawPath, compressedPath);

            const compressedSize = fs.statSync(compressedPath).size / (1024 * 1024);
            console.log(`[COMPRESS] Done: ${compressedSize.toFixed(0)} MB (${(rawSize / compressedSize).toFixed(1)}x smaller)`);

            // Delete raw file to save space
            fs.unlinkSync(rawPath);

            // Update Supabase
            await supabase.from("videos").update({
                compressed: true,
                compressed_size: Math.round(compressedSize * 1024 * 1024)
            }).eq("message_id", messageId);

            downloadStats.done++;

            // Wait 30 seconds between downloads to avoid rate limit
            console.log(`[WAIT] Waiting 30s before next download...`);
            await new Promise(r => setTimeout(r, 30000));

        } catch (err) {
            console.error(`[ERROR] ${err.message}`);
            downloadStats.failed++;

            // On flood wait, pause longer
            if (err.message.includes("flood")) {
                console.log(`[FLOOD] Waiting 5 minutes...`);
                await new Promise(r => setTimeout(r, 300000));
            }
        }
    }

    isDownloading = false;
    console.log(`[QUEUE] Complete! Done: ${downloadStats.done}, Failed: ${downloadStats.failed}`);
}

// Health check
app.get("/", (req, res) => {
    res.json({
        status: "ok",
        version: "v7-compressor",
        queue: downloadQueue.length,
        downloading: isDownloading,
        stats: downloadStats,
    });
});

// Get videos for drama
app.get("/api/videos/:dramaId", async (req, res) => {
    const dramaId = req.params.dramaId;

    try {
        // Get from Supabase
        const { data: videos } = await supabase
            .from("videos")
            .select("*")
            .eq("drama_id", dramaId)
            .order("episode_num");

        if (!videos || videos.length === 0) {
            return res.json({
                dramaId,
                videos: [],
                total: 0,
                message: `Drama ${dramaId} belum ada. Trigger dari Telegram dulu.`,
            });
        }

        // Check which are compressed
        const result = videos.map(v => {
            const compressedPath = path.join(COMPRESSED_DIR, dramaId, `ep${v.episode_num}.mp4`);
            return {
                messageId: v.message_id,
                episode: v.episode_num,
                size: v.compressed_size || v.file_size,
                duration: v.duration,
                ready: fs.existsSync(compressedPath),
            };
        });

        res.json({ dramaId, videos: result, total: result.length });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Stream video (compressed)
app.get("/api/stream/:dramaId/:episode", async (req, res) => {
    const { dramaId, episode } = req.params;
    const videoPath = path.join(COMPRESSED_DIR, dramaId, `ep${episode}.mp4`);

    if (!fs.existsSync(videoPath)) {
        return res.status(404).json({ error: "Video not ready, still downloading" });
    }

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

// Stream by messageId (for frontend compatibility)
app.get("/api/stream/:messageId", async (req, res) => {
    const messageId = parseInt(req.params.messageId);

    try {
        // Look up video in database
        const { data: video } = await supabase
            .from("videos")
            .select("*")
            .eq("message_id", messageId)
            .single();

        if (!video) {
            return res.status(404).json({ error: "Video not found in database" });
        }

        const videoPath = path.join(COMPRESSED_DIR, video.drama_id, `ep${video.episode_num}.mp4`);

        // Check if compressed version exists
        if (fs.existsSync(videoPath)) {
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
            return;
        }

        // Not compressed yet - stream directly from Telegram
        console.log(`[STREAM] Downloading ${messageId} from Telegram on-demand...`);
        const tg = await getTelegramClient();
        const bot = await tg.getEntity(BOT_USERNAME);
        const msgs = await tg.getMessages(bot, { ids: [messageId] });

        if (!msgs.length || !msgs[0].media) {
            return res.status(404).json({ error: "Video not found in Telegram" });
        }

        const buffer = await tg.downloadMedia(msgs[0], {});
        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Content-Length", buffer.length);
        res.send(buffer);

    } catch (err) {
        console.error("[STREAM] Error:", err.message);
        res.status(500).json({ error: err.message });
    }
});

// Download video
app.get("/api/download/:dramaId/:episode", async (req, res) => {
    const { dramaId, episode } = req.params;
    const videoPath = path.join(COMPRESSED_DIR, dramaId, `ep${episode}.mp4`);

    if (!fs.existsSync(videoPath)) {
        return res.status(404).json({ error: "Video not ready" });
    }

    res.setHeader("Content-Type", "video/mp4");
    res.setHeader("Content-Disposition", `attachment; filename="drama_${dramaId}_ep${episode}.mp4"`);
    fs.createReadStream(videoPath).pipe(res);
});

// Start downloading all videos
app.post("/api/start-download", async (req, res) => {
    try {
        // Get all videos from Supabase, sorted by drama_id DESCENDING (page 1/newest first)
        const { data: allVideos, error } = await supabase
            .from("videos")
            .select("*")
            .order("drama_id", { ascending: false })
            .order("episode_num", { ascending: true });

        if (error) throw error;

        // Filter out already compressed
        const toDownload = allVideos.filter(v => {
            const compressedPath = path.join(COMPRESSED_DIR, v.drama_id, `ep${v.episode_num}.mp4`);
            return !fs.existsSync(compressedPath);
        });

        // Add to queue
        downloadQueue = toDownload.map(v => ({
            dramaId: v.drama_id,
            messageId: v.message_id,
            episode: v.episode_num,
        }));

        downloadStats = { total: downloadQueue.length, done: 0, failed: 0 };

        console.log(`[QUEUE] Added ${downloadQueue.length} videos to download queue`);

        // Start processing
        processDownloadQueue();

        res.json({
            message: "Download started",
            total: downloadQueue.length,
        });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Get download status
app.get("/api/download-status", (req, res) => {
    res.json({
        queue: downloadQueue.length,
        isDownloading,
        stats: downloadStats,
    });
});

// Check disk usage
app.get("/api/disk", (req, res) => {
    try {
        const df = execSync("df -h /home/ubuntu").toString();
        res.json({ disk: df });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// Start
app.listen(PORT, "0.0.0.0", async () => {
    console.log(`=== Dracin Video Server v7 (Compressor) ===`);
    console.log(`Port: ${PORT}`);
    console.log(`Video dir: ${COMPRESSED_DIR}`);

    try {
        await getTelegramClient();
        console.log("Telegram: READY");
    } catch (err) {
        console.error("Telegram error:", err.message);
    }
});
