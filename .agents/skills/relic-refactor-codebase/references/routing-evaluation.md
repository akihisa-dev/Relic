# ルーティング評価

## 発火対象

| 依頼例 | 期待 |
|--------|------|
| Relic全体を大規模リファクタリングしてください | `relic-refactor-codebase` |
| 技術的な負債を包括的に解消してください | `relic-refactor-codebase` |
| 機能を変えず、構造と性能を全体的に改善してください | `relic-refactor-codebase` |
| 定期的なコードベース健全化を実施してください | `relic-refactor-codebase` |
| mainからrendererまで含む検索領域を包括的に整理してください | `relic-refactor-codebase` と対象機能Skill |

## 単独では対象外

| 依頼例 | 優先する責務 |
|--------|--------------|
| ボタンの色を変えてください | `relic-change-ui` |
| 翻訳を修正してください | `relic-change-localization` |
| この1件のtest失敗を直してください | `relic-test-code` と対象機能Skill |
| この既知bugを直してください | 対象機能Skill |
| versionを更新してください | `relic-manage-version` |
| 現在の差分をcommitしてください | `relic-commit` |
| 新機能を追加してください | 対象機能Skill |
| dependencyを更新してください | `relic-update-dependencies` |
| package失敗を調べて直してください | `relic-debug-packaging` |

## 隣接Skillとの境界

- `relic-audit-code-health`: 診断、候補評価、単一の巨大file・React・初期読込・性能問題の局所改善を担当する。複数の状態所有、process、保存、性能、配布、文書を一つの完了条件で作り直す場合は本Skillへ渡す。
- `relic-change-*`: 機能領域固有の契約と安全条件を担当する。本Skillは全体の影響地図、変更単位、実装順、横断検証を担当し、専門Skillの規則を上書きしない。
- `relic-test-code`: test設計と失敗切り分けを担当する。本Skillはrefactorで必要な回帰面を選ぶ。
- `relic-debug-packaging`: 実際のpackage・make・ASAR障害とOS別成果物を担当する。本Skillは配布影響の有無と必要な検証を判断する。
- `relic-maintain-docs`: 正本文書の配置、責務、索引を担当する。本Skillはrefactorで変わった設計判断を特定する。

## descriptionを変更したときの確認

1. 発火対象の「全体」「包括」「機能を変えない構造・性能」「定期健全化」がdescriptionだけで選べる。
2. 単一bug、新機能、UI、翻訳、test、version、commit、dependency、package障害を横取りしない。
3. 指定領域でも複数境界を包括的に変える依頼を未発火にしない。
4. `relic-audit-code-health` と両方が候補になる場合、調査だけか包括実装かで選べる。
