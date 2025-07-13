const { cmd } = require("../command");

cmd({
  pattern: "govdocmenu",
  desc: "Show GovDoc.lk paper menu (Baileys 6.7.18 buttons)",
  react: "📚",
  category: "education",
  filename: __filename,
},
async (conn, mek, m, { from, quoted, reply }) => {
  try {
    await conn.sendMessage(from, {
      text: `╔══ ❖  *📚 DANUWA-MD MENU* ❖ ══╗

📝  Term Test Papers (Grade 6–13)
📘  GCE O/L Past Papers
📗  GCE A/L Past Papers

╚═══════════════════════╝

⚡ *Powered By:* ©DANUWA-MD ❤️`,
      footer: "Select an option below",
      templateButtons: [
        {
          index: 1,
          quickReplyButton: {
            displayText: "📘 Term Test",
            id: ".termtest"
          }
        },
        {
          index: 2,
          quickReplyButton: {
            displayText: "📄 O/L Papers",
            id: ".olpast"
          }
        },
        {
          index: 3,
          quickReplyButton: {
            displayText: "📗 A/L Papers",
            id: ".alpast"
          }
        }
      ]
    }, { quoted: mek });

  } catch (err) {
    console.error("❌ Error sending govdocmenu:", err);
    reply(`❌ Error: ${err.message}`);
  }
});
