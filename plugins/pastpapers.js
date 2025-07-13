const { cmd } = require("../command");
const axios = require("axios");
const cheerio = require("cheerio");
const fs = require("fs");
const path = require("path");

// Base URLs for scraping
const SCRAPE_SOURCES = {
  "PastPapersWiki": "https://pastpapers.wiki/",
  "GovDocLK": "https://govdoc.lk/education/past-papers",
  "E-Thaksalawa": "https://www.e-thaksalawa.moe.gov.lk/"
};

// Stream/subject categorization
const STREAMS = {
  "ol": {
    "maths": ["Mathematics"],
    "science": ["Science", "Physics", "Chemistry", "Biology"],
    "commerce": ["Accounting", "Business Studies", "Economics"],
    "arts": ["History", "Geography", "Sinhala", "Tamil", "English", "Buddhism", "Islam", "Catholicism"],
    "technology": ["ICT", "Engineering Technology", "Home Economics"]
  },
  "al": {
    "maths": ["Combined Mathematics", "Higher Mathematics"],
    "bio": ["Biology", "Agriculture", "Chemistry"],
    "commerce": ["Accounting", "Business Studies", "Economics"],
    "arts": ["History", "Geography", "Political Science", "Sinhala", "Tamil", "English", "Buddhism"],
    "technology": ["ICT", "Engineering Technology"]
  }
};

// Cache for scraped papers
let papersCache = {};
const CACHE_EXPIRY = 24 * 60 * 60 * 1000; // 24 hours

// Store user selections temporarily
const userSelections = {};

cmd(
  {
    pattern: "pastpapers",
    react: "📚",
    desc: "Download Sri Lankan Past Papers (O/L, A/L) with scraping",
    category: "download",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, sender, reply }) => {
    try {
      if (!q) {
        return reply(`📚 *Sri Lanka Past Papers Downloader*\n\n` +
          `Usage:\n` +
          `*.pastpapers ol* - O/L past papers\n` +
          `*.pastpapers al* - A/L past papers\n` +
          `*.pastpapers ol maths* - O/L Maths papers\n` +
          `*.pastpapers al bio* - A/L Biology stream papers\n\n` +
          `Available Streams:\n` +
          `O/L: maths, science, commerce, arts, technology\n` +
          `A/L: maths, bio, commerce, arts, technology`);
      }

      const args = q.toLowerCase().split(" ");
      const examType = args[0];
      const stream = args[1];

      if (!["ol", "al"].includes(examType)) {
        return reply(`❌ Invalid exam type. Use *ol* or *al*`);
      }

      // Check cache first
      const cacheKey = `${examType}_${stream || "all"}`;
      if (papersCache[cacheKey] && (Date.now() - papersCache[cacheKey].timestamp < CACHE_EXPIRY)) {
        return sendPapersList(robin, from, mek, papersCache[cacheKey].papers, examType, stream);
      }

      await reply(`🔍 *Searching for ${examType.toUpperCase()} past papers...*`);

      // Scrape papers
      const papers = await scrapePastPapers(examType, stream);

      // Cache the results
      papersCache[cacheKey] = {
        papers,
        timestamp: Date.now()
      };

      await sendPapersList(robin, from, mek, papers, examType, stream);
    } catch (e) {
      console.error(e);
      reply("❌ An error occurred. Please try again later.");
    }
  }
);

// Function to scrape past papers
async function scrapePastPapers(examType, stream) {
  try {
    // This would be your actual scraping logic for each website
    // Here's a mock implementation for demonstration
    
    const papers = [];
    
    // Example: Scrape from PastPapersWiki
    const response = await axios.get(`${SCRAPE_SOURCES.PastPapersWiki}/${examType}-past-papers`, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      }
    });
    const $ = cheerio.load(response.data);
    
    // Example scraping logic (adjust based on actual website structure)
    $(".paper-item").each((i, el) => {
      const title = $(el).find(".title").text().trim();
      const yearMatch = title.match(/(\d{4})/);
      const year = yearMatch ? yearMatch[1] : "Unknown";
      
      const subject = $(el).find(".subject").text().trim();
      const url = $(el).find("a").attr("href");
      
      // Filter by stream if specified
      if (!stream || STREAMS[examType][stream]?.some(s => subject.includes(s))) {
        papers.push({
          title,
          year,
          subject,
          url: url.startsWith('http') ? url : `${SCRAPE_SOURCES.PastPapersWiki}${url}`,
          source: "PastPapersWiki"
        });
      }
    });
    
    // You could add similar scraping for other sources here
    
    return papers;
  } catch (e) {
    console.error("Scraping error:", e);
    throw new Error("Failed to fetch past papers from online sources");
  }
}

