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
const LOGO_IMAGE = "https://github.com/danuwac/DANUWA-BOT/blob/main/images/Alive.png?raw=true"; // Replace with actual logo

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

function setupInlineGovdocCommand({ pattern, slug, label, requiresGrade, styleId }) {
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
      const msg = generateStyledMessage(items, label, grade, styleId);
      const buttons = items.slice(0, 15).map((item, i) => ({
        buttonId: `govdoc_item_${i}_${sender}`,
        buttonText: { displayText: `${i + 1}` },
        type: 1,
      }));

      await robin.sendMessage(from, {
        image: { url: LOGO_IMAGE },
        caption: msg,
        footer: "Reply using buttons below",
        buttons,
        headerType: 4,
      }, { quoted: mek });

      pendingDownloads[sender] = {
        step: "select",
        results: items,
        quoted: mek,
        label,
        requiresGrade,
      };
    });

  cmd({
    on: "message",
    filter: (msg, { sender }) => msg.key?.id?.startsWith("govdoc_item_") && pendingDownloads[sender]?.step === "select",
  }, async (robin, mek, m, { from, sender }) => {
    const parts = mek.key.id.split("_");
    const index = parseInt(parts[2]);
    const pending = pendingDownloads[sender];
    const selectedItem = pending.results[index];

    try {
      const { data } = await axios.get(selectedItem.link, { headers });
      const $ = cheerio.load(data);
      const languages = [];
      $("a[href*='/view?id=']").each((_, el) => {
        const href = $(el).attr("href");
        const lang = $(el).find("button").text().trim() || "Document";
        if (href) {
          languages.push({
            lang,
            link: href.startsWith("http") ? href : `https://govdoc.lk${href}`,
          });
        }
      });

      if (!languages.length) return reply("⚠️ No language versions found.");

      const langButtons = languages.map((l, i) => ({
        buttonId: `govdoc_dl_${i}_${sender}`,
        buttonText: { displayText: l.lang },
        type: 1,
      }));

      await robin.sendMessage(from, {
        text: `🌐 Select a language for: *${selectedItem.title}*`,
        footer: "DANUWA-MD BOT",
        buttons: langButtons,
        headerType: 1,
      }, { quoted: mek });

      pendingDownloads[sender] = {
        step: "download",
        selected: selectedItem,
        languages,
        quoted: mek,
        label: pending.label,
        requiresGrade: pending.requiresGrade,
      };
    } catch (e) {
      console.error(e);
      delete pendingDownloads[sender];
      reply("⚠️ Failed to fetch language options.");
    }
  });

  cmd({
    on: "message",
    filter: (msg, { sender }) => msg.key?.id?.startsWith("govdoc_dl_") && pendingDownloads[sender]?.step === "download",
  }, async (robin, mek, m, { from, sender }) => {
    const parts = mek.key.id.split("_");
    const index = parseInt(parts[2]);
    const pending = pendingDownloads[sender];
    const lang = pending.languages[index];
    const downloadDir = path.join(os.tmpdir(), `govdoc-${Date.now()}`);

    try {
      fs.mkdirSync(downloadDir);
      const browser = await puppeteer.launch({
        headless: "new",
        args: ["--no-sandbox", "--disable-setuid-sandbox"],
      });

      const page = await browser.newPage();
      await page._client().send("Page.setDownloadBehavior", {
        behavior: "allow",
        downloadPath: downloadDir,
      });

      await page.goto(lang.link, { waitUntil: "networkidle2", timeout: 30000 });
      await page.waitForSelector('a.btn.w-100[href*="/download/"]', { timeout: 15000 });
      await page.click('a.btn.w-100[href*="/download/"]');

      let fileName;
      for (let i = 0; i < 20; i++) {
        const files = fs.readdirSync(downloadDir).filter(f => f.endsWith(".pdf"));
        if (files.length > 0) {
          fileName = files[0];
          break;
        }
        await new Promise((res) => setTimeout(res, 1000));
      }

      await browser.close();
      if (!fileName) throw new Error("Download timed out.");

      const filePath = path.join(downloadDir, fileName);
      const pdfBuffer = fs.readFileSync(filePath);
      const niceName = `${pending.selected.title} - ${lang.lang}.pdf`;

      await robin.sendMessage(from, {
        document: pdfBuffer,
        mimetype: "application/pdf",
        fileName: niceName,
        caption: `✅ *Download Complete!*\n📄 ${niceName}`,
      }, { quoted: mek });

      fs.unlinkSync(filePath);
      fs.rmdirSync(downloadDir);
      delete pendingDownloads[sender];
    } catch (e) {
      console.error("❌ Puppeteer error:", e.message);
      reply("⛔ Failed to download the PDF.");
      delete pendingDownloads[sender];
    }
  });
}

function generateStyledMessage(items, label, grade, styleId) {
  switch (styleId) {
    case 1:
      return `╭──── ⭓ GOVDOC CENTER ⭓ ────╮\n│ 📰 Category: ${label}\n│ 📅 Grade: ${grade}\n╰─────────────────────────╯\n\n` +
        items.map((v, i) => `➤ ${i + 1}. ${v.title}\n`).join("\n") +
        `\n📝 Tap a button to select.`;
    case 3:
      return `╔═════════ 📚 ${label.toUpperCase()} ═════════╗\n║ 🎓 Grade: ${grade}\n║ 🗂️ From: govdoc.lk\n╟──────────────────────────────╢\n` +
        items.map((v, i) => `║ ${i + 1}️⃣ ${v.title}`).join("\n") +
        `\n╚══════════════════════════════╝\n📌 Tap a number below.`;
    case 5:
      return `╭────── ⭓ GOVDOC LIBRARY ⭓ ──────╮\n│ 📁 Category: ${label}\n│ 🎓 Grade: ${grade}\n│ 🔍 Select an item below:\n╰─────────────────────────────╯\n\n` +
        items.map((v, i) => `📘 ${i + 1}. ${v.title}`).join("\n\n") +
        `\n\n📥 Use buttons below.`;
    case 10:
      return `╭───── 🧿 GOVDOC CENTER 🧿 ─────╮\n│ 📘 ${label}\n│ 🎓 Grade: ${grade}\n│ 🤖 Powered by DANUWA-MD\n╰────────────────────────────╯\n\n` +
        items.map((v, i) => `🔹 ${i + 1}. ${v.title}`).join("\n\n") +
        `\n✏️ Tap to continue.`;
    default:
      return `*📚 ${label} (Grade ${grade})*\n` +
        items.map((v, i) => `*${i + 1}.* ${v.title}`).join("\n") +
        `\n_Use inline buttons to select._`;
  }
}

// Register commands with inline styles
setupInlineGovdocCommand({ pattern: "textbook", slug: "text-books", label: "Textbooks", requiresGrade: true, styleId: 5 });
setupInlineGovdocCommand({ pattern: "tguide", slug: "teacher-guides", label: "Teacher Guides", requiresGrade: true, styleId: 10 });
setupInlineGovdocCommand({ pattern: "syllabus", slug: "syllabus", label: "Syllabus", requiresGrade: true, styleId: 3 });
setupInlineGovdocCommand({ pattern: "gazette", slug: "gazette", label: "Gazette", requiresGrade: false, styleId: 1 });
