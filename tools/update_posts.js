import fs from "fs";
import fetch from "node-fetch";
import path from "path";

// =====================
// 環境変数
// =====================
const API_KEY = process.env.OPENAI_API_KEY || process.env.KKK;
if (!API_KEY) {
  console.error("❌ OpenAI API key が未設定 (OPENAI_API_KEY or KKK)");
  process.exit(1);
}

// =====================
// パス
// =====================
const ROOT = process.cwd();
const POSTS_JSON = path.join(ROOT, "posts.json");
const POSTS_DIR = path.join(ROOT, "posts");

// =====================
// 初期化
// =====================
if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });
if (!fs.existsSync(POSTS_JSON)) fs.writeFileSync(POSTS_JSON, "[]", "utf-8");

// =====================
// RSS設定（まずは1本で安定）
// =====================
const RSS_URL = "https://news.yahoo.co.jp/rss/topics/sports.xml";

// =====================
// RSS取得
// =====================
async function fetchRSS() {
  const res = await fetch(RSS_URL);
  if (!res.ok) throw new Error("RSS fetch failed");
  return await res.text();
}

// =====================
// RSS解析（正規表現は最小）
// =====================
function parseRSS(xml) {
  const items = [];
  const blocks = xml.split("<item>").slice(1);

  for (const block of blocks.slice(0, 3)) {
    const title = block.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1];
    const link = block.match(/<link>(.*?)<\/link>/)?.[1];
    if (title && link) {
      items.push({ title, link });
    }
  }
  return items;
}

// =====================
// AI要約
// =====================
async function summarize(title, url) {
  const prompt = `
以下のニュースを「競艇ニュースまとめ記事」として
初心者向けに要約してください。

タイトル: ${title}
URL: ${url}

出力形式（JSONのみ）:
{
  "title": "記事タイトル",
  "summary": "50文字以内",
  "body": "<p>本文HTML</p>"
}
`;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: prompt,
      max_output_tokens: 700,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(t);
  }

  const data = await res.json();
  return JSON.parse(data.output_text);
}

// =====================
// メイン
// =====================
async function main() {
  console.log("▶ RSS取得中");
  const xml = await fetchRSS();

  console.log("▶ RSS解析");
  const items = parseRSS(xml);
  if (items.length === 0) {
    console.log("⚠ 記事なし");
    return;
  }

  const posts = JSON.parse(fs.readFileSync(POSTS_JSON, "utf-8"));

  for (const item of items) {
    if (posts.some(p => p.sourceUrl === item.link)) continue;

    console.log("▶ 記事生成:", item.title);
    const article = await summarize(item.title, item.link);

    const id = Date.now();
    const file = `${id}.html`;

    fs.writeFileSync(
      path.join(POSTS_DIR, file),
      `<!doctype html>
<html lang="ja">
<head><meta charset="utf-8"><title>${article.title}</title></head>
<body>
<h1>${article.title}</h1>
<p>${article.summary}</p>
${article.body}
<p><a href="${item.link}" target="_blank">元記事</a></p>
</body>
</html>`,
      "utf-8"
    );

    posts.unshift({
      id,
      title: article.title,
      summary: article.summary,
      link: `/posts/${file}`,
      sourceUrl: item.link,
      date: new Date().toISOString()
    });
  }

  fs.writeFileSync(POSTS_JSON, JSON.stringify(posts.slice(0, 50), null, 2));
  console.log("✅ 更新完了");
}

main().catch(err => {
  console.error("❌ エラー", err);
  process.exit(1);
});