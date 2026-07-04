# docs/INDEX.md

このファイルは、リポジトリ全体の索引です。
文書だけでなく、Gitで管理しているすべてのファイルとフォルダ構成を示します。

---

## 主要入口

| パス | 役割 |
|------|------|
| `AGENTS.md` | AIエージェントの普遍的な行動規範 |
| `docs/development.md` | Relicの開発作業全体のルール |
| `docs/INDEX.md` | リポジトリ全体の索引 |
| `README.md` | 対外的なプロジェクト説明 |
| `CONTRIBUTING.md` | コントリビューション方針 |
| `SECURITY.md` | 秘密情報と脆弱性報告に関する方針 |
| `LICENSE` | AGPL-3.0-or-laterのライセンス本文 |

---

## フォルダの役割

| パス | 役割 |
|------|------|
| `.githooks/` | Gitフック |
| `.github/` | GitHub Issue、Pull Request、Actions設定 |
| `app/` | Electron / React アプリ本体 |
| `app/assets/` | アプリ用アイコン素材 |
| `app/scripts/` | アプリのビルド、検証、補助スクリプト |
| `app/src/main/` | Electronメインプロセス |
| `app/src/main/files/` | Markdownファイル、検索、リンク、タグ、年表などの処理 |
| `app/src/main/ipc/` | IPCハンドラと入力検証 |
| `app/src/main/settings/` | アプリ設定とワークスペース設定 |
| `app/src/main/workspace/` | ワークスペース登録、監視、復元 |
| `app/src/preload/` | レンダラーへ公開するpreload API |
| `app/src/renderer/` | React UI、CodeMirror、画面状態 |
| `app/src/renderer/components/` | Reactコンポーネント |
| `app/src/renderer/hooks/` | React hook |
| `app/src/renderer/store/` | ZustandなどのUI状態管理 |
| `app/src/renderer/styles/` | CSS分割ファイル |
| `app/src/shared/` | main、preload、rendererで共有する型、定数、純粋関数 |
| `app/src/test/` | テスト共通ユーティリティ |
| `assets/` | READMEなどで使う画像素材 |
| `docs/` | プロジェクト文書 |
| `docs/design/` | デザイン正本と関連資料 |
| `docs/engineering/` | アーキテクチャ、データモデル、技術選定、設計判断 |
| `docs/features/` | 機能仕様 |
| `docs/logo/` | ロゴ素材 |
| `docs/project/` | プロジェクト概要と用語 |
| `scripts/` | OS別の起動・ビルド補助スクリプト |

---

## 文書分類

| 分類 | 対象 | 扱い |
|------|------|------|
| AI行動規範 | `AGENTS.md` | AIエージェントの普遍的な振る舞いだけを扱う |
| リポジトリ索引 | `docs/INDEX.md` | 全ファイル、全フォルダ、主要入口を扱う |
| プロジェクト | `docs/project/` | Relicの目的、対象ユーザー、用語を扱う |
| 機能 | `docs/features/` | アプリ機能の振る舞いを扱う |
| デザイン | `docs/design/` | 画面構成、画面遷移、デザインシステムを扱う |
| エンジニアリング | `docs/engineering/` | アーキテクチャ、データモデル、技術選定、設計判断を扱う |
| 開発運用 | `docs/development.md` | Relicの開発ルール全体を扱う |

---

## 全ファイル・フォルダ構成

以下はGitで管理しているファイルとフォルダの一覧です。

- `.githooks/`
  - `pre-commit`
  - `pre-push`
  - `secret-guard.sh`
- `.github/`
  - `ISSUE_TEMPLATE/`
    - `bug_report.md`
    - `feature_request.md`
  - `workflows/`
    - `draft-release.yml`
  - `pull_request_template.md`
  - `RELEASE_CHECKLIST.md`
