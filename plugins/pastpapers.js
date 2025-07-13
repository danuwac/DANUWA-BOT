const { cmd } = require('../command');
const axios = require('axios');
const cheerio = require('cheerio');

// Advanced browser-like headers to bypass 403 blocks
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/115.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://google.com',
  'Connection': 'keep-alive',
  'Upgrade-Insecure-Requests': '1'
};

// 🔍 Scrape only 3rd term test papers
async function fetchThirdTermPapers(query) {
  try {
    const slug = query.trim().toLowerCase().replace(/\s+/g, '-');
    const url = `https://pastpapers.wiki/${slug}-term-test-papers/`;

    const res = await axios.get(url, { headers, maxRedirects: 5 });
    const $ = cheerio.load(res.data);

    let thirdTermSection;
    $('h4').each((_, h) => {
      const text = $(h).text().toLowerCase();
      if (text.includes("3rd term")) {
        thirdTermSection = $(h).parent().next().find('ul li a');
      }
    });

    if (!thirdTermSection || !thirdTermSection.length) return [];

    const results = [];
    thirdTermSection.each((_, a) => {
      const title = $(a).text().trim();
      const link = $(a).attr('href');
      if (title && link) results.push({ title, link });
    });

    return results;
  } catch (err) {
    console.error("❌ Scrape Error:", err.message);
    return [];
  }
}

cmd({
  pattern: 'termtest',
  alias: ['thirdterm', 'paper3'],
  use: '.termtest grade 11 english',
  desc: 'Download 3rd Term Test past papers (Sri Lanka)',
  category: 'education',
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  if (!q) return reply('📚 Please enter something like `.termtest grade 11 english`');
  await m.react("📘");

  const papers = await fetchThirdTermPapers(q);
  if (!papers.length) return reply("❌ No 3rd term papers found for your query.");

  let msg = `📘 *3rd TERM TEST PAPERS*\n──────────────────────\n_Reply with number to download_\n\n`;
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

    if (!isReply || isNaN(selected) || selected < 0 || selected >= papers.length) return;

    await conn.sendMessage(from, { react: { text: "⬇️", key: msg1.key } });

    await conn.sendMessage(from, {
      document: { url: papers[selected].link },
      mimetype: "application/pdf",
      fileName: `${papers[selected].title}.pdf`,
      caption: `✅ *${papers[selected].title}*\n📄 3rd Term test paper sent successfully.`,
    }, { quoted: msg1 });

    await conn.sendMessage(from, { react: { text: "✅", key: msg1.key } });
  });
});
