const { cmd } = require("../command");

const userSelection = {};

// Step 1: Menu command
cmd(
  {
    pattern: "papertest",
    react: "📚",
    desc: "Open paper type selection menu",
    category: "education",
    filename: __filename,
  },
  async (robin, mek, m, { from, sender, reply }) => {
    const menu = `📚 *Choose a paper category:*
    
1. Term Test Papers
2. GCE O/L Past Papers
3. GCE A/L Past Papers

_Reply with a number (1-3) to continue._`;

    await robin.sendMessage(from, { text: menu }, { quoted: mek });

    userSelection[sender] = {
      step: "awaiting_choice",
      quoted: mek,
    };
  }
);

// Step 2: Handle reply
cmd(
  {
    filter: (text, { sender }) =>
      userSelection[sender] &&
      userSelection[sender].step === "awaiting_choice" &&
      /^[1-3]$/.test(text.trim()),
  },
  async (robin, mek, m, { sender, from, reply }) => {
    const choice = parseInt(m.text.trim());

    delete userSelection[sender];

    switch (choice) {
      case 1:
        return reply("📝 Please type: `.govdoc 10 ict` (grade & subject)");
      case 2:
        return reply("📝 Please type: `.pastol 2024 ict` (year & subject)");
      case 3:
        return reply("📝 Please type: `.pastpapers biology` (subject only)");
      default:
        return reply("❌ Invalid option.");
    }
  }
);
