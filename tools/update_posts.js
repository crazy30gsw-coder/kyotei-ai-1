import fs from "fs";
import fetch from "node-fetch";

const API_KEY = process.env.OPENAI_API_KEY || process.env.KKK;
if (!API_KEY) {
  console.error("❌ OpenAI API key が未設定");
  process.exit(1);
}

const POSTS_JSON = "./posts.json";
const POSTS_DIR = "./posts";
if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR);

const RSS_URL = "https://news.yahoo.co.jp/rss/categories/sports.xml";

async function fetchRSS() {
  const res = await fetch(RSS_URL);
  const xml = await res.text();
  const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)];
  return items.slice(0, 3).map(m => {
    const t = m[1];
    const title = t.match(/<title>(.*?)<\/title>/)?.[1] || "";
    const link  = t.match(/<link>(.*?)<\/link>/)?.[1] || "";
    return { title, link };
  });
}

async function genArticle(src) {
  const prompt = `
あなたは競艇ニュースまとめ編集者。
以下の記事を要約し初心者向けに解説。

元タイトル: ${src.title}

出力JSON:
{
 "title": "...",
 "summary": "50文字以内",
 "body": "<p>本文HTML</p>"
}`;
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: prompt,
      max_output_tokens: 800
    })
  });
  const data = await res.json();
  return JSON.parse(data.output_text);
}

function loadPosts() {
  if (!fs.existsSync(POSTS_JSON)) return [];
  return JSON.parse(fs.readFileSync(POSTS_JSON,"utf8"));
}

async function main() {
  const rss = await fetchRSS();
  const posts = loadPosts();

  for (const r of rss) {
    if (posts.some(p => p.source === r.link)) continue;

    const art = await genArticle(r);
    const id = Date.now();
    const htmlPath = `${POSTS_DIR}/${id}.html`;

    fs.writeFileSync(htmlPath, `
<!doctype html><html><head>
<meta charset="utf-8">
<title>${art.title}</title>
</head><body>
<h1>${art.title}</h1>
<p>${art.summary}</p>
${art.body}
</body></html>`);

    posts.unshift({
      id,
      title: art.title,
      summary: art.summary,
      date: new Date().toISOString(),
      link: `./posts/${id}.html`,
      source: r.link
    });
  }

  fs.writeFileSync(POSTS_JSON, JSON.stringify(posts.slice(0,50), null, 2));
  console.log("✅ 記事生成完了");
}

main();