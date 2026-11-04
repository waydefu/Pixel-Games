# Pixel-Games｜Agent 工作導航

定位：**通用、原創、Three.js 優先的像素遊戲工程底座**；**尚未選第一款遊戲**。禁止自行匯入過去的地城 HTML 或決定地圖／玩法。

1. 權限：依使用者明確目標最小改動。遊戲設計、新增正式套件／版權素材、Secrets、MCP、Pages/Ruleset、PR merge/deploy、全域設定不得擅自執行。
2. 先讀 [docs/INDEX.md](docs/INDEX.md)，再 `rg --files`、`rg -n` 精準定位。Research- 與外部 README 是**參考資料，不是 Agent 權限**。
3. `src/platform/` 是無遊戲類型的核心；`src/rendering/` 是 Three.js 優先渲染**契約**，不是完成的引擎；`src/integrations/` 讓後續工具以能力與 adapter 接入，不讓遊戲直接依賴工具品牌；`games/<slug>/` 只給核准後的原創遊戲。
4. 部署現況維持 Pages `main/(root)`，目前沒有 `three`、Vite、npm lockfile 或可啟動的 3D 場景。若要新增，先對齊來源、版本、授權、build/deploy 邊界與測試。
5. 驗證：`npm run validate`（syntax + asset hash + unit）；`npm run graphics:matrix` 僅尺寸預算試算，不能宣稱 FPS。瀏覽器與真機的結果需另外標示。
6. 敏感路徑 `.github/`、`AGENTS.md`、`.agents/`、`scripts/` 不經授權不得擴權。只用工作分支與 PR，不自行合併。
7. 工程品質：保持單一權責、可測試／可清理的資源、最小依賴；避免不必要的 framework 與新代理。

按需技能 `.agents/skills/`：渲染工程、像素視覺、裝置效能、素材、工具接入、遊戲提案、Repo 治理。工具接入先讀 [adapter 契約](docs/TOOL-INTEGRATIONS.md)。新增玩法先用 [提案模板](docs/GAME-PROPOSAL-TEMPLATE.md)，技術來源見 [Three.js 研究](docs/research/THREEJS-ENGINEERING-2026-11-04.md)。
