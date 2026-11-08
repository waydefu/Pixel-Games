# Pixel-Games｜所有 Agent 的共同工作契約

本 repo **已經有一款獲准開發的中世紀海岸 HD-2D 遊戲**。此檔與 `.github/copilot-instructions.md` 必須指向同一套協作原則。

## 每次啟動必做（不論上次讀過什麼）

1. 讀當前 main HEAD、開啟中的 Issues、PR 與 CI；**不可**把 README、歷史計畫、前次對話或其他 Agent 的回報當即時狀態。
2. 讀 `docs/CONTRIBUTING.md`、`docs/HANDOFF.md`、`docs/FEATURE-STATUS.json`、`docs/decisions/DECISION-REGISTER.md`。
3. 先認領單一 Issue 與執行端 A/B；列出預計修改路徑，檢查是否與其他開啟中的 PR 重疊。如是 hotfix，使用唯一的 HOTFIX-ID。
4. 從最新 main 建立自己的分支；不直接改 main，不沿用另一 Agent 的工作分支。
5. 開 PR 時填滿協作欄位、範圍、風險、相依 PR、驗收與回退。共同檔案衝突要記錄整合方式，不以 Git 自動合併成功代表功能整合完成。

## 權威來源與資料保存

- **即時事實**：GitHub main / Issues / PRs / CI / Pages；靜態進度表是有日期的快照。
- **功能狀態**：`docs/FEATURE-STATUS.json`；新增或移除功能的 PR 必須同步更新。
- **工作分配與交接**：Issues 和 PR 描述；不建立第二份手寫「最新 PR 清單」。
- **決策效力**：`docs/decisions/DECISION-REGISTER.md`；舊計畫、研究與授權紀錄保留，但被取代的條款不得重新施行。
- 任何 `CURRENT` 與 `SUPERSEDED` 衝突，先核對新 PR、Owner 決定及現行程式；有疑義標 BLOCKED，不猜測。

## 安全與品質

- 唯一根遊戲入口；視覺／玩法修改不得製造第二份平行遊戲。
- `src/game/main.ts`、`world.ts`、渲染管線、CI 與資料存檔格式屬高整合風險區；交疊工作需額外相容性驗收。
- `npm ci && npm run validate && npm run test:e2e`；真機 FPS、GPU、音效實聽與人工美術另行驗收。修 CI 須修根因，不得跳過測試或以提高逾時取代證據。
- 僅採合法可追溯素材；不暴露機密，不擅自修改 Pages Source、Ruleset 或花費付費資源。
- **Owner 保留合併決策**；歷史重構授權不是永久免審核通行證。只有當次明確授權才合併。
- 文件和程式可以精確重構與清理；研究、ADR、來源、歷史證據以標記生命週期為優先，不隨便刪除。
