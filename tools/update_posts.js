
import fs from "fs";

const POSTS_PATH = "posts.json";
const POSTS_DIR = "posts";

function loadPosts() {
  if (!fs.existsSync(POSTS_PATH)) return [];
  try {
    const raw = fs.readFileSync(POSTS_PATH, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function escapeHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function writePostPage(post) {
  ensureDir(POSTS_DIR);

  const title = escapeHtml(post.title);
  const summary = escapeHtml(post.summary || "");
  const date = escapeHtml(post.date || "");
  const body = escapeHtml(post.body || "");

  const html = `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>${title}</title>
</head>
<body style="max-width:760px;margin:24px auto;font-family:system-ui;line-height:1.7;padding:0 16px">
  <a href="../index.html">← 戻る</a>
  <h1>${title}</h1>
  <div style="opacity:.7">${date}</div>
  <p>${summary}</p>
  <hr />
  <pre style="white-space:pre-wrap">${body}</pre>
</body>
</html>`;

  fs.writeFileSync(`${POSTS_DIR}/${post.id}.html`, html, "utf8");
}

function main() {
  const posts = loadPosts();

  // テスト記事を1つ追加（まず動作確認用）
  const id = Date.now();
  const post = {
    id,
    title: "【テスト】記事ページ生成 OK",
    summary: "記事ページ（/posts/ID.html）が自動で作られました。",
    date: new Date().toISOString(),
    body: "これは自動生成のテスト本文です。\n次はここをAI生成に置き換えます。",
    link: `./posts/${id}.html`,
  };

  // 先頭に追加
  posts.unshift(post);

  // ページ生成
  writePostPage(post);

  // posts.json 保存
  fs.writeFileSync(POSTS_PATH, JSON.stringify(posts, null, 2), "utf8");

  console.log("OK: added post + generated page:", post.link);
}

main();