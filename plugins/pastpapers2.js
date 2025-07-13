const { cmd } = require("../command");
const axios = require("axios");
const cheerio = require("cheerio");

const headers = {
  "User-Agent": "Mozilla/5.0",
  "Accept-Language": "en-US,en;q=0.9",
};

const pendingGovDoc = {};

// Step 1: Search papers by grade
async function fetchGovdocPosts(gradeSlug) {
  const url = `https://govdoc.lk/category/term-test-papers/${gradeSlug}`;
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

// Step 2: Get languages for selected paper
async function fetchLanguages(postUrl) {
  const { data } = await axios.get(postUrl, { headers });
  const $ = cheerio.load(data);
  const languages = [];

  $(".btn-row a").each((_, el) => {
    const lang = $(el).find("button").text().trim();
    const href = $(el).attr("href");
    if (lang && href && href.includes("/view?id=")) {
      languages.push({
        lang,
        link: href.startsWith("http") ? href : `https://govdoc.lk${href}`,
      });
    }
  });

  return languages;
}

// Step 3: Extract download link and send PDF
async function downloadAndSendPDF(robin, mek, from, selected, lang) {
  const res = await axios.get(lang.link, { headers });
  const $ = cheerio.load(res.data);

  let downloadUrl = null;

  $("a").each((_, el) => {
    const href = $(el).attr("href");
    if (href && href.includes("/download/")) {
      downloadUrl = href.startsWith("http") ? href : `https://govdoc.lk${href}`;
      return false; // break loop
    }
  });

  if (!downloadUrl) throw new Error("Download link not found");

  const fileRes = await axios.get(downloadUrl, {
    headers,
    responseType: "arraybuffer",
  });

  await robin.sendMessage(
    from,
    {
      document: Buffer.from(fileRes.data),
      mimetype: "application/pdf",
      fileName: `${selected.title} - ${lang.lang}.pdf`,
    },
    { quoted: mek }
  );
}

// Command handler
cmd(
  {
    pattern: "govdoc",
    desc: "Download term test papers from govdoc.lk",
    category: "education",
    react: "📚",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, sender, reply }) => {
    if (!q) return reply("❌ Please provide a grade. Example: `.govdoc grade 11`");

    const slug = q.toLowerCase().replace(/\s+/g, "-");
    const papers = await fetchGovdocPosts(slug);

    if (!papers.length) return reply("❌ No test papers found for the given grade.");

    let msg = `📚 *GovDoc ${q.toUpperCase()} Term Test Papers*\n────────────────────\n_Reply with number to select paper_\n\n`;
    papers.forEach((p, i) => {
      msg += `*${i + 1}.* ${p.title}\n`;
    });

    await robin.sendMessage(from, { text: msg }, { quoted: mek });

    pendingGovDoc[sender] = {
      step: "select",
      papers,
      quoted: mek,
    };
  }
);

// Step 2: User selects paper number
cmd(
  {
    filter: (text, { sender }) =>
      pendingGovDoc[sender] &&
      pendingGovDoc[sender].step === "select" &&
      /^\d+$/.test(text.trim()),
  },
  async (robin, mek, m, { from, body, sender, reply }) => {
    const pending = pendingGovDoc[sender];
    const selectedIndex = parseInt(body.trim()) - 1;

    if (selectedIndex < 0 || selectedIndex >= pending.papers.length) {
      return reply("❌ Invalid selection. Try again.");
    }

    const selected = pending.papers[selectedIndex];
    const languages = await fetchLanguages(selected.link);

    if (!languages.length) {
      delete pendingGovDoc[sender];
      return reply("⚠️ No language options found.");
    }

    let msg = `🌐 *Available Languages for:* _${selected.title}_\n\n`;
    languages.forEach((l, i) => {
      msg += `*${i + 1}.* ${l.lang}\n`;
    });
    msg += `\n_Reply with a number (1-${languages.length}) to download._`;

    pendingGovDoc[sender] = {
      step: "download",
      selected,
      languages,
      quoted: mek,
    };

    reply(msg);
  }
);

// Step 3: User selects language and gets PDF
cmd(
  {
    filter: (text, { sender }) =>
      pendingGovDoc[sender] &&
      pendingGovDoc[sender].step === "download" &&
      /^\d+$/.test(text.trim()),
  },
  async (robin, mek, m, { from, body, sender, reply }) => {
    const pending = pendingGovDoc[sender];
    const langIndex = parseInt(body.trim()) - 1;

    if (langIndex < 0 || langIndex >= pending.languages.length) {
      return reply("❌ Invalid selection. Try again.");
    }

    try {
      const lang = pending.languages[langIndex];
      await downloadAndSendPDF(robin, mek, from, pending.selected, lang);
    } catch (e) {
      console.error(e);
      reply("⚠️ Failed to fetch or send PDF.");
    }

    delete pendingGovDoc[sender];
  }
);
