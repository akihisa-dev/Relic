# Relic 用語集

このドキュメントはRelicの設計・開発・会話において使用する用語を定義する。
ここに定義された用語は、仕様書・作業記録・会話すべてで一貫して使用すること。

この文書は常時読む前提ではなく、用語の意味や実装上の呼び名を確認するときだけ該当箇所を参照する。
仕様上の振る舞いは `docs/features/`、画面構成は `docs/design/`、データ構造は `docs/engineering/data-model.md` を正とする。

対照表の参照アプリ：**Obsidian / VS Code**

## 英名・実装識別子の扱い

Relic英語名は、文書・会話・将来の英語UIで使う概念名を指す。
実装識別子は、TypeScript型、union値、設定キー、IPC名、component / store / hook名など、コード上で対象機能を追うための名前を指す。

コード上の名称がRelic英語名を兼ねる場合もあるが、常に同一とは扱わない。
1対1でない場合は主要識別子を複数列挙し、コード直結しない概念は `該当なし` と明記する。

| 用語 | Relic英語名 | 実装識別子 | 主な実装位置 | 関連仕様 |
|------|-------------|------------|--------------|----------|
| ワークスペース | Workspace | `WorkspaceSummary`, `WorkspaceState`, `workspace:*`, `workspaces`, `lastWorkspaceId` | `app/src/shared/ipc.ts`, `app/src/main/workspace/workspaceService.ts`, `app/src/main/settings/appSettings.ts` | [files](../features/files.md), [data-model](../engineering/data-model.md) |
| ファイル | Markdown file | `MarkdownFileContent`, `WorkspaceFileNode`, `FileTab`, `kind: "file"` | `app/src/shared/ipc.ts`, `app/src/main/ipc/markdownFileHandlers.ts`, `app/src/renderer/store/editorStore.ts` | [files](../features/files.md), [editor](../features/editor.md), [markdown](../features/markdown.md) |
| フォルダ | Folder | `WorkspaceFolderNode`, `CreateFolderInput`, `RenameFolderInput`, `MoveFolderInput` | `app/src/shared/ipc.ts`, `app/src/main/ipc/folderItemHandlers.ts`, `app/src/main/files/folders.ts` | [files](../features/files.md) |
| ライブプレビュー | Live preview | `editorLivePreview`, `previewMarkdown`, `sourceMode: false` | `app/src/renderer/editorLivePreview.ts`, `app/src/renderer/previewMarkdown.ts`, `app/src/renderer/editorExtensions.ts` | [editor](../features/editor.md), [markdown](../features/markdown.md), [editor-engine](../engineering/editor-engine.md) |
| ソースモード | Source mode | `isSourceMode`, `sourceMode`, `pane.sourceMode` | `app/src/renderer/App.tsx`, `app/src/renderer/components/AppEditorWorkspace.tsx`, `app/src/renderer/editorExtensions.ts` | [editor](../features/editor.md) |
| タイプライターモード | Typewriter mode | `isTypewriterMode`, `typewriterMode`, `toggleTypewriterMode` | `app/src/renderer/store/uiStore.ts`, `app/src/renderer/editorExtensions.ts`, `app/src/renderer/hooks/useCommandPaletteCommands.ts` | [editor](../features/editor.md), [commands](../features/commands.md) |
| 内部リンク | Internal link | `WikiLink`, `ResolvedWikiLink`, `resolveWikiLinks`, `buildWikiLinkCompletionSource` | `app/src/shared/links.ts`, `app/src/renderer/editorExtensions.ts`, `app/src/main/files/linkUpdater.ts` | [links](../features/links.md), [markdown](../features/markdown.md) |
| バックリンク | Backlinks | `Backlink`, `getBacklinksChannel`, `readBacklinks`, `links.backlinks` | `app/src/shared/ipc.ts`, `app/src/main/files/backlinks.ts`, `app/src/renderer/components/AppRightPanel.tsx` | [links](../features/links.md) |
| アウトゴーイングリンク | Outgoing links | `outgoingLinks`, `ResolvedWikiLink`, `links.outgoing` | `app/src/renderer/components/AppRightPanel.tsx`, `app/src/renderer/editorDerivedState.ts`, `app/src/shared/links.ts` | [links](../features/links.md) |
| タグ | Tag | `WorkspaceTagSummary`, `getWorkspaceTagsChannel`, `tags`, `frontmatterTags` | `app/src/shared/ipc.ts`, `app/src/main/files/tags.ts`, `app/src/shared/tags.ts` | [links](../features/links.md), [frontmatter](../features/frontmatter.md) |
| フロントマター | Frontmatter | `frontmatter`, `parseFrontmatter`, `writeFrontmatter`, `getFrontmatterValueCandidatesChannel` | `app/src/main/files/frontmatter.ts`, `app/src/renderer/editorFrontmatter.ts`, `app/src/renderer/editorFrontmatterModel.ts` | [frontmatter](../features/frontmatter.md), [data-model](../engineering/data-model.md) |
| 図表コードブロック | Diagram code block | `DiagramLanguage`, `diagramLanguageFor`, `renderDiagramElement`, `DiagramBlockWidget`, `data-diagram-source` | `app/src/renderer/diagramLanguage.ts`, `app/src/renderer/diagramPreview.ts`, `app/src/renderer/editorDiagramLivePreview.ts` | [markdown](../features/markdown.md), [editor-engine](../engineering/editor-engine.md) |
| フロントマターテンプレート | Frontmatter template | `FrontmatterTemplate`, `frontmatterTemplates`, `getFrontmatterTemplatesChannel` | `app/src/shared/ipc.ts`, `app/src/main/settings/appSettings.ts`, `app/src/main/ipc/workspacePreferenceHandlers.ts` | [frontmatter](../features/frontmatter.md) |
| 固定プロパティ | Fixed property | `FIXED_FIELDS`, `RESERVED_FIELD_NAMES`, `aliases`, `tags`, `status`, `chronicle0`〜`chronicle9`, `plannedDate`, `actualDate` | `app/src/renderer/frontmatterSettingsModel.ts`, `app/src/main/ipc/workspaceHandlerValidators.ts` | [frontmatter](../features/frontmatter.md), [data-model](../engineering/data-model.md) |
| カスタムプロパティ | Custom property | `UserDefinedField`, `UserDefinedFieldType`, `userDefinedFields`, `getUserDefinedFieldsChannel` | `app/src/shared/ipc.ts`, `app/src/renderer/frontmatterSettingsModel.ts`, `app/src/main/settings/appSettings.ts` | [frontmatter](../features/frontmatter.md) |
| アプリウィンドウ | App window | `BrowserWindow`, `App`, `createWindow` | `app/src/main/main.ts`, `app/src/renderer/App.tsx` | [design](../design/DESIGN.md), [architecture](../engineering/architecture.md) |
| タイトルバー | Title bar | `titleBarStyle`, `trafficLightPosition` | `app/src/main/main.ts` | [design](../design/DESIGN.md) |
| タブバー | Tab bar | `PaneTabBar`, `pane-tab-bar`, `tabIds` | `app/src/renderer/components/PaneTabBar.tsx`, `app/src/renderer/components/PaneView.tsx`, `app/src/renderer/store/editorStore.ts` | [design](../design/DESIGN.md) |
| カラム | Column | `main-area`, `editor-layout`, `AppRail`, `AppFilesSidebar`, `AppRightPanel` | `app/src/renderer/components/AppEditorWorkspace.tsx`, `app/src/renderer/components/AppRail.tsx`, `app/src/renderer/components/AppFilesSidebar.tsx` | [design](../design/DESIGN.md) |
| ペイン | Pane | `PaneId`, `PaneState`, `leftPane`, `rightPane`, `PaneView` | `app/src/renderer/store/editorStore.ts`, `app/src/renderer/components/PaneView.tsx`, `app/src/renderer/store/editorStoreModel.ts` | [navigation](../features/navigation.md), [design](../design/DESIGN.md) |
| パネル | Panel | `PanelTabKind`, `PanelTab`, `kind: "panel"`, `RightPanelView` | `app/src/renderer/store/editorStore.ts`, `app/src/renderer/store/uiStore.ts`, `app/src/renderer/components/AppRightPanel.tsx` | [design](../design/DESIGN.md) |
| メインエリア | Main area | `main-area`, `AppEditorWorkspace`, `PaneView`, `PaneContentSurface` | `app/src/renderer/components/AppEditorWorkspace.tsx`, `app/src/renderer/components/PaneView.tsx`, `app/src/renderer/components/PaneContentSurface.tsx` | [design](../design/DESIGN.md) |
| 左レール | Left rail | `AppRail`, `RailNavigation`, `AppRailView`, `AppRailViewId` | `app/src/renderer/components/AppRail.tsx`, `app/src/renderer/components/RailNavigation.tsx`, `app/src/renderer/appShellModel.ts` | [design](../design/DESIGN.md) |
| ファイルサイドバー | Files sidebar | `FilesSidebar`, `AppFilesSidebar`, `SidebarView: "files"` | `app/src/renderer/components/FilesSidebar.tsx`, `app/src/renderer/components/AppFilesSidebar.tsx`, `app/src/renderer/store/uiStore.ts` | [files](../features/files.md), [search](../features/search.md), [design](../design/DESIGN.md) |
| サイドバー | Sidebar | `SidebarView`, `isSidebarOpen`, `activeSidebarView` | `app/src/renderer/store/uiStore.ts`, `app/src/renderer/components/AppFilesSidebar.tsx`, `app/src/renderer/hooks/useSidebarResize.ts` | [design](../design/DESIGN.md) |
| ワークスペース切替 | Workspace switcher | `RailWorkspaceSwitcher`, `switchWorkspaceChannel`, `SwitchWorkspaceInput`, `renameWorkspaceChannel` | `app/src/renderer/components/RailWorkspaceSwitcher.tsx`, `app/src/shared/ipc.ts`, `app/src/main/ipc/workspaceRegistrationHandlers.ts` | [files](../features/files.md), [design](../design/DESIGN.md) |
| ファイルツリー | File tree | `FileTree`, `WorkspaceTreeNode`, `readWorkspaceFileTree`, `fileTree` | `app/src/renderer/components/FileTree.tsx`, `app/src/main/files/fileTree.ts`, `app/src/shared/ipc.ts` | [files](../features/files.md), [design](../design/DESIGN.md) |
| Markdown操作メニュー | Markdown action menu | `EditorContextMenu`, `useToolbarActions`, `toolbarCommands`, `MarkdownActionIcons` | `app/src/renderer/components/EditorContextMenu.tsx`, `app/src/renderer/hooks/useToolbarActions.ts`, `app/src/renderer/toolbarCommands.ts`, `app/src/renderer/components/MarkdownActionIcons.tsx` | [editor](../features/editor.md), [markdown](../features/markdown.md) |
| タブ行アクション | Pane actions | `main-area-actions`, `PaneView`, `actionSlot`, `onSourceModeToggle`, `onSplitToggle` | `app/src/renderer/components/AppEditorWorkspace.tsx`, `app/src/renderer/components/PaneView.tsx` | [navigation](../features/navigation.md), [design](../design/DESIGN.md) |
| エディタ本体 | Editor | `Editor`, `EditorView`, `buildExtensions`, `FileTab` | `app/src/renderer/components/Editor.tsx`, `app/src/renderer/editorExtensions.ts`, `app/src/renderer/store/editorStore.ts` | [editor](../features/editor.md), [markdown](../features/markdown.md), [editor-engine](../engineering/editor-engine.md) |
| 右パネル | Right panel | `rightPanel`, `RightPanelView`, `AppRightPanel`, `isRightPanelOpen` | `app/src/shared/ipc.ts`, `app/src/renderer/store/uiStore.ts`, `app/src/renderer/components/AppRightPanel.tsx` | [navigation](../features/navigation.md), [design](../design/DESIGN.md) |
| ステータスバー | Status bar | `AppStatusBar` | `app/src/renderer/components/AppStatusBar.tsx` | [design](../design/DESIGN.md) |
| タブ | Tab | `Tab`, `tabIds`, `activeTabId`, `PaneTabBar` | `app/src/renderer/store/editorStore.ts`, `app/src/renderer/components/PaneTabBar.tsx`, `app/src/renderer/paneViewModel.ts` | [navigation](../features/navigation.md), [design](../design/DESIGN.md) |
| ファイルタブ | File tab | `FileTab`, `kind: "file"`, `openFileInPane` | `app/src/renderer/store/editorStore.ts`, `app/src/renderer/store/editorStoreModel.ts`, `app/src/renderer/components/PaneView.tsx` | [editor](../features/editor.md), [design](../design/DESIGN.md) |
| パネルタブ | Panel tab | `PanelTab`, `PanelTabKind`, `kind: "panel"`, `openPanelInPane` | `app/src/renderer/store/editorStore.ts`, `app/src/renderer/hooks/useAppTabRenderers.tsx`, `app/src/renderer/hooks/useAppRailNavigation.tsx` | [design](../design/DESIGN.md) |
| チャートタブ | Chart tab | `ChartTab`, `kind: "chart"`, `openChartInPane`, `chart-chronicle`, `chart-date` | `app/src/renderer/store/editorStore.ts`, `app/src/renderer/store/editorStoreModel.ts`, `app/src/renderer/hooks/useAppTabRenderers.tsx` | [design](../design/DESIGN.md) |
| 年表チャート | Chronicle chart | `chronicle`, `chronicle0`〜`chronicle9`, `ChartSource`, `WorkspaceChart`, `defaultCharts` | `app/src/shared/ipc.ts`, `app/src/main/files/charts.ts`, `app/src/renderer/components/ChartPanel.tsx` | [frontmatter](../features/frontmatter.md), [data-model](../engineering/data-model.md), [design](../design/DESIGN.md) |
| アウトラインパネル | Outline panel | `RightPanelView: "outline"`, `outlineHeadings`, `OutlineHeading` | `app/src/renderer/store/uiStore.ts`, `app/src/renderer/components/AppRightPanel.tsx`, `app/src/renderer/editorDerivedState.ts` | [editor](../features/editor.md), [design](../design/DESIGN.md) |
| リンクパネル | Links panel | `RightPanelView: "links"`, `backlinks`, `outgoingLinks`, `links.*` | `app/src/renderer/store/uiStore.ts`, `app/src/renderer/components/AppRightPanel.tsx`, `app/src/renderer/appLinks.ts` | [links](../features/links.md), [design](../design/DESIGN.md) |
| ファイル加工ツール | File tools | `tools`, `ToolsPanel`, `tools:*`, `mergeFiles`, `splitFileByHeading` | `app/src/shared/ipc.ts`, `app/src/main/ipc/toolActions.ts`, `app/src/renderer/components/ToolsPanel.tsx` | [tools](../features/tools.md), [design](../design/DESIGN.md) |
| フロントマター設定 | Frontmatter settings | `frontmatter`, `FrontmatterPanel`, `UserDefinedField`, `FIXED_FIELDS` | `app/src/renderer/components/FrontmatterPanel.tsx`, `app/src/renderer/frontmatterSettingsModel.ts`, `app/src/shared/ipc.ts` | [frontmatter](../features/frontmatter.md), [design](../design/DESIGN.md) |
| 暦設定 | Calendar settings | `chronicleSettings`, `ChronicleSettingsPanel`, `chronicleCalendars` | `app/src/renderer/components/ChronicleSettingsPanel.tsx`, `app/src/renderer/hooks/useWorkspaceChronicleCalendars.ts`, `app/src/main/settings/workspaceSettings.ts` | [frontmatter](../features/frontmatter.md), [data-model](../engineering/data-model.md), [design](../design/DESIGN.md) |
| 設定 | Settings | `settings`, `SettingsPanel`, `EditorSettings`, `app-settings.json` | `app/src/renderer/components/SettingsPanel.tsx`, `app/src/main/settings/appSettings.ts`, `app/src/shared/ipc.ts` | [design](../design/DESIGN.md), [stack](../engineering/stack.md) |
| 機能トグル | Feature toggles | `FeatureToggles`, `featureToggles`, `ai`, `tools`, `frontmatter`, `rightPanelOutline`, `rightPanelLinks` | `app/src/shared/ipc.ts`, `app/src/main/settings/appSettings.ts`, `app/src/renderer/components/SettingsPanel.tsx` | [design](../design/DESIGN.md), [coding-rules](../development/coding-rules.md) |
| コマンドパレット | Command palette | `CommandPalette`, `showCommandPalette`, `useCommandPaletteCommands`, `commandPalette.*` | `app/src/renderer/components/CommandPalette.tsx`, `app/src/renderer/hooks/useCommandPaletteCommands.ts`, `app/src/renderer/App.tsx` | [commands](../features/commands.md), [navigation](../features/navigation.md) |
| クイックスイッチャー | Quick switcher | `QuickSwitcher`, `showQuickSwitcher`, `command.quickSwitcher`, `quickSwitcher.*` | `app/src/renderer/components/QuickSwitcher.tsx`, `app/src/renderer/hooks/useCommandPaletteCommands.ts`, `app/src/renderer/App.tsx` | [commands](../features/commands.md), [navigation](../features/navigation.md) |
| ピン留め | Pinning | `pinnedPaths`, `togglePinChannel`, `togglePin`, `files.pinned` | `app/src/shared/ipc.ts`, `app/src/main/settings/workspaceSettings.ts`, `app/src/renderer/components/FileTree.tsx` | [files](../features/files.md), [design](../design/DESIGN.md) |
| 分割表示 | Split view | `isSplit`, `toggleSplit`, `PaneId`, `leftPane`, `rightPane` | `app/src/renderer/store/editorStore.ts`, `app/src/renderer/store/editorStoreModel.ts`, `app/src/renderer/components/AppEditorWorkspace.tsx` | [navigation](../features/navigation.md), [design](../design/DESIGN.md) |

