const { cmd } = require("../command");

cmd(
  {
    pattern: "govdocmenu",
    desc: "GovDoc.lk main menu",
    react: "📚",
    category: "education",
    filename: __filename,
  },
  async (conn, m) => {
    const menuText = `
╔══ ❖  *📚 DANUWA-MD MENU* ❖ ══╗

📝  Term Test Papers (Grade 6–13)
📘  GCE O/L Past Papers
📗  GCE A/L Past Papers

╚═══════════════════════╝

⚡ *Powered By:* ©DANUWA-MD ❤️
`;

    try {
      console.log("📩 Sending to:", m.chat);

      await conn.sendMessage(m.chat, {
        text: menuText,
        footer: "📘 Choose a category",
        buttons: [
          { buttonId: ".termtest", buttonText: { displayText: "📘 Term Test" }, type: 1 },
          { buttonId: ".olpast", buttonText: { displayText: "📄 O/L Papers" }, type: 1 },
          { buttonId: ".alpast", buttonText: { displayText: "📗 A/L Papers" }, type: 1 }
        ],
        headerType: 1,
      }, { quoted: m });

    } catch (err) {
      console.error("❌ Error sending button message:", err);
    }
  }
);
