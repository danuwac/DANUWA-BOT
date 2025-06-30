const { cmd } = require('../command');

cmd({
  pattern: "getdp",
  alias: ["dp", "profilepic"],
  react: "🖼️",
  desc: "Download user's profile picture",
  category: "utility",
  filename: __filename
}, async (robin, mek, m, { reply, args, quoted, isGroup }) => {
  try {
    let target;

    const mentionedJid = mek.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (mentionedJid) {
      target = mentionedJid;
    } else if (quoted?.sender) {
      target = quoted.sender;
    } else if (args[0] && /^\d{5,15}$/.test(args[0])) {
      target = args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net";
    } else if (!isGroup) {
      // In private chat, target is the user you're chatting with
      target = mek.key.remoteJid;
    } else {
      return reply("❌ In group: reply, mention or provide number.\nIn private chat: just send `.getdp`.");
    }

    const url = await robin.profilePictureUrl(target, "image").catch(() => null);
    if (!url) return reply("❌ Couldn't fetch profile picture. They might not have one or it's private.");

    await robin.sendMessage(m.chat, {
      image: { url },
      caption: `🖼️ Profile picture of @${target.split("@")[0]}`,
      mentions: [target]
    }, { quoted: mek });

  } catch (err) {
    console.error("GetDP Error:", err);
    reply("⚠️ Error fetching profile picture.");
  }
});
