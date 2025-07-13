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

// Short forms to full slugs
const subjectAliases = {
  bas: "business-accounting-studies",
  ict: "information-and-communication-technology",
  hist: "history",
  geo: "geography",
  eng: "english-language",
  sinh: "sinhala",
  tam: "tamil",
  home: "home-economics",
  agri: "agriculture",
  liteng: "literature-english",
  litsin: "literature-sinhala",
  littam: "literature-tamil",
  dmt: "design-mechanical-technology",
  dct: "design-construction-technology",
  civ: "civic-education",
  media: "communication-and-media-studies"
};

const pendingPastPaper = {};

// 📥 Step 1: User types `.pastpapers 2023 bas`
cmd(
  {
    pattern: "pastpapers",
    desc: "Download O/L past papers from govdoc.lk",
    category: "education",
    react: "📄",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, sender, reply }) => {
    if (!q) return reply("❌ Usage: `.pastpapers <year> <subject>`\nExample: `.pastpapers 2023 bas`");

    const parts = q.trim().toLowerCase().split(/\s+/);
    if (parts.length < 2) return reply("❌ You must provide both year and subject.");

    const year = parts[0];
    const subjectKey = parts.slice(1).join("-").replace(/\s+/g, "-");
    const subjectSlug = subjectAliases[subjectKey] || subjectKey;
    const postUrl = `https://govdoc.lk/gce-ordinary-level-exam-${year}-${subjectSlug}-past-papers`;

    try {
      const { data } = await axios.get(postUrl, { headers });
      const $ = cheerio.load(data);

      const title = $("h1.entry-title").text().trim();
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
        return reply("⚠️ No language options found for that paper.");
      }

      let msg = `📄 *${title}*\n\n🌐 *Available Languages:*\n`;
      languages.forEach((l, i) => {
        msg += `*${i + 1}.* ${l.lang}\n`;
      });
      msg += `\n_Reply with a number to download that version._`;

      pendingPastPaper[sender] = {
        step: "download",
        title,
        languages,
        quoted: mek,
      };

      await robin.sendMessage(from, { text: msg }, { quoted: mek });
    } catch (e) {
      console.error("❌ Failed to fetch page:", e.message);
      return reply("❌ Invalid year or subject, or paper not found.");
    }
  }
);

// 📥 Step 2: User replies with a number to choose language
cmd(
  {
    filter: (text, { sender }) =>
      pendingPastPaper[sender] &&
      pendingPastPaper[sender].step === "download" &&
      /^\d+$/.test(text.trim()),
  },
  async (robin, mek, m, { from, sender, body, reply }) => {
    const pending = pendingPastPaper[sender];
    const selected = parseInt(body.trim());

    if (selected < 1 || selected > pending.languages.length) {
      return reply("❌ Invalid selection.");
    }

    const lang = pending.languages[selected - 1];
    const downloadDir = path.join(os.tmpdir(), `olpaper-${Date.now()}`);

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
      const niceName = `${pending.title} - ${lang.lang}.pdf`;

      await robin.sendMessage(
        from,
        {
          document: buffer,
          mimetype: "application/pdf",
          fileName: niceName,
        },
        { quoted: mek }
      );

      fs.unlinkSync(filePath);
      fs.rmdirSync(downloadDir);
      delete pendingPastPaper[sender];
    } catch (e) {
      console.error("❌ Puppeteer download failed:", e.message);
      reply("⚠️ Failed to download PDF. It may have timed out.");
      delete pendingPastPaper[sender];
    }
  }
);
