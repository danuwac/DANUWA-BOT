const { cmd } = require("../command");

cmd(
  {
    pattern: "govdoc",
    desc: "GovDoc.lk main menu",
    react: "📚",
    category: "education",
    filename: __filename,
  },
  async (robin, mek, m, { from }) => {
    const message = {
      text: "📘 *GovDoc.lk Exam Resources*\n\nChoose a category:",
      footer: "Danuwa MD WhatsApp Bot",
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
      headerType: 1, // use 1 = text header, 4 = image, etc.
    };

    await robin.sendMessage(from, message, { quoted: mek });
  }
);
