const {
  default: makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  jidNormalizedUser,
  getContentType,
  proto,
  generateWAMessageContent,
  generateWAMessage,
  AnyMessageContent,
  prepareWAMessageMedia,
  areJidsSameUser,
  downloadContentFromMessage,
  MessageRetryMap,
  generateForwardMessageContent,
  generateWAMessageFromContent,
  generateMessageID, makeInMemoryStore,
  jidDecode,
  fetchLatestBaileysVersion,
  Browsers
} = require('@whiskeysockets/baileys');

const fs = require('fs');
const P = require('pino');
const config = require('./config');
const { ownerNumber } = require('./config');
const { BOT_OWNER } = require('./config');
const util = require('util');
const axios = require('axios');
const qrcode = require('qrcode-terminal');
const { sms } = require('./lib/msg');
const { getBuffer, getGroupAdmins, getRandom, h2k, isUrl, Json, runtime, sleep, fetchJson } = require('./lib/functions');
const { File } = require('megajs');
const express = require("express");
const path = require('path');
const https = require("https");


const app = express();
const port = process.env.PORT || 8000;

const prefix = '.';
if (!fs.existsSync(__dirname + '/auth_info_baileys/creds.json')) {
  if (!config.SESSION_ID) return console.log('❗ [DANUWA-MD] SESSION_ID not found in env. Please configure it.');
  const sessdata = config.SESSION_ID;
  const filer = File.fromURL(`https://mega.nz/file/${sessdata}`);
  filer.download((err, data) => {
    if (err) throw err;
    fs.writeFile(__dirname + '/auth_info_baileys/creds.json', data, () => {
      console.log("📥 [DANUWA-MD] Session file downloaded and saved.");
    });
  });
}

const { replyHandlers, commands } = require('./command');
async function loadRemotePlugins() {
  console.log("🔧 [DANUWA-MD] Installing plugins...");

  global.pluginHooks = [];

  const jsonUrl = "https://test30-26o.pages.dev/plugins.json";
  const basePluginURL = "https://test30-26o.pages.dev/plugins/";

  const tempDir = path.join(__dirname, "remote_plugins");
  if (!fs.existsSync(tempDir)) fs.mkdirSync(tempDir);

  try {
    const res = await axios.get(jsonUrl);
    const pluginList = res.data;

    for (const plugin of pluginList) {
      const name = plugin.name;
      const pluginURL = basePluginURL + name;
      const filePath = path.join(tempDir, name);

      // Download plugin file
      const file = fs.createWriteStream(filePath);
      await new Promise((resolve, reject) => {
        https.get(pluginURL, (response) => {
          response.pipe(file);
          file.on("finish", () => {
            file.close(resolve);
          });
        }).on("error", (err) => {
          fs.unlink(filePath, () => {});
          reject(err);
        });
      });

      try {
        const plugin = require(filePath);
        if (plugin && (plugin.onMessage || plugin.onDelete)) {
          global.pluginHooks.push(plugin);
        }
      } catch (err) {
        console.error(`[❌ Error Loading Plugin] ${name}:`, err.message);
      }
    }

  } catch (err) {
    console.error("❌ [DANUWA-MD] Failed to load plugins:", err.message);
  }
}

