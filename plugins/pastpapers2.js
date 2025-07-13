const { cmd } = require("../command");
const axios = require("axios");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer");

const headers = {
  "User-Agent": "Mozilla/5.0",
  "Accept-Language": "en-US,en;q=0.9",
};

const pendingGovDoc = {};

// Step 1: Fetch posts
async function fetchGovdocPosts(gradeSlug) {
  const url = `https://govdoc.lk/category/term-test-papers/${gradeSlug}`;
  const res = await axios.get(url, { headers });
  const $ = cheerio.load(res.data);
  const posts = [];

  $("a.custom-card").each((_, el) => {
    const link = $(el).attr("href");
    const title = $(el).find("h5.cate-title").text().trim();
    if (link && title) posts.push({ title, link });
  });

  return posts.slice(0, 20);
}

// .govdoc grade 11
cmd(
  {
    pattern: "govdoc",
    react: "📚",
    desc: "Get term test papers from govdoc.lk",
    category: "education",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, sender, reply }) => {
    if (!q) return reply("❌ Please provide a grade. Example: `.govdoc grade 11`");

    await m.react("📚");
    const gradeSlug = q.toLowerCase().replace(/\s+/g, "-");
    const posts = await fetchGovdocPosts(gradeSlug);

    if (!posts.length) return reply(`❌ No papers found for *${q}*`);

    let msg = `📚 *GovDoc ${q.toUpperCase()} Term Test Papers*\n────────────────────\n_Reply with number to select paper_\n\n`;
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

// Step 3: Download using Puppeteer
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

    try {
      const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();
      await page.goto(lang.link, { waitUntil: "networkidle2", timeout: 30000 });

      // Wait for the download button and extract the href
      await page.waitForSelector('a.btn.w-100[href*="/download/"]', { timeout: 15000 });
      const downloadUrl = await page.$eval('a.btn.w-100[href*="/download/"]', a =>
        a.href.startsWith("http") ? a.href : `https://govdoc.lk${a.getAttribute("href")}`
      );

      // Download the file content from extracted downloadUrl
      const pdfResponse = await axios.get(downloadUrl, {
        responseType: "arraybuffer",
        headers: {
          ...headers,
          Referer: lang.link,
        },
      });

      const contentType = pdfResponse.headers["content-type"];
      if (!contentType.includes("pdf")) {
        throw new Error("Not a PDF file. Got: " + contentType);
      }

      const pdfBuffer = Buffer.from(pdfResponse.data);
      const fileName = `${pending.selected.title} - ${lang.lang}.pdf`;

      await robin.sendMessage(
        from,
        {
          document: pdfBuffer,
          mimetype: "application/pdf",
          fileName,
        },
        { quoted: mek }
      );

      await browser.close();
      delete pendingGovDoc[sender];
    } catch (e) {
      console.error("❌ Puppeteer download failed:", e.message);
      reply("⚠️ Failed to download PDF using browser automation. The file may not be available.");
      delete pendingGovDoc[sender];
    }
  }
);
