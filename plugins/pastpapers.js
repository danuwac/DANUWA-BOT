const { cmd } = require('../command');
const axios = require('axios');
const cheerio = require('cheerio');

const headers = {
  'User-Agent': 'Mozilla/5.0',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function getEkalviPosts(baseUrl, filter) {
  const res = await axios.get(baseUrl, { headers });
  const $ = cheerio.load(res.data);
  const posts = [];

  $('article').each((_, el) => {
    const link = $(el).find('a').first().attr('href');
    const title = $(el).find('.entry-title a').text().trim();
    if (link && title) {
      if (!filter || title.toLowerCase().includes(filter.toLowerCase())) {
        posts.push({ title, link });
      }
    }
  });

  return posts.slice(0, 20); // return latest 20 posts
}

async function extractGoogleDriveLinks(postUrl) {
  const res = await axios.get(postUrl, { headers });
  const $ = cheerio.load(res.data);
  const pdfs = [];

  $('blockquote a').each((_, el) => {
    const href = $(el).attr('href');
    const text = $(el).text().trim();
    if (href && href.includes('drive.google.com')) {
      pdfs.push({ name: text || "Download PDF", url: href });
    }
  });

  return pdfs;
}

async function handleCommand(conn, mek, m, from, commandType, query) {
  const base = commandType === 'ol'
    ? 'https://e-kalvi.com/category/gce-o-l/'
    : 'https://e-kalvi.com/category/gce-a-l/';

  const posts = await getEkalviPosts(base, query);
  if (!posts.length) return m.reply('❌ No posts found for that category/language.');

  let msg = `📘 *E-KALVI ${commandType.toUpperCase()} PAPERS*\n────────────────────\n_Reply with number to download_\n\n`;
  posts.forEach((p, i) => {
    msg += `*${i + 1}.* ${p.title}\n`;
  });

  const sent = await conn.sendMessage(from, { text: msg }, { quoted: mek });

  conn.ev.on("messages.upsert", async (msgUpdate) => {
    const msg1 = msgUpdate.messages[0];
    if (!msg1.message?.extendedTextMessage) return;

    const text = msg1.message.extendedTextMessage.text.trim();
    const isReply = msg1.message.extendedTextMessage.contextInfo?.stanzaId === sent.key.id;
    const selected = parseInt(text) - 1;

    if (!isReply || isNaN(selected) || selected < 0 || selected >= posts.length) return;

    const post = posts[selected];
    await conn.sendMessage(from, { react: { text: "⏳", key: msg1.key } });

    const files = await extractGoogleDriveLinks(post.link);
    if (!files.length) {
      await conn.sendMessage(from, {
        text: `❌ No download links found in *${post.title}*`,
        quoted: msg1
      });
      return;
    }

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
}

// 🔹 .ekalviol (O/L)
cmd({
  pattern: 'ekalviol',
  use: '.ekalviol [tamil|english|sinhala]',
  desc: 'Get O/L past papers from e-kalvi.com',
  category: 'education',
  filename: __filename
}, async (conn, mek, m, { from, q }) => {
  await m.react('📘');
  return handleCommand(conn, mek, m, from, 'ol', q);
});

// 🔹 .ekalvial (A/L)
cmd({
  pattern: 'ekalvial',
  use: '.ekalvial [tamil|english|sinhala]',
  desc: 'Get A/L past papers from e-kalvi.com',
  category: 'education',
  filename: __filename
}, async (conn, mek, m, { from, q }) => {
  await m.react('📘');
  return handleCommand(conn, mek, m, from, 'al', q);
});
