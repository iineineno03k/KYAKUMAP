#!/usr/bin/env bash
# .env.example から .env.local を作る。
#
#   npm run setup                 # 対話でキーを聞く
#   npm run setup -- sk-orca-xxx  # 引数で渡す
#   ORCAROUTER_API_KEY=sk-orca-xxx npm run setup   # 環境変数で渡す（CI向け）
#
# 既存の .env.local は上書きせず、キー行だけ差し替えるか中断するかを選べる。

set -euo pipefail

cd "$(dirname "$0")/.."

EXAMPLE=".env.example"
TARGET=".env.local"

red()   { printf '\033[31m%s\033[0m\n' "$1"; }
green() { printf '\033[32m%s\033[0m\n' "$1"; }
dim()   { printf '\033[2m%s\033[0m\n' "$1"; }

[ -f "$EXAMPLE" ] || { red "✗ $EXAMPLE がありません。app/ 直下で実行してください。"; exit 1; }

# ── 1. キーを受け取る ──────────────────────────────────────────
KEY="${1:-${ORCAROUTER_API_KEY:-}}"

if [ -z "$KEY" ]; then
  echo "OrcaRouter の APIキーを入力してください。"
  dim "  未取得なら https://www.orcarouter.ai で GitHub サインアップ（カード不要）"
  dim "  ハッカソン参加者は配布バウチャーでクレジットを追加できます"
  printf 'ORCAROUTER_API_KEY: '
  # 端末にキーを表示しない
  stty -echo 2>/dev/null || true
  read -r KEY
  stty echo 2>/dev/null || true
  echo
fi

KEY="$(printf '%s' "$KEY" | tr -d '[:space:]')"

if [ -z "$KEY" ]; then
  red "✗ キーが空です。中断します。"
  exit 1
fi

case "$KEY" in
  sk-orca-*) ;;
  *) red "! キーが sk-orca- で始まっていません。OrcaRouter のキーか確認してください（OpenRouter や OpenAI のキーではありません）。"
     if [ -t 0 ]; then
       printf 'このまま続けますか? [y/N]: '
       read -r ans
       case "$ans" in [yY]*) ;; *) echo "中断しました。"; exit 1;; esac
     else
       dim "  非対話実行なのでこのまま続けます。"
     fi
     ;;
esac

# ── 2. .env.local を作る ───────────────────────────────────────
if [ -f "$TARGET" ]; then
  echo "$TARGET は既にあります。"
  if [ -t 0 ]; then
    printf '  [1] キー行だけ差し替える（他の設定は残す）\n  [2] .env.example から作り直す（既存はバックアップ）\n  [3] 中断\n選択 [1]: '
    read -r choice
  else
    choice=1
    dim "  非対話実行なので [1] キー行だけ差し替え を選びました。"
  fi
  case "${choice:-1}" in
    1)
      # ORCAROUTER_API_KEY の行だけ置換。無ければ追記。
      if grep -q '^ORCAROUTER_API_KEY=' "$TARGET"; then
        tmp="$(mktemp)"
        # sed のエスケープを避けるため awk で置換する
        KEY="$KEY" awk '/^ORCAROUTER_API_KEY=/ { print "ORCAROUTER_API_KEY=" ENVIRON["KEY"]; next } { print }' "$TARGET" > "$tmp"
        mv "$tmp" "$TARGET"
      else
        printf 'ORCAROUTER_API_KEY=%s\n' "$KEY" >> "$TARGET"
      fi
      ;;
    2)
      backup="$TARGET.bak.$(date +%Y%m%d%H%M%S)"
      cp "$TARGET" "$backup"
      dim "  既存を $backup に退避しました"
      KEY="$KEY" awk '/^ORCAROUTER_API_KEY=/ { print "ORCAROUTER_API_KEY=" ENVIRON["KEY"]; next } { print }' "$EXAMPLE" > "$TARGET"
      ;;
    *) echo "中断しました。"; exit 0;;
  esac
else
  KEY="$KEY" awk '/^ORCAROUTER_API_KEY=/ { print "ORCAROUTER_API_KEY=" ENVIRON["KEY"]; next } { print }' "$EXAMPLE" > "$TARGET"
fi

chmod 600 "$TARGET"
green "✓ $TARGET を作成しました（chmod 600 / .gitignore 済み）"

# ── 3. .gitignore の確認（キー流出の最後の砦）────────────────────
if ! git check-ignore -q "$TARGET" 2>/dev/null; then
  red "✗ 警告: $TARGET が .gitignore されていません。コミットする前に必ず対処してください。"
  exit 1
fi
dim "  git check-ignore: $TARGET は追跡対象外です"

# ── 4. 依存 ───────────────────────────────────────────────────
if [ ! -d node_modules ]; then
  echo
  echo "依存をインストールします…"
  npm install
fi

# ── 5. 疎通確認 ───────────────────────────────────────────────
echo
echo "OrcaRouter への疎通を確認します…"
if node scripts/probe.mjs chat; then
  echo
  green "✓ セットアップ完了。'npm run dev' で http://localhost:3000 が立ち上がります。"
  dim "  全機能の疎通確認: npm run probe"
  dim "  型・ペルソナの事前生成: npm run build:judgments && npm run build:personas"
else
  echo
  red "✗ 疎通に失敗しました。キーとクレジット残高を確認してください。"
  dim "  残高: npm run probe -- billing"
  exit 1
fi
