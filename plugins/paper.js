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

// Shared state for all commands
const pendingRequests = {};

// Subject aliases for all command types
const subjectAliases = {
  // A/L subjects
  sft: "science-for-technology",
  et: "engineering-technology",
  bst: "bio-systems-technology",
  bio: "biology",
  agri: "agriculture",
  ict: "information-and-communication-technology",
  eng: "general-english",
  econ: "economics",
  
  // Term test and O/L subjects
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

// Common functions

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

async function downloadAndSendPDF(robin, link, title, lang, from, mek, sender, typePrefix) {
  const downloadDir = path.join(os.tmpdir(), `${typePrefix}-${Date.now()}`);

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

    await page.goto(link, { waitUntil: "networkidle2", timeout: 30000 });
    await page.waitForSelector('a.btn.w-100[href*="/download/"]', { timeout: 15000 });
    await page.click('a.btn.w-100[href*="/download/"]');

    // Wait for download
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

    if (!fileName) throw new Error("Download did not complete.");

    const filePath = path.join(downloadDir, fileName);
    const buffer = fs.readFileSync(filePath);
    const niceName = `${title} - ${lang}.pdf`;

    await robin.sendMessage(
      from,
      {
        document: buffer,
        mimetype: "application/pdf",
        fileName: niceName,
      },
      { quoted: mek }
    );

    fs.unlinkSync(filePath);
    fs.rmdirSync(downloadDir);
    delete pendingRequests[sender];
  } catch (e) {
    console.error("❌ Puppeteer download failed:", e.message);
    throw e;
  }
}

// Command: .pastpapers - A/L past papers
cmd(
  {
    pattern: "pastpapers",
    react: "📄",
    desc: "Get A/L past papers by subject from govdoc.lk",
    category: "education",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, sender, reply }) => {
    if (!q) return reply("❌ Please provide a subject. Example: `.pastpapers biology`");

    await m.react("📄");
    const rawInput = q.trim().toLowerCase();
    const subjectSlug = subjectAliases[rawInput] || rawInput.replace(/\s+/g, "-");

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

    if (!posts.length) return reply(`❌ No past papers found for *${q}*`);

    let msg = `📄 *A/L Past Papers: ${q.toUpperCase()}*\n────────────────────\n_Reply with number to select paper_\n\n`;
    posts.forEach((post, i) => {
      msg += `*${i + 1}.* ${post.title}\n`;
    });

    await robin.sendMessage(from, { text: msg }, { quoted: mek });

    pendingRequests[sender] = {
      type: "al-papers",
      step: "select",
      results: posts,
      quoted: mek,
    };
  }
);

// Command: .govdoc - Term test papers
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
      if (subject && title.toLowerCase().includes(subject.replace(/-/g, " "))) {
        const reg = new RegExp(`(${subject.replace(/-/g, " ")})`, "ig");
        title = title.replace(reg, "*$1*");
      }
      msg += `*${i + 1}.* ${title}\n`;
    });

    await robin.sendMessage(from, { text: msg }, { quoted: mek });

    pendingRequests[sender] = {
      type: "govdoc",
      step: "select",
      results: posts,
      quoted: mek,
    };
  }
);

// Command: .pastol - O/L past papers
cmd(
  {
    pattern: "pastol",
    desc: "Download O/L past papers by year and subject",
    category: "education",
    react: "📄",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, sender, reply }) => {
    if (!q) return reply("❌ Usage: `.pastol <year> <subject>`");

    const parts = q.trim().toLowerCase().split(/\s+/);
    if (parts.length < 2) return reply("❌ You must provide both year and subject.");

    const year = parts[0];
    const rawSubject = parts.slice(1).join("-").replace(/\s+/g, "-");
    const subjectSlug = subjectAliases[rawSubject] || rawSubject;

    const urlsToTry = [
      `https://govdoc.lk/gce-ordinary-level-exam-${year}-${subjectSlug}-past-papers`,
      `https://govdoc.lk/gce-ordinary-level-exam-${year}-${parseInt(year) + 1}-${subjectSlug}-past-papers`,
    ];

    let pageData;
    let finalUrl;

    for (const url of urlsToTry) {
      try {
        pageData = await fetchLanguageOptions(url);
        if (pageData.languages.length) {
          finalUrl = url;
          break;
        }
      } catch (e) {
        // continue to try fallback
      }
    }

    if (!pageData || !pageData.languages.length) {
      return reply("❌ Past paper not found. Check the year or subject name.");
    }

    const msgLines = [`📄 *${pageData.title}*`, `\n🌐 *Available Languages:*`];
    pageData.languages.forEach((l, i) => {
      msgLines.push(`*${i + 1}.* ${l.lang}`);
    });
    msgLines.push(`\n_Reply with a number to download that version._`);

    pendingRequests[sender] = {
      type: "pastol",
      step: "download",
      title: pageData.title,
      languages: pageData.languages,
      quoted: mek,
    };

    await robin.sendMessage(from, { text: msgLines.join("\n") }, { quoted: mek });
  }
);

