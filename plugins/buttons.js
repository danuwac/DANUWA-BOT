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
        // Simple quick reply buttons
        const buttons = [
            {
                buttonId: 'btn1',
                buttonText: { displayText: '⭐ Button 1' },
                type: 1
            },
            {
                buttonId: 'btn2',
                buttonText: { displayText: '🔔 Button 2' },
                type: 1
            },
            {
                buttonId: 'btn3',
                buttonText: { displayText: '🌀 Button 3' },
                type: 1
            }
        ];

        const buttonMessage = {
            text: `╭─────── ⭓ *${config.BOT_NAME}* ⭓ ───────╮\n` +
                  `│         🛎️ *BUTTON TEST* 🛎️         │\n` +
                  `╰───────────────────────⟡───────╯\n` +
                  `│ Please select an option below:\n` +
                  `│ These are interactive buttons\n` +
                  `╰───────────────⬣\n` +
                  `⚙️ Made with ❤️ by ${config.OWNER_NAME || 'DANUKA DISANAYAKA'}`,
            footer: 'Tap a button to respond',
            buttons: buttons,
            headerType: 1
        };

        await conn.relayMessage(
            from,
            {
                viewOnceMessage: {
                    message: {
                        messageContextInfo: {
                            deviceListMetadata: {},
                            deviceListMetadataVersion: 2
                        },
                        interactiveMessage: buttonMessage
                    }
                }
            },
            { messageId: generateWAMessageFromContent(from, buttonMessage, {}) }
        );

    } catch (err) {
        console.error('Button error:', err);
        reply(`❌ Error: ${err.message}`);
    }
});
