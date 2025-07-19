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

      // Search YouTube if query is not a valid URL
      let videoUrl = q;
      if (!ytdl.validateURL(q)) {
        const search = await yts(q);
        if (!search || !search.videos.length)
          return reply("❌ *No results found for your query*.");
        videoUrl = search.videos[0].url;
      }

      const info = await ytdl.getInfo(videoUrl);

      // Limit duration to 30 minutes
      const lengthSeconds = parseInt(info.videoDetails.lengthSeconds, 10);
      if (lengthSeconds > 1800)
        return reply("⏳ *Sorry, audio files longer than 30 minutes are not supported.*");

      const title = info.videoDetails.title;
      const thumbnail = info.videoDetails.thumbnails.pop().url;
      const duration = new Date(lengthSeconds * 1000).toISOString().substr(11, 8);

      // Send metadata message with thumbnail
      const caption = `
🎧 *Song Download*
─────────────────────
🎬 Title: ${title}
⏳ Duration: ${duration}
🔗 Link: ${videoUrl}
─────────────────────
🎼 Made with ❤️ by *DANUKA DISANAYAKA💫*
      `.trim();

      await robin.sendMessage(from, { image: { url: thumbnail }, caption }, { quoted: mek });

      // Download audio stream from YouTube (highest quality audio only)
      const audioStream = ytdl(videoUrl, { filter: "audioonly", quality: "highestaudio" });

      // Send audio file as stream
      await robin.sendMessage(
        from,
        {
          audio: audioStream,
          mimetype: "audio/mpeg",
          fileName: `${title}.mp3`,
        },
        { quoted: mek }
      );

      return reply("✅ *Here is your song! Enjoy 🎶*");
    } catch (e) {
      console.error(e);
      return reply("❌ *Failed to download the song. Please try again later.*");
    }
  }
);
