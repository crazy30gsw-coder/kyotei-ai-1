import fs from "fs";

const KKK = process.env.KKK;

function nowId() {
  return Date.now();
}

function ensureArrayPosts(data) {
  // posts.json が壊れてても復旧できるようにする
  if (Array.isArray(data)) return data;
  if (data && Array.isArray(data.posts)) return data.posts;
  return [];
}

async function genByOpenAI() {
  if (!O) OPENAI_API_KEY
    // キー未設定でも動作確認できるようにフォールバック
    return {
      title: "【テスト】OPENAI_API_KEY未設定（仮記事）",
      summary: "OPENAI_API_KEY が未登録なので仮記事を生成しました。Secretsを確認してください。",
      body: "OPENAI_API_KEY が未登録です。GitHub Secrets に OPENAI_API_KEY を追加してください。",
    };
  }

  // OpenAI Responses API（推奨）
  const prompt = `
あなたは競艇記事の編集者です。
初心者にも分かるように、今日の「買い目の考え方」を短めに記事化してください。
・断定しすぎない（オッズ/直前気配/取消など不確定要素は断定しない）
・見出し付き
・最後に注意書き（ギャンブルは自己責任、的中保証なし）
出力は必ずJSONで：
{"title":"...", "summary":"...", "body":"..."}
`;

  const res = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      input: prompt,
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`OpenAI API error: ${res.status} ${t}`);
  }

  const json = await res.json();
  const text = json.output_text || "";
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    // たまにJSON以外が混ざる想定で救済
    parsed = {
      title: "【生成失敗】JSON解析できませんでした",
      summary: "OpenAIの応答がJSON形式になりませんでした。プロンプトを調整してください。",
      body: text,
    };
  }
  return parsed;
}

function renderHtml({ title, body }) {
  // 超シンプルな記事ページ
  return `<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width,initial-scale=1"/>
  <title>${escapeHtml(title)}</title>
  <style>
    body{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial;max-width:820px;margin:24px auto;padding:0 14px;line-height:1.7}
    h1{font-size:22px;margin:0 0 14px}
    .meta{color:#666;font-size:13px;margin-bottom:18px}
    .box{background:#111;color:#fff;padding:10px 12px;border-radius:10px;font-size:13px}
    pre{white-space:pre-wrap}
  </style>
</head>
<body>
  <h1>${escapeHtml(title)}</h1>
  <div class="meta">${new Date().toLocaleString("ja-JP")}</div>
  <div>${nl2br(escapeHtml(body))}</div>
  <hr/>
  <div class="box">※本記事は情報提供です。投票は自己責任でお願いします（的中保証なし）。</div>
</body>
</html>`;
}

function escapeHtml(s = "") {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function nl2br(s = "") {
  return String(s).replaceAll("\n", "<br/>");
}

async function main() {
  // posts.json 読み込み（なければ新規）
  let raw = "[]";
  try {
    raw = fs.readFileSync("posts.json", "utf8");
  } catch {}
  let data;
  try {
    data = JSON.parse(raw);
  } catch {
    data = [];
  }
  const posts = ensureArrayPosts(data);

  // 1記事生成
  const g = await genByOpenAI();
  const id = nowId();
  const postPath = `posts/${id}.html`;

  fs.mkdirSync("posts", { recursive: true });
  fs.writeFileSync(postPath, renderHtml({ title: g.title, body: g.body }), "utf8");

  // 一覧に追加（先頭）
  posts.unshift({
    id,
    title: g.title,
    summary: g.summary,
    date: new Date().toISOString(),
    link: `./${postPath}`,
  });

  fs.writeFileSync("posts.json", JSON.stringify(posts, null, 2), "utf8");
  console.log("OK: added", postPath);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});