# Pixel-Games 文件索引｜現行與歷史分開

> 本索引是**任務導覽，不是開工必讀清單**。2026-11-09 核對時，專案即時狀態以 GitHub main／Issues／PR／CI 為準；以下各文件依工作類型按需閱讀。11/5 研究與授權是歷史快照，不是即時任務清單。

這個 Repo 只有**一個正式遊戲入口**，但研究、技術決策、Agent Skills 與工程模組可以獨立保留。

> **歷史授權（非當次自動許可）**：[2026-11-05 全面重構授權紀錄](governance/OWNER-VISUAL-REBUILD-AUTHORITY-2026-11-05.md) 保留供研究；目前仍以每次 PR 的 Owner 決策、main 保護與必要 CI 為準。

## 任務路由（只讀當次需要的文件）

| 現在要做什麼 | 最小入口（再深入讀必要的檔案） |
| --- | --- |
| 找程式實作、模組、符號 | [ARCHITECTURE](ARCHITECTURE.md) → 搜尋 `src/game/`、`src/rendering/`；不要預設讀整份 `main.ts` |
| 接手 Issue／開 PR／查衝突 | 即時 GitHub Issues／PR／Actions → [HANDOFF](HANDOFF.md)；要認領／交付再讀 [CONTRIBUTING](CONTRIBUTING.md) |
| 查已交付功能 | [FEATURE-STATUS](FEATURE-STATUS.json) + main 程式／已合併 PR（只有涉及功能狀態時讀） |
| 改決策、確認舊研究有效性 | [DECISION-REGISTER](decisions/DECISION-REGISTER.md) → 相關 ADR／研究原文 |
| Shader、海面、雲、效能 | [ARCHITECTURE](ARCHITECTURE.md) → [QUALITY-GATES](QUALITY-GATES.md) 的相關節 → 渲染程式；真 GPU 無證據標 NOT RUN |
| 外部素材、授權與工具 | [ASSET-POLICY](ASSET-POLICY.md)、[ASSET-CREDITS](ASSET-CREDITS.md) 或 [TOOL-INTEGRATIONS](TOOL-INTEGRATIONS.md)，依需求擇一 |
| GitHub CI／安全／部署 | [BRANCH-PROTECTION](governance/BRANCH-PROTECTION.md)、[PAGES-DEPLOYMENT](governance/PAGES-DEPLOYMENT.md) 與相應 `.github/workflows/` |
| 需要專用工作流程 | 查看 [Agent Skills](../.agents/skills/) 的 `description`，僅觸發相關 `SKILL.md`；不一次載入所有 |
| Copilot 改渲染／GitHub 治理檔 | 路徑限定 [渲染指引](../.github/instructions/rendering.instructions.md) 或 [治理指引](../.github/instructions/governance.instructions.md)；只在匹配路徑時適用 |

**閱讀順序：** 先定位任務 → 路由到單一入口 → 精確搜尋符號/行數 → 缺脈絡才擴大閱讀。複雜跨模組重構需足夠全文脈絡；「少讀」不可以壓過正確性與安全。

## 現行規範（以程式和 CI 為準）

| 類型 | 文件 |
| --- | --- |
| **雙人協作與任務認領** | [CONTRIBUTING](CONTRIBUTING.md) |
| **動態交接入口** | [HANDOFF](HANDOFF.md) |
| **機器可讀功能狀態** | [FEATURE-STATUS](FEATURE-STATUS.json) |
| **決策有效性與被取代紀錄** | [DECISION-REGISTER](decisions/DECISION-REGISTER.md) |
| 玩法狀態、執行命令、檔案入口 | [README](../README.md) |
| 遊戲與共用技術架構 | [ARCHITECTURE](ARCHITECTURE.md) |
| HD-2D 美術與授權邊界 | [ART-DIRECTION](ART-DIRECTION.md) |
| 自動化與真機驗收 | [QUALITY-GATES](QUALITY-GATES.md) |
| 外部素材與 SHA256 | [ASSET-POLICY](ASSET-POLICY.md) |
| 工具狀態／安裝邊界 | [TOOLING](TOOLING.md) |
| Tool Registry 合約與接入流程 | [TOOL-INTEGRATIONS](TOOL-INTEGRATIONS.md) |
| 路線圖與有日期的里程碑（即時狀態查 GitHub） | [ROADMAP](ROADMAP.md) |
| G1～G6 歷史技術拆包與原始驗收規格（非當前進度） | [SUPER-EVOLUTION-MASTER-PLAN](plans/P1-VISUAL-SUPER-EVOLUTION-MASTER-PLAN-2026-11-05.md) |
| **踩坑與風險紀錄（已驗證／歷史／風險分級）** | [VISUAL-PITFALLS-LOG](governance/VISUAL-PITFALLS-LOG.md) |
| GitHub 分支保護 | [BRANCH-PROTECTION](governance/BRANCH-PROTECTION.md) |
| GitHub Pages 發布 | [PAGES-DEPLOYMENT](governance/PAGES-DEPLOYMENT.md) |
| 全 repo 優化點盤點與具體修法（2026-11-10 快照，對照 #78） | [OPTIMIZATION-AUDIT-2026-11-10](reviews/OPTIMIZATION-AUDIT-2026-11-10.md) |
| 本輪獨立程式審查 | [AUDIT-2026-11-05](reviews/INDEPENDENT-AUDIT-2026-11-05.md) |
| **P1 視覺品質整合主報告（唯一現行研究入口）** | [VISUAL-QUALITY-INTEGRATED-RESEARCH](reviews/P1-VISUAL-QUALITY-INTEGRATED-RESEARCH-2026-11-05.md) |
| **G3～G6 四張場景參考的美術驗收補充** | [CINEMATIC-REFERENCE-BRIEF](reviews/P1-CINEMATIC-FOUR-REFERENCE-ART-BRIEF-2026-11-05.md) |

> 目前實作與合併狀態先查 GitHub main／Issues／PR／Actions；[ROADMAP](ROADMAP.md) 僅提供路線與有日期的狀態描述。G1～G6 原計畫保留技術推導與歷史驗收條件，**不作為當前待辦來源**；研究報告及踩坑紀錄依其原本目的保留。

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
