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
    const mentioned = mek.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    if (mentioned) {
      target = mentioned;
    } else if (quoted?.sender) {
      target = quoted.sender;
    } else if (args[0] && /^\d{5,15}$/.test(args[0].replace(/[^0-9]/g, ""))) {
      const number = args[0].replace(/[^0-9]/g, "");
      target = number + "@s.whatsapp.net";
    } else {
      return reply("❌ Please mention a user, reply to a message, or provide a valid number.");
    }

    const url = await robin.profilePictureUrl(target, "image").catch(() => null);
    if (!url) return reply("❌ Couldn't fetch profile picture. Maybe they don't have one or it's restricted.");

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
