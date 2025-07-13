const { cmd } = require("../command"); // adjust path based on your bot

cmd(
  {
    pattern: "govdocmenu",
    desc: "GovDoc main menu",
    react: "📚",
    category: "education",
    filename: __filename,
  },
  async (conn, mek, m, { from }) => {
    const message = {
      text: "📘 *GovDoc.lk Exam Resources*\n\nChoose a category below:",
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
      headerType: 1, // required!
    };

    await conn.sendMessage(from, message, { quoted: mek });
  }
);
