// tools/update_posts.js
// RSSから最新記事を拾って posts.json に追加（本文コピペなし／要約は自作）

import fs from "fs";

const POSTS_PATH = "posts.json";
const MAX_POSTS = 80;

// まずは動作確認用のRSS（あとで増やせる）
const RSS_SOURCES = [
  { cat: "news", name: "NHK主要", url: "https://www.nhk.or.jp/rss/news/cat0.xml" },
  { cat: "news", name: "ITmedia NEWS", url: "https://rss.itmedia.co.jp/rss/2.0/news_bursts.xml" }
];

function jstNow() {
  const now = new Date();
  return new Intl.DateTimeFormat("ja-JP", {
    timeZone: "Asia/Tokyo",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit"
  }).format(now).replace(/\//g, "-");
}

function loadPosts() {
  if (!fs.existsSync(POSTS_PATH)) return { posts: [] };
  try { return JSON.parse(fs.readFileSync(POSTS_PATH, "utf8")); }
  catch { return { posts: [] }; }
}

function savePosts(data) {
  fs.writeFileSync(POSTS_PATH, JSON.stringify(data, null, 2), "utf8");
}

function extractItems(xml) {
  const items = [];
  const blocks = xml.match(/<item[\s\S]*?<\/item>/g) || [];
  for (const block of blocks.slice(0, 10)) {
    const title = (block.match(/<title><!CDATA\[([\s\S]*?)\]><\/title>/) ||
                   block.match(/<title>([\s\S]*?)<\/title>/))?.[1]?.trim();
    const link  = (