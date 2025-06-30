const { cmd } = require('../command');
const { jidNormalizedUser } = require('@whiskeysockets/baileys');

cmd({
  pattern: "pp",
  alias: ["dp", "profilepic"],
  react: "🖼️",
  desc: "Download user's profile picture",
  category: "utility",
  filename: __filename
}, async (robin, mek, m, { reply, args }) => {
  try {
    if (!args[0] || !/^\d{5,15}$/.test(args[0].replace(/[^0-9]/g, ""))) {
      return reply("❌ Please provide a valid number to fetch profile picture.");
    }

    const number = args[0].replace(/[^0-9]/g, "");
    const target = number + "@s.whatsapp.net";

    const url = await robin.profilePictureUrl(target, "image").catch(() => null);
    if (!url) return reply("❌ Couldn't fetch profile picture. Maybe they don't have one or it's restricted.");

    await robin.sendMessage(m.chat, {
      image: { url },
      caption: `🖼️ Profile picture of @${number}`,
      mentions: [target]
    }, { quoted: mek });

  } catch (err) {
    console.error("GetDP Error:", err);
    reply("⚠️ Error fetching profile picture.");
  }
});
