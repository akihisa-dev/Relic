---
name: relic-change-frontmatter
description: Relicのフロントマターについて、先頭YAMLの解析、フォーム表示、固定プロパティ、追加・編集・削除、候補、YAML往復、タグ・別名・年表への派生を本文と既存YAMLを保護しながら変更する。parser、serializer、フォーム入力、壊れたYAML、aliases・category・tags・chronicleの依頼に使う。一般のMarkdown編集はrelic-change-markdown-editor、出力はrelic-change-markdown-output、見た目だけはrelic-change-ui、Issue起点はrelic-issue、コミットだけはrelic-commitを優先する。
---

# Relic Frontmatter Change

## 境界を決める

1. 調査、説明、レビューだけの依頼では編集しない。変更が明示された場合だけ実装する。
2. フロントマターの実体を各Markdown先頭のYAMLとし、アプリ設定や派生データを正本にしない。
3. フォーム、ソースYAML、固定プロパティ設定、検索・タグ・年表への派生のどこを変えるかを特定する。
4. Issue番号またはURLが入口なら `$relic-issue`、コミットだけなら `$relic-commit` を優先する。

## 正本と往復条件を確認する

1. `docs/features/frontmatter.md` と `docs/engineering/data-model.md` を読む。
2. エディタ内表示へ触れる場合は `docs/features/editor.md` と `docs/engineering/editor-engine.md` も読む。
3. main側の解析とrenderer側の解析・局所書き戻しを区別し、用途を混同しない。
4. 未認識キー、コメント、並び、単純スカラーのクォート、本文文字列から、保持すべきfixtureを先に作る。

## 実装する

1. ファイル先頭の完結した `---` ブロックだけをフロントマターとして解析する。
2. YAMLが不正、未完了、トップレベルmapping以外の場合はフォームから書き戻さず、本文編集だけを継続可能にする。
3. フォーム編集では対象トップレベルキーの範囲だけを書き換え、本文と対象外キーをそのまま保持する。
4. 全体を機械的にdumpしてコメント、並び、クォートを失わせず、既存の局所serializerを拡張する。
5. フロントマターがない場合だけ先頭へ新規ブロックを作り、最後のキー削除時は空ブロックも削除する。
6. 未認識キーを削除・変換せず、固定プロパティ以外をRelic専用schemaへ強制しない。
7. 配列をフォーム編集した場合はブロック配列へ書き戻し、空値または空配列では対象キーを削除する。
8. 数値、日付、真偽値、`chronicle` を仕様どおり検証し、不正入力ではMarkdownを変更しない。
9. `aliases`、`category`、`tags`、`chronicle` の固定意味と、旧設定の互換読み込みを新規管理機能と混同しない。
10. 折りたたみ、フォームfocus、ソースモード切替を変更しても、本文選択と編集可能状態を壊さない。

## 検証する

1. parseとserializeには未設定、空、正常、不正、未完了、scalar、array、mappingの単体テストを追加する。
2. 局所更新には複数行値、隣接キー、コメント、クォート、未知キー、最後のキー削除の往復テストを追加する。
3. フォームには追加、編集、配列追加、削除、不正入力、折りたたみ、再作成のrendererテストを追加する。
4. 派生利用へ触れた場合はタグ、別名、検索候補、年表の該当テストも実行する。
5. `app/` で対象node・rendererテストと `pnpm typecheck` を実行し、影響が広い場合は `pnpm verify` を実行する。
6. ユーザーから見える規則を変えた場合は `docs/features/frontmatter.md` と必要なデータモデル記述を同期する。
7. `git diff --check` とfixture差分を確認し、本文消失、無関係なYAML整形、不可視メタデータがないことを確かめる。

## 完了する

保持できたYAML要素、拒否した不正入力、本文保護、更新した正本、実施した往復テストと未確認項目を報告する。
