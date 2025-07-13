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
            { buttonId: 'id1', buttonText: { displayText: 'Button 1' }, type: 1 },
            { buttonId: 'id2', buttonText: { displayText: 'Button 2' }, type: 1 },
            { buttonId: 'id3', buttonText: { displayText: 'Button 3' }, type: 1 }
        ];

        const buttonMessage = {
            text: "Please select an option:",
            footer: "Button Test",
            buttons: buttons,
            headerType: 1
        };

        // Correct way to send interactive buttons
        await conn.sendMessage(from, {
            interactive: buttonMessage
        }, { quoted: mek });

    } catch (err) {
        console.error("⚠️ Button command error:", err);
        reply("❌ Failed to send buttons. Check logs.");
    }
});
