const { cmd } = require("../command");
const axios = require("axios");
const yts = require("yt-search");

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Accept": "application/json, text/javascript, */*; q=0.01",
  "Accept-Language": "en-US,en;q=0.9",
  "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
  "Origin": "https://en1.savetube.me",
  "Referer": "https://en1.savetube.me/",
  "X-Requested-With": "XMLHttpRequest",
};

cmd(
  {
    pattern: "song",
    react: "🎶",
    desc: "Download song from YouTube",
    category: "download",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("❌ *Enter a song name or YouTube link.*");

      const search = await yts(q);
      if (!search.videos.length) return reply("❌ No videos found.");

      const video = search.videos[0];
      const url = video.url;

      // Preview
      const caption = `
🎧 *SONG DOWNLOADER*
────────────────────
🎬 *Title:* ${video.title}
⏱️ *Duration:* ${video.timestamp}
📅 *Uploaded:* ${video.ago}
👁️ *Views:* ${video.views.toLocaleString()}
🔗 *Link:* ${video.url}
────────────────────
🎼 Made with ❤️ by *DANUKA DISANAYAKA💫*
`.trim();

      await robin.sendMessage(
        from,
        { image: { url: video.thumbnail }, caption },
        { quoted: mek }
      );

      // Call savetube API
      const res = await axios.post(
        "https://en1.savetube.me/api/ajaxSearch",
        new URLSearchParams({ q: url }),
        { headers }
      );

      const mp3 = res.data?.links?.mp3?.mp3128;
      if (!mp3?.url) return reply("❌ Couldn't fetch the audio file.");

      await robin.sendMessage(
        from,
        {
          audio: { url: mp3.url },
          mimetype: "audio/mpeg",
          fileName: `${video.title}.mp3`,
        },
        { quoted: mek }
      );

      return reply("✅ *Enjoy your song!* 🎶");
    } catch (err) {
      console.error("SONG ERROR:", err);
      reply("❌ *Failed to download. Try again later.*");
    }
  }
);
