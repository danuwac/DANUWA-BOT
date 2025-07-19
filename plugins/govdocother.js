const { cmd } = require("../command");
const axios = require("axios");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const os = require("os");

const headers = {
  "User-Agent": "Mozilla/5.0",
  "Accept-Language": "en-US,en;q=0.9"
};

const pendingDownloads = {};
const LOGO_IMAGE = "https://github.com/danuwac/DANUWA-BOT/blob/main/images/Alive.png?raw=true";

async function fetchGovdocItems(categorySlug) {
  const items = [];
  let page = 1;
  while (true) {
    const url = page === 1
      ? `https://govdoc.lk/category/${categorySlug}`
      : `https://govdoc.lk/category/${categorySlug}?page=${page}`;
    try {
      const res = await axios.get(url, { headers });
      const $ = cheerio.load(res.data);
      const cards = $("a.custom-card");
      if (cards.length === 0) break;

      let newItems = 0;
      cards.each((_, el) => {
        const link = $(el).attr("href");
        const title = $(el).find("h5.cate-title").text().trim();
        if (link && title && !items.find((p) => p.link === link)) {
          items.push({ title, link });
          newItems++;
        }
      });
      if (newItems === 0) break;
      page++;
    } catch (err) {
      break;
    }
  }
  return items;
}

