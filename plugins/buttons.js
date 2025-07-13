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
        // SIMPLE BUTTONS (Highest success rate)
        await conn.sendMessage(from, {
            text: "📌 *DANUWA-MD BUTTON TEST*",
            footer: "Tap a button below",
            buttons: [
                { buttonId: 'id1', buttonText: { displayText: '⚙️ Settings' }, type: 1 },
                { buttonId: 'id2', buttonText: { displayText: '📊 Stats' }, type: 1 }
            ],
            headerType: 1
        });

        // LIST MESSAGE (Alternative)
        await conn.sendMessage(from, {
            text: "📋 MAIN MENU",
            title: "DANUWA-MD OPTIONS",
            sections: [
                {
                    title: "🔧 TOOLS",
                    rows: [
                        { title: "Settings", rowId: "row1" },
                        { title: "Statistics", rowId: "row2" }
                    ]
                }
            ],
            buttonText: "VIEW OPTIONS"
        }, { quoted: mek });

    } catch (err) {
        console.error("🔴 BUTTON ERROR:", err);
        // Fallback text menu
        await reply(`
📌 *TEXT MENU (Fallback)*
1. ⚙️ Settings - type .settings
2. 📊 Stats - type .stats
        `);
    }
});
