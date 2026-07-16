# development.md

Relicの開発方針、文書運用、実装規約、検証、バージョン、リリース方針を定義する。
AIエージェントの対話・権限・コミット・Issue対応はリポジトリルートの [AGENTS.md](../AGENTS.md) を正本とし、この文書には重複して書かない。

---

## この文書の役割

この文書は開発運用だけを扱い、製品の目的、機能、UI、設計の詳細は扱わない。
文書ごとの責務と作業別の参照先は [INDEX.md](INDEX.md) を正とし、作業内容に直接関係する正本だけを確認する。
同じ判断を複数の文書へ複製しない。

コミット履歴、一時的な作業メモ、古い実装だけを、現在の仕様や設計を決める根拠にはしない。
正本と実装が食い違う場合は、変更目的と確認済みの事実に基づき、今回の作業でどちらを更新すべきか判断する。

---

## 文書管理

- プロジェクト文書は日本語で記述する
- リンクは標準Markdownの相対パスで記述する
- 文書名とフォルダ名は、役割を推測できる一般的な名前にする
- 文書ごとの責務を越えて、AI行動規範、機能仕様、設計、索引、開発運用を重複して書かない
- 現在の仕様、設計、運用判断に必要な内容だけを残し、作業履歴を蓄積しない
- 未確定の内容を、確定した仕様、設計、運用ルールとして書かない
- 仕様、設計、UI文書に「未決定事項」セクションを作らない
- 決定した内容は、その内容を扱う正本へ反映する
- 新しい文書を作る前に [INDEX.md](INDEX.md) を確認し、既存文書への追記で足りるか判断する
- 機能や設計の変更が正本文書へ影響する場合は、必要な文書更新を同じ作業に含める

新しい正本文書を追加した場合は [INDEX.md](INDEX.md) の正本文書カタログへ1回だけ掲載し、`app/` で次を実行する。

```sh
pnpm docs:index:check
```

Git管理対象の全ファイルを階層表示する必要がある場合は `pnpm docs:tree` を使い、生成結果を文書へ保存しない。

---

## 開発環境

- 開発用Node.jsの対応範囲は `app/package.json` の `engines.node` を正本とする。CIと配布workflowはその範囲内の版を再現用の基準として使う
- pnpmの版は `app/package.json` の `packageManager` を正本とし、Corepackで有効化する。独立したpnpm版管理ファイルは追加しない
- `pnpm install` の `preinstall` と各標準検証の冒頭で `pnpm runtime:check` を実行し、対応外Node.jsは依存導入や検証を続ける前に理由と切替手順を表示する
- 開発用Node.jsはpackage script、テスト、ビルドツールを実行する環境である。Electron Main／Preloadが実行時に使う内蔵Node.jsや、コンパイル時のAPI型を提供する `@types/node` と同じ版を表すものではない
- Node.js対応範囲を変える場合は、`engines.node`を先に変更し、`pnpm ci:workflows:check` で全workflowの `setup-node` が範囲内か確認する

初回は `app/` で次を実行する。

```sh
corepack enable
pnpm install
```

---

## 実装規約

### 基本方針

- 言語、フレームワーク、対象OSは [engineering/stack.md](engineering/stack.md) を正とする
- プロセス間の責務は [engineering/architecture.md](engineering/architecture.md) を正とする
- データの保存先と正本・派生データの区別は [engineering/data-model.md](engineering/data-model.md) を正とする
- ファイル操作とパス検証は [engineering/file-access-boundaries.md](engineering/file-access-boundaries.md) を正とする
- エディタ固有の実装判断は [engineering/editor-engine.md](engineering/editor-engine.md) を正とする
- 既存の責務分離を保ち、機能追加の都合でmain、preload、rendererの境界を曖昧にしない

### TypeScript

- `strict` を前提にする
- `any` は避け、外部ライブラリ境界などで必要な場合も範囲を狭くする
- main、preload、rendererをまたぐ入力・出力は共有型で定義する
- ユーザー入力、ファイル内容、IPC入力を信頼せず、処理を担当する境界で検証する
- 日時は内部ではISO文字列または `Date` として扱い、表示時に整形する
- 例外を握りつぶさず、呼び出し側が成功・失敗を判定できる形で返す

### 命名

| 対象 | 形式 |
|------|------|
| Reactコンポーネント、型、interface | PascalCase |
| TypeScriptファイル、関数 | camelCase |
| 定数 | camelCase または UPPER_SNAKE_CASE |
| IPCチャンネル定数 | camelCase + `Channel` |
| テストファイル | 対象ファイル名 + `.test.ts` または `.test.tsx` |

UI文言は辞書へ集約し、コンポーネント内へ散在させない。

### エラー処理

