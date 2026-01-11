import fs from "fs";

const FILE = "posts.json";

// もし posts.json がなければ作る
let posts = [];
if (fs.existsSync(FILE)) {
  posts = JSON.parse(fs.readFileSync(FILE, "utf-8"));
}

// 強制的に1記事追加
posts.unshift({
  id: Date.now(),
  title: "【テスト】自動投稿が成功しました",
  summary: "GitHub Actions から自動で追加されたテスト記事です。",
  date: new Date().toISOString(),
  link: "#"
});

fs.writeFileSync(FILE, JSON.stringify(posts, null, 2));
console.log("✅ posts.json updated");