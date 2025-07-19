const { cmd } = require("../command");
const yts = require("yt-search");
const youtubePlaylist = require("youtube-playlist").default;

cmd(
  {
    pattern: "subjectvideos",
    desc: "Get subject video playlist from DP Education (A/L or O/L) with preview using youtube-playlist",
    category: "education",
    react: "📚",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, reply }) => {
    if (!q) return reply("❌ Example:\n`.subjectvideos al biology`\n`.subjectvideos ol maths`");

    const input = q.trim().toLowerCase().split(" ");
    const exam = input[0];
    const subject = input.slice(1).join(" ");

    if (!["al", "ol"].includes(exam)) {
      return reply("❌ Please specify `al` or `ol`. Example:\n`.subjectvideos al ict`\n`.subjectvideos ol science`");
    }
    if (!subject) return reply("❌ Please provide a subject after exam type.");

    await robin.sendMessage(from, { react: { text: "📚", key: m.key } });

    try {
      // Search for playlist using yt-search
      const searchTerm = `dp education ${exam} ${subject} playlist`;
      const result = await yts(searchTerm);
      const found = result.playlists?.[0];

      if (!found || typeof found.url !== "string" || !found.url.length) {
        return reply(`❌ No playlist found for *${subject}*.`);
      }

      // Use youtube-playlist to fetch playlist details + videos
      const data = await youtubePlaylist(found.url, ["id", "title", "url", "duration"]);

      // data looks like { title: 'Playlist Title', videos: [{id, title, url, duration}, ...] }

      let msg = `╭━〔 *📚 ${exam.toUpperCase()} SUBJECT VIDEO PLAYLIST* 〕━⬣
┃ 🔖 *Subject:* *${subject.toUpperCase()}*
┃ 🎬 *Title:* ${data.title}
┃ 🔗 *Playlist:* ${found.url}
┃ 📊 *Videos:* ${data.videos.length}
╰──────────────⬣

📺 *Top Videos Preview:*\n`;

      data.videos.slice(0, 3).forEach((video, i) => {
        msg += `\n*${i + 1}.* ${video.title}\n⏱ ${video.duration}\n🔗 ${video.url}\n`;
      });

      await robin.sendMessage(
        from,
        {
          text: msg,
          contextInfo: {
            externalAdReply: {
              title: data.title,
              body: "DP Education YouTube Playlist",
              thumbnailUrl: `https://i.ytimg.com/vi/${data.videos[0]?.id}/hqdefault.jpg`,
              mediaType: 1,
              renderLargerThumbnail: true,
              sourceUrl: found.url,
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
