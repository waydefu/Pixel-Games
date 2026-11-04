# GitHub Main Branch Governance Gate

查證於 2026-11-04：GitHub Rulesets 讀取結果為空清單；Branch Protection REST API 因連接器權限回傳 403，**無法確認是否透過其他設定執行保護**。

這份 PR 只更新程式與文件，**沒有變更 GitHub repository settings、Rulesets、團隊審查或 GitHub Pages 的 Source**。

## 需要 Owner 在 GitHub 設定中核對的項目

1. Settings → Rules → Rulesets（或 Branch protection rules）；確認 `main` 是否受到保護。對個人公開 repo 的功能需依實際 GitHub Plan/Settings 支援狀態。
2. 建議規則：Require a pull request before merging、Require status checks to pass `Build, typecheck, unit and browser tests`；可考慮避免強制推送和分支刪除。
3. 如果 GitHub 要求至少一位外部 reviewer，獨立開發者不能假裝以自己的帳號通過審查；按現實協作方式選擇適用規則。
4. CODEOWNERS 提供責任歸屬，**只有配置相符的 Ruleset 才能真正強制 code-owner review**。
5. 正式公開 Vite `dist` 需要另一份經審核的 Pages Actions workflow、權限 `pages:write` 等及人類批准；本 PR 僅 build/test，不擅自啟用部署。

驗收：取得實際 Settings 截圖或 API 證據後，才能把「branch protection enforced」寫成 PASS。
