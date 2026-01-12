import fs from "fs";
import path from "path";
import crypto from "crypto";
import fetch from "node-fetch";

// ====== Config ======
const API_KEY = process.env.OPENAI_API_KEY || process.env.KKK;
if (!API_KEY) throw new Error("OpenAI API key (OPENAI_API_KEY or KKK) が設定されていません");

const CFG_PATH = "./sources.json";
const POSTS_JSON = "./posts.json";
const POSTS_DIR = "./posts";

const cfg = JSON.parse(fs.readFileSync(CFG_PATH, "utf8"));
const SITE_TITLE = cfg.siteTitle || "まとめ速報";
const MAX_NEW = Number(cfg.maxNewPostsPerRun || 3);

// Ensure dirs/files
if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });
if (!fs.existsSync(POSTS_JSON)) fs.writeFileSync(POSTS_JSON, "[]", "utf8");

// ====== Helpers ======
const sha1 = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);

function loadPosts() {
  return JSON.parse(fs.readFileSync(POSTS_JSON, "utf8"));
}
function savePosts(posts) {
  fs.writeFileSync(POSTS_JSON, JSON.stringify(posts, null, 2), "utf8");
}

function escapeHtml(str = "") {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${url}`);
  return await res.text();
}

// Very small RSS parser (good enough for RSS2.0/Atom basic)
function pickTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? m[1].trim() : "";
}
function stripCdata(s) {
  return s.replace(/^<!\\[CDATA\\[/, "").replace(/\\]\\]>$/, "");
}
function decodeEntities(s) {
  return s
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&#039;", "'");
}

function parseRssItems(xml) {
  // RSS <item> or Atom <entry>
  const items = [];
  const rssItems = xml.match(/<item[\\s\\S]*?<\\/item>/gi) || [];
  const atomItems = xml.match(/<entry[\\s\\S]*?<\\/entry>/gi) || [];

  const blocks = rssItems.length ? rssItems : atomItems;

  for (const block of blocks) {
    const title = decodeEntities(stripCdata(pickTag(block, "title")));
    let link = pickTag(block, "link");

    // Atom: <link href="..."/>
    if (!link) {
      const m = block.match(/<link[^>]*href="([^"]+)"[^>]*\\/>/i);
      if (m) link = m[1];
    }

    const pubDate =
      pickTag(block, "pubDate") ||
      pickTag(block, "updated") ||
      pickTag(block, "published") ||
      "";

    if (title && link) items.push({ title, link, pubDate });
  }
  return items;
}

async function openaiSummarize({ title, url, sourceName }) {
  const prompt = `
あなたは「競艇ニュースまとめ」編集長です。
以下のニュースを“まとめサイト用の記事”に編集してください。

【制約】
- 断定しすぎない（未確認情報は「〜と報じられています」等）
- 誇張煽り禁止
- 初心者にわかる説明を入れる
- 出力は必ずJSONだけ

【入力】
タイトル: ${title}
URL: ${url}
出典: ${sourceName}

【出力JSON形式】
{
  "title": "記事タイトル（30字〜45字目安）",
  "summary": "概要（50〜80字）",
  "bodyHtml": "<p>本文</p><h2>ポイント</h2><ul><li>...</li></ul><h2>背景</h2><p>...</p><h2>今後の見どころ</h2><p>...</p>"
}
`.trim();

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: prompt,
      max_output_tokens: 900
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error("OpenAI API error: " + text);
  }

  const data = await res.json();
  const txt = (data.output_text || "").trim();

  // Try parse JSON safely
  let obj;
  try {
    obj = JSON.parse(txt);
  } catch {
    // fallback: extract first {...}
    const m = txt.match(/\{[\s\S]*\}/);
    obj = m ? JSON.parse(m[0]) : null;
  }

  if (!obj?.title || !obj?.bodyHtml) {
    throw new Error("AI output JSON parse failed. Raw=" + txt.slice(0, 300));
  }
  return obj;
}

function renderPostHtml({ siteTitle, title, summary, bodyHtml, sourceUrl, sourceName, dateIso }) {
  const safeTitle = escapeHtml(title);
  const safeSummary = escapeHtml(summary || "");
  const safeSourceUrl = escapeHtml(sourceUrl || "");
  const safeSourceName = escapeHtml(sourceName || "");
  const date = new Date(dateIso).toLocaleString("ja-JP");

  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>${safeTitle}｜${escapeHtml(siteTitle)}</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;margin:0;background:#fafafa}
    .wrap{max-width:900px;margin:0 auto;padding:16px}
    .card{background:#fff;border:1px solid #eee;border-radius:14px;padding:14px}
    .meta{opacity:.7;font-size:12px}
    a{color:inherit}
    h1{margin:0 0 8px}
    h2{margin-top:18px}
    .src{margin-top:14px}
  </style>
</head>
<body>
  <div class="wrap">
    <div class="card">
      <div class="meta">${date}</div>
      <h1>${safeTitle}</h1>
      <p>${safeSummary}</p>
      <hr/>
      ${bodyHtml}
      <div class="src meta">
        出典：<a href="${safeSourceUrl}" target="_blank" rel="noopener">${safeSourceName}</a>
      </div>
      <div class="meta"><a href="/">← トップへ</a></div>
    </div>
  </div>
</body>
</html>`;
}

async function main() {
  const existing = loadPosts();
  const existingIds = new Set(existing.map(p => p.sourceUrl).filter(Boolean));

  // 1) collect candidates from all RSS
  const candidates = [];
  for (const s of (cfg.sources || [])) {
    if (s.type !== "rss") continue;
    const xml = await fetchText(s.url);
    const items = parseRssItems(xml).slice(0, 20);
    for (const it of items) {
      candidates.push({
        title: it.title,
        sourceUrl: it.link,
        sourceName: s.name,
        category: s.category || "ニュース"
      });
    }
  }

  // 2) filter new
  const fresh = candidates.filter(c => c.sourceUrl && !existingIds.has(c.sourceUrl));
  if (fresh.length === 0) {
    console.log("No new RSS items.");
    return;
  }

  const targets = fresh.slice(0, MAX_NEW);
  const newPosts = [];

  // 3) generate posts
  for (const t of targets) {
    const id = sha1(t.sourceUrl);
    const outPath = path.join(POSTS_DIR, `${id}.html`);
    const pageLink = `/posts/${id}.html`;

    const gen = await openaiSummarize({
      title: t.title,
      url: t.sourceUrl,
      sourceName: t.sourceName
    });

    const html = renderPostHtml({
      siteTitle: SITE_TITLE,
      title: gen.title,
      summary: gen.summary,
      bodyHtml: gen.bodyHtml,
      sourceUrl: t.sourceUrl,
      sourceName: t.sourceName,
      dateIso: new Date().toISOString()
    });

    fs.writeFileSync(outPath, html, "utf8");

    newPosts.push({
      id,
      title: gen.title,
      summary: gen.summary || "",
      date: new Date().toISOString(),
      link: pageLink,
      sourceName: t.sourceName,
      sourceUrl: t.sourceUrl,
      category: t.category
    });

    console.log("Added:", gen.title);
  }

  // 4) merge/save (keep latest 500)
  const merged = [...newPosts, ...existing].slice(0, 500);
  savePosts(merged);

  console.log(`✅ Done. Added ${newPosts.length} post(s).`);
}

main().catch(e => {
  console.error("❌ Error:", e);
  process.exit(1);
});