# Relic user Skills

This directory contains distributable Skills for people using Relic. These Skills help AI agents create or organize content that will be read in Relic.

They are separate from `.agents/skills/`, which contains instructions for agents developing the Relic application.

## Available Skills

- [relic-author-content](relic-author-content/SKILL.md): Design and write Markdown documents or linked document collections that use Relic's reading, search, front matter, card, table, graph, Sphere, Chronicle, diagram, attachment, and export features.

## Install

Copy a Skill directory into the `skills` directory under the user's Codex home, then start a new task. For the default Codex home, copy:

```text
skills/relic-author-content
→ ~/.codex/skills/relic-author-content
```

The Skill can then be invoked as `$relic-author-content`.

---

# Relic利用者向けSkill

このディレクトリには、Relicを使う人へ配布するSkillを置きます。AIが、Relicで読む資料を作成・整理するためのものです。

Relicアプリ自体を開発するエージェント向けの `.agents/skills/` とは分離しています。

## 利用できるSkill

- [relic-author-content](relic-author-content/SKILL.md): Relicの閲覧、検索、フロントマター、カード、テーブル、グラフ、スフィア、クロニクル、図表、添付、出力を活かしたMarkdown資料や相互リンク資料群を設計・作成します。

## 導入

Skillディレクトリを利用者のCodexホームにある `skills` ディレクトリへコピーし、新しいタスクを開始します。既定のCodexホームでは次の配置です。

```text
skills/relic-author-content
→ ~/.codex/skills/relic-author-content
```

導入後は `$relic-author-content` として呼び出せます。
