#!/bin/zsh

set -u

cd "$(dirname "$0")/../app"

echo "Relic を起動しています..."
echo ""

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm が見つかりませんでした。"
  echo "開発環境の準備が必要です。Codex に続きを依頼してください。"
  echo ""
  echo "Enterキーを押すと閉じます。"
  read -r
  exit 1
fi

pnpm start

echo ""
echo "Relic が終了しました。Enterキーを押すと閉じます。"
read -r