// Function to send papers list to user
async function sendPapersList(robin, from, mek, papers, examType, stream) {
  if (papers.length === 0) {
    return robin.sendMessage(from, { 
      text: `❌ No ${examType.toUpperCase()} past papers found${stream ? ` for ${stream} stream` : ""}`
    }, { quoted: mek });
  }

  // Group papers by subject
  const papersBySubject = {};
  papers.forEach(paper => {
    if (!papersBySubject[paper.subject]) {
      papersBySubject[paper.subject] = [];
    }
    papersBySubject[paper.subject].push(paper);
  });

  // Create message with papers list
  let message = `📚 *${examType.toUpperCase()} Past Papers*${stream ? ` (${stream} stream)` : ""}\n\n`;
  message += `Found ${papers.length} papers from online sources:\n\n`;

  Object.entries(papersBySubject).forEach(([subject, subjectPapers]) => {
    message += `*${subject}*\n`;
    subjectPapers.forEach(paper => {
      message += `- ${paper.year}: ${paper.title}\n`;
    });
    message += "\n";
  });

  message += `\n🔍 *Reply with the year or subject name to download*\n` +
             `Example: *2022* or *Mathematics*\n\n` +
             `━━━━━━━━━━━━━━━━━━━━━━\n` +
             `🚀 Pow. By *DANUKA DISANAYAKA* 🔥`;

  await robin.sendMessage(from, { text: message }, { quoted: mek });
}

// Handle user selection for specific paper download
cmd(
  {
    filter: (text, { sender }) => {
      return text && (/\d{4}/.test(text) || Object.values(STREAMS).some(streams => 
        Object.values(streams).flat().some(subject => 
          text.trim().toLowerCase().includes(subject.toLowerCase())
        )
      );
    },
    on: "pastpapers"
  },
  async (robin, mek, m, { from, body, sender, reply }) => {
    try {
      const searchTerm = body.trim();
      
      // Find matching papers in cache
      const cachedPapers = Object.values(papersCache)
        .flatMap(cache => cache.papers)
        .filter(paper => 
          paper.year === searchTerm || 
          paper.subject.toLowerCase().includes(searchTerm.toLowerCase())
        );
      
      if (cachedPapers.length === 0) {
        return reply("❌ No matching papers found. Try another search term.");
      }

      if (cachedPapers.length === 1) {
        // Download single paper
        const paper = cachedPapers[0];
        await downloadAndSendPaper(robin, from, mek, paper);
      } else {
        // Show filtered list
        let message = `🔍 Found ${cachedPapers.length} matching papers:\n\n`;
        cachedPapers.forEach((paper, i) => {
          message += `${i+1}. ${paper.subject} (${paper.year})\n`;
        });
        message += `\nReply with number to download (1-${cachedPapers.length})`;
        
        await reply(message);
        // Store selection for next step
        userSelections[sender] = {
          type: "paper_selection",
          papers: cachedPapers,
          timestamp: Date.now()
        };
      }
    } catch (e) {
      console.error(e);
      reply("❌ Failed to process your request. Please try again.");
    }
  }
);

// Handle number selection for multiple results
cmd(
  {
    filter: (text, { sender }) => {
      const selection = userSelections[sender];
      return selection?.type === "paper_selection" && /^\d+$/.test(text.trim());
    }
  },
  async (robin, mek, m, { from, body, sender, reply }) => {
    try {
      const selection = parseInt(body.trim()) - 1;
      const { papers } = userSelections[sender];
      
      if (selection >= 0 && selection < papers.length) {
        const paper = papers[selection];
        await downloadAndSendPaper(robin, from, mek, paper);
        delete userSelections[sender];
      } else {
        reply("❌ Invalid selection. Please try again.");
      }
    } catch (e) {
      console.error(e);
      reply("❌ Failed to download paper. Please try again.");
    }
  }
);

// Function to download and send a paper
async function downloadAndSendPaper(robin, from, mek, paper) {
  await reply(`⏳ Downloading ${paper.subject} (${paper.year}) past paper...`);
  
  try {
    // For production, you would:
    // 1. Download the PDF from paper.url
    // 2. Save it temporarily
    // 3. Send as document
    // 4. Delete the temp file
    
    // For now, we'll send the direct link
    await robin.sendMessage(from, {
      text: `📚 *${paper.subject} (${paper.year})*\n\n` +
            `🔗 Download: ${paper.url}\n\n` +
            `Source: ${paper.source}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━\n` +
            `🚀 Pow. By *DANUKA DISANAYAKA* 🔥`
    }, { quoted: mek });
  } catch (e) {
    console.error(e);
    throw new Error("Failed to download the paper");
  }
}

// Clear cache and user selections periodically
setInterval(() => {
  const now = Date.now();
  
  // Clear expired cache
  for (const [key, cache] of Object.entries(papersCache)) {
    if (now - cache.timestamp > CACHE_EXPIRY) {
      delete papersCache[key];
    }
  }
  
  // Clear expired user selections (5 minute timeout)
  const SELECTION_TIMEOUT = 5 * 60 * 1000;
  for (const [sender, selection] of Object.entries(userSelections)) {
    if (now - selection.timestamp > SELECTION_TIMEOUT) {
      delete userSelections[sender];
    }
  }
}, 60 * 60 * 1000); // Check every hour
