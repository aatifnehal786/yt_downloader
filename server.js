import express from "express";
import cors from "cors";
import path from "path";
import { fileURLToPath } from "url";
import ytdlp from "yt-dlp-exec";

const app = express();
app.use(express.json());

// ===== ES Modules __dirname fix =====
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ===== CORS =====
app.use(
  cors({
    origin: "http://localhost:5173", // your React frontend
    credentials: true,
    methods: ["GET", "POST", "OPTIONS"],
  })
);

// ===== Path to bundled ffmpeg =====
const ffmpegPath = path.join(__dirname, "ffmpeg-8.0-essentials_build", "bin", "ffmpeg.exe");

// ===== Video Info Route =====
app.get("/api/video-info", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing video URL" });

  try {
    const info = await ytdlp(url, {
      dumpJson: true,
      noWarnings: true,
      noCheckCertificate: true,
      preferFreeFormats: true,
      ffmpegLocation: ffmpegPath,
    });

    // Filter formats: only video (with or without audio)
    const formats = info.formats
      .filter((f) => f.vcodec !== "none")
      .map((f) => ({
        formatId: f.format_id,
        quality: f.format_note || f.resolution || "unknown",
        ext: f.ext,
        hasVideo: f.vcodec !== "none",
        hasAudio: f.acodec !== "none",
        size: f.filesize ? (f.filesize / (1024 * 1024)).toFixed(2) + " MB" : "Unknown",
      }));

    res.json({
      title: info.title,
      thumbnail: info.thumbnail,
      formats,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to fetch video info" });
  }
});

// ===== Download Route =====
app.get("/api/download", (req, res) => {
  const { url, formatId } = req.query;
  if (!url || !formatId) return res.status(400).json({ error: "Missing url or formatId" });

  try {
    const download = ytdlp.raw(
      [
        url,
        "-f",
        `${formatId}+bestaudio/best`,
        "--ffmpeg-location",
        ffmpegPath,
        "-o",
        "-",
      ],
      { stdio: ["ignore", "pipe", "pipe"] }
    );

    res.setHeader("Content-Disposition", 'attachment; filename="video.mp4"');
    res.setHeader("Content-Type", "video/mp4");

    download.stdout.pipe(res);

    download.stderr.on("data", (data) => console.error(data.toString()));
    download.on("close", (code) => console.log("yt-dlp process exited with code", code));
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Failed to download video" });
  }
});

// ===== Start Server =====
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
