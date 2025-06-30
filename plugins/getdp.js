const { cmd } = require('../command');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');

cmd({
  pattern: "getdp",
  alias: ["dp", "profilepic"],
  react: "🖼️",
  desc: "Download user's profile picture",
  category: "utility",
  filename: __filename
}, async (robin, mek, m, { reply, args, quoted }) => {
  try {
    let target;
    const botJid = jidNormalizedUser(robin.user.id);
    const mentioned = mek.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    if (mentioned) {
      target = mentioned;
    } else if (quoted?.sender) {
      target = quoted.sender;
    } else if (args[0] && /^\d{5,15}$/.test(args[0])) {
      target = args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net";
    } else {
      return reply("❌ Please mention a user, reply to their message, or provide a valid number.");
    }

    const normalized = jidNormalizedUser(target);
    if (normalized === botJid) {
      return reply("❌ I cannot fetch my own profile picture.");
    }

    const url = await robin.profilePictureUrl(normalized, "image").catch(() => null);
    if (!url) return reply("❌ Couldn't fetch profile picture. Maybe they don't have one or it's restricted.");

    await robin.sendMessage(m.chat, {
      image: { url },
      caption: `🖼️ Profile picture of @${normalized.split("@")[0]}`,
      mentions: [normalized]
    }, { quoted: mek });

  } catch (err) {
    console.error("GetDP Error:", err);
    reply("⚠️ Error fetching profile picture.");
  }
});