---

## 基本構造

### ワークスペース
ユーザーがRelicに登録したローカルフォルダ1つ。その中の `.md` ファイルがアプリで管理される。検索・内部リンク・タグはこの単位で完結する。同期や履歴管理が必要な場合は、OS・クラウド同期フォルダ・Relic外部のツールで扱う。

| Obsidian | VS Code |
|---|---|
| Vault | Workspace |

---

### ファイル
ワークスペース内に存在するMarkdownファイル（`.md`）1つ。Relicにおける情報の最小単位。フロントマターとテキストコンテンツで構成される。

| Obsidian | VS Code |
|---|---|
| Note | File |

---

### フォルダ
ワークスペース内でファイルをグループ化する入れ物。OSのディレクトリと1対1で対応する。フォルダの中にさらにフォルダを作ることができる（ネスト）。

| Obsidian | VS Code |
|---|---|
| Folder | Folder |

---

## エディタモード

### ライブプレビュー
エディタのデフォルトモード。Markdown記法をリアルタイムにレンダリングして表示する。カーソルまたは選択範囲が装飾された文字に触れているときは、その装飾に使われている記法だけを表示し、レンダリング自体は維持する。

| Obsidian | VS Code |
|---|---|
| Live Preview | Preview（別ペイン） |

---

### ソースモード
Markdown記法をそのままテキストとして表示するモード。レンダリングを行わない。`**太字**` はそのまま `**太字**` と表示される。

