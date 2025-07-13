const { cmd } = require('../command');
const config = require('../config');
const { generateWAMessageFromContent } = require('@whiskeysockets/baileys');

cmd({
    pattern: "buttons",
    react: "🛎️",
    desc: "Test interactive buttons",
    category: "main",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        const buttons = [
            { buttonId: 'btn1', buttonText: { displayText: 'Button 1' }, type: 1 },
            { buttonId: 'btn2', buttonText: { displayText: 'Button 2' }, type: 1 }
        ];

        const buttonMsg = {
            text: "Test buttons:",
            footer: "Select an option",
            buttons: buttons,
            headerType: 1
        };

        await conn.sendMessage(from, { interactive: buttonMsg }, { quoted: mek });
    } catch (err) {
        console.error("🔴 BUTTON CMD ERROR:", err);
        reply("❌ Failed to send buttons. Check console.");
    }
});
