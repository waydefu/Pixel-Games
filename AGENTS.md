# Pixel-Games｜Agent 共同契約

本 Repo 僅有一個正式的中世紀海岸遊戲入口；本檔是**最小常駐規則**，不是要求每次讀完整個專案。

## 按需定位（Progressive Disclosure）
- 不熟悉模組時先看 `docs/INDEX.md` 的「任務路由」，再搜尋**相關符號／檔案／局部行數**；不要先整庫掃描、展開所有文件或載入全部 Skills。
- `docs/ARCHITECTURE.md` 用於跨模組變更；`docs/QUALITY-GATES.md` 用於測試／渲染驗收；`.agents/skills/*/SKILL.md` 僅在任務符合其描述時讀取。
- 對既有專案狀態有疑問，以即時 GitHub main／Issues／PR／Actions／Pages 為準；README、研究及前次回報不能取代即時查證。

## 有實作或 PR 時必守
1. 開工前核對最新 main HEAD、open Issue／PR、相關 CI；查重、列修改路徑和相依工作，避免與別人的 PR 衝突。
2. 一張工作 Issue 對應明確驗收；自行認領並註明執行端 A＝Waydefu、B＝cooby19。協作／接手流程依 `docs/CONTRIBUTING.md`，當次交接依 `docs/HANDOFF.md`。
3. 從最新 main 開自己的分支；只透過 PR 整合，不直接改 main 或覆寫他人分支。PR 記錄範圍、關聯 Issue、重疊檔案、測試 PASS／FAIL／NOT RUN、風險與回退；**Owner 當次授權後**才可合併。
4. 改**已實作功能**才核對並更新 `docs/FEATURE-STATUS.json`；改**有效設計決策**才核對 `docs/decisions/DECISION-REGISTER.md`。保留舊研究、ADR、素材來源和歷史決策；SUPERSEDED／HISTORICAL 不作現行需求。

## 不可放寬
- 單一遊戲入口；`src/game/main.ts`、`world.ts`、渲染、輸入、存檔與 CI 是高交集區，修改時須做跨模組回歸。
- 原始碼／授權素材合法可追溯；不暴露機密、不擅自修改 Ruleset、Pages Source 或付費資源。
- 程式 PR 須驗證 `npm run validate` 與相關 E2E；完整驗收依風險執行。CI／SwiftShader 綠燈**不代表**真手機 FPS、GPU、聲音或美術合格；不得靠略過測試或盲目加 Timeout 偽造綠燈。
