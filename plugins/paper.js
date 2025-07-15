const { cmd } = require('../command');
const config = require('../config');

cmd({
    pattern: "edu",
    react: "📚",
    desc: "Educational Zone | Download term tests and past papers.",
    category: "education",
    filename: __filename
},
async (conn, mek, m, {
    from, reply
}) => {
    try {
        const bannerImg = 'https://github.com/DANUWA-MD/DANUWA-BOT/blob/main/images/Alive.png?raw=true';

        const channelJid = '120363418166326365@newsletter'; 
        const channelName = '🍁 ＤＡＮＵＷＡ－ 〽️Ｄ 🍁';
        const channelInvite = '0029Vb65OhH7oQhap1fG1y3o';

        const caption = `╭─────── ⭓ ⭓ ⭓  ─────────╮
│   🎓 𝐄𝐃𝐔𝐂𝐀𝐓𝐈𝐎𝐍𝐀𝐋 𝐙𝐎𝐍𝐄 🎓   │
╰──────────────⟡───────╯
│ 📘 *Term Test Papers (Grades 6-11)*
│    └ Use: *.govdoc grade subject year*
│    └ Ex: *.govdoc 10 history 2024*
│──────────────────────⬣
│ 📕 *O/L Past Papers*
│    └ Use: *.pastpapers year subject*
│    └ Ex: *.pastpapers 2023 maths*   
│──────────────────────⬣
│ 📗 *A/L Past Papers*
│    └ Use: *.pastpapers physics*
│    └ Short Forms: sft, et, bst
│    └ Ex: *.pastpapers bst*
╰──────────────────────╯
⚙️ Made with ❤️ by
╰🔥 𝘿𝘼𝙉𝙐𝙆𝘼 𝘿𝙄𝙎𝘼𝙉𝘼𝙔𝘼𝙆𝘼 🔥`;
        await conn.sendMessage(from, {
            image: { url: bannerImg },
            caption,
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
        console.error(err);
        reply(`❌ Error: ${err.message}`);
    }
});
