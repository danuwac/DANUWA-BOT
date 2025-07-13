const { cmd } = require('../command');
const axios = require('axios');
const cheerio = require('cheerio');
const https = require('https');

// Configuration
const SCRAPE_SOURCES = [
  {
    name: "PastPapersWiki",
    baseUrl: "https://pastpapers.wiki/",
    searchPath: (exam, subject) => `${exam}-past-papers/${subject || ''}`,
    selectors: {
      items: "article",
      title: ".details .title a",
      image: ".image .thumbnail img",
      description: ".details .contenido p",
      year: ".details .meta .year",
      link: ".image .thumbnail a"
    }
  },
  {
    name: "E-Thaksalawa",
    baseUrl: "https://www.e-thaksalawa.moe.gov.lk/",
    searchPath: (exam, subject) => `past-papers/${exam}/${subject || ''}`,
    selectors: {
      items: ".resource-item",
      title: "h3 a",
      image: "img",
      description: ".description",
      year: ".meta",
      link: "a.download"
    }
  }
];

// Exam and subject mapping
const EXAM_TYPES = {
  "ol": {
    name: "Ordinary Level (O/L)",
    subjects: {
      "maths": "Mathematics",
      "science": "Science",
      "english": "English",
      "sinhala": "Sinhala",
      "history": "History"
    }
  },
  "al": {
    name: "Advanced Level (A/L)",
    subjects: {
      "maths": "Combined Mathematics",
      "physics": "Physics",
      "chemistry": "Chemistry",
      "bio": "Biology",
      "ict": "ICT"
    }
  }
};

// User session tracking
const userSessions = {};

// Utility functions
function formatBytes(bytes, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(decimals)) + ' ' + sizes[i];
}

async function scrapePapers(source, exam, subject) {
  try {
    const url = `${source.baseUrl}${source.searchPath(exam, subject)}`;
    const response = await axios.get(url, {
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',
        'Accept-Language': 'en-US,en;q=0.9'
      },
      timeout: 15000
    });

    const $ = cheerio.load(response.data);
    const papers = [];

    $(source.selectors.items).each((i, el) => {
      const title = $(el).find(source.selectors.title).text().trim();
      const image = $(el).find(source.selectors.image).attr('src');
      const description = $(el).find(source.selectors.description).text().trim();
      const year = $(el).find(source.selectors.year).text().trim().match(/\d{4}/)?.[0] || "N/A";
      const link = $(el).find(source.selectors.link).attr('href');

      if (title && link) {
        papers.push({
          title,
          image: image?.startsWith('http') ? image : `${source.baseUrl}${image}`,
          description,
          year,
          link: link?.startsWith('http') ? link : `${source.baseUrl}${link}`,
          source: source.name
        });
      }
    });

    return papers;
  } catch (error) {
    console.error(`Scraping error from ${source.name}:`, error.message);
    return [];
  }
}

async function getDownloadLinks(paperUrl) {
  try {
    const response = await axios.get(paperUrl, {
      httpsAgent: new https.Agent({ rejectUnauthorized: false }),
      timeout: 15000
    });
    const $ = cheerio.load(response.data);
    const links = [];

    // Extract download links - adjust selectors based on actual site structure
    $('a.download-link, .download-btn').each((i, el) => {
      const url = $(el).attr('href');
      const text = $(el).text().trim();
      if (url && url.match(/\.pdf$/i)) {
        links.push({
          url,
          label: text || `Download Link ${i+1}`,
          type: 'pdf'
        });
      }
    });

    return links.length > 0 ? links : [{ url: paperUrl, label: "Direct Link", type: "unknown" }];
  } catch (error) {
    console.error("Error getting download links:", error.message);
    return [{ url: paperUrl, label: "Direct Link", type: "fallback" }];
  }
}

