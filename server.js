import express from "express";
import cors from "cors";
import { spawn } from "child_process";
import path from "path";

import { fileURLToPath } from "url";

const app = express();
app.use(cors({
  origin:  ["http://localhost:5173","https://mygram247.netlify.app"],
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
}));
app.use(express.json());

// ✅ Path to your ffmpeg binary


// Convert import.meta.url to __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Path to bundled ffmpeg
const ffmpegPath = path.join(__dirname, "ffmpeg-8.0-essentials_build", "bin", "ffmpeg.exe");

console.log(ffmpegPath); // Check path


// Route to fetch video info
app.get("/api/video-info", (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing video URL" });

  const ytDlp = spawn("yt-dlp", ["-j", url]);

  let output = "";
  ytDlp.stdout.on("data", (data) => (output += data.toString()));

  ytDlp.stderr.on("data", (data) =>
    console.error("yt-dlp stderr:", data.toString())
  );

  ytDlp.on("close", () => {
    try {
      const data = JSON.parse(output);
      const formats = data.formats
        .filter((f) => f.vcodec !== "none")
        .map((f) => ({
          formatId: f.format_id,
          quality: f.format_note || f.resolution || "unknown",
          ext: f.ext,
          hasVideo: f.vcodec !== "none",
          hasAudio: f.acodec !== "none",
          size: f.filesize
            ? (f.filesize / (1024 * 1024)).toFixed(2) + " MB"
            : "Unknown",
        }));

      res.json({
        title: data.title,
        thumbnail: data.thumbnail,
        formats,
      });
    } catch (err) {
      console.error("JSON parse error:", err);
      res.status(500).json({ error: "Failed to parse yt-dlp output" });
    }
  });
});

// Route to download video (merge if needed)
app.get("/api/download", (req, res) => {
  const { url, formatId } = req.query;
  if (!url || !formatId)
    return res.status(400).json({ error: "Missing url or formatId" });

  // ✅ yt-dlp will use your bundled ffmpeg
 const ytDlp = spawn("yt-dlp", [
  "-f",
  `${formatId}+bestaudio/best`,
  "--ffmpeg-location",
  ffmpegPath,
  "-o",
  "-",
  url,
]);
  res.setHeader("Content-Disposition", 'attachment; filename="video.mp4"');
  res.setHeader("Content-Type", "video/mp4");

  ytDlp.stdout.pipe(res);

  ytDlp.stderr.on("data", (data) => {
    console.error("yt-dlp stderr:", data.toString());
  });

  ytDlp.on("close", (code) => {
    console.log(`yt-dlp process exited with code ${code}`);
  });
});

app.listen(5000, () => console.log("✅ Server running on http://localhost:5000"));
