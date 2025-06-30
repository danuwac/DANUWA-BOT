const { cmd } = require('../command');
const { getBuffer } = require('../lib/functions');

cmd({
  pattern: "getdp",
  alias: ["dp", "profilepic"],
  desc: "Get user's profile picture",
  category: "tools",
  react: "🖼️",
  filename: __filename
}, async (conn, m, mdata) => {
  const { args, sender, reply, isGroup, quoted, q } = mdata;

  let targetJid;

  if (q) {
    // If .getdp 9471xxxxxxx
    let number = q.replace(/[^0-9]/g, '');
    if (number.length < 7) return reply("❌ Invalid number.");
    targetJid = number + '@s.whatsapp.net';
  } else if (quoted) {
    // If replied to someone in group
    targetJid = quoted.participant || quoted.key?.participant || quoted.key?.remoteJid;
  } else if (!isGroup) {
    // In private chat, use sender's jid
    targetJid = sender;
  } else {
    return reply("❗ Reply to a message or provide a number.");
  }

  try {
    const ppUrl = await conn.profilePictureUrl(targetJid, 'image');
    const buffer = await getBuffer(ppUrl);
    await conn.sendMessage(mdata.from, { image: buffer, caption: `📷 Profile picture of: ${targetJid.split("@")[0]}` }, { quoted: m });
  } catch (e) {
    console.log("DP fetch error:", e);
    return reply("❌ Couldn't fetch profile picture (maybe user has no DP or it's restricted).");
  }
});
