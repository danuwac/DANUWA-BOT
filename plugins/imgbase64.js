const { cmd } = require("../command");
const axios = require("axios");

cmd(
  {
    pattern: "imgbase64",
    alias: ["base64img"],
    react: "🖼️",
    desc: "Convert image URL to Base64 or Base64 string to image",
    category: "utilities",
    filename: __filename,
  },
  async (danuwa, mek, m, { q, reply, from }) => {
    if (!q) return reply("📝 *Provide an image URL to convert to Base64, or send Base64 string to convert to image.*");

    const isUrl = /^(https?:\/\/.*\.(?:png|jpg|jpeg|gif|webp))$/i.test(q.trim());
    const isBase64 = /^data:image\/[a-zA-Z]+;base64,/.test(q.trim());

    try {
      if (isUrl) {
        // Convert image URL to Base64
        const response = await axios.get(q, { responseType: 'arraybuffer' });
        const base64 = Buffer.from(response.data, 'binary').toString('base64');
        const mime = response.headers['content-type'];
        await reply(`🖼️ *Base64 Image String:*\n\n\`data:${mime};base64,${base64}\``);
      } else if (isBase64) {
        // Send image from Base64 string
        const base64Data = q.trim().split(',')[1];
        await danuwa.sendMessage(from, { image: { base64: base64Data } }, { quoted: mek });
      } else {
        await reply("❌ *Input is not a valid image URL or Base64 string.*");
      }
    } catch (err) {
      console.error(err);
      reply("❌ *Failed to process image.*");
    }
  }
);
