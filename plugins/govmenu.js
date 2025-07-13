const { cmd } = require('../command');
const fs = require('fs');

cmd({
    pattern: "govdocmenu",
    react: "📚",
    desc: "Show GovDoc.lk paper menu with newsletter buttons",
    category: "education",
    filename: __filename
},
async (conn, mek, m, {
    from, quoted, reply
}) => {
    try {
        const bannerImg = 'https://github.com/DANUWA-MD/DANUWA-BOT/blob/main/images/Alive.png?raw=true';

        const channelJid = '120363418166326365@newsletter'; // your newsletter JID
        const channelName = '🍁 ＤＡＮＵＷＡ－ 〽️Ｄ 🍁';
        const channelInvite = '0029Vb65OhH7oQhap1fG1y3o';

        const menuCaption = `╭───── ❖  *📚 DANUWA-MD MENU* ❖ ─────╮
│
│ 📝  Term Test Papers (Grade 6–13)
│ 📘  GCE O/L Past Papers
│ 📗  GCE A/L Past Papers
│
╰────────────────────────────╯
⚡ *Powered By:* ©DANUWA-MD ❤️`;

        await conn.sendMessage(from, {
            image: { url: bannerImg },
            caption: menuCaption,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: channelJid,
                    newsletterName: channelName,
                    serverMessageId: -1
                }
            }
        }, { quoted: mek });

    } catch (err) {
        console.error("❌ Error sending govdocmenu:", err);
        reply(`❌ Error: ${err.message}`);
    }
});
