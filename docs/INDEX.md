# Pixel-Games 文件索引｜現行與歷史分開

這個 Repo 只有**一個正式遊戲入口**，但研究、技術決策、Agent Skills 與工程模組可以獨立保留。

## 現行規範（以程式和 CI 為準）

| 類型 | 文件 |
| --- | --- |
| 玩法狀態、執行命令、檔案入口 | [README](../README.md) |
| 遊戲與共用技術架構 | [ARCHITECTURE](ARCHITECTURE.md) |
| HD-2D 美術與授權邊界 | [ART-DIRECTION](ART-DIRECTION.md) |
| 自動化與真機驗收 | [QUALITY-GATES](QUALITY-GATES.md) |
| 外部素材與 SHA256 | [ASSET-POLICY](ASSET-POLICY.md) |
| 工具狀態／安裝邊界 | [TOOLING](TOOLING.md) |
| Tool Registry 合約與接入流程 | [TOOL-INTEGRATIONS](TOOL-INTEGRATIONS.md) |
| 已完成／後續里程碑 | [ROADMAP](ROADMAP.md) |
| **P1 超進化 G1～G6 唯一執行總計畫（含景深與泛光）** | [SUPER-EVOLUTION-MASTER-PLAN](plans/P1-VISUAL-SUPER-EVOLUTION-MASTER-PLAN-2026-11-05.md) |
| **踩坑與風險紀錄（已驗證／歷史／風險分級）** | [VISUAL-PITFALLS-LOG](governance/VISUAL-PITFALLS-LOG.md) |
| GitHub 分支保護 | [BRANCH-PROTECTION](governance/BRANCH-PROTECTION.md) |
| GitHub Pages 發布 | [PAGES-DEPLOYMENT](governance/PAGES-DEPLOYMENT.md) |
| 本輪獨立程式審查 | [AUDIT-2026-11-05](reviews/INDEPENDENT-AUDIT-2026-11-05.md) |
| **P1 視覺品質整合主報告（唯一現行研究入口）** | [VISUAL-QUALITY-INTEGRATED-RESEARCH](reviews/P1-VISUAL-QUALITY-INTEGRATED-RESEARCH-2026-11-05.md) |
| **G3～G6 四張場景參考的美術驗收補充** | [CINEMATIC-REFERENCE-BRIEF](reviews/P1-CINEMATIC-FOUR-REFERENCE-ART-BRIEF-2026-11-05.md) |

> 執行順序／狀態只維護在 P1 超進化總計畫；研究報告保留技術證據，踩坑紀錄保留可重現的教訓，不建立平行待辦。

## 研究與歷史決策（保留原文、不直接當現行程式）

> P1 外部研究的兩份初稿已在主報告末尾列出並保留原文，不再於此重複列為現行規範。

| 類型 | 文件 |
| --- | --- |
| Research- → Pixel-Games 技術採用 | [RESEARCH-ADOPTION](RESEARCH-ADOPTION.md) |
| Three.js／HD-2D 官方技術核實 | [THREEJS-ENGINEERING](research/THREEJS-ENGINEERING-2026-11-04.md) |
| 初始工程底座決策 | [ADR-0001](decisions/ADR-0001-foundation-first.md) |
| Three.js 優先選型研究 | [ADR-0002](decisions/ADR-0002-threejs-priority.md) |
| 根入口與斜上方視角決策 | [ADR-0003](decisions/ADR-0003-direct-game-root.md) |
| P0.3–0.5 工程審查舊紀錄 | [2026-11-04 ARCHITECTURE-REPAIR](reviews/ARCHITECTURE-REPAIR-2026-11-04.md) |
| 最初海岸生活世界提示詞 | [原始企劃](prompts/sol6-medieval-coastal-life-world.md) |
| 舊版工具狀態快照 | [2026-11-04 TOOLING](history/TOOLING-2026-11-04.md) |
| 未來遊戲／擴充企劃模板 | [GAME-PROPOSAL-TEMPLATE](GAME-PROPOSAL-TEMPLATE.md) |

## 開發操作

按需 Skills 在 [`.agents/skills/`](../.agents/skills/)：程式治理、素材來源、手機 WebGL、畫質、角色視覺、Three.js、工具接入、遊戲企劃。它們不是遊戲場景，也不是自動安裝或擁有權限的 MCP。

**資料保留原則：** 只有確定淘汰且不再引用的遊戲實作才刪除；研究、決策、來源連結、可重用技術要保留並標示狀態。新的資料與舊快照有衝突時，以現行程式和最新 CI／Owner 決策為準。
