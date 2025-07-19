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

const pendingGovDoc = {};
const LOGO_IMAGE = "https://github.com/danuwac/DANUWA-BOT/blob/main/images/Alive.png?raw=true";
const channelJid = "120363418166326365@newsletter";
const channelName = "🍁 ＤＡＮＵＷＡ－ 〽️Ｄ 🍁";

const subjectAliases = {
  commerce: "business--accounting-studies",
  ict: "information-communication-technology-ict",
  histry: "history",
  geo: "geography",
  english: "english-language",
  sinhala: "sinhala",
  tam: "tamil",
  home: "home-economics",
  agri: "agriculture",
  liteng: "literature-english",
  litsin: "literature-sinhala",
  littam: "literature-tamil",
  dmt: "design-mechanical-technology",
  dct: "design-construction-technology",
  civic: "civic-education",
  media: "communication--media-studies",
  dance: "dance",
  health: "health--physical-education",
  buddhism: "buddhist",
  maths: "mathematics",
};

async function fetchGovdocPosts(slug) {
  const posts = [];
  let page = 1;
  while (true) {
    const url = page === 1
      ? `https://govdoc.lk/category/term-test-papers/${slug}`
      : `https://govdoc.lk/category/term-test-papers/${slug}?page=${page}`;
    try {
      const res = await axios.get(url, { headers });
      const $ = cheerio.load(res.data);
      const cards = $("a.custom-card");
      if (cards.length === 0) break;
      let newPosts = 0;
      cards.each((_, el) => {
        const link = $(el).attr("href");
        const title = $(el).find("h5.cate-title").text().trim();
        if (link && title && !posts.find(p => p.link === link)) {
          posts.push({ title, link });
          newPosts++;
        }
      });
      if (newPosts === 0) break;
      page++;
    } catch (err) {
      console.error(`❌ Failed on page ${page}:`, err.message);
      break;
    }
  }
  return posts;
}

cmd({
  pattern: "govdoc",
  react: "📚",
  desc: "Get term test papers by grade + subject",
  category: "education",
  filename: __filename,
}, async (robin, mek, m, { from, q, sender, reply }) => {
  if (!q) return reply("❌ Example: `.govdoc 10 history` or `.govdoc grade 11 ict`");
  await robin.sendMessage(from, { react: { text: "📚", key: m.key } });
  const input = q.trim().toLowerCase().split(/\s+/);
  let grade = "", subject = "";
  if (input[0] === "grade" && /^\d+$/.test(input[1])) {
    grade = input[1];
    subject = input.slice(2).join("-").trim();
  } else if (/^\d+$/.test(input[0])) {
    grade = input[0];
    subject = input.slice(1).join("-").trim();
  }
  if (!grade) return reply("❌ Invalid format. Use `.govdoc 10 ict`");
  if (subjectAliases[subject]) subject = subjectAliases[subject];
  const gradeSlug = subject ? `grade-${grade}/${subject}` : `grade-${grade}`;
  const posts = await fetchGovdocPosts(gradeSlug);
  if (!posts.length) return reply(`❌ No papers found for *${gradeSlug}*`);

  let msg = `╔═━━━━━━━◥◣◆◢◤━━━━━━━━═╗
║     🍁 ＤＡＮＵＷＡ－ 〽️Ｄ 🍁    ║
╚═━━━━━━━◢◤◆◥◣━━━━━━━━═╝
    📂 TERM TEST PAPERS 📂
┏━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🔰 𝗖𝗛𝗢𝗢𝗦𝗘 𝗣𝗔𝗣𝗘𝗥 𝗡𝗢.
┃ 💬 𝗥𝗘𝗣𝗟𝗬 𝗧𝗢 𝗡𝗨𝗠𝗕𝗘𝗥❕
┗━━━━━━━━━━━━━━━━━━━━━━┛
┃ ⚙️ *GRADE:* *${grade.toUpperCase()}*
┃ 📄 *SUBJECT:* *${subject.toUpperCase()}*
┃ 📊 *RESULTS:* *${posts.length}*
╰─🔥 𝘿𝘼𝙉𝙐𝙆𝘼 𝘿𝙄𝙎𝘼𝙉𝘼𝙔𝘼𝙆𝘼 🔥─╯\n\n`;

  const numberEmojis = ["0️⃣","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣","🔟"];

  posts.forEach((post, i) => {
    const emoji = numberEmojis[i + 1] || `*${i + 1}.*`;
    msg += `${emoji} *${post.title}*\n`;
  });

  pendingGovDoc[sender] = {
    step: "select",
    results: posts,
  };

  await robin.sendMessage(from, {
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
  }, { quoted: mek });
}); // ← This closing was MISSING

cmd({
  filter: (text, { sender }) =>
    pendingGovDoc[sender] && pendingGovDoc[sender].step === "select" && /^\d+$/.test(text.trim()),
}, async (robin, mek, m, { from, body, sender, reply }) => {
  await robin.sendMessage(from, { react: { text: "⬇️", key: m.key } });
  const pending = pendingGovDoc[sender];
  const selected = parseInt(body.trim());
  if (selected < 1 || selected > pending.results.length) {
    return reply("❌ Invalid selection.");
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
      delete pendingGovDoc[sender];
      return reply("⚠️ No language options found.");
    }
    let langMsg = `🌐 Available Languages for: _${selectedResult.title}_\n\n`;
    languages.forEach((l, i) => {
      langMsg += `*${i + 1}.* ${l.lang}\n`;
    });
    langMsg += `\n_Reply with a number (1-${languages.length}) to download._`;
    pendingGovDoc[sender] = {
      step: "download",
      selected: selectedResult,
      languages,
      quoted: mek,
    };
    reply(langMsg);
  } catch (e) {
    console.error(e);
    reply("⚠️ Failed to fetch language options.");
    delete pendingGovDoc[sender];
  }
});

cmd({
  filter: (text, { sender }) =>
    pendingGovDoc[sender] && pendingGovDoc[sender].step === "download" && /^\d+$/.test(text.trim()),
}, async (robin, mek, m, { from, body, sender, reply }) => {
  const pending = pendingGovDoc[sender];
  const selected = parseInt(body.trim());
  if (selected < 1 || selected > pending.languages.length) {
    return reply("❌ Invalid selection.");
  }
  const lang = pending.languages[selected - 1];
  const downloadDir = path.join(os.tmpdir(), `govdoc-${Date.now()}`);
  try {
    fs.mkdirSync(downloadDir);
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page._client().send("Page.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: downloadDir,
    });
    await page.goto(lang.link, { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForSelector('a.btn.w-100[href*="/download/"]', { timeout: 15000 });
    await page.click('a.btn.w-100[href*="/download/"]');
    let fileName;
    for (let i = 0; i < 20; i++) {
      const files = fs.readdirSync(downloadDir).filter(f => f.endsWith(".pdf"));
      if (files.length > 0) {
        fileName = files[0];
        break;
      }
      await new Promise(res => setTimeout(res, 1000));
    }
    await browser.close();
    if (!fileName) throw new Error("Download did not complete in time.");
    const filePath = path.join(downloadDir, fileName);
    const pdfBuffer = fs.readFileSync(filePath);
    const niceName = `${pending.selected.title} - ${lang.lang}.pdf`;
    await robin.sendMessage(
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
    fs.unlinkSync(filePath);
    fs.rmdirSync(downloadDir);
    delete pendingGovDoc[sender];
  } catch (e) {
    console.error("❌ Puppeteer download failed:", e.message);
    reply("⚠️ Failed to download PDF.");
    delete pendingGovDoc[sender];
  }
});
