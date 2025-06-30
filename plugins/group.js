const { cmd } = require("../command");
const { getGroupAdmins } = require("../lib/functions"); // Adjust path if needed
const { downloadMediaMessage } = require('@whiskeysockets/baileys');


function getTargetUser(mek, quoted, args) {
  if (mek.message?.extendedTextMessage?.contextInfo?.mentionedJid?.length) {
    return mek.message.extendedTextMessage.contextInfo.mentionedJid[0];
  } else if (quoted?.sender) {
    return quoted.sender;
  } else if (args[0]?.includes("@")) {
    return args[0].replace("@", "") + "@s.whatsapp.net";
  }
  return null;
}

cmd({
  pattern: "kick",
  react: "👢",
  desc: "Kick user from group",
  category: "group",
  filename: __filename,
}, async (robin, mek, m, { isGroup, isAdmins, reply, participants, quoted, args }) => {
  if (!isGroup || !isAdmins) 
    return reply("*Group only & both you and I must be admins.*");

  const target = getTargetUser(mek, quoted, args);
  if (!target) return reply("*Mention or reply to a user to kick.*");

  const groupAdmins = getGroupAdmins(participants);
  if (groupAdmins.includes(target)) 
    return reply("*I can't kick an admin.*");

  await robin.groupParticipantsUpdate(m.chat, [target], "remove");
  return reply(`*Kicked:* @${target.split("@")[0]}`, { mentions: [target] });
});

cmd({
  pattern: "tagall",
  react: "📢",
  desc: "Tag all group members",
  category: "group",
  filename: __filename,
}, async (robin, mek, m, { isGroup, isAdmins, reply, participants }) => {
  if (!isGroup) return reply("*🚫 This command can only be used in groups.*");
  if (!isAdmins) return reply("*🔒 Only group admins can use this command.*");

  let validParticipants = participants.filter(p => {
    const number = p.id.split("@")[0];
    return /^\d{9,15}$/.test(number);
  });

  if (validParticipants.length === 0) {
    return reply("*❗ No valid members found to tag.*");
  }

  const mentions = validParticipants.map(p => p.id);
  const displayTags = validParticipants.map(p => `@${p.id.split("@")[0]}`);

  let lines = [];
  const chunkSize = 5;
  for (let i = 0; i < displayTags.length; i += chunkSize) {
    lines.push(displayTags.slice(i, i + chunkSize).join(" "));
  }

  const text = `
╭───────✧📢 TAG ALL 📢✧───────╮
│  *Attention everyone!*  
│  
${lines.map(line => "│  " + line).join("\n")}
│  
╰────────────────────────────╯
  `.trim();

  return reply(text, { mentions });
});

cmd({
  pattern: "setpp",
  desc: "Set group profile picture",
  category: "group",
  filename: __filename
}, async (robin, mek, m, { isGroup, isAdmins, reply, participants, args, quoted }) => {
  if (!isGroup) return reply("❌ This command can only be used in groups!");
  if (!isAdmins) return reply("❌ You must be a group admin to use this command!");

  if (!quoted?.message?.imageMessage) return reply("🖼️ Please reply to an image to set as the group profile photo.");

  try {
    const media = await downloadMediaMessage(quoted, 'buffer');
    await robin.updateProfilePicture(m.chat, media);
    reply("✅ Group profile picture updated!");
  } catch (e) {
    console.error("❌ Error downloading image:", e);
    reply("⚠️ Failed to set profile picture. Ensure the image is valid and try again.");
  }
});

cmd({
  pattern: "admins",
  react: "👑",
  desc: "List all group admins",
  category: "group",
  filename: __filename,
}, async (robin, mek, m, { isGroup, reply, participants }) => {
  if (!isGroup) return reply("*This command is for groups only.*");

  const admins = participants.filter(p => p.admin).map(p => `@${p.id.split("@")[0]}`).join(`
`);

  return reply(`*Group Admins:*
${admins}`, { mentions: participants.filter(p => p.admin).map(a => a.id) });
});

cmd({
    pattern: "add",
    alias: ["invite"],
    react: "➕",
    desc: "Add a user to the group.",
    category: "main",
    filename: __filename
},
async (robin, mek, m, { from, isGroup, isAdmins, reply, args }) => {
    try {
        // Check if the command is used in a group
        if (!isGroup) return reply("⚠️ This command can only be used in a group!");

        // Check if the user issuing the command is an admin
        if (!isAdmins) return reply("⚠️ Only group admins can use this command!");

        // Ensure a phone number or user ID is provided
        if (!args[0]) return reply("⚠️ Please provide the phone number of the user to add!");

        // Parse the phone number and ensure it's in the correct format
        const target = args[0].includes("@") ? args[0] : `${args[0]}@s.whatsapp.net`;

        // Add the user to the group
        await robin.groupParticipantsUpdate(from, [target], "add");

        // Confirm success
        return reply(`✅ Successfully added: @${target.split('@')[0]}`);
    } catch (e) {
        console.error("Add Error:", e);
        reply(`❌ Failed to add the user. Error: ${e.message}`);
    }
});


