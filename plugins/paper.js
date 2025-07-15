const { cmd } = require("../command");
const axios = require("axios");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const os = require("os");

const headers = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36",
  "Accept-Language": "en-US,en;q=0.9",
};

const pendingRequests = {};

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
  try {
    const res = await axios.get(url, { headers, timeout: 10000 });
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
  } catch (e) {
    console.error("Error fetching language options:", e.message);
    return { title: "", languages: [] };
  }
}

async function downloadAndSendPDF(robin, link, title, lang, from, mek, sender, typePrefix) {
  const downloadDir = path.join(os.tmpdir(), `${typePrefix}-${Date.now()}`);

  try {
    fs.mkdirSync(downloadDir, { recursive: true });

    const browser = await puppeteer.launch({
      headless: "new",
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--single-process",
        "--disable-gpu"
      ],
      executablePath: process.env.PUPPETEER_EXECUTABLE_PATH || puppeteer.executablePath(),
    });

    const page = await browser.newPage();
    await page.setUserAgent(headers["User-Agent"]);
    await page.setExtraHTTPHeaders(headers);
    
    await page._client().send("Page.setDownloadBehavior", {
      behavior: "allow",
      downloadPath: downloadDir,
    });

    console.log(`Navigating to: ${link}`);
    await page.goto(link, { 
      waitUntil: "networkidle2", 
      timeout: 60000 
    });

    // Try multiple selectors for download button
    const downloadBtn = await page.waitForSelector(
      'a.btn.w-100[href*="/download/"], a[href*="/download/"]', 
      { timeout: 30000, visible: true }
    );

    if (!downloadBtn) {
      throw new Error("Download button not found");
    }

    const downloadUrl = await page.evaluate((btn) => btn.href, downloadBtn);
    console.log(`Found download URL: ${downloadUrl}`);

    // Direct download approach
    await page.goto(downloadUrl, { waitUntil: "networkidle0", timeout: 60000 });

    // Wait longer for O/L papers (40 seconds)
    const maxWaitTime = typePrefix === "olpaper" ? 40 : 20;
    let fileName;
    for (let i = 0; i < maxWaitTime; i++) {
      const files = fs.readdirSync(downloadDir).filter(f => f.endsWith(".pdf"));
      if (files.length > 0) {
        fileName = files[0];
        const filePath = path.join(downloadDir, fileName);
        const stats = fs.statSync(filePath);
        if (stats.size > 1024) { // Check file is not empty
          break;
        }
      }
      await new Promise(res => setTimeout(res, 1000));
    }

    await browser.close();

    if (!fileName) {
      throw new Error("Download did not complete in time");
    }

    const filePath = path.join(downloadDir, fileName);
    const buffer = fs.readFileSync(filePath);
    const niceName = `${title.replace(/[^\w\s.-]/gi, '')} - ${lang.lang}.pdf`;

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
    try {
      if (fs.existsSync(downloadDir)) {
        fs.rmSync(downloadDir, { recursive: true, force: true });
      }
    } catch (cleanupErr) {
      console.error("Cleanup failed:", cleanupErr.message);
    }
    throw e;
  }
}

// Command: .pastpapers - A/L past papers (unchanged)
cmd({/* ... keep existing A/L command ... */});

// Command: .govdoc - Term test papers (unchanged)
cmd({/* ... keep existing term test command ... */});

// Command: .pastol - O/L past papers (updated version)
cmd(
  {
    pattern: "pastol",
    desc: "Download O/L past papers by year and subject",
    category: "education",
    react: "📄",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, sender, reply }) => {
    if (!q) return reply("❌ Usage: `.pastol <year> <subject>`\nExample: `.pastol 2020 ict`");

    const parts = q.trim().toLowerCase().split(/\s+/);
    if (parts.length < 2) return reply("❌ You must provide both year and subject.");

    const year = parts[0];
    const rawSubject = parts.slice(1).join("-").replace(/\s+/g, "-");
    const subjectSlug = subjectAliases[rawSubject] || rawSubject;

    // Try multiple URL patterns for O/L papers
    const urlPatterns = [
      `https://govdoc.lk/gce-ordinary-level-exam-${year}-${subjectSlug}-past-papers`,
      `https://govdoc.lk/gce-ordinary-level-exam-${year}-${subjectSlug}`,
      `https://govdoc.lk/${year}-gce-ordinary-level-exam-${subjectSlug}-past-papers`,
      `https://govdoc.lk/ordinary-level-exam-${year}-${subjectSlug}-past-papers`,
      `https://govdoc.lk/gce-ordinary-level-exam-${year}-${parseInt(year) + 1}-${subjectSlug}-past-papers`,
    ];

    let pageData;
    let finalUrl;

    for (const url of urlPatterns) {
      try {
        console.log(`Trying URL: ${url}`);
        pageData = await fetchLanguageOptions(url);
        if (pageData.languages.length) {
          finalUrl = url;
          break;
        }
      } catch (e) {
        console.log(`Failed with URL ${url}:`, e.message);
      }
    }

    if (!pageData || !pageData.languages.length) {
      return reply("❌ Past paper not found. Please check:\n- Year (2010-2023)\n- Subject name\nOr try an alternative subject name");
    }

    const msgLines = [
      `📄 *${pageData.title}*`,
      `\n🌐 *Available Languages:*`,
      ...pageData.languages.map((l, i) => `*${i + 1}.* ${l.lang}`),
      `\n_Reply with number (1-${pageData.languages.length}) to download._`
    ];

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

// Common handler for download step (updated to handle all types)
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
      await reply("⏳ Downloading PDF... Please wait (may take up to 30 seconds)");
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

// Keep all other existing handlers and helper functions
// ... (govdoc posts fetcher, etc.)
