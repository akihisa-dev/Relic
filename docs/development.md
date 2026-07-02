# development.md

Relicの開発作業全体に適用する開発ルール。
AI固有の対話・判断ルールはリポジトリルートの `AGENTS.md` に従い、この文書にはRelic開発そのものの運用を定義する。
Relicの開発運用に関するルールはこの文書を入口とし、他の文書へ重複して書かない。

---

## この文書の役割

この文書では、Relicの開発作業における作業範囲、文書管理、実装規約、検証、テスト、バージョン更新、リリースの扱いを定義する。

この文書では、次の詳細は扱わない。

- AIエージェントの対話、確認、説明、コミット、Issue対応ルール: [../AGENTS.md](../AGENTS.md)
- リポジトリ全体のファイル、フォルダ構成: [INDEX.md](INDEX.md)
- Relicの目的、対象ユーザー、判断思想: [project/overview.md](project/overview.md)
- 機能ごとの仕様: [features/](features/)
- 画面構成、画面遷移、デザインシステム: [design/](design/)
- アーキテクチャ、データモデル、技術選定、設計判断: [engineering/](engineering/)

開発判断で参照する現在の文書は [INDEX.md](INDEX.md) から確認する。
コミット履歴や一時的な作業メモは、現在の仕様、設計、開発運用を決める根拠として扱わない。

---

## 作業開始時の確認

- 作業前に [project/overview.md](project/overview.md) でRelicの目的と判断思想を確認する
- 作業内容に応じて、[INDEX.md](INDEX.md) から必要な文書を確認する

作業範囲は、ユーザーの直近指示、対象機能の仕様・設計文書、実装上の直接関係で判断する。

---

## 作業範囲

- ユーザーが明示した対象ファイル・対象範囲を越えて編集しない
- 関連ファイルの更新が必要な場合は、理由、対象ファイル、変更内容を明確にし、ユーザーの明示範囲を越える場合は事前に確認する
- 「整合性のため」「慣例上必要」「セッション終了時の手順」などを理由に、ユーザーの直近指示を越えて作業しない
- UI変更では、ユーザーが指定した画面、場所、操作対象だけを変更する
- 別の場所に同じ機能の入口を追加する、操作方法を増やす、説明や装飾を足すなどの範囲拡張は、事前に確認する
- ユーザーが対象を訂正した場合は、以後その対象以外を触らない
- ユーザーから明示的な指示がない限り、ブランチは切らずに現在のブランチで作業する
- 変更の取り消し、巻き戻し、履歴の書き換えは、ユーザーが明示した場合だけ実行する

---

## 仕様・設計・技術選定

- 仕様書（`docs/features/`）を作成・更新する場合は、ユーザーに1問ずつヒアリングする
- ユーザーの回答をもとに仕様を決定し、ユーザーの承認を得てからファイルに書き込む
- 技術的な選択肢が生じた場合は、各選択肢を一般の人にも分かる言葉で説明し、ユーザーに決定を委ねる
- 推薦を示す場合は、推薦理由と採用しない場合の影響を説明する
- ユーザーが「技術的なことはわからない」と言った場合も、説明を言い換えて判断材料を出す
- 説明なく独自判断で技術選定しない

---

## 文書管理

- ドキュメントはすべて日本語で記述する
- 承認されていない内容は書かない
- 既存の内容は勝手に削除・変更しない
- リンクは標準Markdownの相対パスで記述する（例: `[仕様](features/editor.md)`）
- 文書名とフォルダ名は、読まなくても役割を想像できる一般的な名前にする
- 文書ごとの役割を越えて、開発運用、AI行動規範、索引情報を重複して書かない
- 現在の仕様、設計、運用判断に必要な内容だけを書く
- 新しいドキュメントを作る前に [INDEX.md](INDEX.md) を確認し、既存文書への追記で足りるか判断する
- 新規ファイルを作成したら [INDEX.md](INDEX.md) のファイル構成と関連する分類に反映する
- [INDEX.md](INDEX.md) の全ファイル・フォルダ構成は `git ls-files` と一致させる
- 全ファイル・フォルダ構成は `app/` で `pnpm docs:index:update` を実行して更新する
- 全ファイル・フォルダ構成の整合は `app/` で `pnpm docs:index:check` を実行して確認する
- 未確定の内容を、確定した仕様、設計、運用ルールとして書かない
- 仕様、設計、UI文書に「未決定事項」セクションを書かない
- 未決定事項がある場合は文書に蓄積せず、正本化または実装前にユーザーへ確認する
- 決定したら、決定内容を該当する仕様、設計、開発ルールの文書へ反映する
- 作業履歴を文書内に蓄積しない
- 現行実装と文書が食い違う場合は、ユーザーの指示範囲と変更内容に合わせて該当文書を更新する

`docs/` 配下の文書分類は次のとおり。

| 場所 | 書くもの |
|------|----------|
| `docs/project/` | Relicの目的、対象ユーザー、判断思想、用語 |
| `docs/features/` | 機能の振る舞い・詳細仕様 |
| `docs/design/` | 画面構成、画面遷移、デザインシステム |
| `docs/engineering/` | アーキテクチャ、データモデル、技術選定、設計判断 |
| `docs/development.md` | Relic固有の開発ルール |

