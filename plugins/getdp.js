const { cmd } = require('../command');

cmd({
  pattern: "getdp",
  alias: ["dp", "profilepic"],
  react: "🖼️",
  desc: "Download someone else's profile picture (DP)",
  category: "utility",
  filename: __filename
}, async (robin, mek, m, { isGroup, reply, quoted }) => {
  try {
    let target;

    // Try to get mentioned JID
    const mentionedJid = mek.message?.extendedTextMessage?.contextInfo?.mentionedJid?.[0];
    if (mentionedJid) {
      target = mentionedJid;
    } 
    // Try to get replied user
    else if (quoted?.sender) {
      target = quoted.sender;
    } 
    else {
      return reply("❌ Mention or reply to a user to fetch their profile picture.");
    }

    const url = await robin.profilePictureUrl(target, "image").catch(() => null);
    if (!url) return reply("❌ Couldn't fetch profile picture. Maybe they don't have one or it's private.");

    await robin.sendMessage(m.chat, {
      image: { url },
      caption: `🖼️ Profile picture of @${target.split("@")[0]}`,
      mentions: [target]
    }, { quoted: mek });

  } catch (err) {
    console.error("DP Fetch Error:", err);
    reply("⚠️ Error fetching profile picture.");
  }
});