- エラーは「何が起きたか」と「次に何をすればよいか」をUIへ出せる粒度で返す
- 入力不備、競合、パス違反、権限不足、外部処理の失敗など、利用者の対応が異なる原因を区別する
- 利用者向けの短い説明と、診断に使う詳細情報を分ける
- Rendererへ返す内容とログには、認証情報や不要なローカル絶対パスを含めない
- 利用者の操作で起きたエラーをコンソール出力だけで終わらせない

### コメント

- 処理の意図や仕様上の理由がコードだけでは分かりにくい箇所にだけ書く
- コードをそのまま言い換えるコメントは書かない
- 仕様に由来する分岐では、必要に応じて関連する仕様文書を短く示す

### 責務とファイルサイズ

- 1000行を超える `ts` / `tsx` は原則として分割対象にする
- 700行を超える `ts` / `tsx` は分割候補として責務を確認する
- UIコンポーネントへ検索、並び替え、検証、正規化、parse、serializeなどの純粋処理を溜めない
- 純粋処理は責務が分かるmodel、lib、serviceへ置く
- 共通型、定数、IPC境界定義は既存の責務別共有モジュールへ置く
- 新機能を肥大したファイルへ足す前に、hook、component、lib、serviceへ切り出せる責務を確認する

`app/` で `pnpm source:size` を実行すると、実装、テスト、CSSの行数を多い順に確認できる。
保存済みの `scripts/baselines/source-lines.json` との差分も表示し、実装は50行以上かつ20%以上、テストとCSSは100行以上かつ20%以上の増加を急増警告にする。
絶対行数と急増はいずれも責務を確認するための警告であり、行数だけを理由にCIを失敗させたり、機械的に分割したりしない。意図した構造変更を確認した場合だけ `pnpm source:size:baseline` で基準を更新する。
ビルド後の出力容量を確認する `pnpm build:size` とは目的が異なる。
`pnpm build:size:check` はrendererをビルドし、初期読込・遅延読込・CSS・assetの容量が保存済み基準値から5%を超えて増えていないことを確認する。
意図して基準値を更新する場合だけ、変更内容を確認したうえで `pnpm build:size:baseline` を実行する。
`pnpm performance:workspace` は再現可能な1,000ファイルfixture、`pnpm performance:workspace:large` は10,000ファイルfixtureで、ファイルツリー、索引、変更ファイルだけの再読込、検索、タグ、バックリンク、グラフ、年表を複数回測定して中央値とI/O回数を表示する。
性能を比較するときは、同じfixture fingerprint、実行回数、warmup回数を使い、単発値ではなく中央値と読み取り・stat回数を確認する。

---

## セキュリティと依存関係

- アプリの実装上の安全条件は [engineering/architecture.md](engineering/architecture.md) と [engineering/file-access-boundaries.md](engineering/file-access-boundaries.md) に従う
- 秘密情報の禁止対象と検知方法は [../SECURITY.md](../SECURITY.md) に従う
- 依存関係の更新、ライセンス、SBOMの手順は [engineering/dependency-licenses.md](engineering/dependency-licenses.md) に従う
- 新しいproduction dependencyは、既存依存で目的を満たせない場合だけ追加する
- 依存関係の変更では、型・テストだけでなく、配布物、ライセンス、既知リスクへの影響も確認する

---

## 検証とテスト

### 基本方針

- 検証範囲は変更のリスクと影響範囲に合わせる
- テストフレームワークはVitest、React UIテストはReact Testing Libraryを使う
- 純粋関数とmain寄りの統合テストを優先し、失敗時にユーザーファイルへ影響する処理を厚く検証する
- React UIは、仕様分岐と状態遷移が複雑な箇所からテストする
- E2Eテストは通常の変更では必須にせず、必要性を確認してから扱う
- テストは実ユーザーのワークスペースや外部サービスを使わない
- テスト層ごとの責務、主要利用経路、回帰対応、E2E候補は [engineering/test-strategy.md](engineering/test-strategy.md) を正とする

### 変更別の確認

| 変更 | 基本確認 |
|------|----------|
| 通常のコード変更 | 関連テストと型チェック。まとめて確認する場合は `pnpm verify` |
| 仕様分岐、パーサー、ファイル操作、IPC入力検証 | 対象テストまたは回帰テストを追加し、`pnpm verify` |
| UIだけの軽微な見た目調整 | 型チェック、関連する既存テスト、必要な表示確認 |
| 文書だけの変更 | 正本と参照先の整合、参照切れ、`git diff --check` |
| 正本文書の追加、削除、移動 | `pnpm docs:index:check` |
| GitHub Actions、Git hook、秘密情報検査の変更 | `pnpm ci:workflows:check` と [SECURITY.md](../SECURITY.md) の対象検査 |
| 依存関係変更 | [engineering/dependency-licenses.md](engineering/dependency-licenses.md) の確認一式 |
| 配布物に影響する変更 | 対象OSの安全ビルドまたはパッケージ確認 |