作業内容に対して更新すべき文書がある場合は、文書更新を同じ作業単位に含める。
必要な文書更新を未反映のまま完了扱いにしない。

---

## 実装規約

### 基本方針

- TypeScriptで実装する
- 対象OSは macOS / Windows とする
- 仕様は `docs/features/`、画面構成は `docs/design/`、データ構造は `docs/engineering/data-model.md`、技術スタックは `docs/engineering/stack.md` を正とする
- ファイルシステム、ネットワーク、設定保存に触る処理はメインプロセスに置く
- UI、エディタ、一時的な画面状態はレンダラープロセスに置く
- レンダラーからOS機能へ直接アクセスしない。必ずpreloadで公開したAPIとIPCを通す
- ユーザーのMarkdownファイルを勝手に独自形式へ変換しない
- Markdown本文へRelic専用の不可視メタデータを埋め込まない
- 追加機能より、ローカルMarkdownファイルを安全に読み書きできることを優先する
- 未決定事項がある場合は実装で推定せず、ユーザーに確認する

### ディレクトリ構成

現行実装では、以下の責務分離を基本にする。
リポジトリルートでは、`docs/` をプロジェクト文書、`app/` をElectron / Reactアプリ本体として分ける。

| 場所 | 内容 |
|------|------|
| `docs/` | プロジェクト文書 |
| `app/` | Electron / React アプリ本体 |
| `app/src/main/` | Electronメインプロセス。ファイル操作・設定保存・検索/リンク/タグ/チャート生成・IPCハンドラ |
| `app/src/main/workspace/` | ワークスペース登録・切り替え・復元 |
| `app/src/main/files/` | Markdownファイル・フォルダ操作、検索、リンク、タグ、年表などワークスペース内データの読み取りと生成 |
| `app/src/main/ipc/` | preload APIに接続するIPCハンドラ、active workspace取得、入力検証 |
| `app/src/main/settings/` | アプリ設定・ワークスペース設定 |
| `app/src/preload/` | レンダラーへ公開する安全なAPI |
| `app/src/renderer/` | React UI・CodeMirror・画面状態 |
| `app/src/renderer/components/` | Reactコンポーネント。画面部品、パネルタブ、ファイルサイドバー、エディタ周辺UI |
| `app/src/renderer/hooks/` | renderer側のUI操作、ファイル操作連携、チャート操作などのReact hook |
| `app/src/renderer/store/` | Zustandによるタブ、ペイン、サイドバー、右パネルなどのUI状態 |
| `app/src/renderer/locales/` | UI文言の辞書 |
| `app/src/shared/` | メイン / レンダラーで共有する型・定数・純粋関数 |
| `app/src/test/` | テスト共通ユーティリティ |

機能が大きくなった場合も、メインプロセスの責務とレンダラーの責務を混ぜない。

### 命名規則

| 対象 | 形式 | 例 |
|------|------|----|
| Reactコンポーネント | PascalCase | `FileTree.tsx` |
| TypeScriptファイル | camelCase | `workspaceStore.ts` |
| 型・interface | PascalCase | `Workspace`, `MarkdownFile` |
| 関数 | camelCase | `openWorkspace` |
| 定数 | camelCase または UPPER_SNAKE_CASE | `defaultEditorSettings`, `MAX_FRONTMATTER_FIELDS` |
| IPCチャンネル定数 | camelCase + `Channel` | `openWorkspaceChannel` |
| テストファイル | 対象ファイル名 + `.test.ts` | `linkParser.test.ts` |

UIに表示する日本語文言は、後から集約できるようにコンポーネント内へ散らしすぎない。

### TypeScript

- `strict` を前提に書く
- `any` は避ける。外部ライブラリ境界などで必要な場合は範囲を狭くする
- IPCの入力・出力は `app/src/shared/` の共有型で定義する
- ファイルパスは、絶対パスとワークスペース相対パスを混ぜない
- ワークスペース相対パスを保存・表示・リンク解決の基本単位にする
- メインプロセス内でOS操作を行う直前だけ、ワークスペース相対パスから絶対パスへ解決する
- 日時は内部的にはISO文字列または `Date` として扱い、表示時に整形する
- ユーザー入力・ファイル内容・IPC入力は信頼しない。メインプロセス側で検証する
- 例外は握りつぶさず、UIで原因別メッセージに変換できる形で返す

### Electron / IPC

- メインプロセスは、ファイルシステム、検索・リンク・タグ・年表用データ生成、アプリ設定の責務を持つ
- レンダラーは、画面表示とユーザー操作の責務を持つ
- preloadで公開するAPIは、仕様上の操作単位に限定する
- レンダラーから任意のファイルパスを直接操作できる汎用APIを作らない
- IPCチャンネル名は機能と操作が分かる名前にする
- IPCの戻り値は成功・失敗を呼び出し側が判定できる形にする
- ワークスペース外のファイルへ書き込む操作は、ユーザーが明示的に選んだパスだけを対象にする
- OSのファイル選択ダイアログやゴミ箱移動など、Electron / macOS に依存する処理はメインプロセスに閉じ込める

### エラー処理

