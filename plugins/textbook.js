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

      const cards = $("a.custom-card").toArray();
      if (!cards.length) break;

      let newItems = 0;

      for (const el of cards) {
        const isInRelated = $(el).closest(".product-details-info").length > 0;
        if (isInRelated) continue;

        const title = $(el).find("h5.cate-title").text().trim();
        const link = $(el).attr("href");

        if (title && link && !textbooks.find(t => t.link === link)) {
          textbooks.push({ title, link });
          newItems++;
        }
      }

      if (newItems === 0) break;
      page++;
    } catch (err) {
      console.error(`❌ Error loading page ${page}:`, err.message);
      break;
    }
  }

  return textbooks;
}

cmd(
  {
    pattern: "textbook",
    react: "📘",
    desc: "Download textbooks by grade",
    category: "education",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, sender, reply }) => {
    const match = q.trim().toLowerCase().match(/grade\s*(\d+)/);
    if (!match) return reply("❌ Invalid input. Use: `.textbook grade 11`");

    const grade = match[1];
    const results = await fetchTextbooks(grade);

    if (!results.length) return reply("⚠️ No textbooks found for that grade.");

    let msg = `📘 *Grade ${grade} Textbooks*
────────────────────
_Reply with a number to select textbook:_\n\n`;
    results.forEach((r, i) => {
      msg += `*${i + 1}.* ${r.title}\n`;
    });

    await robin.sendMessage(from, { text: msg }, { quoted: mek });

    pendingTextbook[sender] = {
      step: "select",
      results,
      quoted: mek,
    };
  }
);

cmd(
  {
    filter: (text, { sender }) =>
      pendingTextbook[sender] && pendingTextbook[sender].step === "select" && /^\d+$/.test(text.trim()),
  },
  async (robin, mek, m, { from, body, sender, reply }) => {
    const pending = pendingTextbook[sender];
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
        delete pendingTextbook[sender];
        return reply("⚠️ No language versions found (but expected). Report this if issue continues.");
      }

      let langMsg = `🌐 *Available Languages for:* _${selectedResult.title}_\n\n`;
      languages.forEach((l, i) => {
        langMsg += `*${i + 1}.* ${l.lang}\n`;
      });
      langMsg += `\n_Reply with a number to download._`;

      pendingTextbook[sender] = {
        step: "download",
        selected: selectedResult,
        languages,
        quoted: mek,
      };

      reply(langMsg);
    } catch (e) {
      console.error(e);
      reply("⚠️ Failed to fetch language versions.");
      delete pendingTextbook[sender];
    }
  }
);

cmd(
  {
    filter: (text, { sender }) =>
      pendingTextbook[sender] && pendingTextbook[sender].step === "download" && /^\d+$/.test(text.trim()),
  },
  async (robin, mek, m, { from, body, sender, reply }) => {
    const pending = pendingTextbook[sender];
    const selected = parseInt(body.trim());

    if (selected < 1 || selected > pending.languages.length) {
      return reply("❌ Invalid selection.");
    }

    const lang = pending.languages[selected - 1];
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
        },
        { quoted: mek }
      );

      fs.unlinkSync(filePath);
      fs.rmdirSync(downloadDir);
      delete pendingTextbook[sender];
    } catch (e) {
      console.error("❌ Puppeteer download failed:", e.message);
      reply("⚠️ Failed to download textbook PDF.");
      delete pendingTextbook[sender];
    }
  }
);
