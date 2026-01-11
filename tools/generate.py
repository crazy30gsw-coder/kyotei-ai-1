from datetime import datetime, timezone, timedelta
from pathlib import Path
import re

JST = timezone(timedelta(hours=9))
SITE_TITLE = "競艇予想まとめ（自動更新）"
BASE_URL = "./"  # GitHub Pagesのプロジェクト配下想定

DISCLAIMER = (
    "本ページの内容は、公開情報や一般的傾向にもとづく整理・見解であり、的中を保証するものではありません。"
    "投票は自己責任で行ってください。直前のオッズ・出走取消・気象など当日変動要素は反映できない場合があります。"
)

def today_str():
    return datetime.now(JST).strftime("%Y-%m-%d")

def render_post(date_s: str) -> str:
    title = f"{date_s}｜競艇テンプレ（自動更新テスト）"
    points = [
        "この記事は自動更新の動作確認用テンプレです（後で実データ連携に置き換え可能）。",
        "現時点では断定表現を避け、一般的傾向の整理に留めます。",
        "買い目は「点数固定の型」を確認するためのダミーです。"
    ]
    bets = ["1-2-3", "1-3-2", "2-1-3"]  # ダミー（点数固定）

    li_points = "\n".join([f"<li>{p}</li>" for p in points])
    li_bets = "\n".join([f"<li>{b}</li>" for b in bets])

    return f"""<!doctype html>
<html lang="ja">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1" />
  <title>{title}</title>
  <meta name="description" content="競艇予想のテンプレ記事（自動更新テスト）。的中保証なし。" />
  <style>
    body{{font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;max-width:860px;margin:0 auto;padding:18px;line-height:1.7}}
    header{{padding:14px 0;border-bottom:1px solid #ddd;margin-bottom:16px}}
    h1{{font-size:22px;margin:0}}
    .card{{border:1px solid #e5e5e5;border-radius:12px;padding:14px;margin:12px 0}}
    .muted{{color:#666;font-size:13px}}
    a{{color:inherit}}
  </style>
</head>
<body>
  <header>
    <div class="muted"><a href="{BASE_URL}index.html">← トップに戻る</a></div>
    <h1>{title}</h1>
    <div class="muted">更新：{date_s}（JST）</div>
  </header>

  <div class="card">
    <h2 style="margin:0 0 8px;font-size:18px;">本文（テンプレ）</h2>
    <ul>
      {li_points}
    </ul>

    <h3 style="margin:14px 0 8px;font-size:16px;">買い目（3点）</h3>
    <ul>
      {li_bets}
    </ul>

    <div class="muted" style="margin-top:10px;">免責：{DISCLAIMER}</div>
  </div>
</body>
</html>
"""

def update_index(post_rel_path: str, date_s: str):
    index_path = Path("index.html")
    if not index_path.exists():
        raise FileNotFoundError("index.html が見つかりません（先に作成済みのはず）")

    html = index_path.read_text(encoding="utf-8")

    # 最新記事リスト領域が無ければ追加
    marker = "<!-- AUTO_POSTS -->"
    if marker not in html:
        insert = f"""
  <div class="card">
    <h2 style="margin:0 0 8px;font-size:18px;">最新記事</h2>
    <ul>
      {marker}
    </ul>
    <div class="muted">※ここは自動更新で追記されます</div>
  </div>
</body>"""
        html = re.sub(r"</body>\s*</html>\s*$", insert + "\n</html>", html, flags=re.S)

    # すでに同日記事がリンクされてたら何もしない
    if post_rel_path in html:
        index_path.write_text(html, encoding="utf-8")
        return

    new_li = f'      <li><a href="{post_rel_path}">{date_s} の記事</a></li>\n      {marker}'
    html = html.replace(marker, new_li, 1)
    index_path.write_text(html, encoding="utf-8")

def main():
    date_s = today_str()
    posts_dir = Path("posts")
    posts_dir.mkdir(parents=True, exist_ok=True)

    post_name = f"{date_s}.html"
    post_path = posts_dir / post_name
    post_rel = f"posts/{post_name}"

    # 同日記事が既にあれば作らない（安全）
    if not post_path.exists():
        post_path.write_text(render_post(date_s), encoding="utf-8")

    update_index(post_rel, date_s)

if __name__ == "__main__":
    main()