| Obsidian | VS Code |
|---|---|
| Source mode | 通常の編集画面 |

---

### タイプライターモード
カーソル行が常に画面中央付近に来るようにスクロールする表示補助。書いている行を見失いにくくするためのモード。

| Obsidian | VS Code |
|---|---|
| Typewriter mode | — |

---

## リンク・タグ

### 内部リンク
`[[ファイル名]]` 記法でワークスペース内の別のファイルへリンクを張る機能。リンク先が存在しない場合は未作成であることを示すスタイルで表示し、クリックで新規ファイルを作成できる。

| Obsidian | VS Code |
|---|---|
| Internal link / Wiki link | — |

---

### バックリンク
あるファイルを内部リンクで参照している他のファイルの一覧。「このファイルはどこから参照されているか」を示す。右パネルに表示され、エクスポート・印刷の対象には含まれない。

| Obsidian | VS Code |
|---|---|
| Backlinks | — |

---

### アウトゴーイングリンク
あるファイルが内部リンクで参照している他のファイルの一覧。「このファイルはどこへリンクしているか」を示す。右パネルに表示され、エクスポート・印刷の対象には含まれない。

| Obsidian | VS Code |
|---|---|
| Outgoing links | — |

---

### タグ
ファイルをカテゴリ分けするためのラベル。フロントマターの固定プロパティ `tags:` で付与できる。複数のファイルを横断して検索・絞り込みができる。本文中の関連づけにはインラインリンク `[[...]]` を使う。