- エラーは「何が起きたか」と「次に何をすればよいか」をUIに出せる粒度で返す
- ファイル名重複・禁止文字・ワークスペース外パス・権限不足・ネットワーク失敗は区別する
- 技術的な詳細ログが必要なエラーでは、ユーザー向け短文と詳細表示用の内容を分ける
- IPCでrendererへ返す詳細エラーは、ローカル絶対パスや認証情報らしい文字列を伏せ字にしてから返す
- ユーザーの操作ミスで起きるエラーをコンソールだけに出して終わらせない

### React / UI

- 画面は `docs/design/DESIGN.md` のコンポーネント単位に分ける
- メインエリアは、ファイルタブ・パネルタブ・チャートタブをタブ式に管理する
- ファイルツリーと検索はファイルサイドバー内、設定や補助機能はパネルタブとして扱う
- UI状態と永続化データを混ぜない
- React状態管理にはZustandを使う。ただし、タブ・ペイン・サイドバー・右パネル・アクティブワークスペース・UI設定反映などの横断的UI状態に限定する
- フォーム入力・メニュー開閉・モーダル内だけで完結する一時状態はReactローカルstateで扱う
- ファイル内容・検索結果・リンク/タグ生成結果・設定の永続化はZustandに入れない
- コンポーネントは表示責務を中心にし、ファイル操作はpreload API層へ逃がす
- タブ・サイドバー・右パネル・分割表示・アクティブペインは専用の状態管理単位を持つ
- 分割表示中は、ペインごとに独立したタブ列を管理する
- サイドバーを閉じた状態で検索を開く操作が来た場合は、サイドバーを自動で開いて対象ビューを表示する
- 深いpropsリレーが増えたら、状態の置き場を見直す

### デザイン実装

- 色・タイポグラフィ・スペーシング・モーションは `docs/design/DESIGN.md` を参照する
- アクセントカラーのユーザー指定を実装しない
- テーマはライト / ダーク / システム追従を扱う
- 設定などの補助画面は、メインエリアのパネルタブとして開く
- アイコンボタンにはツールチップを用意する
- サイドバー幅・右パネル開閉・分割表示など、画面状態の復元対象はワークスペース設定と整合させる

### CodeMirror / Markdown

- Markdown本文の編集状態はCodeMirrorを正とする
- ライブプレビュー・内部リンク・タグなどの挙動は、可能な限りCodeMirror拡張として実装する
- Markdown解析・HTML安全化・KaTeX連携などは専用ライブラリを組み合わせ、CodeMirrorだけで無理に完結させない
- 自動保存はエディタ変更から直接ファイルへ即時書き込みせず、入力停止後1秒の仕様を守る
- ライブプレビューでは、カーソルまたは選択範囲が触れている装飾範囲だけMarkdown記法を表示し、レンダリング自体は維持する
- CommonMarkとObsidian互換拡張は `docs/features/markdown.md` の範囲を実装対象にする
- HTMLタグは、下線のための `<u>` 以外はプレーンテキストとして扱う
- Markdown画像記法は、ワークスペース内の相対パス画像だけ実画像として表示し、外部URLやワークスペース外参照は画像プレースホルダーとして扱う
- 画像記法はMarkdown本文の補助表現として扱い、画像管理機能を作らない

### ファイル操作

- 対象はワークスペース内の `.md` ファイルを基本とする
- サイドバー表示では `.md` 拡張子を隠す
- 作成時は `.md` 拡張子を自動付与する
- サイドバーの主要管理対象は `.md` ファイルとフォルダにする
- Markdown画像記法は本文から参照される補助表現として扱い、対応画像ファイルはサイドバーから開ける添付ファイルとして扱う
- PDFファイルはMarkdown本文の正本データにはしないが、ワークスペース内の添付閲覧対象としてサイドバーから開ける
- PDFの編集、本文検索、タグ付け、変換、注釈管理は行わない
- エディタ本文への画像ドロップは、画像ファイルをワークスペース内へ追加してMarkdown画像記法を挿入する操作として扱い、画像管理機能には広げない
- ファイルツリーへの画像ドロップは、画像ファイルをワークスペース内へ追加して画像表示タブで開ける操作に留め、検索、タグ付け、画像編集、アルバム管理には広げない
- ワークスペース準備時にRelic専用の必須フォルダを自動作成しない
- Markdown本文から参照される画像記法は専用添付フォルダを前提にせず、ワークスペース内の相対パス画像だけライブプレビューで実画像として表示する
- フロントマターテンプレートはアプリ設定として保存し、ワークスペース内の `templates/` フォルダや `.md` テンプレートファイルに依存しない
- 削除はOSのゴミ箱へ移動し、確認ダイアログを出す
- リネーム・移動時は、コードブロック内を除くMarkdown内の `[[...]]` / `![[...]]` 形式の内部リンクを確認なしで自動更新する
- コードブロック内の内部リンク文字列は自動更新しない
- 同名・禁止文字・ワークスペース外参照はエラーとして扱う
- ファイル加工ツールは既存ファイルを読み取り専用で扱い、結果は必ず新規ファイルとして出力する

### 検索・リンク・タグ

