const { cmd } = require('../command');
const config = require('../config');
const { generateWAMessageFromContent } = require('@whyskeysockets/baileys');

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

// Handle button responses
module.exports.handleBotButtons = async (conn, msg) => {
    try {
        const from = msg.key.remoteJid;
        const buttonId = msg.message?.interactiveResponseMessage?.selectedButtonId;
        
        if (buttonId) {
            let responseText = '';
            
            switch(buttonId) {
                case 'btn1':
                    responseText = '🌟 You pressed Button 1! Thanks for testing!';
                    break;
                case 'btn2':
                    responseText = '🔔 You pressed Button 2! Great choice!';
                    break;
                case 'btn3':
                    responseText = '🌀 You pressed Button 3! Awesome!';
                    break;
                default:
                    responseText = '⚠️ Unknown button pressed';
            }
            
            await conn.sendMessage(from, { text: responseText });
        }
    } catch (err) {
        console.error('Button handler error:', err);
    }
};