| Obsidian | VS Code |
|---|---|
| Tag | — |

---

### フロントマター
ファイル先頭の `---` で囲まれたYAMLブロック。ファイルのメタデータ（タイトル・タグ・日付など）を記述する場所。エディタ上では生のYAMLではなくフォーム形式で表示・編集できる。

| Obsidian | VS Code |
|---|---|
| Frontmatter / Properties | — |

---

### 図表コードブロック
Markdown本文中の `mermaid` または `d2` コードブロック。保存される正本はコードブロック内のソース文字列で、Relicは表示時だけSVGへ変換する。生成SVGとpan / zoom状態はMarkdownファイルへ保存しない。

| Obsidian | VS Code |
|---|---|
| Mermaid block（類似） | Markdown code block |

---

### フロントマターテンプレート
複数の能力付きフィールド名をまとめるアプリ設定上の保存済みセット。ワークスペース内の専用テンプレートフォルダや本文テンプレートファイルには依存しない。現行UIではテンプレート管理画面やテンプレート適用操作は表示しない。

| Obsidian | VS Code |
|---|---|
| Template（類似） | Snippet（類似） |

---

### 固定プロパティ
Relicが意味を知っているフロントマターキー。`aliases`、`tags`、`status`、`chronicle0`〜`chronicle9`、`plannedDate`、`actualDate` を指す。

