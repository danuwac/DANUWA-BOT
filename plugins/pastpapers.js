const { cmd } = require('../command');
const axios = require('axios');
const cheerio = require('cheerio');

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function fetchValidTermLinks(query) {
  try {
    const cleanQuery = query.trim().toLowerCase().replace(/\s+/g, '-');
    const url = `https://pastpapers.wiki/${cleanQuery}-term-test-papers/`;
    const res = await axios.get(url, { headers });
    const $ = cheerio.load(res.data);

    const results = [];
    $('ul li a').each((_, el) => {
      const title = $(el).text().trim();
      const href = $(el).attr('href');
      if (title && href && href.includes("term-test")) {
        results.push({ title, url: href });
      }
    });

    return results;
  } catch (err) {
    console.error("❌ Scrape Error:", err.message);
    return [];
  }
}

cmd({
  pattern: 'termtest',
  alias: ['pastpaper', 'papers'],
  use: '.termtest grade 13 biology',
  desc: 'Download Sri Lankan term test papers',
  category: 'education',
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  if (!q) return reply("📚 Please enter something like `.termtest grade 13 biology`");

  await m.react("🔍");

  const papers = await fetchValidTermLinks(q);
  if (!papers.length) return reply("❌ No term test papers found for this subject.");

  let msg = `📚 *TERM TEST PAPERS FOUND*\n──────────────────────\n_Reply with the number to download_\n\n`;
  papers.forEach((p, i) => {
    msg += `*${i + 1}.* ${p.title}\n`;
  });

  const sent = await conn.sendMessage(from, { text: msg }, { quoted: mek });

  conn.ev.on("messages.upsert", async (msgUpdate) => {
    const msg1 = msgUpdate.messages[0];
    if (!msg1.message?.extendedTextMessage) return;

    const replyText = msg1.message.extendedTextMessage.text.trim();
    const isReply = msg1.message.extendedTextMessage.contextInfo?.stanzaId === sent.key.id;
    const selected = parseInt(replyText) - 1;

    if (!isReply || selected < 0 || selected >= papers.length) return;

    await conn.sendMessage(from, { react: { text: "📥", key: msg1.key } });

    await conn.sendMessage(from, {
      document: { url: papers[selected].url },
      mimetype: "application/pdf",
      fileName: `${papers[selected].title}.pdf`,
      caption: `✅ *${papers[selected].title}*\n📄 Term test paper sent successfully.`,
    }, { quoted: msg1 });

    await conn.sendMessage(from, { react: { text: "✅", key: msg1.key } });
  });
});
