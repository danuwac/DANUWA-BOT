const { cmd } = require('../command');
const axios = require('axios');
const cheerio = require('cheerio');

const pendingGovDoc = {}; // 🔐 Reply context tracker

const headers = {
  'User-Agent': 'Mozilla/5.0',
  'Accept-Language': 'en-US,en;q=0.9',
};

// 🔍 Step 1: Fetch paper links
async function fetchGovdocPosts(gradeSlug) {
  const url = `https://govdoc.lk/category/term-test-papers/${gradeSlug}`;
  const res = await axios.get(url, { headers });
  const $ = cheerio.load(res.data);
  const posts = [];

  $('a.custom-card').each((_, el) => {
    if ($(el).closest('.info-body').length > 0) return; // skip related section
    const link = $(el).attr('href');
    const title = $(el).find('h5.cate-title').text().trim();
    if (link && title) posts.push({ title, link });
  });

  return posts.slice(0, 20); // limit to 20
}

// 🧠 Step 1: Search and store reply context
cmd({
  pattern: 'govdoc',
  use: '.govdoc grade 11',
  desc: 'Get term test papers from govdoc.lk',
  category: 'education',
  filename: __filename
}, async (conn, mek, m, { from, q }) => {
  if (!q) return m.reply('❌ Please provide a grade. Example: `.govdoc grade 11`');

  await m.react('📚');
  const gradeSlug = q.toLowerCase().replace(/\s+/g, '-');
  const posts = await fetchGovdocPosts(gradeSlug);

  if (!posts.length) return m.reply(`❌ No papers found for *${q}*`);

  let msg = `📚 *GovDoc ${q.toUpperCase()} Term Test Papers*\n────────────────────\n_Reply with number to choose a paper_\n\n`;
  posts.forEach((post, i) => {
    msg += `*${i + 1}.* ${post.title}\n`;
  });

  await conn.sendMessage(from, { text: msg }, { quoted: mek });

  // Save reply context
  pendingGovDoc[m.sender] = {
    step: "select",
    results: posts
  };
});

// 🧠 Step 2: Handle number reply for paper selection
cmd({
  filter: (m) => pendingGovDoc[m.sender] && pendingGovDoc[m.sender].step === "select"
}, async (conn, m, { reply }) => {
  const selected = parseInt(m.body.trim());
  const pending = pendingGovDoc[m.sender];

  if (isNaN(selected) || selected < 1 || selected > pending.results.length) {
    return reply("❌ Invalid selection. Try again.");
  }

  const selectedResult = pending.results[selected - 1];
  const { data } = await axios.get(selectedResult.link);
  const $ = cheerio.load(data);

  const languages = [];
  $('.btn-row a').each((_, el) => {
    const lang = $(el).find('button').text().trim();
    const href = $(el).attr('href');
    if (lang && href && href.includes('/view?id=')) {
      languages.push({
        lang,
        link: href.startsWith('http') ? href : `https://govdoc.lk${href}`
      });
    }
  });

  if (!languages.length) {
    delete pendingGovDoc[m.sender];
    return reply("⚠️ No language options found.");
  }

  let langMsg = `🌐 *Available Languages for:* _${selectedResult.title}_\n\n`;
  languages.forEach((l, i) => {
    langMsg += `*${i + 1}.* ${l.lang}\n`;
  });
  langMsg += `\n_Reply with a number (1-${languages.length}) to download._`;

  pendingGovDoc[m.sender] = {
    step: "download",
    selected: selectedResult,
    languages
  };

  reply(langMsg);
});

// 🧠 Step 3: Handle reply for language & send PDF
cmd({
  filter: (m) => pendingGovDoc[m.sender] && pendingGovDoc[m.sender].step === "download"
}, async (conn, m, { reply }) => {
  const selected = parseInt(m.body.trim());
  const pending = pendingGovDoc[m.sender];

  if (isNaN(selected) || selected < 1 || selected > pending.languages.length) {
    return reply("❌ Invalid selection.");
  }

  const lang = pending.languages[selected - 1];

  // Scrape download page
  try {
    const { data } = await axios.get(lang.link, { headers });
    const $ = cheerio.load(data);
    const downloadUrl = $(".cart-button a.btn").attr("href");

    if (!downloadUrl || !downloadUrl.includes('/download/')) {
      throw new Error("Download link not found");
    }

    await conn.sendMessage(m.chat, {
      document: { url: downloadUrl },
      mimetype: "application/pdf",
      fileName: `${pending.selected.title} - ${lang.lang}.pdf`
    }, { quoted: m });

  } catch (e) {
    reply("⚠️ Failed to fetch or send PDF.");
  }

  delete pendingGovDoc[m.sender]; // Cleanup
});
