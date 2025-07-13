const { cmd } = require("../command"); // Adjust path if needed
const { proto } = require("@whiskeysockets/baileys"); // Baileys import for compatibility

cmd(
  {
    pattern: "govdocmenu",
    desc: "GovDoc.lk main menu",
    react: "📚",
    category: "education",
    filename: __filename,
  },
  async (robin, mek, m, { from }) => {
    const message = {
      text: "📘 *GovDoc.lk Exam Resources*\n\nPlease select a category:",
      footer: "Powered by Danuwa MD",
      buttons: [
        {
          buttonId: ".termtest",
          buttonText: { displayText: "📚 Term Test (Grade 6–13)" },
          type: 1,
        },
        {
          buttonId: ".olpast",
          buttonText: { displayText: "📄 O/L Past Papers" },
          type: 1,
        },
        {
          buttonId: ".alpast",
          buttonText: { displayText: "📄 A/L Past Papers" },
          type: 1,
        },
      ],
      headerType: 1, // 1 = text only
    };

    await robin.sendMessage(from, message, { quoted: mek });
  }
);