cmd({
  pattern: "promote",
  react: "⬆️",
  desc: "Promote user to admin",
  category: "group",
  filename: __filename,
}, async (robin, mek, m, { isGroup, isAdmins, reply, quoted, args }) => {
  if (!isGroup || !isAdmins) 
    return reply("*Group only & both you and I must be admins.*");

  const target = getTargetUser(mek, quoted, args);
  if (!target) return reply("*Mention or reply to a user to promote.*");

  await robin.groupParticipantsUpdate(m.chat, [target], "promote");
  return reply(`*Promoted:* @${target.split("@")[0]}`, { mentions: [target] });
});

cmd({
  pattern: "demote",
  react: "⬇️",
  desc: "Demote admin to member",
  category: "group",
  filename: __filename,
}, async (robin, mek, m, { isGroup, isAdmins, reply, quoted, args }) => {
  if (!isGroup || !isAdmins) 
    return reply("*Group only & both you and I must be admins.*");

  const target = getTargetUser(mek, quoted, args);
  if (!target) return reply("*Mention or reply to a user to demote.*");

  await robin.groupParticipantsUpdate(m.chat, [target], "demote");
  return reply(`*Demoted:* @${target.split("@")[0]}`, { mentions: [target] });
});

cmd({
    pattern: "open",
    alias: ["unmute"],
    react: "⚠️",
    desc: "Allow everyone to send messages in the group.",
    category: "main",
    filename: __filename
},
async (robin, mek, m, { from, isGroup, isAdmins, reply }) => {
    try {
        // Check if the command is used in a group
        if (!isGroup) return reply("⚠️ This command can only be used in a group!");

        // Check if the user is an admin
        if (!isAdmins) return reply("⚠️ This command is only for group admins!");

        // Set the group to everyone can message
        await robin.groupSettingUpdate(from, "not_announcement");

        // Confirm the action
        return reply("✅ Group has been unmuted. Everyone can send messages now!");
    } catch (e) {
        console.error("Unmute Error:", e);
        reply(`❌ Failed to unmute the group. Error: ${e.message}`);
    }
});

cmd({
    pattern: "close",
    alias: ["mute", "lock"],
    react: "⚠️",
    desc: "Set group chat to admin-only messages.",
    category: "main",
    filename: __filename
},
async (robin, mek, m, { from, isGroup, isAdmins, reply }) => {
    try {
        // Check if the command is used in a group
        if (!isGroup) return reply("⚠️ This command can only be used in a group!");

        // Check if the user is an admin
        if (!isAdmins) return reply("⚠️ This command is only for group admins!");

        // Set the group to admin-only
        await robin.groupSettingUpdate(from, "announcement");

        // Confirm the action
        return reply("✅ Group has been muted. Only admins can send messages now!");
    } catch (e) {
        console.error("Mute Error:", e);
        reply(`❌ Failed to mute the group. Error: ${e.message}`);
    }
});

cmd({
  pattern: "revoke",
  react: "♻️",
  desc: "Reset group invite link",
  category: "group",
  filename: __filename,
}, async (robin, mek, m, { isGroup, isAdmins, reply }) => {
  if (!isGroup || !isAdmins) 
    return reply("*Group only & both you and I must be admins.*");

  await robin.groupRevokeInvite(m.chat);
  return reply("*Group invite link has been reset.*");
});

cmd({
  pattern: "grouplink",
  alias: ["link"],
  react: "🔗",
  desc: "Get current invite link",
  category: "group",
  filename: __filename,
}, async (robin, mek, m, { isGroup, reply }) => {
  if (!isGroup) 
    return reply("*Group only & I must be an admin.*");

  const code = await robin.groupInviteCode(m.chat);
  return reply(`*Group Link:*
https://chat.whatsapp.com/${code}`);
});

cmd({
  pattern: "setsubject",
  react: "✏️",
  desc: "Change group name",
  category: "group",
  filename: __filename,
}, async (robin, mek, m, { isGroup, isAdmins, args, reply }) => {
  if (!isGroup || !isAdmins) 
    return reply("*Group only & both you and I must be admins.*");

  if (!args[0]) return reply("*Give a new group name.*");

  await robin.groupUpdateSubject(m.chat, args.join(" "));
  return reply("*Group name updated.*");
});

cmd({
  pattern: "setdesc",
  react: "📝",
  desc: "Change group description",
  category: "group",
  filename: __filename,
}, async (robin, mek, m, { isGroup, isAdmins, args, reply }) => {
  if (!isGroup || !isAdmins) 
    return reply("*Group only & both you and I must be admins.*");

  if (!args[0]) return reply("*Give a new group description.*");

  await robin.groupUpdateDescription(m.chat, args.join(" "));
  return reply("*Group description updated.*");
});

