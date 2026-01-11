import fs from "fs";

const FILE = "posts.json";

const now = new Date().toISOString();

let posts = [];
if (fs.existsSync(FILE)) {
  posts = JSON.parse(fs.readFileSync(FILE, "utf-8"));
}

posts.unshift({
  id: Date.now(),
  title: "テスト記事：競艇AI予想が自動更新されました",
  summary: "GitHub Actionsから自動生成されたテスト記事です。",
  date: now,
  link: "#"
});

fs.writeFileSync(FILE, JSON.stringify(posts, null, 2));

console.log("posts.json updated");