- 検索・リンク・タグ・年表用データは、メインプロセス側がワークスペース内のMarkdownを正本として読み取って生成する
- 全Markdownファイルの更新型インデックスは、実ファイルを正本にしてRelicの設定領域に再作成可能な控えとして保存してよい
- ワークスペース内にRelic管理用ファイルや必須フォルダを作らない
- インデックス更新では、変更されていないファイルを無駄に読み直さず、ファイルサイズや更新日時で再利用可否を判断する
- ファイル保存・作成・削除・リネーム・移動後は、次の読み取り時に現在のMarkdownファイルを正として扱う
- 検索・リンク・タグの対象は現在のワークスペース内に限定する
- フロントマターは全文検索対象に含める
- タグはフロントマターの固定プロパティ `tags:` から収集する。本文中の `#タグ名` 記法はタグとして扱わない

### セキュリティ

- Electronのレンダラーは `contextIsolation: true`、`nodeIntegration: false`、`sandbox: true` を基本とする
- レンダラーへ公開する機能は `preload` の `window.relic` API に限定し、Node.js APIを直接公開しない
- IPCハンドラは入力型を検証し、ファイル操作は現在のワークスペース内に限定する
- OSクリップボードの読み取りは、ブラウザ/エディタの通常pasteイベントなどユーザー操作に紐づく経路に限定し、rendererから任意タイミングで読み取れるIPC APIを公開しない
- 外部URLを開く処理は許可リスト方式にする
- MarkdownプレビューはHTMLをサニタイズし、画像記法のうちワークスペース内の相対パス画像だけ実画像として表示する。外部URLやワークスペース外参照は実画像として読み込まない
- `.env`、認証情報を含む `.npmrc`、秘密鍵、証明書、ローカルAI/エディタ設定はリポジトリ管理に含めない。プロジェクト設定として追跡する `.npmrc` には認証情報を書かない
- `userData` 配下に保存する設定ファイルと再生成可能なindex cacheは、macOS / Linuxではディレクトリを `0700`、ファイルを `0600` 相当に制限する。WindowsではユーザープロファイルのACLを前提にし、Node.jsのmode指定で同等制御できないことを踏まえて扱う
- 依存関係監査は外部 registry に依存情報を送るため、実行前にユーザーの明示許可を得る

### 秘密情報検知

- ローカルpush前とGitHub上のPull Request / `main` pushでは、`.githooks/secret-guard.sh` で秘密情報らしい差分を検知する
- `.githooks/pre-push` は `.githooks/secret-guard.sh --pre-push` を呼び出し、GitHub Actionsの `Secret Guard` workflow は同じスクリプトを `--range` で呼び出す
- 検知対象は、`.env`、credentialを示すファイル名、HTTP Authorization header、GitHub token形状、秘密鍵、provider token、認証情報を含むDB接続文字列、AWS access key IDなどに限定する
- 画像、ZIP、実行ファイルなどtextとして扱う必要がないファイルは検知対象から除外する
- テストや確認には `.githooks/secret-guard.sh --self-test` を使う。本物のtoken、秘密鍵、実在credentialをテストやログに含めない
- 誤検知した場合は、検知対象文字列を含まない表現に修正する。秘密情報ではないことを理由に検知ルールを緩める場合は、対象パターンと理由を確認してから行う

### 依存関係更新

- npm / pnpm 依存関係とGitHub Actionsの更新確認は `.github/dependabot.yml` でGitHub上にPull Requestを作成して行う
- Dependabotは `app/` のnpm依存関係と、リポジトリ全体のGitHub Actionsを対象にする
- Dependabotによる更新Pull Requestでは、`app/package.json`、`app/pnpm-lock.yaml`、`.github/workflows/` の差分を確認する
- 依存更新Pull Requestでは、`pnpm.overrides` の対象がまだ必要かを確認し、不要になった固定は同じPull Requestまたは別Issueで外す
- production dependencies を追加・削除・更新した場合は、`app/` で `pnpm licenses:generate` と `pnpm licenses:check` を実行し、`THIRD_PARTY_NOTICES.md` と `sbom/relic-dependencies.cdx.json` を更新する
- 依存更新Pull Requestでは、`app/` で `pnpm verify` と `pnpm docs:index:check` を実行し、リポジトリルートで `git diff --check` を実行する
- GitHub上のDependabot、GitHub Advisory、依存更新Pull Requestは、GitHubへ依存関係情報を送る運用として許可する
- 手元で `pnpm audit` など外部 registry へ依存情報を送る監査コマンドを実行する場合は、既存方針どおり事前にユーザーの明示許可を得る

### 設定

- アプリ設定とワークスペース設定を分ける
- 設定はElectronの `userData` 配下にJSONで保存し、`app/src/main/settings/` の自前設定サービスで読み書きする
- アプリ設定は `app-settings.json` に保存する
- ワークスペース設定は `workspaces/{workspaceId}.json` に保存する
- アプリ設定にはテーマ・エディタ表示設定・機能トグル・前回ワークスペースなどを保存する
- ワークスペース設定にはワークスペースパス、ピン留め、年表など、ワークスペース固有の値を保存する
- 機能トグルは料金モデルと結びつけない
- 機能トグル対象は、設定パネルに表示されるファイル加工ツール / フロントマター設定 / 暦設定 / 年表 / 右パネルとする

