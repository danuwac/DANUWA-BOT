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

const paperFlow = {}; // same as your `pendingQuality`
const subjectAliases = {
  sft: "science-for-technology",
  et: "engineering-technology",
  bst: "bio-systems-technology",
  bio: "biology",
  agri: "agriculture",
  ict: "information-and-communication-technology-ict",
  eng: "english-language",
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

// Step 1: .paper to show menu
cmd(
  {
    pattern: "paper",
    react: "📚",
    desc: "Choose paper type",
    category: "education",
    filename: __filename,
  },
  async (robin, mek, m, { from, sender, reply }) => {
    const msg = `📚 *Choose a paper category:*\n
1. Term Test Papers
2. GCE O/L Past Papers
3. GCE A/L Past Papers

_Reply with 1, 2, or 3 to continue._`;

    const sent = await robin.sendMessage(from, { text: msg }, { quoted: mek });

    // Save quoted message ID to match reply
    paperFlow[sender] = {
      step: "menu",
      menuMsgId: sent.key.id,
      quoted: mek,
    };
  }
);

// Step 2: handle reply to menu (must reply to same msg)
cmd(
  {
    filter: (text, { sender }) => {
      return (
        paperFlow[sender] &&
        paperFlow[sender].step === "menu" &&
        /^[1-3]$/.test(text.trim())
      );
    },
  },
  async (robin, mek, m, { sender, reply }) => {
    const option = parseInt(m.text.trim());

    if (option === 1) {
      await reply("📥 Enter grade and subject (e.g., `10 ict`)");
      paperFlow[sender] = { step: "input", type: "term", quoted: mek };
    } else if (option === 2) {
      await reply("📥 Enter year and subject (e.g., `2024 ict`)");
      paperFlow[sender] = { step: "input", type: "ol", quoted: mek };
    } else if (option === 3) {
      await reply("📥 Enter subject only (e.g., `biology`)");
      paperFlow[sender] = { step: "input", type: "al", quoted: mek };
    } else {
      reply("❌ Invalid selection.");
    }
  }
);
// Step 3: user inputs details
cmd(
  {
    filter: (text, { sender }) => paperFlow[sender] && paperFlow[sender].step === "input",
  },
  async (robin, mek, m, { sender, from, reply }) => {
    const { type } = paperFlow[sender];
    const input = m.text.trim().toLowerCase();
    const parts = input.split(/\s+/);

    if (type === "term") {
      const grade = parts[0];
      const subject = subjectAliases[parts[1]] || parts[1];
      const slug = `grade-${grade}/${subject}`;
      const posts = await fetchPosts(`https://govdoc.lk/category/term-test-papers/${slug}`);
      return sendPostList(posts, from, sender, robin, mek, `Term Test - Grade ${grade}`, reply);
    }

    if (type === "ol") {
      const year = parts[0];
      const subject = subjectAliases[parts.slice(1).join("-")] || parts.slice(1).join("-");
      const urls = [
        `https://govdoc.lk/gce-ordinary-level-exam-${year}-${subject}-past-papers`,
        `https://govdoc.lk/gce-ordinary-level-exam-${year}-${parseInt(year) + 1}-${subject}-past-papers`,
      ];
      for (const url of urls) {
        const res = await fetchLanguages(url);
        if (res.languages.length) return sendLanguageOptions(from, sender, robin, mek, res, reply);
      }
      return reply("❌ No papers found for that year and subject.");
    }

    if (type === "al") {
      const subject = subjectAliases[input] || input.replace(/\s+/g, "-");
      const posts = await fetchPosts(`https://govdoc.lk/category/past-papers/gce-advance-level-exam/${subject}`);
      return sendPostList(posts, from, sender, robin, mek, `A/L Past Papers - ${input.toUpperCase()}`, reply);
    }
  }
);

// Step 4: user selects paper
cmd(
  {
    filter: (text, { sender }) =>
      paperFlow[sender] && paperFlow[sender].step === "select" && /^\d+$/.test(text.trim()),
  },
  async (robin, mek, m, { sender, from, reply }) => {
    const index = parseInt(m.text.trim()) - 1;
    const { posts, quoted } = paperFlow[sender];
    if (!posts[index]) return reply("❌ Invalid number.");

    const res = await fetchLanguages(posts[index].link);
    return sendLanguageOptions(from, sender, robin, mek, res, reply);
  }
);

// Step 5: user selects language
cmd(
  {
    filter: (text, { sender }) =>
      paperFlow[sender] && paperFlow[sender].step === "download" && /^\d+$/.test(text.trim()),
  },
  async (robin, mek, m, { sender, from, reply }) => {
    const index = parseInt(m.text.trim()) - 1;
    const { languages, title } = paperFlow[sender];
    const selected = languages[index];
    if (!selected) return reply("❌ Invalid option.");

    await reply("⏳ Downloading... Please wait.");
    const pdf = await downloadPDF(selected.link);
    if (!pdf) return reply("❌ Download failed.");

    await robin.sendMessage(from, {
      document: pdf,
      mimetype: "application/pdf",
      fileName: `${title} - ${selected.lang}.pdf`,
    }, { quoted: mek });

    delete paperFlow[sender];
  }
);

// Helpers

async function fetchPosts(url) {
  try {
    const res = await axios.get(url, { headers });
    const $ = cheerio.load(res.data);
    const posts = [];
    $("a.custom-card").each((_, el) => {
      const link = $(el).attr("href");
      const title = $(el).find("h5.cate-title").text().trim();
      if (link && title) posts.push({ title, link });
    });
    return posts.slice(0, 20);
  } catch {
    return [];
  }
}

async function fetchLanguages(url) {
  try {
    const res = await axios.get(url, { headers });
    const $ = cheerio.load(res.data);
    const title = $("h1.entry-title").text().trim();
    const languages = [];
    $("a[href*='/view?id=']").each((_, el) => {
      const lang = $(el).find("button").text().trim();
      const href = $(el).attr("href");
      if (lang && href) {
        languages.push({ lang, link: href.startsWith("http") ? href : `https://govdoc.lk${href}` });
      }
    });
    return { title, languages };
  } catch {
    return { title: "", languages: [] };
  }
}

async function sendPostList(posts, from, sender, robin, mek, title, reply) {
  if (!posts.length) return reply("❌ No posts found.");
  let msg = `📄 *${title}*\n_Reply with number to select paper._\n\n`;
  posts.forEach((p, i) => msg += `*${i + 1}.* ${p.title}\n`);
  await robin.sendMessage(from, { text: msg }, { quoted: mek });
  paperFlow[sender] = { step: "select", posts };
}

async function sendLanguageOptions(from, sender, robin, mek, { title, languages }, reply) {
  if (!languages.length) return reply("❌ No download links.");
  let msg = `🌐 *Available Languages for:* _${title}_\n\n`;
  languages.forEach((l, i) => msg += `*${i + 1}.* ${l.lang}\n`);
  msg += `_Reply with number to download._`;

  await robin.sendMessage(from, { text: msg }, { quoted: mek });
  paperFlow[sender] = { step: "download", title, languages };
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
  } catch {
    return null;
  }
}
