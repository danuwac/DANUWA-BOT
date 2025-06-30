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
    const botJid = jidNormalizedUser(robin.user.id); // Bot's JID
    const mentioned = mek.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];

    if (mentioned) {
      target = mentioned;
    } else if (quoted?.sender || quoted?.key?.participant) {
      target = quoted.sender || quoted.key.participant;
    } else if (args[0] && /^\d{5,15}$/.test(args[0])) {
      target = args[0].replace(/[^0-9]/g, "") + "@s.whatsapp.net";
    } else {
      const sender = mek.key.fromMe
        ? mek.key.remoteJid
        : mek.key.participant || mek.key.remoteJid;

      const normalized = jidNormalizedUser(sender);

      if (normalized === botJid) {
        return reply("❌ Cannot fetch my own profile picture.\nUse `.getdp <number>` or reply to a user.");
      }
      target = normalized;
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
