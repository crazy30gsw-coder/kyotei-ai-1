import fs from "fs";
import path from "path";
import crypto from "crypto";
import fetch from "node-fetch";

// ====== Config ======
const API_KEY = process.env.OPENAI_API_KEY || process.env.KKK;
if (!API_KEY) throw new Error("OpenAI API key (OPENAI_API_KEY or KKK) が設定されていません");

const CFG_PATH = "./sources.json";
const POSTS_JSON = "./posts.json";
const POSTS_DIR = "./posts";

const cfg = JSON.parse(fs.readFileSync(CFG_PATH, "utf8"));
const SITE_TITLE = cfg.siteTitle || "まとめ速報";
const MAX_NEW = Number(cfg.maxNewPostsPerRun || 3);

// Ensure dirs/files
if (!fs.existsSync(POSTS_DIR)) fs.mkdirSync(POSTS_DIR, { recursive: true });
if (!fs.existsSync(POSTS_JSON)) fs.writeFileSync(POSTS_JSON, "[]", "utf8");

// ====== Helpers ======
const sha1 = (s) => crypto.createHash("sha1").update(s).digest("hex").slice(0, 12);

function loadPosts() {
  return JSON.parse(fs.readFileSync(POSTS_JSON, "utf8"));
}
function savePosts(posts) {
  fs.writeFileSync(POSTS_JSON, JSON.stringify(posts, null, 2), "utf8");
}

function escapeHtml(str = "") {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function fetchText(url) {
  const res = await fetch(url, { redirect: "follow" });
  if (!res.ok) throw new Error(`Fetch failed: ${res.status} ${url}`);
  return await res.text();
}

// Very small RSS parser (good enough for RSS2.0/Atom basic)
function pickTag(xml, tag) {
  const m = xml.match(new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, "i"));
  return m ? m[1].trim() : "";
}
function stripCdata(s) {
  return s.replace(/^<!\CDATA\\[/, "").replace(/\\\]>$/, "");
}
function decodeEntities(s) {
  return s
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&#039;", "'");
}

function parseRssItems(xml) {
  // RSS <item> or Atom <entry>
  const items = [];
  const rssItems = xml.match(/<item[\\s\\S]*?<\\/item>/gi) || [];
  const atomItems = xml.match(/<entry[\\s\\S]*?<\\/entry>/gi) || [];

  const blocks = rssItems.length ? rssItems : atomItems;

  for (const block of blocks) {
    const title = decodeEntities(stripCdata(pickTag(block, "title")));
    let link = pickTag(block, "link");

    // Atom: <link href="..."/>
    if (!link) {
      const m = block.match(/<link[^>]*href="([^"]+)"[^>]*\\/>/i);
      if (m) link = m[1];
    }

    const pubDate =
      pickTag(block, "pubDate") ||
      pickTag(block, "updated") ||
      pickTag(block, "published") ||
      "";

    if (title && link) items.push({ title, link, pubDate });
  }
  return items;
}

async function openaiSummarize({ title, url, sourceName }) {
  const prompt = `
あなたは「競艇ニュースまとめ」編集長です。
以下のニュースを“まとめサイト用の記事”に編集してください。

【制約】
- 断定しすぎない（未確認情報は「〜と報じられています」等）
- 誇張煽り禁止
- 初心者にわかる説明を入れる
- 出力は必ずJSONだけ

【入力】
タイトル: ${title}
URL