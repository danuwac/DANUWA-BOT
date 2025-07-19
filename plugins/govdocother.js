const { cmd } = require("../command");
const axios = require("axios");
const cheerio = require("cheerio");
const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const os = require("os");

const headers = {
  "User-Agent": "Mozilla/5.0",
  "Accept-Language": "en-US,en;q=0.9",
};

const pendingDownloads = {};
const LOGO_IMAGE = "https://github.com/danuwac/DANUWA-BOT/blob/main/images/Alive.png?raw=true"; // replace with your logo

async function fetchGovdocItems(categorySlug) {
  const items = [];
  let page = 1;
  while (true) {
    const url = page === 1
      ? `https://govdoc.lk/category/${categorySlug}`
      : `https://govdoc.lk/category/${categorySlug}?page=${page}`;
    try {
      const res = await axios.get(url, { headers });
      const $ = cheerio.load(res.data);
      const cards = $("a.custom-card");
      if (cards.length === 0) break;

      let newItems = 0;
      cards.each((_, el) => {
        const parent = $(el).closest(".card");
        const relatedContainer = parent.closest(".product-details-info");
        if (relatedContainer.length) return;
        const link = $(el).attr("href");
        const title = $(el).find("h5.cate-title").text().trim();
        if (link && title && !items.find((p) => p.link === link)) {
          items.push({ title, link });
          newItems++;
        }
      });
      if (newItems === 0) break;
      page++;
    } catch (err) {
      console.error(`❌ Failed on page ${page}:`, err.message);
      break;
    }
  }
  return items;
}

function setupStyledGovdocCommand({ pattern, slug, label, requiresGrade, styleId }) {
  cmd({ pattern, react: "📘", desc: `Download ${label}`, category: "education", filename: __filename },
    async (robin, mek, m, { from, q, sender, reply }) => {
      if (requiresGrade && (!q || !/grade\s+\d+/i.test(q))) return reply(`❌ Example: .${pattern} grade 11`);
      let categorySlug = slug;
      if (requiresGrade) {
        const input = q.trim().toLowerCase().split(/\s+/);
        const gradeIndex = input.findIndex(w => w === "grade");
        if (gradeIndex === -1 || !input[gradeIndex + 1]) return reply("❌ Grade missing. Use format like `.textbook grade 11`");
        const grade = input[gradeIndex + 1];
        categorySlug = `${slug}/grade-${grade}`;
      }

      const items = await fetchGovdocItems(categorySlug);
      if (!items.length) return reply(`❌ No ${label.toLowerCase()} found.`);

      const grade = requiresGrade ? categorySlug.split("/")[1].replace("grade-", "") : "";
      let msg = generateStyledMessage(items, label, grade, styleId);

      await robin.sendMessage(from, { caption: msg, image: { url: LOGO_IMAGE } }, { quoted: mek });
      pendingDownloads[sender] = { step: "select", results: items, quoted: mek, label, requiresGrade };
    });
}

function generateStyledMessage(items, label, grade, styleId) {
  switch (styleId) {
    case 1:
      return `╭──── ⭓ GOVDOC CENTER ⭓ ────╮\n│ 📰 Category: ${label}\n│ 📅 Grade: ${grade}\n╰─────────────────────────╯\n\n` +
        items.map((v, i) => `➤ ${i + 1}. ${v.title}\n`).join("\n") +
        `\n📝 Reply with the number to select.`;
    case 3:
      return `╔═════════ 📚 ${label.toUpperCase()} ═════════╗\n║ 🎓 Grade: ${grade}\n║ 🗂️ From: govdoc.lk\n╟──────────────────────────────╢\n` +
        items.map((v, i) => `║ ${i + 1}️⃣ ${v.title}`).join("\n") +
        `\n╚══════════════════════════════╝\n📌 Reply with a number to download.`;
    case 5:
      return `╭────── ⭓ GOVDOC LIBRARY ⭓ ──────╮\n│ 📁 Category: ${label}\n│ 🎓 Grade: ${grade}\n│ 🔍 Select an item below:\n╰─────────────────────────────╯\n\n` +
        items.map((v, i) => `📘 ${i + 1}. ${v.title}`).join("\n\n") +
        `\n\n📥 Reply with the item number.`;
    case 10:
      return `╭───── 🧿 GOVDOC CENTER 🧿 ─────╮\n│ 📘 ${label}\n│ 🎓 Grade: ${grade}\n│ 🤖 Powered by DANUWA-MD\n╰────────────────────────────╯\n\n` +
        items.map((v, i) => `🔹 ${i + 1}. ${v.title}`).join("\n\n") +
        `\n✏️ Reply with the item number to continue.`;
    default:
      return `*📚 ${label} (Grade ${grade})*\n` +
        items.map((v, i) => `*${i + 1}.* ${v.title}`).join("\n") +
        `\n_Reply with number to select._`;
  }
}

// Styled Plugin Setup
setupStyledGovdocCommand({ pattern: "textbook", slug: "text-books", label: "Textbooks", requiresGrade: true, styleId: 5 });
setupStyledGovdocCommand({ pattern: "tguide", slug: "teacher-guides", label: "Teacher Guides", requiresGrade: true, styleId: 10 });
setupStyledGovdocCommand({ pattern: "syllabus", slug: "syllabus", label: "Syllabus", requiresGrade: true, styleId: 3 });
setupStyledGovdocCommand({ pattern: "gazette", slug: "gazette", label: "Gazette", requiresGrade: false, styleId: 1 });
