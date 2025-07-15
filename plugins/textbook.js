const { cmd } = require("../command");
const axios = require("axios");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const fs = require("fs");
const os = require("os");
const path = require("path");

const headers = {
  "User-Agent": "Mozilla/5.0",
  "Accept-Language": "en-US,en;q=0.9",
};

const pendingTextbook = {};

// 🔁 Fetch all textbooks with pagination
async function fetchTextbooks(grade) {
  const textbooks = [];
  let page = 1;

  while (true) {
    const url =
      page === 1
        ? `https://govdoc.lk/category/text-books/grade-${grade}`
        : `https://govdoc.lk/category/text-books/grade-${grade}?page=${page}`;

    try {
      const res = await axios.get(url, { headers });
      const $ = cheerio.load(res.data);

      const cards = $("a.custom-card");
      if (cards.length === 0) break;

      let newItems = 0;

      cards.each((_, el) => {
        const title = $(el).find("h5.cate-title").text().trim();
        const link = $(el).attr("href");
        if (title && link && !textbooks.find(t => t.link === link)) {
          textbooks.push({ title, link });
          newItems++;
        }
      });

      if (newItems === 0) break;
      page++;
    } catch (err) {
      console.error(`❌ Error loading page ${page}:`, err.message);
      break;
    }
  }

  return textbooks;
}

// 📚 Step 1: .textbook [grade]
cmd(
  {
    pattern: "textbook",
    react: "📘",
    desc: "Download textbooks by grade (e.g. .textbook 11)",
    category: "education",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, sender, reply }) => {
    const grade = q.trim();

    if (!/^\d+$/.test(grade)) {
      return reply("❌ Invalid input.\nUsage: `.textbook 10`");
    }

    await m.react("📘");
    const books = await fetchTextbooks(grade);

    if (!books.length) return reply(`❌ No textbooks found for Grade ${grade}`);

    let msg = `📚 *Grade ${grade} Textbooks*\n────────────────────\n_Reply with number to select textbook_\n\n`;
    books.forEach((book, i) => {
      msg += `*${i + 1}.* ${book.title}\n`;
    });

    await robin.sendMessage(from, { text: msg }, { quoted: mek });

    pendingTextbook[sender] = {
      step: "select",
      books,
      quoted: mek,
    };
  }
);

// 🌐 Step 2: Select book → show language options
cmd(
  {
    filter: (text, { sender }) =>
      pendingTextbook[sender] &&
      pendingTextbook[sender].step === "select" &&
      /^\d+$/.test(text.trim()),
  },
  async (robin, mek, m, { from, body, sender, reply }) => {
    const pending = pendingTextbook[sender];
    const selected = parseInt(body.trim());

    if (selected < 1 || selected > pending.books.length) {
      return reply("❌ Invalid selection.");
    }

    const chosen = pending.books[selected - 1];

    try {
      const { data } = await axios.get(chosen.link, { headers });
      const $ = cheerio.load(data);

      const langs = [];

      $("a[href*='/view?id=']").each((_, el) => {
        const lang = $(el).find("button").text().trim();
        const href = $(el).attr("href");

        if (lang && href) {
          langs.push({
            lang,
            link: href.startsWith("http") ? href : `https://govdoc.lk${href}`,
          });
        }
      });

      if (!langs.length) {
        delete pendingTextbook[sender];
        return reply("⚠️ No language versions found.");
      }

      let msg = `🌐 *Available Languages for:* _${chosen.title}_\n\n`;
      langs.forEach((l, i) => {
        msg += `*${i + 1}.* ${l.lang}\n`;
      });
      msg += `\n_Reply with a number (1-${langs.length}) to download._`;

      pendingTextbook[sender] = {
        step: "download",
        book: chosen,
        langs,
        quoted: mek,
      };

      reply(msg);
    } catch (err) {
      console.error("❌ Error scraping:", err.message);
      reply("⚠️ Failed to fetch language options.");
      delete pendingTextbook[sender];
    }
  }
);

// 📥 Step 3: Download PDF via Puppeteer
cmd(
  {
    filter: (text, { sender }) =>
      pendingTextbook[sender] &&
      pendingTextbook[sender].step === "download" &&
      /^\d+$/.test(text.trim()),
  },
  async (robin, mek, m, { from, body, sender, reply }) => {
    const pending = pendingTextbook[sender];
    const selected = parseInt(body.trim());

    if (selected < 1 || selected > pending.langs.length) {
      return reply("❌ Invalid selection.");
    }

    const lang = pending.langs[selected - 1];
    const downloadDir = path.join(os.tmpdir(), `textbook-${Date.now()}`);

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

      if (!fileName) throw new Error("Download did not complete.");

      const filePath = path.join(downloadDir, fileName);
      const buffer = fs.readFileSync(filePath);
      const fileNameNice = `${pending.book.title} - ${lang.lang}.pdf`;

      await robin.sendMessage(
        from,
        {
          document: buffer,
          mimetype: "application/pdf",
          fileName: fileNameNice,
        },
        { quoted: mek }
      );

      fs.unlinkSync(filePath);
      fs.rmdirSync(downloadDir);
      delete pendingTextbook[sender];
    } catch (err) {
      console.error("❌ Puppeteer download error:", err.message);
      reply("⚠️ Failed to download PDF.");
      delete pendingTextbook[sender];
    }
  }
);
