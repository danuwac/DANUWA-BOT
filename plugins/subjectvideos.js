const { cmd } = require("../command");
const yts = require("yt-search");
const ytpl = require("ytpl");

cmd(
  {
    pattern: "subjectvideos",
    desc: "Get subject video playlist from DP Education (A/L or O/L) with preview",
    category: "education",
    react: "📚",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, reply }) => {
    const input = q.trim().toLowerCase();
    if (!input) {
      return reply("❌ Example:\n`.subjectvideos al biology`\n`.subjectvideos ol maths`");
    }

    const [exam, ...subjectWords] = input.split(" ");
    const subject = subjectWords.join(" ");

    if (!["al", "ol"].includes(exam)) {
      return reply("❌ Please specify `al` or `ol`. Example:\n`.subjectvideos al ict`\n`.subjectvideos ol science`");
    }

    if (!subject) {
      return reply("❌ Please provide a subject after exam type. Example: `.subjectvideos al physics`");
    }

    await robin.sendMessage(from, { react: { text: "📚", key: m.key } });

    try {
      // 1. Search playlist
      const searchTerm = `dp education ${exam} ${subject} playlist`;
      const result = await yts(searchTerm);
      const found = result.playlists?.[0];

      if (!found) return reply(`❌ No playlist found for *${subject}*.`);

      // 2. Get full video list using ytpl
      const playlist = await ytpl(found.url, { limit: 5 }); // get top 5

      let msg = `╭━〔 *📚 ${exam.toUpperCase()} SUBJECT VIDEO PLAYLIST* 〕━⬣
┃ 🔖 *Subject:* *${subject.toUpperCase()}*
┃ 🎬 *Title:* ${playlist.title}
┃ 📊 *Videos:* ${playlist.items.length}
┃ 🔗 *Playlist:* ${playlist.url}
╰──────────────⬣

📺 *Top Videos Preview:*\n`;

      playlist.items.slice(0, 3).forEach((v, i) => {
        msg += `\n*${i + 1}.* ${v.title}\n⏱ ${v.duration} | 🔗 ${v.url}\n`;
      });

      await robin.sendMessage(
        from,
        {
          text: msg,
          contextInfo: {
            externalAdReply: {
              title: `DP Education - ${exam.toUpperCase()} Playlist`,
              body: playlist.title,
              thumbnailUrl: playlist.bestThumbnail?.url,
              mediaType: 1,
              renderLargerThumbnail: true,
              showAdAttribution: true,
              sourceUrl: playlist.url,
            },
          },
        },
        { quoted: mek }
      );
    } catch (e) {
      console.error("❌ Playlist fetch failed:", e);
      reply("⚠️ Failed to fetch playlist or preview.");
    }
  }
);
