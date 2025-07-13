const { cmd } = require('../command');
const axios = require('axios');
const cheerio = require('cheerio');

const headers = {
  'User-Agent': 'Mozilla/5.0',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function fetchGovdocPosts(gradeSlug) {
  const url = `https://govdoc.lk/category/term-test-papers/${gradeSlug}`;
  const res = await axios.get(url, { headers });
  const $ = cheerio.load(res.data);
  const posts = [];

  // Select only .custom-card <a> NOT inside .info-body (related section)
  $('a.custom-card').each((_, el) => {
    // Skip if inside .info-body (related)
    if ($(el).closest('.info-body').length > 0) return;

    const link = $(el).attr('href');
    const title = $(el).find('h5.cate-title').text().trim();
    if (link && title) {
      posts.push({ title, link });
    }
  });

  return posts.slice(0, 20); // top 20 results only
}

cmd({
  pattern: 'govdoc',
  use: '.govdoc grade 11',
  desc: 'Get term test papers from govdoc.lk',
  category: 'education',
  filename: __filename
}, async (conn, mek, m, { from, q }) => {
  if (!q) return m.reply('❌ Please provide a grade. Example: .govdoc grade 11');

  await m.react('📚');

  const gradeSlug = q.toLowerCase().replace(/\s+/g, '-'); // "grade 11" -> "grade-11"
  const posts = await fetchGovdocPosts(gradeSlug);

  if (!posts.length) return m.reply(`❌ No papers found for *${q}*`);

  let msg = `📚 *GovDoc ${q.toUpperCase()} Term Test Papers*\n────────────────────\n_Reply with number to download_\n\n`;
  posts.forEach((post, i) => {
    msg += `*${i + 1}.* ${post.title}\n`;
  });

  await conn.sendMessage(from, { text: msg }, { quoted: mek });

  // 🛑 Step 2 (reply and download) comes next
});
cmd({
  filter: (m) => pendingGovDoc[m.sender] && pendingGovDoc[m.sender].step === "select",
}, async (conn, m, { reply }) => {
  const selected = parseInt(m.body.trim());
  const pending = pendingGovDoc[m.sender];
  if (isNaN(selected) || selected < 1 || selected > pending.results.length) {
    return reply("❌ Invalid selection.");
  }

  const selectedResult = pending.results[selected - 1];
  const { data } = await axios.get(selectedResult.url);
  const $ = cheerio.load(data);

  const languages = [];

  $(".btn-row a").each((i, el) => {
    const lang = $(el).find("button").text().trim();
    const href = $(el).attr("href");
    if (lang && href && href.includes("govdoc.lk/view")) {
      languages.push({ lang, link: href.startsWith("http") ? href : `https://govdoc.lk${href}` });
    }
  });

  if (!languages.length) {
    delete pendingGovDoc[m.sender];
    return reply("⚠️ No available language downloads found.");
  }

  let msg = `📄 *Available Languages for:* _${selectedResult.title}_\n\n`;
  languages.forEach((l, i) => {
    msg += `${i + 1}. ${l.lang}\n`;
  });
  msg += `\n_Reply with a number (1-${languages.length}) to download._`;

  pendingGovDoc[m.sender] = {
    step: "download",
    selected: selectedResult,
    languages
  };

  reply(msg);
});

// STEP 3: User selects language
cmd({
  filter: (m) => pendingGovDoc[m.sender] && pendingGovDoc[m.sender].step === "download",
}, async (conn, m, { reply }) => {
  const selected = parseInt(m.body.trim());
  const pending = pendingGovDoc[m.sender];
  if (isNaN(selected) || selected < 1 || selected > pending.languages.length) {
    return reply("❌ Invalid selection.");
  }

  const lang = pending.languages[selected - 1];

  try {
    await conn.sendMessage(m.chat, {
      document: { url: lang.link },
      mimetype: "application/pdf",
      fileName: `${pending.selected.title} - ${lang.lang}.pdf`
    }, { quoted: m });
  } catch (e) {
    reply("⚠️ Failed to send the PDF. Try again.");
  }

  delete pendingGovDoc[m.sender];
});
