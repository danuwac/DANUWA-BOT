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
const LOGO_IMAGE = "https://i.imgur.com/YOUR_LOGO.png"; // replace with your DANUWA-MD logo

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

function setupGovdocCommand({ pattern, slug, label, requiresGrade }) {
  cmd({
    pattern,
    react: "📘",
    desc: `Download ${label} from govdoc.lk`,
    category: "education",
    filename: __filename,
  }, async (robin, mek, m, { from, q, sender, reply }) => {
    if (requiresGrade && (!q || !/grade\s+\d+/i.test(q)))
      return reply(`❌ Example: .${pattern} grade 11`);

    let categorySlug = slug;
    if (requiresGrade) {
      const input = q.trim().toLowerCase().split(/\s+/);
      const gradeIndex = input.findIndex(w => w === "grade");
      if (gradeIndex === -1 || !input[gradeIndex + 1])
        return reply("❌ Grade missing. Use format like `.textbook grade 11`");
      const grade = input[gradeIndex + 1];
      categorySlug = `${slug}/grade-${grade}`;
    }

    const items = await fetchGovdocItems(categorySlug);

    if (!items.length) {
      return reply(`❌ No ${label.toLowerCase()} found${requiresGrade ? ` for grade ${categorySlug.split("/")[1].replace("grade-", "")}` : ""}.`);
    }

    const grade = requiresGrade ? categorySlug.split("/")[1].replace("grade-", "") : "";
    let msg = `╭─────── ⭓  GOVDOC CENTER  ⭓ ───────╮
│ 📚 CATEGORY: ${label}
${grade ? `│ 🎓 GRADE: ${grade}` : ""}
│ 📎 TYPE: Select an item by replying
╰──────────────────────⟡\n\n`;

    items.forEach((item, i) => {
      msg += `🔹 *${i + 1}.* ${item.title}\n\n`;
    });

    msg += `╭────── ⭓ DANUWA-MD BOT ⭓ ──────╮
│ 🤖 Powered by DANUWA-MD
│ 📅 Source: govdoc.lk
╰──────────────────────────────╯`;

    await robin.sendMessage(
      from,
      {
        caption: msg,
        image: { url: LOGO_IMAGE },
      },
      { quoted: mek }
    );

    pendingDownloads[sender] = {
      step: "select",
      results: items,
      quoted: mek,
      label,
      requiresGrade,
    };
  });

  cmd({
    filter: (text, { sender }) =>
      pendingDownloads[sender] &&
      pendingDownloads[sender].step === "select" &&
      /^\d+$/.test(text.trim()),
  }, async (robin, mek, m, { from, body, sender, reply }) => {
    const pending = pendingDownloads[sender];
    const selected = parseInt(body.trim());

    if (selected < 1 || selected > pending.results.length)
      return reply("⚠️ Invalid selection.\nReply with a number from the list.");

    const selectedItem = pending.results[selected - 1];

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

      if (!languages.length) {
        const directDownload = $("a.btn.w-100[href*='/download/']").attr("href");
        if (directDownload) {
          const pdfUrl = directDownload.startsWith("http")
            ? directDownload
            : `https://govdoc.lk${directDownload}`;
          await robin.sendMessage(from, {
            text: `📄 Direct Download:\n${pdfUrl}`
          }, { quoted: mek });
          delete pendingDownloads[sender];
          return;
        }

        delete pendingDownloads[sender];
        return reply("⚠️ No language versions found.");
      }

      let langMsg = `╭─────── ⭓ LANGUAGE OPTIONS ⭓ ───────╮
│ 📄 DOCUMENT: ${selectedItem.title}
│ 🌐 Select a language to download
╰────────────────────────⟡\n\n`;

      languages.forEach((l, i) => {
        langMsg += `🔹 *${i + 1}.* ${l.lang}\n\n`;
      });

      langMsg += `✏️ Reply with the number of the language`;

      pendingDownloads[sender] = {
        step: "download",
        selected: selectedItem,
        languages,
        quoted: mek,
        label: pending.label,
        requiresGrade: pending.requiresGrade,
      };

      reply(langMsg);
    } catch (e) {
      console.error(e);
      delete pendingDownloads[sender];
      reply("⚠️ Failed to fetch language options.");
    }
  });

  cmd({
    filter: (text, { sender }) =>
      pendingDownloads[sender] &&
      pendingDownloads[sender].step === "download" &&
      /^\d+$/.test(text.trim()),
  }, async (robin, mek, m, { from, body, sender, reply }) => {
    const pending = pendingDownloads[sender];
    const selected = parseInt(body.trim());

    if (selected < 1 || selected > pending.languages.length)
      return reply("⚠️ Invalid language selection.\nPlease reply with a valid number.");

    const lang = pending.languages[selected - 1];
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

      await robin.sendMessage(
        from,
        {
          document: pdfBuffer,
          mimetype: "application/pdf",
          fileName: niceName,
          caption: `✅ *Download Complete!*\n📄 ${niceName}`,
        },
        { quoted: mek }
      );

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

// Register all commands
setupGovdocCommand({ pattern: "textbook", slug: "text-books", label: "Textbooks", requiresGrade: true });
setupGovdocCommand({ pattern: "tguide", slug: "teacher-guides", label: "Teacher Guides", requiresGrade: true });
setupGovdocCommand({ pattern: "syllabus", slug: "syllabus", label: "Syllabus", requiresGrade: true });
setupGovdocCommand({ pattern: "gazette", slug: "gazette", label: "Gazette", requiresGrade: false });