// Helper function for govdoc posts
async function fetchGovdocPosts(slug) {
  const posts = [];
  let page = 1;

  while (true) {
    const url =
      page === 1
        ? `https://govdoc.lk/category/term-test-papers/${slug}`
        : `https://govdoc.lk/category/term-test-papers/${slug}?page=${page}`;

    try {
      const res = await axios.get(url, { headers });
      const $ = cheerio.load(res.data);

      const cards = $("a.custom-card");
      if (cards.length === 0) break;

      let newPosts = 0;

      cards.each((_, el) => {
        const link = $(el).attr("href");
        const title = $(el).find("h5.cate-title").text().trim();

        if (link && title && !posts.find(p => p.link === link)) {
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

// Common handler for selection step
cmd(
  {
    filter: (text, { sender }) =>
      pendingRequests[sender] && 
      pendingRequests[sender].step === "select" && 
      /^\d+$/.test(text.trim()),
  },
  async (robin, mek, m, { from, body, sender, reply }) => {
    const pending = pendingRequests[sender];
    const selected = parseInt(body.trim());

    if (selected < 1 || selected > pending.results.length) {
      return reply("❌ Invalid selection. Please reply with a valid number.");
    }

    const selectedResult = pending.results[selected - 1];

    try {
      const pageData = await fetchLanguageOptions(selectedResult.link);
      
      if (!pageData.languages.length) {
        delete pendingRequests[sender];
        return reply("⚠️ No language options found for this paper.");
      }

      let langMsg = `🌐 *Available Languages for:* _${pageData.title}_\n\n`;
      pageData.languages.forEach((l, i) => {
        langMsg += `*${i + 1}.* ${l.lang}\n`;
      });
      langMsg += `\n_Reply with a number (1-${pageData.languages.length}) to download._`;

      pendingRequests[sender] = {
        type: pending.type,
        step: "download",
        selected: selectedResult,
        title: pageData.title,
        languages: pageData.languages,
        quoted: pending.quoted,
      };

      reply(langMsg);
    } catch (e) {
      console.error(e);
      reply("⚠️ Failed to fetch language options. Please try again.");
      delete pendingRequests[sender];
    }
  }
);

// Common handler for download step
cmd(
  {
    filter: (text, { sender }) =>
      pendingRequests[sender] && 
      pendingRequests[sender].step === "download" && 
      /^\d+$/.test(text.trim()),
  },
  async (robin, mek, m, { from, sender, body, reply }) => {
    const pending = pendingRequests[sender];
    const selected = parseInt(body.trim());

    if (selected < 1 || selected > pending.languages.length) {
      return reply("❌ Invalid selection.");
    }

    const lang = pending.languages[selected - 1];
    const typePrefix = pending.type === "al-papers" ? "al-papers" : 
                     pending.type === "govdoc" ? "govdoc" : "olpaper";

    try {
      await reply("⏳ Downloading PDF... Please wait.");
      await downloadAndSendPDF(
        robin,
        lang.link,
        pending.title || pending.selected.title,
        lang.lang,
        from,
        pending.quoted,
        sender,
        typePrefix
      );
    } catch (e) {
      reply("⚠️ Failed to download PDF. It may have timed out or failed to start.");
      delete pendingRequests[sender];
    }
  }
);