- `app/`
  - `assets/`
    - `icon.iconset/`
      - `icon_128x128.png`
      - `icon_128x128@2x.png`
      - `icon_16x16.png`
      - `icon_16x16@2x.png`
      - `icon_256x256.png`
      - `icon_256x256@2x.png`
      - `icon_32x32.png`
      - `icon_32x32@2x.png`
      - `icon_512x512.png`
      - `icon_512x512@2x.png`
    - `icon.icns`
    - `icon.ico`
  - `scripts/`
    - `build-platform.mjs`
    - `check-package-artifacts.mjs`
    - `clean-out.mjs`
    - `dependency-metadata.mjs`
    - `docs-index.mjs`
    - `generate-icons.mjs`
    - `generate-large-workspace.mjs`
    - `generate-sbom.mjs`
    - `generate-third-party-notices.mjs`
    - `renderer-size-report.mjs`
    - `run-forge-build.mjs`
  - `src/`
    - `main/`
      - `files/`
        - `aliases.test.ts`
        - `aliases.ts`
        - `aliasesModel.ts`
        - `atomicWrite.test.ts`
        - `atomicWrite.ts`
        - `backlinks.test.ts`
        - `backlinks.ts`
        - `charts.test.ts`
        - `charts.ts`
        - `chronicleData.test.ts`
        - `chronicleData.ts`
        - `chronicleModel.test.ts`
        - `chronicleModel.ts`
        - `concurrency.test.ts`
        - `concurrency.ts`
        - `fileRecovery.test.ts`
        - `fileRecovery.ts`
        - `fileSystem.test.ts`
        - `fileSystem.ts`
        - `fileTree.test.ts`
        - `fileTree.ts`
        - `folders.test.ts`
        - `folders.ts`
        - `frontmatter.test.ts`
        - `frontmatter.ts`
        - `frontmatterCandidates.test.ts`
        - `frontmatterCandidates.ts`
        - `imageFiles.test.ts`
        - `imageFiles.ts`
        - `linkUpdater.test.ts`
        - `linkUpdater.ts`
        - `linkUpdaterModel.ts`
        - `markdownFilePaths.test.ts`
        - `markdownFilePaths.ts`
        - `markdownFiles.test.ts`
        - `markdownFiles.ts`
        - `names.test.ts`
        - `names.ts`
        - `paths.test.ts`
        - `paths.ts`
        - `pdfFiles.test.ts`
        - `pdfFiles.ts`
        - `performanceLog.ts`
        - `regexSafety.ts`
        - `renameOperations.ts`
        - `replace.test.ts`
        - `replace.ts`
        - `replaceModel.ts`
        - `search.test.ts`
        - `search.ts`
        - `searchRequestCoordinator.test.ts`
        - `searchRequestCoordinator.ts`
        - `tags.test.ts`
        - `tags.ts`
        - `trash.test.ts`
        - `trash.ts`
        - `unlinkedReferences.test.ts`
        - `unlinkedReferences.ts`
        - `unlinkedReferencesModel.test.ts`
        - `unlinkedReferencesModel.ts`
        - `workspaceDerivedData.ts`
        - `workspaceDerivedDataSession.test.ts`
        - `workspaceDerivedDataSession.ts`
        - `workspaceFileIndex.test.ts`
        - `workspaceFileIndex.ts`
        - `workspaceGraph.test.ts`
        - `workspaceGraph.ts`
      - `ipc/`
        - `activeWorkspace.test.ts`
        - `activeWorkspace.ts`
        - `appHandlers.ts`
        - `editorHandlers.test.ts`
        - `editorHandlers.ts`
        - `editorHandlerValidators.test.ts`
        - `editorHandlerValidators.ts`
        - `fileHandlers.ts`
        - `fileHandlerValidators.test.ts`
        - `fileHandlerValidators.ts`
        - `fileSearchHandlers.ts`
        - `folderItemHandlers.ts`
        - `markdownFileHandlers.test.ts`
        - `markdownFileHandlers.ts`
        - `outputHandlers.test.ts`
        - `outputHandlers.ts`
        - `sanitizeOutputSvg.test.ts`
        - `sanitizeOutputSvg.ts`
        - `toolActions.test.ts`
        - `toolActions.ts`
        - `toolCandidateCollectors.ts`
        - `toolHandlers.ts`
        - `toolHandlerValidators.test.ts`
        - `toolHandlerValidators.ts`
        - `toolMarkdownFormat.ts`
        - `toolOutputFiles.ts`
        - `toolWikiLinks.test.ts`
        - `toolWikiLinks.ts`
        - `workspaceDataHandlers.ts`
        - `workspaceHandlers.test.ts`
        - `workspaceHandlers.ts`
        - `workspaceHandlerValidators.test.ts`
        - `workspaceHandlerValidators.ts`
        - `workspacePreferenceHandlers.ts`
        - `workspaceRegistrationHandlers.ts`
        - `workspaceState.ts`
      - `settings/`
        - `appSettings.test.ts`
        - `appSettings.ts`
        - `secureSettingsFile.test.ts`
        - `secureSettingsFile.ts`
        - `workspaceSettings.test.ts`
        - `workspaceSettings.ts`
      - `workspace/`
        - `workspaceService.test.ts`
        - `workspaceService.ts`
        - `workspaceWatcher.test.ts`
        - `workspaceWatcher.ts`
      - `devServerLoader.test.ts`
      - `devServerLoader.ts`
      - `i18n.ts`
      - `main.ts`
      - `windowCloseProtection.test.ts`
      - `windowCloseProtection.ts`
      - `windowOptions.test.ts`
      - `windowOptions.ts`
      - `windowSecurity.test.ts`
      - `windowSecurity.ts`
    - `preload/`
      - `preload.test.ts`
      - `preload.ts`
    - `renderer/`
      - `components/`
        - `AppEditorWorkspace.tsx`
        - `AppFilesSidebar.tsx`
        - `AppLayout.tsx`
        - `AppMainActions.tsx`
        - `AppOverlays.tsx`
        - `AppRail.tsx`
        - `AppRightPanel.test.tsx`
        - `AppRightPanel.tsx`
        - `AppStatusBar.tsx`
        - `AppTitleBar.test.tsx`
        - `AppTitleBar.tsx`
        - `ChartPanel.tsx`
        - `ChronicleBubbleCanvas.tsx`
        - `ChronicleChartGrid.tsx`
        - `chronicleChartParts.tsx`
        - `ChronicleSettingsPanel.test.tsx`
        - `ChronicleSettingsPanel.tsx`
        - `ChronicleTracks.test.tsx`
        - `ChronicleTracks.tsx`
        - `CommandPalette.tsx`
        - `Editor.accessibility.test.tsx`
        - `Editor.frontmatter.test.tsx`
        - `Editor.frontmatterFields.test.tsx`
        - `Editor.link.test.tsx`
        - `Editor.livePreview.test.tsx`
        - `Editor.markdownEditing.test.tsx`
        - `Editor.preview.test.tsx`
        - `Editor.selection.test.tsx`
        - `Editor.shortcut.test.tsx`
        - `Editor.table.test.tsx`
        - `Editor.tsx`
        - `Editor.viewState.test.tsx`
        - `EditorContextMenu.tsx`
        - `EditorFrontmatterDialog.tsx`
        - `EditorFrontmatterPropertyMenu.tsx`
        - `editorTestHelpers.ts`
        - `FilesSearchResults.test.tsx`
        - `FilesSearchResults.tsx`
        - `FilesSidebar.tsx`
        - `FilesSidebarSearch.test.tsx`
        - `FilesSidebarSearch.tsx`
        - `FilesSidebarTreeSection.tsx`
        - `FilesWorkspaceActions.tsx`
        - `FileTree.test.tsx`
        - `FileTree.tsx`
        - `FileTreeContextMenu.tsx`
        - `FileTreeItemRow.tsx`
        - `FrontmatterChoiceEditor.tsx`
        - `FrontmatterFieldAddForm.tsx`
        - `FrontmatterFieldList.tsx`
        - `FrontmatterFixedFields.tsx`
        - `FrontmatterPanel.tsx`
        - `GraphView.tsx`
        - `LayoutResizeBoundary.test.tsx`
        - `LayoutResizeBoundary.tsx`
        - `MarkdownActionIcons.tsx`
        - `PagePreviewPopover.tsx`
        - `PaneContentSurface.test.tsx`
        - `PaneContentSurface.tsx`
        - `PaneTabBar.tsx`
        - `PaneTabContextMenu.tsx`
        - `PaneTabs.tsx`
        - `PaneView.test.tsx`
        - `PaneView.tsx`
        - `Preview.test.tsx`
        - `Preview.tsx`
        - `QuickSwitcher.tsx`
        - `RailNavigationIcons.tsx`
        - `railNavigationModel.ts`
        - `railNavigationViews.tsx`
        - `RailWorkspaceSwitcher.tsx`
        - `RightPanelFrontmatterForm.test.tsx`
        - `RightPanelFrontmatterForm.tsx`
        - `RightPanelRecoveryList.tsx`
        - `SettingsPanel.test.tsx`
        - `SettingsPanel.tsx`
        - `SettingsSegmentedControl.tsx`
        - `TagIndexToolSection.tsx`
        - `TocToolSection.tsx`
        - `Toolbar.test.tsx`
        - `Toolbar.tsx`
        - `ToolbarButtonGroups.tsx`
        - `ToolsPanel.test.tsx`
        - `ToolsPanel.tsx`
        - `ToolsPanelMergeSections.tsx`
        - `ToolsPanelSections.tsx`
        - `ToolsPanelTitleSections.tsx`
        - `ToolStatus.tsx`
      - `hooks/`
        - `useActiveDocumentContext.test.ts`
        - `useActiveDocumentContext.ts`
        - `useAppCloseGuards.ts`
        - `useAppInlineHandlers.ts`
        - `useAppKeyboardShortcuts.ts`
        - `useAppLayoutWidths.ts`
        - `useAppPaneFileActions.ts`
        - `useAppPreviewOutputActions.ts`
        - `useAppRailNavigation.tsx`
        - `useAppRailSidebarSelection.ts`
        - `useAppSettingsState.test.ts`
        - `useAppSettingsState.ts`
        - `useAppTabRenderers.tsx`
        - `useAppTheme.ts`
        - `useAppToast.ts`
        - `useAppWorkspaceCollections.ts`
        - `useAutoSave.test.ts`
        - `useAutoSave.ts`
        - `useBacklinksState.ts`
        - `useChronicleChartModel.ts`
        - `useChronicleChartViewport.ts`
        - `useChronicleEntryDrag.test.ts`
        - `useChronicleEntryDrag.ts`
        - `useCommandPaletteCommands.ts`
        - `useEditorAutoSave.test.ts`
        - `useEditorAutoSave.ts`
        - `useEditorContextMenu.ts`
        - `useEditorFrontmatterDialog.ts`
        - `useFileTreeDragDrop.ts`
        - `useFileTreeItemState.ts`
        - `useFileTreeMotion.ts`
        - `useFileTreeSelection.test.ts`
        - `useFileTreeSelection.ts`
        - `useFrontmatterFieldsState.ts`
        - `usePaneHeadingScroll.ts`
        - `usePaneTabInteractions.ts`
        - `usePaneTabMotion.ts`
        - `usePreviewEmbeds.test.ts`
        - `usePreviewEmbeds.ts`
        - `useRailFlights.ts`
        - `useSidebarFileInteractions.ts`
        - `useSidebarResize.ts`
        - `useSplitCloseMotion.ts`
        - `useStableTimelineBounds.ts`
        - `useToolbarActions.ts`
        - `useToolsPanelState.ts`
        - `useUnlinkedReferencesState.ts`
        - `useWindowCloseRequest.test.ts`
        - `useWindowCloseRequest.ts`
        - `useWorkspaceAliases.ts`
        - `useWorkspaceCharts.test.tsx`
        - `useWorkspaceCharts.ts`
        - `useWorkspaceChronicleCalendars.ts`
        - `useWorkspaceExternalRefresh.ts`
        - `useWorkspaceFileActions.ts`
        - `useWorkspaceFileCreationActions.ts`
        - `useWorkspaceFileMutationActions.ts`
        - `useWorkspaceFileOpenActions.ts`
        - `useWorkspaceFrontmatterCategoryChoices.ts`
        - `useWorkspaceRegistryActions.ts`
        - `useWorkspaceRenameRailHold.ts`
        - `useWorkspaceSearchState.ts`
        - `windowPointerDrag.test.ts`
        - `windowPointerDrag.ts`
        - `workspaceFileActionHelpers.test.ts`
        - `workspaceFileActionHelpers.ts`
        - `workspaceFileActionTypes.ts`
        - `workspaceFileMutationModel.test.ts`
        - `workspaceFileMutationModel.ts`
      - `store/`
        - `editorStore.test.ts`
        - `editorStore.ts`
        - `editorStoreModel.test.ts`
        - `editorStoreModel.ts`
        - `uiStore.ts`
      - `styles/`
        - `architectural-design.css`
        - `base.css`
        - `chronicle.css`
        - `file-tree-search.css`
        - `graph.css`
        - `preview-editor.css`
        - `right-panel.css`
        - `settings.css`
        - `shell-sidebar.css`
        - `theme-motion.css`
        - `workspace-editor.css`
      - `App.charts.test.tsx`
      - `App.externalChanges.test.tsx`
      - `App.featureToggles.test.tsx`
      - `App.fileActions.test.tsx`
      - `App.fileRename.test.tsx`
      - `App.fileTabs.test.tsx`
      - `App.layout.test.tsx`
      - `App.navigationShortcuts.test.tsx`
      - `App.railPanels.test.tsx`
      - `App.searchLinks.test.tsx`
      - `App.settings.test.tsx`
      - `App.sidebarPanels.test.tsx`
      - `App.tsx`
      - `App.workspaces.test.tsx`
      - `appFont.ts`
      - `appLayoutProps.ts`
      - `appLayoutPropsSections.ts`
      - `appLinks.ts`
      - `appShellModel.test.ts`
      - `appShellModel.ts`
      - `appTestHelpers.tsx`
      - `chartData.ts`
      - `chartFrontmatter.ts`
      - `chartNormalize.ts`
      - `chronicleBubbleLayout.test.ts`
      - `chronicleBubbleLayout.ts`
      - `chronicleTimeline.test.ts`
      - `chronicleTimeline.ts`
      - `chronicleTimelineAxis.test.ts`
      - `chronicleTimelineAxis.ts`
      - `chronicleTimelineConstants.ts`
      - `chronicleTimelineDrag.ts`
      - `chronicleTimelineNavigation.ts`
      - `chronicleTimelineRows.test.ts`
      - `chronicleTimelineRows.ts`
      - `colorSwatches.ts`
      - `concurrency.ts`
      - `d2Renderer.ts`
      - `designCompliance.test.ts`
      - `diagramErrorView.ts`
      - `diagramLanguage.ts`
      - `diagramLimits.ts`
      - `diagramPanZoom.ts`
      - `diagramPreview.panZoom.test.ts`
      - `diagramPreview.test.ts`
      - `diagramPreview.ts`
      - `diagramPreviewTestHelpers.ts`
      - `diagramRenderState.ts`
      - `diagramSourceAttribute.test.ts`
      - `diagramSourceAttribute.ts`
      - `diagramSvg.ts`
      - `editorClipboard.ts`
      - `editorContextMenuModel.test.ts`
      - `editorContextMenuModel.ts`
      - `editorContextSelectionHighlight.ts`
      - `editorDerivedState.test.ts`
      - `editorDerivedState.ts`
      - `editorDiagramEditState.ts`
      - `editorDiagramLivePreview.ts`
      - `editorEditable.ts`
      - `editorExtensions.test.ts`
      - `editorExtensions.ts`
      - `editorFrontmatter.ts`
      - `editorFrontmatterFields.ts`
      - `editorFrontmatterModel.test.ts`
      - `editorFrontmatterModel.ts`
      - `editorFrontmatterPropertyMenuModel.test.ts`
      - `editorFrontmatterPropertyMenuModel.ts`
      - `editorFrontmatterWidget.ts`
      - `editorFrontmatterWidgetDom.ts`
      - `editorFrontmatterWidgetInputs.ts`
      - `editorFrontmatterYaml.ts`
      - `editorHeadingFolding.ts`
      - `editorImageDrop.test.ts`
      - `editorImageDrop.ts`
      - `editorListInput.ts`
      - `editorLivePreview.ts`
      - `editorLivePreviewModel.test.ts`
      - `editorLivePreviewModel.ts`
      - `editorLivePreviewWidgets.ts`
      - `editorTableModel.test.ts`
      - `editorTableModel.ts`
      - `editorTables.ts`
      - `editorTableWidget.ts`
      - `editorTableWidgetDom.ts`
      - `editorTableWidgetDrag.ts`
      - `editorTableWidgetMenu.ts`
      - `editorTableWidgetModel.test.ts`
      - `editorTableWidgetModel.ts`
      - `editorTableWidgetState.ts`
      - `filesSidebarModel.test.ts`
      - `filesSidebarModel.ts`
      - `fileTreeModel.test.ts`
      - `fileTreeModel.ts`
      - `fileTreeUi.ts`
      - `frontmatterSettingsModel.test.ts`
      - `frontmatterSettingsModel.ts`
      - `htmlSanitizer.ts`
      - `i18n.tsx`
      - `i18nModel.ts`
      - `keyboardShortcuts.test.ts`
      - `keyboardShortcuts.ts`
      - `largeMarkdown.ts`
      - `main.tsx`
      - `markdownCodeBlockRanges.ts`
      - `markdownCodeFence.ts`
      - `mermaidRenderer.ts`
      - `outputCss.ts`
      - `outputHtml.concurrency.test.ts`
      - `outputHtml.test.ts`
      - `outputHtml.ts`
      - `paneViewModel.test.ts`
      - `paneViewModel.ts`
      - `previewMarkdown.test.ts`
      - `previewMarkdown.ts`
      - `previewUpdateScheduling.test.ts`
      - `previewUpdateScheduling.ts`
      - `rightPanelFrontmatterModel.ts`
      - `styles.css`
      - `toolbarCommands.ts`
      - `toolbarModel.test.ts`
      - `toolbarModel.ts`
      - `toolsPanelModel.test.ts`
      - `toolsPanelModel.ts`
      - `vite-env.d.ts`
      - `workspacePaths.test.ts`
      - `workspacePaths.ts`
    - `shared/`
      - `locales/`
        - `en.json`
        - `ja.json`
      - `chartFrontmatterUpdate.test.ts`
      - `chartFrontmatterUpdate.ts`
      - `chartTime.ts`
      - `frontmatterFields.test.ts`
      - `frontmatterFields.ts`
      - `i18n.test.ts`
      - `i18n.ts`
      - `imageFiles.ts`
      - `ipc.ts`
      - `ipcApi.ts`
      - `ipcChannels.ts`
      - `ipcCharts.ts`
      - `ipcLimits.ts`
      - `ipcOutput.ts`
      - `ipcSettings.ts`
      - `ipcTools.ts`
      - `ipcWorkspace.ts`
      - `links.test.ts`
      - `links.ts`
      - `markdownExtension.ts`
      - `pdfFiles.ts`
      - `rendererCsp.ts`
      - `result.test.ts`
      - `result.ts`
      - `securityRedaction.test.ts`
      - `securityRedaction.ts`
      - `tags.test.ts`
      - `tags.ts`
      - `workspaceTree.test.ts`
      - `workspaceTree.ts`
    - `test/`
      - `rendererTestUtils.ts`
      - `securityFixtures.ts`
      - `setup.ts`
  - `.npmrc`
  - `doctor.config.json`
  - `forge.config.ts`
  - `index.html`
  - `package.json`
  - `pnpm-lock.yaml`
  - `pnpm-workspace.yaml`
  - `tsconfig.json`
  - `vite.base.config.ts`
  - `vite.main.config.ts`
  - `vite.preload.config.ts`
  - `vite.renderer.config.ts`
  - `vitest.config.ts`
