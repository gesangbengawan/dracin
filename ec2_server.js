require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { TelegramClient } = require("telegram");
const { StringSession } = require("telegram/sessions");

const app = express();
const PORT = process.env.PORT || 3001;
const BOT_USERNAME = "IDShortBot";

// CORS config
const allowedOrigins = (process.env.ALLOWED_ORIGINS || "").split(",");
app.use(cors({
    origin: (origin, callback) => {
        if (!origin || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            callback(new Error("Not allowed by CORS"));
        }
    },
    credentials: true,
}));

app.use(express.json());

// Telegram client singleton
let client = null;

async function getTelegramClient() {
    if (client && client.connected) return client;

    const session = new StringSession(process.env.TELEGRAM_SESSION);
    client = new TelegramClient(
        session,
        parseInt(process.env.TELEGRAM_API_ID),
        process.env.TELEGRAM_API_HASH,
        { connectionRetries: 5 }
    );

    await client.connect();
    console.log("Telegram connected!");
    return client;
}

// Health check
app.get("/", (req, res) => {
    res.json({ status: "ok", service: "dracin-video-backend", timestamp: new Date().toISOString() });
});

// Stream video endpoint
app.get("/api/stream/:messageId", async (req, res) => {
    const msgId = parseInt(req.params.messageId);
    if (isNaN(msgId)) {
        return res.status(400).json({ error: "Invalid message ID" });
    }

    try {
        const tg = await getTelegramClient();
        const bot = await tg.getEntity(BOT_USERNAME);
        const messages = await tg.getMessages(bot, { ids: [msgId] });

        if (!messages.length || !messages[0].media) {
            return res.status(404).json({ error: "Video not found" });
        }

        const msg = messages[0];
        const media = msg.media;
        const doc = media.document;
        const size = Number(doc.size || 0);
        const mimeType = doc.mimeType || "video/mp4";

        // Handle range request for seeking
        const range = req.headers.range;
        if (range) {
            const parts = range.replace(/bytes=/, "").split("-");
            const start = parseInt(parts[0], 10);
            const end = parts[1] ? parseInt(parts[1], 10) : size - 1;
            const chunkSize = end - start + 1;

            res.writeHead(206, {
                "Content-Range": `bytes ${start}-${end}/${size}`,
                "Accept-Ranges": "bytes",
                "Content-Length": chunkSize,
                "Content-Type": mimeType,
            });

            for await (const chunk of tg.iterDownload({
                file: media,
                offset: BigInt(start),
                requestSize: 512 * 1024,
                limit: chunkSize,
            })) {
                res.write(chunk);
            }
            res.end();
        } else {
            res.writeHead(200, {
                "Content-Length": size,
                "Content-Type": mimeType,
                "Accept-Ranges": "bytes",
            });

            for await (const chunk of tg.iterDownload({
                file: media,
                requestSize: 512 * 1024,
            })) {
                res.write(chunk);
            }
            res.end();
        }
    } catch (err) {
        console.error("Stream error:", err);
        if (!res.headersSent) {
            res.status(500).json({ error: "Stream failed", message: err.message });
        }
    }
});

// Download video endpoint
app.get("/api/download/:messageId", async (req, res) => {
    const msgId = parseInt(req.params.messageId);
    if (isNaN(msgId)) {
        return res.status(400).json({ error: "Invalid message ID" });
    }

    try {
        const tg = await getTelegramClient();
        const bot = await tg.getEntity(BOT_USERNAME);
        const messages = await tg.getMessages(bot, { ids: [msgId] });

        if (!messages.length || !messages[0].media) {
            return res.status(404).json({ error: "Video not found" });
        }

        const msg = messages[0];
        const buffer = await tg.downloadMedia(msg, {});

        res.setHeader("Content-Type", "video/mp4");
        res.setHeader("Content-Disposition", `attachment; filename="episode_${msgId}.mp4"`);
        res.setHeader("Content-Length", buffer.length);
        res.send(buffer);
    } catch (err) {
        console.error("Download error:", err);
        res.status(500).json({ error: "Download failed", message: err.message });
    }
});

// Get videos for a specific drama by scanning chat
app.get("/api/videos/:dramaId", async (req, res) => {
    const dramaId = req.params.dramaId;

    try {
        const tg = await getTelegramClient();
        const bot = await tg.getEntity(BOT_USERNAME);
        const messages = await tg.getMessages(bot, { limit: 1000 });

        let foundDrama = false;
        let videos = [];
        let episodeNum = 0;

        // Reverse to process oldest first
        for (const msg of messages.reverse()) {
            const text = msg.message || "";

            // Check if this is the drama we're looking for
            if (text.includes(`playfirst-${dramaId}`)) {
                foundDrama = true;
                episodeNum = 0;
                continue;
            }

            // Collect videos after finding the drama trigger
            if (foundDrama && msg.media && msg.media.document) {
                const doc = msg.media.document;
                if ((doc.mimeType || "").startsWith("video/")) {
                    episodeNum++;
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
                        episode: episodeNum,
                        title: `Episode ${episodeNum}`,
                        size: Number(doc.size || 0),
                        duration: duration,
                    });
                }
            }

            // Stop if we hit another drama trigger
            if (foundDrama && text.includes("playfirst-") && !text.includes(`playfirst-${dramaId}`)) {
                break;
            }
        }

        res.json({ dramaId, videos, total: videos.length });
    } catch (err) {
        console.error("Get videos error:", err);
        res.status(500).json({ error: "Failed to get videos", message: err.message });
    }
});

// Start server
app.listen(PORT, "0.0.0.0", async () => {
    console.log(`Dracin Video Server running on port ${PORT}`);
    try {
        await getTelegramClient();
        console.log("Telegram client connected and ready!");
    } catch (err) {
        console.error("Failed to connect to Telegram:", err.message);
    }
});
