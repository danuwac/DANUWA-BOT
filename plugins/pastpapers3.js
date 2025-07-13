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

const pendingOLPapers = {};

// Subject short forms to slugs
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

// Fetch paper from full URL
async function fetchSinglePastPaperPage(url) {
  const res = await axios.get(url, { headers });
  const $ = cheerio.load(res.data);
  const title = $("h1.entry-title").text().trim();

  return {
    title,
    link: url,
  };
}

// Step 1: Command `.pastpapers 2023 ict`
cmd(
  {
    pattern: "pastpapers",
    react: "📄",
    desc: "Get O/L past papers by year and subject from govdoc.lk",
    category: "education",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, sender, reply }) => {
    if (!q) return reply("❌ Format: `.pastpapers <year> <subject>`");

    const parts = q.trim().toLowerCase().split(/\s+/);
    if (parts.length < 2) return reply("❌ Format: `.pastpapers <year> <subject>`");

    const year = parts[0];
    const rawSubject = parts.slice(1).join("-").replace(/\s+/g, "-");
    const mappedSubject = subjectAliases[rawSubject] || rawSubject;
    const url = `https://govdoc.lk/gce-ordinary-level-exam-${year}-${mappedSubject}-past-papers`;

    await m.react("📄");

    try {
      const post = await fetchSinglePastPaperPage(url);

      if (!post || !post.title) return reply("❌ No matching past paper found.");

      let msg = `📄 *${post.title}*\n────────────────────\n_Reply with number to select language:_\n\n1. Open paper`;

      await robin.sendMessage(from, { text: msg }, { quoted: mek });

      pendingOLPapers[sender] = {
        step: "select",
        result: post,
        quoted: mek,
      };
    } catch (e) {
      console.error("Fetch error:", e.message);
      return reply("⚠️ Could not fetch past paper page. Check year and subject.");
    }
  }
);

// Step 2: User replies with 1 to open language options
cmd(
  {
    filter: (text, { sender }) =>
      pendingOLPapers[sender] && pendingOLPapers[sender].step === "select" && text.trim() === "1",
  },
  async (robin, mek, m, { from, sender, reply }) => {
    const pending = pendingOLPapers[sender];
    const selectedResult = pending.result;

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
        delete pendingOLPapers[sender];
        return reply("⚠️ No language options found.");
      }

      let msg = `🌐 *Languages for:* _${selectedResult.title}_\n\n`;
      languages.forEach((l, i) => {
        msg += `*${i + 1}.* ${l.lang}\n`;
      });
      msg += `\n_Reply with number (1-${languages.length}) to download._`;

      pendingOLPapers[sender] = {
        step: "download",
        selected: selectedResult,
        languages,
        quoted: mek,
      };

      reply(msg);
    } catch (e) {
      console.error(e);
      reply("⚠️ Failed to load language options.");
      delete pendingOLPapers[sender];
    }
  }
);

// Step 3: Puppeteer download
cmd(
  {
    filter: (text, { sender }) =>
      pendingOLPapers[sender] && pendingOLPapers[sender].step === "download" && /^\d+$/.test(text.trim()),
  },
  async (robin, mek, m, { from, body, sender, reply }) => {
    const pending = pendingOLPapers[sender];
    const selected = parseInt(body.trim());

    if (selected < 1 || selected > pending.languages.length) {
      return reply("❌ Invalid selection.");
    }

    const lang = pending.languages[selected - 1];
    const downloadDir = path.join(os.tmpdir(), `ol-papers-${Date.now()}`);

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

      if (!fileName) throw new Error("Download did not start in time.");

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
      delete pendingOLPapers[sender];
    } catch (e) {
      console.error("❌ Puppeteer download failed:", e.message);
      reply("⚠️ Failed to download PDF. It may have timed out or failed.");
      delete pendingOLPapers[sender];
    }
  }
);