| Obsidian | VS Code |
|---|---|
| Core properties（類似） | — |

---

### カスタムプロパティ
ユーザーが任意の名前で追加し、入力能力を割り当てるフロントマターキー。入力能力はテキスト、数値、日付、日時、時刻、真偽値、選択肢、複数候補、URLを扱う。

| Obsidian | VS Code |
|---|---|
| User properties（類似） | — |

---

## UI要素

### アプリウィンドウ
アプリ全体が表示される1つのウィンドウ。タイトルバー・左レール・ファイルサイドバー・メインエリア・右パネル・ステータスバーなど、画面上のすべてのUI要素を含む外枠。

| Obsidian | VS Code |
|---|---|
| App window | Window |

---

### タイトルバー
ウィンドウ最上部のバー。macOSのウィンドウ操作ボタン、アプリ名、タブバーなどのグローバルな情報を表示する領域。

| Obsidian | VS Code |
|---|---|
| Title bar | Title bar |

---

### タブバー
開いているタブを横並びで表示する領域。メインエリアの各ペイン上部に配置される。個々のファイルやビューを示す部品は「タブ」と呼ぶ。

| Obsidian | VS Code |
|---|---|
| Tab bar | Tab bar |

---

### カラム
画面全体を構成する大きな縦方向の区画。レイアウトの骨格を表す言葉で、左レール、ファイルサイドバー、メインエリア、右パネルのような主要領域を指す。Relicの基本構造は「左レール + ファイルサイドバー + メインエリア」を中心にし、必要に応じて右パネルを開く。

