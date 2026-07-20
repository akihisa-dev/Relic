---
name: relic-change-localization
description: Relicの日本語・英語UI文言、用語、翻訳キー、placeholder、アクセシブル名、英語fallbackを、用語集・正本文書・ja/en辞書・main/renderer共通translator・表示幅まで整合させる。UI名称変更、翻訳追加・修正、未翻訳、辞書不一致、翻訳キー欠落、言語別の見切れやaria-labelの修正に使う。言語設定値のschema・保存・移行はrelic-change-settings、見た目だけの調整はrelic-change-ui、機能仕様の変更は対応する機能Skillを優先する。
---

# Relic Localization Change

## 変更対象と正本を決める

1. 調査、翻訳案、用語相談だけなら編集しない。名称、翻訳、辞書、fallbackの変更が明示されている場合だけ実装する。
2. `git status --short` を確認し、対象の画面、用語、translation key、言語を限定する。
3. 製品概念と画面名は `docs/project/terms.md`、対象の振る舞いは `docs/features/`、画面構成は `docs/design/DESIGN.md` を正本として確認する。
4. 表示言語の選択、system追従、保存、schema、移行だけを変える場合は `$relic-change-settings` へ委ねる。
5. 余白、折返し、幅、tooltipなど表示だけを変える場合は `$relic-change-ui` を使う。文言変更により表示条件も変わる場合は両方を併用する。

## 用語と翻訳キーを設計する

1. 同じ概念に既存のtranslation keyや用語があるか、ja/en辞書、用語集、呼出箇所を `rg` で確認する。
2. 用語集に定義された日本語名、Relic英語名、実装識別子を混同しない。UIの短い表示名と仕様上の概念名が異なる場合は正本の区別を保つ。
3. 他製品名をRelicの仕様、UI文言、translation keyへ持ち込まない。外部出典として必要な場合だけ正本文書の参照箇所に限定する。
4. keyは表示位置ではなく意味を表す既存のnamespaceと命名へ合わせ、同じ意味のkeyを画面ごとに増やさない。
5. 文中の可変値は既存translatorの `{{name}}` 形式を使い、ja/enで同じplaceholder名を保つ。
6. 動的に組み立てたkeyは既存型検査と欠落検査を弱めるため、有限のliteral keyまたは明示的なmappingを優先する。

## 辞書と呼出箇所を同期する

1. `app/src/shared/locales/ja.json` と `en.json` へ同じkeyを同時に追加・変更・削除する。
2. 英語fallbackを前提に日本語keyを欠落させず、両辞書を完全な同一key集合として維持する。
3. rendererとmainで共通の文言は `app/src/shared/i18n.ts` の型付きtranslatorを使い、別の翻訳処理を増やさない。
4. React component、hook、model、main processへ自然言語を直書きせず、既存のtranslator境界から受け取る。
5. `aria-label`、title、tooltip、empty state、error、dialog、command、shortcut説明も画面本文と同じ翻訳対象として確認する。
6. key削除や改名では、literal呼出だけでなくmapping、test、文書、main/renderer双方の参照を検索してから消す。
7. 用語の意味、主要UI名、英名が変わる場合だけ `docs/project/terms.md` と対象正本文書を同期する。単なる表現改善で実装識別子まで改名しない。

## 表示とfallbackを確認する

1. `system` はOSまたはブラウザー言語が `ja` で始まる場合だけ日本語、それ以外は英語となる既存規則を保つ。
2. 選択言語の文言、英語文言、key文字列の順にfallbackする既存規則を、明示的な仕様変更なしに変えない。
3. 日本語と英語で、文字列補間、改行、句読点、複数行、空値、長いファイル名や数値を確認する。
4. 英語の長い文言と日本語の折返しについて、狭い幅、button、tab、menu、tooltip、dialog、aria nameの影響を選ぶ。
5. 文言変更だけを理由に固定幅を増やさず、短いUI名、自然な折返し、既存layoutの順に解決する。
6. ユーザーが実画面確認を明示的に指示した場合だけ、見切れや操作性を `$relic-change-ui` と `$relic-test-development-app` に従って、その作業で起動した開発版で確認する。

## 検証する

1. `app/` で `pnpm exec vitest run --project node src/shared/i18n.test.ts` を実行し、ja/en key同期、literal key欠落、literal `aria-label` を確認する。
2. placeholderやtranslatorを変更した場合は `src/shared/i18n.test.ts` へ正常系とfallbackの回帰テストを追加または更新する。
3. 対象component、main処理、設定画面の関連testと `pnpm typecheck` を実行する。
4. 用語集や正本文書を変えた場合は `pnpm docs:index:check` と参照先を確認する。
5. 表示へ影響する場合は日本語、英語、必要ならsystem追従で対象状態を確認する。確認していない言語や画面を確認済みと報告しない。
6. `git diff --check` と全差分を確認し、片方だけの辞書変更、未使用key、自然言語の直書き、他製品名、機密情報がないことを確かめる。

## 完了する

変更した用語とkey、同期した辞書・正本文書、fallback、対象test、言語別に確認した表示、未確認項目と理由を報告する。コミットする場合は `$relic-commit` に従う。
