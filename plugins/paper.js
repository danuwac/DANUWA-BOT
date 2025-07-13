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

const userFlow = {};
const subjectAliases = {
  // Shared aliases for all modes
  sft: "science-for-technology",
  et: "engineering-technology",
  bst: "bio-systems-technology",
  bio: "biology",
  agri: "agriculture",
  ict: "information-and-communication-technology-ict",
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

cmd(
  {
    pattern: "paper",
    react: "📚",
    desc: "Download term, O/L, or A/L past papers",
    category: "education",
    filename: __filename,
  },
  async (robin, mek, m, { from, sender }) => {
    const msg = `📚 *Choose a paper category:*

1. Term Test Papers
2. GCE O/L Past Papers
3. GCE A/L Past Papers

_Reply with 1, 2, or 3 to continue._`;
    await robin.sendMessage(from, { text: msg }, { quoted: mek });

    userFlow[sender] = { step: "menu", quoted: mek };
  }
);

cmd(
  {
    filter: (text, { sender }) =>
      userFlow[sender] && userFlow[sender].step === "menu" && /^[1-3]$/.test(text.trim()),
  },
  async (robin, mek, m, { sender, reply }) => {
    const choice = parseInt(m.text.trim());
    userFlow[sender] = { step: "input", type: choice, quoted: mek };

    if (choice === 1) return reply("📥 Please enter: `grade subject` (e.g., `10 ict`)");
    if (choice === 2) return reply("📥 Please enter: `year subject` (e.g., `2024 ict`)");
    if (choice === 3) return reply("📥 Please enter subject (e.g., `biology`)");
  }
);

// Handle input for all types
cmd(
  {
    filter: (text, { sender }) => userFlow[sender] && userFlow[sender].step === "input",
  },
  async (robin, mek, m, { from, sender, reply }) => {
    const { type } = userFlow[sender];
    const q = m.text.trim().toLowerCase();
    const parts = q.split(/\s+/);

    if (type === 1) {
      // Term test: grade + subject
      const grade = parts[0];
      let subject = parts.slice(1).join("-");

      subject = subjectAliases[subject] || subject;
      const slug = `grade-${grade}/${subject}`;
      const posts = await scrapePapers(`https://govdoc.lk/category/term-test-papers/${slug}`);
      return handleList(from, sender, posts, `Term Test Papers for Grade ${grade}`, robin, mek, reply);
    }

    if (type === 2) {
      // O/L past papers: year + subject
      const year = parts[0];
      const subject = subjectAliases[parts.slice(1).join("-")] || parts.slice(1).join("-");
      const urls = [
        `https://govdoc.lk/gce-ordinary-level-exam-${year}-${subject}-past-papers`,
        `https://govdoc.lk/gce-ordinary-level-exam-${year}-${parseInt(year) + 1}-${subject}-past-papers`,
      ];
      for (let url of urls) {
        const res = await getPaperInfo(url);
        if (res.languages.length) {
          return handleLangSelect(sender, from, robin, mek, res.title, res.languages, reply);
        }
      }
      return reply("❌ Not found. Check year or subject.");
    }

    if (type === 3) {
      // A/L past papers: subject only
      let subject = subjectAliases[q] || q.replace(/\s+/g, "-");
      const url = `https://govdoc.lk/category/past-papers/gce-advance-level-exam/${subject}`;
      const posts = await scrapePapers(url);
      return handleList(from, sender, posts, `A/L Past Papers: ${q.toUpperCase()}`, robin, mek, reply);
    }
  }
);

// Selection step
cmd(
  {
    filter: (text, { sender }) =>
      userFlow[sender] && userFlow[sender].step === "select" && /^\d+$/.test(text.trim()),
  },
  async (robin, mek, m, { sender, from, reply }) => {
    const index = parseInt(m.text.trim()) - 1;
    const { results, quoted } = userFlow[sender];

    if (!results[index]) return reply("❌ Invalid selection.");
    const { link, title } = results[index];
    const res = await getPaperInfo(link);
    return handleLangSelect(sender, from, robin, mek, title, res.languages, reply);
  }
);

// Language reply
cmd(
  {
    filter: (text, { sender }) =>
      userFlow[sender] && userFlow[sender].step === "download" && /^\d+$/.test(text.trim()),
  },
  async (robin, mek, m, { sender, from, reply }) => {
    const index = parseInt(m.text.trim()) - 1;
    const { languages, title } = userFlow[sender];
    if (!languages[index]) return reply("❌ Invalid option.");

    const lang = languages[index];
    const buffer = await downloadPDF(lang.link);
    if (!buffer) return reply("⚠️ Failed to download.");

    await robin.sendMessage(
      from,
      {
        document: buffer,
        mimetype: "application/pdf",
        fileName: `${title} - ${lang.lang}.pdf`,
      },
      { quoted: mek }
    );

    delete userFlow[sender];
  }
);

// --- UTIL FUNCTIONS ---
async function scrapePapers(url) {
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

async function getPaperInfo(url) {
  try {
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
  } catch {
    return { title: "", languages: [] };
  }
}

async function handleList(from, sender, posts, title, robin, mek, reply) {
  if (!posts.length) return reply("❌ No papers found.");
  let msg = `📚 *${title}*\n\n_Reply with number to select paper._\n\n`;
  posts.forEach((p, i) => (msg += `*${i + 1}.* ${p.title}\n`));
  await robin.sendMessage(from, { text: msg }, { quoted: mek });

  userFlow[sender] = { step: "select", results: posts };
}

async function handleLangSelect(sender, from, robin, mek, title, languages, reply) {
  if (!languages.length) return reply("⚠️ No language options.");
  let msg = `🌐 *Available Languages for:* _${title}_\n\n`;
  languages.forEach((l, i) => (msg += `*${i + 1}.* ${l.lang}\n`));
  msg += `\n_Reply with number to download._`;

  await robin.sendMessage(from, { text: msg }, { quoted: mek });

  userFlow[sender] = {
    step: "download",
    title,
    languages,
  };
}

async function downloadPDF(link) {
  const dir = path.join(os.tmpdir(), "paper-" + Date.now());
  fs.mkdirSync(dir);
  let buffer = null;

  try {
    const browser = await puppeteer.launch({
      headless: "new",
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });

    const page = await browser.newPage();
    await page._client().send("Page.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: dir,
    });

    await page.goto(link, { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForSelector('a.btn.w-100[href*="/download/"]', { timeout: 15000 });
    await page.click('a.btn.w-100[href*="/download/"]');

    for (let i = 0; i < 20; i++) {
      const files = fs.readdirSync(dir).filter(f => f.endsWith(".pdf"));
      if (files.length) {
        buffer = fs.readFileSync(path.join(dir, files[0]));
        break;
      }
      await new Promise(res => setTimeout(res, 1000));
    }

    await browser.close();
    fs.rmSync(dir, { recursive: true, force: true });
    return buffer;
  } catch (e) {
    console.error("PDF Download failed:", e.message);
    return null;
  }
}
