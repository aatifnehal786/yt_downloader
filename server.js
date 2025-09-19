import express from "express";
import cors from "cors";
import { spawn } from "child_process";

const app = express();
app.use(cors());
app.use(express.json());

// ✅ Route to fetch all formats
app.get("/api/video-info", (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).json({ error: "Missing video URL" });

  const ytDlp = spawn("yt-dlp", ["-j", url]);

  let output = "";
  ytDlp.stdout.on("data", (data) => (output += data.toString()));

  ytDlp.stderr.on("data", (data) =>
    console.error("yt-dlp stderr:", data.toString())
  );

  ytDlp.on("close", (code) => {
    try {
      const data = JSON.parse(output);

      // ✅ return both progressive and video-only formats
      const formats = data.formats
        .filter((f) => f.vcodec !== "none") // must have video
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

// ✅ Route to download a selected format
app.get("/api/download", (req, res) => {
  const { url, formatId } = req.query;
  if (!url || !formatId)
    return res.status(400).json({ error: "Missing url or formatId" });

  // ✅ If format has no audio, yt-dlp automatically merges with bestaudio
  const ytDlp = spawn("yt-dlp", [
    "-f",
    `${formatId}+bestaudio/best`,
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

app.listen(5000, () =>
  console.log("✅ Server running on http://localhost:5000")
);
