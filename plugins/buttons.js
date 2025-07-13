const { cmd } = require('../command');

cmd({
    pattern: "testbutton",
    react: "🧪",
    desc: "Send a test message with buttons",
    category: "main",
    filename: __filename
},
async (conn, mek, m, {
    from, reply
}) => {
    try {
        await conn.sendMessage(from, {
            text: "🧪 *This is a test message with buttons!*",
            footer: "🔧 Powered by Danuwa MD",
            buttons: [
                { buttonId: 'id1', buttonText: { displayText: '💡 Test 1' }, type: 1 },
                { buttonId: 'id2', buttonText: { displayText: '⚙️ Test 2' }, type: 1 },
                { buttonId: 'id3', buttonText: { displayText: '📞 Call Owner' }, type: 1 }
            ],
            headerType: 1,
            contextInfo: {
                externalAdReply: {
                    showAdAttribution: true,
                    title: 'DANUWA-MD',
                    body: 'Official Bot Test',
                    mediaType: 1,
                    previewType: "PHOTO",
                    renderLargerThumbnail: true,
                    thumbnailUrl: "https://github.com/DANUWA-MD/DANUWA-BOT/blob/main/images/Alive.png?raw=true",
                    sourceUrl: "https://github.com/DANUWA-MD/DANUWA-BOT"
                }
            }
        }, { quoted: mek });

    } catch (err) {
        console.error(err);
        reply(`❌ Error: ${err.message}`);
    }
});
