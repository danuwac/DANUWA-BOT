const { cmd } = require("../command");
const axios = require("axios");
const cheerio = require("cheerio");

const headers = {
  "User-Agent": "Mozilla/5.0",
  "Accept-Language": "en-US,en;q=0.9",
};

// Global object to keep reply context per user
const pendingGovDoc = {};

// Step 1: Fetch test paper list for a grade
async function fetchGovdocPosts(gradeSlug) {
  const url = `https://govdoc.lk/category/term-test-papers/${gradeSlug}`;
  const res = await axios.get(url, { headers });
  const $ = cheerio.load(res.data);
  const posts = [];

  $("a.custom-card").each((_, el) => {
    if ($(el).closest(".info-body").length > 0) return; // skip related
    const link = $(el).attr("href");
    const title = $(el).find("h5.cate-title").text().trim();
    if (link && title) posts.push({ title, link });
  });

  return posts.slice(0, 20);
}

// Command: .govdoc grade 11
cmd(
  {
    pattern: "govdoc",
    react: "📚",
    desc: "Get term test papers from govdoc.lk",
    category: "education",
    filename: __filename,
  },
  async (robin, mek, m, { from, q, sender, reply }) => {
    if (!q) return reply("❌ Please provide a grade. Example: `.govdoc grade 11`");

    await m.react("📚");
    const gradeSlug = q.toLowerCase().replace(/\s+/g, "-");
    const posts = await fetchGovdocPosts(gradeSlug);

    if (!posts.length) return reply(`❌ No papers found for *${q}*`);

    let msg = `📚 *GovDoc ${q.toUpperCase()} Term Test Papers*\n────────────────────\n_Reply with number to select paper_\n\n`;
    posts.forEach((post, i) => {
      msg += `*${i + 1}.* ${post.title}\n`;
    });

    await robin.sendMessage(from, { text: msg }, { quoted: mek });

    // Save context for reply handler
    pendingGovDoc[sender] = {
      step: "select",
      results: posts,
      quoted: mek,
    };
  }
);

// Reply Handler Step 2: User replies with paper number
cmd(
  {
    filter: (text, { sender }) =>
      pendingGovDoc[sender] && pendingGovDoc[sender].step === "select" && /^\d+$/.test(text.trim()),
  },
  async (robin, mek, m, { from, body, sender, reply }) => {
    const pending = pendingGovDoc[sender];
    const selected = parseInt(body.trim());

    if (selected < 1 || selected > pending.results.length) {
      return reply("❌ Invalid selection. Please reply with a valid number.");
    }

    const selectedResult = pending.results[selected - 1];

    // Fetch the language page
    try {
      const { data } = await axios.get(selectedResult.link, { headers });
      const $ = cheerio.load(data);

      // Extract languages from .btn-row a > button
      const languages = [];
      $(".btn-row a").each((_, el) => {
        const lang = $(el).find("button").text().trim();
        const href = $(el).attr("href");
        if (lang && href && href.includes("/view?id=")) {
          languages.push({
            lang,
            link: href.startsWith("http") ? href : `https://govdoc.lk${href}`,
          });
        }
      });

      if (!languages.length) {
        delete pendingGovDoc[sender];
        return reply("⚠️ No language options found for this paper.");
      }

      let langMsg = `🌐 *Available Languages for:* _${selectedResult.title}_\n\n`;
      languages.forEach((l, i) => {
        langMsg += `*${i + 1}.* ${l.lang}\n`;
      });
      langMsg += `\n_Reply with a number (1-${languages.length}) to download._`;

      // Update context for next step
      pendingGovDoc[sender] = {
        step: "download",
        selected: selectedResult,
        languages,
        quoted: mek,
      };

      reply(langMsg);
    } catch (e) {
      console.error(e);
      reply("⚠️ Failed to fetch language options. Please try again.");
      delete pendingGovDoc[sender];
    }
  }
);

// Reply Handler Step 3: User replies with language number to download
cmd(
  {
    filter: (text, { sender }) =>
      pendingGovDoc[sender] && pendingGovDoc[sender].step === "download" && /^\d+$/.test(text.trim()),
  },
  async (robin, mek, m, { from, body, sender, reply }) => {
    const pending = pendingGovDoc[sender];
    const selected = parseInt(body.trim());

    if (selected < 1 || selected > pending.languages.length) {
      return reply("❌ Invalid selection. Please reply with a valid number.");
    }

    const lang = pending.languages[selected - 1];

    try {
      const { data } = await axios.get(lang.link, { headers });
      const $ = cheerio.load(data);
      const downloadUrl = $(".cart-button a.btn").attr("href");

      if (!downloadUrl || !downloadUrl.includes("/download/")) {
        throw new Error("Download link not found");
      }

      await robin.sendMessage(from, {
        document: { url: downloadUrl },
        mimetype: "application/pdf",
        fileName: `${pending.selected.title} - ${lang.lang}.pdf`,
      }, { quoted: mek });

      delete pendingGovDoc[sender];
    } catch (e) {
      console.error(e);
      reply("⚠️ Failed to fetch or send PDF. Please try again.");
      delete pendingGovDoc[sender];
    }
  }
);
