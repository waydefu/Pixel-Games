# Pixel-Games 工程代理

此儲存庫只有一款原創中世紀海岸 HD-2D 探索遊戲。根目錄 `index.html` 直接進入全畫面；不要增加 landing page、舊地城、平行 prototype、V1/V2 並存目錄。

- 實作讀 [README](README.md)、[美術規範](docs/ART-DIRECTION.md)、[架構](docs/ARCHITECTURE.md) 即可；過時調研不應留在現行樹。
- 以 Bells of Evermere 的品質和 HD-2D 技術為參考，不複製其素材、故事、模型、程式。
- 美術與玩法分層：`src/game/art.ts`、`kit.ts`、`architecture.ts`、`environment.ts`、`world.ts`。不要改用大量互不相關的硬編碼方塊。
- 不使用不符中世紀設定的球形電燈／現代燈柱，照明採日光、燭光、壁燈與窗光。
- `src/game/main.ts` 控制唯一輸入與渲染；`src/rendering/` 為共用基礎；遊戲資料不用預設大型 ECS/MCP。
- 改動需獨立 PR；Owner 審查後合併，未授權不更動 Secrets、Pages Source、保護規則或推到 main。
- `npm ci && npm run validate && npm run test:e2e`；真機測試和人眼美術驗收不能以 CI 通過替代。
