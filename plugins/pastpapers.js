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

const LOGO_IMAGE = "https://github.com/DANUWA-MD/DANUWA-BOT/blob/main/images/educational__zone.png?raw=true";
const channelJid = "120363418166326365@newsletter";
const channelName = "🍁 ＤＡＮＵＷＡ－ －ＭＤ 🍁";
const pendingALPapers = {};

async function fetchSubjectPapers(subjectSlug) {
  const url = `https://govdoc.lk/category/past-papers/gce-advance-level-exam/${subjectSlug}`;
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

cmd({
  pattern: "al",
  react: "📄",
  desc: "Get A/L past papers by subject from govdoc.lk",
  category: "education",
  filename: __filename,
}, async (robin, mek, m, { from, q, sender, reply }) => {
  if (!q) return reply("\u274c Please provide a subject. Example: `.pastpapers biology`");
  await m.react("\ud83d\udcc4");

  const subjectAliases = {
    sft: "science-for-technology",
    et: "engineering-technology",
    bst: "bio-systems-technology",
    bio: "biology",
    agri: "agriculture",
    ict: "information-and-communication-technology",
    eng: "general-english",
    econ: "economics",
  };

  const rawInput = q.trim().toLowerCase();
  const subjectSlug = subjectAliases[rawInput] || rawInput.replace(/\s+/g, "-");
  const posts = await fetchSubjectPapers(subjectSlug);
  if (!posts.length) return reply(`\u274c No past papers found for *${q}*`);

  let msg = `╔═━━━━━━━━━━━━━━╗\n`;
  msg += `║     🍁 ＤＡＮＵＷＡ－ －ＭＤ 🍁     ║\n`;
  msg += `╚═━━━━━━━━━━━━━━╝\n`;
  msg += `     *📄 A/L PAST PAPERS 📄*\n`;
  msg += `\n*SUBJECT:* *${rawInput.toUpperCase()}*\n*RESULTS:* *${posts.length}*\n\n`;
  msg += `🔹 *REPLY WITH A NUMBER TO SELECT A PAPER:*\n\n`;
  posts.forEach((post, i) => {
    msg += `*${i + 1}.* ${post.title}\n`;
  });

  await robin.sendMessage(from, {
    caption: msg,
    image: { url: LOGO_IMAGE },
    contextInfo: {
      forwardingScore: 999,
      isForwarded: true,
      forwardedNewsletterMessageInfo: {
        newsletterJid: channelJid,
        newsletterName: channelName,
        serverMessageId: -1,
      },
    },
  }, { quoted: mek });

  pendingALPapers[sender] = {
    step: "select",
    results: posts,
    quoted: mek,
  };
});

cmd({
  filter: (text, { sender }) =>
    pendingALPapers[sender] && pendingALPapers[sender].step === "select" && /^\d+$/.test(text.trim()),
}, async (robin, mek, m, { from, body, sender, reply }) => {
  const pending = pendingALPapers[sender];
  const selected = parseInt(body.trim());
  if (selected < 1 || selected > pending.results.length) {
    return reply("\u274c Invalid selection. Please reply with a valid number.");
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
      return reply("\u26a0\ufe0f No language options found for this paper.");
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
    reply("\u26a0\ufe0f Failed to fetch language options. Please try again.");
    delete pendingALPapers[sender];
  }
});

cmd({
  filter: (text, { sender }) =>
    pendingALPapers[sender] && pendingALPapers[sender].step === "download" && /^\d+$/.test(text.trim()),
}, async (robin, mek, m, { from, body, sender, reply }) => {
  const pending = pendingALPapers[sender];
  const selected = parseInt(body.trim());
  if (selected < 1 || selected > pending.languages.length) {
    return reply("\u274c Invalid selection. Please reply with a valid number.");
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
        caption: `\u2551 *\u2705 DOWNLOAD COMPLETE \u2705*\n\n\u2022 ${niceName}\n\u2022 Made with ❤️ by \n\u2728 DANUKA DISANAYAKA ✨`,
      },
      { quoted: mek }
    );

    fs.unlinkSync(filePath);
    fs.rmdirSync(downloadDir);
    delete pendingALPapers[sender];
  } catch (e) {
    console.error("\u274c Puppeteer download failed:", e.message);
    reply("\u26a0\ufe0f Failed to download PDF. It may have timed out or failed to start.");
    delete pendingALPapers[sender];
  }
});
