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
