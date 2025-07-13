// Merged Plugin: A/L, O/L and Term Test Papers Downloader

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

// All aliases combined
const subjectAliases = {
  sft: "science-for-technology",
  et: "engineering-technology",
  bst: "bio-systems-technology",
  bio: "biology",
  agri: "agriculture",
  ict: "information-and-communication-technology",
  eng: "general-english",
  econ: "economics",
  commerce: "business-accounting-studies",
  hist: "history",
  geo: "geography",
  sinh: "sinhala",
  tam: "tamil",
  home: "home-economics",
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

const pending = {};

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

function normalizeSubject(input) {
  return subjectAliases[input] || input.replace(/\s+/g, "-");
}

// .alpapers [subject]
cmd({ pattern: "alpapers", desc: "A/L Past Papers", react: "📄" }, async (robin, mek, m, { from, q, sender, reply }) => {
  if (!q) return reply("❌ Usage: .alpapers <subject>");
  const slug = normalizeSubject(q.trim().toLowerCase());
  const url = `https://govdoc.lk/category/past-papers/gce-advance-level-exam/${slug}`;
  try {
    const res = await axios.get(url, { headers });
    const $ = cheerio.load(res.data);
    const posts = [];
    $("a.custom-card").each((_, el) => {
      const link = $(el).attr("href");
      const title = $(el).find("h5.cate-title").text().trim();
      if (link && title) posts.push({ title, link });
    });
    if (!posts.length) return reply("❌ No papers found.");

    let msg = `📄 *A/L Past Papers: ${slug}*\n\n`;
    posts.forEach((p, i) => (msg += `*${i + 1}.* ${p.title}\n`));

    await robin.sendMessage(from, { text: msg }, { quoted: mek });
    pending[sender] = { step: "al-select", posts, quoted: mek };
  } catch (e) {
    reply("❌ Failed to load papers.");
  }
});

// .olpapers [year] [subject]
cmd({ pattern: "olpapers", desc: "O/L Past Papers", react: "📄" }, async (robin, mek, m, { from, q, sender, reply }) => {
  if (!q) return reply("❌ Usage: .olpapers <year> <subject>");
  const parts = q.trim().toLowerCase().split(/\s+/);
  if (parts.length < 2) return reply("❌ Provide both year and subject.");

  const year = parts[0];
  const subjectSlug = normalizeSubject(parts.slice(1).join("-"));
  const urls = [
    `https://govdoc.lk/gce-ordinary-level-exam-${year}-${subjectSlug}-past-papers`,
    `https://govdoc.lk/gce-ordinary-level-exam-${year}-${parseInt(year) + 1}-${subjectSlug}-past-papers`,
  ];

  for (const url of urls) {
    try {
      const data = await fetchLanguageOptions(url);
      if (data.languages.length) {
        let msg = `📄 *${data.title}*\n\n🌐 Languages:\n`;
        data.languages.forEach((l, i) => (msg += `*${i + 1}.* ${l.lang}\n`));
        msg += `\nReply with a number to download.`;
        pending[sender] = { step: "ol-download", ...data, quoted: mek };
        return await robin.sendMessage(from, { text: msg }, { quoted: mek });
      }
    } catch {}
  }
  reply("❌ No matching O/L paper found.");
});

// .govdoc [grade] [subject]
cmd({ pattern: "govdoc", desc: "Term Test Papers", react: "📚" }, async (robin, mek, m, { from, q, sender, reply }) => {
  if (!q) return reply("❌ Usage: .govdoc <grade> <subject>");
  const parts = q.trim().toLowerCase().split(/\s+/);
  let grade = parts[0], subject = normalizeSubject(parts.slice(1).join("-"));
  if (!/^\d+$/.test(grade)) return reply("❌ Invalid grade.");

  const url = `https://govdoc.lk/category/term-test-papers/grade-${grade}/${subject}`;
  try {
    const res = await axios.get(url, { headers });
    const $ = cheerio.load(res.data);
    const posts = [];
    $("a.custom-card").each((_, el) => {
      const link = $(el).attr("href");
      const title = $(el).find("h5.cate-title").text().trim();
      if (link && title) posts.push({ title, link });
    });
    if (!posts.length) return reply("❌ No papers found.");

    let msg = `📚 *Term Test Papers: Grade ${grade} ${subject}*\n\n`;
    posts.forEach((p, i) => (msg += `*${i + 1}.* ${p.title}\n`));

    await robin.sendMessage(from, { text: msg }, { quoted: mek });
    pending[sender] = { step: "govdoc-select", posts, quoted: mek };
  } catch (e) {
    reply("❌ Failed to load term papers.");
  }
});

// Selection handler
cmd({ filter: (text, { sender }) => pending[sender] && text.trim().match(/^\d+$/) }, async (robin, mek, m, { from, body, sender, reply }) => {
  const state = pending[sender];
  const choice = parseInt(body.trim());

  if (state.step.includes("select")) {
    const post = state.posts[choice - 1];
    if (!post) return reply("❌ Invalid number.");
    try {
      const data = await fetchLanguageOptions(post.link);
      if (!data.languages.length) throw new Error();

      let msg = `🌐 *Languages for:* _${post.title}_\n\n`;
      data.languages.forEach((l, i) => (msg += `*${i + 1}.* ${l.lang}\n`));
      msg += `\nReply with number to download.`;
      pending[sender] = { step: "download", title: post.title, languages: data.languages, quoted: mek };
      reply(msg);
    } catch {
      delete pending[sender];
      reply("❌ Failed to fetch language options.");
    }
  } else if (state.step === "download") {
    const lang = state.languages[choice - 1];
    if (!lang) return reply("❌ Invalid selection.");

    const downloadDir = path.join(os.tmpdir(), `paper-${Date.now()}`);
    fs.mkdirSync(downloadDir);

    try {
      const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
      const page = await browser.newPage();
      await page._client().send("Page.setDownloadBehavior", { behavior: "allow", downloadPath: downloadDir });
      await page.goto(lang.link, { waitUntil: "networkidle2", timeout: 30000 });
      await page.waitForSelector('a.btn.w-100[href*="/download/"]', { timeout: 15000 });
      await page.click('a.btn.w-100[href*="/download/"]');

      let fileName;
      for (let i = 0; i < 20; i++) {
        const files = fs.readdirSync(downloadDir).filter(f => f.endsWith(".pdf"));
        if (files.length) {
          fileName = files[0];
          break;
        }
        await new Promise(res => setTimeout(res, 1000));
      }
      await browser.close();

      if (!fileName) throw new Error("Timeout waiting for download.");
      const filePath = path.join(downloadDir, fileName);
      const buffer = fs.readFileSync(filePath);
      await robin.sendMessage(from, { document: buffer, mimetype: "application/pdf", fileName: `${state.title} - ${lang.lang}.pdf` }, { quoted: mek });
      fs.unlinkSync(filePath);
      fs.rmdirSync(downloadDir);
    } catch (e) {
      console.error("Download error:", e);
      reply("❌ Download failed.");
    }
    delete pending[sender];
  }
});
