const { cmd } = require("../command");
const axios = require("axios");
const cheerio = require("cheerio");

const headers = {
  "User-Agent": "Mozilla/5.0",
  "Accept-Language": "en-US,en;q=0.9",
};

const pendingGovDoc = {};

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

cmd({
  pattern: "govdoc",
  react: "📚",
  desc: "Download past papers from govdoc.lk",
  category: "education",
  filename: __filename,
}, async (robin, mek, m, { from, q, sender, reply }) => {
  if (!q) return reply("❌ Usage: .govdoc grade 11");

  await m.react("📖");
  const gradeSlug = q.toLowerCase().replace(/\s+/g, "-");
  const posts = await fetchGovdocPosts(gradeSlug);

  if (!posts.length) return reply("❌ No past papers found for that grade.");

  let msg = `📚 *Past Papers for ${q.toUpperCase()}*\n\n_Reply with a number to select paper:_\n\n`;
  posts.forEach((post, i) => {
    msg += `*${i + 1}.* ${post.title}\n`;
  });

  await robin.sendMessage(from, { text: msg }, { quoted: mek });

  pendingGovDoc[sender] = {
    step: "select",
    results: posts,
    quoted: mek,
  };
});

// Step 2: Language selection
cmd({
  filter: (text, { sender }) =>
    pendingGovDoc[sender] &&
    pendingGovDoc[sender].step === "select" &&
    /^\d+$/.test(text.trim()),
}, async (robin, mek, m, { body, sender, reply }) => {
  const pending = pendingGovDoc[sender];
  const selectedIndex = parseInt(body.trim()) - 1;

  if (selectedIndex < 0 || selectedIndex >= pending.results.length)
    return reply("❌ Invalid selection.");

  const selected = pending.results[selectedIndex];
  const res = await axios.get(selected.link, { headers });
  const $ = cheerio.load(res.data);

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

  if (!languages.length) {
    delete pendingGovDoc[sender];
    return reply("❌ No language options found.");
  }

  let msg = `🌐 *Select Language for:* _${selected.title}_\n\n`;
  languages.forEach((l, i) => {
    msg += `*${i + 1}.* ${l.lang}\n`;
  });
  msg += `\n_Reply with a number to download._`;

  pendingGovDoc[sender] = {
    step: "download",
    selected,
    languages,
  };

  reply(msg);
});

// Step 3: Download selected language
cmd({
  filter: (text, { sender }) =>
    pendingGovDoc[sender] &&
    pendingGovDoc[sender].step === "download" &&
    /^\d+$/.test(text.trim()),
}, async (robin, mek, m, { body, sender, reply }) => {
  const pending = pendingGovDoc[sender];
  const langIndex = parseInt(body.trim()) - 1;

  if (langIndex < 0 || langIndex >= pending.languages.length)
    return reply("❌ Invalid selection.");

  const lang = pending.languages[langIndex];

  try {
    // Follow to final download page
    const res = await axios.get(lang.link, { headers });
    const $ = cheerio.load(res.data);
    const downloadPageUrl = $(".cart-button a.btn").attr("href");

    if (!downloadPageUrl || !downloadPageUrl.includes("/download/")) {
      throw new Error("Download link not found");
    }

    // Now fetch the actual PDF file
    const file = await axios.get(downloadPageUrl, {
      headers,
      responseType: "arraybuffer",
    });

    await robin.sendMessage(m.chat, {
      document: Buffer.from(file.data),
      mimetype: "application/pdf",
      fileName: `${pending.selected.title} - ${lang.lang}.pdf`,
    }, { quoted: mek });

    delete pendingGovDoc[sender];
  } catch (e) {
    console.error(e);
    reply("❌ Failed to download the PDF.");
    delete pendingGovDoc[sender];
  }
});
