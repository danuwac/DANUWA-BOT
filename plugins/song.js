const { cmd, commands } = require("../command");
const yts = require("yt-search");
const axios = require("axios");

// Custom ytmp3 with headers for cdn306.savetube.su
async function ytmp3(url, quality = "128") {
  try {
    const response = await axios.post(
      "https://cdn306.savetube.su/v2/info",
      JSON.stringify({ url }),
      {
        headers: {
          Accept: "application/json, text/plain, */*",
          "Content-Type": "application/json",
          "User-Agent":
            "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Mobile Safari/537.36",
          Referer: "https://yt.savetube.me/1kejjj1?id=362796039",
          Origin: "https://yt.savetube.me",
          Connection: "keep-alive",
          DNT: "1",
          "Sec-Fetch-Site": "same-site",
          "Sec-Fetch-Mode": "cors",
          "Sec-Fetch-Dest": "empty",
          "Accept-Encoding": "gzip, deflate, br",
          "Accept-Language": "en-US,en;q=0.9",
        },
      }
    );

    if (!response.data || !response.data.data) throw new Error("No data found");

    const data = response.data.data;

    // Find matching audio quality URL
    let audio = data.formats.find(
      (f) => f.audioQuality === quality && f.mimeType.startsWith("audio")
    );
    if (!audio) {
      // fallback to any audio format
      audio = data.formats.find((f) => f.mimeType.startsWith("audio"));
    }
    if (!audio) throw new Error("No suitable audio format found");

    return {
      download: {
        url: audio.url,
      },
    };
  } catch (err) {
    throw new Error("❌ Couldn't fetch audio file.");
  }
}

cmd(
  {
    pattern: "song",
    react: "🎶",
    desc: "Download Song",
    category: "download",
    filename: __filename,
  },
  async (
    robin,
    mek,
    m,
    {
      from,
      quoted,
      body,
      isCmd,
      command,
      args,
      q,
      isGroup,
      sender,
      senderNumber,
      botNumber2,
      botNumber,
      pushname,
      isMe,
      isOwner,
      groupMetadata,
      groupName,
      participants,
      groupAdmins,
      isBotAdmins,
      isAdmins,
      reply,
    }
  ) => {
    try {
      if (!q) return reply("❌ *Please provide a song name or YouTube link* 🌟🎵");

      // Search for the video
      const search = await yts(q);
      const data = search.videos[0];
      const url = data.url;

      // Song metadata description
      let desc = `
           🌟 𝗪𝗘𝗟𝗖𝗢𝗠𝗘 𝗧𝗢 🌟    
════════════════════════     
🔮  Ｄ  Ａ  Ｎ  Ｕ  Ｗ  Ａ  －  Ｍ  Ｄ  🔮  
      🎧 𝙎𝙊𝙉𝙂 𝘿𝙊𝙒𝙉𝙇𝙊𝘼𝘿𝙀𝙍 🎧  
════════════════════════   

🎼 Let the rhythm guide you... 🎼
🚀 Pow. By *DANUKA DISANAYAKA* 🔥
─────────────────────────

🎬 *Title:* ${data.title}
⏱️ *Duration:* ${data.timestamp}
📅 *Uploaded:* ${data.ago}
👀 *Views:* ${data.views.toLocaleString()}
🔗 *Watch Here:* ${data.url}

─────────────────────────
🎼 Made with ❤️ by *DANUKA DISANAYAKA💫*
`;

      // Send metadata thumbnail message
      await robin.sendMessage(
        from,
        { image: { url: data.thumbnail }, caption: desc },
        { quoted: mek }
      );

      // Download the audio using patched ytmp3
      const quality = "128"; // Default quality
      const songData = await ytmp3(url, quality);

      // Validate song duration (limit: 30 minutes)
      let durationParts = data.timestamp.split(":").map(Number);
      let totalSeconds =
        durationParts.length === 3
          ? durationParts[0] * 3600 + durationParts[1] * 60 + durationParts[2]
          : durationParts[0] * 60 + durationParts[1];

      if (totalSeconds > 1800) {
        return reply("⏳ *Sorry, audio files longer than 30 minutes are not supported.*");
      }

      // Send audio file
      await robin.sendMessage(
        from,
        {
          audio: { url: songData.download.url },
          mimetype: "audio/mpeg",
        },
        { quoted: mek }
      );

      // Send as a document (optional)
      await robin.sendMessage(
        from,
        {
          document: { url: songData.download.url },
          mimetype: "audio/mpeg",
          fileName: `${data.title}.mp3`,
          caption: "🎶 *Your song is ready to be played!* \n🎼 Made with ❤️ by *DANUKA DISANAYAKA💫*",
        },
        { quoted: mek }
      );

      return reply("✅ *Thank you for using DANUWA-MD! Enjoy your music* 🎧💖");
    } catch (e) {
      console.log(e);
      reply(`❌ *Error:* ${e.message} 😞`);
    }
  }
);
