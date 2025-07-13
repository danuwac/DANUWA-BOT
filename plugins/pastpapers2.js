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

// 🧠 Subject short forms to slugs
const subjectAliases = {
  commerce: "business-accounting-studies",
  ict: "information-and-communication-technology-ict",
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
  media: "communication-and-media-studies",
  dance: "dance",
  health: "health-physical-education",

};

// 📥 Step 1: Fetch post list by slug
async function fetchGovdocPosts(slug) {
  const url = `https://govdoc.lk/category/term-test-papers/${slug}`;
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

// 🧾 Step 1: User input command
cmd(
  {
    pattern: "govdoc",
    react: "📚",
    desc: "Get term test papers by grade + subject",
    category: "education",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, sender, reply }) => {
    if (!q) return reply("❌ Example: `.govdoc 10 history` or `.govdoc grade 11 ict`");

    await m.react("📚");

    const input = q.trim().toLowerCase().split(/\s+/);
    let grade = "";
    let subject = "";

    if (input.length === 1 && /^\d{1,2}$/.test(input[0])) {
      grade = input[0];
    } else if (input[0] === "grade" && /^\d{1,2}$/.test(input[1])) {
      grade = input[1];
      subject = input.slice(2).join("-");
    } else if (/^\d{1,2}$/.test(input[0])) {
      grade = input[0];
      subject = input.slice(1).join("-");
    } else {
      return reply("❌ Invalid format. Try `.govdoc 10 ict` or `.govdoc grade 11 history`");
    }

    // 🧠 Handle subject short forms
    if (subject && subjectAliases[subject]) {
      subject = subjectAliases[subject];
    }
    const gradeSlug = subject
      ? `grade-${grade}/${subject}`
      : `grade-${grade}`;
    const posts = await fetchGovdocPosts(gradeSlug);
    if (!posts.length) return reply(`❌ No papers found for *${gradeSlug}*`);

    let msg = `📚 *GovDoc ${gradeSlug.toUpperCase()} Term Test Papers*\n────────────────────\n_Reply with number to select paper_\n\n`;
    posts.forEach((post, i) => {
      msg += `*${i + 1}.* ${post.title}\n`;
    });

    await robin.sendMessage(from, { text: msg }, { quoted: mek });

    pendingGovDoc[sender] = {
      step: "select",
      results: posts,
      quoted: mek,
    };
  }
);

// Step 2: User selects a paper
cmd(
  {
    filter: (text, { sender }) =>
      pendingGovDoc[sender] && pendingGovDoc[sender].step === "select" && /^\d+$/.test(text.trim()),
  },
  async (robin, mek, m, { from, body, sender, reply }) => {
    const pending = pendingGovDoc[sender];
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
        delete pendingGovDoc[sender];
        return reply("⚠️ No language options found for this paper.");
      }

      let langMsg = `🌐 *Available Languages for:* _${selectedResult.title}_\n\n`;
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
      reply("⚠️ Failed to fetch language options. Please try again.");
      delete pendingGovDoc[sender];
    }
  }
);

// Step 3: Download PDF
cmd(
  {
    filter: (text, { sender }) =>
      pendingGovDoc[sender] && pendingGovDoc[sender].step === "download" && /^\d+$/.test(text.trim()),
  },
  async (robin, mek, m, { from, body, sender, reply }) => {
    const pending = pendingGovDoc[sender];
    const selected = parseInt(body.trim());

    if (selected < 1 || selected > pending.languages.length) {
      return reply("❌ Invalid selection. Please reply with a valid number.");
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
      delete pendingGovDoc[sender];
    } catch (e) {
      console.error("❌ Puppeteer download failed:", e.message);
      reply("⚠️ Failed to download PDF. It may have timed out or failed to start.");
      delete pendingGovDoc[sender];
    }
  }
);
