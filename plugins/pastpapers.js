const { cmd } = require('../command');
const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://e-kalvi.com/category/gce-o-l/';
const headers = {
  'User-Agent': 'Mozilla/5.0',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function getPostLinks() {
  const res = await axios.get(BASE_URL, { headers });
  const $ = cheerio.load(res.data);

  const posts = [];
  $('article a').each((_, el) => {
    const link = $(el).attr('href');
    const title = $(el).attr('title') || $(el).text().trim();
    if (link && title && link.includes('2024-ol-')) {
      posts.push({ title, link });
    }
  });

  // Remove duplicates
  const unique = Array.from(new Map(posts.map(p => [p.link, p])).values());
  return unique.slice(0, 15); // limit to 15 posts for performance
}

async function extractPdfFromPost(postUrl) {
  const res = await axios.get(postUrl, { headers });
  const $ = cheerio.load(res.data);

  const pdfs = [];
  $('a').each((_, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim();
    if (href && href.endsWith('.pdf')) {
      pdfs.push({ name: text || "Download", url: href });
    }
  });

  return pdfs;
}

cmd({
  pattern: 'ekalviol',
  alias: ['olpapers'],
  use: '.ekalviol',
  desc: 'Get O/L Past Papers from e-kalvi.com',
  category: 'education',
  filename: __filename,
}, async (conn, mek, m, { from, reply }) => {
  await m.react('📚');
  const posts = await getPostLinks();
  if (!posts.length) return reply("❌ No posts found from e-kalvi O/L page.");

  let msg = `📘 *E-KALVI O/L PAPERS*\n────────────────────\n_Reply with a number to download PDF_\n\n`;
  posts.forEach((post, i) => {
    msg += `*${i + 1}.* ${post.title}\n`;
  });

  const sent = await conn.sendMessage(from, { text: msg }, { quoted: mek });

  conn.ev.on("messages.upsert", async (msgUpdate) => {
    const msg1 = msgUpdate.messages[0];
    if (!msg1.message?.extendedTextMessage) return;

    const replyText = msg1.message.extendedTextMessage.text.trim();
    const isReply = msg1.message.extendedTextMessage.contextInfo?.stanzaId === sent.key.id;
    const selected = parseInt(replyText) - 1;

    if (!isReply || isNaN(selected) || selected < 0 || selected >= posts.length) return;

    await conn.sendMessage(from, { react: { text: "🔄", key: msg1.key } });

    const chosen = posts[selected];
    const pdfs = await extractPdfFromPost(chosen.link);

    if (!pdfs.length) {
      await reply(`❌ No PDF found in: ${chosen.title}`);
      return;
    }

    for (let pdf of pdfs) {
      await conn.sendMessage(from, {
        document: { url: pdf.url },
        mimetype: "application/pdf",
        fileName: `${pdf.name}.pdf`,
        caption: `✅ *${chosen.title}*\n📄 ${pdf.name}`,
      }, { quoted: msg1 });
    }

    await conn.sendMessage(from, { react: { text: "✅", key: msg1.key } });
  });
});
