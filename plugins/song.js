const { cmd } = require("../command");
const yts = require("yt-search");
const ytdl = require("ytdl-core");

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

      // Search for video
      let videoUrl = q;
      if (!ytdl.validateURL(q)) {
        const search = await yts(q);
        if (!search || !search.videos.length)
          return reply("❌ *No results found for your query*.");
        videoUrl = search.videos[0].url;
      }

      const info = await ytdl.getInfo(videoUrl);
      const title = info.videoDetails.title;
      const lengthSeconds = parseInt(info.videoDetails.lengthSeconds);

      if (lengthSeconds > 1800)
        return reply("⏳ *Sorry, audio files longer than 30 minutes are not supported.*");

      const thumbnail = info.videoDetails.thumbnails.pop().url;
      const duration = new Date(lengthSeconds * 1000).toISOString().substr(11, 8);

      // Send preview
      const caption = `
🎧 *SONG DOWNLOAD*
─────────────────────
🎬 *Title:* ${title}
⏳ *Duration:* ${duration}
🔗 *Link:* ${videoUrl}
─────────────────────
🎼 Made with ❤️ by *DANUKA DISANAYAKA💫*
`.trim();

      await robin.sendMessage(from, { image: { url: thumbnail }, caption }, { quoted: mek });

      // Get audio URL manually (with headers patch)
      const format = ytdl.chooseFormat(info.formats, {
        filter: "audioonly",
        quality: "highestaudio",
      });

      if (!format || !format.url) throw new Error("Couldn't fetch audio file.");

      // Add headers to avoid 410
      const headers = {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        "Accept-Language": "en-US,en;q=0.9",
      };

      // Send audio
      await robin.sendMessage(
        from,
        {
          audio: {
            url: format.url,
            headers,
          },
          mimetype: "audio/mpeg",
          fileName: `${title}.mp3`,
        },
        { quoted: mek }
      );

      reply("✅ *Here is your song! Enjoy 🎶*");
    } catch (err) {
      console.error(err);
      reply("❌ *Couldn't fetch audio file.* Please try again later.");
    }
  }
);
