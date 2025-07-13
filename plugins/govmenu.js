const { cmd } = require("../command");
const { proto, generateWAMessageFromContent } = require('@whiskeysockets/baileys');

cmd({
  pattern: "govdocmenu",
  desc: "Show GovDoc.lk paper menu with working buttons (Baileys v6.7.18)",
  react: "📚",
  category: "education",
  filename: __filename,
},
async (conn, mek, m, { from, quoted, reply }) => {
  try {
    const buttonsMessage = {
      templateMessage: {
        hydratedTemplate: {
          hydratedContentText: `╔══ ❖  *📚 DANUWA-MD MENU* ❖ ══╗

📝  Term Test Papers (Grade 6–13)
📘  GCE O/L Past Papers
📗  GCE A/L Past Papers

╚═══════════════════════╝

⚡ *Powered By:* ©DANUWA-MD ❤️`,
          hydratedFooterText: "Select an option below",
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

    const message = await generateWAMessageFromContent(from, proto.Message.fromObject(buttonsMessage), {
      userJid: conn.user.id,
      quoted: mek,
    });

    await conn.relayMessage(from, message.message, { messageId: message.key.id });

  } catch (err) {
    console.error("❌ Error sending button message:", err);
    reply(`❌ Error:\n${err.message}`);
  }
});
