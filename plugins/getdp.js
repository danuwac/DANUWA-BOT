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
    const isGroup = mek.key.remoteJid.endsWith('@g.us');

    const mentioned = mek.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    const quotedSender = quoted?.sender || quoted?.key?.participant;

    if (mentioned) {
      target = mentioned;
    } else if (quotedSender) {
      target = quotedSender;
    } else if (args[0] && /^\d{5,15}$/.test(args[0])) {
      target = args[0].replace(/[^0-9]/g, '') + '@s.whatsapp.net';
    } else {
      if (isGroup) {
        // fallback to sender in group
        const sender = mek.key.fromMe ? mek.key.remoteJid : (mek.key.participant || mek.key.remoteJid);
        target = jidNormalizedUser(sender);
      } else {
        // fallback to other user in private chat
        target = mek.key.remoteJid;
      }
    }

    if (target === botJid) {
      return reply('❌ Cannot fetch my own profile picture.\nUse `.getdp <number>` or reply to a user.');
    }

    const url = await robin.profilePictureUrl(target, 'image').catch(() => null);
    if (!url) return reply("❌ Couldn't fetch profile picture. Maybe they don't have one or it's restricted.");

    await robin.sendMessage(m.chat, {
      image: { url },
      caption: `🖼️ Profile picture of @${target.split("@")[0]}`,
      mentions: [target]
    }, { quoted: mek });

  } catch (err) {
    console.error('GetDP Error:', err);
    reply('⚠️ Error fetching profile picture.');
  }
});
