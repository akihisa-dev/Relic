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

echo "依存関係を確認しています..."
if ! pnpm install --fetch-timeout 300000 --fetch-retries 5 --network-concurrency 2; then
  echo ""
  echo "依存関係の準備に失敗しました。"
  echo "インターネット接続、VPN、プロキシ設定を確認してから、もう一度このファイルを実行してください。"
  echo "Enterキーを押すと閉じます。"
  read -r
  exit 1
fi
echo ""

if ! CI=1 pnpm start; then
  echo ""
  echo "Relic の起動に失敗しました。"
  echo "Enterキーを押すと閉じます。"
  read -r
  exit 1
fi

echo ""
echo "Relic が終了しました。Enterキーを押すと閉じます。"
read -r
