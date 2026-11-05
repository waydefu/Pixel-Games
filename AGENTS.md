# Pixel-Games 工程代理


**P1 超進化工作入口：** [唯一 G1～G6 開工計畫](docs/plans/P1-VISUAL-SUPER-EVOLUTION-MASTER-PLAN-2026-11-05.md) 管工作包、狀態與 Owner 已批准的景深／泛光；[踩坑紀錄](docs/governance/VISUAL-PITFALLS-LOG.md) 記已證實缺陷／歷史／未驗風險。開始每個 PR 前要重查 main SHA、CI、基準截圖與授權，不沿用歷史研究的「待決策」狀態。不得自動合併。

此儲存庫只有一款原創中世紀海岸 HD-2D 探索遊戲。根目錄 `index.html` 直接進入全畫面；不要增加 landing page、舊地城、平行 prototype、V1/V2 並存目錄。

- 先讀 [README](README.md)、[文件索引](docs/INDEX.md)、[美術規範](docs/ART-DIRECTION.md) 與 [架構](docs/ARCHITECTURE.md)。**舊研究須標註時點與已被取代的決策，不應直接刪除。**
- 以 Bells of Evermere 的品質和 HD-2D 技術為參考，不複製其素材、故事、模型、程式。
- 美術與玩法分層：`src/game/art.ts`、`kit.ts`、`architecture.ts`、`environment.ts`、`world.ts`。不要改用大量互不相關的硬編碼方塊。
- 不使用不符中世紀設定的球形電燈／現代燈柱，照明採日光、燭光、壁燈與窗光。
- `src/game/main.ts` 控制唯一玩家入口；`src/rendering/` 為渲染基礎。可重用的 `src/platform/` 與 `src/integrations/`、研究文件與 `.agents/skills/` 必須保留，除非另外核准淘汰。它們不會自動載入遊戲或取得任何 MCP 權限。
- 改動需獨立 PR；Owner 審查後合併，未授權不更動 Secrets、Pages Source、保護規則或推到 main。
- `npm ci && npm run validate && npm run test:e2e`；真機測試和人眼美術驗收不能以 CI 通過替代。


## 峽灣／第一人稱模組規則

新地形不要塞回 `environment.ts` 的單一平面；高度函數置於 `src/game/terrain-profile.js`，山體生成在 `fjord.ts`。切換視角要透過 `camera.ts` 和 Renderer Port 的 `setCamera()`，不可為每種視角重新初始化 WebGLRenderer。第一人稱移動必須沿既有碰撞規則；右側觸控環視和左側搖桿不可互相搶 pointer。觀景鏡頭與玩家角色位置獨立，不得偷渡自由飛行或未做的山區碰撞。研究資料、ADR 與 Skills 仍需保留。
