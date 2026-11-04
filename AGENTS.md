# Pixel-Games Agent 工作入口

這是以 Three.js 為優先方向的**原創瀏覽器遊戲平台**。不得自行匯入舊地城，不能把仍待審查的海岸生活遊戲提案當已批准的遊戲實作。

1. **先精準查資料**：讀 [docs/INDEX.md](docs/INDEX.md) 選對文件，再 `rg --files`、`rg -n`；不要整庫轉存或複製 Research- 原文。
2. **權限範圍**：除非 Owner 明確批准，不修改 GitHub Pages Settings、Rulesets、Secrets、正式部署、合併 PR、第三方素材或安裝未知 MCP。
3. **程式分層**：`src/platform/` 只放獨立核心；`src/rendering/renderer-port.js` 是渲染後端契約；`src/integrations/` 是工具能力路由；`lab/` 是中立 GPU 實驗，**不是遊戲**；`games/<slug>/` 只有確認企劃後才新增。
4. **開發環境**：Node.js 26 LTS 建議；`npm ci` 固定 lockfile，`npm run validate` 包含 Node/TypeScript/Vite，`npm run test:e2e` 驗證桌機與手機 viewport。
5. **實際證據**：單元通過 ≠ 瀏覽器 GPU 正常 ≠ 手機真機性能通過；沒有 GPU context 時瀏覽器測試僅驗證 fallback。未跑的測試寫 NOT RUN。
6. **工具接入**：先讀 [docs/TOOL-INTEGRATIONS.md](docs/TOOL-INTEGRATIONS.md)；adapter 要有 input/output schema、timeout、AbortSignal 及 host 權限邊界。它不是沙盒，不能把 MCP Token 給瀏覽器。
7. **程式變更**：只在獨立分支／PR，附回退、實際測試結果；不偽稱 CI 緑燈或審查／部署成功。

按需 Skills：`.agents/skills/`。研究參考：[Research-](https://github.com/waydefu/Research-)。遊戲規格請走 [遊戲提案模板](docs/GAME-PROPOSAL-TEMPLATE.md)。
