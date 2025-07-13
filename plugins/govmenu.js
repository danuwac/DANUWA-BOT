const { cmd } = require("../command");
const { proto, generateWAMessageFromContent } = require('@whiskeysockets/baileys');

cmd({
  pattern: "govdocmenu",
  desc: "Test button menu",
  react: "📚",
  category: "education",
  filename: __filename,
},
async (conn, mek, m, { from, quoted, reply }) => {
  try {
    const content = {
      templateMessage: {
        hydratedTemplate: {
          hydratedContentText: "📚 *DANUWA-MD MENU*\n\nChoose an option below:",
          hydratedFooterText: "Powered by DANUWA-MD ❤️",
          hydratedButtons: [
            {
              quickReplyButton: {
                displayText: "📘 Term Test",
                id: ".termtest"
              }
            },
            {
              quickReplyButton: {
                displayText: "📄 O/L Papers",
                id: ".olpast"
              }
            },
            {
              quickReplyButton: {
                displayText: "📗 A/L Papers",
                id: ".alpast"
              }
            }
          ]
        }
      }
    };

    const msg = await generateWAMessageFromContent(from, proto.Message.fromObject(content), {
      userJid: conn.user.id,
      quoted: mek
    });

    await conn.relayMessage(from, msg.message, { messageId: msg.key.id });

  } catch (err) {
    console.error("❌ Error in govdocmenu:", err);
    await reply("❌ Error: " + err.message);
  }
});