| Obsidian | VS Code |
|---|---|
| Sidebar / Main area | Side bar / Editor area |

---

### ペイン
メインエリアの中を左右に分割した表示枠。分割表示中は左ペインと右ペインがそれぞれ独立したタブ列を持ち、ファイルタブ、パネルタブ、チャートタブを開ける。右パネルはペインではない。

| Obsidian | VS Code |
|---|---|
| Pane | Editor group |

---

### パネル
補助情報や操作を表示するための領域。Relicでは、メインエリアのタブとして開く「パネルタブ」と、ファイルタブの右側に開く「右パネル」を区別する。

| Obsidian | VS Code |
|---|---|
| Panel / Sidebar view | View / Panel |

---

### メインエリア
画面右側の主要な作業領域。ファイルタブ、パネルタブ、チャートタブを表示する。左右2ペイン分割に対応し、ペインごとに独立したタブ列を持つ。右パネルはメインエリアの右側に開く補助領域として扱う。

| Obsidian | VS Code |
|---|---|
| Editor area | Editor area |

---

### 左レール
アプリ左端の縦アイコン領域。ファイルサイドバーの開閉、チャート、ファイル加工、フロントマター設定、暦設定、設定などの入口を持つ。登録済みワークスペースがある場合は、レール下部にワークスペース切替も表示する。