async function connectToWA() {
  console.log("🛰️ [DANUWA-MD] Initializing WhatsApp connection...");
  const { state, saveCreds } = await useMultiFileAuthState(__dirname + '/auth_info_baileys/');
  const { version } = await fetchLatestBaileysVersion();
  
  const conn = makeWASocket({
    logger: P({ level: 'silent' }),
    printQRInTerminal: false,
    browser: Browsers.macOS("Firefox"),
    syncFullHistory: true,
    auth: state,
    version
  });

  conn.ev.on('group-participants.update', async (update) => {
    console.log("📥 New Group Update:", update.id); // group JID will be printed
  });
  conn.ev.on('group-participants.update', async (update) => {
    try {
      const { id: groupId, participants, action } = update;
      const metadata = await conn.groupMetadata(groupId);
      const groupName = metadata.subject || 'this group';

      if (action === 'add') {
        for (const userId of participants) {
          if (global.antiFakeGroups?.[groupId]) {
            const number = userId.split('@')[0];
            if (!number.startsWith("94")) { // Block users not starting with +94 (Sri Lanka)
              await conn.sendMessage(groupId, {
                text: `📵 @${number} removed — only Sri Lankan numbers allowed.`,
                mentions: [userId]
              });
              await conn.groupParticipantsUpdate(groupId, [userId], "remove");
              continue;
            }
          }
          const number = userId.split('@')[0];
          const message = `🗯️ *WELCOME TO ${groupName}, @${number}!* ❤‍🩹\n\nWe’re delighted to have you join our community.\n\n✅ Please take a moment to read the group rules and feel free to introduce yourself.\n\n💎 *Let’s build a friendly and respectful environment together!*`;

          await conn.sendMessage(groupId, {
            image: { url: 'https://github.com/DANUWA-MD/DANUWA-BOT/blob/main/images/welcome.jpg?raw=true' },
            caption: message,
            mentions: [userId]
          });
        }
      }

      if (action === 'remove') {
        for (const userId of participants) {
          const number = userId.split('@')[0];
          const message = `👋 *Goodbye @${number}!* 👋\n\nThank you for being part of ${groupName}. *We wish you all the best!❤‍🩹*`;

          await conn.sendMessage(groupId, {
            image: { url: 'https://github.com/DANUWA-MD/DANUWA-BOT/blob/main/images/leave.jpg?raw=true' },
            caption: message,
            mentions: [userId]
          });
        }
      }
    } catch (e) {
      console.error('Group participants update error:', e);
    }
  });

  conn.ev.on('connection.update', async (update) => {
  const { connection, lastDisconnect } = update;
  if (connection === 'close' && lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut) {
    connectToWA();
  } else if (connection === 'open') {
    await loadRemotePlugins();
    console.log('✅ [DANUWA-MD] All plugins installed Successfully');
      const up = `
╔═══◉ *🟢 STATUS: ONLINE* ◉═══╗
║  𝙷𝚎𝚢 𝙳𝚞𝚍𝚎, 𝙸’𝚖 𝚑𝚎𝚛𝚎 𝚝𝚘 𝚑𝚎𝚕𝚙 𝚢𝚘𝚞.  
║  𝙰𝚜𝚔 𝚖𝚎 𝚊𝚗𝚢𝚝𝚑𝚒𝚗𝚐! 💬
╚══════════════════════╝

🧾 *PROFILE INFORMATION*
┌──────── ⋆⋅☆⋅⋆ ────────┐
│ 🔐 *Owner:* Danuka Disanayaka  
│ 👤 *Botname:* DANUWA-MD  
│ ⚡ *Bio:* Powerful WhatsApp Bot  
│ 🧩 *Role:* Wizard Lord 🧙‍♂️  
└──────── ⋆⋅☆⋅⋆ ────────┘

🚀 Powered By *DANUKA*
*DISANAYAKA* 🔥
      `;
      conn.sendMessage(ownerNumber[0] + "@s.whatsapp.net", {
        image: { url: config.ALIVE_IMG },
        caption: up
      });
    }
  });

  conn.ev.on('creds.update', saveCreds);

  conn.ev.on('messages.upsert', async(mek) => {
    mek = mek.messages[0];
    if (!mek.message) return;
    const contentType = getContentType(mek.message);
    const content = mek.message[contentType];

    if (['imageMessage', 'videoMessage', 'audioMessage', 'stickerMessage', 'documentMessage'].includes(contentType)) {
      try {
        const stream = await downloadContentFromMessage(content, contentType.replace('Message', ''));
        const buffer = [];
        for await (const chunk of stream) buffer.push(chunk);
        mek._mediaBuffer = Buffer.concat(buffer);
        mek._mediaType = contentType;
      } catch (err) {
        console.log('❌ Failed to pre-download media:', err.message);
      }
    }

    // Run plugins onMessage hooks
    if (getContentType(mek.message) === 'ephemeralMessage') {
      mek.message = mek.message.ephemeralMessage.message;
    }

// ✅ Then call plugin hooks

    if (global.pluginHooks) {
      for (const plugin of global.pluginHooks) {
        if (plugin.onMessage) {
          try {
            await plugin.onMessage(conn, mek);
          } catch (e) {
            console.log("onMessage error:", e);
          }
        }
      }
    }
    if (config.READ_MESSAGE === 'true') {
      await conn.readMessages([mek.key]); 
      console.log(`Marked message from ${mek.key.remoteJid} as read.`);
    }
    
    if(mek.message.viewOnceMessageV2)
      mek.message = (getContentType(mek.message) === 'ephemeralMessage') ? mek.message.ephemeralMessage.message : mek.message;

    // ✅ Auto-status seen

    if (mek.key?.remoteJid === 'status@broadcast') {
      const senderJid = mek.key.participant || mek.key.remoteJid || "unknown@s.whatsapp.net";
      const mentionJid = senderJid.includes("@s.whatsapp.net") ? senderJid : senderJid + "@s.whatsapp.net";

  // ✅ Auto Status Seen
      if (config.AUTO_STATUS_SEEN === "true") {
        try {
          await conn.readMessages([mek.key]);
          console.log(`[✓] Status seen: ${mek.key.id}`);
        } catch (e) {
          console.error("❌ Failed to mark status as seen:", e);
        }
      }

  // ✅ Auto Status React
      if (config.AUTO_STATUS_REACT === "true" && mek.key.participant) {
        try {
          const emojis = ['❤️', '💸', '😇', '🍂', '💥', '💯', '🔥', '💫', '💎', '💗', '🤍', '🖤', '👀', '🙌', '🙆', '🚩', '🥰', '💐', '😎', '🤎', '✅', '🫀', '🧡', '😁', '😄', '🌸', '🕊️', '🌷', '⛅', '🌟', '🗿', '💜', '💙', '🌝', '🖤', '💚'];
          const randomEmoji = emojis[Math.floor(Math.random() * emojis.length)];

          await conn.sendMessage(mek.key.participant, {
            react: {
              text: randomEmoji,
              key: mek.key,
            }
          });

          console.log(`[✓] Reacted to status of ${mek.key.participant} with ${randomEmoji}`);
        } catch (e) {
          console.error("❌ Failed to react to status:", e);
        }
      }

  // ✅ Text-Only Status Forward
      if (mek.message?.extendedTextMessage && !mek.message.imageMessage && !mek.message.videoMessage) {
        const text = mek.message.extendedTextMessage.text || "";
        if (text.trim().length > 0) {
          try {
            await conn.sendMessage(ownerNumber[0] + "@s.whatsapp.net", {
              text: `╭─────── ⭓ ⭓ ⭓  ─────────╮
│     🍁 ＤＡＮＵＷＡ－ 〽️Ｄ 🍁    │
╰──────────────⟡───────╯

📝 *Text Status*
👤 From: @${mentionJid.split("@")[0]}

${text}`,
              mentions: [mentionJid]
            });
            console.log(`✅ Text-only status from ${mentionJid} forwarded.`);
          } catch (e) {
            console.error("❌ Failed to forward text status:", e);
          }
        }
      }

  // ✅ Media Status Forward (image/video)
      if (mek.message?.imageMessage || mek.message?.videoMessage) {
        try {
          const msgType = mek.message.imageMessage ? "imageMessage" : "videoMessage";
          const mediaMsg = mek.message[msgType];

          const stream = await downloadContentFromMessage(
            mediaMsg,
            msgType === "imageMessage" ? "image" : "video"
          );

          let buffer = Buffer.from([]);
          for await (const chunk of stream) {
            buffer = Buffer.concat([buffer, chunk]);
          }

          const mimetype = mediaMsg.mimetype || (msgType === "imageMessage" ? "image/jpeg" : "video/mp4");
          const captionText = mediaMsg.caption || "";

          await conn.sendMessage(ownerNumber[0] + "@s.whatsapp.net", {
            [msgType === "imageMessage" ? "image" : "video"]: buffer,
            mimetype,
            caption: `╭─────── ⭓ ⭓ ⭓  ─────────╮
│     🍁 ＤＡＮＵＷＡ－ 〽️Ｄ 🍁    │
╰──────────────⟡───────╯

📥 *Forwarded Status*
👤 From: @${mentionJid.split("@")[0]}

${captionText}`,
            mentions: [mentionJid]
          });

          console.log(`✅ Media status from ${mentionJid} forwarded.`);
        } catch (err) {
          console.error("❌ Failed to download or forward media status:", err);
        }
      }
    }
    if (mek.key && mek.key.remoteJid === 'status@broadcast' && config.AUTO_STATUS_REPLY === "true"){
      const user = mek.key.participant;
      const text = `${config.AUTO_STATUS__MSG}`;
      await conn.sendMessage(user, { text: text, react: { text: '✈️', key: mek.key } }, { quoted: mek });
    }

    const m = sms(conn, mek);
    const type = getContentType(mek.message);
    const from = mek.key.remoteJid;
    const body = type === 'conversation'
      ? mek.message.conversation
      : mek.message[type]?.text || mek.message[type]?.caption || '';

    const isCmd = body.startsWith(prefix);
    const commandName = isCmd ? body.slice(prefix.length).trim().split(" ")[0].toLowerCase() : '';
    const args = body.trim().split(/ +/).slice(1);
    const q = args.join(' ');

    const sender = mek.key.fromMe 
      ? (conn.user.id.split(':')[0]+'@s.whatsapp.net' || conn.user.id) 
      : (mek.key.participant || mek.key.remoteJid);

    const senderNumber = sender.split('@')[0];
    const isGroup = from.endsWith('@g.us');

    const botNumber = conn.user.id.split(':')[0];
    const pushname = mek.pushName || 'Sin Nombre';
    const isMe = botNumber.includes(senderNumber);
    const isOwner = ownerNumber.includes(senderNumber) || isMe;

    const botNumber2 = await jidNormalizedUser(conn.user.id);

    // [FIXED] Normalize admin checks to prevent admin detection issues
    const groupMetadata = isGroup ? await conn.groupMetadata(from).catch(() => ({})) : {};
    const groupName = groupMetadata?.subject || 'No Group Name'; // [FIXED] safe groupName default
    const participants = groupMetadata.participants || [];

    const groupAdminsRaw = isGroup ? getGroupAdmins(participants) : [];
    const groupAdmins = groupAdminsRaw.map(jidNormalizedUser);

    const senderId = jidNormalizedUser(sender);
    const botId = jidNormalizedUser(conn.user.id);

    const isAdmins = groupAdmins.includes(senderId);
    const isBotAdmins = groupAdmins.includes(botId);

    if (isGroup && global.antiLinkGroups?.[from] && !isAdmins && /(https?:\/\/[^\s]+)/i.test(body)) {
      await conn.sendMessage(from, {
        text: `🚫 Link detected!\n@${senderNumber} has been removed from *${groupName}*!`,
        mentions: [sender]
      });
      await conn.groupParticipantsUpdate(from, [sender], "remove");
    }
    const badwords = ["fuck", "shit", "idiot", "bitch", "puka", "උඹ", "කැරියා", "හුත්තා" ,"පකයා", "හුකන්නා", "පොන්නයා"];
    if (isGroup && global.antiBadwordGroups?.[from] && !isAdmins) {
      if (badwords.some(word => body.toLowerCase().includes(word))) {
        await conn.sendMessage(from, {
          text: `🧼 Bad word detected!\n@${senderNumber} has been removed from *${groupName}*!`,
          mentions: [sender]
        });
        await conn.groupParticipantsUpdate(from, [sender], "remove");
      }
    }

    // Reply helper
   
    const reply = (text, options = {}) => conn.sendMessage(from, { text, ...options }, { quoted: mek });
 /*
    // Auto-reply greeting plugin
    try {
      const autoReply = require("./plugins/auto-reply.js");
      if (autoReply.autoreply) await autoReply.autoreply(conn, mek);
    } catch (err) {
      console.log("🔁 Auto-reply plugin error:", err);
    }
*/
    conn.decodeJid = jid => {
      if (!jid) return jid;
      if (/:\d+@/gi.test(jid)) {
        let decode = jidDecode(jid) || {};
        return (
          (decode.user &&
            decode.server &&
            decode.user + '@' + decode.server) ||
          jid
        );
      } else return jid;
    };

    if (isCmd) {
      const cmd = commands.find((c) => c.pattern === commandName || (c.alias && c.alias.includes(commandName)));
      if (cmd) {
        switch ((config.MODE || 'public').toLowerCase()) {
          case 'private':
            if (!isOwner) return;
            break;
          case 'public':
          default:
            break;
        }
        
        if (cmd.react) conn.sendMessage(from, { react: { text: cmd.react, key: mek.key } });

        try {
          cmd.function(conn, mek, m, {
            from, quoted: mek, body, isCmd, command: commandName, args, q,
            isGroup, sender, senderNumber, botNumber2, botNumber, pushname,
            isMe, isOwner, groupMetadata, groupName, participants, groupAdmins,
            isBotAdmins, isAdmins, reply,
          });
        } catch (e) {
          console.error("[PLUGIN ERROR] " + e);
        }
      }
    }

    const replyText = body;
    for (const handler of replyHandlers) {
      if (handler.filter(replyText, { sender, message: mek })) {
        try {
          await handler.function(conn, mek, m, {
            from, quoted: mek, body: replyText, sender, reply,
          });
          break;
        } catch (e) {
          console.log("Reply handler error:", e);
        }
      }
    }
  });

  conn.ev.on('messages.update', async (updates) => {
    if (global.pluginHooks) {
      for (const plugin of global.pluginHooks) {
        if (plugin.onDelete) {
          try {
            await plugin.onDelete(conn, updates);
          } catch (e) {
            console.log("onDelete error:", e);
          }
        }
      }
    }
  });
}

app.get("/", (req, res) => {
  res.send("Hey, DANUWA-MD started✅");
});

app.listen(port, () => console.log(`🌐 [DANUWA-MD] Web server running → http://localhost:${port}`));

setTimeout(() => {
  connectToWA();
}, 4000);
