const { cmd } = require('../command');
const axios = require('axios');
const cheerio = require('cheerio');

const BASE_URL = "https://pastpapers.wiki";

async function searchPapers(query) {
  try {
    const res = await axios.get(`${BASE_URL}/?s=${encodeURIComponent(query)}`);
    const $ = cheerio.load(res.data);
    const papers = [];

    $('article').each((i, el) => {
      const title = $(el).find('.entry-title a').text().trim();
      const link = $(el).find('.entry-title a').attr('href');
      const thumbnail = $(el).find('img').attr('src') || null;
      if (title && link) papers.push({ title, link, thumbnail });
    });

    return papers;
  } catch (err) {
    console.error("Search error:", err.message);
    return [];
  }
}

async function getDownloadLink(paperUrl) {
  try {
    const res = await axios.get(paperUrl);
    const $ = cheerio.load(res.data);
    const iframe = $('iframe').attr('src');
    if (!iframe) return null;
    return iframe.startsWith('http') ? iframe : `${BASE_URL}${iframe}`;
  } catch (err) {
    console.error("Link error:", err.message);
    return null;
  }
}

cmd({
  pattern: "pastpaper",
  alias: ["papers", "exam"],
  use: ".pastpaper <subject/year/grade>",
  desc: "Search Sri Lankan past papers",
  category: "education",
  filename: __filename
}, async (conn, mek, m, { from, args, q, reply }) => {
  try {
    if (!q) return reply("🔍 Please provide a subject, grade, or year to search past papers.");
    await m.react("📚");

    const results = await searchPapers(q);
    if (!results.length) return reply("❌ No past papers found for your query.");

    let msgText = `📚 *PAST PAPERS MATCHED* 📚\n─────────────────────────\n_Reply with the number to download a paper._\n\n`;
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
          caption: `📄 *${results[selected].title}*\n✅ Past paper downloaded successfully.`,
        }, { quoted: msg1 });

        await conn.sendMessage(from, { react: { text: "✅", key: msg1.key } });
      }
    });
  } catch (err) {
    console.error("Plugin error:", err);
    reply("⚠️ An error occurred while processing your request.");
  }
});
