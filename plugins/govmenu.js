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
  text: "📘 *GovDoc.lk Exam Resources*",
  footer: "Powered by Danuwa MD",
  title: "Choose an option:",
  buttonText: "View Options",
  sections: [
    {
      title: "Exam Resources",
      rows: [
        { title: "📚 Term Test (Grade 6–13)", rowId: ".termtest" },
        { title: "📄 O/L Past Papers", rowId: ".olpast" },
        { title: "📄 A/L Past Papers", rowId: ".alpast" }
      ]
    }
  ]
};

    await robin.sendMessage(from, message, { quoted: mek });
  }
);
