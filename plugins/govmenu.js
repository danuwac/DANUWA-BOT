const { cmd } = require("../command");

cmd(
  {
    pattern: "govdocmenu",
    desc: "GovDoc.lk menu",
    react: "📚",
    category: "education",
    filename: __filename,
  },
  async (conn, mek, m, { from }) => {
    const menuText = `╔══ ❖  *📚 DANUWA-MD MENU* ❖ ══╗

📝  Term Test Papers (Grade 6–13)
📘  GCE O/L Past Papers
📗  GCE A/L Past Papers

╚═══════════════════════╝
⚡ *Powered By:* ©DANUWA-MD ❤️`;

    await conn.sendMessage(from, {
      text: menuText,
      footer: "Select an option below 👇",
      buttons: [
        { buttonId: ".termtest", buttonText: { displayText: "📚 Term Tests" }, type: 1 },
        { buttonId: ".olpast", buttonText: { displayText: "📄 O/L Past Papers" }, type: 1 },
        { buttonId: ".alpast", buttonText: { displayText: "📄 A/L Past Papers" }, type: 1 },
      ],
      headerType: 1,
    }, { quoted: mek });
  }
);
