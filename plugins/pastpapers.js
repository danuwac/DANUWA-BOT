const { cmd } = require('../command');
const axios = require('axios');
const cheerio = require('cheerio');

const BASE = 'https://pastpapers.wiki';
const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'Accept-Language': 'en-US,en;q=0.9',
};

async function fetchTermTest(query) {
  const q = encodeURIComponent(query.trim().toLowerCase().replace(/\s+/g, '-'));
  const url = `${BASE}/${q}-term-test-papers/`;
  const res = await axios.get(url, { headers });
  const $ = cheerio.load(res.data);
  
  const papers = [];
  $('h2 ~ ul li a').each((_, el) => {
    const title = $(el).text().trim();
    const link = $(el).attr('href');
    if (title && link) {
      papers.push({ title, url: link.startsWith('http') ? link : BASE + link });
    }
  });
  
  return papers;
}

async function getPDFurl(pageUrl) {
  const { data } = await axios.get(pageUrl, { headers });
  const $ = cheerio.load(data);
  const iframe = $('iframe').attr('src');
  return iframe && (iframe.startsWith('http') ? iframe : BASE + iframe);
}

cmd({
  pattern: 'pastpaper',
  alias: ['papers','exam'],
  use: '.pastpaper <subject/grade> term test',
  desc: 'Download Sri Lankan term test past papers',
  category: 'education',
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  if (!q) return reply('🔍 Please provide a query like "grade 11 english".');
  await m.react('🔎 ➡️ 📚');

  let results;
  try {
    results = await fetchTermTest(q);
  } catch (e) {
    console.error(e);
    return reply('⚠️ Failed to scrape term test papers.');
  }

  if (!results.length) return reply('❌ No term test past papers found for your query.');

  const listMsg = results.map((p, i) => `*${i+1}.* ${p.title}`).join('\n');
  const sent = await conn.sendMessage(from, { text: `📄 *PICK A PAPER TO DOWNLOAD*\n${listMsg}` }, { quoted: mek });

  conn.ev.on('messages.upsert', async upd => {
    const msg = upd.messages[0];
    if (!msg.message?.extendedTextMessage) return;
    const txt = msg.message.extendedTextMessage.text.trim();
    const selected = parseInt(txt) - 1;
    const isReply = msg.message.extendedTextMessage.contextInfo?.stanzaId === sent.key.id;
    if (!isReply || selected < 0 || selected >= results.length) return;

    await conn.sendMessage(from, { react: { text: '📥', key: msg.key } });
    const pdfUrl = await getPDFurl(results[selected].url);
    if (!pdfUrl) return reply('❌ Could not fetch PDF link.');

    await conn.sendMessage(from, {
      document: { url: pdfUrl },
      mimetype: 'application/pdf',
      fileName: `${results[selected].title}.pdf`,
      caption: `✅ *${results[selected].title}*`,
    }, { quoted: msg });

    await conn.sendMessage(from, { react: { text: '✅', key: msg.key } });
  });
});