| Obsidian | VS Code |
|---|---|
| Ribbon（類似） | Activity bar |

---

### ファイルサイドバー
左レールのファイル入口で開閉する可変幅のパネル。ワークスペース作成・登録、ファイルツリー、ピン留め、検索、ファイル / フォルダ操作を扱う。設定などの補助機能は、ファイルサイドバー内ではなくメインエリアのパネルタブとして開く。

| Obsidian | VS Code |
|---|---|
| File explorer | Explorer |

---

### サイドバー
単に「サイドバー」と書く場合は、原則としてファイルサイドバーを指す。設定、ファイル加工、フロントマター設定、暦設定はファイルサイドバー内ではなく、メインエリアのパネルタブとして扱う。

| Obsidian | VS Code |
|---|---|
| File explorer | Explorer |

---

### ワークスペース切替
登録済みワークスペースを選んで切り替える領域。左レール下部に表示する。ワークスペース項目は右クリックメニューから名前変更または登録一覧からの削除ができる。登録一覧から削除しても、OS上のフォルダ自体は削除しない。

| Obsidian | VS Code |
|---|---|
| Vault switcher | Workspace switcher |

---

### ファイルツリー
ファイルサイドバー内で、ワークスペース内のフォルダとMarkdownファイルを階層表示する領域。フォルダの開閉、ファイルの選択、右クリックメニュー、複数選択、ピン留め項目の表示などを行う。

| Obsidian | VS Code |
|---|---|
| File explorer | Explorer tree |

---

### Markdown操作メニュー
エディタの右クリックメニューから開くMarkdown本文の操作群。太字、見出し、リスト、リンク、表など、Markdown本文へ記法を挿入・適用する操作を配置する。現行UIには、エディタ上部に常時表示されるMarkdown書式ツールバーはない。

| Obsidian | VS Code |
|---|---|
| — | Toolbar |

---

### タブ行アクション
各ペインのタブ列右側に表示される操作群。ソースモード切り替え、分割表示、右パネルのアウトライン / リンク切り替えを扱う。開いているファイルの名前変更はファイルタブ本文上部の編集可能なファイルタイトル、ファイル移動はファイルツリーの操作で扱う。

| Obsidian | VS Code |
|---|---|
| Toolbar（類似） | Editor title actions（類似） |

---

### エディタ本体
Markdownファイルの本文を表示・編集する領域。ライブプレビュー・ソースモード・タイプライターモードなどの表示モードは、この領域に適用される。

| Obsidian | VS Code |
|---|---|
| Editor | Text editor |

---

### 右パネル
メインエリアの右側に開閉表示される補助パネル。アウトラインパネルやリンクパネルを表示する。分割表示の「右ペイン」とは別物。

| Obsidian | VS Code |
|---|---|
| Right sidebar / Right panel | Secondary side bar / Panel |

---

### ステータスバー
エディタ下部に常時表示されるバー。現在開いているファイルの文字数・単語数などの情報を表示する。

| Obsidian | VS Code |
|---|---|
| Status bar | Status bar |

---

### タブ
複数のファイルや作業画面を同時に開くためのUI。ブラウザのタブと同じ概念。メインエリアのペイン上部に横並びで表示され、タブが多い場合は横スクロールで切り替える。

| Obsidian | VS Code |
|---|---|
| Tab | Tab |

---

### ファイルタブ
Markdownファイルを表示・編集するタブ。編集可能なファイルタイトル、エディタ本体、Markdown操作メニュー、ファイル固有の右パネル操作と結びつく。

| Obsidian | VS Code |
|---|---|
| Note tab | Editor tab |

---

