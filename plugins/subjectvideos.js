const { cmd } = require("../command");
const yts = require("yt-search");

cmd(
  {
    pattern: "subjectvideos",
    desc: "Get subject video playlist from DP Education A/L",
    category: "education",
    react: "📚",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, reply }) => {
    const query = q.trim().toLowerCase();
    if (!query) return reply("❌ Example: `.subjectvideos biology`");

    await robin.sendMessage(from, { react: { text: "📚", key: m.key } });

    try {
      const searchTerm = `dp education a/l ${query} playlist`;
      const result = await yts(searchTerm);
      const playlist = result.playlists[0];

      if (!playlist) {
        return reply(`❌ No playlist found for *${query}*.`);
      }

      const msg = `╭━〔 *📚 SUBJECT VIDEO PLAYLIST* 〕━⬣
┃ 🔖 *Subject:* *${query.toUpperCase()}*
┃ 🎬 *Title:* ${playlist.title}
┃ 🔗 *Link:* ${playlist.url}
┃ 📊 *Videos:* ${playlist.videoCount}
╰──────────────⬣`;

      await robin.sendMessage(from, {
        text: msg,
        contextInfo: {
          externalAdReply: {
            title: `DP Education - A/L Playlist`,
            body: `${playlist.title}`,
            thumbnailUrl: playlist.image,
            mediaType: 1,
            renderLargerThumbnail: true,
            showAdAttribution: true,
            sourceUrl: playlist.url,
          },
        },
      }, { quoted: mek });

    } catch (e) {
      console.error("❌ Playlist search failed:", e);
      reply("⚠️ Failed to fetch playlist. Please try again later.");
    }
  }
);
