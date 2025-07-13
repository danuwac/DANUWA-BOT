const { cmd } = require('../command');
const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = "https://pastpapers.wiki";

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
  'Accept-Language': 'en-US,en;q=0.9',
  'Referer': 'https://google.com'
};

async function searchPapers(query) {
  try {
    const res = await axios.get(`${BASE_URL}/?s=${encodeURIComponent(query)}`, {
      headers,
      maxRedirects: 5,
    });

    const $ = cheerio.load(res.data);
    const papers = [];

    $('h2.entry-title a').each((i, el) => {
      const title = $(el).text().trim();
      const link = $(el).attr('href');
      if (title && link) papers.push({ title, link });
    });

    return papers;
  } catch (err) {
    console.error("❌ Search error:", err.message);
    return [];
  }
}

async function getDownloadLink(paperUrl) {
  try {
    const res = await axios.get(paperUrl, { headers });
    const $ = cheerio.load(res.data);
    const iframe = $('iframe').attr('src');
    if (!iframe) return null;
    return iframe.startsWith('http') ? iframe : `${BASE_URL}${iframe}`;
  } catch (err) {
    console.error("❌ Link error:", err.message);
    return null;
  }
}

cmd({
  pattern: "pastpaper",
  alias: ["papers", "exam"],
  use: ".pastpaper <subject/year>",
  desc: "Search Sri Lankan past papers",
  category: "education",
  filename: __filename
}, async (conn, mek, m, { from, q, reply }) => {
  try {
    if (!q) return reply("🔍 Please provide a subject, grade, or year to search past papers.");
    await m.react("📚");

    const results = await searchPapers(q);
    if (!results.length) return reply("❌ No past papers found for your query.");

    let msgText = `📚 *PAST PAPERS FOUND* 📚\n───────────────────────\n_Reply with number to download_\n\n`;
    results.forEach((paper, i) => {
      msgText += `*${i + 1}.* ${paper.title}\n`;
    });

    const sent = await conn.sendMessage(from, {
      text: msgText,
    }, { quoted: mek });

    conn.ev.on("messages.upsert", async (msgUpdate) => {
      const msg1 = msgUpdate.messages[0];
      if (!msg1.message || !msg1.message.extendedTextMessage) return;

      const replyText = msg1.message.extendedTextMessage.text.trim();
      const isReply = msg1.message.extendedTextMessage?.contextInfo?.stanzaId === sent.key.id;
      const selected = parseInt(replyText) - 1;

      if (isReply && selected >= 0 && selected < results.length) {
        await conn.sendMessage(from, { react: { text: "📄", key: msg1.key } });

        const pdfUrl = await getDownloadLink(results[selected].link);
        if (!pdfUrl) return reply("❌ Failed to fetch the PDF link.");

        await conn.sendMessage(from, {
          document: { url: pdfUrl },
          mimetype: "application/pdf",
          fileName: `${results[selected].title}.pdf`,
          caption: `📄 *${results[selected].title}*\n✅ Past paper sent successfully.`,
        }, { quoted: msg1 });

        await conn.sendMessage(from, { react: { text: "✅", key: msg1.key } });
      }
    });
  } catch (err) {
    console.error("Plugin error:", err);
    reply("⚠️ An error occurred while processing your request.");
  }
});
