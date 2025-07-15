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
  sinhala: "sinhala",
  mathematics: "mathematics",
  science: "science",
  history: "history",
  english: "english",
  ict: "information-and-communication-technology",
  civic: "civic-education",
  buddhism: "buddhism",
  christianity: "christianity",
  islam: "islam",
  business: "business-and-accounting-studies",
  geography: "geography",
  home: "home-economics",
  art: "art",
  drama: "drama-&-theatre",
  music: "western-music",
  oriental: "oriental-music",
  dance: "dance",
  agriculture: "agriculture-&-food-technology",
  designm: "design-and-mechanical-technology",
  designc: "design-and-construction-technology",
  elek: "design-electrical-&-electronic-technology",
};

const pendingModel = {};

// 🌐 Resolve URL based on type and optional subject
function resolveModelURL(type, subject = "") {
  const base = "https://govdoc.lk/category/model-papers/";
  const typePath =
    type === "o/l"
      ? "gce-ordinary-level-exam"
      : type === "a/l"
      ? "gce-advance-level-exam"
      : "";

  return subject ? `${base}${typePath}/${subject}` : `${base}${typePath}`;
}

// 🔁 Fetch posts excluding related pages
async function fetchModelPosts(type, subjectKey) {
  const posts = [];
  let page = 1;
  const subjectSlug = subjectKey ? subjectAliases[subjectKey] : "";
  const baseURL = resolveModelURL(type, subjectSlug);

  while (true) {
    const url = page === 1 ? baseURL : `${baseURL}?page=${page}`;

    try {
      const res = await axios.get(url, { headers });
      const $ = cheerio.load(res.data);

      const cards = $("a.custom-card").filter((_, el) => {
        return !$(el).attr("href").includes("/page/");
      });

      if (cards.length === 0) break;

      cards.each((_, el) => {
        const link = $(el).attr("href");
        const title = $(el).find("h5.cate-title").text().trim();
        if (link && title && !posts.find((p) => p.link === link)) {
          posts.push({ title, link });
        }
      });

      page++;
    } catch (err) {
      console.error("❌ Fetch failed:", err.message);
      break;
    }
  }

  return posts;
}

cmd(
  {
    pattern: "model",
    react: "📘",
    desc: "Download model papers by O/L or A/L and optional subject",
    category: "education",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, sender, reply }) => {
    if (!q) return reply("❌ Example: `.model o/l` or `.model a/l accounting`");

    await m.react("📘");

    const input = q.trim().toLowerCase().split(/\s+/);
    const type = input[0];
    const subjectInput = input.slice(1).join("-");

    if (!["o/l", "a/l"].includes(type))
      return reply("❌ Please specify `o/l` or `a/l`");

    if (subjectInput && !subjectAliases[subjectInput]) {
      return reply(`❌ Unknown subject \"${subjectInput}\". Use one of: ${Object.keys(subjectAliases).join(", ")}`);
    }

    const posts = await fetchModelPosts(type, subjectInput);

    if (!posts.length) return reply("❌ No model papers found.");

    let msg = `📘 *${type.toUpperCase()} Model Papers*`;
    if (subjectInput) msg += ` — Subject: *${subjectInput.replace(/-/g, " ")}*`;
    msg += `\n────────────────────\n_Reply with number to select paper_\n\n`;

    posts.forEach((p, i) => {
      msg += `*${i + 1}.* ${p.title}\n`;
    });

    await robin.sendMessage(from, { text: msg }, { quoted: mek });

    pendingModel[sender] = {
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
        return reply("⚠️ No language options found.");
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

// 📥 Step 3: Download PDF via Puppeteer
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
