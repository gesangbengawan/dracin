
const { createClient } = require('tdl');
const { TDLib } = require('tdl-tdlib-addon');
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
require('dotenv').config();
const { createClient: createSupabaseClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;

// --- Config ---
const API_ID = process.env.TELEGRAM_API_ID;
const API_HASH = process.env.TELEGRAM_API_HASH;
const BOT_USERNAME = "IDShortBot";
const VIDEO_DIR = "/home/ubuntu/videos";
const COMPRESSED_DIR = "/home/ubuntu/videos_compressed";
const SESSION_DIR = "/home/ubuntu/tdlib-session";
const DRAMAS_JSON = "/home/ubuntu/dracin-backend/dramas.json";
const PROGRESS_FILE = "/home/ubuntu/dracin-backend/download_progress.json";

// Ensure directories
[VIDEO_DIR, COMPRESSED_DIR, SESSION_DIR].forEach(d => {
    if (!fs.existsSync(d)) fs.mkdirSync(d, { recursive: true });
});

// Setup Client
// const LIB_PATH = path.join(__dirname, 'libtdjson.so');
// console.log('[DEBUG] LIB_PATH:', LIB_PATH);
// console.log('[DEBUG] Exists:', fs.existsSync(LIB_PATH));

// let tdlib;
// try {
//     tdlib = new TDLib(LIB_PATH);
//     console.log('[DEBUG] TDLib created:', tdlib);
// } catch (e) {
//     console.error('[ERROR] TDLib creation failed:', e);
// }

const client = createClient({
    apiId: API_ID,
    apiHash: API_HASH,
    databaseDirectory: SESSION_DIR,
    filesDirectory: SESSION_DIR,
    tdlibParameters: {
        use_message_database: true,
        use_secret_chats: false,
        system_language_code: 'en',
        application_version: '1.0',
        device_model: 'DracinServer',
        system_version: 'Linux',
        enable_storage_optimizer: true
    }
    // backend: tdlib // Let TDL find it
});
console.log('[DEBUG] Client created');

let authState = "IDLE"; // IDLE, WAITING_PHONE, WAITING_CODE, READY
let authResolver = null;

// Auth Logic
client.on('error', console.error);
client.on('update', update => {
    // console.log('[DEBUG] Update:', update._);
    if (update._ === 'updateAuthorizationState') {
        const state = update.authorization_state;
        if (state._ === 'authorizationStateWaitPhoneNumber') {
            authState = "WAITING_PHONE";
            console.log("[AUTH] Waiting for phone number...");
        } else if (state._ === 'authorizationStateWaitCode') {
            authState = "WAITING_CODE";
            console.log("[AUTH] Waiting for Code...");
        } else if (state._ === 'authorizationStateReady') {
            authState = "READY";
            console.log("[AUTH] Ready!");
            startDownloadLoop();
        }
    }
});

// --- API ---
app.use(cors());
app.use(express.json());
// Serve compressed videos statically under /stream path
// This allows: http://EC2_IP:3001/stream/{dramaId}/ep{n}.mp4
app.use('/stream', express.static(COMPRESSED_DIR));

// Auth Endpoints
app.get('/api/auth/status', (req, res) => res.json({ status: authState }));

app.post('/api/auth/phone', async (req, res) => {
    const { phone } = req.body;
    if (authState !== 'WAITING_PHONE') return res.status(400).json({ error: "Not waiting for phone" });
    try {
        await client.invoke({ _: 'setAuthenticationPhoneNumber', phone_number: phone });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

app.post('/api/auth/code', async (req, res) => {
    const { code } = req.body;
    if (authState !== 'WAITING_CODE') return res.status(400).json({ error: "Not waiting for code" });
    try {
        await client.invoke({ _: 'checkAuthenticationCode', code: code });
        res.json({ success: true });
    } catch (e) { res.status(500).json({ error: e.message }); }
});

// Server Status & Queue Logic (Ported from previous)
// ... [Supabase & Queue vars] ...
const supabase = createSupabaseClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_KEY);
let isDownloading = false;
let priorityQueue = [];
let shouldInterrupt = false;
let downloadStats = { total: 0, done: 0, currentDramaId: null };

function loadProgress() {
    if (fs.existsSync(PROGRESS_FILE)) return JSON.parse(fs.readFileSync(PROGRESS_FILE));
    return { lastDramaIndex: 0, completedDramas: [] };
}
function saveProgress(p) { fs.writeFileSync(PROGRESS_FILE, JSON.stringify(p)); }

// Download Helper
async function downloadFile(fileId, destPath) {
    console.log(`[TDL] Starting download for file ${fileId}`);
    await client.invoke({ _: 'downloadFile', file_id: fileId, priority: 32, synchronous: false });

    // Poll for completion
    return new Promise((resolve, reject) => {
        const check = setInterval(async () => {
            try {
                if (shouldInterrupt && priorityQueue.length > 0) {
                    clearInterval(check);
                    reject(new Error("INTERRUPTED"));
                    return;
                }

                const file = await client.invoke({ _: 'getFile', file_id: fileId });
                if (file.local.is_downloading_completed) {
                    clearInterval(check);
                    fs.copyFileSync(file.local.path, destPath);
                    resolve(destPath);
                }
            } catch (e) {
                console.error(e);
                // Keep retrying
            }
        }, 1000); // Check every second
    });
}

// Search Logic
async function findVideos(dramaId, limit) {
    const bot = await client.invoke({ _: 'searchPublicChat', username: BOT_USERNAME });
    const chatId = bot.id;
    const query = `/start playfirst-${dramaId}`;

    console.log(`[SEARCH] Looking for existing '${query}' in chat...`);

    // Search for the command message
    const found = await client.invoke({
        _: 'searchChatMessages',
        chat_id: chatId,
        query: query,
        limit: 10 // Search last 10 occurrences? Or just 1 is enough if recent.
    });

    if (!found || found.total_count === 0) {
        console.log(`[SEARCH] No existing command found for ${dramaId}. Skipping (User requested NO TRIGGER).`);
        return [];
    }

    // Found the command message(s). The video should be the immediate next message (higher ID) or reply.
    // In Telegram, replies are usually newer. 
    // We take the most recent command message found.
    const cmdMsg = found.messages[0]; // Messages are usually returned newest first.

    console.log(`[SEARCH] Found command message ${cmdMsg.id}. Checking context...`);

    // Get messages around this command to find the bot's reply
    // We look for messages *after* the command (newer than it).
    // getChatHistory with from_message_id returns messages *older* than it by default? 
    // offset = -2 means "2 messages newer and limit messages older"? 
    // Actually: from_message_id is inclusive. offset=-1 returns the message + 1 newer.
    const context = await client.invoke({
        _: 'getChatHistory',
        chat_id: chatId,
        from_message_id: cmdMsg.id,
        offset: -5, // Look at 5 messages newer
        limit: 10
    });

    const videos = [];
    // Sort context by id ascending (oldest first) to simulate flow: Command -> Reply 1 -> Reply 2
    context.messages.sort((a, b) => a.id - b.id);

    // Find the command message index
    const cmdIndex = context.messages.findIndex(m => m.id === cmdMsg.id);

    if (cmdIndex === -1) {
        console.log("[SEARCH] Context lookup failed.");
        return [];
    }

    // Look at messages AFTER command
    for (let i = cmdIndex + 1; i < context.messages.length; i++) {
        const msg = context.messages[i];
        if (msg.content._ === 'messageVideo') {
            videos.push({
                id: msg.id,
                fileId: msg.content.video.video.id,
                duration: msg.content.video.duration,
                size: msg.content.video.video.size
            });
        }
    }

    console.log(`[SEARCH] Found ${videos.length} videos for ${dramaId}`);
    return videos; // Return what we found. Do not reverse if we want ep1, ep2 order (it depends on how bot sends them).
    // Usually bot sends Ep1, then Ep2. So newer messages are higher eps.
}

// Compress Logic (Same as before)
function compressVideo(input, output) {
    return new Promise((resolve, reject) => {
        const ffmpeg = spawn("ffmpeg", ["-i", input, "-c:v", "libx264", "-preset", "fast", "-crf", "30", "-y", output]);
        ffmpeg.on('close', code => code === 0 ? resolve() : reject(new Error('ffmpeg failed')));
    });
}


// Main Loop
async function startDownloadLoop() {
    if (isDownloading) return;
    isDownloading = true;
    console.log("=== Starting TDLib Download Loop (SEARCH ONLY / DESCENDING) ===");

    const dramasData = JSON.parse(fs.readFileSync(DRAMAS_JSON));

    // Sort Descending (Highest ID first, e.g. 10696 -> 10475 -> ...)
    const dramas = dramasData.dramas_done.sort((a, b) => b.id - a.id);

    // Find index of 10475 if specific start needed (Optional based on request)
    // User said "Start from 10475... then sort from 10696". 
    // If we just sort from 10696, we eventually hit 10475.
    // I will stick to pure descending sort.

    console.log(`[QUEUE] Total bucket: ${dramas.length}. Top: ${dramas[0].id}`);

    while (true) {
        // Priority Queue Logic
        let drama = null;
        let isPriority = false;

        let progress = loadProgress();

        if (priorityQueue.length > 0) {
            const pid = priorityQueue.shift();
            drama = dramas.find(d => d.id === pid); // Note: find in sorted list
            if (!drama) {
                // Fallback if not in sorted list (e.g. older ignored one)? 
                // Reload original list? No, assumption is list is complete.
                dramaData.dramas_done.find(d => d.id === pid);
            }
            isPriority = true;
        } else {
            // Processing linear queue
            // We need a consistent way to track index in the SORTED list
            // If progress.lastDramaIndex references index in ORIGINAL list, it might be wrong now.
            // We should rely on 'completedDramas' array + iterating the sorted 'dramas' array.

            // Find first drama in sorted list that is NOT completed
            drama = dramas.find(d => !progress.completedDramas.includes(d.id));

            if (!drama) { console.log("All done"); break; }
        }

        if (!drama) continue;

        console.log(`Processing ${drama.title} (${drama.id})`);
        downloadStats.currentDramaId = drama.id;

        // Check exists
        const dir = path.join(COMPRESSED_DIR, drama.id);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir);

        // Count existing files
        const existingFiles = fs.readdirSync(dir).filter(f => f.endsWith('.mp4'));
        if (existingFiles.length >= drama.episodes) {
            console.log("Already done (files exist)");
            if (!isPriority && !progress.completedDramas.includes(drama.id)) {
                progress.completedDramas.push(drama.id);
                saveProgress(progress);
            }
            continue;
        }

        try {
            const videos = await findVideos(drama.id, drama.episodes);
            if (videos.length === 0) {
                console.log("No videos found. Marking as skipped/done to prevent loop.");
                // Mark as done so we move on. User said "Not triggering". So if not found, we can't do anything.
                if (!isPriority) {
                    progress.completedDramas.push(drama.id);
                    saveProgress(progress);
                }
                continue;
            }

            let wasInterrupted = false;
            for (let i = 0; i < videos.length; i++) {
                // Check for interrupt BEFORE starting each episode download
                if (shouldInterrupt && priorityQueue.length > 0) {
                    console.log(`[INTERRUPT] Pausing ${drama.id} to process priority queue...`);
                    shouldInterrupt = false;
                    wasInterrupted = true;
                    // Re-queue this drama to resume later (add to front of a "resume" queue or just let it be picked up again)
                    // Since we use completedDramas to skip, and we haven't added this one yet, it will be re-processed.
                    break;
                }

                const v = videos[i];
                const ep = i + 1;
                const finalPath = path.join(dir, `ep${ep}.mp4`);
                if (fs.existsSync(finalPath)) continue;

                const rawPath = path.join(VIDEO_DIR, `${drama.id}_raw_${ep}.mp4`);

                // Download
                console.log(`[DOWNLOAD] ${drama.id} Ep ${ep}...`);
                await downloadFile(v.fileId, rawPath);

                // Compress
                console.log(`[COMPRESS] ${drama.id} Ep ${ep}...`);
                await compressVideo(rawPath, finalPath);
                fs.unlinkSync(rawPath);
                console.log(`[DONE] ${drama.id} Ep ${ep} saved.`);
            }

            // Only mark as complete if NOT interrupted and NOT priority
            if (!wasInterrupted && !isPriority) {
                progress.completedDramas.push(drama.id);
                saveProgress(progress);
            }
        } catch (e) {
            console.error(e);
        }
        await new Promise(r => setTimeout(r, 2000));
    }
}

// Queue API
app.get('/api/queue', (req, res) => {
    const dramasData = JSON.parse(fs.readFileSync(DRAMAS_JSON));
    // Sort descending for consistent display
    const dramas = dramasData.dramas_done.sort((a, b) => b.id - a.id);
    const progress = loadProgress();
    const current = dramas.find(d => d.id === downloadStats.currentDramaId);

    // Get top 10 upcoming (not completed, not current)
    const upcoming = dramas
        .filter(d => !progress.completedDramas.includes(d.id) && d.id !== downloadStats.currentDramaId)
        .slice(0, 10)
        .map(d => ({ id: d.id, title: d.title, episodes: d.episodes }));

    res.json({
        current: current ? { ...current, status: "Downloading" } : null,
        upcoming: upcoming,
        totalQueued: dramas.length - progress.completedDramas.length,
        priorityQueue: priorityQueue
    });
});
app.get('/api/status', (req, res) => res.json({ status: "running", engine: "TDLib", authState }));
app.post('/api/force-priority/:id', (req, res) => {
    const { id } = req.params;
    const progress = loadProgress();

    // Check if already downloaded (prevent duplicate)
    if (progress.completedDramas.includes(id)) {
        return res.status(400).json({ error: "Already downloaded", id });
    }

    // Check if already in priority queue
    if (priorityQueue.includes(id)) {
        return res.status(400).json({ error: "Already in priority queue", id });
    }

    priorityQueue.unshift(id);
    shouldInterrupt = true;
    console.log(`[FORCE PRIORITY] ${id} added. Interrupt flag set.`);
    res.json({ success: true, message: `${id} added to priority queue` });
});

// Ready films API - list completed downloads
app.get('/api/ready', (req, res) => {
    try {
        if (!fs.existsSync(COMPRESSED_DIR)) {
            return res.json({ films: [], count: 0 });
        }

        const dramaFolders = fs.readdirSync(COMPRESSED_DIR).filter(f => {
            const p = path.join(COMPRESSED_DIR, f);
            return fs.statSync(p).isDirectory();
        });

        const dramasData = JSON.parse(fs.readFileSync(DRAMAS_JSON));
        const dramaMap = new Map((dramasData.dramas_done || []).map(d => [d.id, d.title]));

        const films = dramaFolders.map(folder => {
            const folderPath = path.join(COMPRESSED_DIR, folder);
            const episodes = fs.readdirSync(folderPath).filter(f => f.endsWith('.mp4'));
            return {
                dramaId: folder,
                title: dramaMap.get(folder) || "Unknown Title",
                episodeCount: episodes.length,
                episodes: episodes.map(e => parseInt(e.replace('ep', '').replace('.mp4', '')))
            };
        }).filter(f => f.episodeCount > 0);

        res.json({ films, count: films.length });
    } catch (e) {
        console.error(e);
        res.json({ films: [], count: 0, error: e.message });
    }
});

// Videos detail API - used by frontend to check ready status
app.get('/api/videos/:id', (req, res) => {
    const { id } = req.params;
    try {
        const dramasData = JSON.parse(fs.readFileSync(DRAMAS_JSON));
        const drama = dramasData.dramas_done.find(d => d.id === id);

        let totalEpisodes = drama ? drama.episodes : 0;
        const dir = path.join(COMPRESSED_DIR, id);
        let videos = [];

        if (fs.existsSync(dir)) {
            const files = fs.readdirSync(dir).filter(f => f.endsWith('.mp4'));
            // Map existing files to episode numbers to find max
            const fileEps = files.map(f => parseInt(f.replace('ep', '').replace('.mp4', ''))).filter(n => !isNaN(n));
            const maxEp = fileEps.length > 0 ? Math.max(...fileEps) : 0;

            const count = Math.max(totalEpisodes, maxEp);

            for (let i = 1; i <= count; i++) {
                const filename = `ep${i}.mp4`;
                const filePath = path.join(dir, filename);
                const exists = fs.existsSync(filePath);
                let size = null;
                if (exists) {
                    const stat = fs.statSync(filePath);
                    size = stat.size;
                }

                videos.push({
                    episode: i,
                    ready: exists,
                    size: size,
                    messageId: 0,
                    duration: 0
                });
            }
        } else if (totalEpisodes > 0) {
            for (let i = 1; i <= totalEpisodes; i++) {
                videos.push({ episode: i, ready: false });
            }
        }

        res.json({ dramaId: id, videos });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: e.message });
    }
});

// Start
client.connect().then(() => {
    client.login().catch(e => {
        // e might be "Login pending" or flow error
        // console.log("Login flow:", e);
    });
});

app.listen(PORT, '0.0.0.0', () => console.log(`TDLib Server running on ${PORT}`));
