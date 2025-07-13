const { cmd } = require("../command");

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
      text: "📘 *GovDoc.lk Exam Resources*\n\nChoose an option below:",
      footer: "Powered by Danuwa MD",
      templateButtons: [
        {
          index: 1,
          quickReplyButton: {
            displayText: "📚 Term Test (Grade 6–13)",
            id: ".termtest",
          },
        },
        {
          index: 2,
          quickReplyButton: {
            displayText: "📄 O/L Past Papers",
            id: ".olpast",
          },
        },
        {
          index: 3,
          quickReplyButton: {
            displayText: "📄 A/L Past Papers",
            id: ".alpast",
          },
        },
      ],
    };

    await robin.sendMessage(from, message, { quoted: mek });
  }
);
