const { cmd } = require("../command");
const axios = require("axios");
const yts = require("yt-search");

const headers = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

cmd(
  {
    pattern: "song",
    react: "🎶",
    desc: "Download Song from YouTube",
    category: "download",
    filename: __filename,
  },
  async (robin, mek, m, { from, reply, q }) => {
    try {
      if (!q) return reply("❌ *Please provide a song name or YouTube link* 🌟🎵");

      // 🔍 Search
      const search = await yts(q);
      if (!search.videos.length) return reply("❌ No video found.");

      const video = search.videos[0];
      const url = video.url;

      // 🧾 Send preview
      let caption = `
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

      // 🔄 Convert using savetube.su backend
      const api = "https://cdn306.savetube.su/api/ajaxSearch";
      const res = await axios.post(
        api,
        new URLSearchParams({ q: url }),
        { headers }
      );

      const audioInfo = res.data.links?.mp3?.mp3128;
      if (!audioInfo || !audioInfo.url) {
        return reply("❌ Couldn't fetch audio file.");
      }

      // ⏬ Send audio
      await robin.sendMessage(
        from,
        {
          audio: { url: audioInfo.url },
          mimetype: "audio/mpeg",
          fileName: `${video.title}.mp3`,
        },
        { quoted: mek }
      );

      return reply("✅ *Enjoy your song!* 🎶");
    } catch (e) {
      console.log("SONG ERROR:", e);
      reply("❌ *Error downloading song. Try another title.*");
    }
  }
);
