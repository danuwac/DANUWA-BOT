const { cmd } = require("../command");
const yts = require("yt-search");

cmd(
  {
    pattern: "subjectvideos",
    desc: "Get subject video playlist from DP Education (A/L or O/L)",
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
      const searchTerm = `dp education ${exam} ${subject} playlist`;
      const result = await yts(searchTerm);
      const playlist = result.playlists[0];

      if (!playlist) {
        return reply(`❌ No ${exam.toUpperCase()} playlist found for *${subject}*.`);
      }

      const msg = `╭━〔 *📚 ${exam.toUpperCase()} SUBJECT VIDEO PLAYLIST* 〕━⬣
┃ 🔖 *Subject:* *${subject.toUpperCase()}*
┃ 🎬 *Title:* ${playlist.title}
┃ 🔗 *Link:* ${playlist.url}
┃ 📊 *Videos:* ${playlist.videoCount}
╰──────────────⬣`;

      await robin.sendMessage(
        from,
        {
          text: msg,
          contextInfo: {
            externalAdReply: {
              title: `DP Education - ${exam.toUpperCase()} Playlist`,
              body: `${playlist.title}`,
              thumbnailUrl: playlist.image,
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
      console.error("❌ Playlist search failed:", e);
      reply("⚠️ Failed to fetch playlist. Please try again later.");
    }
  }
);
