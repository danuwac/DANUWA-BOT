const { cmd } = require("../command");
const { sendMainMenuImage } = require("../lib/menuhelper");

cmd({
    pattern: "menu",
    react: "⚙️",
    desc: "Show all submenus",
    category: "main menu",
    filename: __filename
}, async (conn, mek, m, { reply }) => {
    await sendMainMenuImage(conn, m);
});
