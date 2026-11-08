# GitHub main 分支保護｜實際 Ruleset

> 2026-11-08 GitHub Rulesets API 確認 `Protect main` Active。最新以 [Ruleset](https://github.com/waydefu/Pixel-Games/rules/26524404) 為準。

- 強制 Pull Request、必要 `Build, typecheck, unit and browser tests`、strict 最新分支、禁止刪除和非快進推送。
- **必要批准 0 人**、沒有強制 CODEOWNERS review、沒有必須解決討論；CI 綠不等於第三方審查。
- 這次在 CI 新增 `collaboration`，對新 PR（#37 起）檢查任務認領、A/B 執行端與核心檔案交集；原 required gate 也會要求它成功。
- 若兩個 Agent 共用同一 GitHub 身分，Ruleset 不能區分人。若將來使用不同帳號，可由 Owner 考慮要求 1 人批准、CODEOWNERS 和解決全部 review threads。

**此 PR 不更動平台 Ruleset，不繞過 main 保護。** 合併仍以 Owner 當次授權為準。
