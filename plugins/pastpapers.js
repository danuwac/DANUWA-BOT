const { cmd } = require('../command');
const axios = require('axios');
const cheerio = require('cheerio');

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'Accept': 'text/html,application/xhtml+xml',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://google.com',
};

async function fetchEkalviPapers(query) {
  try {
    const slug = query.trim().toLowerCase().replace(/\s+/g, '-');
    const url = `https://e-kalvi.com/${slug}-papers/`;
    const res = await axios.get(url, { headers });
    const $ = cheerio.load(res.data);

    const papers = [];
    $('h2, h3').each((_, heading) => {
      const term = $(heading).text().toLowerCase();
      if (
        term.includes('1st term papers') ||
        term.includes('2nd term papers') ||
        term.includes('3rd term papers')
      ) {
        // Next UL after heading
        $(heading).nextAll('ul').first().find('li a').each((__, el) => {
          const title = $(el).text().trim();
          const link = $(el).attr('href');
          if (link && link.endsWith('.pdf')) {
            papers.push({
              term: term.replace(' papers', '').toUpperCase(),
              title,
              link
            });
          }
        });
      }
    });
    return papers;
  } catch (err) {
    console.error('❌ E-Kalvi scrape error:', err.message);
    return [];
  }
}

cmd({
  pattern: 'ekalvi',
  alias: ['papers', 'gpaper'],
  use: '.ekalvi <grade subject>',
  desc: 'Download term test / exam papers from e‑kalvi.com',
  category: 'education',
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  if (!q) return reply('📚 Usage: `.ekalvi grade 11 english`');
  await m.react('📘');

  const papers = await fetchEkalviPapers(q);
  if (!papers.length) return reply('❌ No papers found. Check your grade/subject.');

  let msg = `📘 *E-KALVI PAPERS*\n────────────────────\n`;
  papers.forEach((p, i) => {
    msg += `*${i+1}.* [${p.term}] ${p.title}\n`;
  });
  msg += `\n_Reply with a number to download._`;

  const sent = await conn.sendMessage(from, { text: msg }, { quoted: mek });

  conn.ev.on('messages.upsert', async upd => {
    const msg1 = upd.messages[0];
    if (!msg1.message?.extendedTextMessage) return;

    const num = parseInt(msg1.message.extendedTextMessage.text.trim()) - 1;
    const isReply = msg1.message.extendedTextMessage.contextInfo?.stanzaId === sent.key.id;
    if (!isReply || isNaN(num) || num < 0 || num >= papers.length) return;

    const sel = papers[num];
    await conn.sendMessage(from, { react: { text: '⬇️', key: msg1.key } });
    await conn.sendMessage(
      from,
      {
        document: { url: sel.link },
        mimetype: 'application/pdf',
        fileName: `${sel.term} - ${sel.title}.pdf`,
        caption: `✅ *${sel.term}* • ${sel.title}`
      },
      { quoted: msg1 }
    );
    await conn.sendMessage(from, { react: { text: '✅', key: msg1.key } });
  });
});
