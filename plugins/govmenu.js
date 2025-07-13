const { cmd } = require("../command");

cmd({
  pattern: "govdocmenu",
  desc: "Show GovDoc.lk paper menu with classic buttons",
  react: "📚",
  category: "education",
  filename: __filename,
},
async (conn, mek, m, { from, quoted, reply }) => {
  try {
    const buttonMessage = {
      text: `╔══ ❖  *📚 DANUWA-MD MENU* ❖ ══╗

📝  Term Test Papers (Grade 6–13)
📘  GCE O/L Past Papers
📗  GCE A/L Past Papers

╚═══════════════════════╝

⚡ *Powered By:* ©DANUWA-MD ❤️`,
      footer: "Select an option below",
      buttons: [
        {
          buttonId: ".termtest",
          buttonText: {
            displayText: "📘 Term Test"
          },
          type: 1
        },
        {
          buttonId: ".olpast",
          buttonText: {
            displayText: "📄 O/L Papers"
          },
          type: 1
        },
        {
          buttonId: ".alpast",
          buttonText: {
            displayText: "📗 A/L Papers"
          },
          type: 1
        }
      ],
      headerType: 1
    };

    await conn.sendMessage(from, buttonMessage, { quoted: mek });

  } catch (err) {
    console.error("❌ Error sending govdocmenu:", err);
    reply(`❌ Error: ${err.message}`);
  }
});