### コメント

- コメントは、処理の意図や仕様上の理由がコードだけでは伝わりにくい箇所にだけ書く
- コードをそのまま言い換えるコメントは書かない
- 仕様に由来する分岐は、関連仕様ファイル名が分かる短いコメントを許容する

### 肥大化防止

- 1000行超の `ts` / `tsx` は原則として分割対象にする
- 700行超の `ts` / `tsx` は分割候補として調査対象にする
- UIコンポーネントに、検索、並び替え、検証、正規化、parse、serializeなどのpure functionを溜めない
- `sort` / `filter` / `validate` / `normalize` / `parse` / `serialize` は、責務名が分かるmodel、lib、serviceへ寄せる
- 共通型・共通定数は `shared` / `types` / `constants`、または既存の責務別共有モジュールへ寄せる
- IPC channel / payload / response は境界定義に寄せ、main / preload / rendererのどこに責務があるか分かる名前にする
- 新機能追加時は、肥大ファイルへ直接積み増す前に、hook / component / lib / serviceへ切り出せる責務を先に作る

---

## 検証とテスト

### 基本方針

- 検証範囲は、変更内容のリスクと影響範囲に合わせて決める
- テストフレームワークは Vitest を使う
- React UIテストには React Testing Library を使う
- まずユニットテストとメインプロセス寄りの統合テストを厚くする
- ファイル破壊・リンク更新など、失敗時の被害が大きい処理を優先してテストする
- React UIは、仕様上の分岐や状態遷移が複雑な箇所からテストする
- E2Eテストは通常の開発では必須にしない。必要になった段階で Playwright の追加を検討する
- テストは実ユーザーのワークスペースや外部サービスを使わない

### テストの種類

| 種類 | 対象 | 方針 |
|------|------|------|
| ユニットテスト | 純粋関数・パーサー・パス処理・設定変換・Markdown解析 | 最優先で書く |
| 統合テスト | ファイル操作・インデックス更新の薄い結合 | 一時ディレクトリを使って実ファイルに近い形で確認する |
| UIテスト | Reactコンポーネント・状態遷移 | 重要な画面状態と操作結果を確認する |
| E2Eテスト | アプリ全体 | 通常は対象外。必要になったら追加する |

### 現行の検証方針

- テスト実行の要否と範囲は、原則としてAIまたは作業者が変更内容から判断する。ユーザーへ毎回判断を求めない
- フルテストは常時必須にしない。変更内容に対して過剰な確認になる場合は、対象テスト、型チェック、文書確認、差分確認などに絞る
- テストを省略しても安全と判断した場合は省略してよい。ただし、省略した確認と理由を完了報告、Issue、Pull Request、またはコミット本文に記録する
- ユーザーに確認するのは、検証に外部アクセス、実ユーザーデータ、長時間の実行、配布成果物、実アプリ操作などの負担やリスクがある場合に限る
- 機能確認や不具合修正では、対象機能の仕様リスクに応じて型チェック、既存テスト、対象テストを選ぶ
- 大型機能追加では、追加した機能の主要分岐と失敗時の影響が大きい処理を優先してテストする
- 文書整理だけの作業では、コードテストではなく対象文書と参照先文書の整合を確認し、`git diff --check` を最低確認にする
- [INDEX.md](INDEX.md) のファイル一覧に影響する作業では、`pnpm docs:index:check` を実行する
- 文書内の古い前提や参照切れは `rg` で確認し、必要な場合だけ対象文書の範囲で修正する
- 仕様、UI、実装の変更を含む場合は、`pnpm typecheck`、`pnpm test`、対象テスト、実アプリ確認のうち必要な範囲を実施し、完了報告や関連するIssue/PRへ記録する
- 実施した検証は完了報告、Issue、Pull Request、またはコミット本文で確認できるようにする
- 実施しなかった検証がある場合は、その理由を明記する

### 優先してテストする領域

- ワークスペース外パスの拒否
- ユーザーファイルを書き換える処理
- リネーム・移動時の内部リンク自動更新
- コードブロック内を壊さない判定
- フロントマターの保持と同期
- 検索・置換・インデックス更新
- 自動保存と保存待ち処理
- 機能トグルで非表示・無効化される操作

### テストファイルの置き場所

- 原則として対象ファイルの近くに `*.test.ts` を置く
- 複数モジュールをまたぐ統合テストは `app/src/test/` 配下に置く
- テスト用のMarkdownサンプルは、読みやすい小さな文字列としてテスト内に書く
- 大きなfixtureが必要になった場合だけ `fixtures/` を作る
- ユーザーの実ワークスペースに依存するfixtureを作らない

### テストの命名規則

- テストファイル名は `対象ファイル名.test.ts`
- `describe` は対象モジュール名
- `it` は期待する振る舞いを自然文で書く
- 日本語仕様に密接なテストは、日本語の説明名を使ってよい

例:

```ts
describe("parseWikiLinks", () => {
  it("パス付き内部リンクを解析できる", () => {
    // ...
  });
});
```

### 一時ファイルと安全性

