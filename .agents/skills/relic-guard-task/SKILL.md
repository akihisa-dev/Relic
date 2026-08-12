---
name: relic-guard-task
description: Relicの変更・コミット・外部書き込みで、対象、添付・ログ・URLの出所、見本の意図、許可範囲、完了証拠を前後照合し、取り違えを防ぐ。別リポジトリ、別ワークスペース、ユーザーデータ、見本合わせ、push・Issue close・タグ・Release、誤操作復旧で各専門Skillと併用する。調査・質問は対象確認後も読み取り専用とし、専門Skillの手順を置き換えない。
---

# Relic Task Guard

## 作業契約を固定する

1. 最初の書き込み前に、求める結果、許可対象、根拠、対象外、外部操作、完了証拠を短い契約として保持し、ファイルへ保存しない。
2. タスク開始時のワークスペースを既定対象とする。添付、ログ、URL、エラー、発見した別リポジトリだけで対象を切り替えない。
3. 根拠が別リポジトリを示す場合は、読み取り確認だけで不一致を確定し、編集、コミット、push、Issue操作へ進まない。確認済みの対象差と必要な利用者判断を示す。
4. リポジトリ外のフォルダやユーザーデータを明示された場合は、そのパスと依頼操作だけを別許可対象にする。別リポジトリの変更・公開権限は推測しない。
5. 後続指示で目的・範囲が変われば契約を更新し、変更済み範囲との食い違いを確認して続ける。

## Git対象を機械的に照合する

1. 開始時にGit root、branch、remoteを読み、期待rootと正規化hostを含むrepository identity（`github.com/owner/repository`）をタスク根拠で固定する。許可hostは既定`github.com`、別hostだけ`--allowed-host`で指定する。
2. 最初のファイル変更、コミット、push、タグ操作の直前に、対象コマンドの作業ディレクトリを次で照合する。

   ```sh
   python3 .agents/skills/relic-guard-task/scripts/verify_task_target.py \
     --expected-root <task-start-git-root> \
     --candidate <command-working-directory>
   ```

3. remoteへ書き込む場合は、GitHub一次情報または確認済みremoteから得たrepository identityも指定する。

   ```sh
   python3 .agents/skills/relic-guard-task/scripts/verify_task_target.py \
     --expected-root <task-start-git-root> \
     --candidate <command-working-directory> \
     --expected-repository <host/owner/repository> \
     --remote <remote-name>
   ```

   HTTPSまたはSSHのremoteだけを受け付け、同じowner/repositoryでも許可hostが異なるremoteは拒否する。`owner/repository`の短縮形を使う場合は、`--expected-host <host>`を併記する。別hostを許可する場合は、対象hostごとに`--allowed-host <host>`を繰り返し指定する。

4. 照合失敗時は書き込まない。別リポジトリへは対象を明示された場合だけ契約を更新して切り替える。
5. Git管理外の明示フォルダはscriptを認可手段にせず、許可パスと実対象を直前照合する。

## 提示見本の意図を固定する

1. 画像、動画、コード、デザイン見本を確認し、事実と推論を分ける。コード断片だけで寸法、色、配置、画面を補完しない。
2. 対象、維持構造、変更挙動、視覚不変条件、許容調整、未指定事項を受入条件へ対応付ける。
3. 「まず見本」「単独で見せて」など順序指定時は製品コードを変えず見本だけ作り、表示結果を確認して提示する。採用指示まで実装、version更新、コミットへ進まない。
4. 現行テーマへ合わせる場合も、見本の構造と動きを先に保つ。目的のない外枠、面、色、装飾、アニメーションを追加しない。
5. 見本を表示または操作できない場合は、視覚的な一致を完了扱いにせず、未確認条件を示す。

## 専門Skillへ渡して完了証拠を集める

1. 要求ごとに変更箇所、自動テスト、文書、外部状態のどれで完了を証明するか決める。実画面は明示時だけ証拠に含め、無関係な検査を増やさない。
2. UIは `$relic-change-ui` と `$relic-test-development-app`、Issueは `$relic-issue`、コミットとversion・SBOMは `$relic-commit` と `$relic-manage-version`、機能廃止は `$relic-retire-feature` へ委ねる。
3. 複数Skillの条件が食い違う場合は`AGENTS.md`と結果所有Skillへ照合して解消する。独自条件で完了を遅らせない。
4. ツールの成功表示、テスト成功、開発版の起動、コミット作成を、それぞれ利用者が求めた結果そのものと混同しない。

## 外部操作と復旧を保護する

1. push、Issueコメント・close、タグ、Release、外部送信は明示範囲だけ行う。ローカル修正・コミット許可をpush許可へ広げない。
2. Issueの完了条件へpushを追加せず、`$relic-issue` の現行条件に従う。公開後のremote到達確認は公開状態として別に扱う。
3. 誤対象への変更を検知したら停止し、ローカル差分、コミット、remote反映、正対象への影響を分けて確認する。復旧は指示範囲だけ安全に打ち消す。
4. 復旧後は対象・非対象リポジトリの作業ツリー、branch、local・remoteの一致を必要範囲で確認する。

## 完了前に再照合する

1. 最新指示と契約を読み直し、`git status`、全差分、対象テスト、文書、外部状態を結果ごとに照合する。実画面は明示時だけ対象にする。
2. 対象、見本、権限、完了条件のどれかが未確認なら、その結果を確認済みと報告しない。
3. 変更結果、検証済み事項、未確認事項、未実施の外部操作、非対象への影響を分けて報告する。
