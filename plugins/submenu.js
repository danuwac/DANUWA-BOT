const { cmd } = require("../command");
const { buildMenuByCategory } = require("../lib/menuhelper");

const BRAND_HEADER = (title) => `
╭〔 ⚡ *ＤＡＮＵＷＡ－ＭＤ* ⚡ 〕╮
┃ 💫 𝗖𝗮𝘁𝗲𝗴𝗼𝗿𝘆: ${title}
┃ 📌 𝗧𝗼𝘁𝗮𝗹 𝗖𝗼𝗺𝗺𝗮𝗻𝗱𝘀: Auto Counted
╰━━━━━━━━━━━━━━━━━━━━━⬣
`;

const BRAND_FOOTER = `
┃━━━━━━━━━━━━━━━━━━━━━⬣
┃⚙️ Made with ❤️ by 
╰─🔥 *_DANUKA DISANAYAKA_*🔥─⬣`;

function formatMenu(category, title) {
    const commands = buildMenuByCategory(category, title);
    const total = commands.split('\n').filter(line => line.trim()).length;

    return `
${BRAND_HEADER(title).replace("Auto Counted", total)}
${commands}
${BRAND_FOOTER}
    `.trim();
}
const imageUrl = "https://github.com/DANUWA-MD/DANUWA-BOT/blob/main/images/DANUWA-MD%201.png?raw=true";

const menus = [
    { pattern: "download", title: "📥 DOWNLOAD" },
    { pattern: "logo", title: "🎨 LOGO" },
    { pattern: "group", title: "👥 GROUP" },
    { pattern: "utilities", title: "🛠️ UTILITIES" },
    { pattern: "tools", title: "🧰 TOOLS" },
    { pattern: "ai", title: "🤖 AI" },
    { pattern: "convert", title: "🔄 CONVERT" },
    { pattern: "anime", title: "🍥 ANIME" },
    { pattern: "search", title: "🔍 SEARCH" },
    { pattern: "fun", title: "🎉 FUN" },
    { pattern: "main", title: "🏠 MAIN" },
    { pattern: "owner", title: "👑 OWNER" },
    { pattern: "other", title: "📂 OTHER" }
    { pattern: "education", title: "🎓 EDUCATION" }
];

menus.forEach(menu => {
    cmd({
        pattern: menu.pattern,
        react: "⚙️",
        desc: `Show ${menu.pattern} commands`,
        category: "main menu",
        filename: __filename
    }, async (conn, mek, m, { reply }) => {
        const txt = formatMenu(menu.pattern, menu.title);
        await conn.sendMessage(m.chat, {
            image: { url: imageUrl },
            caption: txt
        }, { quoted: mek });
    });
});