- テストは実ユーザーのワークスペースを使わない
- ファイル操作テストは一時ディレクトリを作って実行する
- テスト終了後に一時ディレクトリを削除する
- 破壊的操作のテストでは、対象パスが一時ディレクトリ内であることを確認する
- ゴミ箱移動のテストは、実OSのゴミ箱に依存しすぎないよう、境界を薄くして検証する
- `app/out/` 配下のパッケージ版アプリは、ユーザーが配布ビルド確認を明示した場合だけ確認対象にする
- テスト用ワークスペース、検証用リポジトリ、一時データをRelic開発リポジトリ内に作らない
- 実アプリ検証でユーザーのワークスペースや外部サービスに触る必要がある場合は、対象、操作内容、戻し方を説明し、ユーザーの明示許可を得る

### 実行

アプリ本体の型チェックとテストは `app/` 配下で実行する。

```sh
cd app
pnpm typecheck
pnpm test
```

まとめて確認する場合は、`app/package.json` の `verify` を使う。

```sh
cd app
pnpm verify
```

型チェック、テスト、文書索引チェック、Markdownを含む差分の空白・改行確認までまとめる場合は `verify:full` を使う。

```sh
cd app
pnpm verify:full
```

Markdown差分の空白・改行確認はリポジトリルートで実行する。

```sh
git diff --check
```

[INDEX.md](INDEX.md) の全ファイル・フォルダ構成を更新する場合は `app/` 配下で実行する。

```sh
pnpm docs:index:update
pnpm docs:index:check
```

`verify:full` は `pnpm verify`、`pnpm docs:index:check`、`git -C .. diff --check` を実行するため、`app/` 配下からでも型チェック、テスト、文書索引、リポジトリルートの差分をまとめて確認できる。
必要に応じて、対象テスト、監視実行、カバレッジ取得のコマンドを追加する。

### テスト追加の判断基準

- 仕様分岐がある処理を追加したらテストを書く
- ファイルを書き換える処理を追加したらテストを書く
- パーサー・検索・リンク更新の変更には回帰テストを書く
- IPCの入力検証を追加・変更したらテストを書く
- UI状態遷移を追加したら、重要な分岐をテストする
- UIだけの軽微な見た目調整は、既存テストが通る確認を基本にする
- バグを直したら、同じバグが再発しないテストを追加する

---

## 診断ツール

React Doctorなどの診断ツールは、Relicの品質確認として定期的に利用してよい。
ただし、診断ツールの点数や指摘を盲信しない。

- React Doctorは、大きめの実装後、リリース前、依存更新後、または月1回程度の定期点検として実行する
- 指摘は「実害があるもの」「Relicの性質と合わないもの」「大規模な設計変更として別作業にすべきもの」に分けて判断する
- 実害がある指摘は、ユーザーの指示範囲に収まる場合に修正する
- Electron、CodeMirror、ローカルファイル操作、順序が重要な処理など、Relicの性質と合わない指摘は、理由を説明したうえで設定除外または保留にしてよい
- 設定除外を追加・変更する場合は、除外理由を説明し、必要に応じて関連する文書にも記録する
- 点数を上げるためだけに、保存、ファイル操作、エディタ本体、状態管理などの大規模な設計変更を行わない

---

## コミット

コミットに関するAIエージェントの行動ルール、コミット単位、コミットメッセージ形式は、リポジトリルートの `AGENTS.md` を正本とする。
AIは作業前と完了報告前に、`AGENTS.md` のコミット節を確認する。

---

## バージョン更新

アプリのバージョンを決めるときは、この文書と `app/package.json` を確認する。

### バージョンの正本

- アプリのバージョン正本は `app/package.json` の `version` とする
- 表記は `MAJOR.MINOR.PATCH` 形式にする
- Gitタグを作る場合は `MAJOR.MINOR.PATCH` 形式にする
- `0.0.0` は、正式な作業記録をまだ切っていない初期状態として扱う

### 上げ方

`PATCH` は `0.0.1` の最後の数字。
AIが自分の判断で上げられるのはPATCHだけとする。

- バグ修正
- 文書整理
- テスト追加
- 内部リファクタリング
- 既存機能の軽微なUI調整
- 開発環境、スクリプト、依存関係の軽微な整理

`MINOR` は `0.1.0` の真ん中の数字。
MINORは、ユーザーが明示的に「マイナーを上げる」と指示した場合だけ上げる。
次の項目は、ユーザーがMINOR更新を判断するための目安であり、AIが自動でMINORを選ぶ根拠にしてはならない。

- ユーザーから見える機能追加
- 既存機能のまとまった仕様変更
- UI構成や操作導線のまとまった変更
- 開発環境や文書構成の大きな再編
- 配布前の意味ある区切りを作る場合

`MAJOR` は `1.0.0` の最初の数字。
MAJORは、ユーザーが明示的に「メジャーを上げる」と指示した場合だけ上げる。
次の項目は、ユーザーがMAJOR更新を判断するための目安であり、AIが自動でMAJORを選ぶ根拠にしてはならない。

- 既存ユーザーのファイル、設定、ワークスペース互換性に影響する変更
- 旧バージョンからの移行手順が必要な変更
- 正式版として「ここから通常利用の基準にする」とユーザーが決めた場合

