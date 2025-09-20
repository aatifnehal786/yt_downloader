import fs from "fs";
import path from "path";

const ytDlpBinary = path.join("node_modules", "yt-dlp-exec", "bin", "yt-dlp");

if (process.platform !== "win32") {
  try {
    fs.chmodSync(ytDlpBinary, 0o755);
    console.log("Made yt-dlp executable for Linux");
  } catch (err) {
    console.error("Failed to chmod yt-dlp:", err);
  }
}
