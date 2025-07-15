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

const pendingModel = {};

// 🔁 Fetch all posts (multi-page support)
async function fetchModelPapers(slug) {
  const posts = [];
  let page = 1;

  while (true) {
    const url =
      page === 1
        ? `https://govdoc.lk/category/${slug}`
        : `https://govdoc.lk/category/${slug}?page=${page}`;

    try {
      const res = await axios.get(url, { headers });
      const $ = cheerio.load(res.data);

      const cards = $("a.custom-card");
      if (cards.length === 0) break;

      let newPosts = 0;
      cards.each((_, el) => {
        const link = $(el).attr("href");
        const title = $(el).find("h5.cate-title").text().trim();

        // ❌ Skip related pages
        if (link.includes("/page/")) return;

        if (link && title && !posts.find((p) => p.link === link)) {
          posts.push({ title, link });
          newPosts++;
        }
      });

      if (newPosts === 0) break;
      page++;
    } catch (err) {
      console.error(`❌ Failed on page ${page}:`, err.message);
      break;
    }
  }

  return posts;
}

cmd(
  {
    pattern: "model",
    react: "📘",
    desc: "Download model papers (O/L or A/L)",
    category: "education",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, sender, reply }) => {
    const level = q.trim().toLowerCase();
    let slug = "";

    if (level === "o/l" || level === "ol") {
      slug = "model-papers/gce-ordinary-level-exam";
    } else if (level === "a/l" || level === "al") {
      slug = "model-papers/gce-advance-level-exam";
    } else {
      return reply("❌ Invalid input. Use `.model o/l` or `.model a/l`");
    }

    await m.react("📘");
    const posts = await fetchModelPapers(slug);

    if (!posts.length) return reply("❌ No model papers found.");

    let msg = `📘 *GovDoc Model Papers (${level.toUpperCase()})*
────────────────────
_Reply with number to select paper_

`;
    posts.forEach((post, i) => {
      msg += `*${i + 1}.* ${post.title}\n`;
    });

    await robin.sendMessage(from, { text: msg }, { quoted: mek });

    pendingModel[sender] = {
      step: "select",
      results: posts,
      quoted: mek,
    };
  }
);

// Step 2: Select Paper
cmd(
  {
    filter: (text, { sender }) =>
      pendingModel[sender] && pendingModel[sender].step === "select" && /^\d+$/.test(text.trim()),
  },
  async (robin, mek, m, { from, body, sender, reply }) => {
    const pending = pendingModel[sender];
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
        delete pendingModel[sender];
        return reply("⚠️ No language versions found (but expected). Report this if issue continues.");
      }

      let langMsg = `🌐 *Available Languages for:* _${selectedResult.title}_\n\n`;
      languages.forEach((l, i) => {
        langMsg += `*${i + 1}.* ${l.lang}\n`;
      });
      langMsg += `\n_Reply with a number (1-${languages.length}) to download._`;

      pendingModel[sender] = {
        step: "download",
        selected: selectedResult,
        languages,
        quoted: mek,
      };

      reply(langMsg);
    } catch (e) {
      console.error(e);
      reply("⚠️ Failed to fetch language options.");
      delete pendingModel[sender];
    }
  }
);

// Step 3: Download PDF via Puppeteer
cmd(
  {
    filter: (text, { sender }) =>
      pendingModel[sender] && pendingModel[sender].step === "download" && /^\d+$/.test(text.trim()),
  },
  async (robin, mek, m, { from, body, sender, reply }) => {
    const pending = pendingModel[sender];
    const selected = parseInt(body.trim());

    if (selected < 1 || selected > pending.languages.length) {
      return reply("❌ Invalid selection.");
    }

    const lang = pending.languages[selected - 1];
    const downloadDir = path.join(os.tmpdir(), `model-${Date.now()}`);

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
      delete pendingModel[sender];
    } catch (e) {
      console.error("❌ Puppeteer download failed:", e.message);
      reply("⚠️ Failed to download PDF.");
      delete pendingModel[sender];
    }
  }
);
