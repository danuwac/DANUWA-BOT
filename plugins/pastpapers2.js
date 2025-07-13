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

// 🔠 Subject short forms to slugs
const subjectAliases = {
  ict: "information-communication-technology",
  sft: "science-for-technology",
  et: "engineering-technology",
  bst: "bio-systems-technology",
  agri: "agriculture",
  hist: "history",
  eng: "english",
  sin: "sinhala",
  tam: "tamil",
  maths: "mathematics",
  sci: "science",
  comm: "commerce",
  acc: "accounting",
  bus: "business-studies",
  health: "health",
};

// 🔁 Fetch all posts (multi-page support)
async function fetchGovdocPosts(slug) {
  const posts = [];
  let page = 1;

  while (true) {
    const url =
      page === 1
        ? `https://govdoc.lk/category/term-test-papers/${slug}`
        : `https://govdoc.lk/category/term-test-papers/${slug}/page/${page}`;

    try {
      const res = await axios.get(url, { headers });
      const $ = cheerio.load(res.data);

      const cards = $("a.custom-card");
      if (cards.length === 0) break; // no more posts

      let newPosts = 0;

      cards.each((_, el) => {
        const link = $(el).attr("href");
        const title = $(el).find("h5.cate-title").text().trim();

        if (link && title && !posts.find(p => p.link === link)) {
          posts.push({ title, link });
          newPosts++;
        }
      });

      if (newPosts === 0) break; // No new posts = done
      page++;
    } catch (err) {
      console.error(`❌ Failed to fetch page ${page}:`, err.message);
      break;
    }
  }

  return posts;
}

// 🧾 Command: .govdoc [grade] [subject]
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

    let msg = `📚 *GovDoc ${gradeSlug.toUpperCase()} Term Test Papers*\n────────────────────\n_Reply with number to select paper_\n\n`;
    posts.forEach((post, i) => {
      let title = post.title;

      // 🔆 Highlight subject if found in title
      if (subject && title.toLowerCase().includes(subject.replace(/-/g, " "))) {
        const reg = new RegExp(`(${subject.replace(/-/g, " ")})`, "ig");
        title = title.replace(reg, "*$1*");
      }

      msg += `*${i + 1}.* ${title}\n`;
    });

    await robin.sendMessage(from, { text: msg }, { quoted: mek });

    pendingGovDoc[sender] = {
      step: "select",
      results: posts,
      quoted: mek,
    };
  }
);

// 🔢 Step 2: User selects post
cmd(
  {
    filter: (text, { sender }) =>
      pendingGovDoc[sender] && pendingGovDoc[sender].step === "select" && /^\d+$/.test(text.trim()),
  },
  async (robin, mek, m, { from, body, sender, reply }) => {
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
      reply("⚠️ Failed to fetch language options.");
      delete pendingGovDoc[sender];
    }
  }
);

// 📥 Step 3: Download PDF via Puppeteer
cmd(
  {
    filter: (text, { sender }) =>
      pendingGovDoc[sender] && pendingGovDoc[sender].step === "download" && /^\d+$/.test(text.trim()),
  },
  async (robin, mek, m, { from, body, sender, reply }) => {
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
  }
);
