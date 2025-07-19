const { cmd } = require("../command");
const yts = require("yt-search");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const os = require("os");
const https = require("https");

cmd(
  {
    pattern: "song",
    react: "🎶",
    desc: "Download Song",
    category: "download",
    filename: __filename,
  },
  async (
    robin,
    mek,
    m,
    { from, q, reply }
  ) => {
    try {
      if (!q) return reply("❌ *Please provide a song name or YouTube link*");

      // Step 1: Search for the video
      const search = await yts(q);
      const data = search.videos[0];
      const videoUrl = data.url;

      // Duration check
      const durationParts = data.timestamp.split(":").map(Number);
      const totalSeconds = durationParts.length === 3
        ? durationParts[0] * 3600 + durationParts[1] * 60 + durationParts[2]
        : durationParts[0] * 60 + durationParts[1];
      if (totalSeconds > 1800) {
        return reply("⏳ *Sorry, songs longer than 30 minutes are not supported.*");
      }

      // Step 2: Scrape download link from y2mate using Puppeteer
      const browser = await puppeteer.launch({ headless: "new" });
      const page = await browser.newPage();
      await page.goto("https://y2mate.tools/en68/youtube-to-mp3.html", { waitUntil: "networkidle2" });

      await page.type("#url", videoUrl);
      await page.click("#submit");
      await page.waitForSelector(".btn-download", { timeout: 30000 });

      const downloadLink = await page.$eval(".btn-download", (el) => el.href);
      await browser.close();

      if (!downloadLink) return reply("❌ *Failed to fetch download link.*");

      const outputPath = path.join(os.tmpdir(), `${Date.now()}.mp3`);

      const file = fs.createWriteStream(outputPath);
      await new Promise((resolve, reject) => {
        https.get(downloadLink, (response) => {
          response.pipe(file);
          file.on("finish", () => {
            file.close(resolve);
          });
        }).on("error", reject);
      });

      // Send metadata message
      const caption = `
🌟 𝗪𝗘𝗟𝗖𝗢𝗠𝗘 𝗧𝗢 🌟    
════════════════════════     
🔮  Ｄ  Ａ  Ｎ  Ｕ  Ｗ  Ａ  －  Ｍ  Ｄ  🔮  
🎧 𝙎𝙊𝙉𝙂 𝘿𝙊𝙒𝙉𝙇𝙊𝘼𝘿𝙀𝙍 🎧  
════════════════════════   

🎬 *Title:* ${data.title}
⏱️ *Duration:* ${data.timestamp}
📅 *Uploaded:* ${data.ago}
👀 *Views:* ${data.views.toLocaleString()}
🔗 *Watch Here:* ${data.url}

🎼 *Made with ❤️ by DANUKA DISANAYAKA*
`;

      await robin.sendMessage(from, {
        image: { url: data.thumbnail },
        caption,
      }, { quoted: mek });

      await robin.sendMessage(from, {
        document: fs.readFileSync(outputPath),
        mimetype: "audio/mpeg",
        fileName: `${data.title}.mp3`,
        caption: "🎶 *Your song is ready!*",
      }, { quoted: mek });

      fs.unlinkSync(outputPath);
    } catch (e) {
      console.error(e);
      reply(`❌ *Error:* ${e.message}`);
    }
  }
);
