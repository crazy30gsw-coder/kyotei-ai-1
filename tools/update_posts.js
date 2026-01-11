// tools/update_posts.js
// posts.json を毎日1件追加（まずは自動更新の動作確認用）
// 後で「RSS取得→要約→カテゴリ振り分け」に進化させる

import fs from "fs";

const path = "posts.json";
const now = new Date();
const jst = new Intl.DateTimeFormat("ja-JP", {
  timeZone: "Asia/Tokyo",
  year: "numeric", month: "2-digit", day: "2-digit",
  hour: "2-digit", minute: "2-digit"
}).format(now).replace(/\//g, "-");

let data = { posts: [] };
if (fs.existsSync(path)) {
  data = JSON.parse(fs.readFileSync(path, "utf8"));
}

const nextId = String((data.posts?.[0]?.id ? Number(data.posts[0].id) : data.posts.length) + 1);

const newPost = {
  id: nextId,
  cat: "kyotei",
  time: jst,
  title: `【自動更新テスト】${jst} の更新`,
  excerpt: "Actionsでposts.jsonを自動更新しています（テスト投稿）。",
  thumb: ""
};

// 最新が先頭
data.posts = [newPost, ...(data.posts || [])].slice(0, 80);

fs.writeFileSync(path, JSON.stringify(data, null, 2), "utf8");
console.log("updated posts.json with id =", nextId);