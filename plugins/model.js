const { cmd } = require("../command");
const axios = require("axios");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const os = require("os");

const headers = {
  "User-Agent": "Mozilla/5.0",
  "Accept-Language": "en-US,en;q=0.9",
};

const LOGO_IMAGE = "https://github.com/DANUWA-MD/DANUWA-BOT/blob/main/images/educational__zone.png?raw=true";
const channelJid = "120363418166326365@newsletter";
const channelName = "🍁 ＤＡＮＵＷＡ－ －ＭＤ 🍁";

const pendingModel = {};

const subjectAliases = {
  accounting: "accounting",
  agri: "agricultural-science",
  agrotech: "agro-technology",
  bio: "biology",
  buddhism: "buddhist",
  bst: "bio-systems-technology",
  chemistry: "chemistry",
  civic: "civic-education",
  comp: "combined-mathematics",
  com: "communication-and-media-studies",
  dance: "dance",
  drama: "drama--theatre",
  econ: "economics",
  eng: "english",
  et: "engineering-technology",
  food: "food-technology",
  geo: "geography",
  greek: "greek--roman-civilization",
  histry: "history",
  ict: "information-communication-technology-ict",
  islam: "islam",
  logic: "logic",
  maths: "mathematics",
  media: "communication-and-media-studies",
  music: "music",
  physics: "physics",
  polsci: "political-science",
  sanskrit: "sanskrit",
  sin: "sinhala",
  tam: "tamil",
  tech: "technology",
  zoology: "zoology",
  botany: "botany",
  christianity: "christianity",
  hinduism: "hinduism",
  sft: "science-for-technology",
  bs: "business-studies",
  health: "health--physical-education",
};

function resolveModelURL(type, subject = "") {
  const base = "https://govdoc.lk/category/model-papers/";
  const typePath =
    type === "o/l"
      ? "gce-ordinary-level-exam"
      : type === "a/l"
      ? "gce-advance-level-exam"
      : "";

  return subject ? `${base}${typePath}/${subject}` : `${base}${typePath}`;
}

async function fetchModelPosts(type, subject) {
  const posts = [];
  let page = 1;
  const baseURL = resolveModelURL(type, subject);

  while (true) {
    const url = page === 1 ? baseURL : `${baseURL}?page=${page}`;

    try {
      const res = await axios.get(url, { headers });
      const $ = cheerio.load(res.data);

      const cards = $("a.custom-card").filter((_, el) => {
        return !$(el).attr("href").includes("/page/");
      });

      if (cards.length === 0) break;

      cards.each((_, el) => {
        const link = $(el).attr("href");
        const title = $(el).find("h5.cate-title").text().trim();
        if (link && title && !posts.find((p) => p.link === link)) {
          posts.push({ title, link });
        }
      });

      page++;
    } catch (err) {
      console.error("❌ Fetch failed:", err.message);
      break;
    }
  }

  return posts;
}

cmd(
  {
    pattern: "model",
    react: "📘",
    desc: "Download model papers by O/L or A/L and optional subject",
    category: "education",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, sender, reply }) => {
    if (!q) return reply("❌ Example: `.model o/l` or `.model a/l accounting`");

    await m.react("📘");

    const input = q.trim().toLowerCase().split(/\s+/);
    const type = input[0];
    let subject = input.slice(1).join("-");
    if (subjectAliases[subject]) subject = subjectAliases[subject];

    if (!["o/l", "a/l"].includes(type))
      return reply("❌ Please specify `o/l` or `a/l`");

    const posts = await fetchModelPosts(type, subject);

    if (!posts.length) return reply("❌ No model papers found.");

    const numberEmojis = ["0️⃣","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣"];

    // Capitalize type for title
    const typeText = (type.toUpperCase() === "O/L" ? "O/L Model Papers" : "A/L Model Papers").toUpperCase();

    let msg = `╔═━━━━━━━◥◣◆◢◤━━━━━━━━═╗
║     🍁 ＤＡＮＵＷＡ－ 〽️Ｄ 🍁    ║
╚═━━━━━━━◢◤◆◥◣━━━━━━━━═╝
         *📘 ${typeText} 📘*
┏━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🔰 𝗖𝗛𝗢𝗢𝗦𝗘 𝗣𝗔𝗣𝗘𝗥 𝗡𝗢.
┃ 💬 𝗥𝗘𝗣𝗟𝗬 𝗧𝗢 𝗡𝗨𝗠𝗕𝗘𝗥❕
┗━━━━━━━━━━━━━━━━━━━━━━┛
┃ 📚 *SUBJECT:* *${subject ? subject.replace(/-/g, " ").toUpperCase() : "ALL"}*
┃ 📊 *RESULTS:* *${posts.length}*
╰─🔥 𝘿𝘼𝙉𝙐𝙆𝘼 𝘿𝙄𝙎𝘼𝙉𝘼𝙔𝘼𝙆𝘼 🔥─╯

`;

    posts.forEach((post, i) => {
      const emojiIndex = (i + 1).toString().split("").map(n => numberEmojis[n]).join("");
      msg += `${emojiIndex} *${post.title}*
      
`;
    });

    msg += `─────────────────────────
💡 *Reply with a number to download.*`;

    pendingModel[sender] = {
      step: "select",
      results: posts,
      quoted: mek,
      type,
    };

    await robin.sendMessage(
      from,
      {
        caption: msg,
        image: { url: LOGO_IMAGE },
        contextInfo: {
          forwardingScore: 999,
          isForwarded: true,
          forwardedNewsletterMessageInfo: {
            newsletterJid: channelJid,
            newsletterName: channelName,
            serverMessageId: -1,
          },
        },
      },
      { quoted: mek }
    );
  }
);

