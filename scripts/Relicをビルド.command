#!/bin/zsh

set -u

cd "$(dirname "$0")/../app"

echo "Relic をビルドしています..."
echo "（数分かかります）"
echo ""

if ! command -v pnpm >/dev/null 2>&1; then
  echo "pnpm が見つかりませんでした。"
  echo "開発環境の準備が必要です。Codex に続きを依頼してください。"
  echo ""
  echo "Enterキーを押すと閉じます。"
  read -r
  exit 1
fi

if ! pnpm build:mac:safe; then
  echo ""
  echo "ビルドに失敗しました。"
  echo "Enterキーを押すと閉じます。"
  read -r
  exit 1
fi

echo ""
echo "ビルドが完了しました。"
echo "app/out/darwin/ フォルダに Relic.app と DMG が生成されています。"
echo ""
echo "Enterキーを押すと閉じます。"
read -r