- `assets/`
  - `relic-timeline-screenshot.png`
  - `relic-workspace-screenshot.png`
- `docs/`
  - `design/`
    - `DESIGN.html`
    - `DESIGN.md`
    - `LIQUID_CHARCOAL.md`
  - `engineering/`
    - `architecture.md`
    - `data-model.md`
    - `decisions.md`
    - `dependency-licenses.md`
    - `editor-engine.md`
    - `file-access-boundaries.md`
    - `stack.md`
  - `features/`
    - `commands.md`
    - `editor.md`
    - `files.md`
    - `frontmatter.md`
    - `links.md`
    - `markdown.md`
    - `navigation.md`
    - `search.md`
    - `tools.md`
  - `logo/`
    - `Logo.png`
  - `project/`
    - `overview.md`
    - `terms.md`
  - `development.md`
  - `INDEX.md`
- `sbom/`
  - `relic-dependencies.cdx.json`
- `scripts/`
  - `debug.bat`
  - `Relicをビルド.bat`
  - `Relicをビルド.command`
  - `Relicを起動.bat`
  - `Relicを起動.command`
- `.gitattributes`
- `.gitignore`
- `AGENTS.md`
- `CODE_OF_CONDUCT.md`
- `CONTRIBUTING.md`
- `LICENSE`
- `README.md`
- `SECURITY.md`
- `THIRD_PARTY_NOTICES.md`
