const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");
const cheerio = require("cheerio");

cmd(
  {
    pattern: "song",
    react: "🎶",
    desc: "Download Song",
    category: "download",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, reply }) => {
    try {
      if (!q) return reply("❌ *Please provide a song name or YouTube link*");

      const search = await yts(q);
      const video = search.videos[0];
      if (!video) return reply("❌ No results found.");

      const url = video.url;
      const ssyoutubeURL = `https://ssyoutube.com/watch?v=${video.videoId}`;

      // Send preview
      await robin.sendMessage(
        from,
        {
          image: { url: video.thumbnail },
          caption: `🎧 *Title:* ${video.title}\n⏱ *Duration:* ${video.timestamp}\n🔗 *Link:* ${url}`,
        },
        { quoted: mek }
      );

      // Fetch download page from ssyoutube
      const { data } = await axios.get(ssyoutubeURL, {
        headers: {
          "User-Agent":
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/117.0.0.0 Safari/537.36",
        },
      });

      // Scrape available download links
      const $ = cheerio.load(data);
      let mp3link;

      $("a").each((_, el) => {
        const href = $(el).attr("href");
        const text = $(el).text();
        if (text.toLowerCase().includes("mp3")) {
          mp3link = href;
          return false;
        }
      });

      if (!mp3link) return reply("❌ MP3 link not found. Try a shorter video.");

      // Send the audio
      await robin.sendMessage(
        from,
        {
          audio: { url: mp3link },
          mimetype: "audio/mpeg",
        },
        { quoted: mek }
      );

      return reply("✅ *Download successful! Enjoy your music* 🎶");
    } catch (err) {
      console.error(err);
      return reply("❌ Error: " + err.message);
    }
  }
);
