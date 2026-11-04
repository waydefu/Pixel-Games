# GitHub main 分支保護（2026-11-05）

Repo 的 `Protect main` Ruleset 在使用者設定後已確認 **Active**。使用者先前設定了 required PR、必要 CI `Build, typecheck, unit and browser tests`、禁止 force-push 與限制刪除；實際欄位以 [GitHub Rulesets](https://github.com/waydefu/Pixel-Games/settings/rules) 為準。

- 任何遊戲修正、研究恢復或工程清理都走獨立 PR；不直接 push `main`，不自行合併。
- CODEOWNERS 不等於已強制 reviewer；審查批准數與 required checks 需看 GitHub 現有規則。
- 不要因為單次 CI 綠燈宣稱真機或美術品質已通過。
- 若要調整 GitHub Settings、Secrets、Pages Source，必須先取得 Owner 額外批准。

原始建立規則的歷史詳見 Git 提交紀錄，避免在此保留過期的「Rulesets 為空」敘述。