cmd({
  pattern: "pastpaper",
  alias: ["pp", "papers"],
  use: ".pastpaper <exam> <subject>",
  desc: "Download Sri Lankan past papers (O/L, A/L)",
  category: "download",
  filename: __filename
}, async (conn, mek, m, { from, sender, reply, q }) => {
  try {
    if (!q) {
      let examList = "📚 *Available Exam Types:*\n";
      Object.entries(EXAM_TYPES).forEach(([key, exam]) => {
        examList += `\n*${key.toUpperCase()}* - ${exam.name}`;
      });

      return reply(`${examList}\n\nUsage: *.pastpaper ol maths* or *.pastpaper al physics*`);
    }

    const [examType, subject] = q.toLowerCase().split(' ');
    if (!EXAM_TYPES[examType]) {
      return reply(`❌ Invalid exam type. Use *ol* or *al*\n\n${EXAM_TYPES.ol.name}\n${EXAM_TYPES.al.name}`);
    }

    if (subject && !EXAM_TYPES[examType].subjects[subject]) {
      const subjectList = Object.entries(EXAM_TYPES[examType].subjects)
        .map(([key, name]) => `*${key}* - ${name}`)
        .join('\n');
      return reply(`❌ Invalid subject for ${EXAM_TYPES[examType].name}\n\nAvailable subjects:\n${subjectList}`);
    }

    await m.react('🔍');

    // Check all sources for papers
    let allPapers = [];
    for (const source of SCRAPE_SOURCES) {
      const papers = await scrapePapers(source, examType, subject);
      if (papers.length > 0) {
        allPapers = [...allPapers, ...papers];
        break; // Use first successful source
      }
    }

    if (allPapers.length === 0) {
      return reply('❌ No past papers found. The websites may be down or blocking requests.');
    }

    // Store papers in user session
    userSessions[sender] = {
      papers: allPapers,
      timestamp: Date.now()
    };

    // Create interactive menu
    let menuMessage = `╔════════════════════════╗
║   🍁 ＤＡＮＵＷＡ－ＭＤ 🍁   ║
╚════════════════════════╝
📚 *${EXAM_TYPES[examType].name} Past Papers*
${subject ? `📖 Subject: *${EXAM_TYPES[examType].subjects[subject]}*\n` : ''}
🔰 *Available Papers:*
`;

    allPapers.forEach((paper, index) => {
      menuMessage += `\n${index + 1}. *${paper.title}* (${paper.year})`;
    });

    menuMessage += `\n\n💬 *Reply with the number of the paper you want*`;

    const sentMsg = await conn.sendMessage(from, {
      image: { url: allPapers[0].image || 'https://i.imgur.com/J5Q8X0A.png' },
      caption: menuMessage
    }, { quoted: mek });

    // Listen for user selection
    conn.ev.on('messages.upsert', async ({ messages }) => {
      const msg = messages[0];
      if (!msg.message?.extendedTextMessage || 
          msg.message.extendedTextMessage.contextInfo?.stanzaId !== sentMsg.key.id) return;

      const selectedNum = parseInt(msg.message.extendedTextMessage.text.trim());
      if (isNaN(selectedNum)) {
        await conn.sendMessage(from, { 
          text: '❌ Please reply with a number from the list.',
          quoted: msg
        });
        return;
      }

      if (selectedNum < 1 || selectedNum > allPapers.length) {
        await conn.sendMessage(from, { 
          text: `❌ Please select a number between 1 and ${allPapers.length}.`,
          quoted: msg
        });
        return;
      }

      const selectedPaper = allPapers[selectedNum - 1];
      await conn.sendMessage(from, { react: { text: "⏳", key: msg.key } });

      // Get download links for selected paper
      const downloadLinks = await getDownloadLinks(selectedPaper.link);
      if (!downloadLinks || downloadLinks.length === 0) {
        await conn.sendMessage(from, { 
          text: '❌ Could not retrieve download links for this paper.',
          quoted: msg
        });
        return;
      }

      // Show download options
      let downloadMenu = `📄 *${selectedPaper.title}*\n📅 Year: ${selectedPaper.year}\n\n`;
      downloadMenu += `🔗 *Download Options:*\n`;
      
      downloadLinks.forEach((link, idx) => {
        downloadMenu += `\n${idx + 1}. ${link.label}`;
        if (link.type === 'pdf') downloadMenu += ` 📄`;
      });

      downloadMenu += `\n\n💬 *Reply with the number of your preferred download*`;

      const downloadMsg = await conn.sendMessage(from, {
        image: { url: selectedPaper.image },
        caption: downloadMenu
      }, { quoted: msg });

      // Listen for download selection
      conn.ev.on('messages.upsert', async ({ messages }) => {
        const dlMsg = messages[0];
        if (!dlMsg.message?.extendedTextMessage || 
            dlMsg.message.extendedTextMessage.contextInfo?.stanzaId !== downloadMsg.key.id) return;

        const selectedLinkNum = parseInt(dlMsg.message.extendedTextMessage.text.trim());
        if (isNaN(selectedLinkNum)) {
          await conn.sendMessage(from, { 
            text: '❌ Please reply with a number from the list.',
            quoted: dlMsg
          });
          return;
        }

        if (selectedLinkNum < 1 || selectedLinkNum > downloadLinks.length) {
          await conn.sendMessage(from, { 
            text: `❌ Please select a number between 1 and ${downloadLinks.length}.`,
            quoted: dlMsg
          });
          return;
        }

        const selectedLink = downloadLinks[selectedLinkNum - 1];
        await conn.sendMessage(from, { react: { text: "⬇️", key: dlMsg.key } });

        // Show download progress
        const progressMsg = await conn.sendMessage(from, {
          text: `📥 *Downloading:* ${selectedPaper.title}\n⏳ Preparing file...`
        }, { quoted: dlMsg });

        try {
          // Simulate download progress
          for (let i = 0; i <= 100; i += 10) {
            await new Promise(resolve => setTimeout(resolve, 300));
            await conn.sendMessage(from, {
              edit: progressMsg.key,
              text: `📥 *Downloading:* ${selectedPaper.title}\n🔄 ${i}% complete...`
            });
          }

          // Send the paper
          await conn.sendMessage(from, {
            document: { url: selectedLink.url },
            fileName: `${selectedPaper.title.replace(/[^\w\s]/gi, '')}.pdf`,
            mimetype: 'application/pdf',
            caption: `✅ *Download Complete!*\n\n📄 *${selectedPaper.title}*\n📅 Year: ${selectedPaper.year}\n🔗 Source: ${selectedPaper.source}\n\n⚡ Powered by DANUWA-MD`
          }, { quoted: dlMsg });

          await conn.sendMessage(from, { react: { text: "✅", key: dlMsg.key } });

        } catch (error) {
          console.error("Download error:", error);
          await conn.sendMessage(from, {
            text: `❌ Failed to download the paper. You can try the direct link:\n${selectedLink.url}`,
            quoted: dlMsg
          });
        }
      });
    });

  } catch (error) {
    console.error("Past paper error:", error);
    reply('⚠️ An error occurred while processing your request. Please try again later.');
  }
});

// Clean up old sessions hourly
setInterval(() => {
  const now = Date.now();
  for (const [user, session] of Object.entries(userSessions)) {
    if (now - session.timestamp > 3600000) { // 1 hour
      delete userSessions[user];
    }
  }
}, 3600000);
