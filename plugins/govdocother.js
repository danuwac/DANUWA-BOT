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

        if (link && title && !items.find(p => p.link === link)) {
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

function setupGovdocCommand({ pattern, category, slug, label }) {
  cmd(
    {
      pattern,
      react: "📘",
      desc: `Download ${label} from govdoc.lk`,
      category: "education",
      filename: __filename,
    },
    async (robin, mek, m, { from, q, sender, reply }) => {
      if (!q || !/grade\s+\d+/i.test(q)) return reply(`❌ Example: .${pattern} grade 11`);

      const input = q.trim().toLowerCase().split(/\s+/);
      const gradeIndex = input.findIndex(w => w === "grade");
      const grade = input[gradeIndex + 1];
      if (!grade) return reply("❌ Grade missing. Use format like `.textbook grade 11`");

      const slugPath = `${slug}/grade-${grade}`;
      const items = await fetchGovdocItems(slugPath);

      if (!items.length) return reply(`❌ No ${label.toLowerCase()} found for grade ${grade}`);

      let msg = `📘 *GovDoc ${label}: Grade ${grade}*
────────────────────
_Reply with number to select item_

`;
      items.forEach((item, i) => {
        msg += `*${i + 1}.* ${item.title}\n`;
      });

      await robin.sendMessage(from, { text: msg }, { quoted: mek });

      pendingDownloads[sender] = {
        step: "select",
        results: items,
        quoted: mek,
      };
    }
  );

  cmd(
    {
      filter: (text, { sender }) =>
        pendingDownloads[sender] && pendingDownloads[sender].step === "select" && /^\d+$/.test(text.trim()),
    },
    async (robin, mek, m, { from, body, sender, reply }) => {
      const pending = pendingDownloads[sender];
      const selected = parseInt(body.trim());

      if (selected < 1 || selected > pending.results.length) {
        return reply("❌ Invalid selection.");
      }

      const selectedItem = pending.results[selected - 1];

      try {
        const { data } = await axios.get(selectedItem.link, { headers });
        const $ = cheerio.load(data);

        const downloadLink = $('a[href*="/view?id="]').attr("href");
        const langText = $('a[href*="/view?id="] button').text().trim() || "Document";

        if (!downloadLink) {
          delete pendingDownloads[sender];
          return reply("⚠️ No downloadable PDF found.");
        }

        const fullLink = downloadLink.startsWith("http") ? downloadLink : `https://govdoc.lk${downloadLink}`;

        const downloadDir = path.join(os.tmpdir(), `govdoc-${Date.now()}`);
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

        await page.goto(fullLink, { waitUntil: "networkidle2", timeout: 30000 });
        await page.waitForSelector('a.btn.w-100[href*="/download/"]', { timeout: 15000 });
        await page.click('a.btn.w-100[href*="/download/"]');

        let fileName;
        for (let i = 0; i < 20; i++) {
          const files = fs.readdirSync(downloadDir).filter(f => f.endsWith(".pdf"));
          if (files.length > 0) {
            fileName = files[0];
            break;
          }
          await new Promise(res => setTimeout(res, 1000));
        }

        await browser.close();

        if (!fileName) throw new Error("Download did not complete in time.");

        const filePath = path.join(downloadDir, fileName);
        const pdfBuffer = fs.readFileSync(filePath);
        const niceName = `${selectedItem.title} - ${langText}.pdf`;

        await robin.sendMessage(
          from,
          {
            document: pdfBuffer,
            mimetype: "application/pdf",
            fileName: niceName,
          },
          { quoted: mek }
        );

        fs.unlinkSync(filePath);
        fs.rmdirSync(downloadDir);
        delete pendingDownloads[sender];
      } catch (e) {
        console.error("❌ Puppeteer download failed:", e.message);
        reply("⚠️ Failed to download PDF.");
        delete pendingDownloads[sender];
      }
    }
  );
}

// 🔌 Initialize all plugins
setupGovdocCommand({ pattern: "textbook", category: "education", slug: "text-books", label: "Textbooks" });
setupGovdocCommand({ pattern: "tguide", category: "education", slug: "teacher-guides", label: "Teacher Guides" });
setupGovdocCommand({ pattern: "syllabus", category: "education", slug: "syllabus", label: "Syllabus" });
setupGovdocCommand({ pattern: "gazette", category: "education", slug: "gazette", label: "Gazette" });
