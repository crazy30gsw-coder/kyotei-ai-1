import fs from "fs";
import fetch from "node-fetch";

const API_KEY = process.env.OPENAI_API_KEY || process.env.KKK;
if (!API_KEY) throw new Error("OpenAI API key (OPENAI_API_KEY or KKK) が設定されていません");

const POSTS_PATH = "./posts.json";
const POSTS_DIR = "./posts";

if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });

const BASE_PROMPT = `
あなたは「競艇ニュースまとめ」編集長。
最新情報を初心者にも分かりやすく1記事書いてください。

出力形式:
{
"title": "タイトル",
"summary": "50文字以内の概要",
"body": "<p>本文HTML</p>"
}
`;

async function createArticle() {
  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: BASE_PROMPT,
      max_output_tokens: 800,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error("OpenAI API error: " + text);
  }

  const data = await res.json();
  const output = JSON.parse(data.output_text || "{}");
  return output;
}

function loadPosts() {
  if (!fs.existsSync(POSTS_PATH)) return [];
  return JSON.parse(fs.readFileSync(POSTS_PATH, "utf8"));
}

function savePosts(posts) {
  fs.writeFileSync(POSTS_PATH, JSON.stringify(posts, null, 2));
}

async function main() {
  const article = await createArticle();

  const id = Date.now();
  const filename = `${POSTS_DIR}/${id}.html`;
  fs.writeFileSync(filename, `
  <html><head><meta charset="utf-8"><title>${article.title}</title></head>
  <body><h1>${article.title}</h1><p>${article.summary}</p>${article.body}</body></html>`);

  const posts = loadPosts();
  posts.unshift({
    id,
    title: article.title,
    summary: article.summary,
    date: new Date().toISOString(),
    link: `/posts/${id}.html`,
  });
  savePosts(posts);

  console.log("✅ 記事を追加しました:", article.title);
}

main().catch(e => {
  console.error("❌ Error:", e);
  process.exit(1);
});