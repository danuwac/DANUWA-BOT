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

// Subject aliases for user convenience
const subjectAliases = {
  commerce: "business accounting studies",
  ict: "information communication technology",
  hist: "history",
  geo: "geography",
  eng: "english language",
  sinh: "sinhala",
  tam: "tamil",
  home: "home economics",
  agri: "agriculture",
  liteng: "literature english",
  litsin: "literature sinhala",
  littam: "literature tamil",
  dmt: "design mechanical technology",
  dct: "design construction technology",
  civ: "civic education",
  media: "communication and media studies",
  dance: "dance",
  health: "health physical education",
};

const pendingGovDoc = {};

// Helper function: checks if all words in subjectAlias appear in title (flexible match)
function subjectMatch(title, subjectAlias) {
  const clean = (str) =>
    str
      .toLowerCase()
      .replace(/[&.,\-]/g, " ")
      .replace(/\s+/g, " ")
      .trim();

  const cleanTitle = clean(title);
  const cleanSubject = clean(subjectAlias);

  return cleanSubject
    .split(" ")
    .every((word) => word && cleanTitle.includes(word));
}

// Fetch posts from grade page, filter by subject inside <h5.cate-title>
async function fetchGovdocPosts(grade, subject) {
  const baseUrl = `https://govdoc.lk/category/term-test-papers/grade-${grade}/`;
  const posts = [];
  let page = 1;

  while (true) {
    const url = page === 1 ? baseUrl : `${baseUrl}page/${page}/`;
    try {
      const res = await axios.get(url, { headers });
      const $ = cheerio.load(res.data);

      const cards = $("a.custom-card");
      if (cards.length === 0) break;

      let newPostsCount = 0;

      cards.each((_, el) => {
        const title = $(el).find("h5.cate-title").text().trim();
        const link = $(el).attr("href");

        if (
          link &&
          title &&
          subjectMatch(title, subject) &&
          !posts.find((p) => p.link === link)
        ) {
          posts.push({ title, link });
          newPostsCount++;
        }
      });

      if (newPostsCount === 0) break;

      page++;
    } catch (e) {
      console.error("Fetch error:", e.message);
      break;
    }
  }

  return posts;
}

// Download PDF with Puppeteer, returns filepath or null
async function downloadPDF(url) {
  const downloadDir = path.join(os.tmpdir(), `govdoc-${Date.now()}`);
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

  await page.goto(url, { waitUntil: "networkidle2", timeout: 30000 });
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

  if (!fileName) {
    fs.rmdirSync(downloadDir);
    return null;
  }

  return path.join(downloadDir, fileName);
}

// Step 1: Command to list papers by grade + subject
cmd(
  {
    pattern: "govdoc",
    react: "📚",
    desc: "Get term test papers by grade + subject",
    category: "education",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, sender, reply }) => {
    if (!q) return reply("❌ Usage: `.govdoc grade 11 commerce` or `.govdoc 11 ict`");

    const input = q.trim().toLowerCase().split(/\s+/);
    let grade = "";
    let subject = "";

    if (input[0] === "grade" && /^\d+$/.test(input[1])) {
      grade = input[1];
      subject = input.slice(2).join(" ").trim();
    } else if (/^\d+$/.test(input[0])) {
      grade = input[0];
      subject = input.slice(1).join(" ").trim();
    } else {
      return reply("❌ Invalid format. Example: `.govdoc grade 11 commerce`");
    }

    if (!subject) return reply("❌ Please specify a subject.");

    // Map alias to real subject name if exists
    subject = subjectAliases[subject] || subject;

    await m.react("📚");
    reply(`🔍 Searching Grade ${grade} papers for subject: *${subject}* ...`);

    const posts = await fetchGovdocPosts(grade, subject);
    if (posts.length === 0)
      return reply(`❌ No papers found for *${subject}* in grade ${grade}.`);

    let msg = `📚 *GovDoc Grade ${grade} - ${subject.toUpperCase()} Term Test Papers*\n────────────────────\n_Reply with paper number to download_\n\n`;

    posts.forEach((post, i) => {
      const reg = new RegExp(`(${subject})`, "ig");
      let title = post.title.replace(reg, "*$1*");
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

// Step 2: User replies with number to download
cmd(
  {
    filter: (text, { sender }) =>
      pendingGovDoc[sender] && pendingGovDoc[sender].step === "select" && /^\d+$/.test(text.trim()),
  },
  async (robin, mek, m, { from, body, sender, reply }) => {
    const pending = pendingGovDoc[sender];
    if (!pending) return;

    const selected = parseInt(body.trim());
    if (selected < 1 || selected > pending.results.length) {
      return reply("❌ Invalid selection.");
    }

    const selectedResult = pending.results[selected - 1];

    reply(`⏬ Downloading *${selectedResult.title}* ... Please wait.`);

    try {
      const filePath = await downloadPDF(selectedResult.link);
      if (!filePath) throw new Error("Download failed");

      const pdfBuffer = fs.readFileSync(filePath);
      await robin.sendMessage(
        from,
        {
          document: pdfBuffer,
          mimetype: "application/pdf",
          fileName: `${selectedResult.title}.pdf`,
        },
        { quoted: mek }
      );

      fs.unlinkSync(filePath);
      fs.rmdirSync(path.dirname(filePath));
    } catch (e) {
      console.error("Download error:", e);
      reply("⚠️ Failed to download PDF. Please try again later.");
    }

    delete pendingGovDoc[sender];
  }
);