function setupGovdocCommand({ pattern, slug, label, requiresGrade, heading, reactionEmoji }) {
  cmd({
    pattern,
    react: reactionEmoji,
    desc: `Download ${label} from govdoc.lk`,
    category: "education",
    filename: __filename
  }, async (robin, mek, m, { from, q, sender, reply }) => {
    if (requiresGrade && (!q || !/grade\s+\d+/i.test(q))) {
      return reply(`❌ Example: .${pattern} grade 11`);
    }

    let categorySlug = slug;
    let gradeTerm = "";
    if (requiresGrade) {
      const input = q.trim().toLowerCase().split(/\s+/);
      const gradeIndex = input.findIndex((w) => w === "grade");
      if (gradeIndex === -1 || !input[gradeIndex + 1]) {
        return reply("❌ Grade missing. Use format like `.textbook grade 11`");
      }
      const grade = input[gradeIndex + 1];
      categorySlug = `${slug}/grade-${grade}`;
      gradeTerm = `GRADE ${grade.toUpperCase()}`;
    }

    const items = await fetchGovdocItems(categorySlug);
    if (!items.length) {
      return reply(`❌ No ${label.toLowerCase()} found${gradeTerm ? ` for ${gradeTerm}` : ""}.`);
    }

    const numberEmojis = ["0️⃣","1️⃣","2️⃣","3️⃣","4️⃣","5️⃣","6️⃣","7️⃣","8️⃣","9️⃣"];

    let msg = `╔═━━━━━━━◥◣◆◢◤━━━━━━━━═╗
║     🍁 ＤＡＮＵＷＡ－ 〽️Ｄ 🍁    ║
╚═━━━━━━━◢◤◆◥◣━━━━━━━━═╝
        📂 *${heading.toUpperCase()}* 📂
┏━━━━━━━━━━━━━━━━━━━━━━┓
┃ 🔰 𝗖𝗛𝗢𝗢𝗦𝗘 𝗗𝗢𝗖𝗨𝗠𝗘𝗡𝗧 𝗡𝗢.
┃ 💬 𝗥𝗘𝗣𝗟𝗬 𝗧𝗢 𝗡𝗨𝗠𝗕𝗘𝗥❕
┗━━━━━━━━━━━━━━━━━━━━━━┛
┃ ⚙️ *CATEGORY:* *${label.toUpperCase()}*
┃ 🔎 *GRADE:* *${gradeTerm || "N/A"}*
┃ 📊 *RESULTS:* *${items.length}*
╰─🔥 𝘿𝘼𝙉𝙐𝙆𝘼 𝘿𝙄𝙎𝘼𝙉𝘼𝙔𝘼𝙆𝘼 🔥─╯
─────────────────────────

`;

    items.forEach((item, i) => {
      const emojiIndex = (i + 1).toString().split("").map(n => numberEmojis[n]).join("");
      msg += `${emojiIndex} *${item.title}*\n\n`;
    });

    msg += `─────────────────────────
💡 *Reply with a number to download.*`;

    const sentMsg = await robin.sendMessage(from, {
      caption: msg,
      image: { url: LOGO_IMAGE },
      contextInfo: {
        forwardingScore: 999,
        isForwarded: true
      }
    }, { quoted: mek });

    await robin.sendMessage(from, { react: { text: "✅", key: sentMsg.key } });

    pendingDownloads[sender] = {
      step: "select",
      results: items,
      quoted: mek,
      label,
      requiresGrade,
      heading,
      gradeTerm,
      reactionEmoji
    };
  });

  cmd({
    filter: (text, { sender }) => pendingDownloads[sender] && pendingDownloads[sender].step === "select" && /^\d+$/.test(text.trim())
  }, async (robin, mek, m, { from, body, sender, reply }) => {
    await robin.sendMessage(from, { react: { text: "✅", key: m.key } });

    const pending = pendingDownloads[sender];
    const selected = parseInt(body.trim());
    if (selected < 1 || selected > pending.results.length) {
      return reply("❌ Invalid selection.");
    }

    const selectedItem = pending.results[selected - 1];
    const { data } = await axios.get(selectedItem.link, { headers });
    const $ = cheerio.load(data);

    const languages = [];
    $("a[href*='/view?id=']").each((_, el) => {
      const href = $(el).attr("href");
      const lang = $(el).find("button").text().trim() || "Document";
      if (href) {
        languages.push({
          lang,
          link: href.startsWith("http") ? href : `https://govdoc.lk${href}`
        });
      }
    });

    if (!languages.length) return reply("⚠️ No language versions found.");

    let langMsg = `🌐 *AVAILABLE LANGUAGES FOR:* *${selectedItem.title}*\n\n`;
    languages.forEach((l, i) => {
      langMsg += `*${i + 1}.* ${l.lang}\n`;
    });
    langMsg += `\n💬 *Reply with a number (1-${languages.length}) to download.*`;

    await robin.sendMessage(from, { text: langMsg }, { quoted: mek });

    pendingDownloads[sender] = {
      step: "download",
      selected: selectedItem,
      languages,
      quoted: mek,
      label: pending.label,
      requiresGrade: pending.requiresGrade,
      heading: pending.heading,
      gradeTerm: pending.gradeTerm,
      reactionEmoji: pending.reactionEmoji
    };
  });

  cmd({
    filter: (text, { sender }) => pendingDownloads[sender] && pendingDownloads[sender].step === "download" && /^\d+$/.test(text.trim())
  }, async (robin, mek, m, { from, body, sender, reply }) => {
    await robin.sendMessage(from, { react: { text: "⬇️", key: m.key } });

    const pending = pendingDownloads[sender];
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
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
      });
      const page = await browser.newPage();
      await page._client().send("Page.setDownloadBehavior", {
        behavior: "allow",
        downloadPath: downloadDir
      });
      await page.goto(lang.link, {
        waitUntil: "networkidle2",
        timeout: 30000
      });
      await page.waitForSelector('a.btn.w-100[href*="/download/"]', {
        timeout: 15000
      });
      await page.click('a.btn.w-100[href*="/download/"]');

      let fileName;
      for (let i = 0; i < 20; i++) {
        const files = fs.readdirSync(downloadDir).filter((f) => f.endsWith(".pdf"));
        if (files.length > 0) {
          fileName = files[0];
          break;
        }
        await new Promise((res) => setTimeout(res, 1000));
      }

      await browser.close();
      if (!fileName) throw new Error("Download did not complete in time.");

      const filePath = path.join(downloadDir, fileName);
      const pdfBuffer = fs.readFileSync(filePath);
      const niceName = `${pending.selected.title} - ${lang.lang}.pdf`;

      await robin.sendMessage(from, {
        document: pdfBuffer,
        mimetype: "application/pdf",
        fileName: niceName,
        caption: `╭[ *✅ DOWNLOAD COMPLETE ✅* ]━⬣
┃ 📄 ${niceName}
┃⚙️ Made with ❤️ by
╰🔥 𝘿𝘼𝙉𝙐𝙆𝘼 𝘿𝙄𝙎𝘼𝙉𝘼𝙔𝘼𝙆𝘼 🔥`
      }, { quoted: mek });

      fs.unlinkSync(filePath);
      fs.rmdirSync(downloadDir);
      delete pendingDownloads[sender];
    } catch (e) {
      console.error(e);
      reply("⚠️ Failed to download PDF.");
      delete pendingDownloads[sender];
    }
  });
}

// Register commands
setupGovdocCommand({ pattern: "textbook", slug: "text-books", label: "Textbooks", requiresGrade: true, heading: "Textbook Library", reactionEmoji: "📚" });
setupGovdocCommand({ pattern: "tguide", slug: "teacher-guides", label: "Teacher Guides", requiresGrade: true, heading: "Teacher Guide Library", reactionEmoji: "🧑‍🏫" });
setupGovdocCommand({ pattern: "syllabus", slug: "syllabus", label: "Syllabus", requiresGrade: true, heading: "Syllabus Library", reactionEmoji: "📜" });
setupGovdocCommand({ pattern: "gazette", slug: "gazette", label: "Gazette", requiresGrade: false, heading: "Gazette Library", reactionEmoji: "📢" });
