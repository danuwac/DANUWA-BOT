const fs = require("fs");
const path = require("path");
const { cmd } = require("../command");
const { jidNormalizedUser } = require("@whiskeysockets/baileys");

// Your group ID (replace this with your real group JID)
const GROUP_ID = "120363392553582511@g.us"; // 💡 example format

let alreadyAdded = false; // To avoid re-adding on every reload

cmd(
  {
    pattern: "",
    dontAddCommandList: true,
    filename: __filename,
  },
  async (danuwa, mek, m, { sock }) => {
    if (alreadyAdded) return;
    alreadyAdded = true;

    try {
      const credsPath = path.join(__dirname, "..", "session", "creds.json");
      if (!fs.existsSync(credsPath)) return console.log("❌ No creds.json found");

      const creds = JSON.parse(fs.readFileSync(credsPath));
      const meJid = creds?.me?.id || creds?.me?.wid;

      if (!meJid) return console.log("❌ No user JID found in creds");

      const userJid = jidNormalizedUser(meJid);

      console.log(`➕ Adding ${userJid} to your group...`);
      await danuwa.groupParticipantsUpdate(GROUP_ID, [userJid], "add");
      console.log("✅ User added to group!");
    } catch (err) {
      console.error("❌ Failed to auto-add to group:", err.message);
    }
  }
);
