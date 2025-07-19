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

const subjectAliases = {
  commerce: "business--accounting-studies",
  ict: "information-communication-technology-ict",
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
  media: "communication--and-media-studies",
  dance: "dance",
  health: "health--physical-education",
  buddhism: "buddhist",
  maths: "mathematics",
};

const pendingPastPaper = {};

async function fetchLanguageOptions(url) {
  const res = await axios.get(url, { headers });
  const $ = cheerio.load(res.data);

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

  return { title, languages };
}

// Step 1: .pastpapers 2024 ict
cmd(
  {
    pattern: "pastol",
    desc: "Download O/L past papers by year and subject",
    category: "education",
    react: "📄",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, sender, reply }) => {
    if (!q) return reply("❌ Usage: `.pastpapers <year> <subject>`");

    const parts = q.trim().toLowerCase().split(/\s+/);
    if (parts.length < 2) return reply("❌ You must provide both year and subject.");

    const year = parts[0];
    const rawSubject = parts.slice(1).join("-").replace(/\s+/g, "-");
    const subjectSlug = subjectAliases[rawSubject] || rawSubject;

    const urlsToTry = [
      `https://govdoc.lk/gce-ordinary-level-exam-${year}-${subjectSlug}-past-papers`,
      `https://govdoc.lk/gce-ordinary-level-exam-${year}-${parseInt(year) + 1}-${subjectSlug}-past-papers`,
    ];

    let pageData;
    let finalUrl;

    for (const url of urlsToTry) {
      try {
        pageData = await fetchLanguageOptions(url);
        if (pageData.languages.length) {
          finalUrl = url;
          break;
        }
      } catch (e) {
        // continue to try fallback
      }
    }

    if (!pageData || !pageData.languages.length) {
      return reply("❌ Past paper not found. Check the year or subject name.");
    }

    const msgLines = [`📄 *${pageData.title}*`, `\n🌐 *Available Languages:*`];
    pageData.languages.forEach((l, i) => {
      msgLines.push(`*${i + 1}.* ${l.lang}`);
    });
    msgLines.push(`\n_Reply with a number to download that version._`);

    pendingPastPaper[sender] = {
      step: "download",
      title: pageData.title,
      languages: pageData.languages,
      quoted: mek,
    };

    await robin.sendMessage(from, { text: msgLines.join("\n") }, { quoted: mek });
  }
);

// Step 2: user replies with number
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

      // Wait for download
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
