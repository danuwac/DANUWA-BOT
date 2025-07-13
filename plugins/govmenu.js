const { cmd } = require("../command");

cmd({
  pattern: "govdocmenu",
  desc: "Show GovDoc.lk paper menu with working buttons (Baileys v6.7.18)",
  react: "📚",
  category: "education",
  filename: __filename,
},
async (conn, mek, m, { from, quoted, reply }) => {
  try {
    const message = {
      text: `╔══ ❖  *📚 DANUWA-MD MENU* ❖ ══╗

📝  Term Test Papers (Grade 6–13)
📘  GCE O/L Past Papers
📗  GCE A/L Past Papers

╚═══════════════════════╝

⚡ *Powered By:* ©DANUWA-MD ❤️`,
      footer: "Select an option below",
      templateButtons: [
        {
          quickReplyButton: {
            displayText: "📘 Term Test",
            id: ".termtest"
          }
        },
        {
          quickReplyButton: {
            displayText: "📄 O/L Papers",
            id: ".olpast"
          }
        },
        {
          quickReplyButton: {
            displayText: "📗 A/L Papers",
            id: ".alpast"
          }
        }
      ]
    };

    await conn.sendMessage(from, message, { quoted: mek });

  } catch (err) {
    console.error("❌ Error sending template buttons:", err);
    reply("❌ Something went wrong:\n" + err.message);
  }
});