### パネルタブ
Markdownファイル以外の補助画面をメインエリア内に開くタブ。ファイル加工、フロントマター設定、暦設定、設定を表示する。

| Obsidian | VS Code |
|---|---|
| View tab（類似） | Editor tab / View（類似） |

---

### チャートタブ
年表をメインエリア内に開くタブ。`chronicle0`〜`chronicle9` のフロントマター値から表示行を生成する。

| Obsidian | VS Code |
|---|---|
| — | Editor tab（類似） |

---

### 年表チャート
`chronicle0`〜`chronicle9` 固定プロパティと暦設定から生成するチャート表示。単年または期間をメイン暦の横軸上に表示し、バーの移動・伸縮でMarkdownファイルの元の `chronicleN` へ書き戻す。

| Obsidian | VS Code |
|---|---|
| — | — |

---

| Obsidian | VS Code |
|---|---|
| — | — |

---

### アウトラインパネル
エディタ右側に表示されるパネル。現在開いているファイルの見出し（H1〜H6）一覧を表示し、クリックで該当箇所にジャンプできる。ボタンで開閉できる。

| Obsidian | VS Code |
|---|---|
| Outline | Outline |

---

### リンクパネル
右パネル内に表示されるリンク一覧。バックリンクとアウトゴーイングリンクを確認し、対象ファイルを開く、別ペインで開く、Markdownリンクやパスをコピーする、OS上の場所を表示する操作を扱う。

| Obsidian | VS Code |
|---|---|
| Backlinks / Outgoing links | — |

---

### ファイル加工ツール
既存Markdownファイルを読み取り専用で扱い、マージ、見出し分割、タイトル一覧、目次生成の結果を新規ファイルとして出力するパネルタブ。

| Obsidian | VS Code |
|---|---|
| — | — |

---

### フロントマター設定
ワークスペースで使うフロントマターの固定プロパティ確認と、カスタムプロパティの入力能力を管理するパネルタブ。個別ファイル内のフロントマター編集フォームとは別物。

| Obsidian | VS Code |
|---|---|
| Properties settings（類似） | — |

---

### 暦設定
年表チャートで使うメイン暦とサブ暦を管理するパネルタブ。`chronicle0` の暦名、`chronicle1`〜`chronicle9` のサブ暦名とメイン暦開始年をワークスペース設定として保存する。Markdown本文には設定値を書き込まない。

| Obsidian | VS Code |
|---|---|
| — | — |

---

### 設定
テーマ、言語、エディタ表示、フォント、行番号、スペルチェック、機能トグル、アプリ情報を扱うパネルタブ。Markdown本文やワークスペース内ファイルには保存しない。

| Obsidian | VS Code |
|---|---|
| Settings | Settings |

---

### 機能トグル
設定パネルタブで切り替える機能のオン / オフ。現行実装では、ファイル加工ツール、フロントマター設定、暦設定、年表、右パネルのアウトライン、右パネルのリンクの表示・操作入口を制御する。

| Obsidian | VS Code |
|---|---|
| Core plugin toggle（類似） | Setting toggle |

---

### コマンドパレット
`⌘⇧P` で開く操作検索モーダル。新規ファイル作成、検索、クイックスイッチャー、サイドバー開閉、分割表示、右パネル、タイプライターモード、設定などの操作をキーボードから実行する。

| Obsidian | VS Code |
|---|---|
| Command palette | Command Palette |

---

### クイックスイッチャー
`⌘P` で開くファイル検索モーダル。現在のワークスペース内のMarkdownファイルをファイル名やエイリアスで絞り込み、アクティブなペインで開く。

| Obsidian | VS Code |
|---|---|
| Quick switcher | Quick Open |

---

### ピン留め
よく使うファイルやフォルダをファイルサイドバー上部に固定表示する機能。ピン留めしたアイテムは常にすぐアクセスできる位置に表示される。

| Obsidian | VS Code |
|---|---|
| Bookmark（類似） | Pinned（類似） |

---

### 分割表示
エディタエリアを左右2つのペインに分けて、異なるファイルを同時に表示・編集できる機能。ショートカットまたはボタンで分割・解除できる。

| Obsidian | VS Code |
|---|---|
| Split pane | Split editor |

---
