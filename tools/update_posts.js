import fs from "fs";
import fetch from "node-fetch";

const API_KEY = process.env.OPENAI_API_KEY || process.env.KKK;
if (!API_KEY) throw new Error("OpenAI API key (OPENAI_API_KEY or KKK) が設定されていません");

const POSTS_PATH = "./posts.json";
const POSTS_DIR = "./posts";

// GitHub Pagesで repo配下でも壊れないように「相対リンク」で出す
const makePostLink = (id) => `posts/${id}.html`;

if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });

const BASE_PROMPT = `
あなたは「競艇ニュースまとめ」編集長。
最新情報を初心者にも分かりやすく1記事書いてください。

必ず「JSONだけ」を返してください（前後に文章禁止）。

出力形式:
{
  "title": "タイトル",
  "summary": "50文字以内の概要",
  "body": "<p>本文HTML</p>"
}
`;

// Responses APIの返りからテキストを抽出
function extractTextFromResponses(data) {
  // よくある形：data.output[].content[].text
  try {
    const out = data?.output ?? [];
    for (const item of out) {
      const content = item?.content ?? [];
      for (const c of content) {
        if (c?.type === "output_text" && typeof c?.text === "string") return c.text;
        if (typeof c?.text === "string") return c.text;
      }
    }
  } catch {}
  // 予備：ありがちな別形
  if (typeof data?.output_text === "string") return data.output_text;
  if (typeof data?.text === "string") return data.text;
  return "";
}

// モデルが前後に文章を付けてもJSON部分だけ抜く
function safeJsonParse(text) {
  const trimmed = (text || "").trim();
  if (!trimmed) return null;

  // 最初の { から最後の } までを切り出す
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;

  const jsonStr = trimmed.slice(start, end + 1);
  return JSON.parse(jsonStr);
}

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
  const text = extractTextFromResponses(data);
  const obj = safeJsonParse(text);

  if (!obj?.title || !obj?.summary || !obj?.body) {
    throw new Error("AIの出力が想定JSONになってません: " + (text || "(empty)"));
  }
  return obj;
}

function loadPosts() {
  if (!fs.existsSync(POSTS_PATH)) return [];
  return JSON.parse(fs.readFileSync(POSTS_PATH, "utf8"));
}

function savePosts(posts) {
  fs.writeFileSync(POSTS_PATH, JSON.stringify(posts, null, 2), "utf8");
}

async function main() {
  const article = await createArticle();

  const id = Date.now();
  const filename = `${POSTS_DIR}/${id}.html`;

  fs.writeFileSync(
    filename,
    `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${article.title}</title>
</head>
<body>
  <h1>${article.title}</h1>
  <p>${article.summary}</p>
  ${article.body}
  <p><a href="../index.html">← 戻る</a></p>
</body>
</html>`,
    "utf8"
  );

  const posts = loadPosts();
  posts.unshift({
    id,
    title: article.title,
    summary: article.summary,
    date: new Date().toISOString(),
    link: makePostLink(id), // ← ここ超重要（先頭/なし）
  });

  savePosts(posts);

  console.log("✅ 記事を追加しました:", article.title);
}

main().catch((e) => {
  console.error("❌ Error:", e);
  process.exit(1);
});