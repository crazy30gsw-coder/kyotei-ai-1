// tools/update_posts.js
import fs from "fs";
import path from "path";

const POSTS_JSON = "posts.json";
const POSTS_DIR = "posts";

if (!fs.existsSync(POSTS_DIR)) {
  fs.mkdirSync(POSTS_DIR);
}

let posts = [];
if (fs.existsSync(POSTS_JSON)) {
  posts = JSON.parse(fs.readFileSync(POSTS_JSON, "utf-8"));
}

const id = Date.now();
const title = "【テスト】GitHub Actions から記事生成";
const body = `
<h1>${title}</h1>
<p>これは GitHub Actions によって自動生成されたテスト記事です。</p>
<p>生成日時：${new Date().toISOString()}</p>
`;

const filename = `${POSTS_DIR}/${id}.html`;
fs.writeFileSync(filename, body, "utf-8");

posts.unshift({
  id,
  title,
  summary: "自動生成テスト記事",
  date: new Date().toISOString(),
  link: `./posts/${id}.html`
});

fs.writeFileSync(POSTS_JSON, JSON.stringify(posts, null, 2), "utf-8");

console.log("✅ 記事を1件追加しました");await fs.writeFile("index.html", renderIndex(posts));