const { cmd } = require('../command');
const axios = require('axios');
const cheerio = require('cheerio');

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function getTermPapers(query) {
  try {
    const q = query.trim().toLowerCase().replace(/\s+/g, '-');
    const url = `https://pastpapers.wiki/${q}-term-test-papers/`;

    const res = await axios.get(url, { headers });
    const $ = cheerio.load(res.data);

    const papers = [];
    $('ul li a').each((_, el) => {
      const title = $(el).text().trim();
      const link = $(el).attr('href');
      if (title && link) papers.push({ title, link });
    });

    return papers;
  } catch (err) {
    console.error("❌ Error scraping term test page:", err.message);
    return [];
  }
}

cmd({
  pattern: 'pastpaper',
  alias: ['termtest', 'paper'],
  use: '.pastpaper <grade subject>',
  desc: 'Download term test past papers (Sri Lanka)',
  category: 'education',
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  if (!q) return reply('📚 Please provide a query like `grade 11 english`.');
  await m.react('📖');

  const papers = await getTermPapers(q);
  if (!papers.length) return reply('❌ No term test past papers found.');

  let msgText = `📚 *TERM TEST PAPERS*\n────────────────────\n_Reply with the number to download the paper_\n\n`;
  papers.forEach((p, i) => {
    msgText += `*${i + 1}.* ${p.title}\n`;
  });

  const sent = await conn.sendMessage(from, { text: msgText }, { quoted: mek });

  conn.ev.on("messages.upsert", async (msgUpdate) => {
    const msg1 = msgUpdate.messages[0];
    if (!msg1.message?.extendedTextMessage) return;

    const selectedText = msg1.message.extendedTextMessage.text.trim();
    const isReply = msg1.message.extendedTextMessage.contextInfo?.stanzaId === sent.key.id;
    const selected = parseInt(selectedText) - 1;

    if (!isReply || isNaN(selected) || selected < 0 || selected >= papers.length) return;

    await conn.sendMessage(from, { react: { text: '📥', key: msg1.key } });

    await conn.sendMessage(from, {
      document: { url: papers[selected].link },
      mimetype: "application/pdf",
      fileName: `${papers[selected].title}.pdf`,
      caption: `📄 *${papers[selected].title}*\n✅ Downloaded successfully.`,
    }, { quoted: msg1 });

    await conn.sendMessage(from, { react: { text: '✅', key: msg1.key } });
  });
});
