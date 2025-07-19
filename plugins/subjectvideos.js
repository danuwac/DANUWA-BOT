const { cmd } = require("../command");
const yts = require("yt-search");
const axios = require("axios");

const channelJid = "120363418166326365@newsletter";
const channelName = "🍁 ＤＡＮＵＷＡ－ －ＭＤ 🍁";
const channelInvite = '0029Vb65OhH7oQhap1fG1y3o';
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
      return reply("❌ Example:\n`.subjectvideos al biology`\n`.subjectvideos o/l maths`");
    }

    const [exam, ...subjectWords] = input.split(" ");
    const subject = subjectWords.join(" ");

    if (!["a/l", "o/l"].includes(exam)) {
      return reply("❌ Please specify `a/l` or `o/l`. Example:\n`.subjectvideos a/l ict`\n`.subjectvideos o/l science`");
    }

    if (!subject) {
      return reply("❌ Please provide a subject after exam type. Example: `.subjectvideos a/l physics`");
    }

    await robin.sendMessage(from, { react: { text: "📚", key: m.key } });

    try {
      const searchTerm = `dp education ${exam} ${subject} playlist`;
      const result = await yts(searchTerm);
      const playlist = result.playlists[0];

      if (!playlist) {
        return reply(`❌ No ${exam.toUpperCase()} playlist found for *${subject}*.`);
      }
      const thumbBuffer = await axios.get(playlist.image, {
        responseType: "arraybuffer",
      });
      const msg = `╔═━━━━━━━◥◣◆◢◤━━━━━━━━═╗
║     🍁 ＤＡＮＵＷＡ－ 〽️Ｄ 🍁    ║
╚═━━━━━━━◢◤◆◥◣━━━━━━━━═╝
  *❤️ SUBJECT VIDEO PLAYLIST ❤️*
┏━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🔰 𝗘𝗫𝗔𝗠 𝗧𝗬𝗣𝗘: *${exam.toUpperCase()}*
┃ 📚 𝗦𝗨𝗕𝗝𝗘𝗖𝗧: *${subject.toUpperCase()}*
┗━━━━━━━━━━━━━━━━━━━━━━┛
┃ 🎬 *TITLE:* ${playlist.title}
┃ 📊 *VIDEOS:* ${playlist.videoCount}
┃ 🔗 *LINK:* ${playlist.url}
╰─🔥 𝘿𝘼𝙉𝙐𝙆𝘼 𝘿𝙄𝙎𝘼𝙉𝘼𝙔𝘼𝙆𝘼 🔥─╯`;

      await robin.sendMessage(
        from,
        {
          image: thumbBuffer.data,
          caption: msg,
          contextInfo: {
            forwardingScore: 999,
            isForwarded: true,
            forwardedNewsletterMessageInfo: {
              newsletterJid: channelJid,
              newsletterName: channelName,
              serverMessageId: -1,
            },
          },
        },
        { quoted: mek }
      );
    } catch (e) {
      console.error("❌ Playlist fetch failed:", e);
      reply("⚠️ Failed to fetch playlist. Please try again later.");
    }
  }
);
