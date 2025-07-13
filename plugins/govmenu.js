const { cmd } = require("../command");
const { getBuffer } = require("../lib/functions"); // Make sure this is correctly implemented

cmd(
  {
    pattern: "govdocmenu",
    desc: "Show GovDoc.lk main menu",
    react: "📚",
    category: "education",
    filename: __filename,
  },
  async (conn, mek, m, { from }) => {
    const menuText = `
╔══ ❖  *📚 DANUWA-MD MENU* ❖ ══╗

📝  Term Test Papers (Grade 6–13)
📘  GCE O/L Past Papers
📗  GCE A/L Past Papers

╚═══════════════════════╝

⚡ *Powered By:* ©DANUWA-MD ❤️
`;

    await conn.sendMessage(from, {
      text: menuText,
      contextInfo: {
        externalAdReply: {
          title: "DANUWA-MD WhatsApp Bot",
          body: "Open powerful .govdoc tools now",
          thumbnail: await getBuffer("https://i.imgur.com/B3KTpLW.jpeg"), // use your logo or banner
          sourceUrl: "https://github.com/DANUWA-MD/DANUWA-BOT", // change to your repo or site
          mediaType: 1,
          renderLargerThumbnail: true,
          showAdAttribution: true,
        },
      },
    }, { quoted: mek });
  }
);