cmd(
  {
    filter: (text, { sender }) =>
      pendingModel[sender] && pendingModel[sender].step === "select" && /^\d+$/.test(text.trim()),
  },
  async (robin, mek, m, { from, body, sender, reply }) => {
    await robin.sendMessage(from, { react: { text: "⬇️", key: m.key } });

    const pending = pendingModel[sender];
    const selected = parseInt(body.trim());

    if (selected < 1 || selected > pending.results.length) {
      return reply("❌ Invalid selection. Please reply with a valid number.");
    }

    const selectedResult = pending.results[selected - 1];

    try {
      const { data } = await axios.get(selectedResult.link, { headers });
      const $ = cheerio.load(data);

      const languages = [];
      $("a[href*='/view?id=']").each((_, el) => {
        const lang = $(el).find("button").text().trim();
        const href = $(el).attr("href");
        if (lang && href) {
          languages.push({
            lang,
            link: href.startsWith("http") ? href : `https://govdoc.lk${href}`,
          });
        }
      });

      if (!languages.length) {
        delete pendingModel[sender];
        return reply("⚠️ No language options found.");
      }

      let langMsg = `🌐 *Available Languages for:* *${selectedResult.title}*
      
`;
      languages.forEach((l, i) => {
        langMsg += `*${i + 1}.* ${l.lang}
`;
      });
      langMsg += `
💬 *Reply with a number (1-${languages.length}) to download.*`;

      pendingModel[sender] = {
        step: "download",
        selected: selectedResult,
        languages,
        quoted: mek,
      };

      reply(langMsg);
    } catch (e) {
      console.error(e);
      reply("⚠️ Failed to fetch language options.");
      delete pendingModel[sender];
    }
  }
);

cmd(
  {
    filter: (text, { sender }) =>
      pendingModel[sender] && pendingModel[sender].step === "download" && /^\d+$/.test(text.trim()),
  },
  async (robin, mek, m, { from, body, sender, reply }) => {
    await robin.sendMessage(from, { react: { text: "⬇️", key: m.key } });

    const pending = pendingModel[sender];
    const selected = parseInt(body.trim());

    if (selected < 1 || selected > pending.languages.length) {
      return reply("❌ Invalid selection. Please reply with a valid number.");
    }

    const lang = pending.languages[selected - 1];
    const downloadDir = path.join(os.tmpdir(), `model-${Date.now()}`);

    try {
      fs.mkdirSync(downloadDir);

      // Puppeteer launch fix (headless: false for downloads)
      const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();

      // Navigate and get download link
      await page.goto(lang.link, { waitUntil: "networkidle2", timeout: 30000 });
      await page.waitForSelector('a.btn.w-100[href*="/download/"]', { timeout: 15000 });

      const downloadHref = await page.$eval('a.btn.w-100[href*="/download/"]', el => el.href);

      await browser.close();

      // Download PDF directly using axios
      const response = await axios.get(downloadHref, {
        responseType: "arraybuffer",
        headers,
      });

      const niceName = `${pending.selected.title} - ${lang.lang}.pdf`;
      const filePath = path.join(downloadDir, niceName);
      fs.writeFileSync(filePath, response.data);

      const pdfBuffer = fs.readFileSync(filePath);

      const sentMsg2 = await robin.sendMessage(
        from,
        {
          document: pdfBuffer,
          mimetype: "application/pdf",
          fileName: niceName,
          caption: `╭[ *✅ DOWNLOAD COMPLETE ✅* ]━⬣
┃ 📄 ${niceName}
┃ ⚙️ Made with ❤️ by
╰🔥 𝘿𝘼𝙉𝙐𝙆𝘼 𝘿𝙄𝙎𝘼𝙉𝘼𝙔𝘼𝙆𝘼 🔥`,
        },
        { quoted: mek }
      );

      await robin.sendMessage(from, {
        react: { text: "✅", key: sentMsg2.key },
      });

      fs.unlinkSync(filePath);
      fs.rmdirSync(downloadDir);
      delete pendingModel[sender];
    } catch (e) {
      console.error("❌ Puppeteer download failed:", e.message);
      reply("⚠️ Failed to download PDF.");
      delete pendingModel[sender];
    }
  }
);