cmd({
  pattern: "groupinfo",
  alias: ["ginfo"],
  react: "📄",
  desc: "Show group details",
  category: "group",
  filename: __filename,
}, async (robin, mek, m, { isGroup, reply }) => {
  if (!isGroup) return reply("*This command is for groups only.*");

  const metadata = await robin.groupMetadata(m.chat);
  const adminsCount = metadata.participants.filter(p => p.admin).length;
  const creation = new Date(metadata.creation * 1000).toLocaleString();
  const owner = metadata.owner || metadata.participants.find(p => p.admin === 'superadmin')?.id;
  const desc = metadata.desc || "No description.";

  let txt = `*👥 Group:* ${metadata.subject}
`;
  txt += `*🆔 ID:* ${metadata.id}
`;
  txt += `*🧑‍💼 Owner:* ${owner ? `@${owner.split("@")[0]}` : "Not found"}
`;
  txt += `*📅 Created:* ${creation}
`;
  txt += `*👤 Members:* ${metadata.participants.length}
`;
  txt += `*🛡️ Admins:* ${adminsCount}
`;
  txt += `*📝 Description:*
${desc}`;

  return reply(txt, { mentions: owner ? [owner] : [] });
});

cmd({
  pattern: "membercount",
  desc: "Show group member count",
  category: "group",
  filename: __filename,
}, async (robin, mek, m, { isGroup, reply }) => {
  if (!isGroup) return reply("*This works only in groups.*");

  const metadata = await robin.groupMetadata(m.chat);
  reply(`👥 Total members in this group: *${metadata.participants.length}*`);
});
cmd({
  pattern: "left",
  react: "👋",
  desc: "Bot leaves the group",
  category: "group",
  filename: __filename,
}, async (robin, mek, m, { isGroup, isAdmins, reply }) => {
  if (!isGroup) return reply("*This is only for groups.*");
  if (!isAdmins) return reply("*Only admins can ask me to leave.*");

  await reply("👋 Leaving the group...");
  await robin.groupLeave(m.chat);
});
cmd({
  pattern: "getdp",
  desc: "Get group profile picture",
  category: "group",
  filename: __filename,
}, async (robin, mek, m, { isGroup, reply }) => {
  if (!isGroup) return reply("*This command works only in groups.*");

  try {
    const ppUrl = await robin.profilePictureUrl(m.chat, "image");
    await robin.sendMessage(m.chat, { image: { url: ppUrl }, caption: "*Group Profile Picture*" });
  } catch {
    reply("⚠️ Couldn't fetch group profile picture.");
  }
});

cmd({
  pattern: "antifake",
  desc: "Remove non-local numbers (e.g., not starting with +94)",
  category: "group",
  filename: __filename,
}, async (robin, mek, m, { isGroup, isAdmins, args, reply }) => {
  if (!isGroup || !isAdmins) return reply("*Group only & admin-only command.*");

  const toggle = args[0]?.toLowerCase();
  if (!["on", "off"].includes(toggle)) return reply("*Usage:* antifake on/off");

  global.antiFakeGroups = global.antiFakeGroups || {};
  global.antiFakeGroups[m.chat] = toggle === "on";

  reply(`📵 Anti-fake is now *${toggle.toUpperCase()}*.`);
});
cmd({
  pattern: "antibadword",
  desc: "Enable or disable bad word filter",
  category: "group",
  filename: __filename,
}, async (robin, mek, m, { isGroup, isAdmins, args, reply }) => {
  if (!isGroup || !isAdmins) return reply("*Group only & admin-only command.*");

  const toggle = args[0]?.toLowerCase();
  if (!["on", "off"].includes(toggle)) return reply("*Usage:* antibadword on/off");

  global.antiBadwordGroups = global.antiBadwordGroups || {};
  global.antiBadwordGroups[m.chat] = toggle === "on";

  reply(`🧼 Anti-badword is now *${toggle.toUpperCase()}*.`);
});
cmd({
  pattern: "antilink",
  desc: "Enable or disable anti-link",
  category: "group",
  filename: __filename,
}, async (robin, mek, m, { isGroup, isAdmins, args, reply }) => {
  if (!isGroup || !isAdmins) return reply("*Group only & admin-only command.*");

  const toggle = args[0]?.toLowerCase();
  if (!["on", "off"].includes(toggle)) return reply("*Usage:* antilink on/off");

  global.antiLinkGroups = global.antiLinkGroups || {};
  global.antiLinkGroups[m.chat] = toggle === "on";

  reply(`🚫 Anti-link is now *${toggle.toUpperCase()}*.`);
});