`pnpm` コマンドは `app/` で実行する。

```sh
pnpm typecheck
pnpm test
pnpm test:node
pnpm test:renderer
pnpm test:coverage
pnpm test:inventory
pnpm smoke:electron
pnpm architecture:check
pnpm ci:workflows:check
pnpm skills:check
pnpm verify
pnpm verify:full
pnpm verify:ci
```

Node APIを使うmain・preload・shared・scriptsのテストはNode環境、rendererのテストはjsdom環境で分離して実行する。
`test:coverage` は全テストと製品コードのカバレッジ下限を確認する。測定用・診断用の `scripts/` はテスト対象に含めるが、製品コードのカバレッジ集計からは除外する。
`architecture:check` はプロセス境界、循環依存、未解決相対import、module alias禁止方針を確認する。保証範囲は [engineering/architecture.md](engineering/architecture.md) を正とする。
`test:inventory` は全テストファイルを失敗責務の層へ分類し、Electron実行とOS別packageがVitest外の責務であることも表示する。
`smoke:electron` は一時ユーザーデータを使って開発版Electronを起動し、メインウインドウ、Renderer、Preload API、初期IPC接続を確認して自動終了する。macOSまたはWindowsで安全ビルド済みの配布版を確認する場合は `pnpm smoke:package` を使う。どちらも必要に応じて `-- --artifacts-dir <path>` でJSON reportとプロセスログの保存先を指定できる。
`verify` は日常変更向けにNode.js環境、型、全テスト、依存通知・SBOM整合を確認する。
`verify:full` はローカルで再現可能な包括確認として、Node.js環境、型、全テストとカバレッジ、アーキテクチャ境界、文書索引、workflow安全条件、Skill構造・routing台帳、依存通知・SBOM整合、差分の空白・改行を確認する。
`verify:ci` は `verify:full` にrenderer bundle基準を追加し、Code CIの再現可能部分をまとめる。Pull Requestのbase/headを使うバージョン検査はGitHubイベント固有のため別stepで実行する。
変更に対して `verify` が過剰な場合も検証自体は省略せず、対象テスト、型チェック、文書確認、差分確認などへ絞る。
E2E、配布ビルド、実アプリ操作は通常の変更の必須確認にはしない。
macOS／Windowsのsafe checkは、配布用ASARの許可内容と必須entry、`LICENSE`、`THIRD_PARTY_NOTICES.md`、SBOM、およびElectron本体を除くアプリ固有resourcesの容量とファイル数を確認する。
GitHubのCode CIはPull Request、`main`へのpush、手動実行で `pnpm verify:ci` と仮想表示server上の `pnpm smoke:electron` を実行する。Pull Requestだけは追加でコミット範囲のバージョン規則を確認する。
タグ作成前のOS別配布確認は、GitHub ActionsのPre-release Verificationを手動実行する。macOSとWindowsのrunnerでRelease workflowと同じ `build:mac:safe`／`build:win:safe` と `pnpm smoke:package` を使い、タグ、Release、push、repository内容を変更しない。Draft Release workflowもZIP作成前に同じ配布版スモークを実行する。
開発版を一時データだけで実アプリ確認する場合は、`pnpm start:isolated -- --user-data-dir <absolute-temp-path>` で起動する。起動元のterminalに出る `RELIC_DEV_APP_IDENTITY` のPIDと完全な実行pathを操作対象の確認に使い、表示名だけで既存ウインドウを選ばない。この切り替えはVite開発server起動時だけ有効で、package版では既定のユーザーデータ保存先を変更しない。

### 優先してテストする領域

- ワークスペース外パスの拒否
- ユーザーファイルを書き換える処理
- リネーム・移動時の内部リンク更新
- コードブロック内を壊さない判定
- フロントマターの保持と同期
- 検索、置換、インデックス更新
- 自動保存と保存待ち処理
- 機能トグルによる表示・操作の分岐

### テストの配置と安全性

- 単体テストと複数モジュールをまたぐ統合テストの本体は、主な責務を持つ対象実装の近くに `*.test.ts` または `*.test.tsx` として置く
- `app/src/test/` は複数テストで共有するsetup、fixture、mock、utility専用とし、テスト本体は置かない
- `describe` は対象モジュール、`it` は期待する振る舞いが分かる名前にする。日本語仕様に密接なテストは日本語で記述してよい
- 小さなサンプルはテスト内に書き、大きなデータが必要な場合だけ `fixtures/` を使う
- ファイル操作テストは一時ディレクトリで実行し、終了後に削除する
- 破壊的操作では対象が一時ディレクトリ内であることを確認する
- OSのゴミ箱など外部境界は薄く分離し、通常テストが実環境へ依存しないようにする
- テスト用ワークスペースや一時データを開発リポジトリ内へ作らない
- `app/out/` のパッケージ版アプリは、配布ビルド確認を行う作業だけで扱う

