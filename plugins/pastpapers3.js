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

const pendingALPapers = {};

// Step 1: Fetch papers by subject slug
async function fetchSubjectPapers(subjectSlug) {
  const url = `https://govdoc.lk/category/past-papers/gce-ordinary-level-exam/${subjectSlug}`;
  const res = await axios.get(url, { headers });
  const $ = cheerio.load(res.data);
  const posts = [];

  $("a.custom-card").each((_, el) => {
    if ($(el).closest(".info-body").length > 0) return;

    const link = $(el).attr("href");
    const title = $(el).find("h5.cate-title").text().trim();
    if (link && title) posts.push({ title, link });
  });

  return posts.slice(0, 20);
}

// Step 1: .pastpapers biology
cmd(
  {
    pattern: "pastol",
    react: "📄",
    desc: "Get A/L past papers by subject from govdoc.lk",
    category: "education",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, sender, reply }) => {
    if (!q) return reply("❌ Please provide a subject. Example: `.pastpapers science`");

    const subjectAliases = {
      hist: "history",
      it: "information-and-communication-technology",
      ict: "information-and-communication-technology",
      commerce: "business-and-accounting-studies",
      geo: "geography",
      civic: "civic-education",
      art: "art-and-craft",
      home: "home-economics",
      health: "health-and-physical-education",
      media: "communication-and-media-studies",
      dct: "design-and-construction-technology",
      dmt: "design-and-mechanical-technology",
      det: "design-electrical-and-electronic-technology",
      shorthand: "electronic-writing-and-shorthand",
      agri: "agriculture-and-food-technology",
      aqua: "aquatic-bioresources-technology",
      music: "music-art-dancing-drama-and-theater",
      liteng: "literature-english",
      sinhala_literature: "literature-sinhala",
      tamil_literature: "literature-tamil",
      arabic_literature: "literature-arabic"
    };
    
    const rawInput = q.trim().toLowerCase();
    const subjectSlug = subjectAliases[rawInput] || rawInput.replace(/\s+/g, "-");
    const posts = await fetchSubjectPapers(subjectSlug);
    if (!posts.length) return reply(`❌ No past papers found for *${q}*`);

    let msg = `📄 *O/L Past Papers: ${q.toUpperCase()}*\n────────────────────\n_Reply with number to select paper_\n\n`;
    posts.forEach((post, i) => {
      msg += `*${i + 1}.* ${post.title}\n`;
    });

    await robin.sendMessage(from, { text: msg }, { quoted: mek });

    pendingALPapers[sender] = {
      step: "select",
      results: posts,
      quoted: mek,
    };
  }
);

// Step 2: User selects paper
cmd(
  {
    filter: (text, { sender }) =>
      pendingALPapers[sender] && pendingALPapers[sender].step === "select" && /^\d+$/.test(text.trim()),
  },
  async (robin, mek, m, { from, body, sender, reply }) => {
    const pending = pendingALPapers[sender];
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
        delete pendingALPapers[sender];
        return reply("⚠️ No language options found for this paper.");
      }

      let langMsg = `🌐 *Available Languages for:* _${selectedResult.title}_\n\n`;
      languages.forEach((l, i) => {
        langMsg += `*${i + 1}.* ${l.lang}\n`;
      });
      langMsg += `\n_Reply with a number (1-${languages.length}) to download._`;

      pendingALPapers[sender] = {
        step: "download",
        selected: selectedResult,
        languages,
        quoted: mek,
      };

      reply(langMsg);
    } catch (e) {
      console.error(e);
      reply("⚠️ Failed to fetch language options. Please try again.");
      delete pendingALPapers[sender];
    }
  }
);

// Step 3: Puppeteer download
cmd(
  {
    filter: (text, { sender }) =>
      pendingALPapers[sender] && pendingALPapers[sender].step === "download" && /^\d+$/.test(text.trim()),
  },
  async (robin, mek, m, { from, body, sender, reply }) => {
    const pending = pendingALPapers[sender];
    const selected = parseInt(body.trim());

    if (selected < 1 || selected > pending.languages.length) {
      return reply("❌ Invalid selection. Please reply with a valid number.");
    }

    const lang = pending.languages[selected - 1];
    const downloadDir = path.join(os.tmpdir(), `al-papers-${Date.now()}`);

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

      // Wait up to 20 seconds for download
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
      delete pendingALPapers[sender];
    } catch (e) {
      console.error("❌ Puppeteer download failed:", e.message);
      reply("⚠️ Failed to download PDF. It may have timed out or failed to start.");
      delete pendingALPapers[sender];
    }
  }
);
