const { cmd } = require('../command');

cmd({
    pattern: "buttons",
    react: "✅",
    desc: "Test interactive buttons",
    category: "main",
    filename: __filename
},
async (conn, mek, m, { from, reply }) => {
    try {
        // Method 1: Native Interactive Message (Best Success Rate)
        const buttonMsg = {
            text: "📌 *DANUWA-MD BUTTON TEST* 📌\nPlease select an option:",
            footer: "Powered by DANUWA-MD",
            buttons: [
                { buttonId: 'opt1', buttonText: { displayText: '🛠️ Settings' }, type: 1 },
                { buttonId: 'opt2', buttonText: { displayText: 'ℹ️ Info' }, type: 1 },
                { buttonId: 'opt3', buttonText: { displayText: '🚀 Features' }, type: 1 }
            ],
            headerType: 1
        };

        await conn.sendMessage(from, buttonMsg, { quoted: mek });

        // Method 2: List Message (Alternative)
        const listMsg = {
            text: "📋 *DANUWA-MD MENU*",
            title: "MAIN OPTIONS",
            footer: "Select an option below",
            buttonText: "CLICK TO VIEW",
            sections: [
                {
                    title: "⚙️ BOT CONTROLS",
                    rows: [
                        { title: "🔧 Settings", description: "Bot configuration", rowId: "settings" },
                        { title: "📊 Stats", description: "Bot statistics", rowId: "stats" }
                    ]
                },
                {
                    title: "ℹ️ INFORMATION",
                    rows: [
                        { title: "📝 Help", description: "Show help menu", rowId: "help" },
                        { title: "💡 About", description: "About this bot", rowId: "about" }
                    ]
                }
            ]
        };

        await new Promise(resolve => setTimeout(resolve, 1500));
        await conn.sendMessage(from, listMsg, { quoted: mek });

    } catch (err) {
        console.error("🔴 BUTTON ERROR:", err);
        // Fallback to text menu if buttons fail
        const textMenu = `
📌 *DANUWA-MD MENU* (Text Fallback)

1. 🛠️ Settings - .settings
2. ℹ️ Info - .info
3. 🚀 Features - .features

Reply with the number of your choice.
        `;
        await reply(textMenu);
    }
});
