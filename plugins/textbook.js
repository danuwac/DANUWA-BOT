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

// 📚 Step 1: Show list of textbooks
cmd(
  {
    pattern: "textbook",
    react: "📘",
    desc: "Download Grade 11 Textbooks",
    category: "education",
    filename: __filename,
  },
  async (robin, mek, m, { from, sender, reply }) => {
    await m.react("📘");

    const url = "https://govdoc.lk/category/text-books/grade-11";

    try {
      const res = await axios.get(url, { headers });
      const $ = cheerio.load(res.data);

      const books = [];
      $("a.custom-card").each((_, el) => {
        const link = $(el).attr("href");
        const title = $(el).find("h5.cate-title").text().trim();
        if (link && title) {
          books.push({ title, link });
        }
      });

      if (!books.length) return reply("❌ No textbooks found!");

      let msg = `📚 *Grade 11 Textbooks*\n────────────────────\n_Reply with a number to select a textbook_\n\n`;
      books.forEach((book, i) => {
        msg += `*${i + 1}.* ${book.title}\n`;
      });

      await robin.sendMessage(from, { text: msg }, { quoted: mek });

      pendingTextbook[sender] = {
        step: "select",
        books,
        quoted: mek,
      };
    } catch (err) {
      console.error("❌ Error fetching textbooks:", err.message);
      reply("⚠️ Failed to fetch textbook list.");
    }
  }
);

// 📥 Step 2: User selects a book
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
      const res = await axios.get(chosen.link, { headers });
      const $ = cheerio.load(res.data);

      const langButtons = [];

      // ✅ Check all buttons with text and href
      $("a.btn.w-100").each((_, el) => {
        const lang =
          $(el).text().trim() ||
          $(el).find("button").text().trim() ||
          "Unknown";

        const href = $(el).attr("href");

        if (href && lang && !langButtons.find(l => l.link === href)) {
          langButtons.push({
            lang,
            link: href.startsWith("http") ? href : `https://govdoc.lk${href}`,
          });
        }
      });

      if (!langButtons.length) {
        delete pendingTextbook[sender];
        return reply("⚠️ No language versions found (but expected). Report this if issue continues.");
      }

      let langMsg = `🌐 *Available Languages for:* _${chosen.title}_\n\n`;
      langButtons.forEach((l, i) => {
        langMsg += `*${i + 1}.* ${l.lang}\n`;
      });
      langMsg += `\n_Reply with a number (1-${langButtons.length}) to download._`;

      pendingTextbook[sender] = {
        step: "download",
        book: chosen,
        langs: langButtons,
        quoted: mek,
      };

      reply(langMsg);
    } catch (err) {
      console.error("❌ Error fetching book page:", err.message);
      reply("⚠️ Failed to fetch book details.");
      delete pendingTextbook[sender];
    }
  }
);

// 📄 Step 3: Download selected language
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
      const cleanName = `${pending.book.title} - ${lang.lang}.pdf`;

      await robin.sendMessage(
        from,
        {
          document: buffer,
          mimetype: "application/pdf",
          fileName: cleanName,
        },
        { quoted: mek }
      );

      fs.unlinkSync(filePath);
      fs.rmdirSync(downloadDir);
      delete pendingTextbook[sender];
    } catch (err) {
      console.error("❌ Puppeteer error:", err.message);
      reply("⚠️ Failed to download the textbook.");
      delete pendingTextbook[sender];
    }
  }
);
