import fs from "fs";
import path from "path";

const POSTS_JSON = "posts.json";
const POSTS_DIR = "posts";

// ---------- util ----------
function escapeHtml(str = "") {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderHtml({ title, body }) {
  return `<!doctype html>
<html lang="ja">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)}</title>
<style>
body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Helvetica,Arial;max-width:760px;margin:40px auto;padding:0 16px;line-height:1.8}
h1{font-size:1.6em}
</style>
</head>
<body>
<h1>${escapeHtml(title)}</h1>
<div>${body}</div>
</body>
</html>`;
}

// ---------- main ----------
async function main() {
  const apiKey = process.env.KKK;
  if (!apiKey) {
    throw new Error("OPENAI API key (KKK) が設定されていません");
  }

  // posts.json 読み込み
  let posts = [];
  if (fs.existsSync(POSTS_JSON)) {
    posts = JSON.parse(fs.readFileSync(POSTS_JSON, "utf-8"));
  }

  // OpenAI に記事生成を依頼（テスト用・必ずJSONで返させる）
  const res = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            "あなたは日本語の記事生成AIです。必ずJSONのみで返してください。",
        },
        {
          role: "user",
          content: `
以下のJSON形式で記事を1本生成してください。

{
  "title": "記事タイトル",
  "summary": "記事の要約",
  "body": "<p>HTML本文</p>"
}
          `,
        },
      ],
      temperature: 0.7,
    }),
  });

  const json = await res.json();
  const text = json.choices?.[0]?.message?.content || "";

  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    parsed = {
      title: "【生成失敗】JSON解析エラー",
      summary: "OpenAIの返答がJSONになりませんでした。",
      body: `<pre>${escapeHtml(text)}</pre>`,
    };
  }

  // 記事ID & パス
  const id = Date.now();
  if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR);
  const htmlPath = `${POSTS_DIR}/${id}.html`;

  // HTML生成
  const html = renderHtml(parsed);
  fs.writeFileSync(htmlPath, html, "utf-8");

  // posts.json 先頭に追加
  posts.unshift({
    id,
    title: parsed.title,
    summary: parsed.summary,
    date: new Date().toISOString(),
    link: `./${htmlPath}`,
  });

  fs.writeFileSync(POSTS_JSON, JSON.stringify(posts, null, 2), "utf-8");

  console.log("記事を1本追加しました:", parsed.title);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});