`1.0.0` 未満では、ユーザーが明示した場合に限り、互換性の大きな変更も `0.x.0` のMINOR更新として扱ってよい。

### 更新タイミング

- AIが実装、修正、検証、調査、文書整理を行ってコミットする場合は、コミットごとにバージョンを上げる
- バージョン更新は、その作業を記録する同じコミットに必ず含め、バージョン更新だけを別コミットにしない
- リリース、配布ビルド、Gitタグ作成、またはユーザーが明示した区切りでは、対象コミットのバージョンが配布・タグ作成に使う番号として妥当か確認する
- バージョンを上げるコミットには、`app/package.json` の `version` 更新を必ず含める
- MAJORとMINORは、ユーザーが明示的に「メジャーを上げる」「マイナーを上げる」と指示した場合だけ変更する
- ユーザーからMAJOR/MINORの明示指示がない場合は、作業内容が大きくてもPATCHだけを上げる
- 配布ビルドを作る場合は、ビルド前に必要なバージョン更新を済ませる
- Gitタグを作る場合は、バージョン更新コミット後に作成し、pushする

### 判断の目安

- 迷ったらPATCHを選ぶ
- 文書や開発環境だけの整理はPATCHにする
- 文書構成全体の再編でも、ユーザーがMINORを指示しない限りPATCHにする
- 実際にユーザーへ配る成果物を作るときは、`0.0.0` のままにしない

---

## リリース

Relicのリリースは、GitHub Releasesを配布場所として使う。
GitHub ActionsでDraft Release作成までを自動化し、公開判断だけを人が行う。

### 目的

- リリースごとに、どのバージョンの成果物かをGitタグとGitHub Releasesで明確にする
- `MAJOR.MINOR.PATCH` 形式のタグがGitHubへpushされたときだけ、自動ビルドとDraft Release作成を行う
- アプリ本体の自動更新機能はまだ追加しない
- 署名、公証、App Store、外部サービスログイン、Publishまでの完全自動化は別作業として扱う

ユーザーにとっての「更新」は、GitHub Releasesから新しい配布ファイルを取得し、古いRelicと置き換える運用とする。

### リリースで扱う正本

