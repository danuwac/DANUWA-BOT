const { cmd } = require("../command");

cmd(
  {
    pattern: "govdocmenu",
    desc: "GovDoc main menu",
    react: "📚",
    category: "education",
    filename: __filename,
  },
  async (robin, mek, m, { from }) => {
    const message = {
      text: `📘 *GovDoc.lk Exam Resources*\n\nPlease choose an option below:\n\n📚 Term Test Papers from Grade 6–13\n📄 GCE O/L Past Papers\n📄 GCE A/L Past Papers`,
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
      headerType: 1,
    };

    await robin.sendMessage(from, message, { quoted: mek });
  }
);
