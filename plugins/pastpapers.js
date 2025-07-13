const { cmd } = require('../command');
const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = 'https://e-kalvi.com/category/gce-o-l/';
const headers = {
  'User-Agent': 'Mozilla/5.0',
  'Accept-Language': 'en-US,en;q=0.9',
};

// 🧠 Step 1: Get all post titles and links
async function getPostLinks() {
  const res = await axios.get(BASE_URL, { headers });
  const $ = cheerio.load(res.data);

  const posts = [];
  $('article').each((_, el) => {
    const link = $(el).find('a').first().attr('href');
    const title = $(el).find('.entry-title a').text().trim();
    if (link && title) {
      posts.push({ title, link });
    }
  });

  return posts.slice(0, 20); // Limit to 20 latest posts
}

// 🧠 Step 2: Inside each post, find Google Drive PDF link
async function extractPdfFromPost(postUrl) {
  const res = await axios.get(postUrl, { headers });
  const $ = cheerio.load(res.data);

  const pdfs = [];

  // Only check inside <blockquote> for safety
  $('blockquote a').each((_, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim();

    if (href && href.includes('drive.google.com')) {
      pdfs.push({ name: text || "Download PDF", url: href });
    }
  });

  return pdfs;
}

// 🔧 Register the command
cmd({
  pattern: 'ekalviol',
  alias: ['olpapers', 'kalviol'],
  use: '.ekalviol',
  desc: 'Download O/L Past Papers from e-kalvi.com',
  category: 'education',
  filename: __filename,
}, async (conn, mek, m, { from, reply }) => {
  await m.react('📘');
  const posts = await getPostLinks();
  if (!posts.length) return reply('❌ No past papers found from e-kalvi.com');

  let msg = `📘 *E-KALVI O/L PAPERS*\n────────────────────\n_Reply with a number to download_\n\n`;
  posts.forEach((p, i) => {
    msg += `*${i + 1}.* ${p.title}\n`;
  });

  const sent = await conn.sendMessage(from, { text: msg }, { quoted: mek });

  // 🧠 Handle reply
  conn.ev.on("messages.upsert", async (msgUpdate) => {
    const msg1 = msgUpdate.messages[0];
    if (!msg1.message?.extendedTextMessage) return;

    const text = msg1.message.extendedTextMessage.text.trim();
    const isReply = msg1.message.extendedTextMessage.contextInfo?.stanzaId === sent.key.id;
    const selected = parseInt(text) - 1;

    if (!isReply || isNaN(selected) || selected < 0 || selected >= posts.length) return;

    const post = posts[selected];
    await conn.sendMessage(from, { react: { text: "⏳", key: msg1.key } });

    const files = await extractPdfFromPost(post.link);
    if (!files.length) {
      await conn.sendMessage(from, {
        text: `❌ No download links found in *${post.title}*`,
        quoted: msg1
      });
      return;
    }

    // 🧾 Send all found PDF links
    for (const pdf of files) {
      await conn.sendMessage(from, {
        document: { url: pdf.url },
        mimetype: "application/pdf",
        fileName: `${pdf.name}.pdf`,
        caption: `✅ *${post.title}*\n📄 ${pdf.name}`,
      }, { quoted: msg1 });
    }

    await conn.sendMessage(from, { react: { text: "✅", key: msg1.key } });
  });
});
