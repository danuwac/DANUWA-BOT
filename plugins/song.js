const { cmd } = require("../command");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const ffmpeg = require("fluent-ffmpeg");
const { promisify } = require("util");
const { pipeline } = require("stream");
const streamPipeline = promisify(pipeline);

cmd(
  {
    pattern: "song",
    react: "🎶",
    desc: "Download MP3 from YouTube link",
    category: "download",
    filename: __filename,
  },
  async (
    robin,
    mek,
    m,
    {
      from,
      q,
      reply,
    }
  ) => {
    try {
      const isYoutubeUrl = /^(https?:\/\/)?(www\.)?(youtube\.com|youtu\.be|music\.youtube\.com)\//i.test(q);
      if (!q || !isYoutubeUrl) {
        return reply("✳️ *Usage:* .ytmp3 <YouTube URL>");
      }

      await robin.sendMessage(from, { react: { text: "⏳", key: mek.key } });

      const apiURL = `https://api.neoxr.eu/api/youtube?url=${encodeURIComponent(q)}&type=audio&quality=128kbps&apikey=russellxz`;
      const res = await axios.get(apiURL);
      const json = res.data;

      if (!json.status || !json.data?.url) {
        throw new Error("❌ Couldn't fetch audio file.");
      }

      const { data, title, fduration, thumbnail } = json;

      await robin.sendMessage(
        from,
        {
          image: { url: thumbnail },
          caption: `🎧 *TITLE:* ${title}\n🕒 *DURATION:* ${fduration}\n📥 *SIZE:* ${data.size}\n\n⏳ *Downloading...*`,
        },
        { quoted: mek }
      );

      const tmpDir = path.join(__dirname, "../tmp");
      if (!fs.existsSync(tmpDir)) fs.mkdirSync(tmpDir);

      const rawPath = path.join(tmpDir, `${Date.now()}_raw.m4a`);
      const finalPath = path.join(tmpDir, `${Date.now()}_final.mp3`);

      const audioRes = await axios.get(data.url, { responseType: "stream" });
      await streamPipeline(audioRes.data, fs.createWriteStream(rawPath));

      await new Promise((resolve, reject) => {
        ffmpeg(rawPath)
          .audioCodec("libmp3lame")
          .audioBitrate("128k")
          .save(finalPath)
          .on("end", resolve)
          .on("error", reject);
      });

      await robin.sendMessage(
        from,
        {
          audio: fs.readFileSync(finalPath),
          mimetype: "audio/mpeg",
          fileName: data.filename || `${title}.mp3`,
        },
        { quoted: mek }
      );

      fs.unlinkSync(rawPath);
      fs.unlinkSync(finalPath);

      await robin.sendMessage(from, { react: { text: "✅", key: mek.key } });
    } catch (err) {
      console.error(err);
      await reply(`❌ *Error:* ${err.message}`);
      await robin.sendMessage(from, { react: { text: "❌", key: mek.key } });
    }
  }
);
