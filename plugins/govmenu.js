const { cmd } = require("../command");
const { proto, generateWAMessageFromContent } = require('@whiskeysockets/baileys');

cmd({
  pattern: "govdocmenu",
  react: "📚",
  desc: "Show GovDoc.lk paper menu with working buttons (Baileys v6.7.18)",
  category: "education",
  filename: __filename
},
async (conn, mek, m, { from, quoted, reply }) => {
  try {
    const template = {
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

    const msg = await generateWAMessageFromContent(from, proto.Message.fromObject(template), {
      userJid: conn.user.id,
      quoted: mek
    });

    await conn.relayMessage(from, msg.message, { messageId: msg.key.id });

  } catch (err) {
    console.error("❌ govdocmenu button error:", err);
    reply(`❌ Error:\n${err.message}`);
  }
});
