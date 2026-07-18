# 互換性と検証

## 目次

- 互換性の確認面
- 変更別の回帰検知
- 現行コマンドの確認
- 完了判定

## 互換性の確認面

| 面 | 先に記録するもの | 変更後の主な確認 |
|----|------------------|------------------|
| Markdown・frontmatter | 入力形式、未知項目、往復保持 | parser・serializer、fixture、差分 |
| 設定・保存済みdata | schema version、既定値、移行、atomic write | 旧形式読込、競合、失敗後、再起動 |
| workspace・file | root境界、path規則、外部変更、保存待ち | 一時directory、競合、切替、復旧 |
| IPC・公開型 | channel、method、input/output、limits | shared・preload・main契約検査 |
| UI・操作 | 画面構成、focus、mouse、keyboard、drag | 状態遷移test、必要なら開発版 |
| CSS・asset | import順、selector責務、font・image参照 | build出力、見た目、残存参照 |
| 性能 | fixture、fingerprint、warmup、回数、I/O | 同条件の中央値、内訳、正しさ |
| 配布 | ASAR entry、resources、OS差、legal files | safe build/check、内容report |

## 変更別の回帰検知

- 純粋処理: 境界値、未知入力、順序、round tripを対象moduleのtestで固定する。
- 状態所有: 二重source of truth、更新順、購読解除、reset、workspace切替を確認する。
- 永続化: read/write/updateの全組合せ、atomicity、migration、先行失敗、異なるpathの並行性を確認する。
- 非同期: 古い完了の無視、Abort、timeout、retry、backoff、終了、再開、通知の重複を確認する。
- cache・索引: full build、cache hit/miss、単一file無効化、削除・rename、外部変更、unreadable fileを確認する。
- renderer: render回数だけでなく、描画停止と全再開trigger、同一frameの重複予約、unmount後の処理を確認する。
- architecture: 禁止依存、Node・Electron APIの流入、循環依存、公開面の増加を確認する。
- Renderer production: production buildの成立と、保護対象dependencyが初期静的import経路へ含まれないことを確認する。容量と増加率は合否条件にしない。
- 配布: runtime必須entryと禁止entry、source map、source・test混入、LICENSE、第三者通知、SBOMを確認する。

## 現行コマンドの確認

必ず `app/package.json` と `docs/development.md` を読み、存在するscriptだけを選ぶ。現行HEADでは次の分類があるが、名前や内容が変わっていないか実行時に再確認する。

| 目的 | 現行の入口 |
|------|------------|
| 対象test | `pnpm test:node`、`pnpm test:renderer`、または対象fileをVitestへ渡す |
| 型と通常test | `pnpm verify` |
| coverage | `pnpm test:coverage` |
| 境界・循環 | `pnpm architecture:check` |
| 文書索引 | `pnpm docs:index:check` |
| source規模の候補抽出 | `pnpm source:size` |
| Renderer production build・初期静的import | `pnpm renderer:production:check` |
| workspace性能 | `pnpm performance:workspace`、`pnpm performance:workspace:large` |
| license・SBOM | `pnpm licenses:check` |
| 配布内容 | 対象OSのsafe buildまたはsafe checkとpackage content report |

狭いtestから始め、影響が広がるたびに検証面を追加する。`verify:full` の成功だけでRenderer production境界、license、性能、OS別配布まで確認済みとは表現しない。

## 完了判定

検査の成功表示だけで完了にしない。次を確認する。

1. 検査対象が今回変えた契約と失敗経路を含む。
2. baselineと変更後が同じ条件で比較されている。
3. 数値改善のために正しさ、安全条件、遅延処理の完了を失っていない。
4. 既存失敗は開始時点の証拠があり、今回の差分が悪化させていない。
5. 生成物と差分に一時fixture、coverage、build出力、local pathが残っていない。
6. 未確認OSや測定不能な指標を明示している。
