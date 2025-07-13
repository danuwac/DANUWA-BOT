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
    const listMessage = {
      text: "📘 *GovDoc.lk Exam Resources*",
      title: "Choose an Option",
      buttonText: "View Options",
      footer: "Powered by Danuwa MD",
      sections: [
        {
          title: "Exam Papers",
          rows: [
            { title: "📚 Term Test (Grade 6–13)", rowId: ".termtest" },
            { title: "📄 O/L Past Papers", rowId: ".olpast" },
            { title: "📄 A/L Past Papers", rowId: ".alpast" }
          ]
        }
      ]
    };

    await robin.sendMessage(from, listMessage, { quoted: mek });
  }
);