### テスト追加の基準

- 仕様分岐、状態遷移、ファイル書き換え、パーサー、検索、リンク更新、IPC入力検証を追加・変更したらテストを追加する
- バグ修正では、同じ不具合の再発を防ぐテストを追加する
- 見た目だけの変更では、意味のないテストを増やさず既存テストへの影響を確認する

### 診断ツール

診断ツールは、大きな実装後、リリース前、依存更新後、または定期点検で利用してよい。
点数や指摘をそのまま正解にせず、実害、Relicの設計との適合、変更範囲を確認する。
点数を上げるためだけに、保存、ファイル操作、エディタ、状態管理を大きく作り替えない。

---

## バージョン更新

### 正本と形式

- アプリのバージョン正本は `app/package.json` の `version` とする
- バージョンとGitタグは `MAJOR.MINOR.PATCH` 形式にする
- `0.0.0` は、正式な作業記録をまだ切っていない初期状態として扱う

### 上げ方

コミットする更新では必ずversionを上げ、Conventional Commitsのtypeとオーナーの明示指示から次版を決める。

- MAJOR: オーナーが製品世代の更新を明示した場合だけ使用し、コミット本文へ `Version-Impact: major` を記録する
- MINOR: MAJOR指示がなく、コミットの主目的がユーザーから見える機能追加を表す `feat` の場合に使用する
- PATCH: MAJOR指示がなく、`feat` 以外のtypeでコミットするすべての更新に使用する

複数の変更を一つのコミットへ含める場合は、MAJOR、MINOR、PATCHの順で最も大きい判定を採用する。独立した目的はコミットを分け、コミットごとに順次versionを上げる。

データ、設定、動作環境の互換性は、製品世代の自動判定に使わず、移行処理、拒否、警告、テスト、リリース時の案内で別に保護する。`!` または `BREAKING CHANGE:` を使う破壊的変更では、MAJORの明示指示がなければコミットせず、互換性を維持する実装へ直すかオーナーへ判断を求める。

### 更新タイミング

- 実装、修正、検証、調査、文書整理の結果をコミットする場合は、コミットごとにバージョンを上げる
- バージョン更新は対象作業と同じコミットに含め、バージョンだけのコミットを作らない
- バージョンを上げるコミットには `app/package.json` の更新を必ず含める
- 複数コミットに分ける場合は、各コミットでこの規則を適用する
- 配布ビルドやGitタグを作る前に、対象コミットのバージョンが配布番号として妥当か確認する
- 配布成果物を作る場合は `0.0.0` のままにしない

### 自動計算と検証

- 次版は `app/` で `pnpm version:next -- <現在値> <type>` を実行して計算する
- オーナーがMAJORを明示した場合だけ `--major` を追加する
- Pull Requestでは、基準コミット以降の各コミットについて、type、コミット件名、`app/package.json` のversionを `pnpm version:check -- <base> <head>` で照合する
- バージョン判断、更新、検証は `.agents/skills/relic-manage-version/SKILL.md`、ステージとコミットは `.agents/skills/relic-commit/SKILL.md` に従う

---

## リリース

- 配布場所はGitHub Releasesとする
- `app/package.json` と同じ `MAJOR.MINOR.PATCH` 形式のGitタグをGitHubへpushしたときだけ、Draft Release workflowを実行する
- 自動化の正本は [../.github/workflows/draft-release.yml](../.github/workflows/draft-release.yml) とする
- タグ作成前と公開前の確認は [../.github/RELEASE_CHECKLIST.md](../.github/RELEASE_CHECKLIST.md) に従う
- workflowは配布物を作成してDraft Releaseへ添付するところまでを担当し、Publishは人が判断する
- 公開済みReleaseのAssetsは原則として差し替えず、重大な修正は新しいPATCHバージョンとして配布する
- 現行の配布物は未署名・未公証として扱う
- 自動更新、署名、公証、ストア配布、インストーラー変更、Publishの完全自動化は、それぞれ別の仕様・運用変更として扱う

---

## 完了条件

開発作業は、変更内容に対応する正本文書が整合し、必要な検証が完了し、コミットする場合はバージョン更新規則を満たした状態で完了とする。
完了報告の内容とコミットの扱いは [AGENTS.md](../AGENTS.md) に従う。