- アプリのバージョン正本は `app/package.json` の `version`
- Gitタグは `MAJOR.MINOR.PATCH` 形式
- Draft Release workflowが受け付けるタグ名も `MAJOR.MINOR.PATCH` 形式だけとする
- Draft Release作成の自動化は `.github/workflows/draft-release.yml`
- リリース本文はGitHub Releasesの説明欄
- 配布ファイルはGitHub ReleasesのAssets
- GitHub Releasesの操作はGitHub公式ドキュメントの [Managing releases in a repository](https://docs.github.com/en/repositories/releasing-projects-on-github/managing-releases-in-a-repository) を参照する

### リリース前に確認すること

1. `app/package.json` の `version` が、配布したい番号になっていることを確認する
2. 必要なバージョン更新がコミット済みであることを確認する
3. 作業中の差分がないことを確認する
4. リリースしたいコミットがGitHubの `main` にpush済みであることを確認する
5. `app/` で `pnpm verify` を実行して成功することを確認する
6. リポジトリルートで `git diff --check` を実行して成功することを確認する

Draft ReleaseをPublishする前には、GitHub上で [.github/RELEASE_CHECKLIST.md](../.github/RELEASE_CHECKLIST.md) の項目を確認する。

### Gitタグ

バージョン更新コミット後に、`app/package.json` の `version` と同じ番号でタグを作る。
タグをGitHubへpushすると、`Draft Release` workflowが実行される。
タグ名と `app/package.json` の `version` が一致しない場合、workflowはビルド前に失敗する。
タグ名が `MAJOR.MINOR.PATCH` 形式ではない場合も、workflowはビルド前に失敗する。

例:

```sh
version="$(node -p "require('./app/package.json').version")"
git tag "${version}"
git push origin "${version}"
```

`app/package.json` の `version` が `0.3.15` の場合、Gitタグも `0.3.15` とする。
`main` のpushがまだの場合は、タグpushより先に次を実行する。

```sh
git push origin main
```

pushはユーザーが明示的に指示した場合だけ実行する。

### Draft Release作成

`.github/workflows/draft-release.yml` は、タグがpushされたときに実行される。
通常のブランチpushやPull Requestでは実行しない。
タグ名が `MAJOR.MINOR.PATCH` 形式ではない場合は、ビルド前の検証で失敗する。

workflowは次を自動で行う。

1. `github.ref_name` と `app/package.json` の `version` から作るタグ名が一致するか確認する
2. タグ名が `MAJOR.MINOR.PATCH` 形式であり、Gitタグから実行されていることを確認する
3. Ubuntu runnerで `pnpm licenses:check` を実行し、Third Party NoticesとSBOMの生成物が最新であることを確認する
4. Ubuntu runnerで `pnpm security:audit` を実行し、High以上のproduction dependency監査結果がある場合は失敗する
5. macOS runnerで `app/` の依存関係をインストールする
6. macOS runnerで `pnpm build:mac:safe` を実行する
7. `app/out/darwin/` で生成された `Relic.app` を `Relic-macOS-arm64.zip` にまとめ、SHA-256 checksumを生成する
8. Windows runnerで `app/` の依存関係をインストールする
9. Windows runnerで `pnpm build:win:safe` を実行する
10. `app/out/win32/` で生成されたWindows向けアプリを `Relic-Windows.zip` にまとめ、SHA-256 checksumを生成する
11. `GITHUB_TOKEN` でGitHub Releaseを確認し、存在しない場合だけDraft Releaseを作成する
12. GitHub Releaseが存在する場合はDraftかどうかを確認し、DraftならAssets添付へ進む
13. GitHub Releaseが存在し、Draftではない場合は失敗として停止し、Assets添付を行わない
14. Assetsアップロード直前に再度Draftかどうかを確認し、Draftではない場合は失敗として停止する
15. `Relic-macOS-arm64.zip`、`Relic-Windows.zip`、各 `.sha256`、`THIRD_PARTY_NOTICES.md`、`relic-dependencies.cdx.json` が存在することを確認する
16. `sha256sum -c` でZIPとchecksumの整合を確認する
17. Draft Release上に同名Assetsがないことを確認する
18. `Relic-macOS-arm64.zip`、`Relic-Windows.zip`、各 `.sha256`、`THIRD_PARTY_NOTICES.md`、`relic-dependencies.cdx.json` をAssetsに添付する

workflow全体の権限は `contents: read` に抑え、Release作成を行う `draft-release` ジョブだけ `contents: write` を持つ。
`draft-release` ジョブは `THIRD_PARTY_NOTICES.md` とSBOMをAssetsへ添付するためにcheckoutする。
GitHub CLIが対象リポジトリを確実に判断できるように、checkoutの有無にかかわらず `GH_REPO: ${{ github.repository }}` を明示する。
Releaseが存在しない場合は `gh release create "$TAG_NAME" --draft --generate-notes --verify-tag` で作成する。
既に同じタグのReleaseが存在する場合は `isDraft` を確認し、Draft Releaseの場合だけ次へ進む。
公開済みReleaseの場合は、既に利用者が取得できる状態になっている可能性があるため、workflowを失敗させてAssetsを自動更新しない。
Draft Release上に同名Assetsがある場合も、既存ファイルを上書きせずworkflowを失敗させる。
途中失敗後に再実行する場合は、人がDraft Release上の該当Assetsを確認して削除してから再実行する。
アップロード対象のAssetsが見つからない場合は、実際に存在するファイル一覧を出して失敗し、Assetsアップロードを行わない。
外部actionはGitHub公式actionを優先し、DependabotのGitHub Actions更新Pull Requestで参照更新を確認する。
より厳密なサプライチェーン固定が必要になった場合は、action参照をcommit SHAへ固定し、更新Pull RequestでSHA差分を確認する。

Draft Release作成後、GitHub上でRelease本文とAssetsを確認し、問題がなければPublishする。
Publishは自動化しない。間違った成果物や説明文をそのまま公開しないため、最後の公開判断は人が行う。

### ローカル確認

GitHub Actions実行前に手元で事前確認する場合は `app/` で次を実行する。

```sh
pnpm verify
pnpm build:mac:safe
```

Windows向けの最終確認は、Windows環境で起動確認できた成果物だけを対象にする。

### Assets

GitHub ReleasesのAssetsには、workflowが作成した配布ファイルを添付する。

- macOS Apple Silicon: `Relic-macOS-arm64.zip`
- macOS Apple Silicon checksum: `Relic-macOS-arm64.zip.sha256`
- Windows: `Relic-Windows.zip`
- Windows checksum: `Relic-Windows.zip.sha256`
- Third-party notices: `THIRD_PARTY_NOTICES.md`
- SBOM: `relic-dependencies.cdx.json`

Intel Mac向け配布は今回は別作業とする。
未確認の成果物、途中生成物、`app/out/` の中身を説明なくまとめたファイルは添付しない。
OS別出力先のうち、GitHub Releasesに添付するのはworkflowが `release-assets` に集めた配布用ファイルだけとする。

### リリースでまだ行わないこと

- アプリ起動時の自動更新確認
- アプリ内の更新通知
- `electron-updater` などの自動更新ライブラリ導入
- Publishまでの完全自動化
- コード署名、公証、App Store配布、インストーラー方式の変更
- 個人ログイン情報、パスワード、外部サービス認証情報の利用

これらが必要になった場合は、配布方式、署名、Windows/macOSの確認方法を別作業として決めてから進める。

現時点の配布物は未署名・未公証ビルドとして扱う。
macOS配布物はApple Silicon向けであり、Intel Mac向けは未対応とする。
利用者向けRelease本文では、この制約とchecksum確認方法を明記する。
公開後に重大な問題が見つかった場合も、公開済みAssetsは原則として差し替えず、新しいPATCHバージョンでHotfixを作成する。

---

## 完了報告

完了報告では、次の内容を簡潔に明記する。

- 実施した変更
- 更新した文書、または更新不要と判断した文書
- 実施した検証
- 実施しなかった検証がある場合は理由
- コミットした場合はコミットID
- pushしていない場合は未pushであること
