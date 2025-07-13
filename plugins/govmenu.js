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

        const buttons = [
            { buttonId: ".termtest", buttonText: { displayText: "📝 Term Test Papers" }, type: 1 },
            { buttonId: ".pastpapers ol", buttonText: { displayText: "📘 O/L Past Papers" }, type: 1 },
            { buttonId: ".pastpapers al", buttonText: { displayText: "📗 A/L Past Papers" }, type: 1 }
        ];

        const buttonMessage = {
            image: { url: bannerImg },
            caption: menuCaption,
            footer: "Join our newsletter below 👇",
            buttons: buttons,
            headerType: 4,
            contextInfo: {
                forwardingScore: 999,
                isForwarded: true,
                forwardedNewsletterMessageInfo: {
                    newsletterJid: channelJid,
                    newsletterName: channelName,
                    serverMessageId: -1
                }
            }
        };

        await conn.sendMessage(from, buttonMessage, { quoted: mek });

    } catch (err) {
        console.error("❌ Error sending govdocmenu:", err);
        reply(`❌ Error: ${err.message}`);
    }
});
