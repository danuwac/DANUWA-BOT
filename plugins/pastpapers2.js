const axios = require("axios");
const cheerio = require("cheerio");
const { cmd } = require('../command');

const pendingGovDoc = {};

// STEP 1: Search command
cmd({
  pattern: "govdoc ?(.*)",
  desc: "Search govdoc.lk for term test papers",
  category: "education",
  filename: __filename
}, async (conn, m, { match, reply }) => {
  const query = match || "";
  if (!query) return reply("🔎 Enter a subject or keyword to search on govdoc.lk\n\nExample: `.govdoc science grade 11`");

  try {
    const searchUrl = `https://govdoc.lk/?s=${encodeURIComponent(query)}`;
    const res = await axios.get(searchUrl);
    const $ = cheerio.load(res.data);

    const results = [];

    $(".post-wrapper .card").each((i, el) => {
      const link = $(el).find("a").attr("href");
      const title = $(el).find("h5").text().trim();

      if (
        link &&
        !link.includes("/page/") && // ✅ Skip "Related Pages"
        title &&
        !title.toLowerCase().includes("related")
      ) {
        results.push({ title, link });
      }
    });

    if (!results.length) return reply("❌ No results found for: " + query);

    let text = `📝 *Search Results for:* _${query}_\n\n`;
    results.forEach((r, i) => {
      text += `*${i + 1}. ${r.title}*\n`;
    });
    text += `\n📥 Reply with the *number* of the paper to continue.`;

    pendingGovDoc[m.sender] = {
      step: "select",
      results
    };

    return reply(text);

  } catch (e) {
    return reply("❌ Failed to fetch results.");
  }
});

// STEP 2: User selects paper
cmd({
  filter: m => pendingGovDoc[m.sender] && pendingGovDoc[m.sender].step === "select"
}, async (conn, m, { reply }) => {
  const num = parseInt(m.body.trim());
  const pending = pendingGovDoc[m.sender];
  if (isNaN(num) || num < 1 || num > pending.results.length) {
    return reply("❌ Invalid selection.");
  }

  const selected = pending.results[num - 1];
  try {
    const res = await axios.get(selected.link);
    const $ = cheerio.load(res.data);

    const languages = [];
    $(".cart-button a.btn").each((i, el) => {
      const lang = $(el).text().trim();
      const link = $(el).attr("href");
      if (link && lang) languages.push({ lang, link });
    });

    if (!languages.length) {
      delete pendingGovDoc[m.sender];
      return reply("⚠️ No language versions found.");
    }

    let text = `📚 *${selected.title}*\n\nChoose a language to download:\n`;
    languages.forEach((l, i) => {
      text += `*${i + 1}. ${l.lang}*\n`;
    });

    pendingGovDoc[m.sender] = {
      step: "download",
      selected,
      languages
    };

    return reply(text);

  } catch (e) {
    delete pendingGovDoc[m.sender];
    return reply("❌ Failed to fetch language options.");
  }
});

// STEP 3: User selects language
cmd({
  filter: m => pendingGovDoc[m.sender] && pendingGovDoc[m.sender].step === "download"
}, async (conn, m, { reply }) => {
  const num = parseInt(m.body.trim());
  const pending = pendingGovDoc[m.sender];
  if (isNaN(num) || num < 1 || num > pending.languages.length) {
    return reply("❌ Invalid selection.");
  }

  const lang = pending.languages[num - 1];
  try {
    const res = await axios.get(lang.link);
    const $ = cheerio.load(res.data);

    const downloadUrl = $(".cart-button a.btn").attr("href");
    if (!downloadUrl || !downloadUrl.includes("/download/")) {
      delete pendingGovDoc[m.sender];
      return reply("⚠️ Download link not found.");
    }

    await conn.sendMessage(m.chat, {
      document: { url: downloadUrl },
      mimetype: "application/pdf",
      fileName: `${pending.selected.title} - ${lang.lang}.pdf`
    }, { quoted: m });

  } catch (e) {
    return reply("❌ Failed to fetch download link.");
  }

  delete pendingGovDoc[m.sender];
});
